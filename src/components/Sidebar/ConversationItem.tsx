"use client";

import "./ConversationItem.css"
import * as React from "react";
import {
  Button,
  Flex,
  TextField,
  View,
} from "@aws-amplify/ui-react";
import {
  LuTrash2
} from "react-icons/lu";

import { ConversationsContext } from "@/providers/ConversationsProvider";
import { Conversation } from "@/client";
import {useRouter} from "next/navigation";

interface FormElements extends HTMLFormControlsCollection {
  conversationName: HTMLInputElement;
}
interface ConversationFormElement extends HTMLFormElement {
  readonly elements: FormElements;
}

export const ConversationItem = ({
  conversation,
}: {
  conversation: Conversation;
}) => {
  const { deleteConversation, updateConversation } =
    React.useContext(ConversationsContext);
  const [editing, setEditing] = React.useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<ConversationFormElement>) => {
    e.preventDefault();
    updateConversation({
      ...conversation,
      name: e.currentTarget.elements.conversationName.value,
    });
    setEditing(false);
  };

  const handleClick = () => {
    router.push(`/chat/${conversation.id}`);
  };

  return (
    <Flex direction="row" key={conversation.id} alignItems="center">
      <Flex direction="column" flex="1">
        {editing ? (
          <View as="form" onSubmit={handleSubmit}>
            <TextField
              label="Conversation name"
              name="conversationName"
              labelHidden
              defaultValue={conversation.name}
              variation="quiet"
            />
          </View>
        ) : (
          <Button size="small" className={'truncated-link text-xs amplify-button--link'} onClick={handleClick}>
            {conversation.name ?? conversation.id}
          </Button>
        )}
      </Flex>
      <Button size="small" className={'text-xs'} title="Delete" onClick={() => deleteConversation({ id: conversation.id })}>
        <LuTrash2 />
      </Button>
    </Flex>
  );
};
