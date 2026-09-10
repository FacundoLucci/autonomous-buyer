import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OutLink } from "./primitives";
import { errorText } from "./model";

const starters = [
  { name: "Amazon", url: "https://www.amazon.com" },
  { name: "WebstaurantStore", url: "https://www.webstaurantstore.com" },
];
const methods = {
  unknown: "Ordering method not checked",
  browser: "Browser only",
  email: "Email only",
  both: "Browser and email",
};

export function SupplierDirectory() {
  const websiteId = useId();
  const suppliers = useQuery(api.companySuppliers.list, {});
  const add = useMutation(api.companySuppliers.add);
  const update = useMutation(api.companySuppliers.update);
  const reassess = useMutation(api.companySuppliers.reassess);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(job: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await job();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="desk-settings-section desk-suppliers" aria-label="Supplier directory">
      <h2>Suppliers</h2>
      <p className="desk-muted">
        Add any buying website. The agent checks how to order, whether email purchase orders are
        accepted, and what setup is needed. Methods are based on what the agent can verify. Each
        purchase still needs your approval.
      </p>
      <p className="desk-muted">
        <a className="desk-text-link" href="/landing#tested-merchants">
          See merchants we’ve ordered from
        </a>
      </p>
      <form
        className="desk-supplier-add"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await add({ url: url.trim() });
            setUrl("");
          });
        }}
      >
        <label htmlFor={websiteId}>Buying website</label>
        <div>
          <Input
            id={websiteId}
            placeholder="supplier.com"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
            maxLength={2000}
          />
          <Button disabled={busy || !url.trim()} type="submit">
            Add and assess
          </Button>
        </div>
      </form>
      <div className="desk-supplier-actions">
        {starters
          .filter(
            (starter) =>
              !suppliers?.some(
                (s) => s.domain === new URL(starter.url).hostname.replace(/^www\./, ""),
              ),
          )
          .map((starter) => (
            <Button
              key={starter.name}
              variant="outline"
              disabled={busy || suppliers === undefined}
              onClick={() => void run(() => add(starter))}
            >
              Add {starter.name}
            </Button>
          ))}
      </div>
      {error && (
        <p className="desk-error" role="alert">
          {error}
        </p>
      )}
      {suppliers === undefined ? (
        <output>Loading suppliers…</output>
      ) : suppliers.length === 0 ? (
        <p className="desk-muted">
          No suppliers added yet. Start with a suggestion or enter a website.
        </p>
      ) : (
        suppliers.map((supplier) => (
          <SupplierRow
            key={supplier._id}
            supplier={supplier}
            busy={busy}
            save={(changes) => run(() => update({ supplierId: supplier._id, ...changes }))}
            assess={() => void run(() => reassess({ supplierId: supplier._id }))}
          />
        ))
      )}
    </section>
  );
}

function SupplierRow({
  supplier,
  busy,
  save,
  assess,
}: {
  supplier: Doc<"companySuppliers">;
  busy: boolean;
  save: (changes: { approved?: boolean; notes?: string }) => Promise<void>;
  assess: () => void;
}) {
  const notesId = useId();
  const [notes, setNotes] = useState<string | null>(null);
  const assessing =
    supplier.assessmentState === "pending" || supplier.assessmentState === "analyzing";
  return (
    <article className="desk-supplier-row">
      <div className="desk-section-heading">
        <h3>
          <OutLink href={supplier.url}>{supplier.name}</OutLink>
        </h3>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void save({ approved: !supplier.approved })}
        >
          {supplier.approved ? "Pause supplier" : "Approve supplier"}
        </Button>
      </div>
      <p>
        {supplier.approved ? "Approved for your company" : "Paused for new purchases"} ·{" "}
        {methods[supplier.channels]}
      </p>
      <p className="desk-muted" role={assessing ? "status" : undefined}>
        {assessing
          ? "The agent is checking ordering instructions…"
          : supplier.assessmentState === "needs_help"
            ? "Assessment needs attention"
            : supplier.readiness === "ready"
              ? "Ordering ready"
              : supplier.readiness === "needs_setup"
                ? "Ordering method found; checkout not yet tested"
                : "Ordering not yet tested"}
      </p>
      {supplier.assessmentNotes && <p>{supplier.assessmentNotes}</p>}
      {supplier.email && <p className="desk-muted">Ordering email: {supplier.email}</p>}
      {supplier.checkedAt && (
        <p className="desk-muted">
          Last checked {new Date(supplier.checkedAt).toLocaleDateString()}
        </p>
      )}
      <details>
        <summary>Special notes and sources</summary>
        <label htmlFor={notesId}>Your supplier notes</label>
        <textarea
          id={notesId}
          rows={3}
          maxLength={2000}
          placeholder="Account requirements, delivery instructions, minimum orders…"
          value={notes ?? supplier.notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={busy || notes === null || notes === supplier.notes}
          onClick={() => void save({ notes: notes ?? supplier.notes })}
        >
          Save notes
        </Button>
        {supplier.evidence?.map((source, index) => (
          <blockquote key={`${source.url}-${index}`}>
            <p>{source.excerpt}</p>
            <OutLink href={source.url}>Source</OutLink>
          </blockquote>
        ))}
      </details>
      <Button variant="ghost" disabled={busy || assessing} onClick={assess}>
        Check website again
      </Button>
    </article>
  );
}

export function DemoSupplierDirectory() {
  return (
    <section
      className="desk-settings-section desk-suppliers"
      aria-label="Sample supplier directory"
    >
      <h2>Suppliers</h2>
      <p className="desk-muted">
        Add any buying website in your workspace. The agent assesses ordering methods and setup
        requirements.
      </p>
      {starters.map((supplier) => (
        <article className="desk-supplier-row" key={supplier.url}>
          <h3>
            <OutLink href={supplier.url}>{supplier.name}</OutLink>
          </h3>
          <p>Suggested supplier · Ordering not yet verified</p>
        </article>
      ))}
      <p className="desk-muted">
        Sample directory. No supplier websites have been assessed in this demo.
      </p>
    </section>
  );
}
