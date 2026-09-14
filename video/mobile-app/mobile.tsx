import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { AgentSurface, type AgentFocus } from "../../src/components/desk/agent";
import { AgentWork } from "../../src/components/desk/agent-work";
import { WorkspaceScreen, type SearchState } from "../../src/components/desk/app";
import { PurchasingInboxContent } from "../../src/components/desk/mail";
import { emailAt, events, inputAt, messagesAt, now, snapshotAt, workspace } from "./scenario";
import "./capture.css";

declare global {
  interface Window {
    renderMobile: (time: number) => void;
    mobileReady: Promise<void>;
  }
}
const noop = () => {};
const action = async () => {};

function Screen({ time }: { time: number }) {
  const mail = emailAt(time);
  const messages = messagesAt(time);
  const latest = messages.filter((m) => m.role === "assistant").at(-1);
  const activeEvent = events.find((e) => e.until && time >= e.at && time < e.until);
  const busy =
    (time >= 10 && time < 11.3) ||
    (time >= 67.6 && time < 68.6) ||
    (time >= 83 && time < 84) ||
    !!activeEvent;
  const snapshot = snapshotAt(time);
  const buyId =
    time >= 28 && time < 32
      ? "cups"
      : time >= 58 && time < 62
        ? "cups"
        : time >= 62 && time < 66
          ? "bread"
          : undefined;
  const focus: AgentFocus = { page: "buys", buy: buyId };
  const search: SearchState = { demo: false, page: mail ? "settings" : "dashboard" };
  return (
    <AgentSurface
      presentation={{ open: time >= 2 && !mail, input: inputAt(time), now: now + time * 1000 }}
      search={search}
      state={{
        messages,
        busy,
        latest: {
          text: latest?.text ?? "Your everyday supplies are being looked after.",
          createdAt: latest?.createdAt,
        },
        status: time >= 50 && time < 68 ? "Needs your input" : "Ready",
        focus,
      }}
      onBegin={action}
      onSend={action}
      onUpload={action}
      renderWork={() =>
        buyId ? (
          <AgentWork
            focus={focus}
            workspace={workspace}
            snapshot={snapshot}
            begin={noop}
            show={noop}
            action={action}
            updateCount={action}
            updateRules={action}
          />
        ) : null
      }
    >
      <WorkspaceScreen
        workspace={workspace}
        snapshot={snapshot}
        search={search}
        navigate={noop}
        signOut={noop}
        action={action}
        updateCount={action}
        updateRules={action}
        renderChat={() => null}
        settings={
          mail && (
            <PurchasingInboxContent
              email="buyer@marketstreetdeli.example"
              messages={null}
              message={mail}
              onRefresh={noop}
              onRead={noop}
              onBack={noop}
            />
          )
        }
      />
    </AgentSurface>
  );
}

const root = createRoot(document.getElementById("app")!);
window.renderMobile = (requestedTime: number) => {
  const time = Math.max(0, Math.min(89.999, requestedTime));
  flushSync(() => root.render(<Screen time={time} />));
  const timeline = document.querySelector<HTMLElement>(".desk-agent-timeline");
  const work = document.querySelector<HTMLElement>(".desk-agent-work:not(:empty)");
  if (timeline) {
    timeline.scrollTop = work
      ? work.getBoundingClientRect().top -
        timeline.getBoundingClientRect().top +
        timeline.scrollTop -
        12
      : timeline.scrollHeight;
  }
  const page = document.querySelector<HTMLElement>(".desk-agent-page");
  const mail = document.querySelector<HTMLElement>(".desk-mail-message");
  if (page) {
    const section = mail?.closest<HTMLElement>(".desk-settings-section");
    page.scrollTop = section
      ? section.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - 16
      : 0;
  }
  for (const animation of document.getAnimations()) {
    animation.pause();
    animation.currentTime = time * 1000;
  }
  document.documentElement.dataset.recordingTime = time.toFixed(3);
};
window.renderMobile(0);
window.mobileReady = document.fonts.ready.then(() => {
  window.renderMobile(0);
});
