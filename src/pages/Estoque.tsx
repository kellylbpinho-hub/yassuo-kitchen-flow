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
import { Plus, ArrowDown, ArrowUp, RefreshCw, Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  nome: string;
  categoria: string | null;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  validade: string | null;
  unidade_id: string;
}

interface Unit {
  id: string;
  name: string;
}

export default function Estoque() {
  const { user, canSeeCosts, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New product form
  const [form, setForm] = useState({
    nome: "", categoria: "", unidade_medida: "kg", estoque_atual: "0",
    estoque_minimo: "0", custo_unitario: "0", validade: "", unidade_id: "",
  });

  // Movement form
  const [movForm, setMovForm] = useState({ tipo: "entrada", quantidade: "", motivo: "" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: prods }, { data: u }] = await Promise.all([
      supabase.from("products").select("*").order("nome"),
      supabase.from("units").select("id, name"),
    ]);
    setProducts((prods || []) as Product[]);
    setUnits((u || []) as Unit[]);
    if (u && u.length > 0 && !form.unidade_id) {
      setForm((f) => ({ ...f, unidade_id: profile?.unidade_id || u[0].id }));
    }
    setLoading(false);
  };

  const addProduct = async () => {
    if (!form.nome || !form.unidade_id) {
      toast.error("Preencha nome e unidade.");
      return;
    }
    const { error } = await supabase.from("products").insert({
      nome: form.nome,
      categoria: form.categoria || null,
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
      setForm({ nome: "", categoria: "", unidade_medida: "kg", estoque_atual: "0", estoque_minimo: "0", custo_unitario: "0", validade: "", unidade_id: form.unidade_id });
      loadData();
    }
  };

  const addMovement = async () => {
    if (!selectedProduct || !movForm.quantidade) return;
    if (movForm.tipo === "ajuste" && !movForm.motivo) {
      toast.error("Motivo é obrigatório para ajustes.");
      return;
    }

    const qty = Number(movForm.quantidade);
    const { error: movErr } = await supabase.from("movements").insert({
      product_id: selectedProduct.id,
      tipo: movForm.tipo,
      quantidade: qty,
      motivo: movForm.motivo || null,
      user_id: user!.id,
      unidade_id: selectedProduct.unidade_id,
      company_id: profile!.company_id,
    });

    if (movErr) {
      toast.error("Erro ao registrar movimentação: " + movErr.message);
      return;
    }

    // Update stock
    let newStock = selectedProduct.estoque_atual;
    if (movForm.tipo === "entrada") newStock += qty;
    else if (["saida", "consumo", "perda"].includes(movForm.tipo)) newStock -= qty;
    else if (movForm.tipo === "ajuste") newStock = qty;

    await supabase.from("products").update({ estoque_atual: newStock }).eq("id", selectedProduct.id);

    toast.success("Movimentação registrada!");
    setMovOpen(false);
    setMovForm({ tipo: "entrada", quantidade: "", motivo: "" });
    loadData();
  };

  const filtered = products.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase())
  );

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

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
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
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
                  <Label>Categoria</Label>
                  <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="bg-input border-border" />
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

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Estoque</TableHead>
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
                    <TableCell className="text-muted-foreground">{p.categoria || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.estoque_atual}
                        <span className="text-xs text-muted-foreground">{p.unidade_medida}</span>
                        {p.estoque_atual < p.estoque_minimo && (
                          <AlertTriangle className="h-4 w-4 text-warning" />
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
