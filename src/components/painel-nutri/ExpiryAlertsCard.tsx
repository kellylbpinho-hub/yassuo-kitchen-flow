import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";
import type { ExpiryAlert } from "@/hooks/usePainelNutriData";
import { cn } from "@/lib/utils";

interface Props {
  alerts: ExpiryAlert[];
}

export function ExpiryAlertsCard({ alerts }: Props) {
  const navigate = useNavigate();
  const visible = alerts.slice(0, 5);
  const remainder = Math.max(0, alerts.length - visible.length);

  return (
    <Card className="bg-card/80 border-border/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border",
                alerts.length > 0
                  ? "border-warning/40 bg-warning/10 text-warning"
                  : "border-success/30 bg-success/10 text-success",
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            Alertas de validade
            {alerts.length > 0 && (
              <span className="ml-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-warning">
                {alerts.length}
              </span>
            )}
          </CardTitle>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-primary"
              onClick={() => navigate("/estoque")}
            >
              Estoque <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/15/[0.04] px-3 py-3">
            <ShieldCheck className="h-4 w-4 text-success shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">Sem riscos de validade</p>
              <p className="text-[11px] text-muted-foreground">
                Nenhum lote próximo do vencimento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((a, i) => {
              const isExpired = a.dias <= 0;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                    isExpired
                      ? "border-destructive/30 bg-destructive/[0.04]"
                      : "border-border/40 bg-surface-1/40",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isExpired ? "bg-destructive animate-pulse" : "bg-warning/10",
                      )}
                    />
                    <span className="text-foreground/90 truncate">{a.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider tabular-nums",
                        isExpired
                          ? "bg-destructive/15 text-destructive"
                          : "bg-warning/15 text-warning",
                      )}
                    >
                      {isExpired ? "Vencido" : `${a.dias}d`}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {a.qtd} un
                    </span>
                  </div>
                </div>
              );
            })}
            {remainder > 0 && (
              <p className="pt-1 text-[11px] text-muted-foreground">
                +{remainder} alerta(s) adicional(is)
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
