export function exactSupplierToken(evidence: string, token: string) {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-zA-Z0-9_./-])${escaped}(?:$|[^a-zA-Z0-9_./-])`, "i").test(evidence);
}
export function exactSupplierNumber(evidence: string, value: number) {
  const numbers =
    evidence.match(/(?<![a-zA-Z0-9.])[0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?(?![a-zA-Z0-9.])/g) ?? [];
  return numbers.some((number) => Number(number.replaceAll(",", "")) === value);
}

// Supplier mail can contain our own outbound templates or older confirmations.
// Only newly authored, unquoted text may supply evidence for a state change.
export function newSupplierReply(body: string) {
  const authored: string[] = [];
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (
      /^\s*(?:From|Sent|Date|To|Subject):\s*/i.test(line) ||
      /^\s*(?:-+\s*(?:Original Message|Forwarded message)|Begin forwarded message:|_{5,})/i.test(
        line,
      ) ||
      /^\s*On\b[\s\S]*\bwrote:(?:\s|$)/i.test(lines.slice(index, index + 4).join(" "))
    )
      break;
    if (/^\s*>/.test(line)) continue;
    authored.push(line);
  }
  return authored.join("\n").trim();
}
export function conflictingSupplierReply(body: string) {
  return /(?:^|\n)\s*(?:no\b|unfortunately\b)|\b(?:cannot|can['’]t|unable|not|never|don['’]t|won['’]t|haven['’]t|hasn['’]t)\b[^.\n]{0,70}\b(?:confirm|confirmed|accept|accepted|cancel|cancelled|canceled|order|supply|deliver)\b|\b(?:confirmation|cancellation|order)\b[^.\n]{0,40}\b(?:pending|denied|rejected|unconfirmed|not possible)\b/i.test(
    body,
  );
}
export function matchSupplierCancellation(
  body: string,
  order: { number: string; quantity: number; receivedQuantity: number; unit: string },
) {
  const reply = newSupplierReply(body);
  if (conflictingSupplierReply(reply)) return false;
  const lines = reply.split(/\r?\n/).map((line) => line.trim());
  return (
    lines.filter((line) => /^Cancelled:/i.test(line)).length === 1 &&
    lines.filter((line) => /^Purchase order:/i.test(line)).length === 1 &&
    lines.filter((line) => /^Remaining quantity:/i.test(line)).length === 1 &&
    lines.includes("Cancelled: yes") &&
    lines.includes(`Purchase order: ${order.number}`) &&
    lines.includes(`Remaining quantity: ${order.quantity - order.receivedQuantity} ${order.unit}`)
  );
}

// Only a complete, explicit supplier confirmation changes incoming stock.
// Free prose and conflicting terms remain visible for human review.
export function matchSupplierConfirmation(
  body: string,
  order: {
    number: string;
    sku: string;
    supplierSku?: string;
    quantity: number;
    unit: string;
    currency: string;
    totalCents: number;
    quotedArrival?: string;
    requiredBy: string;
  },
): { confirmed: true; reference: string; arrival: string } | { confirmed: false; reason: string } {
  body = newSupplierReply(body);
  if (conflictingSupplierReply(body))
    return {
      confirmed: false,
      reason: "The supplier reply contains conflicting or negative terms.",
    };
  const fields = new Map<string, string>();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(Confirmed|Purchase order|Confirmation|SKU|Quantity|Total|Arrival)\s*:\s*(.*?)\s*$/i,
    );
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (fields.has(key))
      return { confirmed: false, reason: "Repeated confirmation fields need checking." };
    fields.set(key, match[2]);
  }
  const reference = fields.get("confirmation") ?? "";
  const arrival = fields.get("arrival") ?? "";
  const quantity = fields.get("quantity")?.match(/^([0-9]+(?:\.[0-9]+)?)\s+(.+)$/);
  const total = fields.get("total")?.match(/^([A-Z]{3})\s+([0-9]+(?:\.[0-9]{1,2})?)$/);
  if (
    fields.get("confirmed")?.toLowerCase() !== "yes" ||
    !reference ||
    reference.length > 200 ||
    /\[|\]/.test(reference)
  )
    return {
      confirmed: false,
      reason: "An explicit order confirmation and reference are missing.",
    };
  if (
    fields.get("purchase order") !== order.number ||
    fields.get("sku") !== (order.supplierSku ?? order.sku) ||
    !quantity ||
    Number(quantity[1]) !== order.quantity ||
    quantity[2].toLowerCase() !== order.unit.toLowerCase() ||
    !total ||
    total[1] !== order.currency ||
    Math.round(Number(total[2]) * 100) !== order.totalCents
  )
    return {
      confirmed: false,
      reason: "The product, quantity, or final total does not match the approval.",
    };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(arrival) ||
    !Number.isFinite(Date.parse(arrival)) ||
    new Date(arrival).toISOString().slice(0, 10) !== arrival ||
    arrival !== (order.quotedArrival ?? order.requiredBy)
  )
    return {
      confirmed: false,
      reason: "The delivery date is missing or differs from the approved date.",
    };
  return { confirmed: true, reference, arrival };
}
