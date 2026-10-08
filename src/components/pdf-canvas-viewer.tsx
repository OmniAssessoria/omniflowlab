import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const PDFJS_MODULE_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

let pdfJsPromise: Promise<any> | null = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    const moduleUrl = PDFJS_MODULE_URL;
    pdfJsPromise = import(/* @vite-ignore */ moduleUrl).then((pdfjs: any) => {
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function PdfPage({
  pdf,
  pageNumber,
  scale,
}: {
  pdf: any;
  pageNumber: number;
  scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any = null;

    async function renderPage() {
      setRendering(true);
      setError(null);

      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas indisponível.");

        const outputScale = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
          background: "#ffffff",
        });

        await renderTask.promise;
        if (!cancelled) setRendering(false);
      } catch (err: any) {
        if (cancelled || err?.name === "RenderingCancelledException") return;
        console.error("[PdfCanvasViewer] Falha ao renderizar página", pageNumber, err);
        setError(err?.message || "Falha ao renderizar esta página.");
        setRendering(false);
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {
        // sem ação
      }
    };
  }, [pdf, pageNumber, scale]);

  return (
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-md bg-white shadow-xl">
      {rendering && (
        <div className="absolute inset-0 z-10 flex min-h-40 items-center justify-center bg-white text-xs text-slate-500">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Renderizando página {pageNumber}…
        </div>
      )}

      {error ? (
        <div className="flex min-h-52 w-[520px] max-w-full items-center justify-center px-6 text-center text-sm text-red-600">
          {error}
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-auto max-w-full bg-white" />
      )}
    </div>
  );
}

export function PdfCanvasViewer({
  data,
  className = "",
}: {
  data: Uint8Array | null;
  className?: string;
}) {
  const [pdf, setPdf] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.15);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any = null;

    async function openPdf() {
      if (!data?.byteLength) {
        setPdf(null);
        return;
      }

      setLoading(true);
      setError(null);
      setPdf(null);

      try {
        const pdfjs = await loadPdfJs();
        if (cancelled) return;

        // PDF.js pode transferir o buffer para o worker. Uma cópia evita
        // inutilizar o Uint8Array mantido no estado do React.
        const bytes = new Uint8Array(data);
        loadingTask = pdfjs.getDocument({
          data: bytes,
          useWorkerFetch: false,
          isEvalSupported: false,
        });

        const loaded = await loadingTask.promise;
        if (!cancelled) setPdf(loaded);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[PdfCanvasViewer] Falha ao abrir PDF", err);
        setError(err?.message || "Não foi possível renderizar o PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void openPdf();

    return () => {
      cancelled = true;
      try {
        loadingTask?.destroy?.();
      } catch {
        // sem ação
      }
    };
  }, [data]);

  const pages = useMemo(
    () => (pdf ? Array.from({ length: pdf.numPages }, (_, index) => index + 1) : []),
    [pdf],
  );

  if (loading) {
    return (
      <div className={`flex h-full items-center justify-center text-sm text-muted-foreground ${className}`}>
        <Loader2 className="mr-2 size-5 animate-spin" />
        Preparando PDF…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex h-full flex-col items-center justify-center px-8 text-center ${className}`}>
        <div className="text-sm font-semibold text-foreground">Não foi possível renderizar o PDF.</div>
        <div className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className={`flex h-full items-center justify-center text-sm text-muted-foreground ${className}`}>
        Nenhum PDF carregado.
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-card/70 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {pdf.numPages} {pdf.numPages === 1 ? "página" : "páginas"}
        </span>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setZoom(value => Math.max(0.7, Number((value - 0.15).toFixed(2))))}
            disabled={zoom <= 0.7}
            title="Diminuir zoom"
          >
            <Minus className="size-3.5" />
          </Button>

          <span className="w-12 text-center text-[10px] font-mono text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setZoom(value => Math.min(2, Number((value + 0.15).toFixed(2))))}
            disabled={zoom >= 2}
            title="Aumentar zoom"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-200/95 p-4 sm:p-6">
        <div className="space-y-5">
          {pages.map(pageNumber => (
            <PdfPage
              key={pageNumber}
              pdf={pdf}
              pageNumber={pageNumber}
              scale={zoom}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
