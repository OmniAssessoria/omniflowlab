import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/sla-check")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("run_sla_check");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, result: data, ranAt: new Date().toISOString() }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () => new Response(JSON.stringify({ ok: true, info: "SLA check endpoint" }), {
        headers: { "Content-Type": "application/json" },
      }),
    },
  },
});
