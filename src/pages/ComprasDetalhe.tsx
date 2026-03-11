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
import { ArrowLeft, Plus, Trash2, Send, Check, Package, Loader2, Search, FileDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";
import { generatePurchaseOrderPDF } from "@/lib/pdfExport";

interface PurchaseOrder {
  id: string;
  status: string;
  unidade_id: string;
  created_at: string;
  numero: number;
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

interface Unit {
  id: string;
  name: string;
  type: string;
}

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
};

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-primary/20 text-primary",
  aprovado: "bg-success/20 text-success",
  recebido: "bg-success text-success-foreground",
};

export default function ComprasDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, canApprove, isFinanceiro } = useAuth();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [purchaseUnits, setPurchaseUnits] = useState<PurchaseUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPurchaseUnitId, setSelectedPurchaseUnitId] = useState("estoque");
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [receiving, setReceiving] = useState(false);

  // Receive form
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [loteCode, setLoteCode] = useState("");
  const [validade, setValidade] = useState("");

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: o }, { data: itms }, { data: prods }, { data: u }, { data: pu }] = await Promise.all([
      supabase.from("purchase_orders").select("*").eq("id", id!).single(),
      supabase.from("purchase_items").select("*").eq("purchase_order_id", id!),
      supabase.from("products").select("id, nome, marca, unidade_medida").eq("ativo", true).order("nome"),
      supabase.from("units").select("id, name, type"),
      supabase.from("product_purchase_units").select("id, product_id, nome, fator_conversao"),
    ]);
    setOrder(o as PurchaseOrder | null);
    setItems((itms || []) as PurchaseItem[]);
    setProducts((prods || []) as Product[]);
    setUnits((u || []) as Unit[]);
    setPurchaseUnits((pu || []) as PurchaseUnit[]);
    setLoading(false);
  };

  // Purchase units for selected product
  const productPurchaseUnits = useMemo(
    () => purchaseUnits.filter((pu) => pu.product_id === selectedProductId),
    [purchaseUnits, selectedProductId]
  );

  // Reset purchase unit when product changes
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

  const updateStatus = async (newStatus: string) => {
    const update: any = { status: newStatus };
    if (newStatus === "aprovado") update.approved_by = user!.id;
    const { error } = await supabase.from("purchase_orders").update(update).eq("id", id!);
    if (error) toast.error(error.message);
    else { toast.success(`Status: ${statusLabels[newStatus]}`); loadData(); }
  };

  const handleReceive = async () => {
    if (!loteCode.trim() || !validade) {
      toast.error("Preencha lote e validade.");
      return;
    }
    if (items.length === 0) {
      toast.error("Pedido sem itens.");
      return;
    }

    const unit = units.find((u) => u.id === order!.unidade_id);
    if (unit?.type !== "cd") {
      toast.error("Recebimento só pode ocorrer em unidades do tipo CD.");
      return;
    }

    setReceiving(true);
    let hasError = false;

    for (const item of items) {
      // Use quantidade_estoque if available (converted), otherwise quantidade
      const qtyToReceive = item.quantidade_estoque || item.quantidade;
      const { error } = await supabase.rpc("rpc_receive_digital", {
        p_product_id: item.product_id,
        p_unidade_id: order!.unidade_id,
        p_validade: validade,
        p_lote_codigo: `${loteCode.trim()}-${getProductName(item.product_id).substring(0, 10)}`,
        p_quantidade: qtyToReceive,
      });
      if (error) {
        toast.error(`Erro ao receber ${getProductName(item.product_id)}: ${error.message}`);
        hasError = true;
        break;
      }
    }

    if (!hasError) {
      await supabase.from("purchase_orders").update({ status: "recebido" }).eq("id", id!);
      toast.success("Pedido recebido! Estoque atualizado automaticamente.");
      setReceiveDialogOpen(false);
      loadData();
    }
    setReceiving(false);
  };

  const getProductName = (pid: string) => products.find((p) => p.id === pid)?.nome || "—";
  const getProductMarca = (pid: string) => products.find((p) => p.id === pid)?.marca || null;
  const getProductUnit = (pid: string) => products.find((p) => p.id === pid)?.unidade_medida || "";
  const getUnitName = (uid: string) => units.find((u) => u.id === uid)?.name || "—";

  const formatOrderNumber = (num: number) => {
    const year = new Date().getFullYear();
    return `OC-${year}-${String(num).padStart(4, "0")}`;
  };

  const filteredProducts = products.filter((p) =>
    fuzzyMatchProduct(p, productSearch)
  );

  // Build display unit for an item
  const getItemDisplayUnit = (item: PurchaseItem) => {
    if (item.purchase_unit_nome) return item.purchase_unit_nome;
    return getProductUnit(item.product_id);
  };

  const getItemEquivalent = (item: PurchaseItem) => {
    if (item.fator_conversao && item.fator_conversao !== 1 && item.quantidade_estoque) {
      return `≈ ${item.quantidade_estoque} ${getProductUnit(item.product_id)}`;
    }
    return null;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!order) {
    return <div className="text-center text-muted-foreground py-8">Pedido não encontrado.</div>;
  }

  const isDraft = order.status === "rascunho";
  const isApproved = order.status === "aprovado";

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
      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
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
        <div className="flex-1" />

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
            <FileDown className="h-4 w-4 mr-1" />Gerar PDF
          </Button>
        )}

        {!isFinanceiro && (
          <div className="flex gap-2">
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
              <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="default">
                    <Package className="h-4 w-4 mr-1" />Receber
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="font-display">Receber Pedido</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Ao confirmar, todos os {items.length} itens serão adicionados ao estoque da unidade{" "}
                      <span className="font-medium text-foreground">{getUnitName(order.unidade_id)}</span>.
                    </p>
                    <div>
                      <Label>Código do Lote *</Label>
                      <Input value={loteCode} onChange={(e) => setLoteCode(e.target.value)} placeholder="Ex: NF-12345" />
                    </div>
                    <div>
                      <Label>Validade *</Label>
                      <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
                    </div>
                    <Button onClick={handleReceive} disabled={receiving} className="w-full">
                      {receiving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Confirmar Recebimento
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

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

                {/* Alert: produto sem marca */}
                {selectedProductId && !selectedProduct?.marca && (
                  <div className="rounded-md border border-warning/50 bg-warning/10 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-warning">Produto sem marca cadastrada</p>
                      <p className="text-muted-foreground mt-0.5">
                        A marca é importante para cotação, comparação de preço e recebimento. Edite o produto no módulo de Estoque para preencher.
                      </p>
                    </div>
                  </div>
                )}

                {/* Purchase unit selector */}
                {selectedProductId && (
                  <div>
                    <Label>Unidade de Compra</Label>
                    <Select value={selectedPurchaseUnitId} onValueChange={setSelectedPurchaseUnitId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
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

                {/* Equivalente em estoque */}
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
                <TableHead>Qtd. Compra</TableHead>
                <TableHead>Und. Compra</TableHead>
                <TableHead>Equiv. Estoque</TableHead>
                <TableHead>Custo Unit.</TableHead>
                <TableHead>Subtotal</TableHead>
                {isDraft && !isFinanceiro && <TableHead className="w-12"></TableHead>}
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
                items.map((item) => {
                  const equiv = getItemEquivalent(item);
                  return (
                    <TableRow key={item.id} className="border-border">
                      <TableCell>
                        <div>
                          <span className="font-medium">{getProductName(item.product_id)}</span>
                          {getProductMarca(item.product_id) && (
                            <span className="block text-xs text-muted-foreground">{getProductMarca(item.product_id)}</span>
                          )}
                          {!getProductMarca(item.product_id) && (
                            <span className="block text-xs text-warning">⚠ sem marca</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.quantidade}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getItemDisplayUnit(item)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {equiv ? (
                          <span className="text-xs text-muted-foreground">{equiv}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.custo_unitario
                          ? `R$ ${Number(item.custo_unitario).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.custo_unitario
                          ? `R$ ${(item.quantidade * Number(item.custo_unitario)).toFixed(2)}`
                          : "—"}
                      </TableCell>
                      {isDraft && !isFinanceiro && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
