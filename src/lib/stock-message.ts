const words: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
export function reportedStock(text: string, unit: string) {
  const value = text.trim().toLowerCase();
  if (
    /\b(if|would|could|should|suppose|hypothetical|imagine|need|want|target)\b|\?|(?:^|\s)-\d/.test(
      value,
    )
  )
    return null;
  const normalized = value.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,
    (w) => String(words[w]),
  );
  const unitPattern = unit.replace(/[^a-z]/gi, "").replace(/s$/, "") + "s?";
  const after = new RegExp(
    `(?:have|only|count(?:ed)?|stock(?: is| count)?|left(?: with)?|to|remaining)\\s*(?:only\\s*)?[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`,
    "g",
  );
  const before = new RegExp(
    `(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\s*(?:left|remaining|on hand)\\b`,
    "g",
  );
  const bare = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(?:${unitPattern})?[.!]?$`);
  const matches = [
    ...normalized.matchAll(after),
    ...normalized.matchAll(before),
    ...(normalized.match(bare) ? [normalized.match(bare)!] : []),
  ];
  const counts = [...new Set(matches.map((m) => Number(m[1])))];
  return counts.length === 1 && Number.isFinite(counts[0]) && counts[0] <= 1_000_000_000
    ? counts[0]
    : null;
}
export function stockItemMatch<T extends { id: string; name: string; sku?: string }>(
  text: string,
  items: T[],
) {
  const tokens: string[] = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const scored = items
    .map((item) => ({
      item,
      score:
        (item.name.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
          (t) => t.length > 2 && tokens.includes(t),
        ).length + (item.sku && text.toLowerCase().includes(item.sku.toLowerCase()) ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.score && scored[0].score !== scored[1]?.score ? scored[0].item : null;
}
