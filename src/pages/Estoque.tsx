import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, RefreshCw, Search, Loader2, AlertTriangle, Eye, Pencil, MoreVertical, FileSpreadsheet, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";
import { ProductDetailDrawer } from "@/components/ProductDetailDrawer";
import { EditProductDialog } from "@/components/EditProductDialog";
import { exportEstoqueExcel } from "@/lib/excelExport";
import { ImportProductsDialog } from "@/components/ImportProductsDialog";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string | null;
  category_id: string | null;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  validade: string | null;
  unidade_id: string;
  product_categories?: { name: string } | null;
}

interface Unit {
  id: string;
  name: string;
  type: string;
}

interface StockByUnit {
  product_id: string;
  unidade_id: string;
  saldo: number;
}

export default function Estoque() {
  const { user, canSeeCosts, profile, canManage, isFinanceiro, isNutricionista } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockByUnit, setStockByUnit] = useState<StockByUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    nome: "", categoria: "", unidade_medida: "kg", estoque_minimo: "0", unidade_id: "",
  });

  const [movForm, setMovForm] = useState({ tipo: "saida", quantidade: "", motivo: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: u }, { data: cats }, { data: sbu }] = await Promise.all([
      supabase.from("products").select("*, product_categories(name)").eq("ativo", true).order("nome"),
      supabase.from("units").select("id, name, type"),
      supabase.from("product_categories").select("id, name").order("name"),
      supabase.from("v_estoque_por_unidade").select("product_id, unidade_id, saldo"),
    ]);
    setProducts((prods || []) as Product[]);
    setUnits((u || []) as Unit[]);
    setCategories((cats || []) as Category[]);
    setStockByUnit((sbu || []) as StockByUnit[]);
    if (u && u.length > 0 && !form.unidade_id) {
      setForm((f) => ({ ...f, unidade_id: profile?.unidade_id || u[0].id }));
    }
    setLoading(false);
  };

  const getStockForUnit = (productId: string, unitId: string) => {
    const entry = stockByUnit.find((s) => s.product_id === productId && s.unidade_id === unitId);
    return entry?.saldo ?? 0;
  };

  const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];

  const addProduct = async () => {
    if (!form.nome || !form.unidade_id) {
      toast.error("Preencha nome e unidade.");
      return;
    }
    if (!form.categoria) {
      toast.error("Selecione uma categoria.");
      return;
    }
    const { data, error } = await supabase.rpc("rpc_create_product", {
      p_unidade_id: form.unidade_id,
      p_nome: form.nome,
      p_unidade_medida: form.unidade_medida,
    });
    if (error) {
      toast.error("Erro ao adicionar produto: " + error.message);
    } else {
      const result = data as any;
      const productId = result?.id;
      if (productId && !result?.already_existed) {
        await supabase.from("products").update({ categoria: form.categoria }).eq("id", productId);
      }
      toast.success("Produto adicionado!");
      setAddOpen(false);
      setForm({ nome: "", categoria: "", unidade_medida: "kg", estoque_minimo: "0", unidade_id: form.unidade_id });
      loadData();
    }
  };

  const addMovement = async () => {
    if (!selectedProduct || !movForm.quantidade) return;
    const qty = Number(movForm.quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    // All movement types now use FEFO RPC (entrada/ajuste removed from UI)
    const { error } = await supabase.rpc("rpc_consume_fefo", {
      p_product_id: selectedProduct.id,
      p_unidade_id: selectedProduct.unidade_id,
      p_quantidade: qty,
      p_tipo: movForm.tipo,
      p_motivo: movForm.motivo || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Movimentação registrada!");
    setMovOpen(false);
    setMovForm({ tipo: "saida", quantidade: "", motivo: "" });
    loadData();
  };

  const filtered = products.filter((p) => {
    const matchesSearch = fuzzyMatchProduct(p, search);
    const matchesCategory = filterCategory === "all" || getCategoryName(p) === filterCategory;
    if (filterUnit === "all") return matchesSearch && matchesCategory;
    const hasStock = stockByUnit.some((s) => s.product_id === p.id && s.unidade_id === filterUnit && s.saldo > 0);
    const isAssigned = p.unidade_id === filterUnit;
    return matchesSearch && matchesCategory && (hasStock || isAssigned);
  });

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";
  const getCategoryName = (p: Product) => p.product_categories?.name || p.categoria || "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Estoque</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-48" data-guide="search-estoque">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-40 bg-input border-border" data-guide="filter-unit">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} ({u.type.toUpperCase()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { data: lotes } = await supabase.from("lotes").select("product_id, codigo, quantidade, validade, status, unidade_id").eq("status", "ativo").gt("quantidade", 0);
              exportEstoqueExcel({
                canSeeCosts,
                produtos: filtered.map((p) => ({
                  nome: p.nome,
                  categoria: getCategoryName(p),
                  unidade_medida: p.unidade_medida,
                  estoque_atual: Number(p.estoque_atual),
                  estoque_minimo: Number(p.estoque_minimo),
                  custo_unitario: Number(p.custo_unitario),
                  valor_em_estoque: Number(p.estoque_atual) * Number(p.custo_unitario),
                  unidade: getUnitName(p.unidade_id),
                })),
                lotes: (lotes || []).map((l: any) => ({
                  produto: products.find((p) => p.id === l.product_id)?.nome || "—",
                  codigo: l.codigo || "—",
                  quantidade: Number(l.quantidade),
                  validade: new Date(l.validade).toLocaleDateString("pt-BR"),
                  status: l.status,
                  unidade: getUnitName(l.unidade_id),
                })),
              });
              toast.success("Relatório Excel exportado!");
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />Exportar Excel
          </Button>
          {!isFinanceiro && !isNutricionista && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Importar Planilha
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" />Novo</Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">Novo Produto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome *</Label>
                      <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-input border-border" />
                    </div>
                    <div>
                      <Label>Categoria *</Label>
                      <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                        <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_FIXAS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Unid. Medida</Label>
                        <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                          <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["kg", "g", "L", "ml", "un"].map((u) => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                          <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Estoque Mínimo</Label>
                      <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} className="bg-input border-border" />
                    </div>
                    <Button onClick={addProduct} className="w-full">Adicionar Produto</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2" data-guide="category-chips">
        {["all", ...CATEGORIAS_FIXAS].map((cat) => (
          <Button
            key={cat}
            variant={filterCategory === cat ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => setFilterCategory(cat)}
          >
            {cat === "all" ? "Todos" : cat}
          </Button>
        ))}
      </div>

      {/* Movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Movimentação: {selectedProduct?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={(v) => setMovForm({ ...movForm, tipo: v })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="consumo">Consumo</SelectItem>
                  <SelectItem value="perda">Perda</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Entradas devem ser feitas via Recebimento Digital (com lote/validade). Ajustes manuais desativados para manter FEFO.
              </p>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={movForm.quantidade} onChange={(e) => setMovForm({ ...movForm, quantidade: e.target.value })} className="bg-input border-border" />
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} className="bg-input border-border" placeholder="Opcional" />
            </div>
            <Button onClick={addMovement} className="w-full">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk of stockout alert */}
      {(() => {
        const rupturaItems = filtered.filter((p) =>
          filterUnit !== "all"
            ? getStockForUnit(p.id, filterUnit) < p.estoque_minimo
          : stockByUnit.filter((s) => s.product_id === p.id).reduce((sum, s) => sum + (s.saldo || 0), 0) < p.estoque_minimo
        );
        if (rupturaItems.length === 0) return null;
        return (
          <div className="glass-card p-4 border border-destructive/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-sm font-display font-semibold text-destructive">
                Itens em Risco de Ruptura ({rupturaItems.length})
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {rupturaItems.slice(0, 10).map((p) => {
                const saldo = filterUnit !== "all" ? getStockForUnit(p.id, filterUnit) : stockByUnit.filter((s) => s.product_id === p.id).reduce((sum, s) => sum + (s.saldo || 0), 0);
                return (
                  <Badge key={p.id} variant="destructive" className="text-xs gap-1">
                    {p.nome}: {saldo}/{p.estoque_minimo} {p.unidade_medida}
                  </Badge>
                );
              })}
              {rupturaItems.length > 10 && (
                <Badge variant="secondary" className="text-xs">+{rupturaItems.length - 10} mais</Badge>
              )}
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>{filterUnit !== "all" ? "Saldo Unidade" : "Saldo (Lotes)"}</TableHead>
                <TableHead>Mínimo</TableHead>
                {canSeeCosts && <TableHead>Custo</TableHead>}
                <TableHead>Unidade</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canSeeCosts ? 7 : 6} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="border-border" data-guide={filtered.indexOf(p) === 0 ? "product-row" : undefined}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{p.nome}</span>
                        {p.marca && (
                          <span className="block text-xs text-muted-foreground">{p.marca}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getCategoryName(p)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {filterUnit !== "all" ? (
                          <>
                            <span className={`font-semibold ${getStockForUnit(p.id, filterUnit) < p.estoque_minimo ? "text-destructive" : ""}`}>
                              {getStockForUnit(p.id, filterUnit)}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {p.estoque_atual} total</span>
                          </>
                        ) : (
                          (() => {
                            const totalLotes = stockByUnit
                              .filter((s) => s.product_id === p.id)
                              .reduce((sum, s) => sum + (s.saldo || 0), 0);
                            return (
                              <span className={totalLotes < p.estoque_minimo ? "text-destructive font-semibold" : ""}>
                                {totalLotes}
                              </span>
                            );
                          })()
                        )}
                        <span className="text-xs text-muted-foreground">{p.unidade_medida}</span>
                        {(filterUnit !== "all"
                          ? getStockForUnit(p.id, filterUnit) < p.estoque_minimo
                          : stockByUnit.filter((s) => s.product_id === p.id).reduce((sum, s) => sum + (s.saldo || 0), 0) < p.estoque_minimo
                        ) && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            Ruptura
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.estoque_minimo}</TableCell>
                    {canSeeCosts && (
                      <TableCell>R$ {Number(p.custo_unitario).toFixed(2)}</TableCell>
                    )}
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {getUnitName(p.unidade_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-guide={filtered.indexOf(p) === 0 ? "product-actions" : undefined}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailProduct(p)}>
                            <Eye className="h-4 w-4 mr-2" />Detalhes
                          </DropdownMenuItem>
                          {!isFinanceiro && !isNutricionista && (
                            <>
                              <DropdownMenuItem onClick={() => setEditProduct(p)}>
                                <Pencil className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedProduct(p); setMovOpen(true); }}>
                                <RefreshCw className="h-4 w-4 mr-2" />Movimentar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Product detail drawer */}
      <ProductDetailDrawer
        productId={detailProduct?.id || null}
        productName={detailProduct?.nome || ""}
        filterUnitId={filterUnit}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
      />

      {/* Edit product dialog */}
      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSaved={loadData}
      />

      {/* Import products dialog */}
      <ImportProductsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
        units={units}
        defaultUnitId={profile?.unidade_id || units[0]?.id || ""}
      />
    </div>
  );
}
