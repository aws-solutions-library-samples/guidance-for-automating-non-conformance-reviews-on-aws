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

import JiraApi from 'jira-client';
import { env } from "$amplify/env/searchJira";
import type { Schema } from "../../resource";

/*const env = {
    JIRA_API_ENDPOINT: process.env.JIRA_API_ENDPOINT,
    JIRA_API_KEY: process.env.JIRA_API_KEY,
    JIRA_USERNAME: process.env.JIRA_USERNAME,
}*/

export const handler: Schema["searchJira"]["functionHandler"] = async (
    event
) => {
    const { query } = event.arguments;
    if (!query) {
        throw new Error('query is required');
    }

    const options: any = {
        fields: ['issuetype', 'project', 'created', 'updated', 'status', 'description', 'summary']
    }

    const { maxResults } = event.arguments;
    if (!maxResults) {
        options['maxResults'] = maxResults;
    }

    const jiraApi = new JiraApi({
        protocol: 'https',
        host: env.JIRA_API_ENDPOINT, // npx ampx sandbox secret set JIRA_API_ENDPOINT --profile <profile>
        username: env.JIRA_USERNAME, // npx ampx sandbox secret set JIRA_USERNAME --profile <profile>
        password: env.JIRA_API_KEY, // npx ampx sandbox secret set JIRA_API_KEY --profile <profile>
        apiVersion: '3',
        strictSSL: true
    })

    const issueResponse = await jiraApi.searchJira(query, options);
    const response = JSON.stringify(issueResponse)
    console.log(`response: ${response}`);
    return response
}

/*handler({
    arguments: {query: 'text ~ "M915"', fields: ['priority'], maxResults: 1},
    source: null,
    request: {
        headers: {},
        domainName: null
    },
    info: {
        selectionSetList: [],
        selectionSetGraphQL: '',
        parentTypeName: '',
        fieldName: '',
        variables: {}
    },
    prev: null,
    stash: {}
}, {
    callbackWaitsForEmptyEventLoop: false,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    awsRequestId: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: function (): number {
        throw new Error('Function not implemented.');
    },
    done: function (error?: Error, result?: any): void {
        throw new Error('Function not implemented.');
    },
    fail: function (error: Error | string): void {
        throw new Error('Function not implemented.');
    },
    succeed: function (messageOrObject: any): void {
        throw new Error('Function not implemented.');
    }
}, {})*/
