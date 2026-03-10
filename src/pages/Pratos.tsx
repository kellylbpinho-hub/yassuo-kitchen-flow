import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, UtensilsCrossed, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

interface DishCategory {
  id: string;
  nome: string;
  ordem: number;
}

interface Dish {
  id: string;
  nome: string;
  descricao: string | null;
  category_id: string | null;
  is_padrao: boolean;
  ativo: boolean;
  company_id: string;
}

export default function Pratos() {
  const { user, profile, isFinanceiro } = useAuth();
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editDish, setEditDish] = useState<Dish | null>(null);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    category_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: cats }, { data: d }] = await Promise.all([
      supabase.from("dish_categories").select("*").order("ordem"),
      supabase.from("dishes").select("*").order("nome"),
    ]);
    setCategories((cats || []) as DishCategory[]);
    setDishes((d || []) as Dish[]);
    setLoading(false);
  };

  const resetForm = () => setForm({ nome: "", descricao: "", category_id: "" });

  const saveDish = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome do prato é obrigatório.");
      return;
    }

    if (editDish) {
      const { error } = await supabase.from("dishes").update({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        category_id: form.category_id || null,
      }).eq("id", editDish.id);
      if (error) toast.error(error.message);
      else { toast.success("Prato atualizado!"); setEditDish(null); resetForm(); loadData(); }
    } else {
      const { error } = await supabase.from("dishes").insert({
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        category_id: form.category_id || null,
        is_padrao: false,
        company_id: profile!.company_id,
        created_by: user!.id,
      });
      if (error) toast.error(error.message);
      else { toast.success("Prato criado!"); setAddOpen(false); resetForm(); loadData(); }
    }
  };

  const toggleAtivo = async (dish: Dish) => {
    const { error } = await supabase.from("dishes").update({ ativo: !dish.ativo }).eq("id", dish.id);
    if (error) toast.error(error.message);
    else loadData();
  };

  const openEdit = (dish: Dish) => {
    setForm({ nome: dish.nome, descricao: dish.descricao || "", category_id: dish.category_id || "" });
    setEditDish(dish);
  };

  const getCategoryName = (id: string | null) =>
    id ? categories.find((c) => c.id === id)?.nome || "—" : "Sem categoria";

  const filtered = dishes.filter((d) => {
    const matchSearch = d.nome.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || d.category_id === filterCategory;
    return matchSearch && matchCat;
  });

  const grouped = categories
    .map((cat) => ({
      category: cat,
      items: filtered.filter((d) => d.category_id === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const uncategorized = filtered.filter((d) => !d.category_id);

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
        <h1 className="text-2xl font-display font-bold text-foreground">Pratos</h1>
        {!isFinanceiro && (
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Prato</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader><DialogTitle className="font-display">Novo Prato</DialogTitle></DialogHeader>
              <DishForm form={form} setForm={setForm} categories={categories} onSave={saveDish} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48 bg-input border-border">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editDish} onOpenChange={(o) => { if (!o) { setEditDish(null); resetForm(); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Editar Prato</DialogTitle></DialogHeader>
          <DishForm form={form} setForm={setForm} categories={categories} onSave={saveDish} />
        </DialogContent>
      </Dialog>

      {/* Grouped list */}
      {grouped.length === 0 && uncategorized.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum prato encontrado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ category, items }) => (
            <div key={category.id} className="glass-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">{category.nome}</h3>
              </div>
              <div className="divide-y divide-border">
                {items.map((dish) => (
                  <DishRow
                    key={dish.id}
                    dish={dish}
                    getCategoryName={getCategoryName}
                    onToggle={toggleAtivo}
                    onEdit={openEdit}
                    isFinanceiro={isFinanceiro}
                  />
                ))}
              </div>
            </div>
          ))}
          {uncategorized.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold text-muted-foreground">Sem categoria</h3>
              </div>
              <div className="divide-y divide-border">
                {uncategorized.map((dish) => (
                  <DishRow
                    key={dish.id}
                    dish={dish}
                    getCategoryName={getCategoryName}
                    onToggle={toggleAtivo}
                    onEdit={openEdit}
                    isFinanceiro={isFinanceiro}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function DishForm({
  form,
  setForm,
  categories,
  onSave,
}: {
  form: { nome: string; descricao: string; category_id: string };
  setForm: (f: typeof form) => void;
  categories: DishCategory[];
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Nome *</Label>
        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="bg-input border-border" />
      </div>
      <div>
        <Label>Categoria</Label>
        <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
          <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="bg-input border-border" />
      </div>
      <Button onClick={onSave} className="w-full">Salvar</Button>
    </div>
  );
}

function DishRow({
  dish,
  getCategoryName,
  onToggle,
  onEdit,
  isFinanceiro,
}: {
  dish: Dish;
  getCategoryName: (id: string | null) => string;
  onToggle: (d: Dish) => void;
  onEdit: (d: Dish) => void;
  isFinanceiro: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${dish.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>
            {dish.nome}
          </span>
          {dish.is_padrao && <Badge variant="secondary" className="text-[10px] px-1.5">Padrão</Badge>}
          {!dish.ativo && <Badge variant="outline" className="text-[10px] px-1.5 text-destructive border-destructive/30">Inativo</Badge>}
        </div>
        {dish.descricao && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{dish.descricao}</p>
        )}
      </div>
      {!isFinanceiro && (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onEdit(dish)} className="text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <Switch checked={dish.ativo} onCheckedChange={() => onToggle(dish)} />
        </div>
      )}
    </div>
  );
}
