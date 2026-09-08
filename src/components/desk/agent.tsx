import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ArrowUp, ArrowUpRight, Minus, Paperclip } from "lucide-react";
import { SponsorCredit, type SponsorName } from "@/components/buy-hard/sponsor-credit";
import { useClock } from "@/lib/use-clock";
import type { ChatRequest, Draft } from "./model";
import { errorText } from "./model";
import type { SearchState } from "./app";
import { sourceAccept } from "@/lib/company-files";
import "./agent.css";

export const BuyerContext = createContext<((request: ChatRequest) => void) | null>(null);
export const useBuyer = () => useContext(BuyerContext);
export type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
  credit?: SponsorName;
  creditPrefix?: string;
  focus?: AgentFocus;
};
export type AgentFocus = Omit<SearchState, "demo">;
export type AgentDraft = {
  id: string;
  task: ChatRequest["task"];
  draft: Draft;
  credits?: SponsorName[];
  reviewedDraftKey?: string;
  revision?: boolean;
};
export type AgentState = {
  messages: AgentMessage[];
  latest: { text: string; createdAt?: number; focus?: AgentFocus };
  busy: boolean;
  loading?: boolean;
  error?: string;
  status: string;
  focus?: AgentFocus;
};
function elapsed(time: number | undefined, now: number) {
  if (!time) return "";
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  return minutes < 1
    ? "now"
    : minutes < 60
      ? `${minutes}m`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h`
        : `${Math.floor(minutes / 1440)}d`;
}
function Credits({ demo = false }: { demo?: boolean }) {
  return (
    <div className="desk-agent-credits">
      <span>{demo ? "Live workspace powered by" : "Powered by"}</span>
      {(["convex", "openai", "firecrawl", "agentmail"] as const).map((sponsor) => (
        <SponsorCredit key={sponsor} sponsor={sponsor} />
      ))}
    </div>
  );
}
export function AgentSurface({
  children,
  state,
  search,
  onBegin,
  onSend,
  onUpload,
  attachment,
  renderWork,
  demo = false,
}: {
  children: ReactNode;
  state: AgentState;
  search: SearchState;
  onBegin: (request: ChatRequest) => Promise<void>;
  onSend: (text: string, focus: AgentFocus) => Promise<void>;
  onUpload?: (file: File) => Promise<void>;
  attachment?: ReactNode;
  renderWork: (
    focus: AgentFocus,
    begin: (request: ChatRequest) => void,
    show: (focus: AgentFocus) => void,
    showTask: boolean,
  ) => ReactNode;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [input, setInput] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string>();
  const [focus, setFocus] = useState<AgentFocus>();
  const now = useClock();
  const inputRef = useRef<HTMLTextAreaElement>(null),
    fileRef = useRef<HTMLInputElement>(null),
    latestRef = useRef<HTMLButtonElement>(null),
    timelineRef = useRef<HTMLDivElement>(null);
  const busy = pending || state.busy;
  const selectedFocus = focus ??
    state.focus ?? { page: search.page, item: search.item, buy: search.buy };
  const measure = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const root = node.closest<HTMLElement>(".desk-with-agent")!;
    const resize = () => {
      root.style.setProperty("--agent-dock-height", `${node.getBoundingClientRect().height}px`);
      const viewport = window.visualViewport;
      const offset = viewport
        ? Math.max(0, document.documentElement.clientHeight - viewport.height - viewport.offsetTop)
        : 0;
      root.style.setProperty("--agent-keyboard-offset", `${offset}px`);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    resize();
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
    };
  }, []);
  const keyboard = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && node.querySelector(".desk-agent-panel")) {
        event.preventDefault();
        setOpen(false);
        node.querySelector<HTMLButtonElement>(".desk-agent-latest")?.focus();
      }
    };
    node.addEventListener("keydown", handle);
    return () => node.removeEventListener("keydown", handle);
  }, []);
  async function begin(request: ChatRequest) {
    setOpen(true);
    setError(undefined);
    setPending(true);
    setFocus(undefined);
    try {
      await onBegin(request);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  function show(next: AgentFocus) {
    setFocus(next);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    latestRef.current?.focus();
  }
  async function send() {
    if (!input.trim() || busy) return;
    setPending(true);
    setError(undefined);
    setOpen(true);
    setFocus(undefined);
    const sent = input;
    try {
      await onSend(sent.trim(), selectedFocus);
      setInput((current) => (current === sent ? "" : current));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <BuyerContext.Provider value={(request) => void begin(request)}>
      <div className="desk-with-agent">
        {children}
        <div className="desk-agent" ref={keyboard}>
          {open && (
            <section className="desk-agent-panel" aria-label="Your buyer conversation">
              <div className="desk-agent-top">
                <div>
                  <h2>Your buyer</h2>
                  <p>{demo ? "Demo · sample data" : "One conversation, everywhere"}</p>
                </div>
                <button type="button" onClick={close} aria-label="Minimize conversation">
                  <Minus size={20} />
                </button>
              </div>
              <div className="desk-agent-timeline" ref={timelineRef}>
                <div
                  role="log"
                  aria-label="Conversation and updates"
                  aria-live="polite"
                  aria-relevant="additions text"
                >
                  {!state.messages.length && (
                    <p className="desk-agent-message">
                      Tell me what you need. I can help with stock, buys, deliveries, and company
                      details.
                    </p>
                  )}
                  {state.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`desk-agent-entry${message.role === "user" ? " desk-agent-entry-user" : ""}`}
                    >
                      <div className="desk-agent-meta">
                        {message.role === "user" ? "You" : "Your buyer"}
                        <span>{elapsed(message.createdAt, now)}</span>
                      </div>
                      <p className="desk-agent-message">{message.text}</p>
                      {message.credit && (
                        <SponsorCredit
                          sponsor={message.credit}
                          prefix={
                            message.creditPrefix ??
                            (message.credit === "agentmail" ? "Sent via" : "Via")
                          }
                        />
                      )}
                      {message.focus && (
                        <button
                          type="button"
                          className="desk-agent-text-action"
                          onClick={() => show(message.focus!)}
                        >
                          View details <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                  {state.busy && <output className="desk-agent-working">Working on it…</output>}
                  <span
                    key={`${state.messages.at(-1)?.id ?? "empty"}:${state.busy}`}
                    ref={(node) => {
                      if (node && timelineRef.current)
                        timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
                    }}
                  />
                </div>
                {attachment}
                {(error || state.error) && (
                  <p className="desk-agent-error" role="alert">
                    {error ?? state.error}
                  </p>
                )}
                <div className="desk-agent-work">
                  {renderWork(
                    selectedFocus,
                    (request) => void begin(request),
                    show,
                    focus === undefined,
                  )}
                </div>
              </div>
              <div className="desk-agent-panel-foot">
                <div className="desk-agent-shortcuts" aria-label="Buyer shortcuts">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void begin({ task: "stock_update" })}
                  >
                    Update stock
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void begin({ task: "add_item" })}
                  >
                    Add item
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void begin({ task: "new_buy" })}
                  >
                    Start a buy
                  </button>
                  <button type="button" onClick={() => show({ page: "buys" })}>
                    Your buys
                  </button>
                  <button type="button" onClick={() => show({ page: "settings" })}>
                    Settings
                  </button>
                </div>
                <div className="desk-agent-mobile-credits">
                  <Credits demo={demo} />
                </div>
              </div>
            </section>
          )}
          <footer className="desk-agent-dock" ref={measure}>
            <div className="desk-agent-dock-main">
              <button
                ref={latestRef}
                type="button"
                className="desk-agent-latest"
                aria-expanded={open}
                aria-label={`${open ? "Minimize" : "Open"} conversation. ${state.latest.text}`}
                onClick={() => {
                  if (open) close();
                  else {
                    setOpen(true);
                    if (state.latest.focus) setFocus(state.latest.focus);
                  }
                }}
              >
                <span className="desk-agent-signal" data-working={busy} aria-hidden="true" />
                <span className="desk-agent-latest-body">
                  <span className="desk-agent-meta">
                    <strong>Your buyer</strong>
                    <span>
                      {state.loading
                        ? "Loading"
                        : busy
                          ? "Working"
                          : state.error
                            ? "Needs attention"
                            : state.status}
                    </span>
                    <span>{elapsed(state.latest.createdAt, now)}</span>
                  </span>
                  <span className="desk-agent-latest-copy">
                    <span>{state.latest.text}</span>
                    {open ? <Minus size={20} /> : <ArrowUpRight size={20} />}
                  </span>
                </span>
              </button>
              <form
                className="desk-agent-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                {onUpload && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      className="sr-only"
                      tabIndex={-1}
                      accept={sourceAccept}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file || busy) return;
                        setOpen(true);
                        setPending(true);
                        setError(undefined);
                        try {
                          await onUpload(file);
                        } catch (e) {
                          setError(errorText(e));
                        } finally {
                          setPending(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="desk-agent-attach"
                      aria-label="Attach invoice or photo"
                      disabled={busy}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip size={17} />
                    </button>
                  </>
                )}
                <textarea
                  ref={inputRef}
                  aria-label="Message your buyer"
                  rows={1}
                  value={input}
                  placeholder="Ask your buyer to do anything…"
                  maxLength={6000}
                  onFocus={() => setOpen(true)}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  className="desk-agent-send"
                  type="submit"
                  aria-label="Send message"
                  disabled={busy || !input.trim()}
                >
                  <ArrowUp size={20} />
                </button>
              </form>
            </div>
            <div className="desk-agent-dock-foot">
              <span>{demo ? "Demo · sample data" : "Keep the line moving."}</span>
              <Credits demo={demo} />
            </div>
          </footer>
        </div>
      </div>
    </BuyerContext.Provider>
  );
}
