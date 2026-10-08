import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Settings, WifiOff } from "lucide-react";
import type { TvMeta, TvSnapshot } from "@/lib/tv-data";

const SOURCE_COLORS = ["#22c55e", "#86efac", "#15a34a", "#d1fae5"];
const RED = "#e5484d";
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const saoPauloFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type QueueItem =
  | { type: "contrato"; id: string; nome: string; empresa: string; valor: number; duration: number }
  | { type: "parabens"; id: string; nome: string; quantidade: number; valor: number; duration: number };

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
}

function moneyCompact(value: number) {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return `R$ ${Math.round(value || 0).toLocaleString("pt-BR")}`;
}

function evolutionBarHeight(value: number, max: number) {
  if (value <= 0 || max <= 0) return 2;
  return Math.max(4, Math.min(70, Math.round((value / max) * 70)));
}

function keyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
}

function saoPauloParts(date: Date) {
  const parts = Object.fromEntries(
    saoPauloFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function saoPauloDayKey(date: Date) {
  const p = saoPauloParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function saoPauloSecondOfDay(date: Date) {
  const p = saoPauloParts(date);
  return (p.hour * 60 * 60) + (p.minute * 60) + p.second;
}

function saoPauloWeekday(date: Date) {
  const p = saoPauloParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

function resolveMeta(metas: Record<string, TvMeta>, key: string): TvMeta {
  const keys = Object.keys(metas).filter((k) => k <= key).sort();
  return keys.length ? metas[keys[keys.length - 1]] : { meta: 0, sup: 0, elite: 0, ind: 0 };
}

function businessDaysRemaining(now: Date) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  let count = 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (d <= end) {
    const day = d.getDay();
    if (day >= 1 && day <= 5) count += 1;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function gradientFromSegments(values: number[], goal: number) {
  if (goal <= 0) return `${RED} 0% 100%`;
  let acc = 0;
  const parts: string[] = [];
  values.forEach((value, i) => {
    const start = Math.min(100, (acc / goal) * 100);
    acc += value;
    const end = Math.min(100, (acc / goal) * 100);
    if (end > start) parts.push(`${SOURCE_COLORS[i % SOURCE_COLORS.length]} ${start}% ${end}%`);
  });
  if (acc < goal) {
    const start = Math.min(100, (acc / goal) * 100);
    parts.push(`${RED} ${start}% 100%`);
  }
  if (!parts.length) parts.push(`${RED} 0% 100%`);
  return parts.join(", ");
}

function Ring({ values, goal, size, center, small = false }: { values: number[]; goal: number; size: number; center: string; small?: boolean }) {
  const background = goal > 0
    ? `conic-gradient(${gradientFromSegments(values, goal)})`
    : `conic-gradient(${RED} 0 100%)`;
  return (
    <div className="tv-ring" style={{ width: size, height: size, background }}>
      <div className="tv-ring-hole" style={{ width: size - (small ? 18 : 24), height: size - (small ? 18 : 24) }}>
        <strong style={{ fontSize: small ? 14 : 19 }}>{center}</strong>
      </div>
    </div>
  );
}

function SourceRows({ fontes, totals, counts, compact = false }: {
  fontes: string[];
  totals: Record<string, number>;
  counts: Record<string, number>;
  compact?: boolean;
}) {
  return (
    <div className="tv-source-rows">
      {fontes.slice(0, 4).map((fonte, i) => (
        <div key={fonte} className="tv-source-row">
          <span className="tv-source-dot" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
          <span className="tv-ellipsis">{fonte}</span>
          <strong>{brl(totals[fonte] ?? 0)}</strong>
          <span className="tv-muted">{compact ? "" : `${counts[fonte] ?? 0} contr.`}</span>
        </div>
      ))}
    </div>
  );
}

export function TvDashboard({
  snapshot,
  connected,
  onRefresh,
  onOpenConfig,
}: {
  snapshot: TvSnapshot;
  connected: boolean;
  onRefresh: () => void;
  onOpenConfig?: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const [scale, setScale] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeQueue, setActiveQueue] = useState<QueueItem | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const firedCongratulations = useRef<Set<string>>(new Set());
  const mouseTimer = useRef<number | null>(null);

  const currentKey = keyOf(now);
  const meta = useMemo(() => resolveMeta(snapshot.metas, currentKey), [snapshot.metas, currentKey]);

  const currentContracts = useMemo(
    () => snapshot.contratos.filter((c) => keyOf(new Date(c.data_assinatura)) === currentKey),
    [snapshot.contratos, currentKey],
  );

  const sourcePlan = useMemo(() => {
    const totals = new Map<string, number>();
    for (const contract of currentContracts) {
      totals.set(contract.fonte, (totals.get(contract.fonte) ?? 0) + contract.valor);
    }
    if (totals.size === 0) {
      for (const fonte of snapshot.fontes) totals.set(fonte, 0);
    }

    const ordered = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .map(([fonte]) => fonte);
    const top = ordered.slice(0, 3);
    const collapsed = ordered.length > 3;

    return {
      fontes: collapsed ? [...top, "Outras"] : top,
      top: new Set(top),
      collapsed,
    };
  }, [currentContracts, snapshot.fontes]);

  const sourceFor = useCallback(
    (fonte: string) => sourcePlan.collapsed && !sourcePlan.top.has(fonte) ? "Outras" : fonte,
    [sourcePlan],
  );
  const fontes = sourcePlan.fontes;

  const bySource = useMemo(() => {
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    for (const contract of currentContracts) {
      const fonte = sourceFor(contract.fonte);
      totals[fonte] = (totals[fonte] ?? 0) + contract.valor;
      counts[fonte] = (counts[fonte] ?? 0) + 1;
    }
    return { totals, counts };
  }, [currentContracts, sourceFor]);

  const sourceValues = fontes.map((f) => bySource.totals[f] ?? 0);
  const realized = sourceValues.reduce((a, b) => a + b, 0);
  const percent = meta.meta > 0 ? Math.min(100, Math.round((realized / meta.meta) * 100)) : 0;
  const businessDays = businessDaysRemaining(now);
  const missing = Math.max(0, meta.meta - realized);
  const pace = businessDays > 0 ? missing / businessDays : missing;

  const ranking = useMemo(() => {
    return snapshot.consultores.map((consultor) => {
      const contracts = currentContracts.filter((c) => c.consultor_id === consultor.id);
      const totals: Record<string, number> = {};
      const counts: Record<string, number> = {};
      for (const c of contracts) {
        const fonte = sourceFor(c.fonte);
        totals[fonte] = (totals[fonte] ?? 0) + c.valor;
        counts[fonte] = (counts[fonte] ?? 0) + 1;
      }
      const total = contracts.reduce((sum, c) => sum + c.valor, 0);
      return { ...consultor, contracts, totals, counts, total };
    }).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [snapshot.consultores, currentContracts, sourceFor]);

  const evolution = useMemo(() => {
    return fontes.map((fonte) => {
      const months = Array.from({ length: 6 }, (_, idx) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
        const key = keyOf(d);
        const rows = snapshot.contratos.filter(
          (c) => sourceFor(c.fonte) === fonte && keyOf(new Date(c.data_assinatura)) === key,
        );
        return {
          label: d.toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" }),
          value: rows.reduce((s, c) => s + c.valor, 0),
          count: rows.length,
        };
      });
      return { fonte, months, max: Math.max(0, ...months.map((m) => m.value)) };
    });
  }, [fontes, snapshot.contratos, now.getFullYear(), now.getMonth(), sourceFor]);

  const participation = useMemo(() => {
    const rows = ranking.map((r) => ({ nome: r.nome, count: r.contracts.length }));
    const actualTotal = rows.reduce((s, r) => s + r.count, 0);
    const total = Math.max(1, actualTotal);
    let acc = 0;
    const parts = rows.map((r, i) => {
      const start = (acc / total) * 100;
      acc += r.count;
      const end = (acc / total) * 100;
      return `${SOURCE_COLORS[i % SOURCE_COLORS.length]} ${start}% ${end}%`;
    });
    return { rows, background: actualTotal > 0 && parts.length ? `conic-gradient(${parts.join(",")})` : `conic-gradient(#2b3644 0 100%)` };
  }, [ranking]);

  const enqueueCongratulations = useCallback((dayKey: string, startSecond: number, endSecond: number, key: string) => {
    const storageKey = `painel-tv-parabens:${key}`;
    if (firedCongratulations.current.has(key) || window.localStorage.getItem(storageKey) === "1") return;
    firedCongratulations.current.add(key);
    window.localStorage.setItem(storageKey, "1");
    const byConsultant = new Map<string, { nome: string; quantidade: number; valor: number }>();
    for (const c of snapshot.contratos) {
      const signedAt = new Date(c.data_assinatura);
      if (saoPauloDayKey(signedAt) !== dayKey) continue;
      const second = saoPauloSecondOfDay(signedAt);
      if (second < startSecond || second >= endSecond) continue;
      const cur = byConsultant.get(c.consultor_id) ?? { nome: c.consultor, quantidade: 0, valor: 0 };
      cur.quantidade += 1;
      cur.valor += c.valor;
      byConsultant.set(c.consultor_id, cur);
    }
    const items: QueueItem[] = Array.from(byConsultant.entries())
      .map(([id, row]) => ({ type: "parabens" as const, id: `${key}-${id}`, ...row, duration: 5000 }))
      .sort((a, b) => b.valor - a.valor);
    if (items.length) setQueue((q) => [...q, ...items]);
  }, [snapshot.contratos]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const ids = new Set(currentContracts.map((c) => c.id));
    if (!knownIds.current) {
      knownIds.current = ids;
      return;
    }
    const newRows = currentContracts.filter((c) => !knownIds.current!.has(c.id));
    if (newRows.length) {
      setQueue((q) => [
        ...q,
        ...newRows.map((c) => ({
          type: "contrato" as const,
          id: `contrato-${c.id}`,
          nome: c.consultor,
          empresa: c.empresa,
          valor: c.valor,
          duration: 6000,
        })),
      ]);
    }
    knownIds.current = ids;
  }, [currentContracts]);

  useEffect(() => {
    if (activeQueue || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setActiveQueue(next);
    const timer = window.setTimeout(() => setActiveQueue(null), next.duration);
    return () => window.clearTimeout(timer);
  }, [activeQueue, queue]);

  useEffect(() => {
    const parts = saoPauloParts(now);
    const weekday = saoPauloWeekday(now);
    if (weekday < 1 || weekday > 5 || parts.minute !== 30) return;

    const dayKey = saoPauloDayKey(now);
    const elevenThirty = (11 * 60 + 30) * 60;
    const sixteenThirty = (16 * 60 + 30) * 60;

    if (parts.hour === 11) {
      enqueueCongratulations(dayKey, 0, elevenThirty, `${dayKey}-11:30`);
    }
    if (parts.hour === 16) {
      enqueueCongratulations(dayKey, elevenThirty, sixteenThirty, `${dayKey}-16:30`);
    }
  }, [now, enqueueCongratulations]);

  const showControls = () => {
    setControlsVisible(true);
    if (mouseTimer.current) window.clearTimeout(mouseTimer.current);
    mouseTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
  };

  useEffect(() => {
    showControls();
    window.addEventListener("mousemove", showControls);
    return () => {
      window.removeEventListener("mousemove", showControls);
      if (mouseTimer.current) window.clearTimeout(mouseTimer.current);
    };
  }, []);

  const testCongratulations = () => {
    const instant = new Date();
    const dayKey = saoPauloDayKey(instant);
    const endSecond = saoPauloSecondOfDay(instant) + 1;
    firedCongratulations.current.delete("debug");
    window.localStorage.removeItem("painel-tv-parabens:debug");
    enqueueCongratulations(dayKey, 0, endSecond, "debug");
  };

  return (
    <div className="tv-page">
      <style>{TV_CSS}</style>
      <div
        className="tv-stage"
        data-testid="tv-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="tv-layout">
          <main className="tv-main">
            <section className="tv-card tv-hero">
              <div className="tv-hero-ring">
                <Ring values={sourceValues} goal={meta.meta} size={130} center={`${percent}%`} />
                <span>da meta</span>
              </div>

              <div className="tv-hero-copy">
                <div className="tv-kicker">Meta do mês · {snapshot.equipe}</div>
                <div className="tv-month">{monthName(now)}</div>
                <div className="tv-realized">{brl(realized)}</div>
                <div className="tv-inline-sources">
                  {fontes.map((f, i) => (
                    <span key={f}><i style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />{f} <strong>{brl(bySource.totals[f] ?? 0)}</strong></span>
                  ))}
                </div>
                <div className="tv-hero-stats">
                  <div><small>Falta p/ bater a meta</small><strong className="tv-red">{brl(missing)}</strong></div>
                  <div><small>Dias úteis restantes</small><strong>{businessDays}</strong></div>
                  <div><small>Super meta · Elite</small><strong>{brl(meta.sup)} · {brl(meta.elite)}</strong></div>
                </div>
              </div>

              <div className="tv-pace">
                <span>Ritmo necessário</span>
                {realized >= meta.meta && meta.meta > 0
                  ? <strong className="tv-hit">META BATIDA</strong>
                  : <strong className="tv-red">{brl(pace)} / dia</strong>}
                <small>{realized >= meta.meta && meta.meta > 0 ? "parabéns, equipe!" : "para alcançar a meta"}</small>
              </div>
            </section>

            <section className="tv-card tv-goals">
              {[
                ["Meta", meta.meta],
                ["Super meta", meta.sup],
                ["Meta elite", meta.elite],
              ].map(([label, goal]) => {
                const goalNumber = Number(goal);
                const faltam = Math.max(0, goalNumber - realized);
                return (
                  <div className="tv-goal-row" key={String(label)}>
                    <strong>{label}</strong>
                    <div className="tv-bar">
                      <div className="tv-bar-gradient" style={{
                        width: "100%",
                        background: `linear-gradient(to right, ${gradientFromSegments(sourceValues, goalNumber)})`,
                      }} />
                    </div>
                    <div className="tv-goal-value">
                      <strong>{brl(goalNumber)}</strong>
                      <span className={faltam > 0 ? "tv-red" : ""}>{faltam > 0 ? `faltam ${brl(faltam)}` : "atingida"}</span>
                    </div>
                  </div>
                );
              })}
            </section>

            <section
              className={`tv-ranking ${ranking.length > 4 ? "three-cols" : "two-cols"} ${ranking.length > 9 ? "compact" : ""} ${ranking.length <= 6 ? "min-card-200" : ""}`}
              data-testid="tv-ranking"
            >
              {ranking.map((r, idx) => {
                const values = fontes.map((f) => r.totals[f] ?? 0);
                const pct = meta.ind > 0 ? Math.min(100, Math.round((r.total / meta.ind) * 100)) : 0;
                return (
                  <article className={`tv-card tv-rank-card ${idx === 0 ? "winner" : ""}`} key={r.id}>
                    <div className="tv-rank-top">
                      <div className="tv-avatar">
                        {r.foto_url ? <img src={r.foto_url} alt="" /> : r.nome.trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="tv-person">
                        <strong className="tv-ellipsis">{idx + 1}º {r.nome}</strong>
                        <span className="tv-ellipsis">{r.cargo || "Consultor"} · {snapshot.equipe}</span>
                      </div>
                      <div className="tv-rank-total">{brl(r.total)}</div>
                    </div>
                    <div className="tv-rank-body">
                      <Ring values={values} goal={meta.ind} size={ranking.length > 9 ? 80 : 104} center={`${pct}%`} small />
                      <div className="tv-rank-details">
                        <SourceRows fontes={fontes} totals={r.totals} counts={r.counts} />
                        <div className="tv-rank-missing tv-red">Falta p/ meta individual {brl(Math.max(0, meta.ind - r.total))}</div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section
              className={`tv-evolution ${evolution.length >= 4 ? "four-charts" : ""}`}
              style={{ gridTemplateColumns: `repeat(${Math.max(1, evolution.length)}, minmax(0, 1fr))` }}
            >
              {evolution.map((chart, sourceIdx) => (
                <article className="tv-card tv-evo-card" key={chart.fonte}>
                  <div className="tv-evo-title">
                    <i style={{ background: SOURCE_COLORS[sourceIdx % SOURCE_COLORS.length] }} />
                    <span className="tv-ellipsis">EVOLUÇÃO MENSAL · {chart.fonte}</span>
                  </div>

                  <div className="tv-evo-bars-band">
                    {chart.months.map((m) => (
                      <div className="tv-evo-bar-col" key={m.label}>
                        <span className="tv-evo-value">{moneyCompact(m.value)}</span>
                        <div className="tv-evo-track">
                          <div
                            className="tv-vbar"
                            style={{
                              height: evolutionBarHeight(m.value, chart.max),
                              background: SOURCE_COLORS[sourceIdx % SOURCE_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="tv-evo-baseline" />

                  <div className="tv-evo-dates">
                    {chart.months.map((m) => (
                      <div className="tv-evo-date-col" key={m.label}>
                        <span>{m.label}</span>
                        <small>{m.count} c.</small>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </section>

            <footer className="tv-footer">Atualizado às {new Date(snapshot.atualizado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</footer>
          </main>

          <aside className="tv-side">
            <section className="tv-card tv-contracts">
              <div className="tv-side-title">CONTRATOS ASSINADOS · {currentContracts.length} · MÊS ATUAL</div>
              <div className="tv-contract-list">
                {currentContracts.slice(0, 8).map((c) => (
                  <div className="tv-contract" key={c.id}>
                    <strong className="tv-ellipsis">{c.empresa}</strong>
                    <span className="tv-ellipsis">{c.consultor} · {sourceFor(c.fonte)}</span>
                    <b>{brl(c.valor)}</b>
                  </div>
                ))}
                {currentContracts.length === 0 && <div className="tv-empty">Nenhum contrato assinado neste mês.</div>}
              </div>
            </section>

            <section className="tv-card tv-participation">
              <div className="tv-side-title">PARTICIPAÇÃO POR CONSULTOR</div>
              <div className="tv-part-body">
                <div className="tv-part-ring" style={{ background: participation.background }}>
                  <div><strong>{brl(realized)}</strong></div>
                </div>
                <div className={`tv-part-list ${participation.rows.length > 6 ? "many" : ""}`}>
                  {participation.rows.map((r, i) => (
                    <div key={r.nome}>
                      <i style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                      <span className="tv-ellipsis">{r.nome}</span>
                      <b>{r.count}</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </div>

        {!connected && <div className="tv-offline"><WifiOff size={16} /> Sem conexão</div>}

        <div className={`tv-controls ${controlsVisible ? "show" : ""}`}>
          <button onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={16} />Tela cheia</button>
          {onOpenConfig && <button onClick={onOpenConfig}><Settings size={16} />Metas</button>}
          {new URLSearchParams(window.location.search).get("debug") === "tv" && (
            <button onClick={testCongratulations}>Testar parabéns</button>
          )}
          <button onClick={onRefresh}>Atualizar</button>
        </div>

        {activeQueue && (
          <div className="tv-celebration" role="status">
            {activeQueue.type === "contrato" ? (
              <>
                <span>NOVO CONTRATO ASSINADO</span>
                <strong>{activeQueue.nome}</strong>
                <b className="tv-ellipsis">{activeQueue.empresa}</b>
                <em>{brl(activeQueue.valor)}</em>
              </>
            ) : (
              <>
                <span>PARABÉNS!</span>
                <strong>{activeQueue.nome}</strong>
                <b>{activeQueue.quantidade} {activeQueue.quantidade === 1 ? "contrato" : "contratos"} na janela</b>
                <em>{brl(activeQueue.valor)}</em>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const TV_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');
.tv-page{position:fixed;inset:0;background:#10151c;color:#e6ebf1;font-family:Archivo,system-ui,sans-serif;overflow:hidden}
.tv-stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform-origin:center center;padding:15px;box-sizing:border-box;font-size:18px}
.tv-layout{display:grid;grid-template-columns:minmax(0,1fr) 422px;gap:15px;width:100%;height:100%}
.tv-main{display:grid;grid-template-rows:170px 125px minmax(0,1fr) 160px 18px;gap:15px;min-width:0;min-height:0}
.tv-side{display:grid;grid-template-rows:minmax(0,1fr) 140px;gap:15px;min-width:0;min-height:0}
.tv-card{background:#19212b;border:1px solid #2b3644;border-radius:12px;min-width:0;min-height:0;box-sizing:border-box}
.tv-hero{display:grid;grid-template-columns:145px minmax(0,1fr) 310px;gap:12px;padding:10px 12px}
.tv-hero-ring{display:flex;flex-direction:column;align-items:center;justify-content:center;color:#93a1b3;font-size:12px}
.tv-ring{border-radius:50%;display:grid;place-items:center;flex:0 0 auto}
.tv-ring-hole{border-radius:50%;background:#121820;display:grid;place-items:center;text-align:center;color:#e6ebf1}
.tv-hero-copy{min-width:0}
.tv-kicker{font-size:12px;line-height:1;color:#93a1b3}
.tv-month{font-size:24px;font-weight:800;line-height:1;white-space:nowrap}
.tv-realized{font-size:54px;line-height:1;font-weight:800;color:#22c55e;white-space:nowrap}
.tv-inline-sources{display:flex;gap:12px;min-width:0;font-size:12px;line-height:1;margin-top:2px}
.tv-inline-sources span{display:flex;align-items:center;gap:5px;white-space:nowrap;min-width:0}
.tv-inline-sources i,.tv-evo-title i,.tv-part-list i{width:9px;height:9px;border-radius:50%;display:inline-block;flex:0 0 auto}
.tv-hero-stats{display:flex;gap:8px;margin-top:4px}
.tv-hero-stats>div{background:#121820;border:1px solid #17202a;border-radius:7px;padding:3px 8px;min-width:126px}
.tv-hero-stats small{display:block;color:#93a1b3;font-size:10px;line-height:1.05;white-space:nowrap}
.tv-hero-stats strong{display:block;font-size:15px;line-height:1.05;white-space:nowrap}
.tv-pace{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;text-align:right}
.tv-pace span,.tv-pace small{font-size:12px;color:#93a1b3}
.tv-pace strong{font-size:29px;line-height:1.1;white-space:nowrap}
.tv-hit{color:#22c55e;animation:tvPulse 1.8s ease-in-out infinite}
.tv-red{color:#e5484d!important}
.tv-goals{padding:8px 15px;display:grid;gap:4px}
.tv-goal-row{display:grid;grid-template-columns:150px minmax(0,1fr) 180px;align-items:center;gap:14px;min-height:0;font-size:14px}
.tv-goal-row>strong{white-space:nowrap}
.tv-bar{height:14px;border-radius:9px;background:#e5484d;border:1px solid #2b3644;overflow:hidden}
.tv-bar-gradient{height:100%;border-radius:9px}
.tv-goal-value{text-align:right;line-height:1.05}
.tv-goal-value strong{display:block;white-space:nowrap;font-size:14px}
.tv-goal-value span{font-size:9px;line-height:1;white-space:nowrap}
.tv-ranking{display:grid;gap:12px;min-height:0;grid-auto-rows:minmax(0,1fr)}
.tv-ranking.two-cols{grid-template-columns:repeat(2,minmax(0,1fr))}
.tv-ranking.three-cols{grid-template-columns:repeat(3,minmax(0,1fr))}
.tv-ranking.min-card-200 .tv-rank-card{min-height:200px}
.tv-rank-card{padding:11px 13px;display:flex;flex-direction:column;gap:9px}
.tv-rank-card.winner{border-color:#22c55e}
.tv-rank-top{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:9px;align-items:center}
.tv-avatar{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#22c55e;color:#06210f;font-weight:800;overflow:hidden}
.tv-avatar img{width:100%;height:100%;object-fit:cover}
.tv-person{min-width:0;line-height:1.12}
.tv-person strong{display:block;font-size:17px}
.tv-person span{display:block;font-size:11px;color:#93a1b3;margin-top:3px}
.tv-rank-total{font-size:28px;color:#22c55e;font-weight:800;white-space:nowrap}
.tv-rank-body{display:flex;align-items:center;gap:14px;min-height:0;flex:1}
.tv-rank-details{min-width:0;flex:1}
.tv-source-rows{display:grid;gap:2px}
.tv-source-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto auto;gap:5px;align-items:center;font-size:13px;white-space:nowrap}
.tv-source-dot{width:8px;height:8px;border-radius:50%}
.tv-muted{color:#93a1b3;font-size:10px}
.tv-rank-missing{font-size:11px;margin-top:4px;white-space:nowrap}
.tv-ranking.compact .tv-person span{display:none}
.tv-evolution{display:grid;gap:12px;min-height:0}
.tv-evo-card{height:160px;padding:6px 8px;box-sizing:border-box;min-width:0}
.tv-evo-title{height:16px;line-height:16px;font-size:11px;color:#93a1b3;display:flex;align-items:center;gap:6px;white-space:nowrap;min-width:0;margin-bottom:4px}
.tv-evo-bars-band{height:88px;max-height:88px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;min-width:0}
.tv-evo-bar-col{height:88px;display:grid;grid-template-rows:18px 70px;min-width:0;text-align:center}
.tv-evo-value{height:18px;line-height:18px;font-size:13px;color:#e6ebf1;white-space:nowrap}
.tv-evolution.four-charts .tv-evo-value{font-size:12px;letter-spacing:-.15px}
.tv-evo-track{height:70px;display:flex;align-items:flex-end;justify-content:center;min-width:0}
.tv-vbar{width:100%;max-width:56px;box-sizing:border-box;border-radius:4px 4px 0 0;flex:0 0 auto}
.tv-evo-baseline{height:1px;background:#2b3644;width:100%}
.tv-evo-dates{margin-top:8px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;min-width:0;text-align:center}
.tv-evo-date-col{min-width:0;display:grid;grid-template-rows:13px 12px;align-items:start}
.tv-evo-date-col span{font-size:13px;line-height:13px;color:#e6ebf1;white-space:nowrap}
.tv-evo-date-col small{font-size:12px;line-height:12px;color:#93a1b3;white-space:nowrap}
.tv-footer{font-size:11px;color:#93a1b3;display:flex;align-items:center}
.tv-contracts{padding:13px 14px}
.tv-side-title{font-size:12px;color:#93a1b3;white-space:nowrap;margin-bottom:9px}
.tv-contract-list{display:grid;gap:7px}
.tv-contract{background:#121820;border-left:3px solid #22c55e;border-radius:7px;padding:8px 10px;min-width:0}
.tv-contract strong{display:block;font-size:14px}
.tv-contract span{display:block;font-size:11px;color:#93a1b3;margin:2px 0}
.tv-contract b{display:block;color:#22c55e;font-size:15px;white-space:nowrap}
.tv-empty{display:grid;place-items:center;height:100px;color:#93a1b3;font-size:13px}
.tv-participation{padding:5px 10px}
.tv-participation .tv-side-title{margin-bottom:2px}
.tv-part-body{display:grid;grid-template-columns:124px minmax(0,1fr);gap:8px;align-items:center}
.tv-part-ring{width:112px;height:112px;border-radius:50%;display:grid;place-items:center}
.tv-part-ring>div{width:86px;height:86px;border-radius:50%;display:grid;place-items:center;background:#121820}
.tv-part-ring strong{font-size:12px;white-space:nowrap}
.tv-part-list{display:grid;gap:4px;min-width:0}
.tv-part-list.many{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:8px;row-gap:3px}
.tv-part-list>div{display:grid;grid-template-columns:9px minmax(0,1fr) auto;gap:5px;align-items:center;font-size:11px;min-width:0}
.tv-part-list b{white-space:nowrap}
.tv-ellipsis{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tv-controls{position:absolute;right:20px;bottom:18px;display:flex;gap:8px;opacity:0;pointer-events:none;transition:opacity .2s;z-index:50}
.tv-controls.show{opacity:1;pointer-events:auto}
.tv-controls button{height:38px;border:1px solid #2b3644;border-radius:9px;background:#19212b;color:#e6ebf1;padding:0 13px;display:flex;align-items:center;gap:6px;font:600 13px Archivo,system-ui;cursor:pointer}
.tv-controls button:focus-visible{outline:3px solid #86efac;outline-offset:2px}
.tv-offline{position:absolute;left:20px;bottom:18px;display:flex;align-items:center;gap:6px;background:#19212b;border:1px solid #e5484d;color:#e5484d;border-radius:8px;padding:8px 11px;font-size:12px;z-index:40}
.tv-celebration{position:absolute;inset:15px;z-index:100;background:linear-gradient(135deg,#16361f,#0d1218);border:1px solid #2b3644;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px}
.tv-celebration span{font-size:24px;letter-spacing:.18em;color:#86efac}
.tv-celebration strong{font-size:74px;line-height:1.05;max-width:1500px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-celebration b{font-size:34px;color:#e6ebf1;max-width:1500px}
.tv-celebration em{font-size:64px;font-style:normal;font-weight:800;color:#22c55e;white-space:nowrap;margin-top:14px}
@keyframes tvPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.78;transform:scale(1.025)}}
@media (prefers-reduced-motion:reduce){.tv-hit{animation:none}.tv-controls{transition:none}}
`;
