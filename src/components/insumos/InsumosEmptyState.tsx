import { Button } from "@/components/ui/button";
import { CalendarRange, Sparkles } from "lucide-react";

interface InsumosEmptyStateProps {
  onGoToMenu: () => void;
  variant?: "no-menu" | "no-recipes";
}

export function InsumosEmptyState({
  onGoToMenu,
  variant = "no-menu",
}: InsumosEmptyStateProps) {
  const isNoMenu = variant === "no-menu";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.05] via-surface-1 to-surface-1 p-8 sm:p-12">
      {/* Decorative glow */}
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" />
      <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-primary/[0.04] blur-3xl" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-5">
          <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/20 blur-xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/[0.08] text-primary">
            <CalendarRange className="h-7 w-7" />
          </div>
        </div>

        <h3 className="font-display text-xl font-bold text-foreground sm:text-2xl">
          {isNoMenu
            ? "Nenhuma previsão gerada ainda"
            : "Cardápio sem fichas técnicas"}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {isNoMenu
            ? "Monte o cardápio semanal para gerar automaticamente a previsão de insumos. O planejamento nasce do cardápio."
            : "Os pratos do cardápio ainda não têm ingredientes cadastrados. Cadastre as fichas técnicas para projetar o consumo."}
        </p>

        <Button
          onClick={onGoToMenu}
          size="default"
          className="mt-6 h-10 gap-2 bg-primary px-5 font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] hover:bg-primary/90"
        >
          <Sparkles className="h-4 w-4" />
          {isNoMenu ? "Ir para Cardápio Semanal" : "Editar Pratos"}
        </Button>

        <div className="mt-8 grid w-full max-w-lg grid-cols-3 gap-3 border-t border-border/40 pt-6">
          <Hint num="1" text="Monte o cardápio" />
          <Hint num="2" text="Defina fichas técnicas" />
          <Hint num="3" text="Gere o pedido" />
        </div>
      </div>
    </div>
  );
}

function Hint({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-surface-2 text-[11px] font-bold text-primary">
        {num}
      </span>
      <span className="text-[11px] text-muted-foreground">{text}</span>
    </div>
  );
}
