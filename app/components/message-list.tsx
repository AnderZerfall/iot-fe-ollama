import type { RefObject } from "react";
import type { ChatMessage } from "../types";

type MessageListProps = {
  messages: ChatMessage[];
  endRef: RefObject<HTMLDivElement>;
};

export default function MessageList({ messages, endRef }: MessageListProps) {
  return (
    <main className="hide-scrollbar flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 && (
        <div className="empty">Ask a question or attach an image.</div>
      )}
      {messages.map((message, index) => (
        <div key={index} className={`msg ${message.role}`}>
          {message.preview && (
            <img src={message.preview} alt="Attached image" />
          )}
          {message.thinking && (
            <details open={message.streaming && !message.content}>
              <summary>Thinking</summary>
              <div>{message.thinking}</div>
            </details>
          )}
          <div className={`bubble${message.streaming ? " caret" : ""}`}>
            {message.content}
          </div>
          {message.notice && (
            <div className="mt-1 text-xs text-muted-foreground">
              {message.notice}
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </main>
  );
}
