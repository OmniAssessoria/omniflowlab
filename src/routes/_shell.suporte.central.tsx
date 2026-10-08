import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/suporte/central")({
  beforeLoad: () => {
    throw redirect({ to: "/suporte" });
  },
  component: () => null,
});
