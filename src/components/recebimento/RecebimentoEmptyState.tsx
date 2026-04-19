import { PackageOpen, ScanBarcode, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecebimentoEmptyStateProps {
  onScan: () => void;
  onSearch: () => void;
}

export function RecebimentoEmptyState({ onScan, onSearch }: RecebimentoEmptyStateProps) {
  return (
    <div className="glass-card p-8 sm:p-10 text-center flex flex-col items-center gap-4 relative overflow-hidden max-w-xl mx-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="rounded-2xl bg-primary/10 ring-1 ring-primary/30 p-4 shadow-[0_0_32px_-12px_hsl(var(--primary)/0.6)]">
          <PackageOpen className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-display font-bold text-foreground">
            Nenhum recebimento ainda hoje
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Use o leitor de código de barras para iniciar uma conferência rápida ou busque o produto pelo nome.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full sm:w-auto">
          <Button onClick={onScan} className="gap-2">
            <ScanBarcode className="h-4 w-4" />
            Escanear código
          </Button>
          <Button variant="outline" onClick={onSearch} className="gap-2">
            <Search className="h-4 w-4" />
            Buscar produto
          </Button>
        </div>
      </div>
    </div>
  );
}
