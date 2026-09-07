import { createFileRoute } from "@tanstack/react-router";

import { AutonomousLanding } from "@/components/landing/autonomous-landing";
import { landingHead } from "@/components/landing/landing-head";

export const Route = createFileRoute("/legacy_/landing")({
  head: landingHead,
  component: AutonomousLanding,
});
