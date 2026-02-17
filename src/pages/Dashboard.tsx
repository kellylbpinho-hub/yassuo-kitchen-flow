import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Package, AlertTriangle, TrendingDown, DollarSign, ShieldAlert, Clock } from "lucide-react";
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Items below minimum
      const { data: allProds } = await supabase.from("products").select("id, estoque_atual, estoque_minimo, custo_unitario, validade_minima_dias");
      const lowStock = (allProds || []).filter((p: any) => Number(p.estoque_atual) < Number(p.estoque_minimo));

      // For CEO/financial: total stock value
      let totalValue = 0;
      if (canSeeCosts) {
        const { data: prods } = await supabase.from("products").select("estoque_atual, custo_unitario");
        totalValue = (prods || []).reduce((sum: number, p: any) => sum + (Number(p.estoque_atual) * Number(p.custo_unitario)), 0);
      }

      // Monthly losses
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data: losses } = await supabase
        .from("movements")
        .select("quantidade, product_id")
        .eq("tipo", "perda")
        .gte("created_at", startOfMonth.toISOString());

      const perdasKg = (losses || []).reduce((s, l) => s + Number(l.quantidade), 0);

      // Waste by unit (ranking)
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

      // Count lots expiring soon
      const { data: lotesAtivos } = await supabase
        .from("lotes")
        .select("id, validade, product_id, status")
        .eq("status", "ativo")
        .gt("quantidade", 0);

      let lotesVencendo = 0;
      if (lotesAtivos && allProds) {
        const prodMinDias = Object.fromEntries(
          (allProds).map((p: any) => [p.id, p.validade_minima_dias ?? 30])
        );
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const lote of lotesAtivos) {
          const validade = new Date(lote.validade + "T00:00:00");
          const dias = Math.ceil((validade.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const limiar = prodMinDias[lote.product_id] ?? 30;
          if (dias <= limiar) lotesVencendo++;
        }
      }

      setData({
        totalEstoqueValor: totalValue,
        itensAbaixoMinimo: lowStock?.length || 0,
        perdasMes: { kg: perdasKg, valor: 0 },
        rankingUnidades: ranking,
        alertaDesvio: false,
        lotesVencendo,
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

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {canSeeCosts && (
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Valor em Estoque</p>
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <p className="text-2xl font-bold font-display mt-2 text-foreground">
              R$ {data.totalEstoqueValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
        )}

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Abaixo do Mínimo</p>
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <p className="text-2xl font-bold font-display mt-2 text-foreground">
            {data.itensAbaixoMinimo}
          </p>
          <p className="text-xs text-muted-foreground mt-1">itens com estoque baixo</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Perdas do Mês</p>
            <TrendingDown className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-bold font-display mt-2 text-foreground">
            {data.perdasMes.kg.toFixed(1)} kg
          </p>
        </div>

        <div
          className="stat-card cursor-pointer"
          onClick={() => navigate("/alertas")}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Vence em Breve</p>
            <div className="relative">
              <Clock className="h-5 w-5 text-warning" />
              {data.lotesVencendo > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                  {data.lotesVencendo}
                </span>
              )}
            </div>
          </div>
          <p className="text-2xl font-bold font-display mt-2 text-foreground">
            {data.lotesVencendo}
          </p>
          <p className="text-xs text-muted-foreground mt-1">lotes próximos do vencimento</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Produtos</p>
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold font-display mt-2 text-foreground">—</p>
          <p className="text-xs text-muted-foreground mt-1">total cadastrado</p>
        </div>
      </div>

      {/* CEO-only deviation alert */}
      {isCeo && data.alertaDesvio && (
        <div className="glass-card p-4 border-warning/50 animate-pulse-glow">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-warning" />
            <div>
              <p className="font-semibold text-warning">Alerta de Desvio Detectado</p>
              <p className="text-sm text-muted-foreground">
                Diferenças significativas encontradas entre estoque esperado e real.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Waste ranking chart */}
      {data.rankingUnidades.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">
            Desperdício por Unidade (mês)
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.rankingUnidades}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3% 22%)" />
              <XAxis dataKey="name" tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
              <YAxis tick={{ fill: "hsl(0 0% 60%)", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(240 3% 15%)",
                  border: "1px solid hsl(240 3% 22%)",
                  borderRadius: "8px",
                  color: "hsl(0 0% 95%)",
                }}
              />
              <Bar dataKey="desperdicio" fill="hsl(350 95% 43%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
