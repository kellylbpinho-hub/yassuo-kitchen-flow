import { Button } from "@/components/ui/button";
import { ChefHat, Plus, Sparkles } from "lucide-react";

interface PratosEmptyStateProps {
  onCreate: () => void;
  hasFilters: boolean;
  canCreate: boolean;
}

export function PratosEmptyState({ onCreate, hasFilters, canCreate }: PratosEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Nenhum prato corresponde aos filtros
        </h3>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Ajuste os critérios de busca para visualizar pratos da sua biblioteca.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm p-10 text-center">
      {/* Subtle red glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />

      <div className="relative space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.4)]">
          <ChefHat className="h-7 w-7 text-primary" />
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-display font-semibold text-foreground">
            Sua biblioteca de pratos está vazia
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cadastre o primeiro prato para começar a construir sua base técnica e montar cardápios
            com mais agilidade.
          </p>
        </div>

        {canCreate && (
          <Button onClick={onCreate} size="lg" className="gap-2 shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            Criar primeiro prato
          </Button>
        )}
      </div>
    </div>
  );
}
