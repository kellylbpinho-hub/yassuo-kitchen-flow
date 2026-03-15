import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, CalendarDays, UtensilsCrossed, Coffee, Palmtree, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import CardapioDiaSheet from "@/components/CardapioDiaSheet";
import { generateMenuWeekPDF, generateMenuTecnicoPDF } from "@/lib/pdfExport";

interface MenuData {
  id: string;
  nome: string;
  descricao: string | null;
  data: string;
  unidade_id: string;
  company_id: string;
}

interface MenuDishRow {
  id: string;
  menu_id: string;
  dish_id: string;
  ordem: number;
}

interface Dish {
  id: string;
  nome: string;
  category_id: string | null;
}

interface DishCategory {
  id: string;
  nome: string;
}

type DayStatus = "sem_cardapio" | "com_cardapio" | "folga" | "feriado" | "sem_producao";

const STATUS_CONFIG: Record<DayStatus, { label: string; color: string }> = {
  sem_cardapio: { label: "Sem cardápio", color: "bg-muted text-muted-foreground" },
  com_cardapio: { label: "Com cardápio", color: "bg-primary/10 text-primary" },
  folga: { label: "Folga", color: "bg-secondary text-secondary-foreground" },
  feriado: { label: "Feriado", color: "bg-accent text-accent-foreground" },
  sem_producao: { label: "Sem produção", color: "bg-muted text-muted-foreground" },
};

function getDayStatus(menu: MenuData | null, dishCount: number): DayStatus {
  if (!menu) return "sem_cardapio";
  if (menu.nome === "Folga") return "folga";
  if (menu.nome === "Feriado") return "feriado";
  if (menu.nome === "Sem Produção") return "sem_producao";
  return dishCount > 0 ? "com_cardapio" : "sem_cardapio";
}

export default function CardapioSemanal() {
  const { profile, isFinanceiro } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [menus, setMenus] = useState<MenuData[]>([]);
  const [menuDishes, setMenuDishes] = useState<MenuDishRow[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${format(weekStart, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`;
  }, [weekStart]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      // Parallel queries
      const [menusRes, dishesRes, catsRes] = await Promise.all([
        supabase.from("menus").select("id, nome, descricao, data, unidade_id, company_id")
          .gte("data", startStr).lte("data", endStr),
        supabase.from("dishes").select("id, nome, category_id").eq("ativo", true),
        supabase.from("dish_categories").select("id, nome").order("ordem"),
      ]);

      const menusList = (menusRes.data || []) as MenuData[];
      setMenus(menusList);
      setAllDishes((dishesRes.data || []) as Dish[]);
      setCategories((catsRes.data || []) as DishCategory[]);

      // Load menu_dishes for found menus
      if (menusList.length > 0) {
        const menuIds = menusList.map((m) => m.id);
        const { data: mdData } = await supabase
          .from("menu_dishes")
          .select("id, menu_id, dish_id, ordem")
          .in("menu_id", menuIds)
          .order("ordem");
        setMenuDishes((mdData || []) as MenuDishRow[]);
      } else {
        setMenuDishes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [profile, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getMenuForDate = (date: Date): MenuData | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return menus.find((m) => m.data === dateStr) || null;
  };

  const getDishesForMenu = (menuId: string | undefined) => {
    if (!menuId) return [];
    return menuDishes.filter((md) => md.menu_id === menuId);
  };

  const selectedMenu = selectedDate ? getMenuForDate(selectedDate) : null;
  const selectedMenuDishes = selectedMenu ? getDishesForMenu(selectedMenu.id) : [];

  const readOnly = isFinanceiro;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-display font-bold text-foreground">Cardápio Semanal</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[160px] text-center">
            {weekLabel}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const days = weekDates.map((date) => {
                const menu = getMenuForDate(date);
                const dishes = getDishesForMenu(menu?.id);
                const status = getDayStatus(menu, dishes.length);
                const cfg = STATUS_CONFIG[status];
                const dishesWithNames = dishes.map((md) => {
                  const dish = allDishes.find((d) => d.id === md.dish_id);
                  const cat = dish?.category_id ? categories.find((c) => c.id === dish.category_id)?.nome || "Geral" : "Geral";
                  return { nome: dish?.nome || "", category: cat };
                });
                return {
                  dayLabel: format(date, "EEEE", { locale: ptBR }),
                  dateLabel: format(date, "dd/MM"),
                  status: cfg.label,
                  dishes: dishesWithNames,
                };
              });
              generateMenuWeekPDF({ weekLabel: weekLabel, days });
            }}
          >
            <FileText className="h-4 w-4" />
            PDF Simples
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={async () => {
              // Get unit info for num colaboradores
              const unitIds = [...new Set(menus.map(m => m.unidade_id))];
              let unitName = "—";
              let numColab = 0;
              if (unitIds.length > 0) {
                const { data: unitData } = await supabase.from("units").select("name, numero_colaboradores").eq("id", unitIds[0]).single();
                if (unitData) { unitName = unitData.name; numColab = unitData.numero_colaboradores || 0; }
              }
              const days = weekDates.map((date) => {
                const menu = getMenuForDate(date);
                const dishes = getDishesForMenu(menu?.id);
                const status = getDayStatus(menu, dishes.length);
                const cfg = STATUS_CONFIG[status];
                const dishesWithNames = dishes.map((md) => {
                  const dish = allDishes.find((d) => d.id === md.dish_id);
                  const cat = dish?.category_id ? categories.find((c) => c.id === dish.category_id)?.nome || "Geral" : "Geral";
                  return { nome: dish?.nome || "", category: cat, descricao: dish ? undefined : undefined };
                });
                return {
                  dayLabel: format(date, "EEEE", { locale: ptBR }),
                  dateLabel: format(date, "dd/MM"),
                  status: cfg.label,
                  dishes: dishesWithNames,
                };
              });
              generateMenuTecnicoPDF({ weekLabel, unitName, numColaboradores: numColab, days });
            }}
          >
            <FileText className="h-4 w-4" />
            PDF Técnico
          </Button>
        </div>
      </div>

      {/* Week grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {weekDates.map((date) => {
            const menu = getMenuForDate(date);
            const dishes = getDishesForMenu(menu?.id);
            const status = getDayStatus(menu, dishes.length);
            const cfg = STATUS_CONFIG[status];
            const isToday = isSameDay(date, new Date());
            const dayName = format(date, "EEEE", { locale: ptBR });
            const dateLabel = format(date, "dd/MM");

            return (
              <Card
                key={date.toISOString()}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isToday ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedDate(date)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold capitalize text-foreground">{dayName}</p>
                      <p className="text-xs text-muted-foreground">{dateLabel}</p>
                    </div>
                    <StatusIcon status={status} />
                  </div>
                  <Badge className={`${cfg.color} text-[10px] font-medium`}>
                    {cfg.label}
                  </Badge>
                  {status === "com_cardapio" && (
                    <p className="text-xs text-muted-foreground">
                      {dishes.length} {dishes.length === 1 ? "prato" : "pratos"}
                    </p>
                  )}
                  {menu?.descricao && (
                    <p className="text-xs text-muted-foreground truncate italic">
                      {menu.descricao}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Day sheet */}
      {selectedDate && (
        <CardapioDiaSheet
          open={!!selectedDate}
          onOpenChange={(open) => !open && setSelectedDate(null)}
          date={selectedDate}
          menu={selectedMenu}
          menuDishes={selectedMenuDishes}
          allDishes={allDishes}
          categories={categories}
          onRefresh={loadData}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: DayStatus }) {
  const cls = "h-5 w-5 text-muted-foreground";
  switch (status) {
    case "com_cardapio":
      return <UtensilsCrossed className={`${cls} text-primary`} />;
    case "folga":
      return <Coffee className={cls} />;
    case "feriado":
      return <Palmtree className={cls} />;
    default:
      return <CalendarDays className={cls} />;
  }
}
