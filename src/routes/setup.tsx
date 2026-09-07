import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "@/components/desk/auth";
export const Route = createFileRoute("/setup")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "login" ? ("login" as const) : ("signup" as const),
  }),
  component: () => <AccountPage mode={Route.useSearch().mode} />,
});
