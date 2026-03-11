import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Clock, AlertTriangle, ShieldX, CalendarDays, Trash2, Package,
} from "lucide-react";
import {
  startOfWeek, endOfWeek, format, eachDayOfInterval, isToday,
  startOfDay, endOfDay, differenceInDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PainelNutri() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [pendingOrders, setPendingOrders] = useState(0);
  const [lowStockItems, setLowStockItems] = useState<{ nome: string; saldo: number; minimo: number }[]>([]);
  const [blockedItems, setBlockedItems] = useState(0);
  const [weekMenu, setWeekMenu] = useState<{ date: string; nome: string; dishCount: number }[]>([]);
  const [wasteToday, setWasteToday] = useState(0);
  const [wasteCount, setWasteCount] = useState(0);
  const [expiryAlerts, setExpiryAlerts] = useState<{ nome: string; dias: number; qtd: number }[]>([]);

  const unitId = profile?.unidade_id;

  useEffect(() => {
    if (!unitId || !user) return;
    loadAll();
  }, [unitId, user]);

  const loadAll = async () => {
    setLoading(true);
    const today = new Date();
    const wStart = startOfWeek(today, { weekStartsOn: 1 });
    const wEnd = endOfWeek(today, { weekStartsOn: 1 });
    const wStartStr = format(wStart, "yyyy-MM-dd");
    const wEndStr = format(wEnd, "yyyy-MM-dd");
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    const [
      ordersRes, stockRes, productsRes, blockedRes,
      menusRes, wasteRes, lotesRes,
    ] = await Promise.all([
      // 1. Pending orders for this user
      supabase
        .from("transferencias")
        .select("id", { count: "exact", head: true })
        .eq("solicitado_por", user!.id)
        .eq("status", "pendente"),
      // 2. Stock view for unit
      supabase
        .from("v_estoque_por_unidade")
        .select("product_id, saldo")
        .eq("unidade_id", unitId!),
      // Products for names + estoque_minimo
      supabase
        .from("products")
        .select("id, nome, estoque_minimo, validade_minima_dias")
        .eq("ativo", true),
      // 3. Blocked items count
      supabase
        .from("unit_product_rules")
        .select("id", { count: "exact", head: true })
        .eq("unit_id", unitId!)
        .eq("status", "bloqueado"),
      // 4. Menus this week
      supabase
        .from("menus")
        .select("id, data, nome")
        .eq("unidade_id", unitId!)
        .gte("data", wStartStr)
        .lte("data", wEndStr),
      // 5. Waste today
      supabase
        .from("waste_logs")
        .select("id, quantidade")
        .eq("unidade_id", unitId!)
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd),
      // 6. Lotes for expiry alerts
      supabase
        .from("lotes")
        .select("product_id, validade, quantidade")
        .eq("unidade_id", unitId!)
        .eq("status", "ativo")
        .gt("quantidade", 0),
    ]);

    // 1 - pending orders
    setPendingOrders(ordersRes.count ?? 0);

    // 2 - low stock
    const products = (productsRes.data || []) as { id: string; nome: string; estoque_minimo: number; validade_minima_dias: number | null }[];
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const stockRows = (stockRes.data || []) as { product_id: string; saldo: number }[];
    const low: { nome: string; saldo: number; minimo: number }[] = [];
    for (const s of stockRows) {
      const p = prodMap.get(s.product_id);
      if (p && Number(s.saldo) < p.estoque_minimo && p.estoque_minimo > 0) {
        low.push({ nome: p.nome, saldo: Number(s.saldo), minimo: p.estoque_minimo });
      }
    }
    low.sort((a, b) => a.saldo - b.saldo);
    setLowStockItems(low.slice(0, 8));

    // 3 - blocked
    setBlockedItems(blockedRes.count ?? 0);

    // 4 - week menu
    const menus = (menusRes.data || []) as { id: string; data: string; nome: string }[];
    // fetch dish counts
    let menuWithDishes: { date: string; nome: string; dishCount: number }[] = [];
    if (menus.length > 0) {
      const menuIds = menus.map((m) => m.id);
      const { data: mdRows } = await supabase
        .from("menu_dishes")
        .select("menu_id")
        .in("menu_id", menuIds);
      const countMap = new Map<string, number>();
      for (const r of (mdRows || [])) {
        countMap.set(r.menu_id, (countMap.get(r.menu_id) || 0) + 1);
      }
      menuWithDishes = menus.map((m) => ({
        date: m.data,
        nome: m.nome,
        dishCount: countMap.get(m.id) || 0,
      }));
    }
    setWeekMenu(menuWithDishes);

    // 5 - waste today
    const wasteLogs = (wasteRes.data || []) as { id: string; quantidade: number }[];
    setWasteCount(wasteLogs.length);
    setWasteToday(wasteLogs.reduce((s, l) => s + Number(l.quantidade), 0));

    // 6 - expiry alerts
    const lotesData = (lotesRes.data || []) as { product_id: string; validade: string; quantidade: number }[];
    const alerts: { nome: string; dias: number; qtd: number }[] = [];
    for (const l of lotesData) {
      const p = prodMap.get(l.product_id);
      if (!p) continue;
      const dias = differenceInDays(new Date(l.validade), today);
      const limite = p.validade_minima_dias ?? 30;
      if (dias <= limite) {
        alerts.push({ nome: p.nome, dias, qtd: Number(l.quantidade) });
      }
    }
    alerts.sort((a, b) => a.dias - b.dias);
    setExpiryAlerts(alerts.slice(0, 6));

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date();
  const weekDays = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  });
  const menuDateSet = new Set(weekMenu.map((m) => m.date));

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">
        Dashboard da Cozinha
      </h1>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Pedidos Pendentes"
          value={pendingOrders}
          accent={pendingOrders > 0 ? "warning" : "default"}
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Estoque Baixo"
          value={lowStockItems.length}
          accent={lowStockItems.length > 0 ? "destructive" : "default"}
        />
        <KpiCard
          icon={<ShieldX className="h-4 w-4" />}
          label="Itens Bloqueados"
          value={blockedItems}
          accent={blockedItems > 0 ? "muted" : "default"}
        />
        <KpiCard
          icon={<Trash2 className="h-4 w-4" />}
          label="Desperdício Hoje"
          value={`${wasteToday.toFixed(1)} kg`}
          sub={`${wasteCount} registro(s)`}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Cardápios na Semana"
          value={`${weekMenu.length} / 7`}
          accent={weekMenu.length < 5 ? "warning" : "default"}
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Weekly menu card */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" /> Cardápio da Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {weekDays.map((d) => {
              const dateStr = format(d, "yyyy-MM-dd");
              const menu = weekMenu.find((m) => m.date === dateStr);
              const dayLabel = format(d, "EEE dd/MM", { locale: ptBR });
              const isTodayDate = isToday(d);
              return (
                <div
                  key={dateStr}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${
                    isTodayDate ? "bg-primary/10 font-medium" : "bg-muted/40"
                  }`}
                >
                  <span className="capitalize text-foreground">{dayLabel}</span>
                  {menu ? (
                    <span className="text-xs text-muted-foreground">
                      {menu.nome} · {menu.dishCount} prato(s)
                    </span>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Sem cardápio
                    </Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Low stock + alerts */}
        <div className="space-y-4">
          {/* Low stock */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Package className="h-4 w-4 text-destructive" /> Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum item abaixo do mínimo.</p>
              ) : (
                <div className="space-y-1.5">
                  {lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate max-w-[60%]">{item.nome}</span>
                      <span className="text-xs text-destructive font-medium">
                        {item.saldo} / {item.minimo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expiry alerts */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de Validade
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expiryAlerts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Sem alertas de validade.</p>
              ) : (
                <div className="space-y-1.5">
                  {expiryAlerts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground truncate max-w-[55%]">{a.nome}</span>
                      <Badge
                        variant={a.dias <= 0 ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {a.dias <= 0 ? "Vencido" : `${a.dias}d`} · {a.qtd} un
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "warning" | "destructive" | "muted";
}) {
  const valueColor =
    accent === "destructive"
      ? "text-destructive"
      : accent === "warning"
      ? "text-amber-500"
      : accent === "muted"
      ? "text-muted-foreground"
      : "text-foreground";

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
