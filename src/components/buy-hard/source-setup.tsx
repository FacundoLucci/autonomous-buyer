import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, FileText, Link2, LoaderCircle, Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthActions } from "@/lib/buyer-auth";
import { units, setupFieldError, type InventoryUnit } from "@/lib/setup-fields";
import { SetupFrame, setupError } from "./setup";

type Draft = {
  companyName: string;
  shippingAddress: string;
  sourceId: Id<"inventorySources"> | null;
  productIndex: number;
  itemName: string;
  quantity: string;
  dailyUsage: string;
  unit: InventoryUnit;
  step: number;
};
const blank: Draft = {
  companyName: "",
  shippingAddress: "",
  sourceId: null,
  productIndex: 0,
  itemName: "",
  quantity: "",
  dailyUsage: "",
  unit: "units",
  step: 0,
};
function savedDraft(key: string): Draft {
  try {
    const current = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    const prior = current
      ? null
      : JSON.parse(sessionStorage.getItem("buy-hard-company-setup-v1") ?? "null");
    const saved: unknown = current
      ? JSON.parse(current)
      : { companyName: prior?.companyName, shippingAddress: prior?.shippingAddress };
    if (!saved || typeof saved !== "object") return { ...blank };
    const raw = saved as Record<string, unknown>;
    const draft = { ...blank };
    for (const field of [
      "companyName",
      "shippingAddress",
      "itemName",
      "quantity",
      "dailyUsage",
    ] as const) {
      if (typeof raw[field] === "string" && raw[field].length <= 500) draft[field] = raw[field];
    }
    if (typeof raw.sourceId === "string" && /^[a-z0-9]{32}$/.test(raw.sourceId))
      draft.sourceId = raw.sourceId as Id<"inventorySources">;
    if (typeof raw.unit === "string" && units.includes(raw.unit as InventoryUnit))
      draft.unit = raw.unit as InventoryUnit;
    if (
      typeof raw.productIndex === "number" &&
      Number.isInteger(raw.productIndex) &&
      raw.productIndex >= 0 &&
      raw.productIndex < 20
    )
      draft.productIndex = raw.productIndex;
    if (
      typeof raw.step === "number" &&
      Number.isInteger(raw.step) &&
      raw.step >= 0 &&
      raw.step <= 6
    )
      draft.step = raw.step;
    return draft;
  } catch {
    return { ...blank };
  }
}
function focus(node: HTMLElement | null) {
  if (node && window.matchMedia("(pointer: fine)").matches) node.focus({ preventScroll: true });
}
export function SourceSetup({ userId }: { userId: Id<"users"> }) {
  const key = `buy-hard-source-setup-v2-${userId}`;
  const [draft, setDraft] = useState(() => savedDraft(key));
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"link" | "invoice">("link");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { token } = useAuthActions();
  const startLink = useMutation(api.inventorySources.startLink);
  const complete = useMutation(api.onboarding.completeFromSource);
  const source = useQuery(
    api.inventorySources.get,
    draft.sourceId ? { sourceId: draft.sourceId } : "skip",
  );
  const [manual, setManual] = useState(false);
  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    setError(null);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Optional draft persistence. */
    }
  }
  async function importLink(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sourceId = await startLink({ url });
      update({ sourceId, itemName: "", productIndex: 0 });
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (
      file.size > 8 * 1024 * 1024 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(file.type)
    ) {
      setError("Choose a PDF, PNG, or JPG under 8 MB.");
      return;
    }
    if (!token) {
      setError("Sign in again to upload your invoice.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const endpoint = import.meta.env.VITE_CONVEX_URL.replace(/\.cloud$/, ".site");
      const response = await fetch(`${endpoint}/api/inventory/invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "X-Filename": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = (await response.json()) as {
        sourceId?: Id<"inventorySources">;
        error?: string;
      };
      if (!response.ok || !result.sourceId)
        throw new Error(result.error ?? "Upload didn’t finish. Try again.");
      update({ sourceId: result.sourceId, itemName: "", productIndex: 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload didn’t finish. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function next(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const fields = [
      "companyName",
      "shippingAddress",
      "itemName",
      "unit",
      "quantity",
      "dailyUsage",
    ] as const;
    const field = fields[draft.step];
    if (
      (field && !(field === "quantity" || field === "dailyUsage")) ||
      (field && draft[field].trim())
    ) {
      if (field) {
        const message = setupFieldError(field, draft[field]);
        if (message) {
          setError(message);
          return;
        }
      }
    }
    if (draft.step < 6) {
      update({ step: draft.step + 1 });
      return;
    }
    setBusy(true);
    try {
      await complete({
        companyName: draft.companyName,
        shippingAddress: draft.shippingAddress,
        itemName: draft.itemName,
        quantity: draft.quantity,
        dailyUsage: draft.dailyUsage,
        unit: draft.unit,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(draft.sourceId ? { sourceId: draft.sourceId, productIndex: draft.productIndex } : {}),
      });
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch {
        /* The saved workspace does not depend on browser storage. */
      }
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  const product = source?.products?.[draft.productIndex];
  const reading = source?.status === "reading" || source?.status === "uploading";
  const receipt = (
    <>
      <div className="bh-setup-receipt-section">
        <span className="bh-setup-receipt-label">ACCOUNT</span>
        <p>
          <Check size={13} /> Signed in
        </p>
      </div>
      <div className="bh-setup-receipt-section">
        <span className="bh-setup-receipt-label">COMPANY</span>
        <button type="button" onClick={() => update({ step: 0 })}>
          {draft.companyName || "Your company"}
        </button>
        <button
          className="bh-setup-receipt-address"
          type="button"
          onClick={() => update({ step: 1 })}
        >
          {draft.shippingAddress || "Delivery address to follow"}
        </button>
      </div>
      <div className="bh-setup-receipt-section">
        <span className="bh-setup-receipt-label">FIRST ESSENTIAL</span>
        <p>{draft.itemName || "A product link or invoice"}</p>
        {product?.supplier ? <p>From {product.supplier}</p> : null}
        <p className="bh-setup-receipt-note">
          {product?.leadTimeDays != null
            ? `${product.leadTimeDays} days to deliver · from source`
            : "Delivery time: to be confirmed"}
        </p>
        <p className="bh-setup-receipt-note">Reserve: 3 days · adjustable in your desk</p>
      </div>
    </>
  );
  if (draft.step === 2 && !manual) {
    return (
      <SetupFrame chapter="First inventory item" step="03 / 07" progress={30} receipt={receipt}>
        <div className="bh-setup-form">
          <div className="bh-setup-question bh-setup-enter">
            <p className="bh-setup-eyebrow">GIVE YOUR BUYER A STARTING POINT</p>
            <h1>
              Where do you
              <br />
              buy it from?
            </h1>
            <p>
              Drop in a product link or an invoice. Your buyer will read the details and flag
              anything it still needs.
            </p>
            {draft.sourceId ? (
              <div className="bh-source-results" aria-live="polite">
                {source === undefined || reading ? (
                  <div className="bh-source-reading">
                    <LoaderCircle />
                    <strong>
                      Reading your {source?.kind === "invoice" ? "invoice" : "product page"}…
                    </strong>
                    <p>
                      Looking for the item, supplier, pack size, and delivery terms. You can leave
                      and come back.
                    </p>
                  </div>
                ) : source?.status === "ready" && source.products?.length ? (
                  <>
                    <span className="bh-setup-eyebrow">
                      {source.products.length === 1
                        ? "IS THIS YOUR ITEM?"
                        : "CHOOSE YOUR FIRST ITEM"}
                    </span>
                    {source.products.map((p, i) => (
                      <button
                        type="button"
                        className="bh-source-product"
                        key={`${p.name}-${i}`}
                        onClick={() =>
                          update({
                            productIndex: i,
                            itemName: p.name,
                            unit: units.includes(p.unit as InventoryUnit)
                              ? (p.unit as InventoryUnit)
                              : "units",
                            step: 3,
                          })
                        }
                      >
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {p.supplier ?? "Supplier not found"}
                            {p.sku ? ` · ${p.sku}` : ""}
                          </small>
                          {p.packSize !== null ? (
                            <small>{p.packSize.toLocaleString()} units per pack</small>
                          ) : null}
                          <small>
                            {p.leadTimeDays === null
                              ? "Delivery time still needs confirming"
                              : `${p.leadTimeDays} days to deliver`}
                          </small>
                        </span>
                        <ArrowRight />
                      </button>
                    ))}
                  </>
                ) : (
                  <p role="alert">{source?.message ?? "That source is no longer available."}</p>
                )}
                {!reading && source !== undefined ? (
                  <button
                    className="bh-source-text-button"
                    onClick={() => update({ sourceId: null, itemName: "" })}
                  >
                    Try another source
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <fieldset className="bh-source-method">
                  <legend className="sr-only">Add an inventory source</legend>
                  <button
                    type="button"
                    aria-pressed={method === "link"}
                    onClick={() => setMethod("link")}
                  >
                    <Link2 />
                    Product link
                  </button>
                  <button
                    type="button"
                    aria-pressed={method === "invoice"}
                    onClick={() => setMethod("invoice")}
                  >
                    <FileText />
                    Invoice
                  </button>
                </fieldset>
                {method === "link" ? (
                  <form onSubmit={importLink}>
                    <label htmlFor="product-url" className="sr-only">
                      Product page link
                    </label>
                    <input
                      id="product-url"
                      type="url"
                      className="bh-setup-input bh-source-url"
                      placeholder="https://supplier.com/product"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      required
                      maxLength={2000}
                      ref={focus}
                      disabled={busy}
                    />
                    <button className="bh-setup-primary" disabled={busy}>
                      {busy ? "Opening source…" : "Read product page"}
                      <ArrowRight />
                    </button>
                  </form>
                ) : (
                  <label className="bh-source-upload">
                    <Upload />
                    <strong>{busy ? "Uploading invoice…" : "Choose an invoice"}</strong>
                    <span>PDF, PNG, or JPG · up to 8 MB</span>
                    <input
                      type="file"
                      accept="application/pdf,image/png,image/jpeg"
                      aria-label="Upload invoice"
                      disabled={busy}
                      onChange={(e) => void upload(e.target.files?.[0])}
                    />
                  </label>
                )}
                <p className="bh-setup-receipt-note">
                  Product pages are read with Firecrawl. Invoice contents are processed to extract
                  items for your private workspace.
                </p>
              </>
            )}
            <p className="bh-setup-error" role="alert">
              {error}
            </p>
          </div>
          <div className="bh-setup-controls">
            <button
              type="button"
              className="bh-setup-back"
              aria-label="Previous question"
              onClick={() => update({ step: 1 })}
              disabled={busy}
            >
              <ArrowLeft />
            </button>
            {!reading ? (
              <button
                className="bh-source-text-button"
                type="button"
                onClick={() => {
                  update({ sourceId: null });
                  setManual(true);
                }}
              >
                I’ll add the item myself
              </button>
            ) : null}
          </div>
        </div>
      </SetupFrame>
    );
  }
  const screens = [
    {
      title: "Who are we buying for?",
      hint: "The company name that goes on your workspace and purchase orders.",
      field: "companyName",
    },
    {
      title: "Where should it all arrive?",
      hint: "Your full delivery address, including the country.",
      field: "shippingAddress",
    },
    {
      title: "What’s the first essential?",
      hint: "Just the item name. You can fill in supplier details from your desk.",
      field: "itemName",
    },
    {
      title: "How do you count it?",
      hint: "Confirm the unit you use for stock and daily usage. An invoice’s ordered quantity is not your current stock.",
      field: "unit",
    },
    {
      title: "How much is on the shelf?",
      hint: `Your current stock in ${draft.unit}. If you don’t know yet, leave it blank.`,
      field: "quantity",
    },
    {
      title: "How much do you use a day?",
      hint: `An estimate in ${draft.unit} is fine. Leave it blank to confirm from your desk later.`,
      field: "dailyUsage",
    },
    {
      title: "Your desk. Ready to go.",
      hint: "Your company and first item will be saved. Anything missing goes to Needs your input.",
      field: null,
    },
  ] as const;
  const screen = screens[draft.step];
  const field = screen.field;
  return (
    <SetupFrame
      chapter={
        draft.step < 2
          ? "Your company"
          : draft.step === 6
            ? "Ready for a first look"
            : "First inventory item"
      }
      step={`${String(draft.step + 1).padStart(2, "0")} / 07`}
      progress={(draft.step / 7) * 100}
      receipt={receipt}
    >
      <form className="bh-setup-form" onSubmit={next}>
        <div className="bh-setup-question bh-setup-enter" key={draft.step}>
          <p className="bh-setup-eyebrow">
            {draft.step === 6 ? "LESS CHASING STARTS HERE" : "YOUR ACCOUNT IS READY"}
          </p>
          <h1>
            <label htmlFor="source-answer">{screen.title}</label>
          </h1>
          <p>{screen.hint}</p>
          {field === "shippingAddress" ? (
            <textarea
              id="source-answer"
              className="bh-setup-input bh-setup-address"
              value={draft[field]}
              onChange={(e) => update({ [field]: e.target.value })}
              maxLength={500}
              rows={3}
              placeholder={"Street address\nCity, region, postal code\nCountry"}
              ref={focus}
              required
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
          ) : field === "unit" ? (
            <fieldset className="bh-setup-unit-options">
              <legend className="sr-only">Counting unit</legend>
              {units.map((unit) => (
                <label key={unit} data-selected={draft.unit === unit}>
                  <input
                    type="radio"
                    name="unit"
                    checked={draft.unit === unit}
                    onChange={() => update({ unit })}
                  />
                  <span>{unit}</span>
                  {draft.unit === unit ? <Check /> : null}
                </label>
              ))}
            </fieldset>
          ) : field ? (
            <input
              id="source-answer"
              className="bh-setup-input"
              type={field === "quantity" || field === "dailyUsage" ? "number" : "text"}
              value={draft[field]}
              onChange={(e) => update({ [field]: e.target.value })}
              min={0}
              max={1_000_000_000}
              step="any"
              maxLength={120}
              placeholder={
                field === "companyName"
                  ? "Company name"
                  : field === "itemName"
                    ? "e.g. 16 oz deli lids"
                    : "Unknown for now"
              }
              ref={focus}
              required={field !== "quantity" && field !== "dailyUsage"}
            />
          ) : (
            <div className="bh-setup-review">
              <p>
                <Check />
                {draft.companyName}
              </p>
              <p>
                <Check />
                {draft.itemName}
              </p>
              <p>
                <Check />
                {product?.supplier ?? "Supplier: needs your input"}
              </p>
              <p className="bh-setup-review-note">
                You approve purchases. Nothing is ordered during setup.
              </p>
            </div>
          )}
          <p className="bh-setup-error" role="alert">
            {error}
          </p>
        </div>
        <div className="bh-setup-controls">
          <button
            type="button"
            className="bh-setup-back"
            disabled={draft.step === 0 || busy}
            aria-label="Previous question"
            onClick={() => {
              if (draft.step === 3) setManual(false);
              update({ step: draft.step - 1 });
            }}
          >
            <ArrowLeft />
          </button>
          <button className="bh-setup-primary" disabled={busy}>
            {busy
              ? "Saving your desk…"
              : draft.step === 6
                ? "Create my buy desk"
                : (field === "quantity" || field === "dailyUsage") && !draft[field]
                  ? "Confirm later"
                  : "Continue"}
            <ArrowRight />
          </button>
          <span className="bh-setup-key">
            press <kbd>Enter ↵</kbd>
          </span>
        </div>
        <p className="bh-setup-account-switch">
          {field === "shippingAddress"
            ? "Shift + Enter for a new line"
            : "Your progress is saved in this browser."}
        </p>
      </form>
    </SetupFrame>
  );
}
