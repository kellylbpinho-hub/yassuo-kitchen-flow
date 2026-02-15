import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WasteLog {
  id: string;
  quantidade: number;
  observacao: string | null;
  unidade_id: string;
  created_at: string;
  product_id: string;
  menu_id: string | null;
}

interface Product { id: string; nome: string; unidade_medida: string; unidade_id: string; estoque_atual: number; }
interface Menu { id: string; nome: string; data: string; }
interface Unit { id: string; name: string; }

export default function Desperdicio() {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [form, setForm] = useState({ product_id: "", quantidade: "", observacao: "", menu_id: "", unidade_id: "" });
  const [menuForm, setMenuForm] = useState({ nome: "", data: "", descricao: "", unidade_id: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: w }, { data: p }, { data: m }, { data: u }] = await Promise.all([
      supabase.from("waste_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("products").select("id, nome, unidade_medida, unidade_id, estoque_atual"),
      supabase.from("menus").select("id, nome, data").order("data", { ascending: false }),
      supabase.from("units").select("id, name"),
    ]);
    setLogs((w || []) as WasteLog[]);
    setProducts((p || []) as Product[]);
    setMenus((m || []) as Menu[]);
    setUnits((u || []) as Unit[]);
    const defaultUnit = profile?.unidade_id || (u && u.length > 0 ? u[0].id : "");
    setForm((f) => ({ ...f, unidade_id: defaultUnit }));
    setMenuForm((f) => ({ ...f, unidade_id: defaultUnit }));
    setLoading(false);
  };

  const addMenu = async () => {
    if (!menuForm.nome || !menuForm.data || !menuForm.unidade_id) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const { error } = await supabase.from("menus").insert({
      nome: menuForm.nome,
      data: menuForm.data,
      descricao: menuForm.descricao || null,
      unidade_id: menuForm.unidade_id,
      created_by: user!.id,
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Cardápio criado!"); setMenuOpen(false); loadData(); }
  };

  const addWaste = async () => {
    if (!form.product_id || !form.quantidade || !form.unidade_id) {
      toast.error("Preencha produto e quantidade.");
      return;
    }
    const qty = Number(form.quantidade);

    // Create waste log
    const { error } = await supabase.from("waste_logs").insert({
      product_id: form.product_id,
      quantidade: qty,
      observacao: form.observacao || null,
      menu_id: form.menu_id || null,
      user_id: user!.id,
      unidade_id: form.unidade_id,
    });
    if (error) { toast.error("Erro: " + error.message); return; }

    // Auto movement (perda)
    await supabase.from("movements").insert({
      product_id: form.product_id,
      tipo: "perda",
      quantidade: qty,
      motivo: "Desperdício registrado" + (form.observacao ? `: ${form.observacao}` : ""),
      user_id: user!.id,
      unidade_id: form.unidade_id,
    });

    // Update stock
    const prod = products.find((p) => p.id === form.product_id);
    if (prod) {
      await supabase.from("products").update({ estoque_atual: Math.max(0, prod.estoque_atual - qty) }).eq("id", prod.id);
    }

    toast.success("Desperdício registrado!");
    setAddOpen(false);
    setForm({ product_id: "", quantidade: "", observacao: "", menu_id: "", unidade_id: form.unidade_id });
    loadData();
  };

  const getProductName = (id: string) => products.find((p) => p.id === id)?.nome || "—";
  const getMenuName = (id: string | null) => (id ? menus.find((m) => m.id === id)?.nome : null) || "—";
  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Desperdício</h1>
        <div className="flex gap-2">
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary"><Plus className="h-4 w-4 mr-2" />Cardápio</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader><DialogTitle className="font-display">Novo Cardápio</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={menuForm.nome} onChange={(e) => setMenuForm({ ...menuForm, nome: e.target.value })} className="bg-input border-border" /></div>
                <div><Label>Data</Label><Input type="date" value={menuForm.data} onChange={(e) => setMenuForm({ ...menuForm, data: e.target.value })} className="bg-input border-border" /></div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={menuForm.unidade_id} onValueChange={(v) => setMenuForm({ ...menuForm, unidade_id: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Descrição</Label><Textarea value={menuForm.descricao} onChange={(e) => setMenuForm({ ...menuForm, descricao: e.target.value })} className="bg-input border-border" /></div>
                <Button onClick={addMenu} className="w-full">Criar Cardápio</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Registrar Perda</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader><DialogTitle className="font-display">Registrar Desperdício</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Cardápio (opcional)</Label>
                  <Select value={form.menu_id} onValueChange={(v) => setForm({ ...form, menu_id: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.data})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Produto *</Label>
                  <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantidade *</Label>
                  <Input type="number" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="bg-input border-border" />
                </div>
                <Button onClick={addWaste} className="w-full">Registrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cardápio</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Obs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum registro.</TableCell></TableRow>
              ) : (
                logs.map((l) => (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="text-sm">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{getProductName(l.product_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{getMenuName(l.menu_id)}</TableCell>
                    <TableCell>{l.quantidade}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{getUnitName(l.unidade_id)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{l.observacao || "—"}</TableCell>
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
