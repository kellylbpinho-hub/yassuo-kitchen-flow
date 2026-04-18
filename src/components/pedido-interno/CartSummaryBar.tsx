import { Sparkles, ShoppingCart, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CartSummaryBarProps {
  totalItems: number;
  totalUnits: number;
  forecastCount: number;
  destinationLabel?: string;
  originLabel?: string;
  sending: boolean;
  onSubmit: () => void;
  disabledReason?: string | null;
}

export function CartSummaryBar({
  totalItems,
  totalUnits,
  forecastCount,
  destinationLabel,
  originLabel,
  sending,
  onSubmit,
  disabledReason,
}: CartSummaryBarProps) {
  const empty = totalItems === 0;
  const disabled = empty || sending || !!disabledReason;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 -mx-4 sm:-mx-6 lg:mx-0 lg:rounded-2xl lg:bottom-4 backdrop-blur-xl bg-background/85 border-t border-border lg:border lg:border-border/60 lg:shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.6)]">
      <div className="px-4 sm:px-6 py-3 lg:py-4 flex items-center gap-3 sm:gap-5">
        <div className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
          <ShoppingCart className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg sm:text-xl font-bold tabular-nums text-foreground leading-none">
              {totalItems}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              {totalItems === 1 ? "item" : "itens"}
              {totalUnits > 0 && (
                <span className="hidden sm:inline"> · {totalUnits.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} unid.</span>
              )}
            </span>
            {forecastCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                <Sparkles className="h-3 w-3" />
                {forecastCount} do cardápio
              </span>
            )}
          </div>
          {(originLabel || destinationLabel) && (
            <p className="text-[11px] sm:text-xs text-muted-foreground/80 mt-0.5 truncate">
              {originLabel || "CD"} <span className="text-primary/70">→</span> {destinationLabel || "Cozinha"}
            </p>
          )}
          {disabledReason && !empty && (
            <p className="text-[11px] sm:text-xs text-amber-300/90 mt-0.5 truncate">{disabledReason}</p>
          )}
        </div>

        <Button
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            "gap-2 shrink-0 font-semibold transition-all h-11 px-4 sm:px-6",
            empty
              ? "bg-muted/40 text-muted-foreground/60 hover:bg-muted/40 cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]",
          )}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Enviar Pedido</span>
          <span className="sm:hidden">Enviar</span>
          {!empty && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-bold rounded-full bg-primary-foreground/20 text-primary-foreground">
              {totalItems}
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
