import type { TvDataSource, TvMeta, TvSnapshot } from "@/lib/tv-data";

const now = new Date();
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function isoAt(day: number, hour: number, minute = 0) {
  return new Date(now.getFullYear(), now.getMonth(), day, hour, minute).toISOString();
}

function previousMonth(offset: number) {
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 10, 12, 0);
  return d.toISOString();
}

const consultores = [
  { id: "c1", nome: "Consultor Exemplo A", cargo: "Consultor", foto_url: null },
  { id: "c2", nome: "Consultor Exemplo B", cargo: "Consultor", foto_url: null },
  { id: "c3", nome: "Consultor Exemplo C", cargo: "Consultor", foto_url: null },
  { id: "c4", nome: "Consultor Exemplo D", cargo: "Consultor", foto_url: null },
];

const atuais = [
  ["a1", "Empresa Exemplo 1", "c1", "Móvel", 2551, isoAt(2, 9, 15)],
  ["a2", "Empresa Exemplo 2", "c1", "Fixa/Internet", 1514, isoAt(3, 11, 5)],
  ["a3", "Empresa Exemplo 3", "c1", "Fixa/Internet", 3100, isoAt(4, 10, 30)],
  ["a4", "Empresa Exemplo 4", "c1", "Fixa/Internet", 3502, isoAt(5, 14, 10)],
  ["b1", "Empresa Exemplo 5", "c2", "Móvel", 4844, isoAt(2, 13, 20)],
  ["b2", "Empresa Exemplo 6", "c2", "Fixa/Internet", 5774, isoAt(4, 16, 2)],
  ["c1a", "Empresa Exemplo 7", "c3", "Fixa/Internet", 4924, isoAt(2, 10, 42)],
  ["c2a", "Empresa Exemplo 8", "c3", "Móvel", 3799, isoAt(5, 15, 55)],
  ["d1", "Empresa Exemplo 9", "c4", "Fixa/Internet", 3025, isoAt(1, 9, 5)],
  ["d2", "Empresa Exemplo 10", "c4", "Móvel", 3330, isoAt(5, 11, 40)],
] as const;

const historicos = Array.from({ length: 22 }, (_, i) => {
  const consultor = consultores[i % consultores.length];
  const fonte = i % 2 === 0 ? "Fixa/Internet" : "Móvel";
  return {
    id: `h-${i}`,
    empresa: `Empresa Histórica ${i + 1}`,
    consultor_id: consultor.id,
    consultor: consultor.nome,
    fonte,
    valor: 900 + ((i * 347) % 3600),
    data_assinatura: previousMonth((i % 5) + 1),
  };
});

export function exampleTvSnapshot(): TvSnapshot {
  const atuaisRows = atuais.map(([id, empresa, consultorId, fonte, valor, data_assinatura]) => {
    const consultor = consultores.find((row) => row.id === consultorId)!;
    return {
      id,
      empresa,
      consultor_id: consultorId,
      consultor: consultor.nome,
      fonte,
      valor,
      data_assinatura,
    };
  });

  return {
    equipe: "Telecom",
    fontes: ["Fixa/Internet", "Móvel"],
    consultores,
    contratos: [...atuaisRows, ...historicos],
    metas: {
      [monthKey]: { meta: 24000, sup: 32000, elite: 40000, ind: 8000 } satisfies TvMeta,
    },
    atualizado_em: new Date().toISOString(),
  };
}


function cloneSnapshot(snapshot: TvSnapshot): TvSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as TvSnapshot;
}

export function createExampleTvData(): TvDataSource {
  let state = exampleTvSnapshot();

  return {
    async snapshot() {
      return cloneSnapshot(state);
    },

    assinar(callback, onError) {
      const tick = () => {
        try {
          callback(cloneSnapshot(state));
        } catch (error) {
          onError?.(error);
        }
      };
      const timer = window.setInterval(tick, 10_000);
      return () => window.clearInterval(timer);
    },

    async salvarMetas(mes, meta) {
      state = {
        ...state,
        metas: { ...state.metas, [mes]: { ...meta } },
        atualizado_em: new Date().toISOString(),
      };
      return { success: true };
    },
  };
}
