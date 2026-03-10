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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FichaTecnica } from "@/components/FichaTecnica";

interface WasteLog {
  id: string;
  quantidade: number;
  sobra_prato: number;
  sobra_limpa_rampa: number;
  desperdicio_total_organico: number;
  observacao: string | null;
  unidade_id: string;
  created_at: string;
  product_id: string;
  menu_id: string | null;
}

interface Product { id: string; nome: string; unidade_medida: string; unidade_id: string; estoque_atual: number; }
interface Menu { id: string; nome: string; data: string; unidade_id: string; }
interface Unit { id: string; name: string; }

export default function Desperdicio() {
  const { user, profile, isFinanceiro } = useAuth();
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const [form, setForm] = useState({
    product_id: "", sobra_prato: "", sobra_limpa_rampa: "", desperdicio_total_organico: "",
    observacao: "", menu_id: "", unidade_id: "",
  });
  

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: w }, { data: p }, { data: m }, { data: u }] = await Promise.all([
      supabase.from("waste_logs").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("products").select("id, nome, unidade_medida, unidade_id, estoque_atual").eq("ativo", true),
      supabase.from("menus").select("id, nome, data, unidade_id").order("data", { ascending: false }),
      supabase.from("units").select("id, name"),
    ]);
    setLogs((w || []) as WasteLog[]);
    setProducts((p || []) as Product[]);
    setMenus((m || []) as Menu[]);
    setUnits((u || []) as Unit[]);
    const defaultUnit = profile?.unidade_id || (u && u.length > 0 ? u[0].id : "");
    setForm((f) => ({ ...f, unidade_id: defaultUnit }));
    setLoading(false);
  };

  const addMenu = async () => {
    if (!menuForm.nome || !menuForm.data || !menuForm.unidade_id) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const { error } = await supabase.from("menus").insert({
      nome: menuForm.nome, data: menuForm.data,
      descricao: menuForm.descricao || null, unidade_id: menuForm.unidade_id,
      created_by: user!.id, company_id: profile!.company_id,
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Cardápio criado!"); setMenuOpen(false); loadData(); }
  };

  const addWaste = async () => {
    if (!form.product_id || !form.unidade_id) {
      toast.error("Selecione produto e unidade.");
      return;
    }
    const prato = Number(form.sobra_prato) || 0;
    const rampa = Number(form.sobra_limpa_rampa) || 0;
    const compostagem = Number(form.desperdicio_total_organico) || 0;
    const total = prato + rampa + compostagem;

    if (total <= 0) {
      toast.error("Informe ao menos uma pesagem.");
      return;
    }

    const { error } = await supabase.rpc("rpc_consume_fefo", {
      p_product_id: form.product_id,
      p_unidade_id: form.unidade_id,
      p_quantidade: total,
      p_tipo: "desperdicio",
      p_motivo: `Prato: ${prato}kg | Rampa: ${rampa}kg | Compostagem: ${compostagem}kg`,
      p_menu_id: form.menu_id || null,
      p_observacao: form.observacao || null,
    });

    if (error) { toast.error(error.message); return; }

    // Update the waste_log with the three weighing fields
    const { data: latestLog } = await supabase
      .from("waste_logs")
      .select("id")
      .eq("product_id", form.product_id)
      .eq("unidade_id", form.unidade_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestLog) {
      await supabase.from("waste_logs").update({
        sobra_prato: prato,
        sobra_limpa_rampa: rampa,
        desperdicio_total_organico: compostagem,
      }).eq("id", latestLog.id);
    }

    toast.success("Desperdício registrado!");
    setAddOpen(false);
    setForm({ product_id: "", sobra_prato: "", sobra_limpa_rampa: "", desperdicio_total_organico: "", observacao: "", menu_id: "", unidade_id: form.unidade_id });
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
          {!isFinanceiro && (
            <>
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
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader><DialogTitle className="font-display">Registrar Desperdício</DialogTitle></DialogHeader>
                  <div className="space-y-4">
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

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Pesagens</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">🍽️ Prato <span className="text-muted-foreground">kg</span></Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={form.sobra_prato}
                            onChange={(e) => setForm({ ...form, sobra_prato: e.target.value })}
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">🔽 Rampa <span className="text-muted-foreground">kg</span></Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={form.sobra_limpa_rampa}
                            onChange={(e) => setForm({ ...form, sobra_limpa_rampa: e.target.value })}
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">♻️ Compost. <span className="text-muted-foreground">kg</span></Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={form.desperdicio_total_organico}
                            onChange={(e) => setForm({ ...form, desperdicio_total_organico: e.target.value })}
                            className="bg-input border-border"
                          />
                        </div>
                      </div>
                    </div>

                    {(Number(form.sobra_prato) > 0 || Number(form.sobra_limpa_rampa) > 0 || Number(form.desperdicio_total_organico) > 0) && (
                      <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm">
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-semibold text-foreground">
                          {((Number(form.sobra_prato) || 0) + (Number(form.sobra_limpa_rampa) || 0) + (Number(form.desperdicio_total_organico) || 0)).toFixed(2)} kg
                        </span>
                      </div>
                    )}

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
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="cardapios" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="cardapios">Cardápios & Fichas Técnicas</TabsTrigger>
          <TabsTrigger value="registros">Registros de Desperdício</TabsTrigger>
        </TabsList>

        <TabsContent value="cardapios" className="space-y-3 mt-4">
          {menus.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum cardápio cadastrado. Clique em "+ Cardápio" para começar.</p>
            </div>
          ) : (
            menus.map((m) => (
              <div key={m.id} className="glass-card overflow-hidden">
                <button
                  onClick={() => setExpandedMenu(expandedMenu === m.id ? null : m.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">{m.nome}</h3>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</Badge>
                      <Badge variant="outline" className="text-xs">{getUnitName(m.unidade_id)}</Badge>
                    </div>
                  </div>
                  {expandedMenu === m.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedMenu === m.id && (
                  <div className="border-t border-border p-4">
                    <FichaTecnica menuId={m.id} unidadeId={m.unidade_id} companyId={profile!.company_id} />
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="registros" className="mt-4">
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cardápio</TableHead>
                    <TableHead className="text-right">🍽️ Prato</TableHead>
                    <TableHead className="text-right">🔽 Rampa</TableHead>
                    <TableHead className="text-right">♻️ Compost.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Unidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro.</TableCell></TableRow>
                  ) : (
                    logs.map((l) => (
                      <TableRow key={l.id} className="border-border">
                        <TableCell className="text-sm">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-medium">{getProductName(l.product_id)}</TableCell>
                        <TableCell className="text-muted-foreground">{getMenuName(l.menu_id)}</TableCell>
                        <TableCell className="text-right">{l.sobra_prato > 0 ? `${l.sobra_prato} kg` : "—"}</TableCell>
                        <TableCell className="text-right">{l.sobra_limpa_rampa > 0 ? `${l.sobra_limpa_rampa} kg` : "—"}</TableCell>
                        <TableCell className="text-right">{l.desperdicio_total_organico > 0 ? `${l.desperdicio_total_organico} kg` : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{l.quantidade} kg</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{getUnitName(l.unidade_id)}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
