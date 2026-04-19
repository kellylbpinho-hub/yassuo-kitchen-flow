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
        "group relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm",
        "transition-all duration-200 hover:border-primary/40 hover:bg-card/80",
        "hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_8px_24px_-12px_hsl(var(--primary)/0.25)]",
        !dish.ativo && "opacity-60",
      )}
    >
      {/* Red accent edge */}
      <div className="absolute left-0 top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary/0 via-primary/60 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-4 space-y-3">
        {/* Header: name + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[15px] font-semibold leading-tight text-foreground truncate">
                {dish.nome}
              </h3>
              {dish.is_padrao && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                  Padrão
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CategoryIcon className="h-3.5 w-3.5 text-primary/70" />
              <span className="truncate">{dish.category_name || "Sem categoria"}</span>
            </div>
          </div>

          {!isFinanceiro && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
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
          )}
        </div>

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
