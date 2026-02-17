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
import { Plus, RefreshCw, Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  nome: string;
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
  const { user, canSeeCosts, profile, canManage } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockByUnit, setStockByUnit] = useState<StockByUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    nome: "", category_id: "", unidade_medida: "kg", estoque_atual: "0",
    estoque_minimo: "0", custo_unitario: "0", validade: "", unidade_id: "",
  });

  const [movForm, setMovForm] = useState({ tipo: "entrada", quantidade: "", motivo: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: u }, { data: cats }, { data: sbu }] = await Promise.all([
      supabase.from("products").select("*, product_categories(name)").order("nome"),
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

  const addProduct = async () => {
    if (!form.nome || !form.unidade_id) {
      toast.error("Preencha nome e unidade.");
      return;
    }
    if (categories.length > 0 && !form.category_id) {
      toast.error("Selecione uma categoria.");
      return;
    }
    const { error } = await supabase.from("products").insert({
      nome: form.nome,
      category_id: form.category_id || null,
      categoria: null,
      unidade_medida: form.unidade_medida,
      estoque_atual: Number(form.estoque_atual),
      estoque_minimo: Number(form.estoque_minimo),
      custo_unitario: Number(form.custo_unitario),
      validade: form.validade || null,
      unidade_id: form.unidade_id,
      company_id: profile!.company_id,
    });
    if (error) {
      toast.error("Erro ao adicionar produto: " + error.message);
    } else {
      toast.success("Produto adicionado!");
      setAddOpen(false);
      setForm({ nome: "", category_id: "", unidade_medida: "kg", estoque_atual: "0", estoque_minimo: "0", custo_unitario: "0", validade: "", unidade_id: form.unidade_id });
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

    // Types that consume stock use the FEFO RPC
    if (["saida", "consumo", "perda"].includes(movForm.tipo)) {
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
    } else if (movForm.tipo === "ajuste") {
      if (!movForm.motivo) {
        toast.error("Motivo é obrigatório para ajustes.");
        return;
      }
      // Ajuste sets absolute value — keep direct write (no FEFO)
      const { error: movErr } = await supabase.from("movements").insert({
        product_id: selectedProduct.id,
        tipo: "ajuste",
        quantidade: qty,
        motivo: movForm.motivo,
        user_id: user!.id,
        unidade_id: selectedProduct.unidade_id,
        company_id: profile!.company_id,
      });
      if (movErr) {
        toast.error("Erro: " + movErr.message);
        return;
      }
      await supabase.from("products").update({ estoque_atual: qty }).eq("id", selectedProduct.id);
    } else if (movForm.tipo === "entrada") {
      // Entrada without lot — keep direct write (use recebimento digital for full flow)
      const { error: movErr } = await supabase.from("movements").insert({
        product_id: selectedProduct.id,
        tipo: "entrada",
        quantidade: qty,
        motivo: movForm.motivo || "Entrada manual",
        user_id: user!.id,
        unidade_id: selectedProduct.unidade_id,
        company_id: profile!.company_id,
      });
      if (movErr) {
        toast.error("Erro: " + movErr.message);
        return;
      }
      await supabase.from("products")
        .update({ estoque_atual: selectedProduct.estoque_atual + qty })
        .eq("id", selectedProduct.id);
    }

    toast.success("Movimentação registrada!");
    setMovOpen(false);
    setMovForm({ tipo: "entrada", quantidade: "", motivo: "" });
    loadData();
  };

  const filtered = products.filter((p) => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase());
    if (filterUnit === "all") return matchesSearch;
    // Show products that have stock in the selected unit (via view) OR are assigned to that unit
    const hasStock = stockByUnit.some((s) => s.product_id === p.id && s.unidade_id === filterUnit && s.saldo > 0);
    const isAssigned = p.unidade_id === filterUnit;
    return matchesSearch && (hasStock || isAssigned);
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
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-40 bg-input border-border">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name} ({u.type.toUpperCase()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  <Label>Categoria {categories.length > 0 ? "*" : ""}</Label>
                  {categories.length > 0 ? (
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground py-2">
                      Nenhuma categoria cadastrada.{" "}
                      {canManage && (
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2 hover:text-primary/80"
                          onClick={() => navigate("/categorias")}
                        >
                          Criar categoria
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Unid. Medida</Label>
                    <Select value={form.unidade_medida} onValueChange={(v) => setForm({ ...form, unidade_medida: v })}>
                      <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["kg", "L", "un", "caixa", "fardo"].map((u) => (
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
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Estoque Atual</Label>
                    <Input type="number" value={form.estoque_atual} onChange={(e) => setForm({ ...form, estoque_atual: e.target.value })} className="bg-input border-border" />
                  </div>
                  <div>
                    <Label>Mínimo</Label>
                    <Input type="number" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} className="bg-input border-border" />
                  </div>
                  {canSeeCosts && (
                    <div>
                      <Label>Custo (R$)</Label>
                      <Input type="number" value={form.custo_unitario} onChange={(e) => setForm({ ...form, custo_unitario: e.target.value })} className="bg-input border-border" />
                    </div>
                  )}
                </div>
                <div>
                  <Label>Validade</Label>
                  <Input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="bg-input border-border" />
                </div>
                <Button onClick={addProduct} className="w-full">Adicionar Produto</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
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
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="consumo">Consumo</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                  <SelectItem value="perda">Perda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" value={movForm.quantidade} onChange={(e) => setMovForm({ ...movForm, quantidade: e.target.value })} className="bg-input border-border" />
            </div>
            {movForm.tipo === "ajuste" && (
              <div>
                <Label>Motivo *</Label>
                <Textarea value={movForm.motivo} onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })} className="bg-input border-border" />
              </div>
            )}
            <Button onClick={addMovement} className="w-full">Registrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Risk of stockout alert */}
      {(() => {
        const rupturaItems = filtered.filter((p) =>
          filterUnit !== "all"
            ? getStockForUnit(p.id, filterUnit) < p.estoque_minimo
            : p.estoque_atual < p.estoque_minimo
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
                const saldo = filterUnit !== "all" ? getStockForUnit(p.id, filterUnit) : p.estoque_atual;
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
                <TableHead>{filterUnit !== "all" ? "Saldo Unidade" : "Estoque Geral"}</TableHead>
                <TableHead>Mínimo</TableHead>
                {canSeeCosts && <TableHead>Custo</TableHead>}
                <TableHead>Unidade</TableHead>
                <TableHead className="w-24">Ações</TableHead>
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
                  <TableRow key={p.id} className="border-border">
                    <TableCell className="font-medium">{p.nome}</TableCell>
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
                          <span className={p.estoque_atual < p.estoque_minimo ? "text-destructive font-semibold" : ""}>
                            {p.estoque_atual}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{p.unidade_medida}</span>
                        {(filterUnit !== "all"
                          ? getStockForUnit(p.id, filterUnit) < p.estoque_minimo
                          : p.estoque_atual < p.estoque_minimo
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedProduct(p); setMovOpen(true); }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
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
