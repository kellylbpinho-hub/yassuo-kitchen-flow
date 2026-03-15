import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, UtensilsCrossed, Package, AlertTriangle, DollarSign,
  Scale, Building2, ArrowRight, Radar, ScanBarcode, TrendingDown,
} from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PainelCeo() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [kpis, setKpis] = useState({
    mealsToday: 0,
    criticalProducts: 0,
    avgMealCost: 0,
    marginCriticalUnits: 0,
    lossUnits: 0,
    weightDivergences: 0,
    healthyUnits: 0,
    ruptureRisk: 0,
    expiringAlerts: 0,
  });
  const [recentDivergences, setRecentDivergences] = useState<{ product_name: string; percentual_desvio: number; created_at: string }[]>([]);

  useEffect(() => {
    if (profile?.company_id) loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const fiveDaysLater = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      { data: units },
      { data: products },
      { data: mealCostRows },
      { data: weightLogs },
      { data: expiringLots },
      { data: consumptionMvs },
    ] = await Promise.all([
      supabase.from("units").select("id, name, type, contract_value, target_meal_cost, numero_colaboradores"),
      supabase.from("products").select("id, nome, estoque_atual, estoque_minimo").eq("ativo", true),
      supabase.from("meal_cost_daily").select("unit_id, real_meal_cost, meals_served"),
      supabase.from("weight_divergence_logs")
        .select("id, product_name, percentual_desvio, created_at, unidade_id")
        .gte("created_at", twoDaysAgo)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("lotes").select("id, unidade_id, validade, quantidade")
        .eq("status", "ativo").gt("quantidade", 0)
        .lte("validade", fiveDaysLater),
      supabase.from("movements")
        .select("product_id, quantidade")
        .in("tipo", ["consumo", "saida", "perda"])
        .gte("created_at", thirtyDaysAgo.toISOString()),
    ]);

    const kitchenUnits = (units || []).filter(u => u.type === "kitchen");

    // Meals today estimate
    const mealsToday = kitchenUnits.reduce((sum, u) => sum + (u.numero_colaboradores || 0), 0);

    // Critical products (low stock)
    const criticalProducts = (products || []).filter(
      p => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0
    ).length;

    // Rupture risk
    const consumoMap: Record<string, number> = {};
    (consumptionMvs || []).forEach(m => {
      consumoMap[m.product_id] = (consumoMap[m.product_id] || 0) + Number(m.quantidade);
    });
    let ruptureRisk = 0;
    (products || []).filter(p => Number(p.estoque_atual) > 0).forEach(p => {
      const consumo = consumoMap[p.id];
      if (consumo && consumo > 0) {
        const dias = Number(p.estoque_atual) / (consumo / 30);
        if (dias <= 3) ruptureRisk++;
      }
    });

    // Financial aggregation
    const unitFinance: Record<string, { totalCost: number; totalMeals: number }> = {};
    (mealCostRows || []).forEach(r => {
      if (!r.unit_id) return;
      if (!unitFinance[r.unit_id]) unitFinance[r.unit_id] = { totalCost: 0, totalMeals: 0 };
      const meals = Number(r.meals_served) || 0;
      const realCost = Number(r.real_meal_cost) || 0;
      unitFinance[r.unit_id].totalCost += realCost * meals;
      unitFinance[r.unit_id].totalMeals += meals;
    });

    let healthyUnits = 0, marginCriticalUnits = 0, lossUnits = 0;
    let totalCostAll = 0, totalMealsAll = 0;
    kitchenUnits.forEach(u => {
      const fin = unitFinance[u.id];
      if (fin && fin.totalMeals > 0) {
        totalCostAll += fin.totalCost;
        totalMealsAll += fin.totalMeals;
        if (u.contract_value && Number(u.contract_value) > 0) {
          const lucro = Number(u.contract_value) - fin.totalCost;
          const margem = (lucro / Number(u.contract_value)) * 100;
          if (lucro < 0) lossUnits++;
          else if (margem < 5) marginCriticalUnits++;
          else healthyUnits++;
        } else {
          healthyUnits++;
        }
      } else {
        healthyUnits++;
      }
    });

    const avgMealCost = totalMealsAll > 0 ? totalCostAll / totalMealsAll : 0;

    setKpis({
      mealsToday,
      criticalProducts,
      avgMealCost,
      marginCriticalUnits,
      lossUnits,
      weightDivergences: (weightLogs || []).length,
      healthyUnits,
      ruptureRisk,
      expiringAlerts: (expiringLots || []).length,
    });

    setRecentDivergences((weightLogs || []).map(l => ({
      product_name: l.product_name,
      percentual_desvio: Number(l.percentual_desvio),
      created_at: l.created_at,
    })));

    setLoading(false);
    setLastUpdated(new Date());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpiCards = [
    { label: "Refeições estimadas/dia", value: kpis.mealsToday.toLocaleString("pt-BR"), icon: UtensilsCrossed, color: "text-primary" },
    { label: "Produtos críticos", value: kpis.criticalProducts, icon: Package, color: kpis.criticalProducts > 0 ? "text-destructive" : "text-success" },
    { label: "Custo médio/refeição", value: kpis.avgMealCost > 0 ? formatCurrency(kpis.avgMealCost) : "—", icon: DollarSign, color: "text-primary" },
    { label: "Margem crítica", value: kpis.marginCriticalUnits, icon: AlertTriangle, color: kpis.marginCriticalUnits > 0 ? "text-yellow-500" : "text-success" },
    { label: "Com prejuízo", value: kpis.lossUnits, icon: TrendingDown, color: kpis.lossUnits > 0 ? "text-destructive" : "text-success" },
    { label: "Diverg. recebimento (48h)", value: kpis.weightDivergences, icon: Scale, color: kpis.weightDivergences > 0 ? "text-yellow-500" : "text-success" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel do CEO</h1>
          <p className="text-sm text-muted-foreground">Visão executiva consolidada da operação</p>
        </div>
        <LastUpdated date={lastUpdated} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 text-center">
              <k.icon className={`h-5 w-5 mx-auto mb-1 ${k.color}`} />
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary blocks */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Financial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Saudáveis</span>
              <Badge variant="outline" className="bg-success/15 text-success border-success/30">{kpis.healthyUnits}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margem crítica</span>
              <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30">{kpis.marginCriticalUnits}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Com prejuízo</span>
              <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">{kpis.lossUnits}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Stock */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Resumo de Estoque
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

        {/* Receiving */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Resumo de Recebimento
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
                    <Badge variant="outline" className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30 text-[10px]">
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

      {/* Quick links */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Atalhos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Dashboard Financeiro", route: "/dashboard-financeiro", icon: DollarSign },
              { label: "Estoque", route: "/estoque", icon: Package },
              { label: "Recebimento Digital", route: "/recebimento-digital", icon: ScanBarcode },
              { label: "Radar da Operação", route: "/radar-operacao", icon: Radar },
            ].map(link => (
              <Button
                key={link.route}
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(link.route)}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
