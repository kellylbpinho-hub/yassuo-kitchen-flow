import { Package, Plus, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EstoqueEmptyStateProps {
  onCreate?: () => void;
  onImport?: () => void;
  canManage: boolean;
}

export function EstoqueEmptyState({ onCreate, onImport, canManage }: EstoqueEmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/60 p-10 md:p-14 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_70%)] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)]">
            <Package className="h-7 w-7 text-primary" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary/70" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-display font-semibold text-foreground">
            Estoque ainda não cadastrado
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cadastre os primeiros itens para começar a controlar entrada, saída, lotes e
            validades pela lógica FEFO.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            {onCreate && (
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-1.5" /> Cadastrar primeiro item
              </Button>
            )}
            {onImport && (
              <Button variant="outline" onClick={onImport}>
                <Upload className="h-4 w-4 mr-1.5" /> Importar planilha
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
