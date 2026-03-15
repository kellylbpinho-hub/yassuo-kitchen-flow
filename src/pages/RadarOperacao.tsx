import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radar, Building2 } from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";
import EfficiencyTable from "@/components/EfficiencyTable";

type StatusLevel = "verde" | "amarelo" | "vermelho";

interface UnitRadar {
  id: string;
  name: string;
  financeiro: StatusLevel;
  estoque: StatusLevel;
  recebimento: StatusLevel;
  statusGeral: "Saudável" | "Monitorar" | "Atenção" | "Risco";
}

const statusColors: Record<StatusLevel, string> = {
  verde: "bg-success/15 text-success border-success/30",
  amarelo: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vermelho: "bg-destructive/15 text-destructive border-destructive/30",
};

const geralColors: Record<string, string> = {
  "Saudável": "bg-success/15 text-success border-success/30",
  "Monitorar": "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "Atenção": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Risco": "bg-destructive/15 text-destructive border-destructive/30",
};

function deriveGeral(f: StatusLevel, e: StatusLevel, r: StatusLevel): UnitRadar["statusGeral"] {
  const scores = { verde: 0, amarelo: 1, vermelho: 2 };
  const total = scores[f] + scores[e] + scores[r];
  if (total === 0) return "Saudável";
  if (total <= 2) return "Monitorar";
  if (total <= 4) return "Atenção";
  return "Risco";
}

export default function RadarOperacao() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [unitRadars, setUnitRadars] = useState<UnitRadar[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<{ unitId: string; unitName: string; target: number | null; realCost: number }[]>([]);

  useEffect(() => {
    if (profile?.company_id) loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);

    const [
      { data: units },
      { data: products },
      { data: mealCostRows },
      { data: weightLogs },
      { data: expiringLots },
    ] = await Promise.all([
      supabase.from("units").select("id, name, type, contract_value, target_meal_cost"),
      supabase.from("products").select("id, nome, estoque_atual, estoque_minimo").eq("ativo", true),
      supabase.from("meal_cost_daily").select("unit_id, real_meal_cost, meals_served, total_food_cost"),
      supabase.from("weight_divergence_logs").select("id, unidade_id, created_at")
        .gte("created_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
      supabase.from("lotes").select("id, unidade_id, validade, quantidade")
        .eq("status", "ativo").gt("quantidade", 0)
        .lte("validade", new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    ]);

    const kitchenUnits = (units || []).filter(u => u.type === "kitchen");

    // Previsão de ruptura — consumo médio 30d
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: consumptionMvs } = await supabase
      .from("movements")
      .select("product_id, quantidade, unidade_id")
      .in("tipo", ["consumo", "saida", "perda"])
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Build per-unit consumption
    const unitConsumption: Record<string, Record<string, number>> = {};
    (consumptionMvs || []).forEach(m => {
      if (!unitConsumption[m.unidade_id]) unitConsumption[m.unidade_id] = {};
      unitConsumption[m.unidade_id][m.product_id] = (unitConsumption[m.unidade_id][m.product_id] || 0) + Number(m.quantidade);
    });

    // Financial aggregation per unit
    const unitFinance: Record<string, { totalCost: number; totalMeals: number }> = {};
    (mealCostRows || []).forEach(r => {
      if (!r.unit_id) return;
      if (!unitFinance[r.unit_id]) unitFinance[r.unit_id] = { totalCost: 0, totalMeals: 0 };
      const meals = Number(r.meals_served) || 0;
      const realCost = Number(r.real_meal_cost) || 0;
      unitFinance[r.unit_id].totalCost += realCost * meals;
      unitFinance[r.unit_id].totalMeals += meals;
    });

    // Weight divergences per unit (last 48h)
    const unitWeightCount: Record<string, number> = {};
    (weightLogs || []).forEach(l => {
      unitWeightCount[l.unidade_id] = (unitWeightCount[l.unidade_id] || 0) + 1;
    });

    // Expiring lots per unit
    const unitExpiringCount: Record<string, number> = {};
    (expiringLots || []).forEach(l => {
      unitExpiringCount[l.unidade_id] = (unitExpiringCount[l.unidade_id] || 0) + 1;
    });

    // Low stock products (global for now, mapped to unit)
    const lowStockProducts = (products || []).filter(
      p => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0
    );

    // Build efficiency data
    const effData: typeof efficiencyData = [];

    const radars: UnitRadar[] = kitchenUnits.map(u => {
      // Financial status
      let financeiro: StatusLevel = "verde";
      const fin = unitFinance[u.id];
      if (fin && fin.totalMeals > 0 && u.contract_value && Number(u.contract_value) > 0) {
        const lucro = Number(u.contract_value) - fin.totalCost;
        const margem = (lucro / Number(u.contract_value)) * 100;
        if (lucro < 0) financeiro = "vermelho";
        else if (margem < 5) financeiro = "amarelo";
      }

      // Efficiency data
      const avgRealCost = fin && fin.totalMeals > 0 ? fin.totalCost / fin.totalMeals : 0;
      effData.push({
        unitId: u.id,
        unitName: u.name,
        target: u.target_meal_cost ? Number(u.target_meal_cost) : null,
        realCost: avgRealCost,
      });

      // Stock status — check low stock + expiring + rupture risk
      let estoque: StatusLevel = "verde";
      const expiringCount = unitExpiringCount[u.id] || 0;
      const hasLowStock = lowStockProducts.length > 0; // simplified: global check

      // Check rupture risk for this unit
      const unitCons = unitConsumption[u.id] || {};
      let ruptureCount = 0;
      (products || []).forEach(p => {
        const consumo = unitCons[p.id];
        if (consumo && consumo > 0) {
          const mediaDiaria = consumo / 30;
          const diasRestantes = Number(p.estoque_atual) / mediaDiaria;
          if (diasRestantes <= 3) ruptureCount++;
        }
      });

      if (ruptureCount > 0 || expiringCount > 3) estoque = "vermelho";
      else if (expiringCount > 0 || hasLowStock) estoque = "amarelo";

      // Receiving status
      let recebimento: StatusLevel = "verde";
      const wCount = unitWeightCount[u.id] || 0;
      if (wCount >= 3) recebimento = "vermelho";
      else if (wCount >= 1) recebimento = "amarelo";

      return {
        id: u.id,
        name: u.name,
        financeiro,
        estoque,
        recebimento,
        statusGeral: deriveGeral(financeiro, estoque, recebimento),
      };
    });

    // Sort by risk (Risco first)
    const geralOrder = { "Risco": 0, "Atenção": 1, "Monitorar": 2, "Saudável": 3 };
    radars.sort((a, b) => geralOrder[a.statusGeral] - geralOrder[b.statusGeral]);

    setUnitRadars(radars);
    setEfficiencyData(effData);
    setLoading(false);
    setLastUpdated(new Date());
  };

  const summary = useMemo(() => {
    const s = { saudavel: 0, monitorar: 0, atencao: 0, risco: 0 };
    unitRadars.forEach(r => {
      if (r.statusGeral === "Saudável") s.saudavel++;
      else if (r.statusGeral === "Monitorar") s.monitorar++;
      else if (r.statusGeral === "Atenção") s.atencao++;
      else s.risco++;
    });
    return s;
  }, [unitRadars]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Radar da Operação
          </h1>
          <p className="text-sm text-muted-foreground">Consolidação de riscos operacionais e financeiros por unidade</p>
        </div>
        <LastUpdated timestamp={lastUpdated} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Saudável", value: summary.saudavel, color: "text-success" },
          { label: "Monitorar", value: summary.monitorar, color: "text-yellow-500" },
          { label: "Atenção", value: summary.atencao, color: "text-orange-400" },
          { label: "Risco", value: summary.risco, color: "text-destructive" },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unit radar table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Status por Unidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Financeiro</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Recebimento</TableHead>
                <TableHead className="text-center">Status Geral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitRadars.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma unidade encontrada
                  </TableCell>
                </TableRow>
              ) : (
                unitRadars.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusColors[r.financeiro]}>
                        {r.financeiro === "verde" ? "Saudável" : r.financeiro === "amarelo" ? "Margem Crítica" : "Prejuízo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusColors[r.estoque]}>
                        {r.estoque === "verde" ? "OK" : r.estoque === "amarelo" ? "Atenção" : "Crítico"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={statusColors[r.recebimento]}>
                        {r.recebimento === "verde" ? "OK" : r.recebimento === "amarelo" ? "Divergência" : "Múltiplas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={geralColors[r.statusGeral]}>
                        {r.statusGeral}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Efficiency Index */}
      <EfficiencyTable data={efficiencyData} />
    </div>
  );
}
