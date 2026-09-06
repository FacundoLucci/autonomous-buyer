type Env = {
  ALERT_SECRET: string;
  FROM_EMAIL: string;
  EMAIL: {
    send(message: {
      from: { email: string; name: string };
      to: string;
      subject: string;
      text: string;
    }): Promise<{ messageId: string }>;
  };
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET")
      return json({ ok: true, service: "buy-hard-alerts" });
    if (path !== "/send" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (!env.ALERT_SECRET || request.headers.get("Authorization") !== `Bearer ${env.ALERT_SECRET}`)
      return json({ error: "Unauthorized" }, 401);
    if (Number(request.headers.get("Content-Length")) > 80000)
      return json({ error: "Too large" }, 413);
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Empty request" }, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.length;
        if (size > 80000) {
          await reader.cancel();
          return json({ error: "Too large" }, 413);
        }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      let value: unknown;
      try {
        value = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (!value || typeof value !== "object") return json({ error: "Invalid request" }, 400);
      const body = value as Record<string, unknown>;
      if (
        typeof body.to !== "string" ||
        body.to.length > 254 ||
        !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(body.to) ||
        typeof body.subject !== "string" ||
        !body.subject ||
        body.subject.length > 200 ||
        /[\r\n]/.test(body.subject) ||
        typeof body.text !== "string" ||
        !body.text ||
        body.text.length > 18000
      )
        return json({ error: "Invalid email" }, 400);
      const result = await env.EMAIL.send({
        from: { email: env.FROM_EMAIL, name: "BUY HARD" },
        to: body.to,
        subject: body.subject,
        text: body.text,
      });
      return json({ status: "queued", messageId: result.messageId });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
      console.error("Alert delivery error", code);
      return json(
        { error: "Email could not be sent", code },
        code.startsWith("E_RECIPIENT") || code.startsWith("E_SENDER") ? 422 : 503,
      );
    }
  },
};
