import { cn } from "@/lib/utils";

export type BrandId = "ONVOX" | "TAKE_FLOW" | "CLARO" | "VIVO";

export const BRAND_META: Record<BrandId, {
  label: string;
  src: string;
  accent: string;
  surface: string;
  glow: string;
}> = {
  ONVOX: {
    label: "Onvox",
    src: "/brands/onvox.svg",
    accent: "#D92FA0",
    surface: "linear-gradient(135deg, #8a145f 0%, #d92fa0 48%, #7a2fd3 100%)",
    glow: "rgba(217,47,160,.35)",
  },
  TAKE_FLOW: {
    label: "Take Flow",
    src: "/brands/takeflow.svg",
    accent: "#7A3DA8",
    surface: "linear-gradient(135deg, #4b216e 0%, #7137a5 58%, #2be65e 145%)",
    glow: "rgba(122,61,168,.35)",
  },
  CLARO: {
    label: "Claro",
    src: "/brands/claro.svg",
    accent: "#E60012",
    surface: "linear-gradient(135deg, #7d0009 0%, #c70010 48%, #e60012 100%)",
    glow: "rgba(230,0,18,.32)",
  },
  VIVO: {
    label: "Vivo",
    src: "/brands/vivo.svg",
    accent: "#6F00A8",
    surface: "linear-gradient(135deg, #31005b 0%, #56008b 52%, #7e00bf 100%)",
    glow: "rgba(111,0,168,.34)",
  },
};

export function BrandLogo({
  brand,
  className,
  imageClassName,
}: {
  brand?: BrandId | string | null;
  className?: string;
  imageClassName?: string;
}) {
  const meta = brand && brand in BRAND_META
    ? BRAND_META[brand as BrandId]
    : null;

  if (!meta) {
    return (
      <span
        className={cn(
          "inline-flex min-w-0 items-center text-[10px] font-semibold text-muted-foreground",
          className,
        )}
        title={brand ? `Operadora não reconhecida: ${brand}` : "Operadora não definida"}
      >
        {brand || "Sem operadora"}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center", className)}>
      <img
        src={meta.src}
        alt={meta.label}
        className={cn("block max-w-full object-contain", imageClassName)}
        draggable={false}
      />
    </span>
  );
}

export function BrandTile({
  brand,
  active = false,
  count,
  subtitle,
  onClick,
  compact = false,
  showRadialGlow = true,
}: {
  brand: BrandId;
  active?: boolean;
  count?: number;
  subtitle?: string;
  onClick?: () => void;
  compact?: boolean;
  showRadialGlow?: boolean;
}) {
  const meta = BRAND_META[brand];
  const operatorBrand = brand === "CLARO" || brand === "VIVO";
  const className = cn(
    "group relative overflow-hidden rounded-2xl border text-left transition-all",
    compact ? "min-h-[86px] p-3" : "min-h-[132px] p-4",
    onClick && "cursor-pointer",
    active
      ? "border-white/25 ring-1 ring-white/20"
      : "border-border/80 hover:-translate-y-0.5 hover:border-white/20",
  );
  const style = operatorBrand
    ? {
        background: `radial-gradient(circle at 82% 4%, ${meta.accent}24, transparent 38%), linear-gradient(145deg, rgba(255,255,255,.055), rgba(10,12,20,.94))`,
        borderColor: active ? `${meta.accent}66` : `${meta.accent}33`,
        boxShadow: active
          ? `0 18px 48px -28px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,.10)`
          : `0 14px 36px -30px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,.06)`,
      }
    : {
        background: meta.surface,
        boxShadow: active
          ? `0 16px 44px -26px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,.12)`
          : "inset 0 1px 0 rgba(255,255,255,.08)",
      };

  const content = (
    <>
      {showRadialGlow && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,.17),transparent_38%)]" />
      )}
      <span className="relative z-10 inline-flex items-center">
        <BrandLogo
          brand={brand}
          className={cn(compact ? "h-8 max-w-[160px]" : "h-10 max-w-[210px]")}
          imageClassName="h-full w-auto"
        />
      </span>
      <div className="relative z-10 mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {subtitle && <div className="text-[11px] text-white/70">{subtitle}</div>}
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            operação
          </div>
        </div>
        {typeof count === "number" && (
          <div className="font-display text-3xl font-bold leading-none text-white">{count}</div>
        )}
      </div>
      <img
        src={meta.src}
        alt=""
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-8 -bottom-8 opacity-[0.07] grayscale brightness-[3]",
          brand === "CLARO" ? "h-40" : "h-28",
        )}
      />
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} style={style}>
        {content}
      </button>
    );
  }

  return <div className={className} style={style}>{content}</div>;
}

export function OperatorBrandPill({
  brand,
  active = false,
  count,
  onClick,
}: {
  brand: "CLARO" | "VIVO";
  active?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  const meta = BRAND_META[brand];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-9 min-w-[92px] items-center justify-center gap-1 overflow-hidden rounded-xl border px-1.5 transition-all",
        active
          ? "border-white/20 shadow-lg"
          : "border-border bg-surface-1 text-muted-foreground hover:border-white/10 hover:bg-surface-2",
      )}
      style={active ? {
        background: `radial-gradient(circle at 80% 0%, ${meta.accent}20, transparent 45%), rgba(12,14,23,.92)`,
        borderColor: `${meta.accent}55`,
        boxShadow: `0 12px 30px -18px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,.06)`,
      } : undefined}
    >
      <span className="inline-flex items-center justify-center rounded-lg px-1.5 py-1">
        <BrandLogo
          brand={brand}
          className={brand === "CLARO" ? "h-5 max-w-[34px]" : "h-3.5 max-w-[62px]"}
          imageClassName="h-full w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,.25)]"
        />
      </span>
      {typeof count === "number" && (
        <span
          className="min-w-5 rounded-full border px-1 py-0.5 text-center font-mono text-[9px] font-black"
          style={{
            color: active ? "#fff" : meta.accent,
            borderColor: meta.accent + "55",
            backgroundColor: meta.accent + "14",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
