import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Clock, CheckCircle2, XCircle, RefreshCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { generateInternalOrderPDF } from "@/lib/pdfExport";

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  parcial: { label: "Parcial", variant: "outline", icon: Clock },
  aprovado: { label: "Aprovado", variant: "default", icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", variant: "destructive", icon: XCircle },
};

const itemStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

export default function MeusPedidos() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      status: statusConfig[pedido.status]?.label || pedido.status,
      items: pedido.items.map((i) => ({
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

  const pending = pedidos.filter((p) => p.status === "pendente" || p.status === "parcial");
  const resolved = pedidos.filter((p) => p.status !== "pendente" && p.status !== "parcial");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Meus Pedidos</h1>
        <Button variant="ghost" size="sm" onClick={loadData} className="gap-1">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Pending */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground">
            Nenhum pedido pendente.
          </div>
        ) : (
          <div className="grid gap-3">
            {pending.map((p) => (
              <PedidoCard key={p.id} pedido={p} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} onExportPDF={() => handleExportPDF(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground text-sm">Histórico</h2>
          <div className="grid gap-2">
            {resolved.map((p) => (
              <PedidoCard key={p.id} pedido={p} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} onExportPDF={() => handleExportPDF(p)} />
            ))}
          </div>
        </div>
      )}

      {pedidos.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">
          Você ainda não fez nenhum pedido interno.
        </div>
      )}
    </div>
  );
}

function PedidoCard({ pedido, expanded, onToggle, onExportPDF }: { pedido: Pedido; expanded: boolean; onToggle: () => void; onExportPDF: () => void }) {
  const cfg = statusConfig[pedido.status] || statusConfig.pendente;
  const Icon = cfg.icon;

  return (
    <div className="glass-card p-4 space-y-2 cursor-pointer" onClick={onToggle}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground">Pedido #{pedido.numero}</span>
            <span className="text-xs text-muted-foreground">
              ({pedido.items.length} {pedido.items.length === 1 ? "item" : "itens"})
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pedido.unidade_origem_name} → {pedido.unidade_destino_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
        <Badge variant={cfg.variant} className="shrink-0 gap-1">
          <Icon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </div>

      {expanded && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          {pedido.items.map((item, idx) => {
            const iCfg = itemStatusConfig[item.status] || itemStatusConfig.pendente;
            return (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium">{item.product_name}</span>
                  <span className="text-muted-foreground ml-2">
                    {item.quantidade} → {item.quantidade_aprovada ?? "—"} {item.product_medida}
                  </span>
                </div>
                <Badge variant={iCfg.variant} className="text-[9px]">{iCfg.label}</Badge>
              </div>
            );
          })}
          <Button
            size="sm"
            variant="outline"
            className="gap-1 mt-2"
            onClick={(e) => { e.stopPropagation(); onExportPDF(); }}
          >
            <FileText className="h-3 w-3" /> PDF
          </Button>
        </div>
      )}
    </div>
  );
}
