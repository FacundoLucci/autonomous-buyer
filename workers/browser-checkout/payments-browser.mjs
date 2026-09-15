// Trusted card fill is separate from model actions. It never returns credentials,
// clicks a control, submits a form, takes a screenshot, or writes a card to disk.
const paymentHosts = [
  "js.stripe.com",
  "checkout.stripe.com",
  "hooks.stripe.com",
  "braintreegateway.com",
  "braintree-api.com",
  "adyen.com",
  "checkoutshopper-live.adyen.com",
  "checkoutshopper-test.adyen.com",
  "checkout.com",
  "shopify.com",
  "shopifycs.com",
];
const patterns = {
  number: /(?:card.?number|cardnumber|cc.?number|(?:^|\s)pan(?:$|\s))/i,
  cvc: /(?:cvc|cvv|security.?code|card.?code)/i,
  expiry: /(?:expir(?:y|ation)(?:.?date)?|card.?exp|cc.?exp)/i,
  month: /(?:exp.*month|month.*exp|cc.?exp.?month)/i,
  year: /(?:exp.*year|year.*exp|cc.?exp.?year)/i,
  name: /(?:card.?holder|name.?on.?card|cc.?name)/i,
};
const autocomplete = {
  "cc-number": "number",
  "cc-csc": "cvc",
  "cc-exp": "expiry",
  "cc-exp-month": "month",
  "cc-exp-year": "year",
  "cc-name": "name",
};

export function paymentFieldKind(descriptor) {
  if (["number", "cvc", "expiry", "month", "year", "name"].includes(descriptor.paymentKind))
    return descriptor.paymentKind;
  const tokens = (descriptor.autocomplete || "").toLowerCase().split(/\s+/);
  for (const token of tokens) if (autocomplete[token]) return autocomplete[token];
  const label = [descriptor.name, descriptor.id, descriptor.label, descriptor.placeholder]
    .filter(Boolean)
    .join(" ");
  for (const key of ["number", "cvc", "month", "year", "expiry", "name"])
    if (patterns[key].test(label)) return key;
  return null;
}

export async function fillPaymentCard(page, card, { merchantOrigin }) {
  if (
    !/^\d{13,19}$/.test(card.number || "") ||
    !/^\d{3,4}$/.test(card.cvc || "") ||
    !Number.isInteger(card.exp_month) ||
    card.exp_month < 1 ||
    card.exp_month > 12 ||
    !Number.isInteger(card.exp_year) ||
    card.exp_year < new Date().getFullYear() ||
    (card.valid_until &&
      (!Number.isFinite(Date.parse(card.valid_until)) ||
        Date.parse(card.valid_until) <= Date.now()))
  )
    throw Error("Link returned an incomplete or expired card. Request a new payment approval.");
  const fields = new Map();
  for (const frame of page.frames()) {
    let url;
    try {
      url = new URL(frame.url());
    } catch {
      continue;
    }
    const knownProvider = paymentHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
    if (url.protocol !== "https:" || (url.origin !== merchantOrigin && !knownProvider)) continue;
    const controls = frame.locator(
      "input:not([type=hidden]):not([type=submit]):not([type=button]), select",
    );
    for (const field of await controls.all()) {
      if (!(await field.isVisible()) || !(await field.isEnabled())) continue;
      const descriptor = await field.evaluate((element) => ({
        autocomplete: element.getAttribute("autocomplete"),
        paymentKind: element.getAttribute("data-buy-hard-payment-kind"),
        name: element.getAttribute("name"),
        id: element.id,
        placeholder: element.getAttribute("placeholder"),
        label:
          element.getAttribute("aria-label") ||
          Array.from(element.labels || [])
            .map((label) => label.innerText)
            .join(" "),
        tag: element.tagName.toLowerCase(),
        maxLength: element.maxLength,
      }));
      const kind = paymentFieldKind(descriptor);
      if (!kind) continue;
      if (fields.has(kind))
        throw Error("Several payment forms are visible. Select one card form before continuing.");
      fields.set(kind, { field, descriptor });
    }
  }
  if (
    !fields.has("number") ||
    !fields.has("cvc") ||
    (!fields.has("expiry") && !(fields.has("month") && fields.has("year")))
  )
    throw Error("This card form needs help. Open the supplier payment form and continue.");
  const values = {
    number: card.number,
    cvc: card.cvc,
    expiry: `${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`,
    month: String(card.exp_month).padStart(2, "0"),
    year: String(card.exp_year),
    name: card.billing_address?.name,
  };
  // Mark every credential field before typing so observations can redact them.
  for (const [kind, { field }] of fields)
    await field.evaluate((element, fieldKind) => {
      element.setAttribute("data-buy-hard-payment", "true");
      element.setAttribute("data-buy-hard-payment-kind", fieldKind);
      element.style.setProperty("-webkit-text-security", "disc", "important");
      element.style.setProperty("color", "transparent", "important");
      element.style.setProperty("text-shadow", "none", "important");
      element.setAttribute("autocomplete", "off");
    }, kind);
  try {
    for (const [kind, { field, descriptor }] of fields) {
      let value = values[kind];
      if (!value) continue;
      if (kind === "year" && descriptor.maxLength === 2) value = value.slice(-2);
      if (descriptor.tag === "select") {
        const options = await field
          .locator("option")
          .evaluateAll((items) =>
            items.map((item) => ({ value: item.value, label: item.textContent || "" })),
          );
        const selected =
          options.find((item) => item.value === value) ||
          options.find(
            (item) => /^\d+$/.test(item.value) && Number(item.value) === Number(value),
          ) ||
          options.find((item) => item.label.trim() === value);
        if (!selected) throw Error("The card expiration option is unavailable.");
        await field.selectOption(selected.value);
      } else await field.fill(value, { timeout: 10000 });
    }
  } catch {
    throw Error(
      "The supplier card form could not be completed. Inspect the checkout before retrying.",
    );
  }
  const brand = ["visa", "mastercard", "amex", "discover", "diners", "jcb", "unionpay"].includes(
    card.brand,
  )
    ? card.brand
    : "card";
  return { brand, last4: card.number.slice(-4) };
}
