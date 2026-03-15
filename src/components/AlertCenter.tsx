import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bell, Package, Clock, ClipboardList, ChevronRight, AlertTriangle, ShoppingCart } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AlertItem {
  id: string;
  type: "estoque" | "validade" | "pedido" | "financeiro" | "previsao";
  title: string;
  description: string;
  route: string;
}

async function fetchAlerts(companyId: string): Promise<AlertItem[]> {
  const items: AlertItem[] = [];

  // 1. Estoque mínimo — single query, client filter
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, nome, estoque_atual, estoque_minimo")
    .eq("ativo", true);

  if (allProducts) {
    const lowItems = allProducts.filter(
      (p) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0
    );
    for (const p of lowItems.slice(0, 10)) {
      items.push({
        id: `est-${p.id}`,
        type: "estoque",
        title: p.nome,
        description: `Estoque: ${Number(p.estoque_atual)} (mín: ${Number(p.estoque_minimo)})`,
        route: "/estoque",
      });
    }
  }

  // 2. Validade próxima (≤ 5 dias)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const { data: expiringLots } = await supabase
    .from("lotes")
    .select("id, codigo, validade, product_id, quantidade")
    .eq("status", "ativo")
    .gt("quantidade", 0)
    .lte("validade", futureDateStr)
    .limit(10);

  if (expiringLots && expiringLots.length > 0) {
    const prodIds = [...new Set(expiringLots.map((l) => l.product_id))];
    const { data: prods } = await supabase
      .from("products")
      .select("id, nome")
      .in("id", prodIds);
    const prodMap = Object.fromEntries((prods || []).map((p) => [p.id, p.nome]));

    for (const l of expiringLots) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const val = new Date(l.validade + "T00:00:00");
      const dias = Math.ceil((val.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      items.push({
        id: `val-${l.id}`,
        type: "validade",
        title: prodMap[l.product_id] || "Produto",
        description: dias < 0 ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? "Vence hoje" : `Vence em ${dias}d`,
        route: "/alertas",
      });
    }
  }

  // 3. Pedidos internos pendentes
  const { data: pendingOrders } = await supabase
    .from("internal_orders")
    .select("id, numero, created_at")
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(5);

  if (pendingOrders) {
    for (const o of pendingOrders) {
      items.push({
        id: `ped-${o.id}`,
        type: "pedido",
        title: `Pedido #${o.numero}`,
        description: "Aguardando aprovação",
        route: "/aprovacoes-cd",
      });
    }
  }

  // 4. Radar financeiro — prejuízo ou margem crítica
  const { data: kitchenUnits } = await supabase
    .from("units")
    .select("id, name, contract_value, numero_colaboradores, type")
    .eq("type", "kitchen");

  if (kitchenUnits) {
    const unitsWithContract = kitchenUnits.filter(u => u.contract_value && Number(u.contract_value) > 0);
    if (unitsWithContract.length > 0) {
      // Get meal cost data for each unit
      const { data: mealCostRows } = await supabase
        .from("meal_cost_daily")
        .select("unit_id, real_meal_cost, meals_served");

      if (mealCostRows) {
        // Aggregate per unit
        const unitAgg: Record<string, { totalCost: number; totalMeals: number }> = {};
        for (const row of mealCostRows) {
          if (!row.unit_id) continue;
          if (!unitAgg[row.unit_id]) unitAgg[row.unit_id] = { totalCost: 0, totalMeals: 0 };
          const meals = Number(row.meals_served) || 0;
          const realCost = Number(row.real_meal_cost) || 0;
          unitAgg[row.unit_id].totalCost += realCost * meals;
          unitAgg[row.unit_id].totalMeals += meals;
        }

        for (const u of unitsWithContract) {
          const agg = unitAgg[u.id];
          if (!agg || agg.totalMeals === 0) continue;
          const contractValue = Number(u.contract_value);
          const custoTotal = agg.totalCost;
          const lucro = contractValue - custoTotal;
          const margem = (lucro / contractValue) * 100;

          if (lucro < 0) {
            items.push({
              id: `fin-prejuizo-${u.id}`,
              type: "financeiro",
              title: "Prejuízo na operação",
              description: `A unidade ${u.name} está operando com prejuízo no período atual.`,
              route: "/dashboard-financeiro",
            });
          } else if (margem < 5) {
            items.push({
              id: `fin-margem-${u.id}`,
              type: "financeiro",
              title: "Margem crítica",
              description: `A unidade ${u.name} está com margem abaixo de 5% no período atual.`,
              route: "/dashboard-financeiro",
            });
          }
        }
      }
    }
  }

  // 5. Previsão de ruptura — consumo médio 30d vs estoque atual
  const { data: activeProducts } = await supabase
    .from("products")
    .select("id, nome, estoque_atual")
    .eq("ativo", true)
    .gt("estoque_atual", 0);

  if (activeProducts && activeProducts.length > 0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: consumptionMvs } = await supabase
      .from("movements")
      .select("product_id, quantidade")
      .in("tipo", ["consumo", "saida", "perda"])
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (consumptionMvs) {
      const consumoMap: Record<string, number> = {};
      consumptionMvs.forEach((m) => {
        consumoMap[m.product_id] = (consumoMap[m.product_id] || 0) + Number(m.quantidade);
      });

      for (const p of activeProducts) {
        const consumoTotal = consumoMap[p.id];
        if (!consumoTotal || consumoTotal <= 0) continue;
        const mediaDiaria = consumoTotal / 30;
        const diasRestantes = Number(p.estoque_atual) / mediaDiaria;
        if (diasRestantes <= 3) {
          items.push({
            id: `prev-${p.id}`,
            type: "previsao",
            title: "Risco de ruptura de estoque",
            description: `O produto ${p.nome} está com estoque previsto para até ${Math.max(0, Math.round(diasRestantes))} dias.`,
            route: "/estoque",
          });
        }
      }
    }
  }

  return items;
}

export function AlertCenter() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", profile?.company_id],
    queryFn: () => fetchAlerts(profile!.company_id),
    enabled: !!profile?.company_id,
    staleTime: 60_000, // cache 60s
    refetchInterval: 60_000,
  });

  const totalCount = alerts.length;

  const iconConfig = {
    estoque: { icon: Package, color: "text-warning" },
    validade: { icon: Clock, color: "text-destructive" },
    pedido: { icon: ClipboardList, color: "text-primary" },
    financeiro: { icon: AlertTriangle, color: "text-destructive" },
    previsao: { icon: ShoppingCart, color: "text-destructive" },
  };

  const handleClick = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Alertas Operacionais</h3>
          <p className="text-xs text-muted-foreground">
            {totalCount === 0 ? "Nenhum alerta ativo" : `${totalCount} alerta${totalCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ✅ Tudo certo por aqui!
            </div>
          ) : (
            alerts.map((alert) => {
              const config = iconConfig[alert.type];
              const Icon = config.icon;
              return (
                <button
                  key={alert.id}
                  onClick={() => handleClick(alert.route)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-accent/50 transition-colors border-b border-border/50 last:border-0"
                >
                  <div className={cn("shrink-0", config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
        {totalCount > 0 && (
          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => handleClick("/dashboard")}
              className="text-xs text-primary hover:underline font-medium"
            >
              Ver dashboard completo →
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
