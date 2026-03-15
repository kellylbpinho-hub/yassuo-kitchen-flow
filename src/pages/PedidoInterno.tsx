import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Send, Plus, Trash2, Clock, ShieldX, FileText } from "lucide-react";
import { ContextualLoader } from "@/components/ContextualLoader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";
import { generateInternalOrderPDF } from "@/lib/pdfExport";

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

interface OrderItem {
  productId: string;
  productName: string;
  unidade_medida: string;
  quantidade: number;
  observacao: string;
}

interface InternalOrder {
  id: string;
  numero: number;
  status: string;
  created_at: string;
  unidade_origem_name: string;
  unidade_destino_name: string;
  solicitado_por_name: string;
  items_count: number;
  items_pending: number;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  parcial: { label: "Parcial", variant: "outline" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
};

export default function PedidoInterno() {
  const { profile, user, isCeo, isGerenteOperacional, isNutricionista } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form header
  const [selectedCdId, setSelectedCdId] = useState("");
  const [selectedKitchenId, setSelectedKitchenId] = useState("");
  const [headerObs, setHeaderObs] = useState("");

  // Item form
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [itemObs, setItemObs] = useState("");

  // Items list
  const [items, setItems] = useState<OrderItem[]>([]);

  // Contract check
  const [blockedByContract, setBlockedByContract] = useState(false);

  const isAdmin = isCeo || isGerenteOperacional;
  const kitchenUnitId = profile?.unidade_id;
  const needsUnit = !isAdmin;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [productsRes, unitsRes, ordersRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, nome, marca, unidade_medida, product_categories(name)")
        .eq("ativo", true)
        .order("nome"),
      supabase.from("units").select("id, name, type").order("created_at", { ascending: true }),
      supabase
        .from("internal_orders")
        .select("id, numero, status, created_at, unidade_origem_id, unidade_destino_id, solicitado_por")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const prods = (productsRes.data || []).map((p: any) => ({
      id: p.id,
      nome: p.nome,
      marca: p.marca || null,
      unidade_medida: p.unidade_medida,
      category_name: p.product_categories?.name || undefined,
    }));
    setProducts(prods);

    const allUnits = (unitsRes.data || []) as Unit[];
    setUnits(allUnits);

    const cdUnitsArr = allUnits.filter((u) => u.type === "cd");
    if (cdUnitsArr.length > 0 && !selectedCdId) {
      setSelectedCdId(cdUnitsArr[0].id);
    }

    // Enrich orders
    const rawOrders = ordersRes.data || [];
    if (rawOrders.length > 0) {
      const orderIds = rawOrders.map((o: any) => o.id);
      const userIds = [...new Set(rawOrders.map((o: any) => o.solicitado_por))];

      const [itemsRes, profilesRes] = await Promise.all([
        supabase
          .from("internal_order_items")
          .select("order_id, status")
          .in("order_id", orderIds),
        supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds),
      ]);

      const allItems = itemsRes.data || [];
      const allProfiles = profilesRes.data || [];

      const enriched: InternalOrder[] = rawOrders.map((o: any) => {
        const origin = allUnits.find((u) => u.id === o.unidade_origem_id);
        const dest = allUnits.find((u) => u.id === o.unidade_destino_id);
        const requester = allProfiles.find((p: any) => p.user_id === o.solicitado_por);
        const orderItems = allItems.filter((i: any) => i.order_id === o.id);
        const pendingItems = orderItems.filter((i: any) => i.status === "pendente");
        return {
          id: o.id,
          numero: o.numero,
          status: o.status,
          created_at: o.created_at,
          unidade_origem_name: origin?.name || "CD",
          unidade_destino_name: dest?.name || "Cozinha",
          solicitado_por_name: requester?.full_name || "—",
          items_count: orderItems.length,
          items_pending: pendingItems.length,
        };
      });
      setOrders(enriched);
    } else {
      setOrders([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const cdUnits = useMemo(() => units.filter((u) => u.type === "cd"), [units]);
  const kitchenUnits = useMemo(() => units.filter((u) => u.type === "kitchen"), [units]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20);
    return products.filter((p) => fuzzyMatchProduct(p, search));
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Contract check
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

  const handleAddItem = () => {
    if (!selectedProductId || !selectedProduct) {
      toast.error("Selecione um produto.");
      return;
    }
    if (blockedByContract) {
      toast.error("Produto não permitido para esta unidade conforme contrato.");
      return;
    }
    const qty = parseFloat(String(quantidade).replace(",", "."));
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade deve ser maior que zero.");
      return;
    }
    // Check duplicate
    if (items.some((i) => i.productId === selectedProductId)) {
      toast.error("Produto já adicionado ao pedido.");
      return;
    }
    setItems([...items, {
      productId: selectedProductId,
      productName: selectedProduct.nome,
      unidade_medida: selectedProduct.unidade_medida,
      quantidade: qty,
      observacao: itemObs.trim(),
    }]);
    setSelectedProductId("");
    setQuantidade("");
    setItemObs("");
    setSearch("");
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido.");
      return;
    }
    if (!selectedCdId) {
      toast.error("Selecione o CD de origem.");
      return;
    }
    const destinationId = isAdmin ? selectedKitchenId : kitchenUnitId;
    if (!destinationId) {
      toast.error(isAdmin ? "Selecione a cozinha de destino." : "Sua unidade (cozinha) não está configurada.");
      return;
    }

    setSending(true);
    try {
      // Create order header
      const { data: order, error: orderError } = await supabase
        .from("internal_orders")
        .insert({
          unidade_origem_id: selectedCdId,
          unidade_destino_id: destinationId,
          solicitado_por: user!.id,
          observacao: headerObs.trim() || null,
          company_id: profile!.company_id,
        })
        .select("id, numero")
        .single();

      if (orderError) throw orderError;

      // Insert all items
      const itemsToInsert = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantidade: item.quantidade,
        observacao: item.observacao || null,
        company_id: profile!.company_id,
      }));

      const { error: itemsError } = await supabase
        .from("internal_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success(`Pedido #${order.numero} enviado com ${items.length} ${items.length === 1 ? "item" : "itens"}!`);
      window.dispatchEvent(new CustomEvent("guided:transfer:success"));
      setItems([]);
      setHeaderObs("");
      setSelectedKitchenId("");
      loadData();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar pedido.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <ContextualLoader message="Carregando pedidos internos..." />;
  }

  if (needsUnit && !kitchenUnitId) {
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

  const pendingOrders = orders.filter((o) => o.status === "pendente" || o.status === "parcial");
  const pastOrders = orders.filter((o) => o.status !== "pendente" && o.status !== "parcial");

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Pedido Interno</h1>

      {/* Order form */}
      <div className="glass-card p-6 space-y-5">
        <h2 className="font-display font-bold text-foreground">Novo Pedido ao CD</h2>

        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-guide="order-header">
          {cdUnits.length > 1 && (
            <div className="space-y-2" data-guide="select-cd">
              <Label>CD de origem *</Label>
              <Select value={selectedCdId} onValueChange={setSelectedCdId}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione o CD" />
                </SelectTrigger>
                <SelectContent>
                  {cdUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-2">
              <Label>Cozinha de destino *</Label>
              <Select value={selectedKitchenId} onValueChange={setSelectedKitchenId}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione a cozinha" />
                </SelectTrigger>
                <SelectContent>
                  {kitchenUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Observação geral</Label>
          <Textarea
            value={headerObs}
            onChange={(e) => setHeaderObs(e.target.value)}
            placeholder="Observação do pedido..."
            rows={2}
          />
        </div>

        {/* Add item section */}
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground">Adicionar item</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Product search */}
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Produto</Label>
              <div className="relative" data-guide="search-product">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {search.trim() && (
                <div className="max-h-40 overflow-auto rounded-md border border-border bg-popover">
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
                        onClick={() => { setSelectedProductId(p.id); setSearch(p.nome); }}
                      >
                        <span className="font-medium">{p.nome}</span>
                        {p.marca && <span className="ml-1 text-xs text-muted-foreground">— {p.marca}</span>}
                        <span className="ml-2 text-xs text-muted-foreground">· {p.unidade_medida}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedProduct && !search.trim() && (
                <div className="mt-1">
                  <Badge variant="secondary">
                    {selectedProduct.nome} ({selectedProduct.unidade_medida})
                  </Badge>
                  {blockedByContract && (
                    <div className="flex items-center gap-1.5 text-destructive text-sm font-medium mt-1">
                      <ShieldX className="h-4 w-4" />
                      Produto bloqueado por contrato.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1" data-guide="input-qty">
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder={selectedProduct ? selectedProduct.unidade_medida : "0.00"}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Obs. do item</Label>
            <Input
              value={itemObs}
              onChange={(e) => setItemObs(e.target.value)}
              placeholder="Observação deste item (opcional)"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleAddItem} className="gap-1" data-guide="btn-add-item">
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div className="space-y-2" data-guide="items-list">
            <h3 className="text-sm font-semibold text-foreground">
              Itens do pedido ({items.length})
            </h3>
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-24 text-right">Qtd</TableHead>
                    <TableHead className="w-16 text-right">Und</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <span className="text-sm font-medium">{item.productName}</span>
                        {item.observacao && (
                          <p className="text-xs text-muted-foreground">{item.observacao}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.quantidade}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{item.unidade_medida}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={sending || items.length === 0}
          className="w-full gap-2"
          data-guide="btn-submit-transfer"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Pedido ({items.length} {items.length === 1 ? "item" : "itens"})
        </Button>
      </div>

      {/* Pending orders */}
      {pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pedidos Pendentes ({pendingOrders.length})
          </h2>
          <div className="grid gap-3">
            {pendingOrders.map((o) => (
              <OrderCard key={o.id} order={o} units={units} />
            ))}
          </div>
        </div>
      )}

      {/* Past orders */}
      {pastOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-foreground text-sm">Histórico recente</h2>
          <div className="grid gap-2">
            {pastOrders.map((o) => (
              <OrderCard key={o.id} order={o} units={units} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: InternalOrder; units: Unit[] }) {
  const cfg = statusConfig[order.status] || statusConfig.pendente;
  return (
    <div className="glass-card p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">
          Pedido #{order.numero}
          <span className="text-xs text-muted-foreground ml-2">
            ({order.items_count} {order.items_count === 1 ? "item" : "itens"})
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {order.unidade_origem_name} → {order.unidade_destino_name} · {order.solicitado_por_name}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
        </p>
      </div>
      <Badge variant={cfg.variant}>{cfg.label}</Badge>
    </div>
  );
}
