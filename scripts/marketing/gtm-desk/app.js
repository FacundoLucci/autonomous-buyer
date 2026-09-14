let data;
let page = location.hash.slice(1) || "overview";
let campaign = "all";
let postStatus = "upcoming";
let search = "";
let toastTimer;
const content = document.querySelector("#content");
const dialog = document.querySelector("#conversation-dialog");
const form = document.querySelector("#conversation-form");
const html = (value = "") =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
const date = (value, time = false) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        ...(time ? { hour: "numeric", minute: "2-digit" } : {}),
      }).format(new Date(value))
    : "Not recorded";
const day = (value) =>
  value
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "";
const sourceUrl = (path) => "/source/" + path.split("/").map(encodeURIComponent).join("/");
const safeUrl = (value) => (/^https?:\/\//i.test(value || "") ? value : "#");
const link = (url, title) =>
  `<a href="${html(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${html(title)} ↗</a>`;
const sourceLink = (path, title = "Source record") =>
  `<a href="${sourceUrl(path)}" target="_blank" rel="noopener">${html(title)} ↗</a>`;
const tag = (value, type = "neutral") => `<span class="tag ${type}">${html(value)}</span>`;
const campaignTag = (name) => tag(name === "founder" ? "Facundo" : "BUY HARD", name);
const campaigns = { product: "buyhard_allgas_202609", founder: "facundo_builder_202609" };
const events = (name) => data.metrics.eventsByCampaign[campaigns[name]] || {};
const intro = (title, description) =>
  `<div class="intro"><h1>${title}</h1><p>${description}</p></div>`;

function toast(message) {
  document.querySelector("#toast").textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    document.querySelector("#toast").textContent = "";
  }, 4500);
}

function statusFor(post) {
  if (post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) < new Date())
    return ["Check publication", "warn"];
  return [
    post.status === "published"
      ? "Published"
      : post.status === "scheduled"
        ? "Scheduled"
        : post.status === "failed"
          ? "Failed"
          : "Draft · held",
    post.status === "published"
      ? "success"
      : post.status === "failed" || post.status === "draft"
        ? "warn"
        : "neutral",
  ];
}

function actionRows(actions) {
  return `<div class="actions">${actions
    .map((action) => {
      const done = data.state.actions[action.id]?.done;
      return `<div class="action ${done ? "done" : ""}"><label><input type="checkbox" data-action="${html(action.id)}" ${done ? "checked" : ""} aria-label="Mark ${html(action.title)} complete"><span class="action-body"><h3>${html(action.title)}</h3><p>${html(action.next)}</p><div class="meta">${html(action.owner)} · ${html(action.when)}${done ? " · Marked complete locally" : ""}</div></span></label></div>`;
    })
    .join("")}</div>`;
}

function miniPosts() {
  return data.posts
    .filter((p) => p.status === "scheduled")
    .slice(0, 4)
    .map(
      (p) =>
        `<div class="mini-post"><time>${date(p.scheduledAt)}<br>${new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(new Date(p.scheduledAt))}</time><div><strong>${html(p.title)}</strong>${campaignTag(p.campaign)}</div></div>`,
    )
    .join("");
}

function overview() {
  const product = events("product");
  const sources = data.metrics.eventsByCampaignAndSource;
  const linkedin = sources[`${campaigns.product} / linkedin`]?.visit || 0;
  const x = sources[`${campaigns.product} / x`]?.visit || 0;
  const published = data.posts.filter(
    (p) => p.campaign === "product" && p.status === "published",
  ).length;
  const upcoming = data.posts.filter(
    (p) => p.campaign === "product" && p.status === "scheduled",
  ).length;
  const founder = data.posts.filter(
    (p) => p.campaign === "founder" && p.status === "scheduled",
  ).length;
  return `${intro("A clear view of<br>what comes next.", "BUY HARD and your founder campaign, together. The publishing queue, the evidence, and the conversations worth moving forward.")}
    <div class="banner"><p><strong>The next useful signal is a conversation.</strong> Publishing is underway. Turn early attention into operator walkthroughs and relevant founder conversations; record the next step for each.</p><a href="#followups">Manage follow-ups ↗</a></div>
    <div class="metrics">
      <div class="metric"><div class="label">Product stories published</div><div class="number">${published}</div><small>${upcoming} more scheduled · X + LinkedIn</small></div>
      <div class="metric"><div class="label">Attributed product visitors</div><div class="number">${product.visit ?? 0}</div><small>${linkedin} LinkedIn · ${x} X · browser IDs</small></div>
      <div class="metric"><div class="label">Inquiries / bookings</div><div class="number">${product.inquiry ?? 0} / ${product.booking_confirmed ?? 0}</div><small>Recorded non-test campaign events</small></div>
      <div class="metric"><div class="label">Founder stories scheduled</div><div class="number">${founder}</div><small>Sep 14, 16, 18 & 21 · 8 p.m.</small></div>
    </div>
    <div class="columns"><section><div class="section-title"><h2>Your next moves</h2><a href="#work">All work ↗</a></div>${actionRows(data.actions.slice(0, 4))}<div class="note"><strong>Measurement needs a repair.</strong><p>Demo use is incomplete. The tested handoff fix is local at <code>59277a1</code>; a later production release has not been verified here. Visits and zero recorded demo use cannot tell us where people stop.</p></div></section>
    <div><div class="goals"><section class="goal">${campaignTag("product")}<h3>Find the first operators.</h3><p>Start with cafés, delis and food businesses. One recurring supply and a 20-minute walkthrough.</p><div class="goal-footer">Target by submission: <strong>5 conversations · 2 pilot candidates</strong><br>${product.pilot_started ?? 0} app-recorded pilot starts. Offline progress not yet recorded.</div></section><section class="goal founder">${campaignTag("founder")}<h3>Let the work open doors.</h3><p>Show your product judgment and agent work. Track introductions, hiring conversations and interviews separately.</p><div class="goal-footer">First post: <strong>Sep 14 at 8 p.m.</strong><br>Private messages and career outcomes are unmeasured.</div></section></div><div class="section-title"><h2>Up next</h2><a href="#calendar">Full queue ↗</a></div>${miniPosts()}</div></div>`;
}

function toolbar(showStatus = false) {
  return `<div class="toolbar"><label>Campaign<select id="campaign-filter"><option value="all">Both campaigns</option><option value="product">BUY HARD</option><option value="founder">Facundo</option></select></label>${showStatus ? `<label>Show<select id="status-filter"><option value="upcoming">Upcoming & held</option><option value="published">Published</option><option value="all">All stories</option></select></label><input type="search" id="search" aria-label="Search stories" placeholder="Find a story…" value="${html(search)}">` : ""}</div>`;
}

function calendar() {
  return `${intro("One shared calendar.", "Three product slots a day. Founder stories use selected fourth slots at 8 p.m. All times are Chicago time.")}${toolbar(true)}<div id="posts-list"></div><div class="note"><strong>The next open slot is Tuesday, Sep 15 at 5:30 p.m.</strong><p>Later product themes remain flexible. The napkin is a held draft for Sep 17 or later, after two earlier film references have published. The live queue remains in ${link("https://zernio.com/dashboard/posts-all?view=table", "Zernio")}.</p></div>`;
}

function renderPosts() {
  const filtered = data.posts.filter(
    (p) =>
      (campaign === "all" || p.campaign === campaign) &&
      (postStatus === "all" ||
        (postStatus === "published" ? p.status === "published" : p.status !== "published")) &&
      `${p.title} ${p.evidence}`.toLowerCase().includes(search.toLowerCase()),
  );
  const rows = postStatus === "published" ? [...filtered].reverse() : filtered;
  document.querySelector("#posts-list").innerHTML = `<div class="list">${
    rows.length
      ? rows
          .map((p) => {
            const status = statusFor(p);
            const time = p.status === "draft" ? "Unscheduled" : date(p.scheduledAt);
            const clock =
              p.scheduledAt && p.status !== "draft"
                ? new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Chicago",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(p.scheduledAt))
                : "Held for Sep 17+";
            const impressions = p.metrics?.impressions;
            return `<article class="post"><time>${time}<small>${clock}</small></time><div><div class="tags">${campaignTag(p.campaign)}${tag(...status)}</div><h3>${html(p.title)}</h3><small>${html(p.evidence)}</small><div class="post-links">${link(p.providerUrl, "Open in Zernio")}${(p.links || []).map((url) => link(url, url.includes("linkedin") ? "LinkedIn" : "X")).join("")}${p.captionSource ? sourceLink(p.captionSource, "Copy") : ""}</div>${p.copy ? `<details><summary>Read caption</summary><p>${html(p.copy)}</p></details>` : ""}</div><div class="stat">${p.status === "published" ? `${impressions == null ? "Unavailable" : html(impressions)}<br>reported impressions<br><small>Combined Zernio row</small>` : "X + LinkedIn"}</div></article>`;
          })
          .join("")
      : `<div class="empty"><h2>No matching stories.</h2><p>Try a different campaign, status or search.</p></div>`
  }</div>`;
}

function followups() {
  return `${intro("Keep the conversation moving.", "A simple list for operator conversations and founder opportunities. Give every promising response a next step.")}<div class="section-title"><p class="help">Your entries stay on this computer. App leads remain in the private lead list.</p><button class="primary" data-add>Add follow-up +</button></div>${toolbar()}<div id="conversations"></div><div class="note"><strong>Useful signals to review</strong><p>The OpenAI post has a question about when reorders are triggered. The walkthrough post now has two comments in Zernio. Counts may include your own replies; review the discussions before treating them as prospects.</p>${link("https://www.linkedin.com/feed/update/urn:li:share:7504532095780827136/", "OpenAI discussion")} · ${link("https://www.linkedin.com/feed/update/urn:li:share:7504954901958127617/", "Walkthrough discussion")} · ${link("https://buyhard.app/leads", "Private app leads")}</div>`;
}

function renderConversations() {
  const rows = data.state.conversations
    .filter((r) => campaign === "all" || r.campaign === campaign)
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  document.querySelector("#conversations").innerHTML = rows.length
    ? `<div class="list">${rows.map((row) => `<article class="conversation"><div><div class="tags">${campaignTag(row.campaign)} ${tag(row.stage, row.stage === "Closed" ? "neutral" : "success")}</div><h3>${html(row.name)}</h3><p>${html(row.next || "Add the next step.")}</p><div class="meta"><span>${row.due ? `Follow up ${date(row.due + "T12:00:00-05:00")}${row.stage !== "Closed" && row.due < day(new Date()) ? " · Overdue" : ""}` : "No date set"}</span>${row.url ? link(row.url, "Conversation") : ""}<span>Manually recorded</span></div></div><button data-edit="${html(row.id)}">Edit</button></article>`).join("")}</div>`
    : `<div class="empty"><span class="eyebrow">THIS IS THE MISSING LIST</span><h2>No follow-ups recorded here yet.</h2><p>Start with one operator you can learn from, or a relevant reply to your work. Add their name, the next step and a date.</p><button class="primary" data-add>Add the first follow-up</button></div>`;
}

function work() {
  return `${intro("The work behind the stories.", "Track what is ready, what is being built, and what still needs your part. Completion notes stay separate from publication and release evidence.")}<div class="banner"><p><strong>Submission: Sep 22, 2 p.m. Chicago.</strong> Aim to have the package ready Sep 21. The official judging criteria require a video under three minutes.</p>${link("https://www.convex.dev/hackathons/all-gas", "Official requirements")}</div>
  <div class="section-title"><h2>Open work</h2><span class="help">Owner and next step included</span></div>${actionRows(data.actions)}
  <div class="section-title space-top"><h2>Assets & product work</h2></div><div class="list">${data.workstreams.map((w) => `<article class="work-row"><div>${tag(w.status, w.tone)}<div class="proof">${html(w.owner)}</div></div><div><h3>${html(w.title)}</h3><p>${html(w.detail)}</p><p class="proof">${html(w.proof)}</p>${w.url ? link(w.url, w.linkTitle || "Open") : ""}${w.source ? sourceLink(w.source) : ""}</div></article>`).join("")}</div><div class="note"><strong>Source drift found in this review</strong><p>The strategy still describes the older recording work, although the assembled cut is ready for narration. The backlog still calls sales connections a proposal, while the separate build task has committed Square and Shopify work locally. Check the dated evidence before reusing those status claims.</p></div>`;
}

function sources() {
  return `${intro("One front door. Original records.", "The dashboard reads existing campaign records when you reload. Zernio remains the publishing source; app results come from dated production checks.")}<div class="note"><strong>Existing review: 7:30 a.m. and 3:30 p.m. Chicago, every day.</strong><p>“BUY HARD daily marketing” is active and coordinates both campaigns. It saves the queue, aggregate results and material decisions. This dashboard picks up supported new receipts and metrics files. Work and asset summaries are dated review notes.</p><p>Reload records reads local evidence; it does not make a live platform or production query. Follow-ups are saved outside the repository.</p></div><div class="source-grid space-top">${data.sources.map((s) => `<article class="source"><span class="eyebrow">${html(s.kind)}</span><h3>${html(s.title)}</h3><p>${html(s.description)}</p>${sourceLink(s.path, "Read source")}<small>${s.modifiedAt ? `File changed ${date(s.modifiedAt, true)}` : "File unavailable"}</small></article>`).join("")}</div><div class="note"><strong>Measurement boundaries</strong>${data.metrics.limitations.map((l) => `<p>${html(l)}</p>`).join("")}<p>Missing social counters are unavailable. Platform exposure totals are not added together. Founder private messages and offline operator conversations have not been inspected.</p></div>`;
}

function render() {
  if (!data) return;
  const pages = { overview, calendar, followups, work, sources };
  if (!pages[page]) page = "overview";
  document.querySelectorAll("[data-page]").forEach((a) => {
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  content.innerHTML = pages[page]();
  const filter = document.querySelector("#campaign-filter");
  if (filter) {
    filter.value = campaign;
    filter.addEventListener("change", (e) => {
      campaign = e.target.value;
      if (page === "calendar") renderPosts();
      else renderConversations();
    });
  }
  if (page === "calendar") {
    document.querySelector("#status-filter").value = postStatus;
    document.querySelector("#status-filter").addEventListener("change", (e) => {
      postStatus = e.target.value;
      renderPosts();
    });
    document.querySelector("#search").addEventListener("input", (e) => {
      search = e.target.value;
      renderPosts();
    });
    renderPosts();
  }
  if (page === "followups") renderConversations();
  const oldMetrics = Date.now() - new Date(data.metrics.checkedAt).getTime() > 86400000;
  const oldQueue = Date.now() - new Date(data.queueCheckedAt).getTime() > 86400000;
  document.querySelector("#freshness").innerHTML =
    `<p>Queue checked ${date(data.queueCheckedAt, true)}${oldQueue ? " · more than 24 hours old" : ""} · Production results checked ${date(data.metrics.checkedAt, true)}${oldMetrics ? " · more than 24 hours old" : ""} · Chicago time</p><p>Work review: ${date(data.checkedAt, true)} · ${sourceLink(data.metricsSource, "Results evidence")} · Reload reads saved records. Your follow-ups are saved locally.</p>`;
  const error = document.querySelector("#error");
  error.hidden = !data.warnings.length;
  error.textContent = data.warnings.join(". ");
}

async function reload() {
  const button = document.querySelector("#refresh");
  button.disabled = true;
  try {
    const response = await fetch("/api/overview");
    if (!response.ok) throw new Error((await response.json()).error);
    data = await response.json();
    render();
  } catch (error) {
    const node = document.querySelector("#error");
    node.hidden = false;
    node.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function save(path, values) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, revision: data.state.revision }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not save.");
  data.state = result;
}

function editConversation(id) {
  form.reset();
  document.querySelector("#form-error").textContent = "";
  const record = data.state.conversations.find((r) => r.id === id);
  document.querySelector("#dialog-title").textContent = record
    ? "Edit follow-up"
    : "Add a follow-up";
  form.elements.id.value = "";
  if (record)
    for (const key of ["id", "name", "campaign", "stage", "next", "due", "url"])
      form.elements[key].value = record[key] || "";
  else if (campaign !== "all") form.elements.campaign.value = campaign;
  dialog.showModal();
}

content.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  const edit = e.target.closest("[data-edit]");
  if (add) editConversation();
  if (edit) editConversation(edit.dataset.edit);
});
content.addEventListener("change", async (e) => {
  if (!e.target.matches("[data-action]")) return;
  const checkbox = e.target;
  checkbox.disabled = true;
  try {
    await save("/api/action", { id: checkbox.dataset.action, done: checkbox.checked });
    render();
    toast("Action updated locally");
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    toast(error.message);
  } finally {
    checkbox.disabled = false;
  }
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  try {
    await save("/api/conversation", Object.fromEntries(new FormData(form)));
    dialog.close();
    render();
    toast("Follow-up saved on this computer");
  } catch (error) {
    document.querySelector("#form-error").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
form.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    form.requestSubmit();
  }
});
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#refresh").addEventListener("click", async () => {
  await reload();
  toast("Saved campaign records reloaded");
});
window.addEventListener("hashchange", () => {
  page = location.hash.slice(1);
  render();
  window.scrollTo({ top: 0 });
});
document.querySelector("#today").textContent =
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date()) + " · CHICAGO";
reload();
