import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/push-dispatch")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { buildPushPayload } = await import("@block65/webcrypto-web-push");

        const vapid = {
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
          subject: process.env.VAPID_SUBJECT || "mailto:contato@omni.com.br",
        };

        if (!vapid.publicKey || !vapid.privateKey) {
          return Response.json({ ok: false, error: "VAPID keys not configured" }, { status: 500 });
        }

        // Notificações pendentes de push (últimas 30 min, não enviadas, criticidade alta ou tipos relevantes)
        const { data: notifs } = await supabaseAdmin
          .from("notificacoes")
          .select("*")
          .is("push_enviado_em", null)
          .gt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
          .or("criticidade.eq.alta,tipo.in.(sla_estouro,sla_alerta,nova_venda,ticket_novo)")
          .limit(50);

        if (!notifs || notifs.length === 0) {
          return Response.json({ ok: true, sent: 0 });
        }

        const userIds = [...new Set(notifs.map((n) => n.user_id))];
        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions")
          .select("*")
          .in("user_id", userIds);

        let sent = 0;
        const failed: string[] = [];

        for (const n of notifs) {
          const userSubs = (subs ?? []).filter((s) => s.user_id === n.user_id);
          for (const sub of userSubs) {
            try {
              const subscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
                expirationTime: null,
              };
              const message = await buildPushPayload(
                { data: JSON.stringify({ title: n.titulo, body: n.descricao ?? "", link: n.link ?? "/notificacoes", tag: n.id }), options: { ttl: 60 } },
                subscription as any,
                vapid,
              );
              const res = await fetch(sub.endpoint, { ...message, body: new Uint8Array(message.body as Uint8Array).buffer as ArrayBuffer });
              if (res.ok || res.status === 201) {
                sent++;
              } else if (res.status === 404 || res.status === 410) {
                failed.push(sub.endpoint);
              }
            } catch (e) {
              console.error("push send error", e);
            }
          }
          await supabaseAdmin.from("notificacoes").update({ push_enviado_em: new Date().toISOString() }).eq("id", n.id);
        }

        if (failed.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", failed);
        }

        return Response.json({ ok: true, sent, expired: failed.length });
      },
    },
  },
});
