import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, TrendingUp, Percent, UtensilsCrossed, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Unit {
  id: string;
  name: string;
  type: string;
  numero_colaboradores: number;
}

interface Product {
  id: string;
  nome: string;
  custo_unitario: number | null;
}

interface PurchaseItemRow {
  product_id: string;
  quantidade: number;
  custo_unitario: number | null;
  quantidade_estoque: number | null;
  purchase_order_id: string;
}

interface PurchaseOrderRow {
  id: string;
  unidade_id: string;
  status: string;
  created_at: string;
}

interface WasteLogRow {
  quantidade: number;
  unidade_id: string;
  created_at: string;
  product_id: string | null;
}

interface MovementRow {
  product_id: string;
  quantidade: number;
  unidade_id: string;
  created_at: string;
  tipo: string;
}

type PeriodMonths = 3 | 6 | 12;

export default function DashboardFinanceiro() {
  const { canManage } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [wasteLogs, setWasteLogs] = useState<WasteLogRow[]>([]);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodMonths>(6);
  const [filterUnit, setFilterUnit] = useState("all");

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = startOfMonth(subMonths(end, period));
    return { start, end };
  }, [period]);

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    setLoading(true);
    const startISO = dateRange.start.toISOString();

    const [
      { data: u },
      { data: p },
      { data: po },
      { data: w },
      { data: mv },
    ] = await Promise.all([
      supabase.from("units").select("id, name, type, numero_colaboradores"),
      supabase.from("products").select("id, nome, custo_unitario"),
      supabase.from("purchase_orders").select("id, unidade_id, status, created_at").gte("created_at", startISO),
      supabase.from("waste_logs").select("quantidade, unidade_id, created_at, product_id").gte("created_at", startISO),
      supabase.from("movements").select("product_id, quantidade, unidade_id, created_at, tipo").in("tipo", ["consumo", "saida", "perda"]).gte("created_at", startISO),
    ]);

    setUnits((u || []) as Unit[]);
    setProducts((p || []) as Product[]);
    setPurchaseOrders((po || []) as PurchaseOrderRow[]);
    setWasteLogs((w || []) as WasteLogRow[]);
    setMovements((mv || []) as MovementRow[]);

    // Load purchase items for approved/received orders
    const approvedOrders = (po || []).filter(o => o.status === "aprovado" || o.status === "recebido");
    if (approvedOrders.length > 0) {
      const orderIds = approvedOrders.map(o => o.id);
      // Batch in chunks of 50 to avoid query limits
      const allItems: PurchaseItemRow[] = [];
      for (let i = 0; i < orderIds.length; i += 50) {
        const chunk = orderIds.slice(i, i + 50);
        const { data: items } = await supabase
          .from("purchase_items")
          .select("product_id, quantidade, custo_unitario, quantidade_estoque, purchase_order_id")
          .in("purchase_order_id", chunk);
        if (items) allItems.push(...(items as PurchaseItemRow[]));
      }
      setPurchaseItems(allItems);
    } else {
      setPurchaseItems([]);
    }

    setLoading(false);
  };

  // Build product cost map: purchase cost when available, fallback to product.custo_unitario
  const productCostMap = useMemo(() => {
    const map: Record<string, number> = {};
    // Base: product custo_unitario
    products.forEach(p => {
      if (p.custo_unitario) map[p.id] = p.custo_unitario;
    });
    // Override with real purchase costs (latest wins)
    const orderDateMap: Record<string, string> = {};
    purchaseOrders.forEach(o => { orderDateMap[o.id] = o.created_at; });
    const sorted = [...purchaseItems].sort((a, b) => {
      const da = orderDateMap[a.purchase_order_id] || "";
      const db = orderDateMap[b.purchase_order_id] || "";
      return da.localeCompare(db);
    });
    sorted.forEach(item => {
      if (item.custo_unitario && item.custo_unitario > 0) {
        map[item.product_id] = item.custo_unitario;
      }
    });
    return map;
  }, [products, purchaseItems, purchaseOrders]);

  // Order-to-unit map
  const orderUnitMap = useMemo(() => {
    const map: Record<string, string> = {};
    purchaseOrders.forEach(o => { map[o.id] = o.unidade_id; });
    return map;
  }, [purchaseOrders]);

  // ====== KPIs ======

  // Total cost of purchases (approved/received)
  const totalPurchaseCost = useMemo(() => {
    return purchaseItems.reduce((sum, item) => {
      const qty = item.quantidade_estoque || item.quantidade;
      const cost = item.custo_unitario || productCostMap[item.product_id] || 0;
      const unitId = orderUnitMap[item.purchase_order_id];
      if (filterUnit !== "all" && unitId !== filterUnit) return sum;
      return sum + qty * cost;
    }, 0);
  }, [purchaseItems, productCostMap, orderUnitMap, filterUnit]);

  // Total waste cost
  const totalWasteCost = useMemo(() => {
    return wasteLogs.reduce((sum, w) => {
      if (filterUnit !== "all" && w.unidade_id !== filterUnit) return sum;
      const cost = w.product_id ? (productCostMap[w.product_id] || 0) : 0;
      return sum + Number(w.quantidade) * cost;
    }, 0);
  }, [wasteLogs, productCostMap, filterUnit]);

  // Total waste kg
  const totalWasteKg = useMemo(() => {
    return wasteLogs.reduce((sum, w) => {
      if (filterUnit !== "all" && w.unidade_id !== filterUnit) return sum;
      return sum + Number(w.quantidade);
    }, 0);
  }, [wasteLogs, filterUnit]);

  // Total meals estimate
  const totalMeals = useMemo(() => {
    const filteredUnits = filterUnit === "all"
      ? units.filter(u => u.type === "kitchen")
      : units.filter(u => u.id === filterUnit && u.type === "kitchen");
    
    // Count distinct days with movements for each unit
    const unitDays: Record<string, Set<string>> = {};
    movements.forEach(m => {
      if (filterUnit !== "all" && m.unidade_id !== filterUnit) return;
      if (!unitDays[m.unidade_id]) unitDays[m.unidade_id] = new Set();
      unitDays[m.unidade_id].add(m.created_at.slice(0, 10));
    });

    let meals = 0;
    filteredUnits.forEach(u => {
      const days = unitDays[u.id]?.size || 1;
      meals += u.numero_colaboradores * days;
    });
    return meals;
  }, [units, movements, filterUnit]);

  // Cost per meal
  const costPerMeal = totalMeals > 0 ? totalPurchaseCost / totalMeals : 0;

  // Waste % vs total cost
  const wastePercentage = totalPurchaseCost > 0 ? (totalWasteCost / totalPurchaseCost) * 100 : 0;

  // ====== Cost by unit ======
  const costByUnit = useMemo(() => {
    const unitCost: Record<string, { purchases: number; waste: number; meals: number }> = {};

    // Purchases by unit
    purchaseItems.forEach(item => {
      const unitId = orderUnitMap[item.purchase_order_id];
      if (!unitId) return;
      if (!unitCost[unitId]) unitCost[unitId] = { purchases: 0, waste: 0, meals: 0 };
      const qty = item.quantidade_estoque || item.quantidade;
      const cost = item.custo_unitario || productCostMap[item.product_id] || 0;
      unitCost[unitId].purchases += qty * cost;
    });

    // Waste by unit
    wasteLogs.forEach(w => {
      if (!unitCost[w.unidade_id]) unitCost[w.unidade_id] = { purchases: 0, waste: 0, meals: 0 };
      const cost = w.product_id ? (productCostMap[w.product_id] || 0) : 0;
      unitCost[w.unidade_id].waste += Number(w.quantidade) * cost;
    });

    // Meals by unit
    const unitDays: Record<string, Set<string>> = {};
    movements.forEach(m => {
      if (!unitDays[m.unidade_id]) unitDays[m.unidade_id] = new Set();
      unitDays[m.unidade_id].add(m.created_at.slice(0, 10));
    });
    units.filter(u => u.type === "kitchen").forEach(u => {
      if (!unitCost[u.id]) unitCost[u.id] = { purchases: 0, waste: 0, meals: 0 };
      const days = unitDays[u.id]?.size || 1;
      unitCost[u.id].meals = u.numero_colaboradores * days;
    });

    return units
      .filter(u => unitCost[u.id] && (unitCost[u.id].purchases > 0 || unitCost[u.id].waste > 0))
      .map(u => ({
        id: u.id,
        name: u.name,
        type: u.type,
        ...unitCost[u.id],
        costPerMeal: unitCost[u.id].meals > 0 ? unitCost[u.id].purchases / unitCost[u.id].meals : 0,
        wastePercent: unitCost[u.id].purchases > 0 ? (unitCost[u.id].waste / unitCost[u.id].purchases) * 100 : 0,
      }))
      .sort((a, b) => b.purchases - a.purchases);
  }, [purchaseItems, wasteLogs, movements, units, productCostMap, orderUnitMap]);

  // ====== Monthly evolution ======
  const monthlyData = useMemo(() => {
    const months: { label: string; purchases: number; waste: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const label = format(date, "MMM/yy", { locale: ptBR });

      let purchasesCost = 0;
      purchaseItems.forEach(item => {
        const orderDate = purchaseOrders.find(o => o.id === item.purchase_order_id)?.created_at;
        if (!orderDate) return;
        const d = new Date(orderDate);
        if (d >= monthStart && d <= monthEnd) {
          if (filterUnit !== "all" && orderUnitMap[item.purchase_order_id] !== filterUnit) return;
          const qty = item.quantidade_estoque || item.quantidade;
          const cost = item.custo_unitario || productCostMap[item.product_id] || 0;
          purchasesCost += qty * cost;
        }
      });

      let wasteCost = 0;
      wasteLogs.forEach(w => {
        const d = new Date(w.created_at);
        if (d >= monthStart && d <= monthEnd) {
          if (filterUnit !== "all" && w.unidade_id !== filterUnit) return;
          const cost = w.product_id ? (productCostMap[w.product_id] || 0) : 0;
          wasteCost += Number(w.quantidade) * cost;
        }
      });

      months.push({ label, purchases: purchasesCost, waste: wasteCost });
    }
    return months;
  }, [period, purchaseItems, wasteLogs, purchaseOrders, productCostMap, orderUnitMap, filterUnit]);

  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || "—";

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise de custos e eficiência operacional</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as PeriodMonths)}>
            <SelectTrigger className="w-[140px] bg-input border-border" data-guide="filter-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-[160px] bg-input border-border" data-guide="filter-unit-fin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {units.filter(u => u.type === "kitchen").map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-guide="kpi-cards">
        {/* Custo por refeição */}
        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">R$/Refeição</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {costPerMeal > 0 ? formatCurrency(costPerMeal) : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {totalMeals > 0 ? `${totalMeals.toLocaleString("pt-BR")} refeições estimadas` : "sem dados de refeições"}
            </p>
          </CardContent>
        </Card>

        {/* Custo total */}
        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-chart-4 rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-chart-4" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custo Total</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {formatCurrency(totalPurchaseCost)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">em compras no período</p>
          </CardContent>
        </Card>

        {/* Custo desperdício */}
        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive rounded-l-xl" />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-destructive" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Desperdício</span>
            </div>
            <p className="text-2xl font-bold font-display text-foreground">
              {formatCurrency(totalWasteCost)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{totalWasteKg.toFixed(1)} kg desperdiçados</p>
          </CardContent>
        </Card>

        {/* % Desperdício vs Custo */}
        <Card className="relative overflow-hidden">
          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
            wastePercentage < 3 ? "bg-success" : wastePercentage < 7 ? "bg-warning" : "bg-destructive"
          }`} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Percent className="h-5 w-5" style={{ color: wastePercentage < 3 ? "hsl(var(--success))" : wastePercentage < 7 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">% Desp/Custo</span>
            </div>
            <p className={`text-2xl font-bold font-display ${
              wastePercentage < 3 ? "text-success" : wastePercentage < 7 ? "text-warning" : "text-destructive"
            }`}>
              {totalPurchaseCost > 0 ? `${wastePercentage.toFixed(1)}%` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {wastePercentage < 3 ? "Excelente" : wastePercentage < 7 ? "Atenção" : "Crítico"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly evolution */}
        <Card data-guide="chart-monthly">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-display">Evolução Mensal de Custos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "purchases" ? "Compras" : "Desperdício"
                  ]}
                />
                <Legend formatter={(value) => value === "purchases" ? "Compras" : "Desperdício"} />
                <Line type="monotone" dataKey="purchases" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="waste" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost by unit bar chart */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-display">Custo por Unidade/Contrato</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costByUnit.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "purchases" ? "Compras" : "Desperdício"
                  ]}
                />
                <Bar dataKey="purchases" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="purchases" />
                <Bar dataKey="waste" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="waste" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader className="pb-2 p-4">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Ranking por Contrato/Unidade
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Custo Compras</TableHead>
                  <TableHead className="text-right">Custo Desperdício</TableHead>
                  <TableHead className="text-right">% Desp/Custo</TableHead>
                  <TableHead className="text-right">R$/Refeição</TableHead>
                  <TableHead className="text-right">Refeições</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costByUnit.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum dado financeiro no período.
                    </TableCell>
                  </TableRow>
                ) : (
                  costByUnit.map(u => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium">
                        {u.name}
                        <Badge variant="outline" className="ml-2 text-[10px]">{u.type === "cd" ? "CD" : "Cozinha"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(u.purchases)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(u.waste)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-semibold ${
                          u.wastePercent < 3 ? "text-success" : u.wastePercent < 7 ? "text-warning" : "text-destructive"
                        }`}>
                          {u.purchases > 0 ? `${u.wastePercent.toFixed(1)}%` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {u.costPerMeal > 0 ? formatCurrency(u.costPerMeal) : "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {u.meals > 0 ? u.meals.toLocaleString("pt-BR") : "—"}
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
