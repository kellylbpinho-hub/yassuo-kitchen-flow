import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, UtensilsCrossed, Package, AlertTriangle, DollarSign,
  Scale, ArrowRight, Radar, ScanBarcode, TrendingDown,
  Download, FileText, FileSpreadsheet,
} from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";
import { generateCeoPDF, generateCeoExcel, type CeoExportData } from "@/lib/ceoExport";
import { toast } from "sonner";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type StatusLevel = "verde" | "amarelo" | "vermelho";

function deriveGeral(f: StatusLevel, e: StatusLevel, r: StatusLevel) {
  const scores = { verde: 0, amarelo: 1, vermelho: 2 };
  const total = scores[f] + scores[e] + scores[r];
  if (total === 0) return "Saudável";
  if (total <= 2) return "Monitorar";
  if (total <= 4) return "Atenção";
  return "Risco";
}

const finLabel = (s: StatusLevel) => s === "verde" ? "Saudável" : s === "amarelo" ? "Margem Crítica" : "Prejuízo";
const estLabel = (s: StatusLevel) => s === "verde" ? "OK" : s === "amarelo" ? "Atenção" : "Crítico";
const recLabel = (s: StatusLevel) => s === "verde" ? "OK" : s === "amarelo" ? "Divergência" : "Múltiplas";

interface UnitFinRow {
  name: string;
  contractValue: number | null;
  totalCost: number;
  totalMeals: number;
  avgCost: number;
  target: number | null;
  efficiency: number | null;
  status: string;
}

interface RadarRow {
  name: string;
  financeiro: string;
  estoque: string;
  recebimento: string;
  geral: string;
}

export default function PainelCeo() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [kpis, setKpis] = useState({
    mealsToday: 0, criticalProducts: 0, avgMealCost: 0,
    marginCriticalUnits: 0, lossUnits: 0, weightDivergences: 0,
    healthyUnits: 0, ruptureRisk: 0, expiringAlerts: 0,
  });
  const [recentDivergences, setRecentDivergences] = useState<{ product_name: string; percentual_desvio: number; created_at: string }[]>([]);
  const [unitFinRows, setUnitFinRows] = useState<UnitFinRow[]>([]);
  const [radarRows, setRadarRows] = useState<RadarRow[]>([]);

  useEffect(() => {
    if (profile?.company_id) loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rawData, error } = await supabase.rpc("rpc_dashboard_executive");
      if (error) throw error;
      const data = rawData as any;
      const mealCosts: Record<string, { total_cost: number; total_meals: number; avg_cost: number }> = {};
      (data.meal_costs || []).forEach((mc: any) => {
        mealCosts[mc.unit_id] = { total_cost: Number(mc.total_cost), total_meals: Number(mc.total_meals), avg_cost: Number(mc.avg_cost) };
      });

      const divergences = data.divergences || [];
      const unitWeightCount: Record<string, number> = {};
      divergences.forEach((d: any) => {
        unitWeightCount[d.unidade_id] = (unitWeightCount[d.unidade_id] || 0) + 1;
      });

      const mealsToday = units.reduce((sum: number, u: any) => sum + (u.numero_colaboradores || 0), 0);
      let healthyUnits = 0, marginCriticalUnits = 0, lossUnits = 0;
      let totalCostAll = 0, totalMealsAll = 0;
      const finRows: UnitFinRow[] = [];
      const radRows: RadarRow[] = [];

      units.forEach((u: any) => {
        const fin = mealCosts[u.id];
        const hasFin = fin && fin.total_meals > 0;
        const avgCost = hasFin ? fin.avg_cost : 0;
        const target = u.target_meal_cost ? Number(u.target_meal_cost) : null;
        const efficiency = target && target > 0 && avgCost > 0 ? (avgCost / target) * 100 : null;
        const contractValue = u.contract_value ? Number(u.contract_value) : null;

        let finStatus: StatusLevel = "verde";
        let statusLabel = "Saudável";
        if (hasFin && contractValue && contractValue > 0) {
          totalCostAll += fin.total_cost;
          totalMealsAll += fin.total_meals;
          const lucro = contractValue - fin.total_cost;
          const margem = (lucro / contractValue) * 100;
          if (lucro < 0) { lossUnits++; finStatus = "vermelho"; statusLabel = "Prejuízo"; }
          else if (margem < 5) { marginCriticalUnits++; finStatus = "amarelo"; statusLabel = "Margem Crítica"; }
          else { healthyUnits++; }
        } else if (hasFin) {
          totalCostAll += fin.total_cost;
          totalMealsAll += fin.total_meals;
          healthyUnits++;
        } else {
          healthyUnits++;
        }

        finRows.push({ name: u.name, contractValue, totalCost: hasFin ? fin.total_cost : 0, totalMeals: hasFin ? fin.total_meals : 0, avgCost, target, efficiency, status: statusLabel });

        // Stock status (simplified with RPC data)
        let estoque: StatusLevel = "verde";
        if (data.low_stock_count > 0 || data.expiring_count > 0) estoque = "amarelo";
        if (data.rupture_risk > 0) estoque = "vermelho";

        // Receiving
        let recebimento: StatusLevel = "verde";
        const wCount = unitWeightCount[u.id] || 0;
        if (wCount >= 3) recebimento = "vermelho";
        else if (wCount >= 1) recebimento = "amarelo";

        radRows.push({ name: u.name, financeiro: finLabel(finStatus), estoque: estLabel(estoque), recebimento: recLabel(recebimento), geral: deriveGeral(finStatus, estoque, recebimento) });
      });

      const avgMealCost = totalMealsAll > 0 ? totalCostAll / totalMealsAll : 0;
      setKpis({
        mealsToday, criticalProducts: data.low_stock_count, avgMealCost,
        marginCriticalUnits, lossUnits, weightDivergences: divergences.length,
        healthyUnits, ruptureRisk: data.rupture_risk, expiringAlerts: data.expiring_count,
      });
      setRecentDivergences(divergences.map((l: any) => ({
        product_name: l.product_name, percentual_desvio: Number(l.percentual_desvio), created_at: l.created_at,
      })));
      setUnitFinRows(finRows);
      setRadarRows(radRows);
    } catch (err: any) {
      toast.error("Erro ao carregar dados executivos", { description: err.message });
    }
    setLoading(false);
    setLastUpdated(new Date());
  };

  const handleExport = (type: "pdf" | "excel") => {
    toast.success(type === "pdf" ? "Gerando PDF..." : "Gerando Excel...", { duration: 2000 });
    const exportData: CeoExportData = {
      generatedAt: new Date().toLocaleString("pt-BR"),
      kpis, unitFinance: unitFinRows, radar: radarRows, divergences: recentDivergences,
    };
    if (type === "pdf") generateCeoPDF(exportData);
    else generateCeoExcel(exportData);
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
          <LastUpdated timestamp={lastUpdated} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar Relatório
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> Resumo Financeiro
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
              <Button key={link.route} variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(link.route)}>
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
