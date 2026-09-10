import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatingInput } from "./floating-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { availableStock, buyingPriorities, type BuyingPriority } from "@/lib/inventory-planning";
import { useClock } from "@/lib/use-clock";
import { errorText, money, type Item } from "./model";
import { Sentence, Fact, units } from "./sentences";
export type ItemRules = {
  buyingPriority: BuyingPriority | null;
  dailyLossCents: number | null;
  lossCurrency: string;
  stockoutImpact: string;
  safetyStockDays?: number;
  preferredCoverageDays?: number;
  preparationDays?: number;
  orderMultiple?: number;
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
  const estimated = availableStock(item, useClock());
  const displayed = estimated === null ? null : Math.round(estimated * 10) / 10;
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
            aria-label={`Update ${item.name} count: estimated ${displayed ?? "unknown"} ${item.unit}`}
          />
        }
      >
        {inline ? (
          <span>{displayed === null ? "count now" : units(displayed, item.unit)}</span>
        ) : (
          <span className="desk-number">
            {displayed ?? "Count"}
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
    [reserve, setReserve] = useState(item.safetyStockDays ?? 3),
    [coverage, setCoverage] = useState(item.coverageDays ?? 30),
    [preparation, setPreparation] = useState(item.preparationDays ?? 1),
    [pack, setPack] = useState(item.orderMultiple ?? 1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  function edit() {
    setPriority(item.buyingPriority ?? "");
    setLoss(item.dailyLossCents == null ? "" : String(item.dailyLossCents / 100));
    setCurrency(item.lossCurrency ?? "USD");
    setImpact(item.stockoutImpact ?? "");
    setReserve(item.safetyStockDays ?? 3);
    setCoverage(item.coverageDays ?? 30);
    setPreparation(item.preparationDays ?? 1);
    setPack(item.orderMultiple ?? 1);
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
                safetyStockDays: reserve,
                preferredCoverageDays: coverage,
                preparationDays: preparation,
                orderMultiple: pack,
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
          <label htmlFor={`reserve-${item.id}`}>
            Keep this many days in reserve
            <Input
              id={`reserve-${item.id}`}
              type="number"
              min="0"
              max="365"
              step="any"
              required
              value={reserve}
              onChange={(e) => setReserve(Number(e.target.value))}
            />
          </label>
          <label htmlFor={`coverage-${item.id}`}>
            Refill to this many days of supply, including reserve
            <Input
              id={`coverage-${item.id}`}
              type="number"
              min="1"
              max="365"
              step="any"
              required
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
            />
          </label>
          <label htmlFor={`preparation-${item.id}`}>
            Days allowed for research and approval
            <Input
              id={`preparation-${item.id}`}
              type="number"
              min="0"
              max="30"
              step="any"
              required
              value={preparation}
              onChange={(e) => setPreparation(Number(e.target.value))}
            />
          </label>
          <label htmlFor={`multiple-${item.id}`}>
            Order in multiples of ({item.unit})
            <Input
              id={`multiple-${item.id}`}
              type="number"
              min="1"
              max="1000000"
              step="1"
              required
              value={pack}
              onChange={(e) => setPack(Number(e.target.value))}
            />
          </label>
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
            Keep <Fact>{item.safetyStockDays ?? 3} days</Fact> in reserve and refill to{" "}
            <Fact>{item.coverageDays ?? 30} days</Fact> of supply.
          </Sentence>
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
