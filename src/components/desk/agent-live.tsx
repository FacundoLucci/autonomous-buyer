import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthActions } from "@/lib/buyer-auth";
import { fileMime } from "@/lib/company-files";
import { buyingPriorities } from "@/lib/inventory-planning";
import { AgentSurface, type AgentMessage } from "./agent";
import { AgentWork } from "./agent-work";
import { SourceResult } from "./chat";
import { LiveAuditLog } from "./audit";
import { money, type Buy, type Item, type Snapshot, type Workspace } from "./model";
import type { SearchState } from "./app";
import type { UpdateCount, UpdateRules } from "./inventory";

export function LiveBuyer({
  children,
  workspace,
  snapshot,
  search,
  action,
  updateCount,
  updateRules,
  settings,
}: {
  children: ReactNode;
  workspace: Workspace;
  snapshot?: Snapshot;
  search: SearchState;
  action: (kind: string, buy?: Buy, item?: Item, reviewedKey?: string) => Promise<void>;
  updateCount: UpdateCount;
  updateRules: UpdateRules;
  settings: ReactNode;
}) {
  const data = useQuery(api.buyer.conversation, {});
  const begin = useMutation(api.buyer.begin),
    send = useMutation(api.buyer.send),
    commit = useMutation(api.desk.commit);
  const [sourceId, setSourceId] = useState<Id<"inventorySources"> | null>(null);
  const { token } = useAuthActions();
  const session = data?.session;
  const chat = data?.chat && !data.chat.savedAt ? data.chat : undefined;
  const needsInput = !!chat && !(chat.task === "stock_update" && chat.resultSummary && !chat.busy);
  const activity: AgentMessage[] = (data?.activity ?? []).map((a) => ({
    id: a._id,
    role: "assistant",
    text: a.summary,
    createdAt: a.createdAt,
    credit: a.credit,
    creditPrefix:
      a.credit === "agentmail" && a.summary.includes("Supplier reply:") ? "Replied via" : undefined,
    focus:
      a.orderId || a.buyId
        ? { page: "buys", buy: a.orderId ?? a.buyId }
        : a.itemId
          ? { page: "inventory", item: a.itemId }
          : undefined,
  }));
  const messages = [
    ...(data?.messages ?? []),
    ...activity.filter(
      (a) =>
        !(data?.messages ?? []).some(
          (m) =>
            m.role === "assistant" &&
            m.text === a.text &&
            Math.abs(m.createdAt - a.createdAt) < 5000,
        ),
    ),
  ].sort((a, b) => a.createdAt - b.createdAt);
  const recent = activity[0];
  const latest =
    recent && recent.createdAt > (session?.updatedAt ?? 0)
      ? { text: recent.text, createdAt: recent.createdAt, focus: recent.focus }
      : {
          text: session?.latestText ?? recent?.text ?? "Tell me what you need. I’m here to help.",
          createdAt: session?.latestText ? session.updatedAt : recent?.createdAt,
        };
  async function upload(file: File) {
    const mime = fileMime(file.name);
    if (!mime || file.size > 8 * 1024 * 1024) throw { data: "Choose a supported file under 8 MB." };
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
    if (!response.ok || !result.sourceId) throw { data: "The upload didn’t finish. Try again." };
    setSourceId(result.sourceId);
  }
  return (
    <AgentSurface
      search={search}
      state={{
        messages,
        latest,
        busy: !!session?.busy,
        loading: data === undefined,
        error: session?.error ?? chat?.error,
        status: needsInput ? "Needs your input" : "Ready",
        focus: session?.focus,
      }}
      onBegin={async (request) => {
        await begin({
          task: request.task,
          contextId: request.contextId,
          revision: request.revision,
        });
      }}
      onSend={async (text, focus) => {
        await send({ text, focus });
      }}
      onUpload={upload}
      attachment={
        sourceId && (
          <SourceResult
            sourceId={sourceId}
            onUse={async (text) => {
              await send({ text, focus: { page: "inventory" } });
              setSourceId(null);
            }}
          />
        )
      }
      renderWork={(focus, openTask, show, showTask) => (
        <AgentWork
          key={`${chat?._id ?? "records"}:${focus.page}:${focus.item ?? focus.buy ?? ""}`}
          focus={focus}
          workspace={workspace}
          snapshot={snapshot}
          task={
            chat && showTask && needsInput
              ? {
                  id: chat._id,
                  task: chat.task,
                  draft: chat.draft,
                  credits: chat.credits,
                  reviewedDraftKey: chat.reviewedDraftKey,
                  revision:
                    chat.task === "buy" &&
                    !!snapshot?.buys.find(
                      (b) => b.id === chat.contextId || b.order?._id === chat.contextId,
                    )?.order?.reviewRequired,
                }
              : undefined
          }
          comparison={
            chat?.comparison && (
              <div className="desk-comparison">
                <p>{buyingPriorities[chat.comparison.priority]}</p>
                {chat.comparison.options.map((o, index) => (
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
            )
          }
          save={
            chat
              ? async () => {
                  await commit({
                    chatId: chat._id,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  });
                }
              : undefined
          }
          begin={openTask}
          show={show}
          action={action}
          updateCount={updateCount}
          updateRules={updateRules}
          settings={settings}
          audit={focus.page === "audit" ? <LiveAuditLog /> : null}
          busy={!!session?.busy}
        />
      )}
    >
      {children}
    </AgentSurface>
  );
}
