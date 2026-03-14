import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, UtensilsCrossed, TrendingDown, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Props {
  period: number;
  filterUnit: string;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RealMealCostSection({ period, filterUnit }: Props) {
  const [data, setData] = useState<MealCostRow[]>([]);
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

      const { data: rows } = await query;
      setData((rows || []) as unknown as MealCostRow[]);
      setLoading(false);
    };
    load();
  }, [period, filterUnit]);

  // Aggregate KPI
  const kpi = useMemo(() => {
    if (data.length === 0) return { avgCost: 0, totalFood: 0, totalWaste: 0, totalMeals: 0, trend: 0 };

    const totalFood = data.reduce((s, r) => s + Number(r.total_food_cost), 0);
    const totalWaste = data.reduce((s, r) => s + Number(r.waste_cost), 0);
    const totalMeals = data.reduce((s, r) => s + Number(r.meals_served), 0);
    const avgCost = totalMeals > 0 ? Math.max(0, (totalFood - totalWaste) / totalMeals) : 0;

    // Trend: compare last 30 days vs previous 30 days
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const d60 = new Date(now.getTime() - 60 * 86400000);

    const recent = data.filter(r => new Date(r.date) >= d30);
    const prev = data.filter(r => new Date(r.date) >= d60 && new Date(r.date) < d30);

    const recentMeals = recent.reduce((s, r) => s + Number(r.meals_served), 0);
    const prevMeals = prev.reduce((s, r) => s + Number(r.meals_served), 0);
    const recentCost = recentMeals > 0
      ? (recent.reduce((s, r) => s + Number(r.total_food_cost) - Number(r.waste_cost), 0)) / recentMeals
      : 0;
    const prevCost = prevMeals > 0
      ? (prev.reduce((s, r) => s + Number(r.total_food_cost) - Number(r.waste_cost), 0)) / prevMeals
      : 0;

    const trend = prevCost > 0 ? ((recentCost - prevCost) / prevCost) * 100 : 0;

    return { avgCost, totalFood, totalWaste, totalMeals, trend };
  }, [data]);

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
      const realCost = meals > 0 ? (food - waste) / meals : 0;

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
        realCost: v.meals > 0 ? (v.food - v.waste) / v.meals : 0,
        grossCost: v.meals > 0 ? v.food / v.meals : 0,
      }))
      .sort((a, b) => b.realCost - a.realCost);
  }, [data]);

  if (loading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden" data-guide="kpi-real-meal-cost">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo Real/Refeição</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {kpi.avgCost > 0 ? formatCurrency(kpi.avgCost) : "—"}
            </p>
            {kpi.trend !== 0 && (
              <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${kpi.trend > 0 ? "text-destructive" : "text-success"}`}>
                {kpi.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(kpi.trend).toFixed(1)}% vs mês anterior
              </p>
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
            <p className="text-[11px] text-muted-foreground mt-0.5">
              sem descontar desperdício
            </p>
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
            <p className="text-[11px] text-muted-foreground mt-0.5">
              custo do desperdício por refeição
            </p>
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
                  name === "realCost" ? "Custo Real" : name === "foodCost" ? "Custo Bruto" : "Impacto Desperdício"
                ]}
              />
              <Legend formatter={(v) => v === "realCost" ? "Custo Real" : v === "foodCost" ? "Custo Bruto" : "Impacto Desperdício"} />
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
                  <TableHead className="text-right">Custo Bruto/Ref</TableHead>
                  <TableHead className="text-right">Desperdício/Ref</TableHead>
                  <TableHead className="text-right">Custo Real/Ref</TableHead>
                  <TableHead className="text-right">Refeições</TableHead>
                  <TableHead className="text-right">Dias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitTable.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum dado de custo real no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  unitTable.map(u => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(u.grossCost)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(u.meals > 0 ? u.waste / u.meals : 0)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-foreground">{formatCurrency(u.realCost)}</span>
                      </TableCell>
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
