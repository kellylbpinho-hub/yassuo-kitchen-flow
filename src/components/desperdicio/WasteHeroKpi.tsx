import { Trash2, TrendingDown, TrendingUp, Minus, DollarSign, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WasteHeroKpiProps {
  totalKg: number;
  trendPct: number;
  estimatedCost: number;
  perCapitaG: number;
  registros: number;
  uniqueDays: number;
  canSeeCost: boolean;
}

export function WasteHeroKpi({
  totalKg,
  trendPct,
  estimatedCost,
  perCapitaG,
  registros,
  uniqueDays,
  canSeeCost,
}: WasteHeroKpiProps) {
  // Severity by per-capita
  const severity =
    perCapitaG === 0 ? "neutral" : perCapitaG <= 25 ? "ok" : perCapitaG <= 40 ? "warn" : "crit";

  const sevConfig = {
    neutral: { ring: "ring-border/50", text: "text-foreground", glow: "" },
    ok: { ring: "ring-success/30", text: "text-success", glow: "shadow-[0_0_40px_-10px_hsl(160_70%_45%/0.4)]" },
    warn: { ring: "ring-warning/30", text: "text-warning", glow: "shadow-[0_0_40px_-10px_hsl(45_90%_55%/0.4)]" },
    crit: { ring: "ring-destructive/40", text: "text-destructive", glow: "shadow-[0_0_50px_-10px_hsl(var(--destructive)/0.5)]" },
  }[severity];

  const trendIcon =
    trendPct === 0 ? <Minus className="h-4 w-4" /> :
    trendPct < -5 ? <TrendingDown className="h-4 w-4" /> :
    trendPct > 5 ? <TrendingUp className="h-4 w-4" /> :
    <Minus className="h-4 w-4" />;

  const trendLabel =
    Math.abs(trendPct) < 5 ? "Estável" : trendPct < 0 ? "Melhorando" : "Piorando";

  const trendColor =
    Math.abs(trendPct) < 5 ? "text-muted-foreground" :
    trendPct < 0 ? "text-success" : "text-destructive";

  return (
    <Card className={cn("relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/80 p-6 ring-1", sevConfig.ring, sevConfig.glow)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />

      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
        {/* Hero metric */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
            <Trash2 className="h-3.5 w-3.5" /> Total descartado no período
          </div>
          <div className="flex items-baseline gap-3">
            <span className={cn("text-5xl md:text-6xl font-display font-bold tabular-nums", sevConfig.text)}>
              {totalKg.toFixed(1)}
            </span>
            <span className="text-2xl font-medium text-muted-foreground">kg</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {registros} registro(s) · {uniqueDays} dia(s) com pesagem
          </p>
        </div>

        {/* Trend */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Tendência
          </div>
          <div className={cn("flex items-center gap-2 text-2xl font-bold tabular-nums", trendColor)}>
            {trendIcon}
            <span>{trendPct === 0 ? "—" : `${trendPct > 0 ? "+" : ""}${trendPct.toFixed(0)}%`}</span>
          </div>
          <p className="text-xs text-muted-foreground">{trendLabel} vs anterior</p>
        </div>

        {/* Cost impact */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" /> Impacto estimado
          </div>
          {canSeeCost ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                R$ {estimatedCost.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-muted-foreground">{perCapitaG.toFixed(0)} g/pessoa/dia</p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {perCapitaG.toFixed(0)} <span className="text-base font-medium text-muted-foreground">g</span>
              </div>
              <p className="text-xs text-muted-foreground">por pessoa/dia</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
