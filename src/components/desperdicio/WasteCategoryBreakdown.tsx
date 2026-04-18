import { Card } from "@/components/ui/card";
import { LayoutGrid } from "lucide-react";

export interface CategoryWaste {
  category: string;
  totalKg: number;
}

interface WasteCategoryBreakdownProps {
  data: CategoryWaste[];
  totalKg: number;
}

export function WasteCategoryBreakdown({ data, totalKg }: WasteCategoryBreakdownProps) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.totalKg - a.totalKg).slice(0, 6);

  return (
    <Card className="border-border/60 bg-card/80 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
          <LayoutGrid className="h-4 w-4 text-primary" /> Categorias com maior perda
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Distribuição por tipo de preparação</p>
      </div>

      <div className="space-y-3">
        {sorted.map((cat, i) => {
          const pct = totalKg > 0 ? (cat.totalKg / totalKg) * 100 : 0;
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate">{cat.category}</span>
                <span className="text-muted-foreground tabular-nums">
                  {cat.totalKg.toFixed(1)} kg · {pct.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 to-primary"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
