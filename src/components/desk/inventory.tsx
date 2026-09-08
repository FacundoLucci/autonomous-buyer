import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatingInput } from "./floating-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buyingPriorities, type BuyingPriority } from "@/lib/inventory-planning";
import { errorText, money, type Item } from "./model";
import { Sentence, Fact, units } from "./sentences";
export type ItemRules = {
  buyingPriority: BuyingPriority | null;
  dailyLossCents: number | null;
  lossCurrency: string;
  stockoutImpact: string;
};
export type UpdateCount = (item: Item, count: number, via?: "manual" | "chat") => Promise<void>;
export type UpdateRules = (item: Item, rules: ItemRules) => Promise<void>;
export function StockCount({
  item,
  onSave,
  large = false,
  inline = false,
}: {
  item: Item;
  onSave: UpdateCount;
  large?: boolean;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(item.quantity === null ? "" : String(item.quantity));
          setError(null);
        }
      }}
    >
      <PopoverTrigger
        render={
          <button
            className={`desk-count-button ${large ? "desk-count-large" : ""} ${inline ? "desk-count-inline" : ""}`}
            aria-label={`Update ${item.name} count: ${item.quantity ?? "unknown"} ${item.unit}`}
          />
        }
      >
        {inline ? (
          <span>{item.quantity === null ? "count now" : units(item.quantity, item.unit)}</span>
        ) : (
          <span className="desk-number">
            {item.quantity ?? "Count"}
            <small>{item.unit}</small>
          </span>
        )}
        <Pencil size={13} />
      </PopoverTrigger>
      <PopoverContent align="start" className="desk-count-popover">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!value.trim()) return;
            setBusy(true);
            setError(null);
            try {
              await onSave(item, Number(value));
              setOpen(false);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`count-${item.id}`}>How many {item.unit} are on hand?</label>
          <div>
            <Input
              id={`count-${item.id}`}
              aria-label={`${item.name} on hand`}
              type="number"
              min="0"
              max="1000000000"
              step="any"
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button disabled={busy || !value.trim()} type="submit" aria-label="Save count">
              <Check size={18} />
            </Button>
          </div>
          {error && (
            <p role="alert" className="desk-error">
              {error}
            </p>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}
export function BuyingRules({
  item,
  onSave,
  onChat,
}: {
  item: Item;
  onSave: UpdateRules;
  onChat: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [priority, setPriority] = useState<BuyingPriority | "">(item.buyingPriority ?? ""),
    [loss, setLoss] = useState(
      item.dailyLossCents == null ? "" : String(item.dailyLossCents / 100),
    ),
    [currency, setCurrency] = useState(item.lossCurrency ?? "USD"),
    [impact, setImpact] = useState(item.stockoutImpact ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  function edit() {
    setPriority(item.buyingPriority ?? "");
    setLoss(item.dailyLossCents == null ? "" : String(item.dailyLossCents / 100));
    setCurrency(item.lossCurrency ?? "USD");
    setImpact(item.stockoutImpact ?? "");
    setEditing(true);
    setError(null);
  }
  return (
    <section className="desk-section desk-buying-rules">
      <div className="desk-section-heading">
        <h2>Buying rules</h2>
        {!editing && (
          <div className="desk-answer-actions">
            <Button variant="outline" onClick={onChat}>
              {item.buyingPriority ? "Change this…" : "Set rules…"}
            </Button>
            <Button variant="ghost" onClick={edit}>
              Edit by hand
            </Button>
          </div>
        )}
      </div>
      {editing ? (
        <form
          className="desk-rules-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await onSave(item, {
                buyingPriority: priority || null,
                dailyLossCents: loss.trim() ? Math.round(Number(loss) * 100) : null,
                lossCurrency: currency,
                stockoutImpact: impact.trim(),
              });
              setEditing(false);
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            What matters most
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as BuyingPriority | "")}
            >
              <option value="">Choose</option>
              {Object.entries(buyingPriorities).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loss for each day without it
            <div className="desk-money-input">
              <select
                aria-label="Loss currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {["USD", "CAD", "EUR", "GBP", "AUD", "NZD", "MXN", "ARS"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <Input
                aria-label="Daily loss"
                type="number"
                min="0"
                max="100000000"
                step="0.01"
                value={loss}
                onChange={(e) => setLoss(e.target.value)}
                placeholder="Unknown"
              />
            </div>
          </label>
          <FloatingInput
            id={`impact-${item.id}`}
            label="What stops? (optional)"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            maxLength={500}
          />
          <div className="desk-rule-actions">
            <Button type="submit" disabled={busy}>
              Save rules
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
          {error && (
            <p role="alert" className="desk-error">
              {error}
            </p>
          )}
        </form>
      ) : (
        <>
          <Sentence>
            {item.buyingPriority ? (
              <>
                When buying, <Fact>{buyingPriorities[item.buyingPriority].toLowerCase()}</Fact>.
              </>
            ) : (
              "Tell me whether price or staying in stock matters more."
            )}
          </Sentence>
          {item.dailyLossCents != null && (
            <Sentence>
              A day without this costs about{" "}
              <Fact>{money(item.dailyLossCents, item.lossCurrency)}</Fact>
              {item.stockoutImpact && (
                <>
                  . <Fact>{item.stockoutImpact}</Fact>
                </>
              )}
              .
            </Sentence>
          )}
        </>
      )}
    </section>
  );
}
