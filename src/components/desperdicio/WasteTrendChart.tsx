import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  label: string;
  kg: number;
}

interface WasteTrendChartProps {
  data: TrendPoint[];
}

export function WasteTrendChart({ data }: WasteTrendChartProps) {
  const max = Math.max(...data.map((d) => d.kg), 0.1);
  const hasData = data.some((d) => d.kg > 0);

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" /> Tendência semanal
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Volume descartado por semana (kg)</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
          Sem dados suficientes para tendência.
        </div>
      ) : (
        <div className="flex items-end gap-2 h-32">
          {data.map((point, i) => {
            const heightPct = (point.kg / max) * 100;
            const isLast = i === data.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="text-[10px] font-medium tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                  {point.kg > 0 ? point.kg.toFixed(1) : "—"}
                </div>
                <div className="w-full relative h-full flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      isLast
                        ? "bg-gradient-to-t from-primary to-primary/60 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
                        : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50",
                    )}
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                  />
                </div>
                <div className={cn("text-[10px]", isLast ? "text-primary font-semibold" : "text-muted-foreground")}>
                  {point.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
