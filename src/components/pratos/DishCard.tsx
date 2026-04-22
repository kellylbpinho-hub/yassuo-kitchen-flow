import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarPlus,
  Pencil,
  Copy,
  Archive,
  MoreVertical,
  ChefHat,
  Sandwich,
  Salad,
  Soup,
  CakeSlice,
  CupSoda,
  Utensils,
  Scale,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dishImageUrl, dishGradient } from "@/lib/dishImage";

export type FichaStatus = "completa" | "pendente" | "incompleta";

export interface DishCardData {
  id: string;
  nome: string;
  descricao: string | null;
  category_name: string | null;
  peso_porcao: number | null;
  ingredientes_count: number;
  custo_estimado: number | null;
  ultimo_uso: string | null;
  ficha_status: FichaStatus;
  is_padrao: boolean;
  ativo: boolean;
}

interface DishCardProps {
  dish: DishCardData;
  onAddToMenu: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  isFinanceiro?: boolean;
}

const categoryIconMap: Record<string, typeof ChefHat> = {
  entrada: Salad,
  salada: Salad,
  principal: Utensils,
  prato: Utensils,
  guarnicao: Sandwich,
  acompanhamento: Sandwich,
  sopa: Soup,
  caldo: Soup,
  sobremesa: CakeSlice,
  bebida: CupSoda,
  suco: CupSoda,
};

function getCategoryIcon(name: string | null) {
  if (!name) return ChefHat;
  const key = name.toLowerCase();
  for (const [match, Icon] of Object.entries(categoryIconMap)) {
    if (key.includes(match)) return Icon;
  }
  return ChefHat;
}

const fichaStatusMap: Record<
  FichaStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  completa: {
    label: "Ficha completa",
    cls: "bg-success/10 text-success border-success/30",
    Icon: CheckCircle2,
  },
  pendente: {
    label: "Pendente",
    cls: "bg-warning/10 text-warning border-warning/30",
    Icon: CircleDashed,
  },
  incompleta: {
    label: "Incompleta",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: AlertTriangle,
  },
};

export function DishCard({
  dish,
  onAddToMenu,
  onEdit,
  onDuplicate,
  onArchive,
  isFinanceiro,
}: DishCardProps) {
  const CategoryIcon = getCategoryIcon(dish.category_name);
  const ficha = fichaStatusMap[dish.ficha_status];
  const FichaIcon = ficha.Icon;

  const ultimoUsoLabel = dish.ultimo_uso
    ? formatDistanceToNow(new Date(dish.ultimo_uso), { locale: ptBR, addSuffix: true })
    : "Nunca utilizado";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-white/5 bg-[#111]",
        "transition-all duration-200 hover:border-amber/40",
        "hover:shadow-[0_0_0_1px_hsl(38_95%_58%/0.18),0_12px_28px_-12px_hsl(38_95%_58%/0.3)]",
        !dish.ativo && "opacity-60",
      )}
    >
      {/* === Hero image (~60% of card) === */}
      <div
        className="relative aspect-[5/3] w-full overflow-hidden"
        style={{ background: dishGradient(dish.id) }}
      >
        <img
          src={dishImageUrl(dish.nome, dish.id, { w: 600, h: 360 })}
          alt={dish.nome}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Strong bottom-up dark overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Top-right actions */}
        {!isFinanceiro && (
          <div className="absolute right-2 top-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 hover:text-white"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onAddToMenu(dish.id)}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Adicionar ao cardápio
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(dish.id)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar ficha
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(dish.id)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar prato
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onArchive(dish.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {dish.ativo ? "Arquivar" : "Reativar"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Top-left "Padrão" badge */}
        {dish.is_padrao && (
          <Badge
            variant="secondary"
            className="absolute left-2 top-2 h-5 px-2 text-[10px] uppercase tracking-wider bg-black/50 text-white backdrop-blur-md border-white/10"
          >
            Padrão
          </Badge>
        )}

        {/* Dish name + category overlay on photo */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-amber text-xs uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
            <CategoryIcon className="h-3 w-3" />
            <span className="truncate">{dish.category_name || "Sem categoria"}</span>
          </p>
          <h3 className="text-xl font-bold leading-tight text-white line-clamp-2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            {dish.nome}
          </h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Description */}
        {dish.descricao && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
            {dish.descricao}
          </p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg border border-border/40 bg-background/40 px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
              <Scale className="h-3 w-3" />
              Porção
            </div>
            <div className="text-sm font-semibold text-foreground">
              {dish.peso_porcao ? `${dish.peso_porcao}g` : "—"}
            </div>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 px-2.5 py-2">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">
              <Tag className="h-3 w-3" />
              {isFinanceiro ? "Itens" : "Custo"}
            </div>
            <div className="text-sm font-semibold text-foreground">
              {isFinanceiro || dish.custo_estimado === null
                ? `${dish.ingredientes_count} ing.`
                : `R$ ${dish.custo_estimado.toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* Footer: ficha status + last use */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge
            variant="outline"
            className={cn("gap-1 text-[10px] font-medium px-2 py-0.5 h-5", ficha.cls)}
          >
            <FichaIcon className="h-2.5 w-2.5" />
            {ficha.label}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <CalendarClock className="h-3 w-3" />
            <span className="truncate">{ultimoUsoLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
