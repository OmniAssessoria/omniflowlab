export type TvMeta = { meta: number; sup: number; elite: number; ind: number };

export type TvSnapshot = {
  equipe: string;
  fontes: string[];
  consultores: Array<{ id: string; nome: string; cargo: string | null; foto_url: string | null }>;
  contratos: Array<{
    id: string;
    empresa: string;
    consultor_id: string;
    consultor: string;
    fonte: string;
    valor: number;
    data_assinatura: string;
  }>;
  metas: Record<string, TvMeta>;
  atualizado_em: string;
};

type FetchSnapshot = () => Promise<TvSnapshot>;
type SaveMetas = (payload: { mes: string; meta: number; sup: number; elite: number; ind: number }) => Promise<unknown>;

export type TvDataSource = {
  snapshot: () => Promise<TvSnapshot>;
  assinar: (callback: (snapshot: TvSnapshot) => void, onError?: (error: unknown) => void) => () => void;
  salvarMetas: (mes: string, meta: TvMeta) => Promise<unknown>;
};

export function createTvData(fetchSnapshot: FetchSnapshot, saveMetas: SaveMetas): TvDataSource {
  return {
    snapshot: fetchSnapshot,

    assinar(callback: (snapshot: TvSnapshot) => void, onError?: (error: unknown) => void) {
      let stopped = false;
      let inFlight = false;

      const tick = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
          const snapshot = await fetchSnapshot();
          if (!stopped) callback(snapshot);
        } catch (error) {
          if (!stopped) onError?.(error);
        } finally {
          inFlight = false;
        }
      };

      const timer = window.setInterval(tick, 10_000);
      const onlineHandler = () => void tick();
      window.addEventListener("online", onlineHandler);

      return () => {
        stopped = true;
        window.clearInterval(timer);
        window.removeEventListener("online", onlineHandler);
      };
    },

    salvarMetas(mes: string, meta: TvMeta) {
      return saveMetas({ mes, ...meta });
    },
  };
}
