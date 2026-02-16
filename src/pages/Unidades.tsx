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
import { Plus, Loader2, Pencil, Warehouse, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

interface Unit {
  id: string;
  name: string;
  type: string;
  company_id: string;
}

const typeLabels: Record<string, string> = {
  cd: "Centro de Distribuição",
  kitchen: "Cozinha",
};

const typeIcons: Record<string, typeof Warehouse> = {
  cd: Warehouse,
  kitchen: UtensilsCrossed,
};

export default function Unidades() {
  const { profile, canManage } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [form, setForm] = useState({ name: "", type: "kitchen" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from("units").select("*").order("name");
    setUnits((data || []) as Unit[]);
    setLoading(false);
  };

  const createUnit = async () => {
    if (!form.name) { toast.error("Informe o nome."); return; }
    const { error } = await supabase.from("units").insert({
      name: form.name,
      type: form.type,
      company_id: profile!.company_id,
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Unidade criada!"); setCreateOpen(false); setForm({ name: "", type: "kitchen" }); loadData(); }
  };

  const updateUnit = async () => {
    if (!editUnit || !form.name) return;
    const { error } = await supabase.from("units").update({ name: form.name, type: form.type }).eq("id", editUnit.id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Unidade atualizada!"); setEditUnit(null); loadData(); }
  };

  const openEdit = (unit: Unit) => {
    setEditUnit(unit);
    setForm({ name: unit.name, type: unit.type });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Unidades</h1>
        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Unidade</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Nova Unidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cd">Centro de Distribuição</SelectItem>
                      <SelectItem value="kitchen">Cozinha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createUnit} className="w-full">Criar Unidade</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editUnit} onOpenChange={(open) => { if (!open) setEditUnit(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Unidade</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-input border-border" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cd">Centro de Distribuição</SelectItem>
                  <SelectItem value="kitchen">Cozinha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={updateUnit} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                {canManage && <TableHead className="w-20">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhuma unidade.</TableCell></TableRow>
              ) : (
                units.map((u) => {
                  const Icon = typeIcons[u.type] || UtensilsCrossed;
                  return (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {u.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{typeLabels[u.type] || u.type}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
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
