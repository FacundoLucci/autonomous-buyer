import { useState, useRef, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUp, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthActions } from "@/lib/buyer-auth";
import { fileMime, sourceAccept } from "@/lib/company-files";
import { CloseButton } from "./primitives";
import { draftReady, errorText, money, type ChatRequest, type Draft } from "./model";
import { buyingPriorities } from "@/lib/inventory-planning";
import { Fact, Sentence, units } from "./sentences";
import { dateLabel } from "./model";
const prompts = {
  stock_update: "What changed? For example, ‘We only have two cases of lids left.’",
  onboarding: "What’s your company’s website? A name works too.",
  add_item: "Send a name, link, or invoice. Whatever you have.",
  edit_item: "What changed?",
  new_buy: "What do you need to buy?",
  buy: "Tell me what you need. I’ll look into the options.",
  settings: "What would you like to change?",
  receive: "How many arrived?",
  confirm: "Send the supplier’s confirmation and expected arrival date.",
};
const titles = {
  stock_update: "Update stock",
  onboarding: "Your company",
  add_item: "Add item",
  edit_item: "Update item",
  new_buy: "Start a buy",
  buy: "Your buyer",
  settings: "Company details",
  receive: "Record delivery",
  confirm: "Confirm order",
};
const saveLabels = {
  stock_update: "Updated",
  onboarding: "Open my workspace",
  add_item: "Add item",
  edit_item: "Save changes",
  new_buy: "Start buy",
  buy: "Review purchase",
  settings: "Save changes",
  receive: "Record delivery",
  confirm: "Confirm order",
};
export function DraftPreview({ draft, task }: { draft: Draft; task: ChatRequest["task"] }) {
  const d = draft;
  const total =
    d.quantity !== undefined &&
    d.unitPriceCents !== undefined &&
    d.freightCents !== undefined &&
    d.taxCents !== undefined
      ? d.quantity * d.unitPriceCents + d.freightCents + d.taxCents
      : null;
  return (
    <div className="desk-draft-sentences">
      {(task === "settings" || task === "onboarding") && (
        <Sentence>
          {d.companyName && (
            <>
              You’re buying for <Fact>{d.companyName}</Fact>.{" "}
            </>
          )}
          {d.shippingAddress && (
            <>
              Deliveries go to <Fact>{d.shippingAddress}</Fact>.
            </>
          )}
        </Sentence>
      )}
      {task === "buy" || task === "new_buy" ? (
        <>
          <Sentence>
            {d.quantity !== undefined ? (
              <>
                <Fact>{units(d.quantity, d.unit ?? "units")}</Fact> of{" "}
              </>
            ) : (
              "You need "
            )}
            <Fact>{d.name ?? "this item"}</Fact>
            {d.supplier && (
              <>
                {" "}
                from <Fact>{d.supplier}</Fact>
              </>
            )}
            {d.expectedOn ? (
              <>
                , expected by <Fact>{dateLabel(d.expectedOn)}</Fact>
              </>
            ) : d.requiredBy ? (
              <>
                , needed by <Fact>{dateLabel(d.requiredBy)}</Fact>
              </>
            ) : null}
            .
            {total !== null && (
              <>
                {" "}
                The total is <Fact>{money(total, d.currency)}</Fact>, including shipping and tax.
              </>
            )}
          </Sentence>
        </>
      ) : task === "receive" ? (
        d.quantity !== undefined && (
          <Sentence>
            <Fact>{units(d.quantity, d.unit ?? "units")}</Fact> arrived.
          </Sentence>
        )
      ) : task === "confirm" ? (
        <Sentence>
          {d.confirmation && (
            <>
              The supplier confirmed order <Fact>{d.confirmation}</Fact>.{" "}
            </>
          )}
          {d.expectedOn && (
            <>
              It’s expected by <Fact>{dateLabel(d.expectedOn)}</Fact>.
            </>
          )}
        </Sentence>
      ) : (
        <>
          {d.name && (
            <Sentence>
              {task === "add_item" ? "You’ll track " : "You’re updating "}
              <Fact>{d.name}</Fact>.
            </Sentence>
          )}
          {d.stock !== undefined && (
            <Sentence>
              You have <Fact>{units(d.stock, d.unit ?? "units")}</Fact> on hand.
            </Sentence>
          )}
          {d.dailyUsage !== undefined && (
            <Sentence>
              You use <Fact>{units(d.dailyUsage, d.unit ?? "units")}</Fact> a day.
            </Sentence>
          )}
          {d.supplier && (
            <Sentence>
              You buy from <Fact>{d.supplier}</Fact>
              {d.leadTimeDays !== undefined && (
                <>
                  , with delivery in about <Fact>{d.leadTimeDays} days</Fact>
                </>
              )}
              .
            </Sentence>
          )}
          {d.buyingPriority && (
            <Sentence>
              When buying, <Fact>{buyingPriorities[d.buyingPriority].toLowerCase()}</Fact>.
            </Sentence>
          )}
          {d.dailyLossCents !== undefined && (
            <Sentence>
              A day without this costs about <Fact>{money(d.dailyLossCents, d.lossCurrency)}</Fact>.
            </Sentence>
          )}
          {d.stockoutImpact && <Sentence>{d.stockoutImpact}</Sentence>}
        </>
      )}
    </div>
  );
}

export function TaskChat({
  request,
  onClose,
  onSaved,
}: {
  request: ChatRequest;
  onClose?: () => void;
  onSaved: (id: string) => void;
}) {
  const conversation = useQuery(api.desk.conversation, {
    task: request.task,
    contextId: request.contextId,
  });
  const send = useMutation(api.desk.send),
    commit = useMutation(api.desk.commit);
  const { token } = useAuthActions();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<Id<"inventorySources"> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = pending || !!conversation?.busy;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy) return;
    setPending(true);
    setError(null);
    try {
      await send({
        task: request.task,
        contextId: request.contextId,
        text: input.trim(),
        revision: request.revision,
      });
      setInput("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  async function upload(file: File) {
    setPending(true);
    setError(null);
    try {
      const mime = fileMime(file.name);
      if (!mime || file.size > 8 * 1024 * 1024)
        throw new Error("Choose a supported file under 8 MB.");
      const site =
        import.meta.env.VITE_CONVEX_SITE_URL ||
        import.meta.env.VITE_CONVEX_URL.replace(".cloud", ".site");
      const response = await fetch(`${site}/api/inventory/invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": mime,
          "X-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok || !result.sourceId) throw new Error("The upload failed.");
      setSourceId(result.sourceId);
    } catch {
      setError("Choose a PDF, photo, or document under 8 MB and try again.");
    } finally {
      setPending(false);
    }
  }
  async function save() {
    if (!conversation) return;
    setPending(true);
    setError(null);
    try {
      const id = await commit({
        chatId: conversation._id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      onSaved(id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  const draft = conversation?.draft;
  return (
    <section className="desk-chat" aria-label={titles[request.task]}>
      <div className="desk-chat-top">
        <h2 className="sr-only">{titles[request.task]}</h2>
        {onClose && <CloseButton onClick={onClose} />}
      </div>
      <div className="desk-chat-layout">
        <div className="desk-chat-conversation">
          <div className="desk-messages" role="log" aria-label="Conversation">
            {!conversation?.messages.length && (
              <p className="desk-assistant">{request.prompt ?? prompts[request.task]}</p>
            )}
            {conversation?.messages.map((m) => (
              <p key={m.id} className={m.role === "user" ? "desk-user" : "desk-assistant"}>
                {m.text}
              </p>
            ))}
            {conversation?.busy && <output className="desk-working">Working on it…</output>}
            <span ref={(node) => node?.scrollIntoView({ block: "nearest" })} />
          </div>
          {sourceId && (
            <SourceResult
              sourceId={sourceId}
              onUse={(text) => {
                setInput(text);
                setSourceId(null);
              }}
            />
          )}
          <form className="desk-composer" onSubmit={submit}>
            <Textarea
              aria-label="Message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={request.revision ? "No, because…" : "Tell me what you know…"}
              rows={2}
              maxLength={6000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="desk-composer-actions">
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept={sourceAccept}
                aria-label="Attach a file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              {request.task !== "stock_update" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Attach invoice or photo"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip size={18} />
                </Button>
              )}
              <Button
                type="submit"
                size="icon"
                aria-label="Send message"
                disabled={busy || !input.trim()}
              >
                <ArrowUp size={19} />
              </Button>
            </div>
          </form>
          {(error || conversation?.error) && (
            <p className="desk-error" role="alert">
              {error ?? conversation?.error}
            </p>
          )}
        </div>
        {request.task !== "stock_update" && draft && Object.keys(draft).length > 0 && (
          <aside className="desk-chat-preview" aria-label="Draft">
            {conversation?.comparison && (
              <div className="desk-comparison">
                <p>{buyingPriorities[conversation.comparison.priority]}</p>
                {conversation.comparison.options.map((o, index) => (
                  <div key={o.index}>
                    <strong>
                      {index === 0 ? "Recommended: " : ""}
                      {o.supplier}
                    </strong>
                    <span>
                      {money(o.totalCents, o.currency)} · arrives {o.expectedOn}
                    </span>
                    {o.shortageDays !== null && o.shortageDays > 0 && (
                      <small>
                        May be out for {Number(o.shortageDays.toFixed(1))} days
                        {o.lossCents !== null
                          ? ` · about ${money(o.lossCents, o.currency)} lost`
                          : ""}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}
            <DraftPreview draft={draft} task={request.task} />
            {draftReady(request.task, draft) &&
              (!request.revision || !!conversation?.reviewedDraftKey) && (
                <Button disabled={busy} onClick={() => void save()}>
                  {pending ? "Saving…" : saveLabels[request.task]}
                </Button>
              )}
          </aside>
        )}
      </div>
    </section>
  );
}
function SourceResult({
  sourceId,
  onUse,
}: {
  sourceId: Id<"inventorySources">;
  onUse: (text: string) => void;
}) {
  const source = useQuery(api.inventorySources.get, { sourceId });
  if (!source || source.status === "reading" || source.status === "uploading")
    return <output className="desk-working">Reading your file…</output>;
  if (source.status === "failed")
    return (
      <p role="alert" className="desk-error">
        {source.message}
      </p>
    );
  return (
    <div className="desk-source-items">
      {source.products?.map((p, i) => (
        <Button
          key={i}
          variant="outline"
          onClick={() =>
            onUse(`Add this item from my file: ${JSON.stringify(p)}. Leave current stock unknown.`)
          }
        >
          {p.name}
        </Button>
      ))}
    </div>
  );
}
