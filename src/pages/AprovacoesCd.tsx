import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, XCircle, Package, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateInternalOrderPDF } from "@/lib/pdfExport";

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  parcial: { label: "Parcial", variant: "outline" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

const itemStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

export default function AprovacoesCd() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Approved quantities per item (editable)
  const [approvedQtys, setApprovedQtys] = useState<Record<string, string>>({});

  // Reject dialog
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
      if (qty !== undefined && !isNaN(qty) && qty > 0) {
        updateData.quantidade_aprovada = qty;
      }

      const { error } = await supabase
        .from("internal_order_items")
        .update(updateData)
        .eq("id", itemId);

      if (error) throw error;

      // Update order status
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
        if (qty !== undefined && !isNaN(qty) && qty > 0) {
          updateData.quantidade_aprovada = qty;
        }
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
    const { data: items } = await supabase
      .from("internal_order_items")
      .select("status")
      .eq("order_id", orderId);

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
      status: statusConfig[order.status]?.label || order.status,
      items: order.items.map((i) => ({
        produto: i.product_name,
        unidade: i.product_medida,
        qtdSolicitada: i.quantidade,
        qtdAprovada: i.quantidade_aprovada,
        status: itemStatusConfig[i.status]?.label || i.status,
        observacao: i.observacao,
      })),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === "pendente" || o.status === "parcial");
  const processed = orders.filter((o) => o.status !== "pendente" && o.status !== "parcial");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Aprovações CD</h1>

      {/* Pending */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          Pedidos Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground">
            Nenhum pedido pendente.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const pendingItems = order.items.filter((i) => i.status === "pendente");
              return (
                <div key={order.id} className="glass-card p-4 space-y-3">
                  {/* Order header */}
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">Pedido #{order.numero}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {order.items.length} {order.items.length === 1 ? "item" : "itens"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {order.unidade_origem_name} → {order.unidade_destino_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Solicitado por {order.solicitado_por_name} · {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                      {order.observacao && (
                        <p className="text-xs text-muted-foreground italic mt-1">{order.observacao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusConfig[order.status]?.variant || "secondary"}>
                        {statusConfig[order.status]?.label || order.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="space-y-3">
                      <div className="rounded-md border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead className="text-right w-24">Solicitado</TableHead>
                              <TableHead className="text-right w-28">Aprovado</TableHead>
                              <TableHead className="w-20">Status</TableHead>
                              <TableHead className="w-24"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.items.map((item) => {
                              const iCfg = itemStatusConfig[item.status] || itemStatusConfig.pendente;
                              const isPending = item.status === "pendente";
                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <span className="text-sm">{item.product_name}</span>
                                    {item.observacao && (
                                      <p className="text-xs text-muted-foreground">{item.observacao}</p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">
                                    {item.quantidade} {item.product_medida}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {isPending ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="h-8 w-24 text-right text-sm"
                                        placeholder={String(item.quantidade)}
                                        value={approvedQtys[item.id] || ""}
                                        onChange={(e) =>
                                          setApprovedQtys((prev) => ({ ...prev, [item.id]: e.target.value }))
                                        }
                                      />
                                    ) : (
                                      <span className="text-sm">
                                        {item.quantidade_aprovada != null ? item.quantidade_aprovada : "—"}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={iCfg.variant} className="text-[10px]">
                                      {iCfg.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {isPending && (
                                      <div className="flex gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-primary"
                                          onClick={() => handleApproveItem(order.id, item.id)}
                                          disabled={processing === item.id}
                                        >
                                          {processing === item.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => setRejectItemId(item.id)}
                                          disabled={processing === item.id}
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex gap-2">
                        {pendingItems.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveAll(order)}
                            disabled={!!processing}
                            className="gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Aprovar Tudo ({pendingItems.length})
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExportPDF(order)}
                          className="gap-1"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground text-sm">Histórico</h2>
          <div className="grid gap-2">
            {processed.map((order) => (
              <div
                key={order.id}
                className="glass-card p-4 flex items-center justify-between opacity-75 cursor-pointer"
                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Pedido #{order.numero}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({order.items.length} {order.items.length === 1 ? "item" : "itens"})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.unidade_origem_name} → {order.unidade_destino_name} · {order.solicitado_por_name} ·{" "}
                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                  </p>

                  {expandedOrderId === order.id && (
                    <div className="mt-3 space-y-1">
                      {order.items.map((item) => {
                        const iCfg = itemStatusConfig[item.status] || itemStatusConfig.pendente;
                        return (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <span>{item.product_name}</span>
                            <span className="text-muted-foreground">
                              {item.quantidade} → {item.quantidade_aprovada ?? "—"} {item.product_medida}
                            </span>
                            <Badge variant={iCfg.variant} className="text-[9px]">{iCfg.label}</Badge>
                          </div>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 mt-2"
                        onClick={(e) => { e.stopPropagation(); handleExportPDF(order); }}
                      >
                        <FileText className="h-3 w-3" />
                        PDF
                      </Button>
                    </div>
                  )}
                </div>
                <Badge variant={statusConfig[order.status]?.variant || "secondary"}>
                  {statusConfig[order.status]?.label || order.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectItemId} onOpenChange={(open) => { if (!open) { setRejectItemId(null); setRejectReason(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Rejeitar Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Motivo da rejeição (opcional)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleRejectItem} disabled={!!processing} className="gap-1">
                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Confirmar Rejeição
              </Button>
              <Button variant="ghost" onClick={() => { setRejectItemId(null); setRejectReason(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
