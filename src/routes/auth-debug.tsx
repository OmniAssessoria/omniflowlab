import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { probeServerAuth } from "@/lib/auth-debug.functions";

export const Route = createFileRoute("/auth-debug")({
  ssr: false,
  component: AuthDebugPage,
});

type Snapshot = {
  at: string;
  href: string;
  hostname: string;
  providerLoading: boolean;
  providerUser: string | null;
  providerProfile: string | null;
  providerRole: string | null;
  sessionUser: string | null;
  sessionExpiresAt: number | null;
  storagePresent: boolean;
  profileQuery: string;
  roleQuery: string;
  serverAuth: string;
};

function AuthDebugPage() {
  const { user, profile, primaryRole, loading } = useAuth();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const storageKey = "omni-flow-jgruz-auth-v2";
  const runServerProbe = useServerFn(probeServerAuth);

  const provider = useMemo(() => ({ user, profile, primaryRole, loading }), [user, profile, primaryRole, loading]);

  useEffect(() => {
    let active = true;

    async function collect() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      let profileQuery = "not-run";
      let roleQuery = "not-run";
      let serverAuth = "not-run";

      if (sessionUser) {
        const [prof, roles] = await Promise.all([
          supabase.from("profiles").select("id, email, ativo, must_change_password").eq("id", sessionUser.id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", sessionUser.id),
        ]);
        profileQuery = prof.error ? `ERROR: ${prof.error.message}` : `OK: ${prof.data ? "1 row" : "0 rows"}`;
        roleQuery = roles.error ? `ERROR: ${roles.error.message}` : `OK: ${(roles.data ?? []).map(r => r.role).join(",") || "0 rows"}`;

        try {
          const probe = await runServerProbe();
          serverAuth = probe?.ok ? `OK: userId=${probe.userId}` : `ERROR: sem userId`;
        } catch (error) {
          serverAuth = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      if (!active) return;
      setSnapshot({
        at: new Date().toISOString(),
        href: window.location.href,
        hostname: window.location.hostname,
        providerLoading: provider.loading,
        providerUser: provider.user?.email ?? null,
        providerProfile: provider.profile?.email ?? null,
        providerRole: provider.primaryRole,
        sessionUser: sessionError ? `ERROR: ${sessionError.message}` : (sessionUser?.email ?? null),
        sessionExpiresAt: sessionData.session?.expires_at ?? null,
        storagePresent: window.localStorage.getItem(storageKey) !== null,
        profileQuery,
        roleQuery,
        serverAuth,
      });
    }

    collect();
    const timer = window.setInterval(collect, 1500);
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setEvents(prev => [`${new Date().toLocaleTimeString()} ${event} user=${session?.user?.email ?? "null"}`, ...prev].slice(0, 12));
    });

    return () => {
      active = false;
      window.clearInterval(timer);
      sub.subscription.unsubscribe();
    };
  }, [provider, runServerProbe]);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Diagnóstico de autenticação</h1>
          <p className="text-sm text-muted-foreground">Página temporária. Não exibe senha nem token.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-2">
          {!snapshot ? <div>Coletando estado...</div> : <>
            <Row label="Atualizado" value={snapshot.at} />
            <Row label="Host" value={snapshot.hostname} />
            <Row label="URL" value={snapshot.href} />
            <Row label="AuthProvider loading" value={String(snapshot.providerLoading)} />
            <Row label="AuthProvider user" value={snapshot.providerUser ?? "null"} />
            <Row label="AuthProvider profile" value={snapshot.providerProfile ?? "null"} />
            <Row label="AuthProvider role" value={snapshot.providerRole ?? "null"} />
            <Row label="getSession user" value={snapshot.sessionUser ?? "null"} />
            <Row label="Sessão expira em" value={snapshot.sessionExpiresAt ? new Date(snapshot.sessionExpiresAt * 1000).toISOString() : "null"} />
            <Row label="Storage novo presente" value={String(snapshot.storagePresent)} />
            <Row label="Consulta profile" value={snapshot.profileQuery} />
            <Row label="Consulta role" value={snapshot.roleQuery} />
            <Row label="Auth server-side" value={snapshot.serverAuth} />
          </>}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold mb-2">Eventos recentes do Auth</div>
          <div className="font-mono text-xs space-y-1">
            {events.length === 0 ? <div className="text-muted-foreground">Nenhum evento capturado ainda.</div> : events.map((e, i) => <div key={i}>{e}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[190px_1fr] gap-3"><div className="text-muted-foreground">{label}</div><div className="font-mono break-all">{value}</div></div>;
}
