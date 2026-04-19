import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Package, Clock, FileText, Inbox, ChevronDown, ChevronUp, ClipboardCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateInternalOrderPDF } from "@/lib/pdfExport";
import { OrderStatusBadge, orderStatusLabel } from "@/components/pedidos/OrderStatusBadge";
import { OrderHeroKpi } from "@/components/pedidos/OrderHeroKpi";
import { OrderEmptyState } from "@/components/pedidos/OrderEmptyState";
import { cn } from "@/lib/utils";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_medida: string;
  quantidade: number;
  quantidade_aprovada: number | null;
  status: string;
  observacao: string | null;
}

interface InternalOrder {
  id: string;
  numero: number;
  status: string;
  created_at: string;
  observacao: string | null;
  unidade_origem_id: string;
  unidade_destino_id: string;
  unidade_origem_name: string;
  unidade_destino_name: string;
  solicitado_por_name: string;
  items: OrderItem[];
}

export default function AprovacoesCd() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const [approvedQtys, setApprovedQtys] = useState<Record<string, string>>({});
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);

    const [ordersRes, itemsRes, productsRes, unitsRes, profilesRes] = await Promise.all([
      supabase.from("internal_orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("internal_order_items").select("*"),
      supabase.from("products").select("id, nome, unidade_medida"),
      supabase.from("units").select("id, name, type"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const rawOrders = ordersRes.data || [];
    const rawItems = itemsRes.data || [];
    const prods = productsRes.data || [];
    const allUnits = unitsRes.data || [];
    const allProfiles = profilesRes.data || [];

    const enriched: InternalOrder[] = rawOrders.map((o: any) => {
      const origin = allUnits.find((u: any) => u.id === o.unidade_origem_id);
      const dest = allUnits.find((u: any) => u.id === o.unidade_destino_id);
      const requester = allProfiles.find((p: any) => p.user_id === o.solicitado_por);

      const orderItems: OrderItem[] = rawItems
        .filter((i: any) => i.order_id === o.id)
        .map((i: any) => {
          const prod = prods.find((p: any) => p.id === i.product_id);
          return {
            id: i.id,
            product_id: i.product_id,
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
        unidade_origem_id: o.unidade_origem_id,
        unidade_destino_id: o.unidade_destino_id,
        unidade_origem_name: origin?.name || "CD",
        unidade_destino_name: dest?.name || "Cozinha",
        solicitado_por_name: requester?.full_name || "—",
        items: orderItems,
      };
    });

    setOrders(enriched);
    setLoading(false);
  };

  const handleApproveItem = async (orderId: string, itemId: string) => {
    setProcessing(itemId);
    try {
      const approvedQty = approvedQtys[itemId];
      const qty = approvedQty ? parseFloat(approvedQty.replace(",", ".")) : undefined;
      const updateData: any = { status: "aprovado" };
      if (qty !== undefined && !isNaN(qty) && qty > 0) updateData.quantidade_aprovada = qty;

      const { error } = await supabase.from("internal_order_items").update(updateData).eq("id", itemId);
      if (error) throw error;
      await updateOrderStatus(orderId);
      toast.success("Item aprovado!");
      await loadData(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aprovar item.");
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectItem = async () => {
    if (!rejectItemId) return;
    const item = orders.flatMap((o) => o.items).find((i) => i.id === rejectItemId);
    const order = orders.find((o) => o.items.some((i) => i.id === rejectItemId));
    if (!item || !order) return;

    setProcessing(rejectItemId);
    try {
      const { error } = await supabase
        .from("internal_order_items")
        .update({ status: "rejeitado", observacao: rejectReason.trim() || item.observacao })
        .eq("id", rejectItemId);
      if (error) throw error;
      await updateOrderStatus(order.id);
      toast.success("Item rejeitado.");
      setRejectItemId(null);
      setRejectReason("");
      await loadData(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao rejeitar item.");
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveAll = async (order: InternalOrder) => {
    setProcessing(order.id);
    try {
      const pendingItems = order.items.filter((i) => i.status === "pendente");
      for (const item of pendingItems) {
        const approvedQty = approvedQtys[item.id];
        const qty = approvedQty ? parseFloat(approvedQty.replace(",", ".")) : undefined;
        const updateData: any = { status: "aprovado" };
        if (qty !== undefined && !isNaN(qty) && qty > 0) updateData.quantidade_aprovada = qty;
        await supabase.from("internal_order_items").update(updateData).eq("id", item.id);
      }
      await updateOrderStatus(order.id);
      toast.success(`Pedido #${order.numero} aprovado integralmente!`);
      await loadData(true);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aprovar pedido.");
    } finally {
      setProcessing(null);
    }
  };

  const updateOrderStatus = async (orderId: string) => {
    const { data: items } = await supabase.from("internal_order_items").select("status").eq("order_id", orderId);
    if (!items || items.length === 0) return;
    const allApproved = items.every((i: any) => i.status === "aprovado");
    const allRejected = items.every((i: any) => i.status === "rejeitado");
    const allDone = items.every((i: any) => i.status !== "pendente");
    let newStatus = "pendente";
    if (allApproved) newStatus = "aprovado";
    else if (allRejected) newStatus = "rejeitado";
    else if (allDone) newStatus = "parcial";
    await supabase.from("internal_orders").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
  };

  const handleExportPDF = (order: InternalOrder) => {
    generateInternalOrderPDF({
      numero: order.numero,
      date: format(new Date(order.created_at), "dd/MM/yyyy HH:mm"),
      originName: order.unidade_origem_name,
      destName: order.unidade_destino_name,
      solicitante: order.solicitado_por_name,
      observacao: order.observacao,
      status: orderStatusLabel(order.status),
      items: order.items.map((i) => ({
        produto: i.product_name,
        unidade: i.product_medida,
        qtdSolicitada: i.quantidade,
        qtdAprovada: i.quantidade_aprovada,
        status: orderStatusLabel(i.status),
        observacao: i.observacao,
      })),
    });
  };

  const kpis = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const pendentes = orders.filter((o) => o.status === "pendente" || o.status === "parcial").length;
    const itensPendentes = orders.flatMap((o) => o.items).filter((i) => i.status === "pendente").length;
    const aprovadosMes = orders.filter((o) => o.status === "aprovado" && new Date(o.created_at) >= monthStart).length;
    const totalMes = orders.filter((o) => new Date(o.created_at) >= monthStart).length;
    return { pendentes, itensPendentes, aprovadosMes, totalMes };
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "todos") {
        if (statusFilter === "pendente" && o.status !== "pendente" && o.status !== "parcial") return false;
        if (statusFilter !== "pendente" && o.status !== statusFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!`#${o.numero}`.toLowerCase().includes(q) &&
            !o.unidade_origem_name.toLowerCase().includes(q) &&
            !o.unidade_destino_name.toLowerCase().includes(q) &&
            !o.solicitado_por_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter]);

  const pending = filtered.filter((o) => o.status === "pendente" || o.status === "parcial");
  const processed = filtered.filter((o) => o.status !== "pendente" && o.status !== "parcial");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold text-foreground">Aprovações CD</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie pedidos internos das cozinhas para o Centro de Distribuição.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-1 shrink-0">
          <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* Priority banner */}
      {kpis.pendentes > 0 && (
        <div className="glass-card p-4 ring-1 ring-warning/30 bg-warning/5 flex items-start gap-3 animate-fade-in">
          <div className="rounded-lg bg-warning/15 p-2 shrink-0">
            <Clock className="h-4 w-4 text-warning animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-display font-bold text-foreground">
              {kpis.pendentes} {kpis.pendentes === 1 ? "pedido aguarda" : "pedidos aguardam"} sua aprovação
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpis.itensPendentes} {kpis.itensPendentes === 1 ? "item pendente" : "itens pendentes"} de revisão. Cozinhas dependem dessa aprovação para receber estoque.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      {orders.length > 0 && (
        <OrderHeroKpi
          items={[
            { label: "Aguardando", value: kpis.pendentes, icon: Clock, tone: kpis.pendentes > 0 ? "warning" : "muted", pulse: kpis.pendentes > 0, hint: `${kpis.itensPendentes} itens` },
            { label: "Aprovados no mês", value: kpis.aprovadosMes, icon: CheckCircle2, tone: "success" },
            { label: "Total no mês", value: kpis.totalMes, icon: ClipboardCheck, tone: "primary" },
            { label: "Histórico total", value: orders.length, icon: Package, tone: "muted" },
          ]}
        />
      )}

      {/* Filters */}
      {orders.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Buscar por nº, unidade ou solicitante..."
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

      {/* Empty */}
      {orders.length === 0 && (
        <OrderEmptyState
          icon={Inbox}
          title="Nenhum pedido recebido ainda"
          description="Quando uma cozinha enviar um pedido interno, ele aparecerá aqui para aprovação granular item a item."
        />
      )}

      {/* Pending */}
      {orders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Pedidos pendentes
            <span className="text-xs font-normal text-muted-foreground">({pending.length})</span>
          </h2>
          {pending.length === 0 ? (
            <div className="glass-card p-6 text-center text-sm text-muted-foreground">
              Nenhum pedido pendente. Operação em dia.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const pendingItems = order.items.filter((i) => i.status === "pendente");
                return (
                  <div key={order.id} className="glass-card relative overflow-hidden">
                    <div className={cn(
                      "absolute left-0 top-0 bottom-0 w-1",
                      order.status === "parcial" ? "bg-warning/15" : "bg-primary",
                    )} />
                    <div className="p-4 pl-5 space-y-3">
                      {/* Order header */}
                      <div
                        className="flex items-start justify-between gap-3 cursor-pointer"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="h-4 w-4 text-primary shrink-0" />
                            <span className="font-display font-bold text-foreground">Pedido #{order.numero}</span>
                            <span className="text-xs text-muted-foreground">
                              · {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium text-foreground">{order.unidade_origem_name}</span>
                            <span className="mx-1.5">→</span>
                            <span className="font-medium text-foreground">{order.unidade_destino_name}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Solicitado por <span className="text-foreground/80">{order.solicitado_por_name}</span> · {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                          {order.observacao && (
                            <p className="text-xs text-muted-foreground italic mt-1.5 border-l-2 border-border pl-2">{order.observacao}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <OrderStatusBadge status={order.status} pulse={order.status === "pendente"} />
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expanded items */}
                      {isExpanded && (
                        <div className="space-y-3 border-t border-border pt-3 animate-fade-in">
                          <div className="space-y-2">
                            {order.items.map((item) => {
                              const isPending = item.status === "pendente";
                              return (
                                <div key={item.id} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">{item.product_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Solicitado: <span className="font-medium text-foreground">{item.quantidade} {item.product_medida}</span>
                                    </p>
                                    {item.observacao && (
                                      <p className="text-[10px] text-muted-foreground italic">{item.observacao}</p>
                                    )}
                                  </div>
                                  {isPending ? (
                                    <>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-8 w-20 text-right text-sm shrink-0"
                                        placeholder={String(item.quantidade)}
                                        value={approvedQtys[item.id] || ""}
                                        onChange={(e) => setApprovedQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                      />
                                      <div className="flex gap-1 shrink-0">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                          onClick={() => handleApproveItem(order.id, item.id)}
                                          disabled={processing === item.id}
                                          title="Aprovar"
                                        >
                                          {processing === item.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                          )}
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          onClick={() => setRejectItemId(item.id)}
                                          disabled={processing === item.id}
                                          title="Rejeitar"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-muted-foreground">
                                        {item.quantidade_aprovada != null ? `${item.quantidade_aprovada} ${item.product_medida}` : "—"}
                                      </span>
                                      <OrderStatusBadge status={item.status} size="xs" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {pendingItems.length > 0 && (
                              <Button
                                size="sm"
                                onClick={() => handleApproveAll(order)}
                                disabled={!!processing}
                                className="gap-1"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Aprovar tudo ({pendingItems.length})
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleExportPDF(order)}
                              className="gap-1"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              PDF
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Processed */}
      {processed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2 text-sm">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            Histórico
            <span className="text-xs font-normal text-muted-foreground">({processed.length})</span>
          </h2>
          <div className="grid gap-2">
            {processed.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const stripeCls = order.status === "aprovado" ? "bg-success/15"
                : order.status === "rejeitado" ? "bg-destructive"
                : "bg-warning/15";
              return (
                <div
                  key={order.id}
                  className="glass-card relative overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-border"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-60", stripeCls)} />
                  <div className="p-3 pl-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Pedido #{order.numero}
                        <span className="text-xs text-muted-foreground ml-2">
                          ({order.items.length} {order.items.length === 1 ? "item" : "itens"})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.unidade_origem_name} → {order.unidade_destino_name} · {order.solicitado_por_name} ·{" "}
                        {format(new Date(order.created_at), "dd/MM/yy HH:mm")}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 space-y-1.5 animate-fade-in">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                              <div className="min-w-0">
                                <span className="text-foreground">{item.product_name}</span>
                                <span className="text-muted-foreground ml-2">
                                  {item.quantidade}
                                  {item.quantidade_aprovada != null && item.quantidade_aprovada !== item.quantidade && (
                                    <> → <span className="text-success font-medium">{item.quantidade_aprovada}</span></>
                                  )}
                                  {" "}{item.product_medida}
                                </span>
                              </div>
                              <OrderStatusBadge status={item.status} size="xs" />
                            </div>
                          ))}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 mt-2"
                            onClick={(e) => { e.stopPropagation(); handleExportPDF(order); }}
                          >
                            <FileText className="h-3 w-3" /> PDF
                          </Button>
                        </div>
                      )}
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectItemId} onOpenChange={(open) => { if (!open) { setRejectItemId(null); setRejectReason(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Rejeitar item
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Informe o motivo da rejeição. A cozinha solicitante será notificada.
            </p>
            <Textarea
              placeholder="Ex: produto sem estoque no CD, fora de validade..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleRejectItem} disabled={!!processing} className="gap-1 flex-1">
                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Confirmar
              </Button>
              <Button variant="outline" onClick={() => { setRejectItemId(null); setRejectReason(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
