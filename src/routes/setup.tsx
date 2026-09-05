import { createFileRoute } from "@tanstack/react-router";
import { Setup } from "@/components/buy-hard/setup";

export const Route = createFileRoute("/setup")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "login" ? ("login" as const) : ("signup" as const),
  }),
  component: SetupRoute,
});

function SetupRoute() {
  return <Setup key={Route.useSearch().mode} mode={Route.useSearch().mode} />;
}
