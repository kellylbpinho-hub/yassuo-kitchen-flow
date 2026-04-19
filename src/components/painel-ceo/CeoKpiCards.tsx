import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  UtensilsCrossed, Package, AlertTriangle, DollarSign,
  Scale, TrendingDown,
} from "lucide-react";
import type { CeoKpis } from "@/hooks/useCeoData";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  kpis: CeoKpis;
}

export function CeoKpiCards({ kpis }: Props) {
  const navigate = useNavigate();

  const kpiCards = [
    { label: "Refeições estimadas/dia", value: kpis.mealsToday.toLocaleString("pt-BR"), icon: UtensilsCrossed, color: "text-primary", route: "/dashboard-financeiro" },
    { label: "Produtos críticos", value: kpis.criticalProducts, icon: Package, color: kpis.criticalProducts > 0 ? "text-destructive" : "text-success", route: "/estoque" },
    { label: "Custo médio/refeição", value: kpis.avgMealCost > 0 ? formatCurrency(kpis.avgMealCost) : "—", icon: DollarSign, color: "text-primary", route: "/dashboard-financeiro" },
    { label: "Margem crítica", value: kpis.marginCriticalUnits, icon: AlertTriangle, color: kpis.marginCriticalUnits > 0 ? "text-warning" : "text-success", route: "/dashboard-financeiro" },
    { label: "Com prejuízo", value: kpis.lossUnits, icon: TrendingDown, color: kpis.lossUnits > 0 ? "text-destructive" : "text-success", route: "/dashboard-financeiro" },
    { label: "Diverg. recebimento (48h)", value: kpis.weightDivergences, icon: Scale, color: kpis.weightDivergences > 0 ? "text-warning" : "text-success", route: "/recebimento-digital" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiCards.map(k => (
        <Card
          key={k.label}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(k.route)}
        >
          <CardContent className="p-4 text-center">
            <k.icon className={`h-5 w-5 mx-auto mb-1 ${k.color}`} />
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
