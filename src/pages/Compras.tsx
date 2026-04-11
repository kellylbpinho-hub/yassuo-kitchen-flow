import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Search, Filter } from "lucide-react";
import { toast } from "sonner";

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

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-primary/20 text-primary",
  aprovado: "bg-success/20 text-success",
  recebido: "bg-success text-success-foreground",
  cancelado: "bg-destructive/20 text-destructive",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const ALL_STATUSES = ["rascunho", "enviado", "aprovado", "recebido", "cancelado"];

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

  // Filters
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

    // Aggregate item counts and totals per order
    const itemAgg: Record<string, { count: number; total: number }> = {};
    (itemsData || []).forEach((item: any) => {
      const oid = item.purchase_order_id;
      if (!itemAgg[oid]) itemAgg[oid] = { count: 0, total: 0 };
      itemAgg[oid].count++;
      if (item.custo_unitario) {
        itemAgg[oid].total += item.quantidade * Number(item.custo_unitario);
      }
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

  // Apply filters
  const filteredOrders = orders.filter((o) => {
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Compras</h1>
        {!isFinanceiro && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-guide="btn-nova-compra"><Plus className="h-4 w-4 mr-2" />Novo Pedido</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Novo Pedido de Compra</DialogTitle>
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
                <Button onClick={createOrder} className="w-full" data-guide="btn-criar-oc">Criar Pedido</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
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
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => (
                  <TableRow key={o.id} className="border-border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/compras/${o.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">{formatOrderNumber(o)}</TableCell>
                    <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{getUnitName(o.unidade_id)}</Badge></TableCell>
                    <TableCell className="text-sm">{getFornecedorName(o.fornecedor_id) || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{o.item_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {o.total ? `R$ ${o.total.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[o.status]}>{statusLabels[o.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
