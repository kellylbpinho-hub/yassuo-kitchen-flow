import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Plus, Loader2, Search, ShoppingCart, FileEdit, Send, CheckCircle2, PackageCheck,
  XCircle, ChevronRight, Building2, Truck, ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/pedidos/OrderStatusBadge";
import { OrderHeroKpi } from "@/components/pedidos/OrderHeroKpi";
import { OrderEmptyState } from "@/components/pedidos/OrderEmptyState";
import { cn } from "@/lib/utils";

interface PurchaseOrder {
  id: string;
  status: string;
  observacao: string | null;
  unidade_id: string;
  created_at: string;
  created_by: string;
  numero: number;
  fornecedor_id: string | null;
  item_count?: number;
  total?: number;
}

interface Unit { id: string; name: string; type: string; }
interface Fornecedor { id: string; nome: string; }

const ALL_STATUSES = ["rascunho", "enviado", "aprovado", "recebido", "cancelado"];

const statusStripe: Record<string, string> = {
  rascunho: "bg-muted-foreground/40",
  enviado: "bg-primary",
  aprovado: "bg-success/15",
  recebido: "bg-success/80",
  cancelado: "bg-destructive",
};

export default function Compras() {
  const { user, profile, isFinanceiro } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedFornecedor, setSelectedFornecedor] = useState("");

  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: o }, { data: u }, { data: f }, { data: itemsData }] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("units").select("id, name, type"),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("purchase_items").select("purchase_order_id, quantidade, custo_unitario"),
    ]);

    const itemAgg: Record<string, { count: number; total: number }> = {};
    (itemsData || []).forEach((item: any) => {
      const oid = item.purchase_order_id;
      if (!itemAgg[oid]) itemAgg[oid] = { count: 0, total: 0 };
      itemAgg[oid].count++;
      if (item.custo_unitario) itemAgg[oid].total += item.quantidade * Number(item.custo_unitario);
    });

    const enriched = ((o || []) as PurchaseOrder[]).map((order) => ({
      ...order,
      item_count: itemAgg[order.id]?.count || 0,
      total: itemAgg[order.id]?.total || 0,
    }));

    setOrders(enriched);
    setUnits((u || []) as Unit[]);
    setFornecedores((f || []) as Fornecedor[]);
    if (u && u.length > 0) setSelectedUnit(profile?.unidade_id || u[0].id);
    setLoading(false);
  };

  const createOrder = async () => {
    if (!selectedUnit) return;
    const insertData: any = {
      status: "rascunho",
      unidade_id: selectedUnit,
      created_by: user!.id,
      company_id: profile!.company_id,
    };
    if (selectedFornecedor) insertData.fornecedor_id = selectedFornecedor;

    const { data, error } = await supabase.from("purchase_orders").insert(insertData).select("id").single();
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Pedido criado!");
      window.dispatchEvent(new CustomEvent("guided:purchase-order:success"));
      setCreateOpen(false);
      setSelectedFornecedor("");
      navigate(`/compras/${data.id}`);
    }
  };

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";
  const getFornecedorName = (id: string | null) => id ? fornecedores.find((f) => f.id === id)?.nome || "—" : null;
  const formatOrderNumber = (o: PurchaseOrder) =>
    `OC-${new Date(o.created_at).getFullYear()}-${String(o.numero).padStart(4, "0")}`;

  const kpis = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const rascunhos = orders.filter((o) => o.status === "rascunho").length;
    const enviados = orders.filter((o) => o.status === "enviado" || o.status === "aprovado").length;
    const recebidosMes = orders.filter((o) => o.status === "recebido" && new Date(o.created_at) >= monthStart).length;
    const valorMes = orders
      .filter((o) => new Date(o.created_at) >= monthStart && (o.status === "aprovado" || o.status === "recebido"))
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return { rascunhos, enviados, recebidosMes, valorMes };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "todos" && o.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const num = formatOrderNumber(o).toLowerCase();
        const unit = getUnitName(o.unidade_id).toLowerCase();
        const forn = getFornecedorName(o.fornecedor_id)?.toLowerCase() || "";
        if (!num.includes(q) && !unit.includes(q) && !forn.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, statusFilter, searchQuery, units, fornecedores]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const showCurrency = !isFinanceiro; // Financeiro hidden by RLS in some places, but always safe

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold text-foreground">Compras</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pedidos de compra externos para fornecedores. Fluxo: rascunho → enviado → aprovado → recebido.
          </p>
        </div>
        {!isFinanceiro && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-guide="btn-nova-compra" className="gap-1 shrink-0">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Novo pedido</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Novo pedido de compra
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Unidade</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="bg-input border-border" data-guide="select-unit-compra"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fornecedor (opcional)</Label>
                  <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createOrder} className="w-full gap-1" data-guide="btn-criar-oc">
                  <Plus className="h-4 w-4" />
                  Criar pedido
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPIs */}
      {orders.length > 0 && (
        <OrderHeroKpi
          items={[
            { label: "Rascunhos", value: kpis.rascunhos, icon: FileEdit, tone: kpis.rascunhos > 0 ? "warning" : "muted", hint: "aguardam envio" },
            { label: "Em andamento", value: kpis.enviados, icon: Send, tone: "primary", hint: "enviados / aprovados" },
            { label: "Recebidos no mês", value: kpis.recebidosMes, icon: PackageCheck, tone: "success" },
            ...(showCurrency ? [{
              label: "Valor do mês",
              value: kpis.valorMes > 0 ? `R$ ${(kpis.valorMes / 1000).toFixed(1)}k` : "R$ 0",
              icon: ClipboardList,
              tone: "primary" as const,
              hint: "aprovado + recebido",
            }] : [{
              label: "Total de pedidos",
              value: orders.length,
              icon: ClipboardList,
              tone: "muted" as const,
            }]),
          ]}
        />
      )}

      {/* Filters */}
      {orders.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº, unidade ou fornecedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44 bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span className="capitalize">{s}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Empty */}
      {orders.length === 0 && (
        <OrderEmptyState
          icon={ShoppingCart}
          title="Nenhum pedido criado ainda"
          description="Crie um pedido manualmente ou gere automaticamente a partir do planejamento de insumos da semana."
          primaryCta={{ label: "Criar pedido", onClick: () => setCreateOpen(true), icon: Plus }}
          secondaryCta={{ label: "Ver planejamento de insumos", onClick: () => navigate("/planejamento-insumos"), icon: ClipboardList }}
        />
      )}

      {/* List */}
      {orders.length > 0 && (
        <>
          <div className="grid gap-2">
            {filteredOrders.length === 0 ? (
              <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                Nenhum pedido corresponde aos filtros aplicados.
              </div>
            ) : (
              filteredOrders.map((o) => (
                <div
                  key={o.id}
                  className="glass-card relative overflow-hidden cursor-pointer transition-all hover:ring-1 hover:ring-primary/30 hover:shadow-[0_0_20px_-12px_hsl(var(--primary)/0.4)]"
                  onClick={() => navigate(`/compras/${o.id}`)}
                >
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusStripe[o.status] || "bg-muted")} />
                  <div className="p-4 pl-5 flex items-center gap-3">
                    <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-2 sm:gap-4 items-center">
                      {/* Number + date */}
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-foreground truncate">{formatOrderNumber(o)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>

                      {/* Unit */}
                      <div className="min-w-0 flex items-center gap-1.5 text-xs">
                        <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-foreground/90 truncate">{getUnitName(o.unidade_id)}</span>
                      </div>

                      {/* Supplier */}
                      <div className="min-w-0 flex items-center gap-1.5 text-xs">
                        <Truck className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {getFornecedorName(o.fornecedor_id) || "Sem fornecedor"}
                        </span>
                      </div>

                      {/* Items + total */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                          <span className="font-medium text-foreground">{o.item_count}</span>
                          <span>{o.item_count === 1 ? "item" : "itens"}</span>
                        </div>
                        {showCurrency && o.total ? (
                          <div className="font-mono text-sm font-bold text-foreground whitespace-nowrap">
                            R$ {o.total.toFixed(2).replace(".", ",")}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <OrderStatusBadge status={o.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
