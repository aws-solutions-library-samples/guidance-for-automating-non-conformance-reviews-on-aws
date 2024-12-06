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

import {defineBackend} from '@aws-amplify/backend';
import {auth} from './auth/resource';
import {conversationHandler, createJiraIssue, data, searchJira} from './data/resource';
import {PolicyStatement} from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cdk from 'aws-cdk-lib';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const vpcId = process.env.AWS_VPC_ID?.trim();
if (!vpcId) {
    throw new Error('AWS_VPC_ID environment variable is not set');
}

const availabilityZones = process.env.AVAILABILITY_ZONES?.trim().split(',');
if (!availabilityZones) {
    throw new Error('AVAILABILITY_ZONES environment variable is not set');
}

const vpcCidrBlock = process.env.VPC_CIDR_BLOCK?.trim();
if (!vpcCidrBlock) {
    throw new Error('VPC_CIDR_BLOCK environment variable is not set');
}

const publicSubnetIds = process.env.PUBLIC_SUBNET_IDS?.trim().split(',');
if (!publicSubnetIds) {
    throw new Error('PUBLIC_SUBNET_IDS environment variable is not set');
}

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
    auth,
    data,
    createJiraIssue,
    searchJira,
    conversationHandler
});

const branchName = process.env.AWS_BRANCH || 'sandbox';
const accountId = cdk.Stack.of(backend.data).account
const region = cdk.Stack.of(backend.data).region
const indexName = `ncr-kb-vector-index-${branchName}`
const ncrBedrockKnowledgeBaseName = `ncr-knowledge-base-${branchName}`

/*backend.conversationHandler.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        resources: [
            `arn:aws:bedrock:us-east-1::foundation-model/${model}`,
            `arn:aws:bedrock:us-east-2::foundation-model/${model}`,
            `arn:aws:bedrock:us-west-2::foundation-model/${model}`,
            `arn:aws:bedrock:us-east-1:${accountId}:inference-profile/${crossRegionModel}`
        ],
        actions: [
            'bedrock:InvokeModelWithResponseStream'
        ]
    })
);*/

// Create S3 bucket
const bucket = new cdk.aws_s3.Bucket(backend.data, 'ncr-knowledge-base-bucket', {
    bucketName: `ncr-knowledge-base-bucket-${branchName}`,
    removalPolicy: cdk.RemovalPolicy.DESTROY, // For development - change for production
    autoDeleteObjects: true, // For development - change for production
    encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true
});

// Get the default VPC
const defaultVpc = cdk.aws_ec2.Vpc.fromVpcAttributes(backend.data, 'DefaultVPC', {
    vpcId,
    availabilityZones,
    vpcCidrBlock,
    publicSubnetIds
});

// Create security group for the endpoint
const endpointSecurityGroup = new cdk.aws_ec2.SecurityGroup(backend.data, 'OpenSearchEndpointSG', {
    vpc: defaultVpc,
    description: 'Security Group for OpenSearch Serverless VPC Endpoint',
    allowAllOutbound: true
});

endpointSecurityGroup.addIngressRule(
    cdk.aws_ec2.Peer.ipv4(defaultVpc.vpcCidrBlock),
    cdk.aws_ec2.Port.tcp(443),
    'Allow HTTPS from VPC'
);

// Create OpenSearch Serverless VPC Endpoint
const openSearchEndpoint = new cdk.aws_opensearchserverless.CfnVpcEndpoint(backend.data, 'OpenSearchVPCEndpoint', {
    name: `opensearch-endpoint-${branchName}`,
    vpcId: defaultVpc.vpcId,
    subnetIds: defaultVpc.publicSubnets.map(subnet => subnet.subnetId),
    securityGroupIds: [endpointSecurityGroup.securityGroupId]
});

const stsEndpoint = defaultVpc.addInterfaceEndpoint('STSEndpoint', {
    service: cdk.aws_ec2.InterfaceVpcEndpointAwsService.STS,
    securityGroups: [endpointSecurityGroup]
});

// Create OpenSearch Serverless Collection
const osCollection = new cdk.aws_opensearchserverless.CfnCollection(backend.data, 'NCRKBCollection', {
    name: `ncr-kb-collection-${branchName}`,
    description: 'Collection for NCR Knowledge Base',
    type: 'VECTORSEARCH',
});

// Create encryption policy for OpenSearch Serverless
const encryptionPolicy = new cdk.aws_opensearchserverless.CfnSecurityPolicy(backend.data, 'NCRKBEncryptionPolicy', {
    name: `ncr-kb-encryption-policy-${branchName}`,
    type: 'encryption',
    description: 'Encryption policy for NCR Knowledge Base collection',
    policy: JSON.stringify({
        Rules: [
            {
                ResourceType: 'collection',
                Resource: [`collection/${osCollection.name}`]
            }
        ],
        AWSOwnedKey: true
    })
});

// Create network policy for OpenSearch Serverless
const networkPolicy = new cdk.aws_opensearchserverless.CfnSecurityPolicy(backend.data, 'NCRKBNetworkPolicy', {
    name: `ncr-kb-network-policy-${branchName}`,
    type: 'network',
    description: 'Network policy for NCR Knowledge Base collection',
    policy: JSON.stringify([
        {
            Description: 'Allow Bedrock access to OpenSearch collection',
            Rules: [
                {
                    ResourceType: 'dashboard',
                    Resource: [`collection/${osCollection.name}`]
                },
                {
                    ResourceType: 'collection',
                    Resource: [`collection/${osCollection.name}`]
                }
            ],
            AllowFromPublic: false,
            SourceVPCEs: [openSearchEndpoint.attrId, stsEndpoint.vpcEndpointId],
            SourceServices: ['bedrock.amazonaws.com']
        }
    ])
});

// Create Lambda function to create vector index
const createIndexFunction = new NodejsFunction(backend.data, 'CreateIndexFunction', {
    runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
    handler: 'handler',
    entry: path.join(__dirname, 'custom_resources/create_index/index.js'),
    bundling: {
        externalModules: [
            '@aws-sdk/*' // Use the AWS SDK for JS v3 available in the Lambda runtime
        ],
        commandHooks: {
            beforeBundling: (inputDir: string, outputDir: string) => [
                `cd ${inputDir}/amplify/custom_resources/create_index`,
                'npm install'
            ],
            beforeInstall(inputDir: string, outputDir: string): string[] {
                return [];
            },
            afterBundling(inputDir: string, outputDir: string): string[] {
                return [];
            },

        }
    },
    vpc: defaultVpc,
    vpcSubnets: {
        subnetType: cdk.aws_ec2.SubnetType.PUBLIC
    },
    allowPublicSubnet: true,
    securityGroups: [endpointSecurityGroup],
    environment: {
        COLLECTION_ENDPOINT: osCollection.attrCollectionEndpoint,
        INDEX_NAME: indexName,
        REGION: region
    },
    timeout: cdk.Duration.minutes(5)
});

// Add permissions to Lambda
createIndexFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
    effect: cdk.aws_iam.Effect.ALLOW,
    actions: [
        'aoss:*'
    ],
    resources: ['*']
}));

// Create data access policy
const dataAccessPolicy = new cdk.aws_opensearchserverless.CfnAccessPolicy(backend.data, 'NCRKBDataAccessPolicy', {
    name: `ncr-kb-access-policy-${branchName}`,
    type: 'data',
    description: 'Data access policy for NCR Knowledge Base collection',
    policy: JSON.stringify([
        {
            Description: 'Allow Bedrock access to collection data',
            Rules: [
                {
                    ResourceType: 'collection',
                    Resource: [`collection/${osCollection.name}`],
                    Permission: [
                        "aoss:*"
                    ]
                }, {
                    ResourceType: 'index',
                    Resource: [`index/${osCollection.name}/*`],
                    Permission: [
                        "aoss:*"
                    ]
                }
            ],
            Principal: [
                `arn:aws:iam::${accountId}:role/ncr-kb-role-${branchName}`,
                createIndexFunction.role?.roleArn
            ]
        }
    ])
});

// Create Custom Resource using the Lambda function
const createVectorIndex = new cdk.CustomResource(backend.data, 'CreateVectorIndex', {
    serviceToken: new cdk.custom_resources.Provider(backend.data, 'CreateVectorIndexProvider', {
        onEventHandler: createIndexFunction
    }).serviceToken
});

// Add dependency
osCollection.node.addDependency(encryptionPolicy);
osCollection.node.addDependency(networkPolicy);
osCollection.node.addDependency(dataAccessPolicy);

createVectorIndex.node.addDependency(osCollection);

const knowledgeBaseRole = new cdk.aws_iam.Role(backend.data, 'NCRKnowledgeBaseRole', {
    roleName: `ncr-kb-role-${branchName}`,
    assumedBy: new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com'),
    inlinePolicies: {
        'BedrockInvokeAccess': new cdk.aws_iam.PolicyDocument({
            statements: [
                new cdk.aws_iam.PolicyStatement({
                    sid: 'BedrockInvokeModelStatement',
                    effect: cdk.aws_iam.Effect.ALLOW,
                    actions: [
                        'bedrock:InvokeModel'
                    ],
                    resources: [
                        `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`
                    ]
                })
            ]
        }),
        'OpenSearchServerlessAccess': new cdk.aws_iam.PolicyDocument({
            statements: [
                new cdk.aws_iam.PolicyStatement({
                    sid: 'OpenSearchServerlessAPIAccessAllStatement',
                    effect: cdk.aws_iam.Effect.ALLOW,
                    actions: [
                        'aoss:APIAccessAll'
                    ],
                    resources: [
                        osCollection.attrArn,
                        `${osCollection.attrArn}/*`
                    ]
                })
            ]
        }),
        'S3Access': new cdk.aws_iam.PolicyDocument({
            statements: [
                new cdk.aws_iam.PolicyStatement({
                    sid: 'S3ListBucketStatement',
                    effect: cdk.aws_iam.Effect.ALLOW,
                    actions: [
                        's3:ListBucket'
                    ],
                    resources: [
                        bucket.bucketArn
                    ],
                    conditions: {
                        StringEquals: {
                            'aws:ResourceAccount': accountId
                        }
                    }
                }),
                new cdk.aws_iam.PolicyStatement({
                    sid: 'S3GetObjectStatement',
                    effect: cdk.aws_iam.Effect.ALLOW,
                    actions: [
                        's3:GetObject'
                    ],
                    resources: [
                        `${bucket.bucketArn}/*`
                    ],
                    conditions: {
                        StringEquals: {
                            'aws:ResourceAccount': accountId
                        }
                    }
                })
            ]
        }),
        'SecretsManagerAccess': new cdk.aws_iam.PolicyDocument({
            statements: [
                new cdk.aws_iam.PolicyStatement({
                    effect: cdk.aws_iam.Effect.ALLOW,
                    actions: [
                        'secretsmanager:GetSecretValue',
                        'secretsmanager:DescribeSecret'
                    ],
                    resources: ['*']
                })
            ]
        })
    }
});

// Add trust policy
knowledgeBaseRole.assumeRolePolicy?.addStatements(
    new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        principals: [new cdk.aws_iam.ServicePrincipal('bedrock.amazonaws.com')],
        actions: ['sts:AssumeRole'],
        conditions: {
            StringEquals: {
                'aws:SourceAccount': accountId
            },
            ArnLike: {
                'aws:SourceArn': `arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`
            }
        }
    })
);

// Create the knowledge base
const knowledgeBase = new cdk.aws_bedrock.CfnKnowledgeBase(backend.data, 'NCRKnowledgeBase', {
    name: ncrBedrockKnowledgeBaseName,
    description: 'Knowledge base for NCR chatbot',
    knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v2:0`
        }
    },
    storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
            collectionArn: osCollection.attrArn,
            vectorIndexName: indexName,
            fieldMapping: {
                metadataField: 'AMAZON_BEDROCK_METADATA',
                textField: 'AMAZON_BEDROCK_TEXT_CHUNK',
                vectorField: 'ncr-kb-vector-field'
            }
        }
    },
    roleArn: knowledgeBaseRole.roleArn
});

knowledgeBase.node.addDependency(createVectorIndex);
knowledgeBase.addDependency(createVectorIndex.node.defaultChild as cdk.CfnResource);

// Use the knowledge base ID in your existing data source configuration
const knowledgeBaseId = knowledgeBase.attrKnowledgeBaseId;
backend.data.resources.cfnResources.cfnGraphqlApi.addOverride('Properties.EnvironmentVariables', {
    NCR_KNOWLEDGE_BASE_ID: knowledgeBaseId
})

// Add the data source
const dataSource = new cdk.aws_bedrock.CfnDataSource(backend.data, 'NCRDataSource', {
    knowledgeBaseId: knowledgeBaseId,
    name: 'ncr-data-source',
    description: 'Data source for NCR knowledge base',
    dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
            bucketArn: bucket.bucketArn
        }
    }
});

// Add dependency to ensure proper creation order
dataSource.node.addDependency(bucket);
dataSource.node.addDependency(knowledgeBase);

const KnowledgeBaseDataSource =
    backend.data.resources.graphqlApi.addHttpDataSource(
        "KnowledgeBaseDataSource",
        `https://bedrock-agent-runtime.${region}.amazonaws.com`,
        {
            authorizationConfig: {
                signingRegion: region,
                signingServiceName: "bedrock",
            }
        },
    );


KnowledgeBaseDataSource.grantPrincipal.addToPrincipalPolicy(
    new PolicyStatement({
        resources: [
            `arn:aws:bedrock:${region}:${accountId}:knowledge-base/${knowledgeBaseId}`
        ],
        actions: ["bedrock:Retrieve"]
    }),
);

backend.data.resources.cfnResources.cfnGraphqlApi.environmentVariables = {
    NCR_KNOWLEDGE_BASE_ID: knowledgeBaseId
}

// Only adding this Stack for compliance reasons
const solutionStack = backend.createStack('SolutionStack');
solutionStack.templateOptions.description = 'Guidance for Aerospace Technicians Assistant (SO9086)';
