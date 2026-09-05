type LinkedBuy = {
  procurement: {
    isOpen?: boolean;
    status: string;
    requiredBy: string;
    code: string;
  } | null;
};

function reviewPriority(status: string) {
  return ["approval_required", "exception", "no_viable_supplier"].includes(status) ? 0 : 1;
}

// The server owns the definition of an open buy, shared with the dashboard metric.
export function getOpenBuys<T extends LinkedBuy>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.procurement?.isOpen === true)
    .sort((first, second) => {
      const a = first.procurement!;
      const b = second.procurement!;
      return (
        reviewPriority(a.status) - reviewPriority(b.status) ||
        a.requiredBy.localeCompare(b.requiredBy) ||
        a.code.localeCompare(b.code)
      );
    });
}
