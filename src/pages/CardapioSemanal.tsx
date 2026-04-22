import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import CardapioDiaSheet from "@/components/CardapioDiaSheet";
import { generateMenuWeekPDF, generateMenuTecnicoPDF } from "@/lib/pdfExport";
import { ContextualLoader } from "@/components/ContextualLoader";
import { WeekDayRow, type DayStatus } from "@/components/cardapio/WeekDayRow";
import { cn } from "@/lib/utils";

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

const STATUS_LABEL_FOR_PDF: Record<DayStatus, string> = {
  sem_cardapio: "Sem cardápio",
  em_montagem: "Em montagem",
  completo: "Cardápio definido",
  folga: "Folga",
  feriado: "Feriado",
  sem_producao: "Sem produção",
};

function deriveStatus(menu: MenuData | null, dishCount: number): DayStatus {
  if (!menu) return "sem_cardapio";
  if (menu.nome === "Folga") return "folga";
  if (menu.nome === "Feriado") return "feriado";
  if (menu.nome === "Sem Produção") return "sem_producao";
  if (dishCount === 0) return "em_montagem";
  return "completo";
}

export default function CardapioSemanal() {
  const { profile, isFinanceiro } = useAuth();
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [menus, setMenus] = useState<MenuData[]>([]);
  const [menuDishes, setMenuDishes] = useState<MenuDishRow[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
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

      const [menusRes, dishesRes, catsRes] = await Promise.all([
        supabase
          .from("menus")
          .select("id, nome, descricao, data, unidade_id, company_id")
          .gte("data", startStr)
          .lte("data", endStr),
        supabase.from("dishes").select("id, nome, category_id").eq("ativo", true),
        supabase.from("dish_categories").select("id, nome").order("ordem"),
      ]);

      const menusList = (menusRes.data || []) as MenuData[];
      setMenus(menusList);
      setAllDishes((dishesRes.data || []) as Dish[]);
      setCategories((catsRes.data || []) as DishCategory[]);

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

  // Derived KPIs
  const summary = useMemo(() => {
    let completos = 0;
    let emMontagem = 0;
    let sem = 0;
    let especiais = 0;
    weekDates.forEach((d) => {
      const m = getMenuForDate(d);
      const c = getDishesForMenu(m?.id).length;
      const s = deriveStatus(m, c);
      if (s === "completo") completos++;
      else if (s === "em_montagem") emMontagem++;
      else if (s === "sem_cardapio") sem++;
      else especiais++;
    });
    return { completos, emMontagem, sem, especiais };
  }, [weekDates, menus, menuDishes]);

  const selectedMenu = selectedDate ? getMenuForDate(selectedDate) : null;
  const selectedMenuDishes = selectedMenu ? getDishesForMenu(selectedMenu.id) : [];
  const readOnly = isFinanceiro;

  const buildPdfDays = () =>
    weekDates.map((date) => {
      const menu = getMenuForDate(date);
      const dishes = getDishesForMenu(menu?.id);
      const status = deriveStatus(menu, dishes.length);
      const dishesWithNames = dishes.map((md) => {
        const dish = allDishes.find((d) => d.id === md.dish_id);
        const cat = dish?.category_id
          ? categories.find((c) => c.id === dish.category_id)?.nome || "Geral"
          : "Geral";
        return { nome: dish?.nome || "", category: cat };
      });
      return {
        dayLabel: format(date, "EEEE", { locale: ptBR }),
        dateLabel: format(date, "dd/MM"),
        status: STATUS_LABEL_FOR_PDF[status],
        dishes: dishesWithNames,
      };
    });

  const handleExportSimple = () => {
    generateMenuWeekPDF({ weekLabel, days: buildPdfDays() });
  };

  const handleExportTechnical = async () => {
    const unitIds = [...new Set(menus.map((m) => m.unidade_id))];
    let unitName = "—";
    let numColab = 0;
    if (unitIds.length > 0) {
      const { data: unitData } = await supabase
        .from("units")
        .select("name, numero_colaboradores")
        .eq("id", unitIds[0])
        .single();
      if (unitData) {
        unitName = unitData.name;
        numColab = unitData.numero_colaboradores || 0;
      }
    }
    generateMenuTecnicoPDF({
      weekLabel,
      unitName,
      numColaboradores: numColab,
      days: buildPdfDays(),
    });
  };

  const totalProgress = Math.round(
    ((summary.completos + summary.especiais) / 7) * 100,
  );

  const allEmpty = summary.completos === 0 && summary.emMontagem === 0 && summary.especiais === 0;

  return (
    <div className="space-y-6 animate-fade-in nutri-page -mx-3 -my-3 px-3 py-3 lg:-mx-5 lg:-my-5 lg:px-5 lg:py-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber/20 bg-gradient-to-br from-surface-2 via-surface-1 to-surface-2 p-5 sm:p-7">
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/3 translate-x-1/4 rounded-full bg-amber/[0.10] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber/50 to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber">
              <CalendarDays className="h-3.5 w-3.5" />
              Planejamento da semana
            </div>
            <h1 className="font-display text-3xl font-black tracking-tight leading-tight text-foreground sm:text-4xl">
              Cardápio Semanal
            </h1>
            <p className="text-sm text-muted-foreground">
              Construa, valide e publique o cardápio dia a dia.{" "}
              <span className="text-foreground/80">{weekLabel}</span>
            </p>
          </div>

          {/* Week nav */}
          <div data-guide="week-nav" className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              className="h-9 w-9 border-border/60 bg-surface-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="h-9 px-3 text-xs font-medium"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              className="h-9 w-9 border-border/60 bg-surface-1"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryChip
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            label="Definidos"
            value={summary.completos}
            tone="primary"
          />
          <SummaryChip
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="Em montagem"
            value={summary.emMontagem}
            tone="warning"
          />
          <SummaryChip
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            label="Sem cardápio"
            value={summary.sem}
            tone="muted"
          />
          <SummaryChip
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Conclusão"
            value={`${totalProgress}%`}
            tone="accent"
          />
        </div>

        {/* Export actions */}
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
            onClick={handleExportSimple}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF simples
          </Button>
          <Button
            data-guide="btn-pdf-tecnico"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
            onClick={handleExportTechnical}
          >
            <FileText className="h-3.5 w-3.5" />
            PDF técnico
          </Button>
        </div>
      </div>

      {/* Week list */}
      {loading ? (
        <ContextualLoader message="Carregando cardápio semanal..." />
      ) : (
        <>
          {allEmpty && (
            <EmptyWeekHint
              onPickFirstDay={() => {
                const today = new Date();
                const isInWeek = weekDates.some((d) =>
                  format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
                );
                setSelectedDate(isInWeek ? today : weekDates[0]);
              }}
              readOnly={readOnly}
            />
          )}

          <div data-guide="week-grid" className="space-y-2.5">
            {weekDates.map((date) => {
              const menu = getMenuForDate(date);
              const dishes = getDishesForMenu(menu?.id);
              const status = deriveStatus(menu, dishes.length);
              return (
                <WeekDayRow
                  key={date.toISOString()}
                  date={date}
                  status={status}
                  menuName={menu?.nome}
                  observation={menu?.descricao}
                  dishes={dishes}
                  allDishes={allDishes}
                  categories={categories}
                  onOpen={() => setSelectedDate(date)}
                  readOnly={readOnly}
                />
              );
            })}
          </div>
        </>
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

/* ---------- Summary chip ---------- */

function SummaryChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "primary" | "warning" | "muted" | "accent";
}) {
  const toneCls =
    tone === "primary"
      ? "border-amber/30 bg-amber/[0.06] text-amber"
      : tone === "warning"
        ? "border-warning/30 bg-warning/15/[0.06] text-warning"
        : tone === "accent"
          ? "border-amber/20 bg-amber/[0.04] text-foreground"
          : "border-border/60 bg-surface-1/60 text-muted-foreground";

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
        toneCls,
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </div>
  );
}

/* ---------- Empty state ---------- */

function EmptyWeekHint({
  onPickFirstDay,
  readOnly,
}: {
  onPickFirstDay: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Comece a planejar a semana
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Selecione um dia abaixo para montar o primeiro cardápio. A previsão de insumos
              e os pedidos internos serão gerados a partir daqui.
            </p>
          </div>
        </div>
        {!readOnly && (
          <Button onClick={onPickFirstDay} size="sm" className="h-9 gap-1.5 self-start sm:self-auto">
            <Sparkles className="h-3.5 w-3.5" />
            Montar primeiro dia
          </Button>
        )}
      </div>
    </div>
  );
}
