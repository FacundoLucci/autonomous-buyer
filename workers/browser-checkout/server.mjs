import http from "node:http";
import { mkdir, readFile, writeFile, rename, open } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { chromium } from "playwright";
import { fingerprint, computerStep } from "./runner.mjs";
import { runGenericCheckout, observe, performAction } from "./generic.mjs";
import { startEgressProxy } from "./egress.mjs";
const secret = process.env.BROWSER_WORKER_SECRET;
const encryptionKey = Buffer.from(process.env.SESSION_ENCRYPTION_KEY || "", "hex");
if (!secret || secret.length < 32 || encryptionKey.length !== 32)
  throw Error(
    "Set a 32+ character BROWSER_WORKER_SECRET and a 32-byte hex SESSION_ENCRYPTION_KEY.",
  );
const dir = process.env.DATA_DIR || "./data";
await mkdir(dir, { recursive: true, mode: 0o700 });
if (!process.env.OPENAI_API_KEY) throw Error("OPENAI_API_KEY is required");
const proxy = await startEgressProxy();
const browser = await chromium.launch({
  headless: true,
  proxy: { server: proxy.url },
  args: [
    "--proxy-bypass-list=<-loopback>",
    "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
  ],
});
const active = new Map(),
  sessions = new Set(),
  takeovers = new Map(),
  running = new Set(),
  admissions = new Map();
async function save(job) {
  const path = `${dir}/${job.id}.json`;
  const tmp = `${path}.${randomBytes(8).toString("hex")}.tmp`;
  const file = await open(tmp, "wx", 0o600);
  try {
    await file.writeFile(JSON.stringify(job));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(tmp, path);
  const directory = await open(dir, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
async function load(id) {
  if (!/^[a-f0-9]{64}$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(`${dir}/${id}.json`, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw Error("Execution journal is unreadable; refusing to replay a purchase.");
  }
}
async function readSession(id) {
  try {
    const data = Buffer.from(await readFile(`${dir}/${id}.session`, "utf8"), "base64");
    const d = createDecipheriv("aes-256-gcm", encryptionKey, data.subarray(0, 12));
    d.setAuthTag(data.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(data.subarray(28)), d.final()]).toString());
  } catch {
    return undefined;
  }
}
async function saveSession(id, context) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    c.update(JSON.stringify(await context.storageState({ indexedDB: true }))),
    c.final(),
  ]);
  await writeFile(
    `${dir}/${id}.session`,
    Buffer.concat([iv, c.getAuthTag(), encrypted]).toString("base64"),
    { mode: 0o600 },
  );
}
async function execute(job) {
  running.add(job.id);
  const sessionId = fingerprint([job.order.organizationId, new URL(job.order.buyUrl).origin]);
  if (sessions.has(sessionId) || sessions.size >= 3) {
    job.state = "needs_help";
    job.error =
      "Another checkout is using this supplier session. Retry preparation after it finishes.";
    await save(job);
    running.delete(job.id);
    return;
  }
  sessions.add(sessionId);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    storageState: await readSession(sessionId),
    serviceWorkers: "block",
  });
  await context.routeWebSocket("**/*", (ws) => ws.close());
  const page = await context.newPage();
  active.set(job.id, { context, page, sessionId, job });
  try {
    Object.assign(
      job,
      await runGenericCheckout({
        page,
        job,
        persist: save,
        authorize: async () => {
          const origin = new URL(process.env.CONVEX_SITE_URL);
          if (origin.protocol !== "https:") throw Error("HTTPS Convex callback required");
          const response = await fetch(new URL("/api/browser/authorize", origin), {
            method: "POST",
            headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: job.order._id, jobId: job.id, intent: job.intent }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) return false;
          return (await response.json()).authorized === true;
        },
      }),
    );
    await saveSession(sessionId, context);
  } catch {
    job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
    job.error = job.submitStarted
      ? "Checkout may have succeeded. Verify the supplier order history before retrying."
      : "The supplier checkout could not be completed. Check the supplier session or configuration.";
  }
  await save(job);
  running.delete(job.id);
  if (job.state === "needs_help") {
    setTimeout(
      () => {
        if (active.get(job.id)?.job === job) void close(job.id).catch(() => {});
      },
      15 * 60 * 1000,
    ).unref();
  } else await close(job.id);
}
async function close(id) {
  const a = active.get(id);
  if (a) {
    try {
      await saveSession(a.sessionId, a.context);
    } finally {
      await a.context.close();
      sessions.delete(a.sessionId);
      active.delete(id);
      for (const [token, grant] of takeovers) if (grant.id === id) takeovers.delete(token);
    }
  }
}
function authorized(req) {
  const value = Buffer.from((req.headers.authorization || "").replace(/^Bearer /, ""));
  const expected = Buffer.from(secret);
  return value.length === expected.length && timingSafeEqual(value, expected);
}
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 20000) throw Error("Request too large");
  }
  return JSON.parse(text || "{}");
}
function reply(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}
const publicUrl = process.env.PUBLIC_URL;
const service = http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://worker");
      if (url.pathname === "/health")
        return reply(res, browser.isConnected() ? 200 : 503, {
          ok: browser.isConnected(),
          mode: "generic",
          active: active.size,
        });
      // Capabilities are short lived and scoped to exactly one isolated browser.
      if (url.pathname.startsWith("/takeover/")) {
        const token = url.pathname.split("/")[2],
          grant = takeovers.get(token),
          a = grant && active.get(grant.id);
        if (!grant || grant.expires < Date.now() || !a)
          return reply(res, 403, {
            error: "Session expired. Open a new supplier help session from BUY HARD.",
          });
        if (req.method === "GET" && url.pathname.endsWith("/screen")) {
          res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
          return res.end(await a.page.screenshot());
        }
        if (req.method === "POST") {
          const input = await body(req);
          if (input.type === "done") {
            await close(grant.id);
            takeovers.delete(token);
            return reply(res, 200, { done: true });
          }
          // Human setup cannot activate a purchase button or submit a form via Enter.
          if (input.type === "key" && input.key !== "Tab")
            throw Error("Use the visible supplier controls");
          if (input.type === "click") {
            const state = await observe(a.page);
            let selected;
            for (const [id, target] of state.targets) {
              const box = await target.locator.boundingBox();
              if (
                box &&
                input.x >= box.x &&
                input.x <= box.x + box.width &&
                input.y >= box.y &&
                input.y <= box.y + box.height
              )
                selected = id;
            }
            if (!selected) throw Error("Select a visible form control");
            await performAction(a.page, { type: "click", target: selected }, state, {
              human: true,
            });
          } else await computerStep(a.page, input);
          return reply(res, 200, { ok: true });
        }
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        });
        return res.end(
          `<!doctype html><title>Supplier sign-in</title><p>Complete supplier sign-in. Ordering remains blocked. Close when finished, then retry in BUY HARD.</p><button onclick="send({type:'done'})">Finish session</button><input id="entry" type="password" autocomplete="off" placeholder="Type into supplier field"><button onclick="send({type:'type',text:entry.value});entry.value=''">Type</button><button onclick="send({type:'key',key:'Tab'})">Tab</button><button onclick="send({type:'scroll',y:600})">Scroll down</button><button onclick="send({type:'scroll',y:-600})">Scroll up</button><img id="screen" style="width:100%;max-width:1280px" src="${url.pathname}/screen"><script>const base=location.pathname;async function send(a){await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});document.getElementById('screen').src=base+'/screen?t='+Date.now()}document.getElementById('screen').onclick=e=>{const r=document.getElementById('screen').getBoundingClientRect();send({type:'click',x:(e.clientX-r.left)*1280/r.width,y:(e.clientY-r.top)*900/r.height})};</script>`,
        );
      }
      if (!authorized(req)) return reply(res, 401, { error: "Unauthorized" });
      if (req.method === "POST" && url.pathname === "/jobs") {
        const input = await body(req);
        if (
          !["prepare", "submit"].includes(input.phase) ||
          typeof input.order?.organizationId !== "string" ||
          typeof input.order?.buyUrl !== "string" ||
          typeof input.intent !== "string"
        )
          return reply(res, 400, { error: "Invalid job" });
        const destination = new URL(input.order.buyUrl);
        if (
          destination.protocol !== "https:" ||
          destination.username ||
          destination.password ||
          typeof input.order._id !== "string" ||
          typeof input.order.sku !== "string" ||
          typeof input.order.unit !== "string" ||
          typeof input.order.shipTo !== "string" ||
          !Number.isFinite(input.order.quantity) ||
          input.order.quantity <= 0
        )
          return reply(res, 400, {
            error: "A public HTTPS buying URL and complete order are required",
          });
        const id = fingerprint([
          input.order.organizationId,
          input.order._id,
          input.phase,
          input.intent,
        ]);
        let admission = admissions.get(id);
        if (!admission) {
          admission = (async () => {
            let job = await load(id);
            if (!job) {
              job = { ...input, id, state: "running", createdAt: Date.now() };
              await save(job);
              void execute(job).catch(async () => {
                running.delete(job.id);
                if (!active.has(job.id))
                  sessions.delete(
                    fingerprint([job.order.organizationId, new URL(job.order.buyUrl).origin]),
                  );
                job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
                job.error = "Browser unavailable. Review before retrying.";
                await save(job);
                await close(job.id);
              });
            } else if (job.state === "running" && !active.has(id) && !running.has(id)) {
              job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
              job.error = "Worker restarted. Verify the supplier session before continuing.";
              await save(job);
            }
            return job;
          })();
          admissions.set(id, admission);
        }
        const job = await admission;
        admissions.delete(id);
        return reply(res, 200, { id, state: job.state });
      }
      const match = url.pathname.match(/^\/jobs\/([a-f0-9]{64})(\/(?:takeover|retry|reconcile))?$/);
      if (match) {
        const job = await load(match[1]);
        if (!job) return reply(res, 404, { error: "Job not found" });
        if (match[2] === "/retry" && req.method === "POST") {
          if (job.submitStarted || running.has(job.id))
            return reply(res, 409, { error: "This job cannot be replayed." });
          running.add(job.id);
          await close(job.id);
          job.state = "running";
          job.error = undefined;
          await save(job);
          void execute(job).catch(async () => {
            running.delete(job.id);
            if (!active.has(job.id))
              sessions.delete(
                fingerprint([job.order.organizationId, new URL(job.order.buyUrl).origin]),
              );
            job.state = job.submitStarted ? "outcome_unknown" : "needs_help";
            job.error = "Browser unavailable. Review before retrying.";
            await save(job);
            await close(job.id);
          });
          return reply(res, 200, { id: job.id, state: job.state });
        }
        if (match[2] === "/reconcile" && req.method === "POST") {
          return reply(res, 409, {
            error:
              "Check supplier order history and record the result in BUY HARD. An uncertain purchase is never retried automatically.",
          });
        }
        if (match[2] === "/takeover" && req.method === "POST") {
          if (!publicUrl || !active.has(job.id) || job.state !== "needs_help")
            return reply(res, 409, {
              error: "No active help session. Retry checkout preparation.",
            });
          const token = randomBytes(32).toString("hex");
          takeovers.set(token, { id: job.id, expires: Date.now() + 10 * 60 * 1000 });
          return reply(res, 200, { url: `${publicUrl}/takeover/${token}` });
        }
        return reply(res, 200, {
          id: job.id,
          state: job.state,
          snapshot: job.snapshot,
          confirmation: job.confirmation,
          error: job.error,
        });
      }
      reply(res, 404, { error: "Not found" });
    } catch {
      reply(res, 400, { error: "Invalid request" });
    }
  })
  .listen(Number(process.env.PORT || 8080), "0.0.0.0");

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await browser.close();
    proxy.close();
    service.close(() => process.exit(0));
  });
