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

export function request(ctx) {
    const { input } = ctx.args;

    return {
        resourcePath: `/knowledgebases/${ctx.env.NCR_KNOWLEDGE_BASE_ID}/retrieve`,
        method: "POST",
        params: {
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                retrievalQuery: {
                    text: input,
                },
            }),
        },
    };
}

export function response(ctx) {
    return JSON.stringify(ctx.result.body);
}