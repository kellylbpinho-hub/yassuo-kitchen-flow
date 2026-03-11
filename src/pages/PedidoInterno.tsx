import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Send, Clock, PackageCheck, PackageX, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { fuzzyMatchProduct, formatProductLabel } from "@/lib/fuzzySearch";

interface Product {
  id: string;
  nome: string;
  marca?: string | null;
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
  unidade_destino_name?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

export default function PedidoInterno() {
  const { profile, isCeo, isGerenteOperacional, isNutricionista } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedCdId, setSelectedCdId] = useState("");
  const [selectedKitchenId, setSelectedKitchenId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saldoCd, setSaldoCd] = useState<number | null>(null);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [blockedByContract, setBlockedByContract] = useState(false);

  // CEO/Ger.Op don't need a unit linked — they can select destination
  const isAdmin = isCeo || isGerenteOperacional;
  const kitchenUnitId = profile?.unidade_id;
  const needsUnit = !isAdmin;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Build transfers query: admins see all, others see only their unit
    let transfersQuery;
    if (isAdmin) {
      transfersQuery = supabase
        .from("transferencias")
        .select("id, product_id, quantidade, status, created_at, unidade_origem_id, unidade_destino_id")
        .order("created_at", { ascending: false })
        .limit(50);
    } else if (kitchenUnitId) {
      transfersQuery = supabase
        .from("transferencias")
        .select("id, product_id, quantidade, status, created_at, unidade_origem_id, unidade_destino_id")
        .eq("unidade_destino_id", kitchenUnitId)
        .order("created_at", { ascending: false })
        .limit(50);
    } else {
      transfersQuery = Promise.resolve({ data: [] });
    }

    const [productsRes, unitsRes, transfersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, nome, unidade_medida, product_categories(name)")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("units").select("id, name, type, created_at").order("created_at", { ascending: true }),
      transfersQuery,
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

    // Always default to the first CD unit of the company
    const cdUnitsArr = allUnits.filter((u) => u.type === "cd");
    if (cdUnitsArr.length > 0) {
      setSelectedCdId(cdUnitsArr[0].id);
    }

    // Enrich transfers with product and unit names
    const transferData = (transfersRes.data || []) as any[];
    const enriched: Transfer[] = transferData.map((t) => {
      const prod = prods.find((p: Product) => p.id === t.product_id);
      const origin = allUnits.find((u) => u.id === t.unidade_origem_id);
      const dest = allUnits.find((u) => u.id === t.unidade_destino_id);
      return {
        id: t.id,
        product_id: t.product_id,
        product_name: prod?.nome || "Produto",
        quantidade: t.quantidade,
        status: t.status,
        created_at: t.created_at,
        unidade_origem_name: origin?.name || "CD",
        unidade_destino_name: dest?.name || "Cozinha",
      };
    });
    setTransfers(enriched);
    setLoading(false);
  };

  const cdUnits = useMemo(() => units.filter((u) => u.type === "cd"), [units]);
  const kitchenUnits = useMemo(() => units.filter((u) => u.type === "kitchen"), [units]);

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

  // DEBUG: log CD selection state
  useEffect(() => {
    const cdUnit = units.find((u) => u.type === "cd");
    console.log("[PedidoInterno DEBUG]", {
      "profile.unidade_id": profile?.unidade_id,
      "cdUnit.id": cdUnit?.id,
      selectedCdId,
      selectedProductId,
      saldoCd,
      unitsCount: units.length,
      cdUnitsFound: units.filter((u) => u.type === "cd").map((u) => ({ id: u.id, name: u.name })),
    });
  }, [selectedCdId, selectedProductId, saldoCd, units, profile]);

  // Fetch saldo from CD when product + CD are selected
  useEffect(() => {
    if (!selectedProductId || !selectedCdId) {
      setSaldoCd(null);
      return;
    }
    let cancelled = false;
    const fetchSaldo = async () => {
      try {
        setLoadingSaldo(true);
        console.log("[PedidoInterno] Fetching CD balance:", { selectedProductId, selectedCdId });
        const { data, error } = await supabase
          .rpc("rpc_get_cd_balance", {
            p_product_id: selectedProductId,
            p_cd_unit_id: selectedCdId,
          });
        console.log("[PedidoInterno] RPC result:", { data, error });
        if (error) throw error;
        if (!cancelled) setSaldoCd(Number(data ?? 0));
      } catch (e) {
        console.error("[PedidoInterno] RPC error:", e);
        if (!cancelled) setSaldoCd(0);
      } finally {
        if (!cancelled) setLoadingSaldo(false);
      }
    };
    fetchSaldo();
    return () => { cancelled = true; };
  }, [selectedProductId, selectedCdId]);

  // Check contract rules when product + destination are known
  useEffect(() => {
    const destId = isAdmin ? selectedKitchenId : kitchenUnitId;
    if (!selectedProductId || !destId) {
      setBlockedByContract(false);
      return;
    }
    let cancelled = false;
    const checkContract = async () => {
      const { data } = await supabase
        .from("unit_product_rules")
        .select("status")
        .eq("unit_id", destId)
        .eq("product_id", selectedProductId)
        .eq("status", "bloqueado")
        .maybeSingle();
      if (!cancelled) setBlockedByContract(!!data);
    };
    checkContract();
    return () => { cancelled = true; };
  }, [selectedProductId, selectedKitchenId, kitchenUnitId, isAdmin]);

  const handleSubmit = async () => {
    if (!selectedProductId) {
      toast.error("Selecione um produto.");
      return;
    }
    if (blockedByContract) {
      toast.error("Produto não permitido para esta unidade conforme contrato.");
      return;
    }
    if (!selectedCdId) {
      toast.error("Selecione o CD de origem.");
      return;
    }

    // Resolve destination: admin selects, others use their linked unit
    const destinationId = isAdmin ? selectedKitchenId : kitchenUnitId;
    if (!destinationId) {
      toast.error(
        isAdmin
          ? "Selecione a cozinha de destino."
          : "Sua unidade (cozinha) não está configurada. Contate o administrador."
      );
      return;
    }

    const qty = parseFloat(String(quantidade).replace(",", "."));
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }

    if (isNutricionista) {
      // Nutricionista can request even without stock — just warn
      if (saldoCd !== null && saldoCd <= 0) {
        toast.warning("Atenção: estoque indisponível no CD. O pedido será enviado como pendente de cobertura.");
      } else if (saldoCd !== null && qty > saldoCd) {
        toast.warning(`Atenção: quantidade excede o saldo disponível (${saldoCd} ${selectedProduct?.unidade_medida || "un"}). Pedido enviado como pendente.`);
      }
    } else {
      if (saldoCd === null) {
        toast.error("Aguarde a consulta de saldo do CD.");
        return;
      }

      if (saldoCd <= 0) {
        toast.error("Estoque indisponível no CD (saldo zero).");
        return;
      }

      if (qty > saldoCd) {
        toast.error(
          `Quantidade solicitada excede o estoque disponível no CD (${saldoCd} ${selectedProduct?.unidade_medida || "un"}).`
        );
        return;
      }
    }

    setSending(true);
    const { error } = await supabase.rpc("rpc_request_transfer", {
      p_product_id: selectedProductId,
      p_unidade_origem_id: selectedCdId,
      p_unidade_destino_id: destinationId,
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
    setSelectedKitchenId("");
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only block if non-admin AND no unit linked
  if (needsUnit && !kitchenUnitId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-display font-bold text-foreground">Transferência Interna</h1>
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
      <h1 className="text-2xl font-display font-bold text-foreground">Transferência Interna</h1>

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
            <div className="mt-1 space-y-1">
              <Badge variant="secondary">
                {selectedProduct.nome} ({selectedProduct.unidade_medida})
              </Badge>
              {blockedByContract && (
                <div className="flex items-center gap-1.5 text-destructive text-sm font-medium">
                  <ShieldX className="h-4 w-4" />
                  Produto não permitido para esta unidade conforme contrato.
                </div>
              )}
            </div>
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

        {/* Kitchen destination — only shown for admin users */}
        {isAdmin && (
          <div className="space-y-2">
            <Label>Cozinha de destino *</Label>
            <Select value={selectedKitchenId} onValueChange={setSelectedKitchenId}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Selecione a cozinha" />
              </SelectTrigger>
              <SelectContent>
                {kitchenUnits.map((u) => (
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
          {selectedProductId && selectedCdId && (
            <div className="mt-2 text-sm">
              {loadingSaldo ? (
                <span className="text-muted-foreground">Consultando saldo...</span>
              ) : saldoCd !== null ? (
                saldoCd > 0 ? (
                  <span className="text-muted-foreground">Disponível no CD: <b>{saldoCd}</b> {selectedProduct?.unidade_medida || "un"}</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠ Estoque indisponível no CD (saldo zero).
                    {isNutricionista && " Você pode solicitar mesmo assim — o item ficará pendente de cobertura."}
                  </span>
                )
              ) : null}
            </div>
          )}
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
            {isAdmin ? "Pedidos Pendentes" : "Meus Pedidos Pendentes"} ({pendingTransfers.length})
          </h2>
          <div className="grid gap-2">
            {pendingTransfers.map((t) => (
              <div key={t.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.quantidade} · de {t.unidade_origem_name}
                    {isAdmin && t.unidade_destino_name && ` → ${t.unidade_destino_name}`}
                    {" · "}
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
                    {t.quantidade}
                    {isAdmin && t.unidade_destino_name && ` → ${t.unidade_destino_name}`}
                    {" · "}
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
    </div>
  );
}
