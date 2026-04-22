import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, Scale } from "lucide-react";
import type { CeoKpis, Divergence } from "@/hooks/useCeoData";

interface Props {
  kpis: CeoKpis;
  recentDivergences: Divergence[];
}

export function CeoSummaryCards({ kpis, recentDivergences }: Props) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber" /> Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Saudáveis</span>
            <Badge variant="outline" className="bg-success/15 text-success border-success/30">{kpis.healthyUnits}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Margem crítica</span>
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">{kpis.marginCriticalUnits}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Com prejuízo</span>
            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">{kpis.lossUnits}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Resumo de Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Produtos críticos</span>
            <span className="font-semibold text-foreground">{kpis.criticalProducts}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Risco de ruptura</span>
            <span className="font-semibold text-foreground">{kpis.ruptureRisk}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Alertas de validade</span>
            <span className="font-semibold text-foreground">{kpis.expiringAlerts}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" /> Resumo de Recebimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Divergências (48h)</span>
            <span className="font-semibold text-foreground">{kpis.weightDivergences}</span>
          </div>
          {recentDivergences.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              {recentDivergences.slice(0, 3).map((d, i) => (
                <div key={i} className="text-xs text-muted-foreground flex justify-between">
                  <span className="truncate max-w-[140px]">{d.product_name}</span>
                  <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-[10px]">
                    {d.percentual_desvio.toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sem divergências recentes</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
