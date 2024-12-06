"use client";

import * as React from "react";
import {ConversationsContext} from "@/providers/ConversationsProvider";
import {Button, Flex} from "@aws-amplify/ui-react";
import {useRouter} from "next/navigation";
import {Share_Tech_Mono} from 'next/font/google';
import {useEffect, useRef, useTransition} from "react";
import LoadingBar from "react-top-loading-bar";

const shareTechMono = Share_Tech_Mono({
    weight: ['400'],
    subsets: ['latin'],
    display: 'swap',
});

export default function Home() {
    const {createConversation} = React.useContext(ConversationsContext);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const ref = useRef(null)

    useEffect(() => {
        if (isPending) {
            // @ts-expect-error - ref.current is not typed
            ref.current.continuousStart();
        } else {
            // @ts-expect-error - ref.current is not typed
            ref.current.complete();
        }
    }, [isPending]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const prompt = data.get("message") as string;
        console.log(prompt);

        createConversation()
            .then((conversation) => {
                if (!conversation) return;
                startTransition(() => {
                    router.push(`/chat/${conversation.id}`);
                    conversation?.sendMessage({content: [{text: prompt}]});
                })
            });
    };

    return (
        <div className={shareTechMono.className + ' h-full w-full'}>
            <LoadingBar color="#60A5FA" ref={ref} shadow={true} />
            <div className="loading-splash">
                <div className="stars"></div>
                <div className="space-animation">
                    <svg viewBox="0 0 24 24" width="80" height="120" fill="none" stroke="currentColor">
                        {/* Satellite */}
                        <circle cx="12" cy="4" r="1.5" className="satellite" fill="#60A5FA"/>
                        {/* Planet */}
                        <circle cx="12" cy="12" r="5" className="planet" fill="#4B5563"/>
                        {/* Orbit path */}
                        <circle cx="12" cy="12" r="8" className="orbit" strokeDasharray="50"/>
                    </svg>
                </div>
                <p className="loading-text">Preparing for launch...</p>
                <Flex as="form" onSubmit={handleSubmit}>
                    <div className="chat-input-container">
                        <textarea name="message" className="chat-input" autoFocus />
                        <Button type="submit" className="send-button" aria-label="Send message">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </Button>
                    </div>
                </Flex>
            </div>
        </div>
    );
}
