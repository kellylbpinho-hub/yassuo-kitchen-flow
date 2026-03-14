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
import { Plus, Loader2, Pencil, Warehouse, UtensilsCrossed, Users, Target } from "lucide-react";
import { toast } from "sonner";

interface Unit {
  id: string;
  name: string;
  type: string;
  company_id: string;
  numero_colaboradores: number;
  target_meal_cost: number | null;
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
  const [form, setForm] = useState({ name: "", type: "kitchen", numero_colaboradores: "0", target_meal_cost: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from("units").select("*").order("name");
    setUnits((data || []) as Unit[]);
    setLoading(false);
  };

  const createUnit = async () => {
    if (!form.name) { toast.error("Informe o nome."); return; }
    const targetVal = form.target_meal_cost ? parseFloat(form.target_meal_cost.replace(",", ".")) : null;
    if (targetVal !== null && targetVal < 0) { toast.error("Meta não pode ser negativa."); return; }
    const { error } = await supabase.from("units").insert({
      name: form.name,
      type: form.type,
      numero_colaboradores: Number(form.numero_colaboradores) || 0,
      target_meal_cost: targetVal,
      company_id: profile!.company_id,
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Unidade criada!"); setCreateOpen(false); setForm({ name: "", type: "kitchen", numero_colaboradores: "0", target_meal_cost: "" }); loadData(); }
  };

  const updateUnit = async () => {
    if (!editUnit || !form.name) return;
    const targetVal = form.target_meal_cost ? parseFloat(form.target_meal_cost.replace(",", ".")) : null;
    if (targetVal !== null && targetVal < 0) { toast.error("Meta não pode ser negativa."); return; }
    const { error } = await supabase.from("units").update({
      name: form.name,
      type: form.type,
      numero_colaboradores: Number(form.numero_colaboradores) || 0,
      target_meal_cost: targetVal,
    }).eq("id", editUnit.id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Unidade atualizada!"); setEditUnit(null); loadData(); }
  };

  const openEdit = (unit: Unit) => {
    setEditUnit(unit);
    setForm({ name: unit.name, type: unit.type, numero_colaboradores: String(unit.numero_colaboradores || 0), target_meal_cost: unit.target_meal_cost != null ? String(unit.target_meal_cost) : "" });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const UnitForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
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
      <div>
        <Label className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Nº de Colaboradores
        </Label>
        <Input
          type="number" min="0"
          value={form.numero_colaboradores}
          onChange={(e) => setForm({ ...form, numero_colaboradores: e.target.value })}
          className="bg-input border-border"
          placeholder="Ex: 150"
        />
      </div>
      <div>
        <Label className="flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          Meta de Custo/Refeição (R$)
        </Label>
        <Input
          type="text"
          inputMode="decimal"
          value={form.target_meal_cost}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.,]/g, "");
            setForm({ ...form, target_meal_cost: v });
          }}
          className="bg-input border-border"
          placeholder="Ex: 18.50"
        />
      </div>
      <Button onClick={onSubmit} className="w-full">{submitLabel}</Button>
    </div>
  );

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
              <DialogHeader><DialogTitle className="font-display">Nova Unidade</DialogTitle></DialogHeader>
              <UnitForm onSubmit={createUnit} submitLabel="Criar Unidade" />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={!!editUnit} onOpenChange={(open) => { if (!open) setEditUnit(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Editar Unidade</DialogTitle></DialogHeader>
          <UnitForm onSubmit={updateUnit} submitLabel="Salvar" />
        </DialogContent>
      </Dialog>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Colaboradores</TableHead>
                {canManage && <TableHead className="w-20">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma unidade.</TableCell></TableRow>
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{u.numero_colaboradores || 0}</span>
                        </div>
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
