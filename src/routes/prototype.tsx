import { createFileRoute } from "@tanstack/react-router";

import { BuyHardPrototype } from "@/components/buy-hard/buy-hard-prototype";

export const Route = createFileRoute("/prototype")({
  component: BuyHardPrototype,
});
