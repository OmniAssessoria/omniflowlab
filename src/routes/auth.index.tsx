import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo, type BrandId } from "@/components/brand-logo";
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { landingForRole } from "@/lib/permissions";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const { user, primaryRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-omni" />
      </div>
    );
  }

  if (user) return <Navigate to={landingForRole(primaryRole)} />;
  return <AuthForm />;
}

const heroBrands: Array<{
  brand: BrandId;
  className: string;
  logoClassName: string;
}> = [
  { brand: "TAKE_FLOW", className: "auth-exact-brand-take", logoClassName: "h-[36%] max-w-[72%]" },
  { brand: "CLARO", className: "auth-exact-brand-claro", logoClassName: "h-[62%] max-w-[68%]" },
  { brand: "ONVOX", className: "auth-exact-brand-onvox", logoClassName: "h-[40%] max-w-[76%]" },
  { brand: "VIVO", className: "auth-exact-brand-vivo", logoClassName: "h-[38%] max-w-[68%]" },
];

function AuthForm() {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const brandRefs = useRef<Array<HTMLDivElement | null>>([]);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const root = event.currentTarget.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (event.clientX - root.left) / root.width));
    const py = Math.min(1, Math.max(0, (event.clientY - root.top) / root.height));

    event.currentTarget.style.setProperty("--pointer-x", `${px * 100}%`);
    event.currentTarget.style.setProperty("--pointer-y", `${py * 100}%`);

    brandRefs.current.forEach((card, index) => {
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.hypot(dx, dy);
      const radius = 235;

      if (distance >= radius) {
        card.style.setProperty("--move-x", "0px");
        card.style.setProperty("--move-y", "0px");
        card.style.setProperty("--rotate-x", "0deg");
        card.style.setProperty("--rotate-y", "0deg");
        card.style.setProperty("--card-scale", "1");
        return;
      }

      const influence = 1 - distance / radius;
      const strength = 13 + index * 1.4;
      card.style.setProperty("--move-x", `${(dx / radius) * strength * influence}px`);
      card.style.setProperty("--move-y", `${(dy / radius) * strength * influence}px`);
      card.style.setProperty("--rotate-x", `${(-dy / radius) * 7 * influence}deg`);
      card.style.setProperty("--rotate-y", `${(dx / radius) * 9 * influence}deg`);
      card.style.setProperty("--card-scale", `${1 + influence * 0.05}`);
    });
  }

  function handlePointerLeave(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--pointer-x", "50%");
    event.currentTarget.style.setProperty("--pointer-y", "50%");

    brandRefs.current.forEach((card) => {
      if (!card) return;
      card.style.setProperty("--move-x", "0px");
      card.style.setProperty("--move-y", "0px");
      card.style.setProperty("--rotate-x", "0deg");
      card.style.setProperty("--rotate-y", "0deg");
      card.style.setProperty("--card-scale", "1");
    });
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (error) {
        toast.error("Falha no login", { description: error.message });
        return;
      }
      toast.success("Bem-vindo ao Pipeline OMNI.");
    } catch (error) {
      toast.error("Falha de conexão", {
        description: error instanceof Error ? error.message : "Não foi possível conectar ao Supabase.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="auth-exact min-h-screen overflow-hidden text-white"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="auth-exact-pointer pointer-events-none absolute inset-0" />
      <div className="auth-exact-stars pointer-events-none absolute inset-0" />
      <div className="auth-exact-nebula pointer-events-none absolute inset-0" />
      <div className="auth-exact-planet auth-exact-planet-left pointer-events-none" />
      <div className="auth-exact-planet auth-exact-planet-right pointer-events-none" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.9fr_1fr]">
        <section className="auth-exact-hero relative hidden min-h-screen overflow-hidden lg:block">
          <header className="auth-exact-kicker absolute z-40">
            <span className="auth-exact-kicker-line" />
            <div>
              <div className="auth-exact-kicker-title">Pipeline comercial OMNI</div>
              <div className="auth-exact-kicker-subtitle">Inteligência comercial em movimento</div>
            </div>
          </header>

          <div className="auth-exact-copy absolute z-40">
            <h1 className="font-display font-black">
              Inteligência<br />
              <span className="auth-exact-gradient">que conecta</span><br />
              o futuro das<br />
              suas operações<br />
              comerciais.
            </h1>
          </div>

          <div className="auth-exact-system absolute z-20">
            <div className="auth-exact-system-glow pointer-events-none absolute inset-0 rounded-full" />

            <svg
              className="auth-exact-orbits absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 700 700"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="orbitGoldPink" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffd22d" stopOpacity=".95" />
                  <stop offset="48%" stopColor="#ff9f32" stopOpacity=".64" />
                  <stop offset="75%" stopColor="#d92fa0" stopOpacity=".80" />
                  <stop offset="100%" stopColor="#7d3cff" stopOpacity=".66" />
                </linearGradient>
                <linearGradient id="orbitPurpleGold" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9c48ff" stopOpacity=".76" />
                  <stop offset="45%" stopColor="#d92fa0" stopOpacity=".58" />
                  <stop offset="78%" stopColor="#ffd22d" stopOpacity=".72" />
                  <stop offset="100%" stopColor="#ffb52b" stopOpacity=".35" />
                </linearGradient>
                <filter id="orbitGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="nodeGlow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="4.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <g className="auth-exact-orbit-group auth-exact-orbit-a">
                <ellipse cx="350" cy="350" rx="286" ry="166" transform="rotate(-10 350 350)" fill="none" stroke="url(#orbitGoldPink)" strokeWidth="1.9" filter="url(#orbitGlow)" />
                <circle cx="103" cy="262" r="5.6" fill="#ffd22d" filter="url(#nodeGlow)" />
                <circle cx="602" cy="405" r="4.4" fill="#c447ff" filter="url(#nodeGlow)" />
              </g>

              <g className="auth-exact-orbit-group auth-exact-orbit-b">
                <ellipse cx="350" cy="350" rx="235" ry="235" transform="rotate(20 350 350)" fill="none" stroke="url(#orbitPurpleGold)" strokeWidth="1.55" filter="url(#orbitGlow)" />
                <circle cx="512" cy="180" r="5.4" fill="#ffbd29" filter="url(#nodeGlow)" />
                <circle cx="183" cy="514" r="4.6" fill="#8e42ff" filter="url(#nodeGlow)" />
              </g>

              <g className="auth-exact-orbit-group auth-exact-orbit-c">
                <ellipse cx="350" cy="350" rx="174" ry="292" transform="rotate(-26 350 350)" fill="none" stroke="url(#orbitGoldPink)" strokeWidth="1.45" filter="url(#orbitGlow)" />
                <circle cx="442" cy="92" r="5.2" fill="#ffd22d" filter="url(#nodeGlow)" />
              </g>

              <g className="auth-exact-orbit-group auth-exact-orbit-d">
                <ellipse cx="350" cy="350" rx="314" ry="202" transform="rotate(25 350 350)" fill="none" stroke="url(#orbitPurpleGold)" strokeWidth="1.5" filter="url(#orbitGlow)" />
                <circle cx="635" cy="258" r="5.0" fill="#ffd22d" filter="url(#nodeGlow)" />
                <circle cx="83" cy="455" r="4.0" fill="#d92fa0" filter="url(#nodeGlow)" />
              </g>

              <ellipse cx="350" cy="350" rx="302" ry="268" transform="rotate(5 350 350)" fill="none" stroke="rgba(255,255,255,.11)" strokeWidth="1" strokeDasharray="2 7" />
            </svg>

            <div className="auth-exact-core absolute z-20">
              <div className="auth-exact-core-grid absolute inset-[9%] rounded-full" />
              <div className="relative z-10 flex h-full flex-col items-center justify-center">
                <img
                  src="/brands/omni-official.svg"
                  alt="OMNI Assessoria"
                  className="auth-exact-core-logo"
                  draggable={false}
                />
                <span className="auth-exact-core-line" />
                <span className="auth-exact-core-name">Pipeline</span>
              </div>
            </div>

            {heroBrands.map((item, index) => (
              <div
                key={item.brand}
                ref={(node) => { brandRefs.current[index] = node; }}
                className={`auth-exact-brand-card ${item.className}`}
              >
                <div className="auth-exact-card-shine absolute inset-0 rounded-[inherit]" />
                <div className="relative z-10 flex h-full items-center justify-center">
                  <BrandLogo
                    brand={item.brand}
                    className={item.logoClassName}
                    imageClassName="h-full w-auto"
                  />
                </div>
              </div>
            ))}
          </div>

          <footer className="auth-exact-footer absolute z-40">
            © OMNI Assessoria · 2026
            <span />
          </footer>
        </section>

        <section className="auth-exact-login-zone relative flex min-h-screen items-center justify-center">
          <div className="auth-exact-login-card relative w-full overflow-hidden">
            <div className="auth-exact-login-shine pointer-events-none absolute inset-0" />

            <div className="relative z-10">
              <img
                src="/brands/omni-official.svg"
                alt="OMNI Assessoria"
                className="auth-exact-login-logo"
                draggable={false}
              />

              <div className="auth-exact-access-label">
                <span />
                Acesso corporativo
              </div>

              <h2 className="auth-exact-login-title font-display">Acessar o sistema</h2>
              <p className="auth-exact-login-subtitle">Entre com sua conta corporativa para continuar.</p>

              <form onSubmit={handleLogin} className="auth-exact-form">
                <div className="space-y-2">
                  <Label htmlFor="email" className="auth-exact-field-label">E-mail</Label>
                  <div className="auth-exact-input-wrap relative">
                    <Mail className="auth-exact-field-icon" />
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="seu@email.com"
                      className="auth-exact-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha" className="auth-exact-field-label">Senha</Label>
                  <div className="auth-exact-input-wrap relative">
                    <LockKeyhole className="auth-exact-field-icon" />
                    <Input
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      required
                      value={senha}
                      onChange={(event) => setSenha(event.target.value)}
                      placeholder="Sua senha"
                      className="auth-exact-input auth-exact-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="auth-exact-eye"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="auth-exact-forgot"
                      onClick={() => toast.info("Recuperação de senha", { description: "Entre em contato com o administrador para redefinir seu acesso." })}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={busy} className="auth-exact-submit">
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Entrar no Pipeline <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="auth-exact-connected">
                <div className="auth-exact-connected-title">
                  <span />
                  Ecossistema conectado
                  <span />
                </div>
                <div className="auth-exact-badges">
                  <BrandBadge brand="ONVOX" />
                  <BrandBadge brand="TAKE_FLOW" />
                  <BrandBadge brand="CLARO" />
                  <BrandBadge brand="VIVO" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function BrandBadge({ brand }: { brand: BrandId }) {
  return (
    <div className="auth-exact-badge">
      <BrandLogo
        brand={brand}
        className={
          brand === "CLARO"
            ? "h-[72%] max-w-[38px]"
            : brand === "VIVO"
              ? "h-[48%] max-w-[56px]"
              : brand === "TAKE_FLOW"
                ? "h-[43%] max-w-[68px]"
                : "h-[43%] max-w-[64px]"
        }
        imageClassName="h-full w-auto"
      />
    </div>
  );
}
