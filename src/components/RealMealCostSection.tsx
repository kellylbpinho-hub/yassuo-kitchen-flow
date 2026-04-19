import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, UtensilsCrossed, TrendingDown, TrendingUp, Target, FileText, FileSpreadsheet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateMealCostPDF, generateMealCostExcel, type MealCostExportData } from "@/lib/mealCostExport";

interface MealCostRow {
  date: string;
  unit_id: string;
  unit_name: string;
  meals_served: number;
  total_food_cost: number;
  waste_cost: number;
  waste_kg: number;
  real_meal_cost: number;
}

interface UnitTarget {
  id: string;
  target_meal_cost: number | null;
}

export interface MealCostSectionData {
  avgCost: number;
  grossPerMeal: number;
  wastePerMeal: number;
  avgTarget: number | null;
  deviationPct: number | null;
  deviationR: number | null;
  trend: number;
  totalMeals: number;
  chartData: { label: string; realCost: number; foodCost: number; wasteCost: number }[];
  unitTable: { name: string; grossCost: number; realCost: number; waste: number; meals: number; days: number; target: number | null }[];
}

interface Props {
  period: number;
  filterUnit: string;
  onDataReady?: (data: MealCostSectionData) => void;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getDeviationStatus(real: number, target: number | null): { color: string; label: string; percent: number; diff: number } {
  if (target === null || target <= 0 || real === 0) return { color: "", label: "Sem meta", percent: 0, diff: 0 };
  const diff = real - target;
  const percent = (diff / target) * 100;
  if (percent <= 0) return { color: "text-success", label: "Dentro da meta", percent, diff };
  if (percent <= 5) return { color: "text-warning", label: "Atenção", percent, diff };
  return { color: "text-destructive", label: "Acima da meta", percent, diff };
}

function DeviationBadge({ real, target }: { real: number; target: number | null }) {
  const s = getDeviationStatus(real, target);
  if (target === null || target <= 0) return <span className="text-[11px] text-muted-foreground italic">Sem meta</span>;
  if (real === 0) return <span className="text-[11px] text-muted-foreground">—</span>;

  const bgClass = s.percent <= 0 ? "bg-success/15 text-success border-success/30"
    : s.percent <= 5 ? "bg-warning/15 text-warning border-warning/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${bgClass}`}>
      {s.percent > 0 ? "+" : ""}{s.percent.toFixed(1)}%
    </Badge>
  );
}

export default function RealMealCostSection({ period, filterUnit, onDataReady }: Props) {
  const [data, setData] = useState<MealCostRow[]>([]);
  const [targets, setTargets] = useState<UnitTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const startDate = startOfMonth(subMonths(new Date(), period)).toISOString().slice(0, 10);

      let query = supabase
        .from("meal_cost_daily" as any)
        .select("*")
        .gte("date", startDate);

      if (filterUnit !== "all") {
        query = query.eq("unit_id", filterUnit);
      }

      const [{ data: rows }, { data: units }] = await Promise.all([
        query,
        supabase.from("units").select("id, target_meal_cost" as any),
      ]);

      setData((rows || []) as unknown as MealCostRow[]);
      setTargets((units || []) as unknown as UnitTarget[]);
      setLoading(false);
    };
    load();
  }, [period, filterUnit]);

  const targetMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    targets.forEach(t => { m[t.id] = t.target_meal_cost; });
    return m;
  }, [targets]);

  // Weighted average target for filtered view
  const avgTarget = useMemo(() => {
    const relevantUnits = filterUnit !== "all"
      ? targets.filter(t => t.id === filterUnit)
      : targets.filter(t => t.target_meal_cost !== null && t.target_meal_cost > 0);
    if (relevantUnits.length === 0) return null;
    const sum = relevantUnits.reduce((s, t) => s + (t.target_meal_cost || 0), 0);
    return sum / relevantUnits.length;
  }, [targets, filterUnit]);

  // Aggregate KPI
  const kpi = useMemo(() => {
    if (data.length === 0) return { avgCost: 0, totalFood: 0, totalWaste: 0, totalMeals: 0, trend: 0 };

    const totalFood = data.reduce((s, r) => s + Number(r.total_food_cost), 0);
    const totalWaste = data.reduce((s, r) => s + Number(r.waste_cost), 0);
    const totalMeals = data.reduce((s, r) => s + Number(r.meals_served), 0);
    const avgCost = totalMeals > 0 ? Math.max(0, (totalFood - totalWaste) / totalMeals) : 0;

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);
    const recent = data.filter(r => new Date(r.date) >= d30);
    const prev = data.filter(r => new Date(r.date) >= d60 && new Date(r.date) < d30);
    const recentMeals = recent.reduce((s, r) => s + Number(r.meals_served), 0);
    const prevMeals = prev.reduce((s, r) => s + Number(r.meals_served), 0);
    const recentCost = recentMeals > 0
      ? recent.reduce((s, r) => s + Number(r.total_food_cost) - Number(r.waste_cost), 0) / recentMeals : 0;
    const prevCost = prevMeals > 0
      ? prev.reduce((s, r) => s + Number(r.total_food_cost) - Number(r.waste_cost), 0) / prevMeals : 0;
    const trend = prevCost > 0 ? ((recentCost - prevCost) / prevCost) * 100 : 0;

    return { avgCost, totalFood, totalWaste, totalMeals, trend };
  }, [data]);

  const deviationKpi = useMemo(() => getDeviationStatus(kpi.avgCost, avgTarget), [kpi.avgCost, avgTarget]);

  // Monthly chart data
  const chartData = useMemo(() => {
    const months: { label: string; realCost: number; foodCost: number; wasteCost: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStr = format(date, "yyyy-MM");
      const label = format(date, "MMM/yy", { locale: ptBR });
      const monthRows = data.filter(r => r.date.startsWith(monthStr));
      const food = monthRows.reduce((s, r) => s + Number(r.total_food_cost), 0);
      const waste = monthRows.reduce((s, r) => s + Number(r.waste_cost), 0);
      const meals = monthRows.reduce((s, r) => s + Number(r.meals_served), 0);
      const realCost = meals > 0 ? Math.max(0, (food - waste) / meals) : 0;
      months.push({ label, realCost, foodCost: meals > 0 ? food / meals : 0, wasteCost: meals > 0 ? waste / meals : 0 });
    }
    return months;
  }, [data, period]);

  // Per-unit table
  const unitTable = useMemo(() => {
    const map: Record<string, { name: string; food: number; waste: number; meals: number; days: Set<string> }> = {};
    data.forEach(r => {
      if (!map[r.unit_id]) map[r.unit_id] = { name: r.unit_name, food: 0, waste: 0, meals: 0, days: new Set() };
      map[r.unit_id].food += Number(r.total_food_cost);
      map[r.unit_id].waste += Number(r.waste_cost);
      map[r.unit_id].meals += Number(r.meals_served);
      map[r.unit_id].days.add(r.date);
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        id,
        name: v.name,
        food: v.food,
        waste: v.waste,
        meals: v.meals,
        days: v.days.size,
        realCost: v.meals > 0 ? Math.max(0, (v.food - v.waste) / v.meals) : 0,
        grossCost: v.meals > 0 ? v.food / v.meals : 0,
        target: targetMap[id] ?? null,
      }))
      .sort((a, b) => b.realCost - a.realCost);
  }, [data, targetMap]);

  // Expose data to parent
  useEffect(() => {
    if (!loading && onDataReady) {
      const grossPerMeal = kpi.totalMeals > 0 ? kpi.totalFood / kpi.totalMeals : 0;
      const wastePerMeal = kpi.totalMeals > 0 ? kpi.totalWaste / kpi.totalMeals : 0;
      const deviationPct = avgTarget && avgTarget > 0 && kpi.avgCost > 0
        ? ((kpi.avgCost - avgTarget) / avgTarget * 100) : null;
      const deviationR = avgTarget && avgTarget > 0 && kpi.avgCost > 0
        ? kpi.avgCost - avgTarget : null;
      onDataReady({
        avgCost: kpi.avgCost,
        grossPerMeal,
        wastePerMeal,
        avgTarget,
        deviationPct,
        deviationR,
        trend: kpi.trend,
        totalMeals: kpi.totalMeals,
        chartData,
        unitTable: unitTable.map(u => ({
          name: u.name, grossCost: u.grossCost, realCost: u.realCost,
          waste: u.waste, meals: u.meals, days: u.days, target: u.target,
        })),
      });
    }
  }, [loading, kpi, avgTarget, chartData, unitTable, onDataReady]);


  const buildExportData = (): MealCostExportData => ({
    period: `Últimos ${period} meses`,
    filterUnitName: filterUnit === "all" ? "Todas as unidades" : (unitTable.find(u => u.id === filterUnit)?.name || filterUnit),
    kpi,
    avgTarget,
    chartData,
    unitTable: unitTable.map(u => ({
      name: u.name,
      grossCost: u.grossCost,
      realCost: u.realCost,
      waste: u.waste,
      meals: u.meals,
      days: u.days,
      target: u.target,
    })),
  });

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => generateMealCostPDF(buildExportData())}>
          <FileText className="h-3.5 w-3.5" /> Exportar PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => generateMealCostExcel(buildExportData())}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
        </Button>
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="relative overflow-hidden" data-guide="kpi-real-meal-cost">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo Real/Refeição</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {kpi.totalFood > 0 && kpi.avgCost > 0 ? formatCurrency(kpi.avgCost) : "—"}
            </p>
            {kpi.trend !== 0 && (
              <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${kpi.trend > 0 ? "text-destructive" : "text-success"}`}>
                {kpi.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(kpi.trend).toFixed(1)}% vs mês anterior
              </p>
            )}
          </CardContent>
        </Card>

        {/* Meta KPI */}
        <Card className="relative overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
            avgTarget === null ? "bg-muted-foreground"
            : deviationKpi.percent <= 0 ? "bg-success"
            : deviationKpi.percent <= 5 ? "bg-warning/15"
            : "bg-destructive"
          }`} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Meta vs Real</span>
            </div>
            {avgTarget !== null && avgTarget > 0 ? (
              <>
                <p className="text-2xl font-bold font-display text-foreground">
                  {formatCurrency(avgTarget)}
                </p>
                {kpi.avgCost > 0 && (
                  <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${deviationKpi.color}`}>
                    Desvio: {deviationKpi.percent > 0 ? "+" : ""}{deviationKpi.percent.toFixed(1)}%
                    ({deviationKpi.diff > 0 ? "+" : ""}{formatCurrency(deviationKpi.diff)})
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-bold font-display text-muted-foreground">—</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 italic">Sem meta definida</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-chart-4 rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo Bruto/Refeição</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {kpi.totalMeals > 0 ? formatCurrency(kpi.totalFood / kpi.totalMeals) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">sem descontar desperdício</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Impacto Desperdício/Ref</span>
            </div>
            <p className="text-2xl font-bold font-display text-destructive">
              {kpi.totalMeals > 0 ? formatCurrency(kpi.totalWaste / kpi.totalMeals) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">custo do desperdício por refeição</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution Chart */}
      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-sm font-display">Evolução do Custo Real por Refeição</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v.toFixed(1)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === "realCost" ? "Custo Real" : name === "foodCost" ? "Custo Bruto" : name === "wasteCost" ? "Impacto Desperdício" : "Meta"
                ]}
              />
              <Legend formatter={(v) => v === "realCost" ? "Custo Real" : v === "foodCost" ? "Custo Bruto" : v === "wasteCost" ? "Impacto Desperdício" : "Meta"} />
              {avgTarget !== null && avgTarget > 0 && (
                <ReferenceLine
                  y={avgTarget}
                  stroke="hsl(var(--success))"
                  strokeDasharray="8 4"
                  strokeWidth={2}
                  label={{ value: `Meta ${formatCurrency(avgTarget)}`, position: "insideTopRight", fill: "hsl(var(--success))", fontSize: 11 }}
                />
              )}
              <Line type="monotone" dataKey="realCost" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="foodCost" stroke="hsl(var(--chart-4))" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="wasteCost" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Per-unit table */}
      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-sm font-display">Custo Real por Contrato/Unidade</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Meta/Ref</TableHead>
                  <TableHead className="text-right">Custo Real/Ref</TableHead>
                  <TableHead className="text-right">Desvio</TableHead>
                  <TableHead className="text-right">Custo Bruto/Ref</TableHead>
                  <TableHead className="text-right">Desperdício/Ref</TableHead>
                  <TableHead className="text-right">Refeições</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitTable.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum dado de custo real no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  unitTable.map(u => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {u.target !== null && u.target > 0 ? formatCurrency(u.target) : <span className="italic text-[11px]">Sem meta</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-foreground">{formatCurrency(u.realCost)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DeviationBadge real={u.realCost} target={u.target} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(u.grossCost)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(u.meals > 0 ? u.waste / u.meals : 0)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{u.meals.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-[10px]">{u.days}d</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
