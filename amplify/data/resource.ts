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

import {a, defineData, type ClientSchema, defineFunction, secret} from '@aws-amplify/backend';
import {ASSISTANT_PROMPT, JIRA_SEARCH_TOOL_PROMPT} from "./prompt";
import {defineConversationHandlerFunction} from "@aws-amplify/backend-ai/conversation";

const jiraApiEndpoint = secret('JIRA_API_ENDPOINT')
const jiraApiKey = secret('JIRA_API_KEY')
const jiraUsername = secret('JIRA_USERNAME')

export const model = 'amazon.nova-lite-v1:0';
//export const model = 'anthropic.claude-3-7-sonnet-20250219-v1:0';
export const crossRegionModel = `us.${model}`;

export const conversationHandler = defineConversationHandlerFunction({
    entry: "./conversationHandler.ts",
    name: "conversationHandler",
    models: [{ modelId: crossRegionModel }],
    logging: {
        retention: '1 week',
        level: "debug"
    }
});

export const createJiraIssue = defineFunction({
    name: 'createJiraIssue',
    entry: './tools/jira/createJiraIssue.ts',
    environment: {
        JIRA_API_ENDPOINT: jiraApiEndpoint,
        JIRA_API_KEY: jiraApiKey,
        JIRA_USERNAME: jiraUsername,
    },
});

export const searchJira = defineFunction({
    name: 'searchJira',
    entry: './tools/jira/searchJira.ts',
    environment: {
        JIRA_API_ENDPOINT: jiraApiEndpoint,
        JIRA_API_KEY: jiraApiKey,
        JIRA_USERNAME: jiraUsername,
    },
});

const schema = a.schema({
    knowledgeBase: a
        .query()
        .arguments({input: a.string()})
        .handler(
            a.handler.custom({
                dataSource: "KnowledgeBaseDataSource",
                entry: "./resolvers/kbResolver.js",
            }),
        )
        .returns(a.string())
        .authorization((allow) => allow.authenticated()),

    createJiraIssue: a.query()
        .arguments({
            description: a.string().required(),
            summary: a.string().required()
        })
        .returns(a.customType({
            id: a.string(),
            key: a.string(),
            url: a.string()
        }))
        .handler(a.handler.function(createJiraIssue))
        .authorization((allow) => allow.authenticated()),

    searchJira: a.query()
        .arguments({
            query: a.string().required(),
            maxResults: a.integer()
        })
        .returns(a.string())
        .handler(a.handler.function(searchJira))
        .authorization((allow) => allow.authenticated()),

    // This will add a new conversation route to your Amplify Data backend.
    chat: a.conversation({
        aiModel: {
            resourcePath: model
            //resourcePath: crossRegionModel
        },
        //handler: conversationHandler,
        systemPrompt: ASSISTANT_PROMPT,
        tools: [
            a.ai.dataTool({
                name: 'searchDocumentation',
                description: 'Performs a search over Aerospace documents and users guide',
                query: a.ref('knowledgeBase'),
            }),
            a.ai.dataTool({
                name: 'createJiraIssue',
                description: 'Creates a Jira issue',
                query: a.ref('createJiraIssue'),
            }),
            a.ai.dataTool({
                name: 'searchJira',
                description: JIRA_SEARCH_TOOL_PROMPT,
                query: a.ref('searchJira'),
            })
        ],
        inferenceConfiguration: {
            topP: 0.999,
            temperature: 1,
            maxTokens: 4096
        }
    })
        .authorization((allow) => allow.owner())
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
    schema: schema,
    authorizationModes: {
        defaultAuthorizationMode: 'userPool'
    }
});