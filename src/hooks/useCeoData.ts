import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type StatusLevel = "verde" | "amarelo" | "vermelho";

const finLabel = (s: StatusLevel) => s === "verde" ? "Saudável" : s === "amarelo" ? "Margem Crítica" : "Prejuízo";
const estLabel = (s: StatusLevel) => s === "verde" ? "OK" : s === "amarelo" ? "Atenção" : "Crítico";
const recLabel = (s: StatusLevel) => s === "verde" ? "OK" : s === "amarelo" ? "Divergência" : "Múltiplas";

function deriveGeral(f: StatusLevel, e: StatusLevel, r: StatusLevel) {
  const scores = { verde: 0, amarelo: 1, vermelho: 2 };
  const total = scores[f] + scores[e] + scores[r];
  if (total === 0) return "Saudável";
  if (total <= 2) return "Monitorar";
  if (total <= 4) return "Atenção";
  return "Risco";
}

export interface CeoKpis {
  mealsToday: number;
  criticalProducts: number;
  avgMealCost: number;
  marginCriticalUnits: number;
  lossUnits: number;
  weightDivergences: number;
  healthyUnits: number;
  ruptureRisk: number;
  expiringAlerts: number;
}

export interface UnitFinRow {
  name: string;
  contractValue: number | null;
  totalCost: number;
  totalMeals: number;
  avgCost: number;
  target: number | null;
  efficiency: number | null;
  status: string;
}

export interface RadarRow {
  name: string;
  financeiro: string;
  estoque: string;
  recebimento: string;
  geral: string;
}

export interface Divergence {
  product_name: string;
  percentual_desvio: number;
  created_at: string;
}

export interface PurchaseSummary {
  total_orders: number;
  total_value: number;
  pending_quotations: number;
  recent_orders: { numero: number; status: string; fornecedor: string; total: number; created_at: string }[];
}

export function useCeoData() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [kpis, setKpis] = useState<CeoKpis>({
    mealsToday: 0, criticalProducts: 0, avgMealCost: 0,
    marginCriticalUnits: 0, lossUnits: 0, weightDivergences: 0,
    healthyUnits: 0, ruptureRisk: 0, expiringAlerts: 0,
  });
  const [recentDivergences, setRecentDivergences] = useState<Divergence[]>([]);
  const [unitFinRows, setUnitFinRows] = useState<UnitFinRow[]>([]);
  const [radarRows, setRadarRows] = useState<RadarRow[]>([]);
  const [purchaseSummary, setPurchaseSummary] = useState<PurchaseSummary>({
    total_orders: 0, total_value: 0, pending_quotations: 0, recent_orders: [],
  });

  useEffect(() => {
    if (profile?.company_id) loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: rawData, error }, { data: ordersData }, { data: itemsAgg }, { data: quotData }, { data: fornData }] = await Promise.all([
        supabase.rpc("rpc_dashboard_executive"),
        supabase.from("purchase_orders").select("id, numero, status, fornecedor_id, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("purchase_items").select("purchase_order_id, quantidade, custo_unitario"),
        supabase.from("quotation_requests").select("id, status"),
        supabase.from("fornecedores").select("id, nome"),
      ]);
      if (error) throw error;
      const data = rawData as any;

      const fornMap: Record<string, string> = {};
      (fornData || []).forEach((f: any) => { fornMap[f.id] = f.nome; });
      const orderTotals: Record<string, number> = {};
      (itemsAgg || []).forEach((it: any) => {
        if (it.custo_unitario) {
          orderTotals[it.purchase_order_id] = (orderTotals[it.purchase_order_id] || 0) + it.quantidade * Number(it.custo_unitario);
        }
      });
      const totalValue = Object.values(orderTotals).reduce((s, v) => s + v, 0);
      const pendingQ = (quotData || []).filter((q: any) => q.status === "pendente").length;
      setPurchaseSummary({
        total_orders: (ordersData || []).length,
        total_value: totalValue,
        pending_quotations: pendingQ,
        recent_orders: (ordersData || []).map((o: any) => ({
          numero: o.numero,
          status: o.status,
          fornecedor: o.fornecedor_id ? (fornMap[o.fornecedor_id] || "—") : "—",
          total: orderTotals[o.id] || 0,
          created_at: o.created_at,
        })),
      });

      const units = data.units || [];
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

        let estoque: StatusLevel = "verde";
        if (data.low_stock_count > 0 || data.expiring_count > 0) estoque = "amarelo";
        if (data.rupture_risk > 0) estoque = "vermelho";

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

  return { loading, lastUpdated, kpis, recentDivergences, unitFinRows, radarRows, purchaseSummary, reload: loadData };
}
