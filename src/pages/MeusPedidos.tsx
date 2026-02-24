import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Pedido {
  id: string;
  product_name: string;
  product_medida: string;
  quantidade: number;
  status: string;
  created_at: string;
  unidade_origem_name: string;
  unidade_destino_name: string;
  motivo_rejeicao: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Clock }> = {
  pendente: { label: "Pendente", variant: "secondary", icon: Clock },
  aprovada: { label: "Aprovada", variant: "default", icon: CheckCircle2 },
  rejeitada: { label: "Rejeitada", variant: "destructive", icon: XCircle },
};

export default function MeusPedidos() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [transfersRes, productsRes, unitsRes] = await Promise.all([
      supabase
        .from("transferencias")
        .select("id, product_id, quantidade, status, created_at, unidade_origem_id, unidade_destino_id, motivo_rejeicao")
        .eq("solicitado_por", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("id, nome, unidade_medida"),
      supabase.from("units").select("id, name"),
    ]);

    const prods = productsRes.data || [];
    const units = unitsRes.data || [];
    const raw = transfersRes.data || [];

    const enriched: Pedido[] = raw.map((t: any) => {
      const prod = prods.find((p: any) => p.id === t.product_id);
      const origin = units.find((u: any) => u.id === t.unidade_origem_id);
      const dest = units.find((u: any) => u.id === t.unidade_destino_id);
      return {
        id: t.id,
        product_name: prod?.nome || "Produto",
        product_medida: prod?.unidade_medida || "",
        quantidade: t.quantidade,
        status: t.status,
        created_at: t.created_at,
        unidade_origem_name: origin?.name || "CD",
        unidade_destino_name: dest?.name || "Cozinha",
        motivo_rejeicao: t.motivo_rejeicao,
      };
    });

    setPedidos(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Realtime: refetch on status change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("meus-pedidos-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transferencias", filter: `solicitado_por=eq.${user.id}` },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = pedidos.filter((p) => p.status === "pendente");
  const resolved = pedidos.filter((p) => p.status !== "pendente");

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
              <PedidoCard key={p.id} pedido={p} />
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
              <PedidoCard key={p.id} pedido={p} />
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

function PedidoCard({ pedido }: { pedido: Pedido }) {
  const cfg = statusConfig[pedido.status] || statusConfig.pendente;
  const Icon = cfg.icon;

  return (
    <div className="glass-card p-4 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground truncate">{pedido.product_name}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pedido.quantidade} {pedido.product_medida} · {pedido.unidade_origem_name} → {pedido.unidade_destino_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(pedido.created_at), "dd/MM/yyyy HH:mm")}
          </p>
          {pedido.status === "rejeitada" && pedido.motivo_rejeicao && (
            <p className="text-xs text-destructive mt-1">
              Motivo: {pedido.motivo_rejeicao}
            </p>
          )}
        </div>
        <Badge variant={cfg.variant} className="shrink-0 gap-1">
          <Icon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      </div>
    </div>
  );
}
