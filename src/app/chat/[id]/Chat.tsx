"use client";

import "./chat.css"

import * as React from "react";
import {AIConversation} from "@aws-amplify/ui-react-ai";
import {View, Avatar, Link} from "@aws-amplify/ui-react";
import {useAIConversation} from "@/client";
import ReactMarkdown from "react-markdown";

interface ChatProps {
    id: string;
}

export const Chat = ({id}: ChatProps) => {
    const [
        {
            data: {messages},
            isLoading,
        },
        sendMessage,
    ] = useAIConversation("chat", {id});

    return (
        <View padding="large" flex="1" className={'loading-splash'}>
            <div className="stars"></div>
            <AIConversation
                allowAttachments
                avatars={{
                    user: {
                        avatar:
                        <Avatar>
                            <svg className="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                 xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                                 viewBox="0 0 24 24">
                                <path stroke="currentColor" strokeWidth="2"
                                      d="M7 17v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3Zm8-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
                            </svg>
                        </Avatar>,
                        username: "User",
                    },
                    ai: {
                        avatar:
                            <Avatar>
                                <svg className="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true"
                                     xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none"
                                     viewBox="0 0 24 24">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="m10.051 8.102-3.778.322-1.994 1.994a.94.94 0 0 0 .533 1.6l2.698.316m8.39 1.617-.322 3.78-1.994 1.994a.94.94 0 0 1-1.595-.533l-.4-2.652m8.166-11.174a1.366 1.366 0 0 0-1.12-1.12c-1.616-.279-4.906-.623-6.38.853-1.671 1.672-5.211 8.015-6.31 10.023a.932.932 0 0 0 .162 1.111l.828.835.833.832a.932.932 0 0 0 1.111.163c2.008-1.102 8.35-4.642 10.021-6.312 1.475-1.478 1.133-4.77.855-6.385Zm-2.961 3.722a1.88 1.88 0 1 1-3.76 0 1.88 1.88 0 0 1 3.76 0Z"/>
                                </svg>
                            </Avatar>,
                        username: "NCR assistant"
                    }
                }}
                messages={messages}
                handleSendMessage={(message) => {
                    sendMessage(message);
                }}
                isLoading={isLoading}
                messageRenderer={{
                    text: ({text}) => <ReactMarkdown>{text}</ReactMarkdown>,
                }}
                responseComponents={{
                    JiraIssueCard: {
                        description: "Used to display and share Jira issues and its values to the user. " +
                            "For example, if you've just created a Jira issue, you would use this card.",
                        component: ({issueKey, url, summary}) => {
                            return (
                                <div className="jira-issue-card">
                                    <h3>{issueKey}</h3>
                                    {summary && (<p>{summary}</p>)}
                                    <Link href={url} target="_blank">View in Jira</Link>
                                </div>
                            )
                        },
                        props: {
                            issueKey: {
                                type: "string",
                                required: true,
                                description: "The key of the Jira issue to display"
                            },
                            url: {
                                type: "string",
                                required: true,
                                description: "The url of the Jira issue to display"
                            },
                            summary: {
                                type: "string",
                                description: "The summary of the Jira issue to display"
                            }
                        }
                    }
                }}
                FallbackResponseComponent={(props) => {
                    return (
                        <div className="fallback-response">
                            <p>{JSON.stringify(props)}</p>
                        </div>
                    );
                }}
            />
        </View>
    );
};
