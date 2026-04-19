import { ScanBarcode, Keyboard, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScannerLauncherProps {
  onScan: () => void;
  onSearch: () => void;
  onNfe: () => void;
}

/**
 * Hero mobile-first do Recebimento Digital.
 * O botão de Escanear ocupa destaque absoluto, com glow vermelho Yassuo.
 * Buscar e NF-e ficam como ações secundárias compactas.
 */
export function ScannerLauncher({ onScan, onSearch, onNfe }: ScannerLauncherProps) {
  return (
    <div className="glass-card p-4 sm:p-5 ring-1 ring-primary/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,hsl(var(--primary)/0.10),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 space-y-3">
        {/* CTA principal: scan */}
        <button
          type="button"
          onClick={onScan}
          data-guide="btn-scan"
          className={cn(
            "w-full group relative overflow-hidden rounded-2xl",
            "bg-gradient-to-br from-primary to-primary/80",
            "ring-1 ring-primary/40",
            "shadow-[0_0_32px_-8px_hsl(var(--primary)/0.6)]",
            "active:scale-[0.99] transition-transform duration-150",
            "px-5 py-5 sm:py-6 flex items-center justify-between gap-4",
          )}
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="rounded-xl bg-white/15 ring-1 ring-white/20 p-3 shrink-0">
              <ScanBarcode className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-base sm:text-lg font-display font-bold text-primary-foreground leading-tight">
                Escanear código de barras
              </p>
              <p className="text-xs text-primary-foreground/80 mt-0.5 truncate">
                Câmera, GS1-128 e EAN suportados
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground/80 bg-white/10 px-2 py-1 rounded-md ring-1 ring-white/15">
            Recomendado
          </div>
        </button>

        {/* Ações secundárias */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSearch}
            className={cn(
              "rounded-xl bg-background/40 hover:bg-background/60",
              "ring-1 ring-border hover:ring-primary/30",
              "px-3 py-3 flex items-center gap-2.5",
              "transition-all duration-200 active:scale-[0.98]",
            )}
          >
            <div className="rounded-lg bg-primary/10 ring-1 ring-primary/20 p-1.5 shrink-0">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Buscar produto</p>
              <p className="text-[10px] text-muted-foreground truncate">Nome ou EAN manual</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onNfe}
            className={cn(
              "rounded-xl bg-background/40 hover:bg-background/60",
              "ring-1 ring-border hover:ring-primary/30",
              "px-3 py-3 flex items-center gap-2.5",
              "transition-all duration-200 active:scale-[0.98]",
            )}
          >
            <div className="rounded-lg bg-primary/10 ring-1 ring-primary/20 p-1.5 shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Importar NF-e</p>
              <p className="text-[10px] text-muted-foreground truncate">XML do fornecedor</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
