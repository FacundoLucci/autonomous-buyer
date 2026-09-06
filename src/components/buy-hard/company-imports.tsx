import { useState, type FormEvent } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useAuthActions } from "@/lib/buyer-auth";
import { fileMime, sourceAccept } from "@/lib/company-files";
import { units } from "@/lib/setup-fields";
import { setupError } from "./setup";
import { FileText, Link2, Plus, Upload } from "lucide-react";

export function CompanyImports() {
  const {
    results: sources,
    status,
    loadMore,
  } = usePaginatedQuery(api.companyInventory.sourcePage, {}, { initialNumItems: 20 });
  const startLink = useMutation(api.inventorySources.startLink);
  const addItem = useMutation(api.companyInventory.addItem);
  const { token } = useAuthActions();
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function links(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const links = urls
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!links.length || links.length > 10)
        throw new Error("Paste 1 to 10 product links, one per line.");
      let done = 0;
      const failed: string[] = [],
        failures: string[] = [];
      for (const url of links) {
        try {
          await startLink({ url });
          done++;
        } catch (cause) {
          failed.push(url);
          failures.push(`${url}: ${setupError(cause)}`);
        }
        setMessage(`Reading ${done} of ${links.length} product links…`);
      }
      setUrls(failed.join("\n"));
      setError(failures.join("\n"));
      setMessage(`${done} of ${links.length} links saved. Review the extracted products below.`);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  async function files(files: File[]) {
    setError("");
    setMessage("");
    if (!files.length) return;
    if (files.length > 10) {
      setError("Choose up to 10 files at a time.");
      return;
    }
    setBusy(true);
    let done = 0;
    const failures: string[] = [];
    for (const file of files) {
      try {
        const mime = fileMime(file.name);
        if (!mime || file.size === 0 || file.size > 8 * 1024 * 1024)
          throw new Error("Use a supported file under 8 MB.");
        const endpoint =
          import.meta.env.VITE_CONVEX_SITE_URL ??
          import.meta.env.VITE_CONVEX_URL.replace(/\.cloud$/, ".site");
        const response = await fetch(`${endpoint}/api/inventory/invoice`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": mime,
            "X-Filename": encodeURIComponent(file.name),
          },
          body: file,
        });
        const result = (await response.json()) as {
          sourceId?: Id<"inventorySources">;
          error?: string;
        };
        if (!response.ok || !result.sourceId) throw new Error(result.error ?? "Upload failed.");
        done++;
      } catch (cause) {
        failures.push(`${file.name}: ${setupError(cause)}`);
      }
      setMessage(`${done} of ${files.length} files saved. Reading products…`);
    }
    setError(failures.join("\n"));
    setBusy(false);
  }
  async function manual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await addItem({
        name: String(data.get("name")),
        sku: String(data.get("sku")),
        unit: String(data.get("unit")),
        supplier: String(data.get("supplier")),
        buyUrl: String(data.get("buyUrl")),
      });
      form.reset();
      setMessage("Item added. Record your stock count and daily use in Inventory.");
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="company-tools bh-eink bh-cutout" aria-label="Add items and files">
      <div className="company-inventory-intro">
        <h2>Add items, links & files</h2>
        <p>
          Bring your invoices, product pages, or inventory lists. Review the items before adding
          them to stock.
        </p>
      </div>
      <div className="company-tool-body">
        <form className="company-form" onSubmit={links}>
          <label htmlFor="company-links">
            <Link2 /> Product links · one per line
          </label>
          <textarea
            id="company-links"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder="https://supplier.com/product"
            rows={3}
            required
            disabled={busy}
          />
          <button className="company-primary" disabled={busy || !urls.trim()}>
            {busy ? "Working…" : "Read product links"}
          </button>
        </form>
        <div className="company-file-upload">
          <label htmlFor="company-files">
            <Upload /> Add invoices or files
          </label>
          <input
            id="company-files"
            type="file"
            accept={sourceAccept}
            multiple
            disabled={busy}
            onChange={(e) => {
              void files(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <p>
            PDF, JPG, PNG, CSV, TXT, XLSX, DOCX · 8 MB each · up to 10 files at once. Files stay in
            your private workspace.
          </p>
        </div>
        <details>
          <summary>
            <Plus /> Add an item by hand
          </summary>
          <form className="company-form" onSubmit={manual}>
            <label>
              Item name
              <input name="name" required maxLength={120} />
            </label>
            <div className="company-form-row">
              <label>
                Item code
                <input name="sku" required maxLength={64} />
              </label>
              <label>
                Stock unit
                <select name="unit">
                  {units.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Supplier
              <input name="supplier" maxLength={120} />
            </label>
            <label>
              Buy link
              <input name="buyUrl" type="url" placeholder="https://" />
            </label>
            <button disabled={busy} className="company-primary">
              Add item
            </button>
          </form>
        </details>
        <output>{message}</output>
        <p role="alert" className="company-error">
          {error}
        </p>
      </div>
      <div className="company-source-library">
        <h3>
          <FileText /> Saved sources
        </h3>
        {status === "LoadingFirstPage" ? (
          <p>Loading files…</p>
        ) : sources.length === 0 ? (
          <p>Your saved links and files will appear here.</p>
        ) : (
          sources.map((source) => <SourceCard key={source._id} source={source} />)
        )}
        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <button disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>
            Load older sources
          </button>
        ) : null}
      </div>
      <ArchivedItems />
    </section>
  );
}

function ArchivedItems() {
  const [open, setOpen] = useState(false);
  const { results, status, loadMore } = usePaginatedQuery(
    api.companyInventory.archivedItems,
    open ? {} : "skip",
    { initialNumItems: 20 },
  );
  const restore = useMutation(api.companyInventory.archiveItem);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function restoreItem(itemId: Id<"inventoryItems">) {
    setBusy(true);
    setError("");
    try {
      await restore({ itemId, archived: false });
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="company-tool-body" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Archived items</summary>
      <p>Up to 100 active items. Archiving keeps your files and purchase history.</p>
      {open && status === "LoadingFirstPage" ? (
        <p>Loading…</p>
      ) : results.length === 0 ? (
        <p>No archived items.</p>
      ) : (
        results.map((item) => (
          <div className="company-button-row" key={item._id}>
            <span>
              {item.name} · {item.sku}
            </span>
            <button disabled={busy} onClick={() => void restoreItem(item._id)}>
              Restore {item.name}
            </button>
          </div>
        ))
      )}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <button disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>
          Load more archived items
        </button>
      ) : null}
      <p role="alert" className="company-error">
        {error}
      </p>
    </details>
  );
}

function SourceCard({ source }: { source: Doc<"inventorySources"> }) {
  const add = useMutation(api.companyInventory.importProducts);
  const fileUrl = useQuery(
    api.companyInventory.sourceFile,
    source.fileId ? { sourceId: source._id } : "skip",
  );
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function importItems(indices: number[]) {
    setBusy(true);
    setError("");
    try {
      const ids = await add({ sourceId: source._id, indices });
      setMessage(
        `${ids.length} item${ids.length === 1 ? "" : "s"} in inventory. Repeating this import keeps the same items.`,
      );
      setSelected([]);
    } catch (cause) {
      setError(setupError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="company-source-card"
      open={source.status === "reading" || source.status === "uploading" ? true : undefined}
    >
      <summary>
        <span>{source.filename ?? source.url ?? "Source"}</span>
        <small>
          {source.status === "ready"
            ? `${source.products?.length ?? 0} product${source.products?.length === 1 ? "" : "s"}`
            : source.status === "failed"
              ? "Needs attention"
              : "Reading…"}
        </small>
      </summary>
      {source.url || fileUrl ? (
        <a href={source.url ?? fileUrl ?? undefined} target="_blank" rel="noreferrer">
          Open original ↗
        </a>
      ) : null}
      {source.message ? <p>{source.message}</p> : null}
      {source.status === "ready" && source.products?.length ? (
        <>
          <p>Choose the products to add. Invoice quantities do not change your stock count.</p>
          {source.products.map((p, i) => (
            <label className="company-product-choice" key={i} aria-label={p.name}>
              <input
                type="checkbox"
                checked={selected.includes(i)}
                onChange={(e) =>
                  setSelected(e.target.checked ? [...selected, i] : selected.filter((x) => x !== i))
                }
              />
              <span>
                <strong>{p.name}</strong>
                <small>
                  {p.sku ?? "No item code"} · {p.supplier ?? "Supplier needs confirming"}
                </small>
                <small>{p.evidence}</small>
              </span>
            </label>
          ))}
          <div className="company-button-row">
            <button
              disabled={busy || selected.length === 0}
              onClick={() => void importItems(selected)}
            >
              Add selected ({selected.length})
            </button>
            <button
              disabled={busy}
              onClick={() => void importItems(source.products!.map((_, i) => i))}
            >
              Add all products
            </button>
          </div>
        </>
      ) : null}
      <output>{message}</output>
      <p role="alert" className="company-error">
        {error}
      </p>
    </details>
  );
}
