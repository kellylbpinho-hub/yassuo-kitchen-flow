import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight, ShieldCheck } from "lucide-react";
import type { LowStockItem } from "@/hooks/usePainelNutriData";
import { cn } from "@/lib/utils";

interface Props {
  items: LowStockItem[];
}

export function LowStockCard({ items }: Props) {
  const navigate = useNavigate();
  const visible = items.slice(0, 5);
  const remainder = Math.max(0, items.length - visible.length);

  return (
    <Card className="bg-card/80 border-border/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border",
                items.length > 0
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
              )}
            >
              <Package className="h-3.5 w-3.5" />
            </span>
            Estoque baixo
            {items.length > 0 && (
              <span className="ml-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-destructive">
                {items.length}
              </span>
            )}
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-primary"
              onClick={() => navigate("/pedido-interno")}
            >
              Pedir <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3">
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Estoque saudável</p>
              <p className="text-[11px] text-muted-foreground">
                Nenhum item abaixo do mínimo no momento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((item, i) => {
              const ratio = item.minimo > 0 ? item.saldo / item.minimo : 0;
              const pct = Math.min(100, Math.round(ratio * 100));
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border/40 bg-surface-1/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground/90 truncate max-w-[60%]">
                      {item.nome}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-destructive">
                      {item.saldo} / {item.minimo}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-destructive to-destructive/60 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {remainder > 0 && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                +{remainder} item(ns) adicional(is)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
