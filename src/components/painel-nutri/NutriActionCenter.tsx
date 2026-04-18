import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Radio,
  Sparkles,
} from "lucide-react";
import type { OperationalAlert } from "@/hooks/usePainelNutriData";
import { cn } from "@/lib/utils";

interface Props {
  alerts: OperationalAlert[];
  weekProgress: number;
  weekCount: number;
  hasAnyAlert: boolean;
}

export function NutriActionCenter({ alerts, weekProgress, weekCount, hasAnyAlert }: Props) {
  const navigate = useNavigate();

  // Empty / all-clear state
  if (!hasAnyAlert) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent p-5">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-emerald-500/[0.08] blur-3xl" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">
              Operação sob controle
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sem alertas críticos no momento. A semana está {weekProgress}% planejada.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show top priorities
  const priority = alerts.slice(0, 4);
  const remainder = Math.max(0, alerts.length - priority.length);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface-2/80 p-5">
      {/* Red signature line */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-primary/[0.06] blur-3xl" />

      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Radio className="h-3.5 w-3.5" />
              <span className="absolute inset-0 animate-ping rounded-lg bg-primary/20 opacity-40" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                Centro de ação
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Próximos passos recomendados
              </p>
            </div>
          </div>
          {weekCount < 5 && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => navigate("/cardapio-semanal")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Planejar
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          {priority.map((alert, i) => {
            const dest = mapAlertRoute(alert.message);
            return (
              <button
                key={i}
                onClick={() => dest && navigate(dest)}
                disabled={!dest}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border border-border/40 bg-surface-1/60 px-3 py-2.5 text-left transition-all",
                  dest && "hover:border-primary/30 hover:bg-surface-3/70 cursor-pointer",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                    alert.type === "danger"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-300",
                  )}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 text-sm text-foreground/90">{alert.message}</span>
                {dest && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                )}
              </button>
            );
          })}
        </div>

        {remainder > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            +{remainder} alerta(s) adicional(is)
          </p>
        )}
      </div>
    </div>
  );
}

function mapAlertRoute(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("pedido")) return "/meus-pedidos";
  if (m.includes("estoque baixo") || m.includes("ruptura")) return "/estoque";
  if (m.includes("bloqueado")) return "/estoque";
  if (m.includes("vence") || m.includes("vencido")) return "/estoque";
  if (m.includes("cardápio") || m.includes("cardapio")) return "/cardapio-semanal";
  return null;
}
