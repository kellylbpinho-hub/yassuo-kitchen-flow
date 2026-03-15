import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Package, AlertTriangle, TrendingDown, DollarSign, Clock, CheckCircle2, ShieldAlert, FileDown, ShoppingCart, ClipboardCheck, RotateCcw } from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { generatePerformancePDF } from "@/lib/pdfExport";
import { getTurnoverAlertDays } from "@/lib/gs1Parser";

interface SlowTurnoverItem {
  produtoNome: string;
  loteCodigo: string;
  diasEmEstoque: number;
  limiteGiro: number;
  quantidade: number;
  unidadeNome: string;
  categoria: string;
}

interface DashboardData {
  totalEstoqueValor: number;
  itensAbaixoMinimo: number;
  perdasMes: { kg: number; valor: number };
  rankingUnidades: { name: string; desperdicio: number }[];
  lotesVencendo: number;
  lotesVencidos: number;
  estoquesZerados: number;
  lowStockItems: { nome: string; estoque_atual: number; estoque_minimo: number; unidade_medida: string }[];
  totalProdutos: number;
  ultimasMovimentacoes: { id: string; produto: string; tipo: string; quantidade: number; data: string }[];
  wasteData: { sobraLimpa: number; restoIngesta: number };
  custoMedioRefeicao: number;
  pedidosStatus: { name: string; value: number }[];
  totalPedidos: number;
  pedidosPendentes: number;
  slowTurnoverItems: SlowTurnoverItem[];
}

const PIE_COLORS = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--success))"];

export default function Dashboard() {
  const { canSeeCosts } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({
    totalEstoqueValor: 0, itensAbaixoMinimo: 0, perdasMes: { kg: 0, valor: 0 },
    rankingUnidades: [], lotesVencendo: 0, lotesVencidos: 0, estoquesZerados: 0,
    lowStockItems: [], totalProdutos: 0, ultimasMovimentacoes: [],
    wasteData: { sobraLimpa: 0, restoIngesta: 0 }, custoMedioRefeicao: 0, pedidosStatus: [],
    totalPedidos: 0, pedidosPendentes: 0, slowTurnoverItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const { data: allProds } = await supabase.from("products").select("id, nome, estoque_atual, estoque_minimo, custo_unitario, validade_minima_dias, unidade_medida, categoria");
      const prods = allProds || [];
      const lowStock = prods.filter((p: any) => Number(p.estoque_atual) < Number(p.estoque_minimo));
      const estoquesZerados = prods.filter((p: any) => Number(p.estoque_atual) <= 0).length;

      let totalValue = 0;
      if (canSeeCosts) {
        totalValue = prods.reduce((sum: number, p: any) => sum + (Number(p.estoque_atual) * Number(p.custo_unitario || 0)), 0);
      }

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: losses } = await supabase.from("movements").select("quantidade, product_id").eq("tipo", "perda").gte("created_at", startOfMonth.toISOString());
      const perdasKg = (losses || []).reduce((s, l) => s + Number(l.quantidade), 0);

      const { data: units } = await supabase.from("units").select("id, name");
      const { data: wastes } = await supabase.from("waste_logs").select("quantidade, unidade_id, sobra_limpa_rampa, desperdicio_total_organico").gte("created_at", startOfMonth.toISOString());
      const wasteByUnit: Record<string, number> = {};
      let sobraLimpa = 0, restoIngesta = 0;
      (wastes || []).forEach((w) => {
        wasteByUnit[w.unidade_id] = (wasteByUnit[w.unidade_id] || 0) + Number(w.quantidade);
        sobraLimpa += Number(w.sobra_limpa_rampa || 0);
        restoIngesta += Number(w.desperdicio_total_organico || 0);
      });
      const ranking = (units || []).map((u) => ({ name: u.name, desperdicio: wasteByUnit[u.id] || 0 })).sort((a, b) => b.desperdicio - a.desperdicio);

      const { data: lotesAtivos } = await supabase.from("lotes").select("id, validade, product_id, status, quantidade, recebido_em, unidade_id, codigo").eq("status", "ativo").gt("quantidade", 0);
      let lotesVencendo = 0, lotesVencidos = 0;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const prodMap = Object.fromEntries(prods.map((p: any) => [p.id, p]));
      const unitMap = Object.fromEntries((units || []).map((u) => [u.id, u.name]));

      // Slow turnover analysis
      const slowTurnoverItems: SlowTurnoverItem[] = [];

      if (lotesAtivos) {
        const prodMinDias = Object.fromEntries(prods.map((p: any) => [p.id, p.validade_minima_dias ?? 30]));
        for (const lote of lotesAtivos) {
          const validade = new Date(lote.validade + "T00:00:00");
          const dias = Math.ceil((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (dias < 0) lotesVencidos++;
          else if (dias <= (prodMinDias[lote.product_id] ?? 30)) lotesVencendo++;

          // Turnover check based on entry date
          const prod = prodMap[lote.product_id];
          if (prod) {
            const limiteGiro = getTurnoverAlertDays(prod.categoria);
            if (limiteGiro !== null) {
              const entradaDate = new Date(lote.recebido_em);
              const diasEmEstoque = Math.ceil((today.getTime() - entradaDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diasEmEstoque > limiteGiro) {
                slowTurnoverItems.push({
                  produtoNome: prod.nome,
                  loteCodigo: lote.codigo || "—",
                  diasEmEstoque,
                  limiteGiro,
                  quantidade: Number(lote.quantidade),
                  unidadeNome: unitMap[lote.unidade_id] || "—",
                  categoria: prod.categoria || "—",
                });
              }
            }
          }
        }
      }

      // Sort by most overdue first
      slowTurnoverItems.sort((a, b) => (b.diasEmEstoque - b.limiteGiro) - (a.diasEmEstoque - a.limiteGiro));

      const { data: movs } = await supabase.from("movements").select("id, product_id, tipo, quantidade, created_at").order("created_at", { ascending: false }).limit(8);
      const prodNameMap = Object.fromEntries(prods.map((p: any) => [p.id, p.nome]));
      const ultimasMovimentacoes = (movs || []).map((m) => ({
        id: m.id, produto: prodNameMap[m.product_id] || "—", tipo: m.tipo, quantidade: Number(m.quantidade),
        data: new Date(m.created_at).toLocaleDateString("pt-BR"),
      }));

      const { data: orders } = await supabase.from("purchase_orders").select("status");
      const statusCount: Record<string, number> = {};
      (orders || []).forEach((o) => { statusCount[o.status] = (statusCount[o.status] || 0) + 1; });
      const statusLabels: Record<string, string> = { rascunho: "Rascunho", aprovado: "Aprovado", recebido: "Recebido", enviado: "Enviado" };
      const pedidosStatus = Object.entries(statusCount).map(([k, v]) => ({ name: statusLabels[k] || k, value: v }));
      const totalPedidos = (orders || []).length;
      const pedidosPendentes = (statusCount["rascunho"] || 0) + (statusCount["enviado"] || 0);

      const { data: unitsAll } = await supabase.from("units").select("numero_colaboradores");
      const totalColab = (unitsAll || []).reduce((s, u) => s + (u.numero_colaboradores || 0), 0);
      let custoMedioRefeicao = 0;
      if (canSeeCosts && totalColab > 0) {
        const { data: saidasMes } = await supabase
          .from("movements")
          .select("product_id, quantidade")
          .in("tipo", ["consumo", "saida", "perda"])
          .gte("created_at", startOfMonth.toISOString());
        const prodCusto = Object.fromEntries(prods.map((p: any) => [p.id, Number(p.custo_unitario || 0)]));
        const totalCustoSaidas = (saidasMes || []).reduce((s, m) => s + (Number(m.quantidade) * (prodCusto[m.product_id] || 0)), 0);
        custoMedioRefeicao = totalCustoSaidas / totalColab;
      }

      setData({
        totalEstoqueValor: totalValue, itensAbaixoMinimo: lowStock.length,
        perdasMes: { kg: perdasKg, valor: 0 }, rankingUnidades: ranking,
        lotesVencendo, lotesVencidos, estoquesZerados,
        lowStockItems: lowStock.map((p: any) => ({ nome: p.nome, estoque_atual: Number(p.estoque_atual), estoque_minimo: Number(p.estoque_minimo), unidade_medida: p.unidade_medida || "kg" })),
        totalProdutos: prods.length, ultimasMovimentacoes,
        wasteData: { sobraLimpa, restoIngesta }, custoMedioRefeicao, pedidosStatus,
        totalPedidos, pedidosPendentes, slowTurnoverItems,
      });
    } catch (err) { console.error("Dashboard error:", err); } finally { setLoading(false); setLastUpdated(new Date()); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tipoLabels: Record<string, string> = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste", consumo: "Consumo" };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Painel de Controle</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Yassuo Alimentação — Visão consolidada</p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Estoque */}
        <div
          className="relative overflow-hidden rounded-xl bg-card border border-border p-4 cursor-pointer hover:border-primary/30 transition-colors"
          onClick={() => navigate("/estoque")}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
          <div className="flex items-center justify-between mb-2">
            <Package className="h-5 w-5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estoque</span>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{data.totalProdutos}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">produtos cadastrados</p>
          {data.itensAbaixoMinimo > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span className="text-[10px] text-warning font-medium">{data.itensAbaixoMinimo} abaixo do mínimo</span>
            </div>
          )}
        </div>

        {/* Pedidos */}
        <div
          className="relative overflow-hidden rounded-xl bg-card border border-border p-4 cursor-pointer hover:border-chart-4/30 transition-colors"
          onClick={() => navigate("/compras")}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-chart-4 rounded-l-xl" />
          <div className="flex items-center justify-between mb-2">
            <ShoppingCart className="h-5 w-5 text-chart-4" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pedidos</span>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{data.totalPedidos}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">pedidos de compra</p>
          {data.pedidosPendentes > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3 text-chart-4" />
              <span className="text-[10px] text-chart-4 font-medium">{data.pedidosPendentes} pendentes</span>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div
          className="relative overflow-hidden rounded-xl bg-card border border-border p-4 cursor-pointer hover:border-warning/30 transition-colors"
          onClick={() => navigate("/alertas")}
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning rounded-l-xl" />
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Alertas</span>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{data.lotesVencendo + data.lotesVencidos}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">lotes com atenção</p>
          {data.lotesVencidos > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-destructive" />
              <span className="text-[10px] text-destructive font-medium">{data.lotesVencidos} vencidos</span>
            </div>
          )}
        </div>

        {/* Perdas */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive rounded-l-xl" />
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Perdas</span>
          </div>
          <p className="text-2xl font-bold font-display text-foreground">{data.perdasMes.kg.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
          <p className="text-[11px] text-muted-foreground mt-0.5">no mês corrente</p>
        </div>
      </div>

      {/* Cost row (CEO/Financeiro only) */}
      {canSeeCosts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-success rounded-l-xl" />
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Valor em Estoque</span>
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <p className="text-xl font-bold font-display text-success">
              R$ {data.totalEstoqueValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-chart-5 rounded-l-xl" />
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Custo Médio / Refeição</span>
              <DollarSign className="h-4 w-4 text-chart-5" />
            </div>
            <p className="text-xl font-bold font-display text-chart-5">
              R$ {data.custoMedioRefeicao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="operacional" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logistica">Logística</TabsTrigger>
        </TabsList>

        {/* OPERACIONAL */}
        <TabsContent value="operacional" className="space-y-3">
          {(data.lotesVencidos > 0 || data.estoquesZerados > 0) && (
            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" /> Alertas Críticos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {data.lotesVencidos > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <span className="text-sm">Lotes Vencidos</span>
                    <Badge variant="destructive">{data.lotesVencidos}</Badge>
                  </div>
                )}
                {data.estoquesZerados > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <span className="text-sm">Estoque Zerado</span>
                    <Badge variant="destructive">{data.estoquesZerados}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Slow Turnover Alert */}
          {data.slowTurnoverItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-warning" /> Giro Lento
                  <Badge className="bg-warning/20 text-warning text-xs ml-1">{data.slowTurnoverItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Produto</TableHead>
                      <TableHead className="text-xs">Lote</TableHead>
                      <TableHead className="text-xs text-right">Dias</TableHead>
                      <TableHead className="text-xs text-right">Limite</TableHead>
                      <TableHead className="text-xs text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slowTurnoverItems.slice(0, 10).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm py-2">
                          <div className="flex flex-col">
                            <span>{item.produtoNome}</span>
                            <span className="text-[10px] text-muted-foreground">{item.categoria} · {item.unidadeNome}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm py-2">{item.loteCodigo}</TableCell>
                        <TableCell className="text-sm py-2 text-right">
                          <Badge variant="outline" className="text-warning border-warning/30">{item.diasEmEstoque}d</Badge>
                        </TableCell>
                        <TableCell className="text-sm py-2 text-right text-muted-foreground">{item.limiteGiro}d</TableCell>
                        <TableCell className="text-sm py-2 text-right">{item.quantidade}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.lowStockItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Risco de Ruptura
                  <Badge className="bg-warning/20 text-warning text-xs ml-1">{data.lowStockItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.lowStockItems.slice(0, 6).map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-warning/5 border border-warning/10 rounded-lg px-3 py-2">
                      <span className="text-sm truncate mr-2">{item.nome}</span>
                      <span className="text-xs text-warning font-semibold whitespace-nowrap">
                        {item.estoque_atual}/{item.estoque_minimo} {item.unidade_medida}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm">Últimas Movimentações</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs text-right">Qtd</TableHead>
                    <TableHead className="text-xs text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ultimasMovimentacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm py-2">{m.produto}</TableCell>
                      <TableCell className="text-sm py-2">
                        <Badge variant="outline" className="text-xs">{tipoLabels[m.tipo] || m.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-sm py-2 text-right">{m.quantidade}</TableCell>
                      <TableCell className="text-sm py-2 text-right text-muted-foreground">{m.data}</TableCell>
                    </TableRow>
                  ))}
                  {data.ultimasMovimentacoes.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">Nenhuma movimentação</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PERFORMANCE */}
        <TabsContent value="performance" className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                generatePerformancePDF({
                  sobraLimpa: data.wasteData.sobraLimpa,
                  restoIngesta: data.wasteData.restoIngesta,
                  custoMedioRefeicao: data.custoMedioRefeicao,
                  perdasKg: data.perdasMes.kg,
                  rankingUnidades: data.rankingUnidades,
                  canSeeCosts,
                });
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />Imprimir Relatório
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm">Índice de Desperdício (mês)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {data.wasteData.sobraLimpa === 0 && data.wasteData.restoIngesta === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados de desperdício</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={[
                      { name: "Sobra Limpa", valor: data.wasteData.sobraLimpa },
                      { name: "Resto Ingesta", valor: data.wasteData.restoIngesta },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm">Desperdício por Unidade</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {data.rankingUnidades.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.rankingUnidades}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Bar dataKey="desperdicio" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LOGÍSTICA */}
        <TabsContent value="logistica" className="space-y-3">
          <Card>
            <CardHeader className="pb-2 p-4">
              <CardTitle className="text-sm">Status dos Pedidos de Compra</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data.pedidosStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido registrado</p>
              ) : (
                <div className="flex justify-center">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={data.pedidosStatus} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                        {data.pedidosStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
