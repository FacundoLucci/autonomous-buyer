import { Parser } from "htmlparser2";

export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export const string = (value: unknown) => (typeof value === "string" ? value : "");
export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
export function address(value: unknown) {
  const input = string(value);
  const email = (input.match(/<([^<>]+)>/)?.[1] ?? input).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : "";
}
export function htmlText(html: string) {
  let text = "",
    depth = 0;
  const stack: boolean[] = [];
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        const hidden =
          ["script", "style", "head", "blockquote", "template"].includes(name) ||
          /gmail_quote|yahoo_quoted/.test(attrs.class ?? "") ||
          attrs.hidden !== undefined ||
          /display\s*:\s*none/i.test(attrs.style ?? "");
        stack.push(hidden);
        if (hidden) depth++;
        if (!depth && /^(br|p|div|tr|li|h[1-6])$/.test(name)) text += "\n";
        if (!depth && /^(td|th)$/.test(name)) text += " | ";
      },
      ontext(value) {
        if (!depth) text += value;
      },
      onclosetag(name) {
        if (stack.pop()) depth--;
        if (!depth && /^(p|div|tr|li)$/.test(name)) text += "\n";
      },
    },
    { decodeEntities: true },
  );
  parser.write(html.slice(0, 200_000));
  parser.end();
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function mailBody(message: Record<string, unknown>) {
  return (
    string(message.extracted_text).trim() ||
    htmlText(string(message.extracted_html)) ||
    string(message.text).trim() ||
    htmlText(string(message.html)) ||
    string(message.preview).trim()
  ).slice(0, 30_000);
}
export function mailRisk(message: Record<string, unknown>): string | undefined {
  const labels = strings(message.labels).map((l) => l.toLowerCase());
  if (labels.some((l) => ["unauthenticated", "spam", "blocked"].includes(l)))
    return "Sender verification needs review. This email cannot update purchasing automatically.";
  return undefined;
}
export function attachments(message: Record<string, unknown>) {
  return (Array.isArray(message.attachments) ? message.attachments : [])
    .slice(0, 10)
    .map((value) => {
      const a = record(value);
      return {
        id: string(a.attachment_id),
        filename: string(a.filename).slice(0, 180) || "Attachment",
        contentType: string(a.content_type).split(";")[0].toLowerCase(),
        size: typeof a.size === "number" ? a.size : 0,
      };
    })
    .filter((a) => a.id);
}
export const FILE_LIMIT = 8 * 1024 * 1024;
export function documentType(bytes: Uint8Array, type: string) {
  if (type === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-")
    return type;
  if (
    type === "image/png" &&
    Array.from(bytes.slice(0, 8)).join(",") === "137,80,78,71,13,10,26,10"
  )
    return type;
  if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return type;
  throw new Error("Use a valid PDF, PNG or JPG document under 8 MB.");
}
