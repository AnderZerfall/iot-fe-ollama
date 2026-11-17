"use client";

import ChatComposer from "./components/chat-composer";
import ChatHeader from "./components/chat-header";
import MessageList from "./components/message-list";
import { useOllamaChat } from "./hooks/use-ollama-chat";

export default function Page() {
  const chat = useOllamaChat();

  return (
    <div className="app">
      <ChatHeader
        host={chat.host}
        setHost={chat.setHost}
        models={chat.models}
        model={chat.model}
        setModel={chat.setModel}
        status={chat.status}
        think={chat.think}
        setThink={chat.setThink}
        onRefresh={() => chat.loadModels(chat.host)}
        onClear={chat.clearMessages}
        canClear={!chat.busy && chat.messages.length > 0}
      />
      <MessageList messages={chat.messages} endRef={chat.endRef} />
      <ChatComposer
        input={chat.input}
        setInput={chat.setInput}
        image={chat.image}
        setImage={chat.setImage}
        busy={chat.busy}
        canSend={Boolean(chat.model) && Boolean(chat.input.trim() || chat.image)}
        onPickImage={chat.pickImage}
        onSend={chat.send}
        onStop={chat.stop}
      />
    </div>
  );
}
