import { useState } from "react";
import { format, isSameDay, isPast, isToday as isTodayFn } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  UtensilsCrossed,
  Coffee,
  Palmtree,
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dishImageUrl, dishGradient } from "@/lib/dishImage";

export type DayStatus =
  | "sem_cardapio"
  | "em_montagem"
  | "completo"
  | "folga"
  | "feriado"
  | "sem_producao";

interface DishLite {
  id: string;
  nome: string;
  category_id: string | null;
}

interface DishCategoryLite {
  id: string;
  nome: string;
}

interface WeekDayRowProps {
  date: Date;
  status: DayStatus;
  menuName?: string | null;
  observation?: string | null;
  dishes: { id: string; dish_id: string }[];
  allDishes: DishLite[];
  categories: DishCategoryLite[];
  onOpen: () => void;
  readOnly?: boolean;
}

const STATUS_META: Record<
  DayStatus,
  { label: string; tone: string; ring: string; dot: string; icon: React.ElementType }
> = {
  sem_cardapio: {
    label: "Sem cardápio",
    tone: "text-muted-foreground bg-muted/40 border-border/60",
    ring: "border-border/60",
    dot: "bg-muted-foreground/50",
    icon: CalendarPlus,
  },
  em_montagem: {
    label: "Em montagem",
    tone: "text-warning bg-warning/10 border-warning/30",
    ring: "border-warning/30",
    dot: "bg-warning/10",
    icon: Pencil,
  },
  completo: {
    label: "Cardápio definido",
    tone: "text-amber bg-amber/10 border-amber/30",
    ring: "border-amber/30",
    dot: "bg-amber",
    icon: CheckCircle2,
  },
  folga: {
    label: "Folga",
    tone: "text-muted-foreground bg-muted/40 border-border/60",
    ring: "border-border/60",
    dot: "bg-muted-foreground/40",
    icon: Coffee,
  },
  feriado: {
    label: "Feriado",
    tone: "text-muted-foreground bg-muted/40 border-border/60",
    ring: "border-border/60",
    dot: "bg-muted-foreground/40",
    icon: Palmtree,
  },
  sem_producao: {
    label: "Sem produção",
    tone: "text-muted-foreground bg-muted/40 border-border/60",
    ring: "border-border/60",
    dot: "bg-muted-foreground/40",
    icon: AlertCircle,
  },
};

export function WeekDayRow({
  date,
  status,
  menuName,
  observation,
  dishes,
  allDishes,
  categories,
  onOpen,
  readOnly,
}: WeekDayRowProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const today = isTodayFn(date);
  const past = isPast(date) && !today;

  const dayLong = format(date, "EEEE", { locale: ptBR });
  const dayShort = format(date, "EEE", { locale: ptBR }).replace(".", "");
  const dateLabel = format(date, "dd 'de' MMMM", { locale: ptBR });
  const numLabel = format(date, "dd");

  // Group dishes by category for preview
  const grouped = dishes.reduce<Record<string, string[]>>((acc, md) => {
    const dish = allDishes.find((d) => d.id === md.dish_id);
    if (!dish) return acc;
    const catName = dish.category_id
      ? categories.find((c) => c.id === dish.category_id)?.nome || "Geral"
      : "Geral";
    if (!acc[catName]) acc[catName] = [];
    acc[catName].push(dish.nome);
    return acc;
  }, {});

  const categoryEntries = Object.entries(grouped);
  const dishCount = dishes.length;
  const hasDishes = dishCount > 0;
  const isSpecialDay = ["folga", "feriado", "sem_producao"].includes(status);

  // Featured dish (first one) for hero image when menu has dishes
  const featuredDish = hasDishes
    ? allDishes.find((d) => d.id === dishes[0]?.dish_id)
    : null;
  const featuredImage = featuredDish
    ? dishImageUrl(featuredDish.nome, featuredDish.id, { w: 800, h: 200 })
    : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-surface-2/60 backdrop-blur-sm transition-all duration-300",
        "hover:bg-surface-2 hover:border-border",
        meta.ring,
        today && "border-amber/50 bg-amber/[0.04] shadow-[0_0_0_1px_hsl(38_95%_58%/0.2)]",
      )}
    >
      {/* Active accent bar (today) */}
      {today && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-amber shadow-[0_0_12px_hsl(38_95%_58%/0.6)]" />
      )}

      {/* Featured dish photo strip (when menu has dishes) */}
      {hasDishes && featuredImage && featuredDish && (
        <div
          className="relative h-24 w-full overflow-hidden border-b border-border/40 sm:h-28"
          style={{ background: dishGradient(featuredDish.id) }}
        >
          <img
            src={featuredImage}
            alt={featuredDish.nome}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Bottom-up dark overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-2 via-surface-2/70 to-surface-2/20" />
          {/* Featured name overlay */}
          <div className="absolute bottom-2 left-4 right-4 sm:bottom-3 sm:left-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber/90">
              Prato em destaque
            </p>
            <p className="mt-0.5 truncate text-base font-bold text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] sm:text-lg">
              {featuredDish.nome}
            </p>
          </div>
        </div>
      )}

      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
        {/* Date block */}
        <button
          type="button"
          onClick={() => (hasDishes || isSpecialDay ? setExpanded((v) => !v) : onOpen())}
          className="flex shrink-0 items-center gap-3 sm:gap-4"
        >
          <div
            className={cn(
              "flex h-12 w-12 flex-col items-center justify-center rounded-lg border text-center transition-colors sm:h-14 sm:w-14",
              today
                ? "border-amber/50 bg-amber/10 text-amber"
                : past
                  ? "border-border/40 bg-surface-1/60 text-muted-foreground"
                  : "border-border/60 bg-surface-1 text-foreground",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
              {dayShort}
            </span>
            <span className="text-base font-bold leading-none sm:text-lg">{numLabel}</span>
          </div>
          <div className="text-left">
            <p
              className={cn(
                "text-sm font-semibold capitalize sm:text-base",
                today ? "text-amber" : "text-foreground",
              )}
            >
              {dayLong}
            </p>
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          </div>
        </button>

        {/* Status + count (desktop) */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Badge
            variant="outline"
            className={cn(
              "hidden gap-1.5 border px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              meta.tone,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
          {hasDishes && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {dishCount} {dishCount === 1 ? "prato" : "pratos"}
            </span>
          )}

          {/* Mobile compact status dot */}
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full sm:hidden",
              meta.dot,
            )}
          />

          {/* Action */}
          <Button
            size="sm"
            variant={hasDishes ? "outline" : "default"}
            onClick={onOpen}
            disabled={readOnly}
            className={cn(
              "h-8 gap-1.5 px-3 text-xs font-medium",
              !hasDishes &&
                !isSpecialDay &&
                "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {hasDishes ? (
              <>
                <Pencil className="h-3 w-3" />
                <span className="hidden sm:inline">Editar</span>
              </>
            ) : isSpecialDay ? (
              <>
                <Pencil className="h-3 w-3" />
                <span className="hidden sm:inline">Editar</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Montar
              </>
            )}
          </Button>

          {(hasDishes || isSpecialDay || observation) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-surface-3 hover:text-foreground",
                expanded && "bg-surface-3 text-foreground",
              )}
              aria-label={expanded ? "Recolher" : "Expandir"}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
              />
            </button>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border/40 bg-surface-1/40 px-4 py-4 sm:px-5 animate-fade-in">
          {/* Mobile status pill */}
          <Badge
            variant="outline"
            className={cn(
              "mb-3 inline-flex gap-1.5 border px-2.5 py-1 text-[11px] font-medium sm:hidden",
              meta.tone,
            )}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>

          {observation && (
            <p className="mb-3 rounded-md border border-border/40 bg-surface-2/40 px-3 py-2 text-xs italic text-muted-foreground">
              {observation}
            </p>
          )}

          {isSpecialDay ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-4 w-4" />
              Dia marcado como{" "}
              <span className="font-medium text-foreground">{meta.label.toLowerCase()}</span>.
            </div>
          ) : hasDishes ? (
            <div className="space-y-3">
              {categoryEntries.map(([cat, names]) => (
                <div key={cat}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {names.map((n, i) => (
                      <span
                        key={`${cat}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-surface-2 px-2.5 py-1 text-xs text-foreground/90"
                      >
                        <UtensilsCrossed className="h-3 w-3 text-primary/70" />
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Nenhum prato adicionado ainda.</div>
          )}
        </div>
      )}
    </div>
  );
}
