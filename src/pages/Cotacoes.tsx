import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Copy, ExternalLink, Eye, ArrowRight, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";

interface Quotation {
  id: string;
  token: string;
  status: string;
  observacao: string | null;
  created_at: string;
  expires_at: string;
  respondido_em: string | null;
  fornecedor_id: string;
  created_by: string;
}

interface QuotationItem {
  id: string;
  quotation_id: string;
  product_id: string | null;
  nome_produto: string;
  unidade_medida: string;
  quantidade: number;
  preco_unitario: number | null;
  observacao_fornecedor: string | null;
  adicionado_pelo_fornecedor: boolean;
}

interface Fornecedor { id: string; nome: string; }
interface Product { id: string; nome: string; unidade_medida: string; marca: string | null; }

const statusColors: Record<string, string> = {
  pendente: "bg-warning/20 text-warning-foreground",
  respondida: "bg-primary/20 text-primary",
  convertida: "bg-success/20 text-success",
  expirada: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  respondida: "Respondida",
  convertida: "Convertida em OC",
  expirada: "Expirada",
};

export default function Cotacoes() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState("");
  const [obsCreate, setObsCreate] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<{ product_id: string; quantidade: string }[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // View dialog
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [viewItems, setViewItems] = useState<QuotationItem[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: q }, { data: f }, { data: p }] = await Promise.all([
      supabase.from("quotation_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("products").select("id, nome, unidade_medida, marca").eq("ativo", true).order("nome"),
    ]);
    setQuotations((q || []) as Quotation[]);
    setFornecedores((f || []) as Fornecedor[]);
    setProducts((p || []) as Product[]);
    setLoading(false);
  };

  const createQuotation = async () => {
    if (!selectedFornecedor) { toast.error("Selecione um fornecedor"); return; }
    if (selectedProducts.length === 0) { toast.error("Adicione pelo menos 1 item"); return; }
    for (const sp of selectedProducts) {
      if (!sp.quantidade || Number(sp.quantidade) <= 0) {
        toast.error("Preencha a quantidade de todos os itens");
        return;
      }
    }

    const { data, error } = await supabase
      .from("quotation_requests")
      .insert({
        company_id: profile!.company_id,
        fornecedor_id: selectedFornecedor,
        created_by: user!.id,
        observacao: obsCreate || null,
      })
      .select("id, token")
      .single();

    if (error) { toast.error("Erro: " + error.message); return; }

    // Insert items
    const itemsToInsert = selectedProducts.map((sp) => {
      const prod = products.find((p) => p.id === sp.product_id);
      return {
        quotation_id: data.id,
        company_id: profile!.company_id,
        product_id: sp.product_id,
        nome_produto: prod?.nome || "",
        unidade_medida: prod?.unidade_medida || "kg",
        quantidade: Number(sp.quantidade),
      };
    });

    await supabase.from("quotation_items").insert(itemsToInsert);

    toast.success("Cotação criada!");
    const link = `${window.location.origin}/cotacao/${data.token}`;
    await navigator.clipboard.writeText(link);
    toast.info("Link copiado para a área de transferência!");

    setCreateOpen(false);
    setSelectedFornecedor("");
    setObsCreate("");
    setSelectedProducts([]);
    loadData();
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/cotacao/${token}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const viewDetails = async (q: Quotation) => {
    setViewQuotation(q);
    setViewLoading(true);
    const { data } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id)
      .order("adicionado_pelo_fornecedor")
      .order("created_at");
    setViewItems((data || []) as QuotationItem[]);
    setViewLoading(false);
  };

  const convertToOrder = async (q: Quotation) => {
    if (q.status !== "respondida") return;

    // Create purchase order from quotation
    const { data: order, error } = await supabase
      .from("purchase_orders")
      .insert({
        status: "rascunho",
        unidade_id: profile!.unidade_id || (await supabase.from("units").select("id").limit(1).single()).data?.id,
        created_by: user!.id,
        company_id: profile!.company_id,
        fornecedor_id: q.fornecedor_id,
      })
      .select("id")
      .single();

    if (error) { toast.error("Erro: " + error.message); return; }

    // Get quotation items with prices
    const { data: qItems } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", q.id);

    if (qItems && qItems.length > 0) {
      const purchaseItems = qItems
        .filter((qi: any) => qi.product_id && qi.preco_unitario)
        .map((qi: any) => ({
          purchase_order_id: order.id,
          company_id: profile!.company_id,
          product_id: qi.product_id,
          quantidade: qi.quantidade,
          custo_unitario: qi.preco_unitario,
        }));

      if (purchaseItems.length > 0) {
        await supabase.from("purchase_items").insert(purchaseItems);
      }
    }

    // Mark quotation as converted
    await supabase
      .from("quotation_requests")
      .update({ status: "convertida" })
      .eq("id", q.id);

    toast.success("Pedido de compra criado a partir da cotação!");
    navigate(`/compras/${order.id}`);
  };

  const getFornecedorName = (id: string) => fornecedores.find((f) => f.id === id)?.nome || "—";

  const addProduct = (productId: string) => {
    if (selectedProducts.some((sp) => sp.product_id === productId)) return;
    setSelectedProducts((prev) => [...prev, { product_id: productId, quantidade: "" }]);
    setProductSearch("");
  };

  const removeProduct = (idx: number) => {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProductQty = (idx: number, qty: string) => {
    setSelectedProducts((prev) => prev.map((sp, i) => (i === idx ? { ...sp, quantidade: qty } : sp)));
  };

  const filteredProducts = productSearch
    ? products.filter((p) => fuzzyMatchProduct(p, productSearch)).slice(0, 8)
    : [];

  const totalCotacao = (items: QuotationItem[]) =>
    items.reduce((sum, i) => sum + (i.preco_unitario || 0) * i.quantidade, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Cotações</h1>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova Cotação</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Cotação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fornecedor *</Label>
                <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação (visível ao fornecedor)</Label>
                <Textarea
                  value={obsCreate}
                  onChange={(e) => setObsCreate(e.target.value)}
                  placeholder="Ex: Cotação para próxima semana..."
                  className="bg-input border-border"
                />
              </div>

              {/* Product selection */}
              <div>
                <Label>Adicionar Itens *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 bg-input border-border"
                  />
                </div>
                {filteredProducts.length > 0 && (
                  <div className="mt-1 border border-border rounded-md bg-popover max-h-40 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => addProduct(p.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 text-foreground"
                        disabled={selectedProducts.some((sp) => sp.product_id === p.id)}
                      >
                        {p.nome} <span className="text-muted-foreground">({p.unidade_medida})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected products */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2">
                  {selectedProducts.map((sp, idx) => {
                    const prod = products.find((p) => p.id === sp.product_id);
                    return (
                      <div key={sp.product_id} className="flex items-center gap-2 bg-muted/30 p-2 rounded">
                        <div className="flex-1 text-sm text-foreground truncate">
                          {prod?.nome} <span className="text-muted-foreground">({prod?.unidade_medida})</span>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Qtd"
                          value={sp.quantidade}
                          onChange={(e) => updateProductQty(idx, e.target.value)}
                          className="w-24 bg-input border-border"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeProduct(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button onClick={createQuotation} className="w-full">
                Criar e Copiar Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Respondida em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhuma cotação criada.
                  </TableCell>
                </TableRow>
              ) : (
                quotations.map((q) => (
                  <TableRow key={q.id} className="border-border">
                    <TableCell className="text-sm">{new Date(q.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm font-medium">{getFornecedorName(q.fornecedor_id)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[q.status] || "bg-muted text-muted-foreground"}>
                        {statusLabels[q.status] || q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {q.respondido_em
                        ? new Date(q.respondido_em).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => copyLink(q.token)} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => viewDetails(q)} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {q.status === "respondida" && (
                        <Button variant="ghost" size="icon" onClick={() => convertToOrder(q)} title="Converter em OC">
                          <ArrowRight className="h-4 w-4 text-success" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View details dialog */}
      <Dialog open={!!viewQuotation} onOpenChange={(open) => !open && setViewQuotation(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Cotação — {viewQuotation && getFornecedorName(viewQuotation.fornecedor_id)}
            </DialogTitle>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {viewQuotation && (
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[viewQuotation.status]}>
                    {statusLabels[viewQuotation.status]}
                  </Badge>
                  {viewQuotation.respondido_em && (
                    <span className="text-xs text-muted-foreground">
                      Respondida em {new Date(viewQuotation.respondido_em).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              )}

              {viewItems.map((item) => (
                <div key={item.id} className="bg-muted/30 p-3 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground">
                      {item.nome_produto}
                      {item.adicionado_pelo_fornecedor && (
                        <Badge variant="outline" className="ml-2 text-xs">Sugerido</Badge>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.quantidade} {item.unidade_medida}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Preço: {item.preco_unitario !== null
                        ? `R$ ${Number(item.preco_unitario).toFixed(2)}`
                        : "Aguardando"}
                    </span>
                    {item.preco_unitario !== null && (
                      <span className="font-medium text-foreground">
                        Total: R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {item.observacao_fornecedor && (
                    <p className="text-xs text-muted-foreground italic">{item.observacao_fornecedor}</p>
                  )}
                </div>
              ))}

              {viewItems.some((i) => i.preco_unitario !== null) && (
                <div className="text-right font-bold text-foreground border-t border-border pt-2">
                  Total: R$ {totalCotacao(viewItems).toFixed(2)}
                </div>
              )}

              {viewQuotation?.status === "respondida" && (
                <Button className="w-full" onClick={() => convertToOrder(viewQuotation!)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Converter em Pedido de Compra
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
