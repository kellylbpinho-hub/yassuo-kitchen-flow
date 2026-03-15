import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Search, Loader2, UtensilsCrossed, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FichaTecnica } from "@/components/FichaTecnica";

interface Dish {
  id: string;
  nome: string;
  category_id: string | null;
}

interface DishCategory {
  id: string;
  nome: string;
}

interface MenuDish {
  id: string;
  dish_id: string;
  ordem: number;
  dish?: Dish;
}

interface MenuData {
  id: string;
  nome: string;
  descricao: string | null;
  data: string;
  unidade_id: string;
  company_id: string;
}

type DayStatus = "cardapio" | "folga" | "feriado" | "sem_producao";

const STATUS_LABELS: Record<DayStatus, string> = {
  cardapio: "Com Cardápio",
  folga: "Folga",
  feriado: "Feriado",
  sem_producao: "Sem Produção",
};

const STATUS_MENU_NAMES: Record<DayStatus, string> = {
  cardapio: "",
  folga: "Folga",
  feriado: "Feriado",
  sem_producao: "Sem Produção",
};

function getStatusFromMenu(menu: MenuData | null): DayStatus {
  if (!menu) return "cardapio";
  if (menu.nome === "Folga") return "folga";
  if (menu.nome === "Feriado") return "feriado";
  if (menu.nome === "Sem Produção") return "sem_producao";
  return "cardapio";
}

interface CardapioDiaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  menu: MenuData | null;
  menuDishes: MenuDish[];
  allDishes: Dish[];
  categories: DishCategory[];
  onRefresh: () => void;
  readOnly?: boolean;
}

export default function CardapioDiaSheet({
  open, onOpenChange, date, menu, menuDishes, allDishes, categories, onRefresh, readOnly = false,
}: CardapioDiaSheetProps) {
  const { profile, user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DayStatus>("cardapio");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingDishId, setAddingDishId] = useState<string | null>(null);
  const [removingDishId, setRemovingDishId] = useState<string | null>(null);

  useEffect(() => {
    setStatus(getStatusFromMenu(menu));
    setObservacao(menu?.descricao || "");
    setSearch("");
  }, [menu, date]);

  const dayLabel = format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Sem categoria";
    return categories.find((c) => c.id === catId)?.nome || "Sem categoria";
  };

  const dishesGrouped = useMemo(() => {
    const groups: Record<string, { category: string; dishes: (MenuDish & { dishData: Dish })[] }> = {};
    for (const md of menuDishes) {
      const dish = allDishes.find((d) => d.id === md.dish_id);
      if (!dish) continue;
      const catName = getCategoryName(dish.category_id);
      if (!groups[catName]) groups[catName] = { category: catName, dishes: [] };
      groups[catName].dishes.push({ ...md, dishData: dish });
    }
    return Object.values(groups);
  }, [menuDishes, allDishes, categories]);

  const addedDishIds = new Set(menuDishes.map((md) => md.dish_id));

  const filteredDishes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allDishes.filter(
      (d) => !addedDishIds.has(d.id) && (!q || d.nome.toLowerCase().includes(q))
    );
  }, [allDishes, addedDishIds, search]);

  const ensureMenu = async (): Promise<string | null> => {
    if (menu) return menu.id;
    if (!profile || !user) return null;
    const dateStr = format(date, "yyyy-MM-dd");
    const nome = STATUS_MENU_NAMES[status] || `Cardápio ${format(date, "dd/MM")}`;
    const { data, error } = await supabase
      .from("menus")
      .insert({
        data: dateStr,
        nome,
        descricao: observacao || null,
        unidade_id: profile.unidade_id!,
        company_id: profile.company_id,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (error) {
      toast.error("Erro ao criar cardápio: " + error.message);
      return null;
    }
    return data.id;
  };

  const handleAddDish = async (dishId: string) => {
    if (readOnly) return;
    setAddingDishId(dishId);
    try {
      const menuId = await ensureMenu();
      if (!menuId) return;
      const { error } = await supabase.from("menu_dishes").insert({
        menu_id: menuId,
        dish_id: dishId,
        company_id: profile!.company_id,
        ordem: menuDishes.length,
      });
      if (error) {
        toast.error("Erro ao adicionar prato: " + error.message);
        return;
      }
      onRefresh();
    } finally {
      setAddingDishId(null);
    }
  };

  const handleRemoveDish = async (menuDishId: string) => {
    if (readOnly) return;
    setRemovingDishId(menuDishId);
    try {
      const { error } = await supabase.from("menu_dishes").delete().eq("id", menuDishId);
      if (error) {
        toast.error("Erro ao remover prato: " + error.message);
        return;
      }
      onRefresh();
    } finally {
      setRemovingDishId(null);
    }
  };

  const handleSaveStatus = async () => {
    if (readOnly) return;
    setSaving(true);
    try {
      if (status !== "cardapio") {
        // Special status day
        const nome = STATUS_MENU_NAMES[status];
        if (menu) {
          await supabase.from("menus").update({ nome, descricao: observacao || null }).eq("id", menu.id);
        } else {
          await ensureMenu();
        }
      } else if (menu) {
        const nome = `Cardápio ${format(date, "dd/MM")}`;
        await supabase.from("menus").update({ nome, descricao: observacao || null }).eq("id", menu.id);
      }
      toast.success("Salvo com sucesso!");
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const isSpecialDay = status !== "cardapio";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="capitalize">{dayLabel}</SheetTitle>
          <SheetDescription>Gerencie o cardápio deste dia</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Status + Observation */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Status do dia</label>
              <Select value={status} onValueChange={(v) => setStatus(v as DayStatus)} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Observação</label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Evento especial, cardápio reduzido..."
                rows={2}
                disabled={readOnly}
              />
            </div>
            <Button size="sm" onClick={handleSaveStatus} disabled={saving || readOnly}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar status"}
            </Button>
          </div>

          <Separator />

          {isSpecialDay ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Dia marcado como <span className="font-medium ml-1">{STATUS_LABELS[status]}</span>
            </div>
          ) : (
            <>
              {/* Current dishes */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Pratos do dia ({menuDishes.length})
                </h3>
                <ScrollArea className="flex-1">
                  {dishesGrouped.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-6">
                      <UtensilsCrossed className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      Nenhum prato adicionado
                    </div>
                  ) : (
                    <div className="space-y-3 pr-3">
                      {dishesGrouped.map((group) => (
                        <div key={group.category}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                            {group.category}
                          </p>
                          {group.dishes.map((md) => (
                            <div key={md.id} className="flex items-center justify-between py-1.5">
                              <span className="text-sm text-foreground">{md.dishData.nome}</span>
                              {!readOnly && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveDish(md.id)}
                                  disabled={removingDishId === md.id}
                                >
                                  {removingDishId === md.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Add dishes */}
              {!readOnly && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Adicionar prato</h3>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar prato..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="max-h-48">
                      <div className="space-y-0.5 pr-3">
                        {filteredDishes.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            {search ? "Nenhum prato encontrado" : "Todos os pratos já foram adicionados"}
                          </p>
                        ) : (
                          filteredDishes.slice(0, 20).map((dish) => (
                            <div key={dish.id} className="flex items-center justify-between py-1.5">
                              <div>
                                <span className="text-sm text-foreground">{dish.nome}</span>
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  {getCategoryName(dish.category_id)}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-primary"
                                onClick={() => handleAddDish(dish.id)}
                                disabled={addingDishId === dish.id}
                              >
                                {addingDishId === dish.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plus className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
