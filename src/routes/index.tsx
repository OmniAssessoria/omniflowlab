import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OMNI Flow Lab" },
      { name: "description", content: "Gestão comercial e operacional OMNI Flow Lab." },
      { property: "og:title", content: "OMNI Flow Lab" },
      { property: "og:description", content: "Gestão comercial e operacional OMNI Flow Lab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => (
    <div className="whitespace-pre-wrap p-8 font-mono text-sm">
      {`Leia o arquivo instrucoes.md em anexo e siga as instruções contidas nele.`}
    </div>
  ),
});