import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Bell, Package, Clock, ClipboardList, ChevronRight, AlertTriangle, ShoppingCart, Scale, CalendarX } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface AlertItem {
  id: string;
  type: "estoque" | "validade" | "pedido" | "financeiro" | "previsao" | "peso" | "cardapio";
  title: string;
  description: string;
  route: string;
}

async function fetchAlerts(companyId: string): Promise<AlertItem[]> {
  const items: AlertItem[] = [];

  // 1. Estoque baixo — saldo REAL via v_estoque_por_unidade (lotes), não products.estoque_atual
  const [{ data: allProducts }, { data: saldoRows }] = await Promise.all([
    supabase
      .from("products")
      .select("id, nome, estoque_minimo")
      .eq("ativo", true)
      .gt("estoque_minimo", 0),
    supabase
      .from("v_estoque_por_unidade")
      .select("product_id, saldo"),
  ]);

  // Sum saldo across all units for each product
  const saldoMap: Record<string, number> = {};
  (saldoRows || []).forEach((r: any) => {
    if (!r.product_id) return;
    saldoMap[r.product_id] = (saldoMap[r.product_id] || 0) + Number(r.saldo || 0);
  });

  if (allProducts) {
    const lowItems = allProducts
      .map((p) => ({ ...p, saldo: saldoMap[p.id] || 0 }))
      .filter((p) => p.saldo < Number(p.estoque_minimo));
    for (const p of lowItems.slice(0, 10)) {
      items.push({
        id: `est-${p.id}`,
        type: "estoque",
        title: p.nome,
        description: `Estoque: ${p.saldo.toFixed(2)} (mín: ${Number(p.estoque_minimo)})`,
        route: "/estoque",
      });
    }
  }

  // 2. Validade próxima (≤ 7 dias)
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
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

  // 3. Pedidos pendentes — internos + compras externas
  const [{ data: pendingInternal }, { data: pendingPurchase }] = await Promise.all([
    supabase
      .from("internal_orders")
      .select("id, numero, created_at")
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("purchase_orders")
      .select("id, numero, created_at, status")
      .in("status", ["aguardando_aprovacao", "pendente", "rascunho"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (pendingInternal) {
    for (const o of pendingInternal) {
      items.push({
        id: `ped-int-${o.id}`,
        type: "pedido",
        title: `Pedido interno #${o.numero}`,
        description: "Aguardando aprovação",
        route: "/aprovacoes-cd",
      });
    }
  }

  if (pendingPurchase) {
    for (const o of pendingPurchase) {
      items.push({
        id: `ped-com-${o.id}`,
        type: "pedido",
        title: `Compra #${o.numero}`,
        description: o.status === "rascunho" ? "Rascunho aguardando envio" : "Aguardando aprovação",
        route: "/compras",
      });
    }
  }

  // 4. Cardápio incompleto — dias úteis (seg-sex) da semana atual sem menu
  const today = new Date();
  const dow = today.getDay(); // 0=dom, 1=seg ... 6=sab
  const monday = new Date(today);
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  monday.setDate(today.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const { data: weekMenus } = await supabase
    .from("menus")
    .select("data, unidade_id")
    .gte("data", fmt(monday))
    .lte("data", fmt(friday));

  const { data: kitchenUnitsAll } = await supabase
    .from("units")
    .select("id, name")
    .eq("type", "kitchen");

  if (kitchenUnitsAll && kitchenUnitsAll.length > 0) {
    const menuSet = new Set((weekMenus || []).map((m: any) => `${m.unidade_id}|${m.data}`));
    const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex"];
    for (const unit of kitchenUnitsAll) {
      const missingDays: string[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = fmt(d);
        if (!menuSet.has(`${unit.id}|${dateStr}`)) {
          missingDays.push(dayLabels[i]);
        }
      }
      if (missingDays.length > 0) {
        items.push({
          id: `card-${unit.id}`,
          type: "cardapio",
          title: `Cardápio incompleto — ${unit.name}`,
          description: `Dias sem cardápio nesta semana: ${missingDays.join(", ")}`,
          route: "/cardapio-semanal",
        });
      }
    }
  }

  // 5. Radar financeiro — prejuízo ou margem crítica
  const { data: kitchenUnits } = await supabase
    .from("units")
    .select("id, name, contract_value, numero_colaboradores, type")
    .eq("type", "kitchen");

  if (kitchenUnits) {
    const unitsWithContract = kitchenUnits.filter(u => u.contract_value && Number(u.contract_value) > 0);
    if (unitsWithContract.length > 0) {
      const { data: mealCostRows } = await supabase
        .from("meal_cost_daily")
        .select("unit_id, real_meal_cost, meals_served");

      if (mealCostRows) {
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

  // 6. Previsão de ruptura — consumo médio 30d vs saldo real (lotes)
  const productsWithSaldo = (allProducts || [])
    .map((p) => ({ id: p.id, nome: p.nome, saldo: saldoMap[p.id] || 0 }))
    .filter((p) => p.saldo > 0);

  // Include products without estoque_minimo too — fetch any remaining active products
  const { data: extraProducts } = await supabase
    .from("products")
    .select("id, nome")
    .eq("ativo", true);
  const knownIds = new Set(productsWithSaldo.map((p) => p.id));
  const allActive = [
    ...productsWithSaldo,
    ...((extraProducts || [])
      .filter((p) => !knownIds.has(p.id) && (saldoMap[p.id] || 0) > 0)
      .map((p) => ({ id: p.id, nome: p.nome, saldo: saldoMap[p.id] || 0 }))),
  ];

  if (allActive.length > 0) {
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

      for (const p of allActive) {
        const consumoTotal = consumoMap[p.id];
        if (!consumoTotal || consumoTotal <= 0) continue;
        const mediaDiaria = consumoTotal / 30;
        const diasRestantes = p.saldo / mediaDiaria;
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

  // 7. Divergências de peso (últimas 48h) — visível apenas para CEO/admin via RLS
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: weightLogs } = await supabase
    .from("weight_divergence_logs")
    .select("id, product_name, peso_informado, media_historica, percentual_desvio, user_name, created_at")
    .gte("created_at", twoDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(10);

  if (weightLogs) {
    for (const log of weightLogs) {
      items.push({
        id: `peso-${log.id}`,
        type: "peso",
        title: "Divergência de peso no recebimento",
        description: `O produto ${log.product_name} foi recebido com peso fora do padrão em relação à média histórica. Conferir no próximo dia útil.`,
        route: "/recebimento-digital",
      });
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
    estoque: { icon: Package, color: "text-warning", bg: "bg-warning/15" },
    validade: { icon: Clock, color: "text-destructive", bg: "bg-destructive/15" },
    pedido: { icon: ClipboardList, color: "text-primary", bg: "bg-primary/15" },
    financeiro: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/15" },
    previsao: { icon: ShoppingCart, color: "text-destructive", bg: "bg-destructive/15" },
    peso: { icon: Scale, color: "text-warning", bg: "bg-warning/15" },
  };

  const handleClick = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 group">
          <Bell className="h-5 w-5 group-hover:scale-110 transition-transform" />
          {totalCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-pulse-glow">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] p-0 surface-elevated border-border/60 overflow-hidden"
        sideOffset={10}
      >
        <div className="px-4 py-3.5 border-b border-border/50 bg-surface-3/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">Central de alertas</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {totalCount === 0 ? "Tudo certo na operação" : `${totalCount} ${totalCount > 1 ? "eventos pendentes" : "evento pendente"}`}
              </p>
            </div>
            {totalCount > 0 && <span className="pill pill-danger text-numeric">{totalCount}</span>}
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center">
              <div className="h-10 w-10 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-2.5 ring-1 ring-success/25">
                <Bell className="h-4 w-4 text-success" />
              </div>
              <p className="text-sm text-success font-semibold">Operação saudável</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nenhum alerta pendente</p>
            </div>
          ) : (
            <div className="py-1">
              {alerts.map((alert, idx) => {
                const config = iconConfig[alert.type];
                const Icon = config.icon;
                return (
                  <button
                    key={alert.id}
                    onClick={() => handleClick(alert.route)}
                    style={{ animationDelay: `${idx * 20}ms` }}
                    className="animate-rise flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-surface-3 transition-colors border-b border-border/30 last:border-0 group"
                  >
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0", config.bg, config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{alert.description}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {totalCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border/50 bg-surface-3/30">
            <button
              onClick={() => handleClick("/alertas")}
              className="text-xs text-primary hover:text-primary-glow font-semibold flex items-center gap-1 transition-colors"
            >
              Abrir central completa <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
