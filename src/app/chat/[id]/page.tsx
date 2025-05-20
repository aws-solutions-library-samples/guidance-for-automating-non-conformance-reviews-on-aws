"use client"

import {Chat} from "./Chat";
import LoadingBar from "react-top-loading-bar";
import React, {useEffect, useRef, useState} from "react";

interface ChatPageProps {
    params: Promise<{ id: string }>;
}

export default function ChatPage({params}: ChatPageProps) {
    const ref = useRef(null)
    const [chat, setChat] = useState('')

    useEffect(() => {
        // @ts-expect-error - ref.current is not typed
        ref.current.continuousStart();
        const loadingChat = async () => {
            const {id} = await params;
            setChat(id);
            // @ts-expect-error - ref.current is not typed
            ref.current.complete();
        }
        loadingChat()
    }, [params]);

    return (
        <>
            <LoadingBar color="#60A5FA" ref={ref} shadow={true} />
            {chat && (<Chat id={chat}/>)}
        </>
    );
}
