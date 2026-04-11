import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2, Send, Check, Package, Loader2, Search, FileDown, AlertTriangle, Copy, XCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";
import { generatePurchaseOrderPDF } from "@/lib/pdfExport";

interface PurchaseOrder {
  id: string;
  status: string;
  unidade_id: string;
  created_at: string;
  numero: number;
  fornecedor_id: string | null;
}

interface PurchaseItem {
  id: string;
  product_id: string;
  quantidade: number;
  custo_unitario: number | null;
  purchase_unit_id: string | null;
  purchase_unit_nome: string | null;
  fator_conversao: number;
  quantidade_estoque: number | null;
}

interface Product {
  id: string;
  nome: string;
  marca: string | null;
  unidade_medida: string;
}

interface Unit { id: string; name: string; type: string; }
interface Fornecedor { id: string; nome: string; }

interface PurchaseUnit {
  id: string;
  product_id: string;
  nome: string;
  fator_conversao: number;
}

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recebido: "Recebido",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-primary/20 text-primary",
  aprovado: "bg-success/20 text-success",
  recebido: "bg-success text-success-foreground",
  cancelado: "bg-destructive/20 text-destructive",
};

export default function ComprasDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, canApprove, isFinanceiro } = useAuth();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPurchaseUnitId, setSelectedPurchaseUnitId] = useState("estoque");
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Inline editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editCost, setEditCost] = useState("");

  // Receive form — individual per item
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveItems, setReceiveItems] = useState<{ product_id: string; qty: number; lote: string; validade: string }[]>([]);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: o }, { data: itms }, { data: prods }, { data: u }, { data: pu }, { data: f }] = await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id!).single(),
      supabase.from("purchase_items").select("*").eq("purchase_order_id", id!),
      supabase.from("products").select("id, nome, marca, unidade_medida").eq("ativo", true).order("nome"),
      supabase.from("units").select("id, name, type"),
      supabase.from("product_purchase_units").select("id, product_id, nome, fator_conversao"),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setOrder(o as PurchaseOrder | null);
    setItems((itms || []) as PurchaseItem[]);
    setProducts((prods || []) as Product[]);
    setUnits((u || []) as Unit[]);
    setPurchaseUnits((pu || []) as PurchaseUnit[]);
    setFornecedores((f || []) as Fornecedor[]);
    setLoading(false);
  };

  const productPurchaseUnits = useMemo(
    () => purchaseUnits.filter((pu) => pu.product_id === selectedProductId),
    [purchaseUnits, selectedProductId]
  );

  useEffect(() => {
    setSelectedPurchaseUnitId("estoque");
  }, [selectedProductId]);

  const selectedPU = purchaseUnits.find((pu) => pu.id === selectedPurchaseUnitId);
  const currentFator = selectedPU ? selectedPU.fator_conversao : 1;
  const currentPUName = selectedPU ? selectedPU.nome : null;
  const qtyNum = Number(quantidade) || 0;
  const equivalenteEstoque = qtyNum * currentFator;
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const addItem = async () => {
    if (!selectedProductId || !quantidade) {
      toast.error("Selecione produto e quantidade.");
      return;
    }
    const qty = Number(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    const isUsingPurchaseUnit = selectedPurchaseUnitId !== "estoque" && selectedPU;
    const { error } = await supabase.from("purchase_items").insert({
      purchase_order_id: id!,
      product_id: selectedProductId,
      quantidade: qty,
      custo_unitario: custoUnitario ? Number(custoUnitario) : null,
      company_id: profile!.company_id,
      purchase_unit_id: isUsingPurchaseUnit ? selectedPU!.id : null,
      purchase_unit_nome: isUsingPurchaseUnit ? selectedPU!.nome : null,
      fator_conversao: isUsingPurchaseUnit ? selectedPU!.fator_conversao : 1,
      quantidade_estoque: isUsingPurchaseUnit ? qty * selectedPU!.fator_conversao : qty,
    });
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Item adicionado!");
      setAddOpen(false);
      setSelectedProductId("");
      setQuantidade("");
      setCustoUnitario("");
      setProductSearch("");
      setSelectedPurchaseUnitId("estoque");
      loadData();
    }
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("purchase_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else { toast.success("Item removido."); loadData(); }
  };

  // Inline edit
  const startEdit = (item: PurchaseItem) => {
    setEditingItemId(item.id);
    setEditQty(String(item.quantidade));
    setEditCost(item.custo_unitario ? String(item.custo_unitario) : "");
  };

  const saveEdit = async (item: PurchaseItem) => {
    const qty = Number(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    const cost = editCost ? Number(editCost) : null;
    const qtyEstoque = item.fator_conversao ? qty * item.fator_conversao : qty;

    const { error } = await supabase.from("purchase_items").update({
      quantidade: qty,
      custo_unitario: cost,
      quantidade_estoque: qtyEstoque,
    }).eq("id", item.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Item atualizado.");
      setEditingItemId(null);
      loadData();
    }
  };

  const cancelEdit = () => setEditingItemId(null);

  const updateStatus = async (newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "aprovado") update.approved_by = user!.id;
    const { error } = await supabase.from("purchase_orders").update(update).eq("id", id!);
    if (error) toast.error(error.message);
    else { toast.success(`Status: ${statusLabels[newStatus]}`); loadData(); }
  };

  const updateFornecedor = async (fornecedorId: string) => {
    const val = fornecedorId === "none" ? null : fornecedorId;
    const { error } = await supabase.from("purchase_orders").update({ fornecedor_id: val }).eq("id", id!);
    if (error) toast.error(error.message);
    else {
      setOrder((prev) => prev ? { ...prev, fornecedor_id: val } : prev);
      toast.success("Fornecedor atualizado.");
    }
  };

  // Open receive dialog — populate with items
  const openReceiveDialog = () => {
    setReceiveItems(
      items.map((item) => ({
        product_id: item.product_id,
        qty: item.quantidade_estoque || item.quantidade,
        lote: "",
        validade: "",
      }))
    );
    setReceiveDialogOpen(true);
  };

  const updateReceiveItem = (index: number, field: "lote" | "validade", value: string) => {
    setReceiveItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleReceive = async () => {
    const missing = receiveItems.filter((i) => !i.lote.trim() || !i.validade);
    if (missing.length > 0) {
      toast.error("Preencha lote e validade de todos os itens.");
      return;
    }

    const unit = units.find((u) => u.id === order!.unidade_id);
    if (unit?.type !== "cd") {
      toast.error("Recebimento só pode ocorrer em unidades do tipo CD.");
      return;
    }

    setReceiving(true);
    let hasError = false;

    for (const item of receiveItems) {
      const { error } = await supabase.rpc("rpc_receive_digital", {
        p_product_id: item.product_id,
        p_unidade_id: order!.unidade_id,
        p_validade: item.validade,
        p_lote_codigo: item.lote.trim(),
        p_quantidade: item.qty,
      });
      if (error) {
        toast.error(`Erro ao receber ${getProductName(item.product_id)}: ${error.message}`);
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      await supabase.from("purchase_orders").update({ status: "recebido" }).eq("id", id!);
      toast.success("Pedido recebido! Estoque atualizado.");
      setReceiveDialogOpen(false);
      loadData();
    }
    setReceiving(false);
  };

  // Duplicate order
  const duplicateOrder = async () => {
    if (!order || items.length === 0) return;
    setDuplicating(true);

    const { data: newOrder, error } = await supabase.from("purchase_orders").insert({
      status: "rascunho",
      unidade_id: order.unidade_id,
      created_by: user!.id,
      company_id: profile!.company_id,
      fornecedor_id: order.fornecedor_id,
    }).select("id").single();

    if (error || !newOrder) {
      toast.error("Erro ao duplicar: " + (error?.message || ""));
      setDuplicating(false);
      return;
    }

    const newItems = items.map((item) => ({
      purchase_order_id: newOrder.id,
      product_id: item.product_id,
      quantidade: item.quantidade,
      custo_unitario: item.custo_unitario,
      company_id: profile!.company_id,
      purchase_unit_id: item.purchase_unit_id,
      purchase_unit_nome: item.purchase_unit_nome,
      fator_conversao: item.fator_conversao,
      quantidade_estoque: item.quantidade_estoque,
    }));

    const { error: itemsError } = await supabase.from("purchase_items").insert(newItems);
    setDuplicating(false);

    if (itemsError) {
      toast.error("Pedido criado mas erro ao copiar itens: " + itemsError.message);
    } else {
      toast.success("Pedido duplicado como rascunho!");
    }
    navigate(`/compras/${newOrder.id}`);
  };

  const getProductName = (pid: string) => products.find((p) => p.id === pid)?.nome || "—";
  const getProductMarca = (pid: string) => products.find((p) => p.id === pid)?.marca || null;
  const getProductUnit = (pid: string) => products.find((p) => p.id === pid)?.unidade_medida || "";
  const getUnitName = (uid: string) => units.find((u) => u.id === uid)?.name || "—";
  const getFornecedorName = (fid: string | null) => fid ? fornecedores.find((f) => f.id === fid)?.nome || "—" : null;

  const formatOrderNumber = (num: number) => {
    const year = new Date().getFullYear();
    return `OC-${year}-${String(num).padStart(4, "0")}`;
  };

  const filteredProducts = products.filter((p) => fuzzyMatchProduct(p, productSearch));

  const getItemDisplayUnit = (item: PurchaseItem) => item.purchase_unit_nome || getProductUnit(item.product_id);

  const getItemEquivalent = (item: PurchaseItem) => {
    if (item.fator_conversao && item.fator_conversao !== 1 && item.quantidade_estoque) {
      return `≈ ${item.quantidade_estoque} ${getProductUnit(item.product_id)}`;
    }
    return null;
  };

  // Total do pedido
  const orderTotal = items.reduce((sum, item) => {
    return sum + (item.custo_unitario ? item.quantidade * Number(item.custo_unitario) : 0);
  }, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!order) {
    return <div className="text-center text-muted-foreground py-8">Pedido não encontrado.</div>;
  }

  const isDraft = order.status === "rascunho";
  const isApproved = order.status === "aprovado";
  const isCancelled = order.status === "cancelado";
  const isReceived = order.status === "recebido";
  const canCancel = ["rascunho", "enviado"].includes(order.status);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compras")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Voltar
        </Button>
        <h1 className="text-2xl font-display font-bold text-foreground">
          {formatOrderNumber(order.numero)}
        </h1>
      </div>

      {/* Order info */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Nº Pedido</p>
            <p className="text-sm font-medium font-mono">{formatOrderNumber(order.numero)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data</p>
            <p className="text-sm font-medium">{new Date(order.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unidade</p>
            <p className="text-sm font-medium">{getUnitName(order.unidade_id)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
          </div>
        </div>

        {/* Fornecedor */}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground shrink-0">Fornecedor:</p>
          {isDraft ? (
            <Select value={order.fornecedor_id || "none"} onValueChange={updateFornecedor}>
              <SelectTrigger className="h-8 text-xs bg-input border-border max-w-[200px]">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">{getFornecedorName(order.fornecedor_id) || "—"}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                generatePurchaseOrderPDF({
                  orderNumber: formatOrderNumber(order.numero),
                  date: new Date(order.created_at).toLocaleDateString("pt-BR"),
                  unitName: getUnitName(order.unidade_id),
                  status: statusLabels[order.status],
                  items: items.map((item) => {
                    const marca = getProductMarca(item.product_id);
                    const nome = getProductName(item.product_id);
                    return {
                      produto: marca ? `${nome} — ${marca}` : nome,
                      quantidade: item.quantidade,
                      unidadeCompra: getItemDisplayUnit(item),
                      unidadeEstoque: getProductUnit(item.product_id),
                      equivalenteEstoque: getItemEquivalent(item) || undefined,
                      custoUnit: item.custo_unitario ? Number(item.custo_unitario) : null,
                      total: item.custo_unitario ? item.quantidade * Number(item.custo_unitario) : null,
                    };
                  }),
                });
                toast.success("PDF gerado!");
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />PDF
            </Button>
          )}

          {/* Duplicate */}
          {items.length > 0 && !isCancelled && (
            <Button size="sm" variant="outline" onClick={duplicateOrder} disabled={duplicating}>
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Duplicar
            </Button>
          )}

          {!isFinanceiro && (
            <>
              {isDraft && items.length > 0 && (
                <Button size="sm" onClick={() => updateStatus("enviado")}>
                  <Send className="h-4 w-4 mr-1" />Enviar
                </Button>
              )}
              {order.status === "enviado" && canApprove && (
                <Button size="sm" onClick={() => updateStatus("aprovado")}>
                  <Check className="h-4 w-4 mr-1" />Aprovar
                </Button>
              )}
              {isApproved && (
                <Button size="sm" variant="default" onClick={openReceiveDialog}>
                  <Package className="h-4 w-4 mr-1" />Receber
                </Button>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30">
                      <XCircle className="h-4 w-4 mr-1" />Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-border">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. O pedido será marcado como cancelado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => updateStatus("cancelado")} className="bg-destructive text-destructive-foreground">
                        Confirmar cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </div>
      </div>

      {/* Receive Dialog — individual per item */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Receber Pedido</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Preencha lote e validade de cada item. Todos serão adicionados ao estoque de{" "}
            <span className="font-medium text-foreground">{getUnitName(order.unidade_id)}</span>.
          </p>
          <div className="space-y-3">
            {receiveItems.map((ri, index) => (
              <div key={index} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{getProductName(ri.product_id)}</span>
                  <Badge variant="outline" className="text-xs">{ri.qty} {getProductUnit(ri.product_id)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Lote *</Label>
                    <Input
                      value={ri.lote}
                      onChange={(e) => updateReceiveItem(index, "lote", e.target.value)}
                      placeholder="Ex: L2025-001"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Validade *</Label>
                    <Input
                      type="date"
                      value={ri.validade}
                      onChange={(e) => updateReceiveItem(index, "validade", e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={handleReceive} disabled={receiving} className="w-full">
            {receiving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar Recebimento ({receiveItems.length} itens)
          </Button>
        </DialogContent>
      </Dialog>

      {/* Items */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-foreground">Itens do Pedido</h2>
        {isDraft && !isFinanceiro && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Adicionar Item</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Adicionar Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Buscar Produto</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="pl-9 bg-input border-border"
                    />
                  </div>
                </div>
                <div>
                  <Label>Produto *</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {filteredProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}{p.marca ? ` — ${p.marca}` : ""} ({p.unidade_medida})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProductId && !selectedProduct?.marca && (
                  <div className="rounded-md border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-warning">Produto sem marca cadastrada</p>
                      <p className="text-muted-foreground mt-0.5">
                        A marca é importante para cotação e recebimento. Edite o produto no módulo de Estoque.
                      </p>
                    </div>
                  </div>
                )}

                {selectedProductId && (
                  <div>
                    <Label>Unidade de Compra</Label>
                    <Select value={selectedPurchaseUnitId} onValueChange={setSelectedPurchaseUnitId}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="estoque">
                          {selectedProduct?.unidade_medida || "kg"} (unidade de estoque)
                        </SelectItem>
                        {productPurchaseUnits.map((pu) => (
                          <SelectItem key={pu.id} value={pu.id}>
                            {pu.nome} (1 {pu.nome} = {pu.fator_conversao} {selectedProduct?.unidade_medida})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Qtd. de Compra *</Label>
                    <Input
                      type="number"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      className="bg-input border-border"
                      placeholder={currentPUName ? `Em ${currentPUName}` : ""}
                    />
                  </div>
                  <div>
                    <Label>Custo Unit. (R$) {currentPUName ? `por ${currentPUName}` : ""}</Label>
                    <Input type="number" step="0.01" value={custoUnitario} onChange={(e) => setCustoUnitario(e.target.value)} className="bg-input border-border" />
                  </div>
                </div>

                {selectedProductId && qtyNum > 0 && currentFator !== 1 && (
                  <div className="rounded-md border border-border bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Equivalente em estoque</p>
                    <p className="text-sm font-semibold text-foreground">
                      {equivalenteEstoque.toFixed(2)} {selectedProduct?.unidade_medida}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {qtyNum} {currentPUName} × {currentFator} = {equivalenteEstoque.toFixed(2)} {selectedProduct?.unidade_medida}
                    </p>
                  </div>
                )}

                <Button onClick={addItem} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead>Qtd.</TableHead>
                <TableHead>Und.</TableHead>
                <TableHead>Equiv.</TableHead>
                <TableHead>Custo Unit.</TableHead>
                <TableHead>Subtotal</TableHead>
                {isDraft && !isFinanceiro && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum item adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {items.map((item) => {
                    const equiv = getItemEquivalent(item);
                    const isEditing = editingItemId === item.id;

                    return (
                      <TableRow key={item.id} className="border-border">
                        <TableCell>
                          <div>
                            <span className="font-medium">{getProductName(item.product_id)}</span>
                            {getProductMarca(item.product_id) ? (
                              <span className="block text-xs text-muted-foreground">{getProductMarca(item.product_id)}</span>
                            ) : (
                              <span className="block text-xs text-warning">⚠ sem marca</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(e.target.value)}
                              className="h-7 w-20 text-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item);
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                          ) : (
                            item.quantidade
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{getItemDisplayUnit(item)}</Badge>
                        </TableCell>
                        <TableCell>
                          {equiv ? <span className="text-xs text-muted-foreground">{equiv}</span> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={editCost}
                              onChange={(e) => setEditCost(e.target.value)}
                              className="h-7 w-20 text-xs"
                              placeholder="R$"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(item);
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                          ) : (
                            item.custo_unitario ? `R$ ${Number(item.custo_unitario).toFixed(2)}` : "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {item.custo_unitario ? `R$ ${(item.quantidade * Number(item.custo_unitario)).toFixed(2)}` : "—"}
                        </TableCell>
                        {isDraft && !isFinanceiro && (
                          <TableCell>
                            <div className="flex gap-1">
                              {isEditing ? (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => saveEdit(item)} className="h-7 w-7 p-0">
                                    <Check className="h-3 w-3 text-success" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 w-7 p-0">
                                    <XCircle className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="h-7 w-7 p-0">
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-card border-border">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover item?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {getProductName(item.product_id)} será removido do pedido.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => removeItem(item.id)} className="bg-destructive text-destructive-foreground">
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}

                  {/* Total footer */}
                  {orderTotal > 0 && (
                    <TableRow className="border-border bg-muted/30 font-semibold">
                      <TableCell colSpan={5} className="text-right text-sm">Total do Pedido</TableCell>
                      <TableCell className="text-sm">R$ {orderTotal.toFixed(2)}</TableCell>
                      {isDraft && !isFinanceiro && <TableCell />}
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
