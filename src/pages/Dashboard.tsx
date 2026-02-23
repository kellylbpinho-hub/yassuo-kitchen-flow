import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Package, AlertTriangle, TrendingDown, DollarSign, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface DashboardData {
  totalEstoqueValor: number;
  itensAbaixoMinimo: number;
  perdasMes: { kg: number; valor: number };
  rankingUnidades: { name: string; desperdicio: number }[];
  alertaDesvio: boolean;
  lotesVencendo: number;
  lotesVencidos: number;
  estoquesZerados: number;
  lowStockItems: { nome: string; estoque_atual: number; estoque_minimo: number; unidade_medida: string }[];
  totalProdutos: number;
}

export default function Dashboard() {
  const { isCeo, canSeeCosts, role } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>({
    totalEstoqueValor: 0,
    itensAbaixoMinimo: 0,
    perdasMes: { kg: 0, valor: 0 },
    rankingUnidades: [],
    alertaDesvio: false,
    lotesVencendo: 0,
    lotesVencidos: 0,
    estoquesZerados: 0,
    lowStockItems: [],
    totalProdutos: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data: allProds } = await supabase.from("products").select("id, nome, estoque_atual, estoque_minimo, custo_unitario, validade_minima_dias, unidade_medida");
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
      const { data: losses } = await supabase
        .from("movements")
        .select("quantidade, product_id")
        .eq("tipo", "perda")
        .gte("created_at", startOfMonth.toISOString());

      const perdasKg = (losses || []).reduce((s, l) => s + Number(l.quantidade), 0);

      const { data: units } = await supabase.from("units").select("id, name");
      const { data: wastes } = await supabase
        .from("waste_logs")
        .select("quantidade, unidade_id")
        .gte("created_at", startOfMonth.toISOString());

      const wasteByUnit: Record<string, number> = {};
      (wastes || []).forEach((w) => {
        wasteByUnit[w.unidade_id] = (wasteByUnit[w.unidade_id] || 0) + Number(w.quantidade);
      });

      const ranking = (units || []).map((u) => ({
        name: u.name,
        desperdicio: wasteByUnit[u.id] || 0,
      })).sort((a, b) => b.desperdicio - a.desperdicio);

      const { data: lotesAtivos } = await supabase
        .from("lotes")
        .select("id, validade, product_id, status")
        .eq("status", "ativo")
        .gt("quantidade", 0);

      let lotesVencendo = 0;
      let lotesVencidos = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (lotesAtivos) {
        const prodMinDias = Object.fromEntries(
          prods.map((p: any) => [p.id, p.validade_minima_dias ?? 30])
        );
        for (const lote of lotesAtivos) {
          const validade = new Date(lote.validade + "T00:00:00");
          const dias = Math.ceil((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (dias < 0) {
            lotesVencidos++;
          } else {
            const limiar = prodMinDias[lote.product_id] ?? 30;
            if (dias <= limiar) lotesVencendo++;
          }
        }
      }

      setData({
        totalEstoqueValor: totalValue,
        itensAbaixoMinimo: lowStock.length,
        perdasMes: { kg: perdasKg, valor: 0 },
        rankingUnidades: ranking,
        alertaDesvio: false,
        lotesVencendo,
        lotesVencidos,
        estoquesZerados,
        lowStockItems: lowStock.map((p: any) => ({
          nome: p.nome,
          estoque_atual: Number(p.estoque_atual),
          estoque_minimo: Number(p.estoque_minimo),
          unidade_medida: p.unidade_medida || "kg",
        })),
        totalProdutos: prods.length,
      });
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasCritical = data.lotesVencidos > 0 || data.estoquesZerados > 0 || data.perdasMes.kg > 50;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>

      {/* 1️⃣ Valor Total em Estoque — destaque principal */}
      {canSeeCosts && (
        <div className="glass-card p-6 border border-primary/30 glow-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Valor Total em Estoque</p>
              <p className="text-3xl font-bold font-display mt-1 text-primary">
                R$ {data.totalEstoqueValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{data.totalProdutos} produtos cadastrados</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary/60" />
          </div>
        </div>
      )}

      {/* KPI cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Perdas do Mês</p>
            <TrendingDown className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-display mt-2 text-foreground">
            {data.perdasMes.kg.toFixed(1)} kg
          </p>
        </div>

        <div className="stat-card cursor-pointer" onClick={() => navigate("/alertas")}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Vence em Breve</p>
            <Clock className="h-4 w-4 text-warning" />
          </div>
          <p className="text-xl font-bold font-display mt-2 text-warning">{data.lotesVencendo}</p>
          <p className="text-[10px] text-muted-foreground mt-1">lotes próximos</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Abaixo do Mínimo</p>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <p className="text-xl font-bold font-display mt-2 text-foreground">{data.itensAbaixoMinimo}</p>
          <p className="text-[10px] text-muted-foreground mt-1">itens com estoque baixo</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Produtos</p>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold font-display mt-2 text-foreground">{data.totalProdutos}</p>
          <p className="text-[10px] text-muted-foreground mt-1">total cadastrado</p>
        </div>
      </div>

      {/* 2️⃣ Gráfico desperdício por unidade */}
      {data.rankingUnidades.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">
            Desperdício por Unidade (mês)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.rankingUnidades}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
              />
              <Bar dataKey="desperdicio" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 3️⃣ Alertas Críticos — seção separada */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <h2 className="text-base font-display font-semibold text-foreground">Alertas Críticos</h2>
        </div>

        {!hasCritical ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm text-success font-medium">✔ Nenhum risco crítico no momento</span>
          </div>
        ) : (
          <div className="space-y-2">
            {data.lotesVencidos > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">Lotes Vencidos</span>
                </div>
                <Badge variant="destructive">{data.lotesVencidos}</Badge>
              </div>
            )}
            {data.estoquesZerados > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-foreground">Estoque Zerado</span>
                </div>
                <Badge variant="destructive">{data.estoquesZerados}</Badge>
              </div>
            )}
            {data.perdasMes.kg > 50 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium text-foreground">Perda acima do limite</span>
                </div>
                <Badge className="bg-warning text-warning-foreground">{data.perdasMes.kg.toFixed(1)} kg</Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4️⃣ Monitoramento — abaixo do mínimo + vencimento próximo */}
      {data.lowStockItems.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="text-base font-display font-semibold text-foreground">
                Monitoramento — Risco de Ruptura
              </h2>
              <Badge className="bg-warning/20 text-warning text-xs">{data.lowStockItems.length}</Badge>
            </div>
            <button
              onClick={() => navigate("/estoque")}
              className="text-xs text-primary hover:underline underline-offset-2"
            >
              Ver estoque →
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.lowStockItems.slice(0, 9).map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-warning/5 border border-warning/10 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-foreground truncate mr-2">{item.nome}</span>
                <span className="text-xs text-warning font-semibold whitespace-nowrap">
                  {item.estoque_atual}/{item.estoque_minimo} {item.unidade_medida}
                </span>
              </div>
            ))}
            {data.lowStockItems.length > 9 && (
              <div className="flex items-center justify-center bg-muted rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground">+{data.lowStockItems.length - 9} mais</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
