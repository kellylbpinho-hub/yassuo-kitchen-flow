import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, ChefHat, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TopWasteItem {
  name: string;
  category: string | null;
  totalKg: number;
  occurrences: number;
}

interface WasteTopItemsProps {
  items: TopWasteItem[];
  totalKg: number;
}

export function WasteTopItems({ items, totalKg }: WasteTopItemsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" /> Top preparações com perda
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Itens com maior volume descartado no período</p>
        </div>
      </div>

      <ul className="space-y-2.5">
        {items.slice(0, 5).map((item, i) => {
          const sharePct = totalKg > 0 ? (item.totalKg / totalKg) * 100 : 0;
          const severity = sharePct >= 30 ? "crit" : sharePct >= 15 ? "warn" : "ok";
          const sevColor = {
            crit: "text-destructive bg-destructive/10 border-destructive/30",
            warn: "text-amber-400 bg-amber-500/10 border-amber-500/30",
            ok: "text-muted-foreground bg-muted/40 border-border",
          }[severity];

          return (
            <li
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background/60 border border-border/50 text-xs font-bold text-muted-foreground tabular-nums">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.category && (
                    <span className="text-[11px] text-muted-foreground">{item.category}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground">· {item.occurrences}× registrado</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums text-foreground">{item.totalKg.toFixed(1)} kg</div>
                <Badge variant="outline" className={cn("text-[10px] mt-0.5 border", sevColor)}>
                  {sharePct.toFixed(0)}% do total
                </Badge>
              </div>
              {severity === "crit" && <Flame className="h-4 w-4 text-destructive animate-pulse" />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
