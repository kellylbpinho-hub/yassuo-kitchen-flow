import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingDown, DollarSign, Percent, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WasteLog {
  id: string;
  quantidade: number;
  sobra_prato: number;
  sobra_limpa_rampa: number;
  desperdicio_total_organico: number;
  observacao: string | null;
  unidade_id: string;
  product_id: string;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
  type: string;
  numero_colaboradores: number;
}

interface Product {
  id: string;
  nome: string;
  custo_unitario: number;
  unidade_medida: string;
}

type PeriodType = "diario" | "semanal" | "mensal";

const CHART_COLORS = [
  "hsl(350, 95%, 43%)", // primary
  "hsl(45, 100%, 50%)", // warning
  "hsl(142, 71%, 45%)", // success
  "hsl(200, 80%, 50%)",
  "hsl(280, 70%, 55%)",
  "hsl(30, 90%, 55%)",
  "hsl(170, 60%, 45%)",
  "hsl(320, 70%, 50%)",
];

export default function DesperdicioContrato() {
  const { isCeo, isGerenteOperacional } = useAuth();
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("semanal");
  const [filterUnit, setFilterUnit] = useState("all");

  useEffect(() => {
    loadData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "diario":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "semanal":
        return { start: startOfWeek(subWeeks(now, 4), { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "mensal":
        return { start: startOfMonth(subMonths(now, 6)), end: endOfMonth(now) };
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    const [{ data: wasteData }, { data: unitsData }, { data: productsData }] = await Promise.all([
      supabase
        .from("waste_logs")
        .select("id, quantidade, sobra_prato, sobra_limpa_rampa, desperdicio_total_organico, observacao, unidade_id, product_id, created_at")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("units").select("id, name, type, numero_colaboradores"),
      supabase.from("products").select("id, nome, custo_unitario, unidade_medida"),
    ]);

    setLogs((wasteData || []) as WasteLog[]);
    setUnits((unitsData || []) as Unit[]);
    setProducts((productsData || []) as Product[]);
    setLoading(false);
  };

  const kitchenUnits = useMemo(() => units.filter((u) => u.type === "kitchen"), [units]);

  const filteredLogs = useMemo(() => {
    if (filterUnit === "all") return logs;
    return logs.filter((l) => l.unidade_id === filterUnit);
  }, [logs, filterUnit]);

  const getProductName = (id: string) => products.find((p) => p.id === id)?.nome || "—";
  const getProductCost = (id: string) => Number(products.find((p) => p.id === id)?.custo_unitario || 0);
  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

  // Summary KPIs
  const kpis = useMemo(() => {
    const totalSobraPrato = filteredLogs.reduce((s, l) => s + Number(l.sobra_prato), 0);
    const totalSobraRampa = filteredLogs.reduce((s, l) => s + Number(l.sobra_limpa_rampa), 0);
    const totalOrganico = filteredLogs.reduce((s, l) => s + Number(l.desperdicio_total_organico), 0);
    const totalQty = filteredLogs.reduce((s, l) => s + Number(l.quantidade), 0);
    const totalCost = filteredLogs.reduce((s, l) => s + Number(l.quantidade) * getProductCost(l.product_id), 0);

    // Estimate total meals in the period based on numero_colaboradores
    const relevantUnits = filterUnit === "all"
      ? kitchenUnits
      : kitchenUnits.filter((u) => u.id === filterUnit);
    const totalColaboradores = relevantUnits.reduce((s, u) => s + (u.numero_colaboradores || 0), 0);

    // Count distinct days with waste logs
    const distinctDays = new Set(filteredLogs.map((l) => l.created_at.slice(0, 10))).size;
    const estimatedMeals = totalColaboradores * Math.max(distinctDays, 1);

    // kg per meal (per capita waste)
    const kgPerMeal = estimatedMeals > 0 ? totalQty / estimatedMeals : 0;
    // percentage: waste vs estimated production (assuming ~0.5kg per meal as production baseline)
    const percentVsProduced = estimatedMeals > 0 ? (totalQty / (estimatedMeals * 0.5)) * 100 : 0;

    return {
      totalKg: totalQty,
      totalCost,
      sobraPrato: totalSobraPrato,
      sobraRampa: totalSobraRampa,
      organico: totalOrganico,
      totalPesagens: totalSobraPrato + totalSobraRampa + totalOrganico,
      kgPerMeal,
      percentVsProduced,
      estimatedMeals,
    };
  }, [filteredLogs, products, kitchenUnits, filterUnit]);

  // Data by unit (contract)
  const dataByUnit = useMemo(() => {
    const map = new Map<string, { unitId: string; unit: string; sobraPrato: number; sobraRampa: number; organico: number; totalKg: number; custoTotal: number; registros: number; days: Set<string> }>();

    for (const log of logs) {
      const existing = map.get(log.unidade_id) || {
        unitId: log.unidade_id,
        unit: getUnitName(log.unidade_id),
        sobraPrato: 0,
        sobraRampa: 0,
        organico: 0,
        totalKg: 0,
        custoTotal: 0,
        registros: 0,
        days: new Set<string>(),
      };
      existing.sobraPrato += Number(log.sobra_prato);
      existing.sobraRampa += Number(log.sobra_limpa_rampa);
      existing.organico += Number(log.desperdicio_total_organico);
      existing.totalKg += Number(log.quantidade);
      existing.custoTotal += Number(log.quantidade) * getProductCost(log.product_id);
      existing.registros += 1;
      existing.days.add(log.created_at.slice(0, 10));
      map.set(log.unidade_id, existing);
    }

    return Array.from(map.values())
      .map((row) => {
        const u = units.find((u) => u.id === row.unitId);
        const colab = u?.numero_colaboradores || 0;
        const distinctDays = row.days.size || 1;
        const estimatedMeals = colab * distinctDays;
        const percentVsProduced = estimatedMeals > 0 ? (row.totalKg / (estimatedMeals * 0.5)) * 100 : 0;
        return { ...row, percentVsProduced };
      })
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [logs, products, units]);

  // Pie chart data for waste composition
  const pieData = useMemo(() => [
    { name: "Sobra de Prato", value: kpis.sobraPrato },
    { name: "Sobra da Rampa", value: kpis.sobraRampa },
    { name: "Orgânico", value: kpis.organico },
  ].filter((d) => d.value > 0), [kpis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Desperdício por Contrato</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de desperdício por unidade operacional
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-36 bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Últimos 7 dias</SelectItem>
              <SelectItem value="semanal">Últimas 4 semanas</SelectItem>
              <SelectItem value="mensal">Últimos 6 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-44 bg-input border-border">
              <SelectValue placeholder="Todos contratos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos contratos</SelectItem>
              {kitchenUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trash2 className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Total Desperdiçado</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.totalKg.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">{filteredLogs.length} registros</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Custo do Desperdício</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              R$ {kpis.totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Sobra de Prato</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.sobraPrato.toFixed(1)} kg</p>
            <p className="text-xs text-muted-foreground">Resto-Ingesta</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Sobra Rampa + Orgânico</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{(kpis.sobraRampa + kpis.organico).toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">% Desp. vs Produzido</span>
            </div>
            <p className={`text-2xl font-bold ${kpis.percentVsProduced > 10 ? "text-destructive" : kpis.percentVsProduced > 5 ? "text-warning" : "text-success"}`}>
              {kpis.percentVsProduced.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {kpis.kgPerMeal.toFixed(3)} kg/refeição · {kpis.estimatedMeals.toLocaleString("pt-BR")} ref. est.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart by unit */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Desperdício por Contrato (kg)</CardTitle>
          </CardHeader>
          <CardContent>
            {dataByUnit.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dataByUnit.slice(0, 10)} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis dataKey="unit" type="category" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} kg`]}
                  />
                  <Bar dataKey="sobraPrato" name="Sobra Prato" stackId="a" fill="hsl(350, 95%, 43%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="sobraRampa" name="Sobra Rampa" stackId="a" fill="hsl(45, 100%, 50%)" />
                  <Bar dataKey="organico" name="Orgânico" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart composition */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Composição do Desperdício</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} kg`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table by contract */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Ranking por Contrato</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Contrato (Unidade)</TableHead>
                  <TableHead className="text-right">Sobra Prato (kg)</TableHead>
                  <TableHead className="text-right">Sobra Rampa (kg)</TableHead>
                  <TableHead className="text-right">Orgânico (kg)</TableHead>
                  <TableHead className="text-right">Total (kg)</TableHead>
                  <TableHead className="text-right">% vs Produzido</TableHead>
                  <TableHead className="text-right">Custo (R$)</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataByUnit.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum dado de desperdício no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  dataByUnit.map((row, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{i + 1}º</Badge>
                          <span className="font-medium">{row.unit}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.sobraPrato.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{row.sobraRampa.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{row.organico.toFixed(1)}</TableCell>
                      <TableCell className="text-right font-semibold">{row.totalKg.toFixed(1)}</TableCell>
                      <TableCell className={`text-right font-semibold ${row.percentVsProduced > 10 ? "text-destructive" : row.percentVsProduced > 5 ? "text-warning" : row.percentVsProduced > 0 ? "text-success" : "text-muted-foreground"}`}>
                        {row.percentVsProduced > 0 ? `${row.percentVsProduced.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right text-warning">
                        R$ {row.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{row.registros}</TableCell>
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
