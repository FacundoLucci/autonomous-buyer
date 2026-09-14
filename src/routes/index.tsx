import { createFileRoute } from "@tanstack/react-router";
import { DeskHome, type SearchState } from "@/components/desk/app";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): SearchState => ({
    demo: s.demo === true || s.demo === "true" || s.demo === "1" || s.demo === 1,
    page:
      s.page === "inventory" ||
      s.page === "buys" ||
      s.page === "settings" ||
      s.page === "audit" ||
      s.page === "connections"
        ? s.page
        : ("dashboard" as "dashboard" | "inventory" | "buys" | "settings" | "audit"),
    item: typeof s.item === "string" ? s.item : undefined,
    sales: s.sales === "connected" || s.sales === "retry" ? s.sales : undefined,
    buy:
      typeof s.buy === "string"
        ? s.buy
        : typeof s.companyOrder === "string"
          ? s.companyOrder
          : undefined,
  }),
  head: () => ({ meta: [{ title: "BUY HARD — Keep the line moving." }] }),
  component: Home,
});
function Home() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DeskHome
      search={search}
      navigate={(next) =>
        void navigate({ to: "/", search: { ...next, item: next.item, buy: next.buy } })
      }
    />
  );
}
