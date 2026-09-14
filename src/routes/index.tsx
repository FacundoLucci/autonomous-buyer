import { campaignKeys, attribution } from "@/lib/marketing";
import { createFileRoute } from "@tanstack/react-router";
import { DeskHome } from "@/components/desk/app";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>) => ({
    ...Object.fromEntries(
      campaignKeys.filter((key) => typeof s[key] === "string").map((key) => [key, s[key]]),
    ),
    demo: s.demo === true || s.demo === "true" || s.demo === "1" || s.demo === 1,
    page:
      s.page === "inventory" || s.page === "buys" || s.page === "settings" || s.page === "audit"
        ? s.page
        : ("dashboard" as "dashboard" | "inventory" | "buys" | "settings" | "audit"),
    item: typeof s.item === "string" ? s.item : undefined,
    buy:
      typeof s.buy === "string"
        ? s.buy
        : typeof s.companyOrder === "string"
          ? s.companyOrder
          : undefined,
  }),
  component: Home,
});
function Home() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <DeskHome
      search={search}
      navigate={(next) =>
        void navigate({
          to: "/",
          search: {
            ...Object.fromEntries(campaignKeys.map((key) => [key, attribution()[key]])),
            ...next,
            item: next.item,
            buy: next.buy,
          },
        })
      }
    />
  );
}
