import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Send, Clock, PackageCheck, PackageX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Product {
  id: string;
  nome: string;
  unidade_medida: string;
  category_name?: string;
}

interface Unit {
  id: string;
  name: string;
  type: string;
}

interface Transfer {
  id: string;
  product_id: string;
  product_name: string;
  quantidade: number;
  status: string;
  created_at: string;
  unidade_origem_name: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

export default function PedidoInterno() {
  const { profile } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCdId, setSelectedCdId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const kitchenUnitId = profile?.unidade_id;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [productsRes, unitsRes, transfersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, nome, unidade_medida, product_categories(name)")
        .order("nome"),
      supabase.from("units").select("id, name, type"),
      kitchenUnitId
        ? supabase
            .from("transferencias")
            .select("id, product_id, quantidade, status, created_at, unidade_origem_id")
            .eq("unidade_destino_id", kitchenUnitId)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
    ]);

    const prods = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      unidade_medida: p.unidade_medida,
      category_name: p.product_categories?.name || undefined,
    }));
    setProducts(prods);

    const allUnits = (unitsRes.data || []) as Unit[];
    setUnits(allUnits);

    // Default CD
    const cdUnits = allUnits.filter((u) => u.type === "cd");
    if (cdUnits.length === 1) {
      setSelectedCdId(cdUnits[0].id);
    }

    // Enrich transfers with product and unit names
    const transferData = (transfersRes.data || []) as any[];
    const enriched: Transfer[] = transferData.map((t) => {
      const prod = prods.find((p: Product) => p.id === t.product_id);
      const origin = allUnits.find((u) => u.id === t.unidade_origem_id);
      return {
        id: t.id,
        product_id: t.product_id,
        product_name: prod?.nome || "Produto",
        quantidade: t.quantidade,
        status: t.status,
        created_at: t.created_at,
        unidade_origem_name: origin?.name || "CD",
      };
    });
    setTransfers(enriched);
    setLoading(false);
  };

  const cdUnits = useMemo(() => units.filter((u) => u.type === "cd"), [units]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20);
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
    );
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSubmit = async () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto.");
      return;
    }
    if (!selectedCdId) {
      toast.error("Selecione o CD de origem.");
      return;
    }
    if (!kitchenUnitId) {
      toast.error("Sua unidade (cozinha) não está configurada. Contate o administrador.");
      return;
    }

    const qty = parseFloat(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }

    setSending(true);
    const { error } = await supabase.rpc("rpc_request_transfer", {
      p_product_id: selectedProductId,
      p_unidade_origem_id: selectedCdId,
      p_unidade_destino_id: kitchenUnitId,
      p_quantidade: qty,
      p_motivo: observacao.trim() || null,
    });

    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Pedido enviado com sucesso!");
    setSelectedProductId("");
    setQuantidade("");
    setObservacao("");
    setSearch("");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!kitchenUnitId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground">Pedido Interno</h1>
        <div className="glass-card p-6 max-w-md">
          <p className="text-muted-foreground">
            Você não está vinculado a nenhuma unidade (cozinha). Contate o administrador para ser associado.
          </p>
        </div>
      </div>
    );
  }

  const pendingTransfers = transfers.filter((t) => t.status === "pendente");
  const pastTransfers = transfers.filter((t) => t.status !== "pendente");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Pedido Interno</h1>

      {/* Request form */}
      <div className="glass-card p-6 max-w-lg space-y-4">
        <h2 className="font-display font-bold text-foreground">Novo Pedido ao CD</h2>

        {/* Product search */}
        <div className="space-y-2">
          <Label>Produto *</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou categoria..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search.trim() && (
            <div className="max-h-48 overflow-auto rounded-md border border-border bg-popover">
              {filteredProducts.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${
                      selectedProductId === p.id ? "bg-accent text-accent-foreground" : "text-foreground"
                    }`}
                    onClick={() => {
                      setSelectedProductId(p.id);
                      setSearch(p.nome);
                    }}
                  >
                    <span className="font-medium">{p.nome}</span>
                    {p.category_name && (
                      <span className="ml-2 text-xs text-muted-foreground">({p.category_name})</span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">· {p.unidade_medida}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedProduct && !search.trim() && (
            <Badge variant="secondary" className="mt-1">
              {selectedProduct.nome} ({selectedProduct.unidade_medida})
            </Badge>
          )}
        </div>

        {/* CD origin */}
        {cdUnits.length > 1 && (
          <div className="space-y-2">
            <Label>CD de origem *</Label>
            <Select value={selectedCdId} onValueChange={setSelectedCdId}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Selecione o CD" />
              </SelectTrigger>
              <SelectContent>
                {cdUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Quantity */}
        <div className="space-y-2">
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder={selectedProduct ? `Em ${selectedProduct.unidade_medida}` : "0.00"}
          />
        </div>

        {/* Observation */}
        <div className="space-y-2">
          <Label>Observação</Label>
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Motivo ou detalhes do pedido..."
            rows={2}
          />
        </div>

        <Button onClick={handleSubmit} disabled={sending} className="w-full gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Pedido ao CD
        </Button>
      </div>

      {/* Pending orders */}
      {pendingTransfers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Meus Pedidos Pendentes ({pendingTransfers.length})
          </h2>
          <div className="grid gap-2">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.quantidade} · de {t.unidade_origem_name} ·{" "}
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

      {/* Past orders */}
      {pastTransfers.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground text-sm">Histórico recente</h2>
          <div className="grid gap-2">
            {pastTransfers.map((t) => (
              <div key={t.id} className="glass-card p-4 flex items-center justify-between opacity-75">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.quantidade} · {format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}
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
    </div>
  );
}
