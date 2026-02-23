import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, Package, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Transfer {
  id: string;
  product_id: string;
  product_name: string;
  product_medida: string;
  quantidade: number;
  status: string;
  created_at: string;
  unidade_origem_name: string;
  unidade_destino_name: string;
  solicitado_por_name: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

export default function AprovacoesCd() {
  const { profile } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [transfersRes, productsRes, unitsRes, profilesRes] = await Promise.all([
      supabase
        .from("transferencias")
        .select("id, product_id, quantidade, status, created_at, unidade_origem_id, unidade_destino_id, solicitado_por")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("products").select("id, nome, unidade_medida"),
      supabase.from("units").select("id, name, type"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const prods = productsRes.data || [];
    const allUnits = unitsRes.data || [];
    const allProfiles = profilesRes.data || [];
    const rawTransfers = transfersRes.data || [];

    const enriched: Transfer[] = rawTransfers.map((t: any) => {
      const prod = prods.find((p: any) => p.id === t.product_id);
      const origin = allUnits.find((u: any) => u.id === t.unidade_origem_id);
      const dest = allUnits.find((u: any) => u.id === t.unidade_destino_id);
      const requester = allProfiles.find((p: any) => p.user_id === t.solicitado_por);
      return {
        id: t.id,
        product_id: t.product_id,
        product_name: prod?.nome || "Produto",
        product_medida: prod?.unidade_medida || "",
        quantidade: t.quantidade,
        status: t.status,
        created_at: t.created_at,
        unidade_origem_name: origin?.name || "CD",
        unidade_destino_name: dest?.name || "Cozinha",
        solicitado_por_name: requester?.full_name || "—",
      };
    });

    setTransfers(enriched);
    setLoading(false);
  };

  const handleApprove = async (transferId: string) => {
    setProcessing(transferId);
    const { data, error } = await supabase.rpc("rpc_approve_transfer", {
      p_transfer_id: transferId,
      p_decision: "aprovar",
    });
    setProcessing(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Transferência aprovada! Estoque movimentado.");
    loadData();
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setProcessing(rejectId);
    const { error } = await supabase.rpc("rpc_approve_transfer", {
      p_transfer_id: rejectId,
      p_decision: "rejeitar",
      p_reason: rejectReason.trim() || null,
    });
    setProcessing(null);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Transferência rejeitada.");
    setRejectId(null);
    setRejectReason("");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = transfers.filter((t) => t.status === "pendente");
  const processed = transfers.filter((t) => t.status !== "pendente");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">
        Aprovações CD
      </h1>

      {/* Pending */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          Solicitações Pendentes ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground">
            Nenhuma solicitação pendente.
          </div>
        ) : (
          <div className="grid gap-3">
            {pending.map((t) => (
              <div key={t.id} className="glass-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium text-foreground">{t.product_name}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t.quantidade} {t.product_medida} · {t.unidade_origem_name} → {t.unidade_destino_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado por {t.solicitado_por_name} · {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  <Badge variant="secondary">Pendente</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(t.id)}
                    disabled={processing === t.id}
                    className="gap-1"
                  >
                    {processing === t.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setRejectId(t.id)}
                    disabled={processing === t.id}
                    className="gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Processed */}
      {processed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground text-sm">Histórico</h2>
          <div className="grid gap-2">
            {processed.map((t) => (
              <div key={t.id} className="glass-card p-4 flex items-center justify-between opacity-75">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.quantidade} {t.product_medida} · {t.unidade_origem_name} → {t.unidade_destino_name} ·{" "}
                    {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <Badge variant={statusConfig[t.status]?.variant || "secondary"}>
                  {statusConfig[t.status]?.label || t.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(open) => { if (!open) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Rejeitar Transferência</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Motivo da rejeição (opcional)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleReject} disabled={!!processing} className="gap-1">
                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                Confirmar Rejeição
              </Button>
              <Button variant="ghost" onClick={() => { setRejectId(null); setRejectReason(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
