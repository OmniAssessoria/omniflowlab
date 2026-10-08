import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shell")({
  ssr: false,
  component: ProtectedShell,
});

function ProtectedShell() {
  const { user, profile, primaryRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-omni" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (primaryRole === "telespectador") {
    return <Navigate to="/tv" replace />;
  }

  if (profile?.must_change_password) {
    return <Navigate to="/auth/nova-senha" replace />;
  }

  return <AppShell />;
}
