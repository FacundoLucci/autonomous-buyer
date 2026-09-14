import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/legacy_/setup")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "login" ? ("login" as const) : ("signup" as const),
  }),
  component: SetupRoute,
});

function SetupRoute() {
  return <Navigate to="/setup" search={{ mode: Route.useSearch().mode }} replace />;
}
