import { createFileRoute } from "@tanstack/react-router";
import { CommercialPipelinePage } from "@/components/commercial-pipeline";
import type { FunilId } from "@/lib/mock-data";

export const Route = createFileRoute("/_shell/pipeline")({
  validateSearch: (search: Record<string, unknown>) => ({
    funil: search.funil === "suporte" ? "suporte" : undefined,
  }),
  component: PipelineRoute,
});

function PipelineRoute() {
  const { funil } = Route.useSearch();
  return <CommercialPipelinePage initialFunil={funil as FunilId | undefined} />;
}
