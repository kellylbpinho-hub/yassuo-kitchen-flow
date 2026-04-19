import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Clock,
  History,
  Sparkles,
  Building2,
  ChefHat,
  ArrowRight,
  Package,
} from "lucide-react";
import { ContextualLoader } from "@/components/ContextualLoader";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ProductQuickAdd } from "@/components/pedido-interno/ProductQuickAdd";
import { CartItemCard, type CartItem } from "@/components/pedido-interno/CartItemCard";
import { CartSummaryBar } from "@/components/pedido-interno/CartSummaryBar";
import { PedidoEmptyCart } from "@/components/pedido-interno/PedidoEmptyCart";

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

const statusConfig: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-warning/15 text-warning border-warning/30" },
  parcial: { label: "Parcial", cls: "bg-info/15 text-info border-info/30" },
  aprovado: { label: "Aprovado", cls: "bg-success/15 text-success border-success/30" },
  rejeitado: { label: "Rejeitado", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function PedidoInterno() {
  const { profile, user, isCeo, isGerenteOperacional } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form header
  const [selectedCdId, setSelectedCdId] = useState("");
  const [selectedKitchenId, setSelectedKitchenId] = useState("");
  const [headerObs, setHeaderObs] = useState("");

  // Items list
  const [items, setItems] = useState<CartItem[]>([]);

  // Blocked products by contract
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

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
    if (cdUnitsArr.length > 0) {
      setSelectedCdId((prev) => prev || cdUnitsArr[0].id);
    }

    const rawOrders = ordersRes.data || [];
    if (rawOrders.length > 0) {
      const orderIds = rawOrders.map((o: any) => o.id);
      const userIds = [...new Set(rawOrders.map((o: any) => o.solicitado_por))];

      const [itemsRes, profilesRes] = await Promise.all([
        supabase.from("internal_order_items").select("order_id, status").in("order_id", orderIds),
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cdUnits = useMemo(() => units.filter((u) => u.type === "cd"), [units]);
  const kitchenUnits = useMemo(() => units.filter((u) => u.type === "kitchen"), [units]);

  const destinationId = isAdmin ? selectedKitchenId : kitchenUnitId;

  // Load contract-blocked product list when destination changes
  useEffect(() => {
    if (!destinationId) {
      setBlockedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("unit_product_rules")
        .select("product_id")
        .eq("unit_id", destinationId)
        .eq("status", "bloqueado");
      if (!cancelled) {
        setBlockedIds(new Set((data || []).map((r: any) => r.product_id)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [destinationId]);

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const excludedIds = useMemo(() => new Set(items.map((i) => i.productId)), [items]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = new Map<string, { name: string; items: { item: CartItem; index: number }[] }>();
    items.forEach((item, index) => {
      const cat = item.category || "Outros";
      if (!groups.has(cat)) groups.set(cat, { name: cat, items: [] });
      groups.get(cat)!.items.push({ item, index });
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items]);

  const totalUnits = useMemo(
    () => items.reduce((sum, i) => sum + (Number.isFinite(i.quantidade) ? i.quantidade : 0), 0),
    [items],
  );
  const forecastCount = useMemo(() => items.filter((i) => i.fromForecast).length, [items]);

  const destLabel = useMemo(() => {
    const id = isAdmin ? selectedKitchenId : kitchenUnitId;
    return units.find((u) => u.id === id)?.name;
  }, [units, isAdmin, selectedKitchenId, kitchenUnitId]);

  const originLabel = useMemo(
    () => units.find((u) => u.id === selectedCdId)?.name,
    [units, selectedCdId],
  );

  const handleAddItem = useCallback(
    (productId: string, qty: number, observacao: string) => {
      const product = productMap.get(productId);
      if (!product) return false;
      if (blockedIds.has(productId)) {
        toast.error("Produto bloqueado por contrato para esta unidade.");
        return false;
      }
      if (items.some((i) => i.productId === productId)) {
        toast.error("Item já está no pedido. Edite a quantidade no card.");
        return false;
      }
      setItems((prev) => [
        ...prev,
        {
          productId,
          productName: product.nome,
          marca: product.marca,
          category: product.category_name || "Outros",
          unidade_medida: product.unidade_medida,
          quantidade: qty,
          observacao,
        },
      ]);
      return true;
    },
    [productMap, blockedIds, items],
  );

  const handleUpdateItem = (index: number, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setItems([]);
    setHeaderObs("");
  };

  const disabledReason = useMemo(() => {
    if (!selectedCdId) return "Selecione o CD de origem.";
    if (isAdmin && !selectedKitchenId) return "Selecione a cozinha de destino.";
    if (!destinationId) return "Unidade de destino não definida.";
    return null;
  }, [selectedCdId, isAdmin, selectedKitchenId, destinationId]);

  const handleSubmit = async () => {
    if (items.length === 0) return;
    if (disabledReason) {
      toast.error(disabledReason);
      return;
    }
    setSending(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("internal_orders")
        .insert({
          unidade_origem_id: selectedCdId,
          unidade_destino_id: destinationId!,
          solicitado_por: user!.id,
          observacao: headerObs.trim() || null,
          company_id: profile!.company_id,
        })
        .select("id, numero")
        .single();

      if (orderError) throw orderError;

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

      toast.success(
        `Pedido #${order.numero} enviado com ${items.length} ${items.length === 1 ? "item" : "itens"}!`,
      );
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
            Você não está vinculado a nenhuma unidade (cozinha). Contate o administrador para ser
            associado.
          </p>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === "pendente" || o.status === "parcial");
  const pastOrders = orders.filter((o) => o.status !== "pendente" && o.status !== "parcial");

  return (
    <div className="space-y-6 animate-fade-in pb-28 lg:pb-6">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-card/80 p-5 sm:p-6">
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight">
                Pedido Interno
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Monte um pedido ao CD com itens da sua cozinha. Use a previsão da semana para ganhar
                tempo.
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="self-start sm:self-center text-muted-foreground hover:text-destructive"
            >
              Limpar carrinho
            </Button>
          )}
        </div>
      </header>

      {/* Route header (origin / destination / observation) */}
      <section className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(cdUnits.length > 1 || isAdmin) && (
            <div className="space-y-1.5" data-guide="select-cd">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> CD de origem
              </Label>
              <Select value={selectedCdId} onValueChange={setSelectedCdId}>
                <SelectTrigger className="bg-background/40 border-border/60 h-10">
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

          {isAdmin ? (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5" /> Cozinha de destino
              </Label>
              <Select value={selectedKitchenId} onValueChange={setSelectedKitchenId}>
                <SelectTrigger className="bg-background/40 border-border/60 h-10">
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
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5" /> Cozinha de destino
              </Label>
              <div className="h-10 px-3 rounded-md border border-border/60 bg-background/40 flex items-center text-sm text-foreground/90">
                {destLabel || "—"}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Observação geral do pedido
          </Label>
          <Textarea
            value={headerObs}
            onChange={(e) => setHeaderObs(e.target.value)}
            placeholder="Ex.: Entregar até quinta às 8h. Verificar lotes mais recentes."
            rows={2}
            className="bg-background/40 border-border/60 resize-none text-sm"
          />
        </div>
      </section>

      {/* Add item */}
      <ProductQuickAdd
        products={products}
        excludedIds={excludedIds}
        onAdd={handleAddItem}
        blockedProductIds={blockedIds}
      />

      {/* Cart */}
      <section className="space-y-3" data-guide="items-list">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Itens do pedido
            {items.length > 0 && (
              <span className="text-sm text-muted-foreground font-normal">({items.length})</span>
            )}
          </h2>
          {forecastCount > 0 && (
            <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/15 gap-1">
              <Sparkles className="h-3 w-3" /> {forecastCount} do cardápio
            </Badge>
          )}
        </div>

        {items.length === 0 ? (
          <PedidoEmptyCart />
        ) : (
          <div className="space-y-5">
            {groupedItems.map((group) => (
              <div key={group.name} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/80">
                    {group.name}
                  </span>
                  <span className="h-px flex-1 bg-border/40" />
                  <span className="text-[11px] text-muted-foreground/60">
                    {group.items.length} {group.items.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {group.items.map(({ item, index }) => (
                    <CartItemCard
                      key={item.productId}
                      item={item}
                      index={index}
                      onUpdate={handleUpdateItem}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending */}
      {pendingOrders.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-base font-display font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Pedidos em aprovação
            <span className="text-sm text-muted-foreground font-normal">({pendingOrders.length})</span>
          </h2>
          <div className="grid gap-2.5">
            {pendingOrders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {pastOrders.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-display font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
            <History className="h-4 w-4" />
            Histórico recente
          </h2>
          <div className="grid gap-2">
            {pastOrders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}

      {/* Sticky summary bar */}
      <CartSummaryBar
        totalItems={items.length}
        totalUnits={totalUnits}
        forecastCount={forecastCount}
        destinationLabel={destLabel}
        originLabel={originLabel}
        sending={sending}
        onSubmit={handleSubmit}
        disabledReason={disabledReason}
      />
    </div>
  );
}

function OrderCard({ order }: { order: InternalOrder }) {
  const cfg = statusConfig[order.status] || statusConfig.pendente;
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 hover:border-border transition-all p-3.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">Pedido #{order.numero}</p>
          <span className="text-[11px] text-muted-foreground/80">
            {order.items_count} {order.items_count === 1 ? "item" : "itens"}
            {order.items_pending > 0 && (
              <span className="text-warning/90"> · {order.items_pending} pendente(s)</span>
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
          <span className="truncate">{order.unidade_origem_name}</span>
          <ArrowRight className="h-3 w-3 text-primary/70 shrink-0" />
          <span className="truncate">{order.unidade_destino_name}</span>
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
          {order.solicitado_por_name} ·{" "}
          {format(new Date(order.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
      <span
        className={`text-[11px] font-semibold px-2 py-1 rounded-full border shrink-0 ${cfg.cls}`}
      >
        {cfg.label}
      </span>
    </div>
  );
}
