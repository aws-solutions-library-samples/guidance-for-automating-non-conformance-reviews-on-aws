/**
 * Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const { Client } = require('@opensearch-project/opensearch');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { AwsSigv4Signer } = require('@opensearch-project/opensearch/aws');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { Logger } = require('@aws-lambda-powertools/logger');

const logger = new Logger({
    serviceName: 'create-index-function',
    logLevel: 'INFO'
});

exports.handler = async (event, context) => {

    logger.info('Received event:', JSON.stringify(event));

    // Create STS client
    const stsClient = new STSClient({ region: process.env.REGION });

    // Get the actual identity
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    logger.info('OpenSearch Client Identity', {
        identityArn: identity.Arn,
        accountId: identity.Account,
        userId: identity.UserId
    });

    const client = new Client({
        ...AwsSigv4Signer({
            region: process.env.REGION,
            service: 'aoss',
            getCredentials: () => {
                const credentialsProvider = defaultProvider();
                return credentialsProvider();
            },
        }),
        node: process.env.COLLECTION_ENDPOINT,
        log: {
            level: 'trace'
        }
    });

    const index = process.env.INDEX_NAME;
    if (event.RequestType === 'Delete') {
        try {
            const indexResponse = await client.indices.exists({ index })
            logger.info('Index exists:', indexResponse.body)

            if (indexResponse.body) {
                await client.indices.delete({ index });
            }
            return await sendResponse(event, context, 'SUCCESS');
        } catch (error) {
            logger.error('Error deleting index:', error);
            return await sendResponse(event, context, 'FAILED', error.message);
        }
    }

    const AOSS_IGNORE_UPPER_LIMIT = 2 ** 31 - 1;
    const vectorIndex = {
        mappings: {
            dynamic_templates: [
                {
                    strings: {
                        match_mapping_type: 'string',
                        mapping: {
                            type: 'text',
                            fields: {
                                keyword: {
                                    type: 'keyword',
                                    ignore_above: AOSS_IGNORE_UPPER_LIMIT, // max int value
                                },
                            },
                        },
                    },
                },
            ],
            properties: {
                'ncr-kb-vector-field': {
                    type: 'knn_vector',
                    dimension: 1024,
                    method: {
                        name: 'hnsw',
                        engine: 'faiss',
                        space_type: 'l2',
                        parameters: {}
                    }
                },
                AMAZON_BEDROCK_METADATA: {
                    type: 'text',
                    index: 'false'
                },
                AMAZON_BEDROCK_TEXT_CHUNK: {
                    type: 'text',
                    index: 'true'
                }
            }
        },
        settings: {
            index: {
                knn: true
            }
        }
    };

    try {

        const indexResponse = await client.indices.exists({ index })
        logger.info('Index exists:', indexResponse.body)

        if (!indexResponse.body) {
            const createResponse = await client.indices.create({
                index: process.env.INDEX_NAME,
                body: vectorIndex
            });

            logger.info('Index created:', createResponse.body)

            // Verify the index is ready
            const isReady = await verifyIndex(client, process.env.INDEX_NAME);
            if (isReady) {
                logger.info('Index is ready for use');
            } else {
                logger.warn('Index verification failed');
            }
        }

        return await sendResponse(event, context, 'SUCCESS');
    } catch (error) {
        logger.error('Error:', error);
        return await sendResponse(event, context, 'FAILED', error.message);
    }
};

const verifyIndex = async (client, indexName, maxRetries = 10, retryDelay = 3000) => {
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            // Check if index exists
            const indexExists = await client.indices.exists({
                index: indexName
            });

            if (!indexExists.body) {
                logger.info(`Index ${indexName} does not exist yet`);
                throw new Error('Index not found');
            }

            // Get index settings and mappings
            const indexInfo = await client.indices.get({
                index: indexName
            });

            logger.info('Index information:', JSON.stringify(indexInfo.body, null, 2));

            // Try to perform a simple search to verify the index is operational
            const testSearch = await client.search({
                index: indexName,
                body: {
                    size: 0,
                    query: {
                        match_all: {}
                    }
                }
            });

            logger.info('Test search successful:', JSON.stringify(testSearch.body, null, 2));

            await new Promise(resolve => setTimeout(resolve, 30000));

            return true;
        } catch (error) {
            logger.info('Attempt %d failed: %s', retryCount + 1, error.message);

            if (retryCount === maxRetries - 1) {
                throw new Error(`Index verification failed after ${maxRetries} attempts`);
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retryCount++;
        }
    }

    return false;
};

async function sendResponse(event, context, responseStatus, reason) {
    const responseBody = {
        Status: responseStatus,
        Reason: reason || 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
        PhysicalResourceId: event.PhysicalResourceId || context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId
    };

    const responseUrl = event.ResponseURL;

    try {
        await fetch(responseUrl, {
            method: 'PUT',
            body: JSON.stringify(responseBody)
        });
    } catch (error) {
        logger.error('Error sending response:', error);
    }
}