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
import { env } from "$amplify/env/createJiraIssue";
import type { Schema } from "../../resource";

export const handler: Schema["createJiraIssue"]["functionHandler"] = async (
    event
) => {
    const { description, summary } = event.arguments;
    if (!description) {
        throw new Error('Description is required');
    }

    if (!summary) {
        throw new Error('Summary is required');
    }

    const jiraApi = new JiraApi({
        protocol: 'https',
        host: env.JIRA_API_ENDPOINT, // npx ampx sandbox secret set JIRA_API_ENDPOINT --profile <profile>
        username: env.JIRA_USERNAME, // npx ampx sandbox secret set JIRA_USERNAME --profile <profile>
        password: env.JIRA_API_KEY, // npx ampx sandbox secret set JIRA_API_KEY --profile <profile>
        apiVersion: '2',
        strictSSL: true
    })

    const issue = {
        fields: {
            project: { key: 'KAN' },
            description: description,
            issuetype: { name: 'Task' },
            summary: summary
        }
    }
    const issueResponse = await jiraApi.addNewIssue(issue)
    console.log(`summary: ${JSON.stringify(issueResponse)}`);
    return {id: issueResponse['id'], key: issueResponse['key'], url: issueResponse['self']}
}
