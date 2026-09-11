import { useState, type CSSProperties } from "react";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function AgentQuestion({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>;
  const words = text.split(/(\s+)/);
  const count = words.filter((word) => word.trim()).length;
  let index = 0;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, part) =>
          word.trim() ? (
            <span
              key={part}
              className="desk-question-word"
              style={
                { animationDelay: `${index++ * Math.min(40, 900 / count)}ms` } as CSSProperties
              }
            >
              {word}
            </span>
          ) : (
            word
          ),
        )}
      </span>
    </>
  );
}

export function ChatMessages({
  messages,
  prompt,
  busy,
  stream,
}: {
  messages: Message[] | undefined;
  prompt: string;
  busy: boolean;
  stream: boolean;
}) {
  // Capture the first loaded history. Only replies arriving afterwards animate;
  // reopening setup never replays old questions. No timers or text mutations.
  const [history, setHistory] = useState<Set<string> | null>(null);
  const initialHistory = history ?? new Set(messages?.map((message) => message.id));
  if (messages !== undefined && history === null) setHistory(initialHistory);
  return (
    <div className="desk-messages" role="log" aria-label="Conversation">
      {messages?.length === 0 && (
        <p className="desk-assistant">
          <AgentQuestion text={prompt} animate={stream} />
        </p>
      )}
      {messages?.map((message) => (
        <p key={message.id} className={message.role === "user" ? "desk-user" : "desk-assistant"}>
          {message.role === "assistant" ? (
            <AgentQuestion
              text={message.text}
              animate={stream && !initialHistory.has(message.id)}
            />
          ) : (
            message.text
          )}
        </p>
      ))}
      {busy && (
        <output className="desk-working">
          Working on it
          <span className="desk-typing-dots" aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </output>
      )}
      <span ref={(node) => node?.scrollIntoView({ block: "nearest" })} />
    </div>
  );
}
