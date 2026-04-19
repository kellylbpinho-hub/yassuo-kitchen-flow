import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Loader2, Package, ClipboardList, Clock, CheckCircle2, RefreshCw, FileText, Inbox, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { generateInternalOrderPDF } from "@/lib/pdfExport";
import { OrderStatusBadge, orderStatusLabel } from "@/components/pedidos/OrderStatusBadge";
import { OrderHeroKpi } from "@/components/pedidos/OrderHeroKpi";
import { OrderEmptyState } from "@/components/pedidos/OrderEmptyState";
import { cn } from "@/lib/utils";

interface OrderItem {
  product_name: string;
  product_medida: string;
  quantidade: number;
  quantidade_aprovada: number | null;
  status: string;
  observacao: string | null;
}

interface Pedido {
  id: string;
  numero: number;
  status: string;
  created_at: string;
  observacao: string | null;
  unidade_origem_name: string;
  unidade_destino_name: string;
  items: OrderItem[];
}

export default function MeusPedidos() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [ordersRes, itemsRes, productsRes, unitsRes] = await Promise.all([
      supabase
        .from("internal_orders")
        .select("id, numero, status, created_at, observacao, unidade_origem_id, unidade_destino_id")
        .eq("solicitado_por", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("internal_order_items").select("*"),
      supabase.from("products").select("id, nome, unidade_medida"),
      supabase.from("units").select("id, name"),
    ]);

    const rawOrders = ordersRes.data || [];
    const rawItems = itemsRes.data || [];
    const prods = productsRes.data || [];
    const units = unitsRes.data || [];

    const enriched: Pedido[] = rawOrders.map((o: any) => {
      const origin = units.find((u: any) => u.id === o.unidade_origem_id);
      const dest = units.find((u: any) => u.id === o.unidade_destino_id);
      const orderItems: OrderItem[] = rawItems
        .filter((i: any) => i.order_id === o.id)
        .map((i: any) => {
          const prod = prods.find((p: any) => p.id === i.product_id);
          return {
            product_name: prod?.nome || "Produto",
            product_medida: prod?.unidade_medida || "",
            quantidade: i.quantidade,
            quantidade_aprovada: i.quantidade_aprovada,
            status: i.status,
            observacao: i.observacao,
          };
        });

      return {
        id: o.id,
        numero: o.numero,
        status: o.status,
        created_at: o.created_at,
        observacao: o.observacao,
        unidade_origem_name: origin?.name || "CD",
        unidade_destino_name: dest?.name || "Cozinha",
        items: orderItems,
      };
    });

    setPedidos(enriched);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("meus-pedidos-changes")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "internal_orders" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleExportPDF = (pedido: Pedido) => {
    generateInternalOrderPDF({
      numero: pedido.numero,
      date: format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm"),
      originName: pedido.unidade_origem_name,
      destName: pedido.unidade_destino_name,
      solicitante: "—",
      observacao: pedido.observacao,
      status: orderStatusLabel(pedido.status),
      items: pedido.items.map((i) => ({
        produto: i.product_name,
        unidade: i.product_medida,
        qtdSolicitada: i.quantidade,
        qtdAprovada: i.quantidade_aprovada,
        status: orderStatusLabel(i.status),
        observacao: i.observacao,
      })),
    });
  };

  // KPIs
  const kpis = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const pendentes = pedidos.filter((p) => p.status === "pendente" || p.status === "parcial").length;
    const aprovadosMes = pedidos.filter(
      (p) => p.status === "aprovado" && new Date(p.created_at) >= monthStart,
    ).length;
    const totalMes = pedidos.filter((p) => new Date(p.created_at) >= monthStart).length;
    const taxaAprovacao = totalMes > 0
      ? Math.round((pedidos.filter((p) => (p.status === "aprovado" || p.status === "parcial") && new Date(p.created_at) >= monthStart).length / totalMes) * 100)
      : 0;
    return { pendentes, aprovadosMes, totalMes, taxaAprovacao };
  }, [pedidos]);

  // Filters
  const filtered = useMemo(() => {
    return pedidos.filter((p) => {
      if (statusFilter !== "todos") {
        if (statusFilter === "pendente" && p.status !== "pendente" && p.status !== "parcial") return false;
        if (statusFilter !== "pendente" && p.status !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const num = `#${p.numero}`.toLowerCase();
        if (!num.includes(q) &&
            !p.unidade_origem_name.toLowerCase().includes(q) &&
            !p.unidade_destino_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [pedidos, statusFilter, search]);

  const pending = filtered.filter((p) => p.status === "pendente" || p.status === "parcial");
  const resolved = filtered.filter((p) => p.status !== "pendente" && p.status !== "parcial");

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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold text-foreground">Meus Pedidos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe o status dos pedidos enviados ao Centro de Distribuição.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1 shrink-0">
          <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* KPIs */}
      {pedidos.length > 0 && (
        <OrderHeroKpi
          items={[
            { label: "Aguardando aprovação", value: kpis.pendentes, icon: Clock, tone: kpis.pendentes > 0 ? "warning" : "muted", pulse: kpis.pendentes > 0 },
            { label: "Aprovados no mês", value: kpis.aprovadosMes, icon: CheckCircle2, tone: "success" },
            { label: "Total no mês", value: kpis.totalMes, icon: ClipboardList, tone: "primary" },
            { label: "Taxa de aprovação", value: `${kpis.taxaAprovacao}%`, icon: Package, tone: kpis.taxaAprovacao >= 70 ? "success" : "warning", hint: "do mês corrente" },
          ]}
        />
      )}

      {/* Filters */}
      {pedidos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por número ou unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendentes / Parciais</SelectItem>
              <SelectItem value="aprovado">Aprovados</SelectItem>
              <SelectItem value="rejeitado">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Empty state */}
      {pedidos.length === 0 && (
        <OrderEmptyState
          icon={Inbox}
          title="Nenhum pedido criado ainda"
          description="Crie um pedido manualmente ou gere automaticamente a partir do planejamento de insumos da semana."
          primaryCta={{ label: "Criar pedido", onClick: () => (window.location.href = "/pedido-interno"), icon: Package }}
          secondaryCta={{ label: "Ver planejamento de insumos", onClick: () => (window.location.href = "/planejamento-insumos"), icon: ClipboardList }}
        />
      )}

      {/* Pending */}
      {pedidos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              Em andamento
              <span className="text-xs font-normal text-muted-foreground">({pending.length})</span>
            </h2>
          </div>
          {pending.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido em andamento no momento.
            </div>
          ) : (
            <div className="grid gap-3">
              {pending.map((p) => (
                <PedidoCard key={p.id} pedido={p} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} onExportPDF={() => handleExportPDF(p)} highlight />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Histórico
            <span className="text-xs font-normal text-muted-foreground">({resolved.length})</span>
          </h2>
          <div className="grid gap-2">
            {resolved.map((p) => (
              <PedidoCard key={p.id} pedido={p} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} onExportPDF={() => handleExportPDF(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PedidoCard({
  pedido,
  expanded,
  onToggle,
  onExportPDF,
  highlight = false,
}: {
  pedido: Pedido;
  expanded: boolean;
  onToggle: () => void;
  onExportPDF: () => void;
  highlight?: boolean;
}) {
  const stripeCls =
    pedido.status === "aprovado" ? "bg-emerald-500"
    : pedido.status === "rejeitado" ? "bg-destructive"
    : pedido.status === "parcial" ? "bg-amber-500"
    : "bg-primary";

  return (
    <div
      className={cn(
        "glass-card relative overflow-hidden cursor-pointer transition-all duration-200 hover:ring-1",
        highlight ? "hover:ring-amber-500/40" : "hover:ring-border",
      )}
      onClick={onToggle}
    >
      {/* Accent stripe */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", stripeCls)} />

      <div className="p-4 pl-5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <span className="font-display font-bold text-foreground">Pedido #{pedido.numero}</span>
              <span className="text-xs text-muted-foreground">
                · {pedido.items.length} {pedido.items.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{pedido.unidade_origem_name}</span>
              <span className="mx-1.5">→</span>
              <span className="font-medium text-foreground">{pedido.unidade_destino_name}</span>
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <OrderStatusBadge status={pedido.status} pulse={highlight && pedido.status === "pendente"} />
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-border pt-3 animate-fade-in">
            <div className="space-y-1.5">
              {pedido.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">{item.product_name}</span>
                    <span className="text-muted-foreground ml-2">
                      {item.quantidade}
                      {item.quantidade_aprovada != null && item.quantidade_aprovada !== item.quantidade && (
                        <> → <span className="text-emerald-400 font-medium">{item.quantidade_aprovada}</span></>
                      )}
                      {" "}{item.product_medida}
                    </span>
                    {item.observacao && (
                      <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">{item.observacao}</p>
                    )}
                  </div>
                  <OrderStatusBadge status={item.status} size="xs" />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 mt-2"
              onClick={(e) => { e.stopPropagation(); onExportPDF(); }}
            >
              <FileText className="h-3 w-3" /> Exportar PDF
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
