import { Trash2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WasteEmptyStateProps {
  onRegister?: () => void;
  canRegister: boolean;
}

export function WasteEmptyState({ onRegister, canRegister }: WasteEmptyStateProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/60 p-10 md:p-14 text-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_70%)] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 shadow-[0_0_40px_-8px_hsl(var(--primary)/0.4)]">
            <Trash2 className="h-7 w-7 text-primary" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-primary/70" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-display font-semibold text-foreground">
            Nenhum desperdício registrado ainda
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Quando a operação começar a registrar perdas aqui, você verá padrões, tendências e
            oportunidades reais de redução de custo.
          </p>
        </div>

        {canRegister && onRegister && (
          <Button onClick={onRegister} className="mt-2">
            <Plus className="h-4 w-4 mr-1.5" /> Registrar primeira perda
          </Button>
        )}
      </div>
    </div>
  );
}
