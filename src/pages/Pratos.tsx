import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Search, ChefHat, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { DishCard, type DishCardData, type FichaStatus } from "@/components/pratos/DishCard";
import { PratosEmptyState } from "@/components/pratos/PratosEmptyState";

interface DishCategory {
  id: string;
  nome: string;
  ordem: number;
}

interface DishRow {
  id: string;
  nome: string;
  descricao: string | null;
  category_id: string | null;
  is_padrao: boolean;
  ativo: boolean;
  company_id: string;
  peso_porcao: number | null;
}

interface IngredientRow {
  dish_id: string;
  product_id: string;
  peso_limpo_per_capita: number;
  fator_correcao: number;
}

interface ProductCost {
  id: string;
  custo_unitario: number | null;
}

interface MenuUsageRow {
  dish_id: string;
  data: string;
}

export default function Pratos() {
  const { user, profile, isFinanceiro } = useAuth();
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [dishes, setDishes] = useState<DishRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [productCosts, setProductCosts] = useState<Map<string, number>>(new Map());
  const [usage, setUsage] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterFicha, setFilterFicha] = useState<string>("all");
  const [filterUsage, setFilterUsage] = useState<string>("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editDish, setEditDish] = useState<DishRow | null>(null);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    category_id: "",
    peso_porcao: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: cats }, { data: d }, { data: ing }, { data: prods }, { data: menuRows }] =
      await Promise.all([
        supabase.from("dish_categories").select("*").order("ordem"),
        supabase.from("dishes").select("*").order("nome"),
        supabase
          .from("recipe_ingredients")
          .select("dish_id, product_id, peso_limpo_per_capita, fator_correcao"),
        supabase.from("products").select("id, custo_unitario"),
        supabase
          .from("menu_dishes")
          .select("dish_id, menus!inner(data)")
          .order("created_at", { ascending: false }),
      ]);

    setCategories((cats || []) as DishCategory[]);
    setDishes((d || []) as DishRow[]);
    setIngredients(((ing || []) as IngredientRow[]).filter((r) => r.dish_id));

    const costMap = new Map<string, number>();
    ((prods || []) as ProductCost[]).forEach((p) => {
      if (p.custo_unitario) costMap.set(p.id, Number(p.custo_unitario));
    });
    setProductCosts(costMap);

    const usageMap = new Map<string, string>();
    (menuRows || []).forEach((row: any) => {
      const data = row.menus?.data;
      if (!data || !row.dish_id) return;
      const existing = usageMap.get(row.dish_id);
      if (!existing || data > existing) usageMap.set(row.dish_id, data);
    });
    setUsage(usageMap);

    setLoading(false);
  };

  const resetForm = () =>
    setForm({ nome: "", descricao: "", category_id: "", peso_porcao: "" });

  const saveDish = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome do prato é obrigatório.");
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      category_id: form.category_id || null,
      peso_porcao: form.peso_porcao ? Number(form.peso_porcao) : null,
    };

    if (editDish) {
      const { error } = await supabase.from("dishes").update(payload).eq("id", editDish.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Prato atualizado.");
        setEditDish(null);
        resetForm();
        loadData();
      }
    } else {
      const { error } = await supabase.from("dishes").insert({
        ...payload,
        is_padrao: false,
        company_id: profile!.company_id,
        created_by: user!.id,
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Prato criado.");
        setAddOpen(false);
        resetForm();
        loadData();
      }
    }
  };

  const handleArchive = async (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const { error } = await supabase
      .from("dishes")
      .update({ ativo: !dish.ativo })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(dish.ativo ? "Prato arquivado." : "Prato reativado.");
      loadData();
    }
  };

  const handleDuplicate = async (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    const { error } = await supabase.from("dishes").insert({
      nome: `${dish.nome} (cópia)`,
      descricao: dish.descricao,
      category_id: dish.category_id,
      peso_porcao: dish.peso_porcao,
      is_padrao: false,
      company_id: profile!.company_id,
      created_by: user!.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Prato duplicado.");
      loadData();
    }
  };

  const handleEdit = (id: string) => {
    const dish = dishes.find((d) => d.id === id);
    if (!dish) return;
    setForm({
      nome: dish.nome,
      descricao: dish.descricao || "",
      category_id: dish.category_id || "",
      peso_porcao: dish.peso_porcao ? String(dish.peso_porcao) : "",
    });
    setEditDish(dish);
  };

  const handleAddToMenu = (id: string) => {
    sessionStorage.setItem("preselectedDishId", id);
    window.location.href = "/cardapio-semanal";
  };

  // Derive computed dish data
  const enriched: DishCardData[] = useMemo(() => {
    return dishes.map((d) => {
      const dishIngredients = ingredients.filter((i) => i.dish_id === d.id);
      const ingredientes_count = dishIngredients.length;

      let custo_estimado: number | null = null;
      if (ingredientes_count > 0) {
        let total = 0;
        let allHaveCost = true;
        for (const ing of dishIngredients) {
          const cost = productCosts.get(ing.product_id);
          if (cost === undefined) {
            allHaveCost = false;
            break;
          }
          // peso_limpo_per_capita em kg/g convertido + fator_correcao
          const consumo = Number(ing.peso_limpo_per_capita) * Number(ing.fator_correcao || 1);
          total += consumo * cost;
        }
        if (allHaveCost) custo_estimado = total;
      }

      let ficha_status: FichaStatus = "pendente";
      if (ingredientes_count === 0) ficha_status = "pendente";
      else if (!d.peso_porcao || ingredientes_count < 2) ficha_status = "incompleta";
      else ficha_status = "completa";

      const category_name = d.category_id
        ? categories.find((c) => c.id === d.category_id)?.nome || null
        : null;

      return {
        id: d.id,
        nome: d.nome,
        descricao: d.descricao,
        category_name,
        peso_porcao: d.peso_porcao,
        ingredientes_count,
        custo_estimado,
        ultimo_uso: usage.get(d.id) || null,
        ficha_status,
        is_padrao: d.is_padrao,
        ativo: d.ativo,
      };
    });
  }, [dishes, ingredients, productCosts, usage, categories]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    return enriched.filter((d) => {
      if (!d.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== "all") {
        const dish = dishes.find((x) => x.id === d.id);
        if (dish?.category_id !== filterCategory) return false;
      }
      if (filterFicha !== "all" && d.ficha_status !== filterFicha) return false;
      if (filterUsage !== "all") {
        const last = d.ultimo_uso ? new Date(d.ultimo_uso).getTime() : 0;
        const diff = last ? now - last : Infinity;
        if (filterUsage === "recent" && diff > sevenDaysMs) return false;
        if (filterUsage === "month" && diff > thirtyDaysMs) return false;
        if (filterUsage === "never" && d.ultimo_uso) return false;
      }
      return true;
    });
  }, [enriched, dishes, search, filterCategory, filterFicha, filterUsage]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const completa = enriched.filter((d) => d.ficha_status === "completa").length;
    const pendente = enriched.filter((d) => d.ficha_status !== "completa").length;
    return { total, completa, pendente };
  }, [enriched]);

  const hasFilters =
    search.length > 0 ||
    filterCategory !== "all" ||
    filterFicha !== "all" ||
    filterUsage !== "all";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-background/40 backdrop-blur-sm p-5 sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,hsl(var(--primary)/0.08),transparent_50%)] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground leading-tight">
                Biblioteca de Pratos
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Sua base técnica para montar cardápios com agilidade
              </p>
            </div>
          </div>
          {!isFinanceiro && (
            <Dialog
              open={addOpen}
              onOpenChange={(o) => {
                setAddOpen(o);
                if (!o) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20">
                  <Plus className="h-4 w-4" />
                  Novo Prato
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-display">Novo Prato</DialogTitle>
                </DialogHeader>
                <DishForm
                  form={form}
                  setForm={setForm}
                  categories={categories}
                  onSave={saveDish}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Stats chips */}
        {stats.total > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            <StatChip label="Total" value={stats.total} />
            <StatChip label="Ficha completa" value={stats.completa} tone="success" />
            <StatChip label="Pendentes" value={stats.pendente} tone="warning" />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar prato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border h-10"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="bg-input border-border h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterFicha} onValueChange={setFilterFicha}>
            <SelectTrigger className="bg-input border-border h-9 text-xs">
              <SelectValue placeholder="Ficha técnica" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fichas</SelectItem>
              <SelectItem value="completa">Completa</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="incompleta">Incompleta</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterUsage} onValueChange={setFilterUsage}>
            <SelectTrigger className="bg-input border-border h-9 text-xs">
              <SelectValue placeholder="Uso recente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer uso</SelectItem>
              <SelectItem value="recent">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Últimos 30 dias</SelectItem>
              <SelectItem value="never">Nunca utilizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={!!editDish}
        onOpenChange={(o) => {
          if (!o) {
            setEditDish(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Prato</DialogTitle>
          </DialogHeader>
          <DishForm form={form} setForm={setForm} categories={categories} onSave={saveDish} />
        </DialogContent>
      </Dialog>

      {/* Cards grid or empty */}
      {filtered.length === 0 ? (
        <PratosEmptyState
          onCreate={() => setAddOpen(true)}
          hasFilters={hasFilters}
          canCreate={!isFinanceiro}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              onAddToMenu={handleAddToMenu}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onArchive={handleArchive}
              isFinanceiro={isFinanceiro}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function StatChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  const toneCls =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-border/60 bg-background/40 text-foreground";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${toneCls}`}
    >
      <span className="font-semibold">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

function DishForm({
  form,
  setForm,
  categories,
  onSave,
}: {
  form: { nome: string; descricao: string; category_id: string; peso_porcao: string };
  setForm: (f: typeof form) => void;
  categories: DishCategory[];
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Nome *</Label>
        <Input
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="bg-input border-border"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Categoria</Label>
          <Select
            value={form.category_id}
            onValueChange={(v) => setForm({ ...form, category_id: v })}
          >
            <SelectTrigger className="bg-input border-border">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Porção (g)</Label>
          <Input
            type="number"
            value={form.peso_porcao}
            onChange={(e) => setForm({ ...form, peso_porcao: e.target.value })}
            className="bg-input border-border"
            placeholder="Ex: 350"
          />
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          className="bg-input border-border"
        />
      </div>
      <Button onClick={onSave} className="w-full">
        Salvar
      </Button>
    </div>
  );
}
