"use client";

import "./Sidebar.css"

import * as React from "react";
import {ConversationsContext} from "@/providers/ConversationsProvider";
import {ConversationItem} from "./ConversationItem";
import {HiArchive, HiChat, HiLogout} from "react-icons/hi";
import {LogoutButton} from "@/components/Sidebar/Logout";
import {CreateChat} from "@/components/Sidebar/CreateChat";
import {Sidebar as FlowbiteSiderbar} from "flowbite-react";

export const Sidebar = () => {
    const {conversations} = React.useContext(ConversationsContext);

    return (
        <FlowbiteSiderbar aria-label="Sidebar">
            <FlowbiteSiderbar.Items className={'h-full overflow-y-hidden'}>
                <FlowbiteSiderbar.ItemGroup className={'h-4/6 overflow-y-auto overflow-x-hidden'}>
                    <FlowbiteSiderbar.Collapse icon={HiArchive} label="History">
                        {conversations.map((conversation) => (
                            <FlowbiteSiderbar.Item href="#" key={conversation.id}>
                                <ConversationItem
                                    conversation={conversation}
                                />
                            </FlowbiteSiderbar.Item>
                        ))}
                    </FlowbiteSiderbar.Collapse>
                </FlowbiteSiderbar.ItemGroup>
                <FlowbiteSiderbar.ItemGroup className={'h-36'}>
                    <FlowbiteSiderbar.Item href="#" icon={HiChat}>
                        <CreateChat/>
                    </FlowbiteSiderbar.Item>
                    <FlowbiteSiderbar.Item href="#" icon={HiLogout}>
                        <LogoutButton/>
                    </FlowbiteSiderbar.Item>
                </FlowbiteSiderbar.ItemGroup>
            </FlowbiteSiderbar.Items>
        </FlowbiteSiderbar>
    );
};
