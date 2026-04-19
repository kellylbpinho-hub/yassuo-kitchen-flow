import { AlertTriangle, Clock, Eye, MoreVertical, Pencil, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface EstoqueItemLote {
  id: string;
  codigo: string | null;
  quantidade: number;
  validade: string; // ISO date
}

export interface EstoqueItemData {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string;
  unidade_medida: string;
  unidade_nome: string;
  estoque_minimo: number;
  custo_unitario: number;
  saldo: number; // saldo total ou da unidade filtrada
  lotes: EstoqueItemLote[]; // já ordenados FEFO (asc por validade)
}

interface EstoqueItemRowProps {
  item: EstoqueItemData;
  canSeeCosts: boolean;
  canManage: boolean;
  onDetail: () => void;
  onEdit: () => void;
  onMovement: () => void;
  isFirst?: boolean;
}

type Status = "zero" | "critico" | "atencao" | "saudavel";

function getStatus(saldo: number, minimo: number): Status {
  if (saldo <= 0) return "zero";
  if (saldo < minimo) return "critico";
  if (minimo > 0 && saldo < minimo * 1.25) return "atencao";
  return "saudavel";
}

const stripeCls: Record<Status, string> = {
  zero: "bg-destructive",
  critico: "bg-destructive",
  atencao: "bg-warning/15",
  saudavel: "bg-success/70",
};

const statusBadge: Record<
  Status,
  { label: string; cls: string }
> = {
  zero: {
    label: "Zerado",
    cls: "border-destructive/40 bg-destructive/15 text-destructive",
  },
  critico: {
    label: "Abaixo do mínimo",
    cls: "border-destructive/35 bg-destructive/10 text-destructive",
  },
  atencao: {
    label: "Atenção",
    cls: "border-warning/30 bg-warning/10 text-warning",
  },
  saudavel: {
    label: "Saudável",
    cls: "border-success/30 bg-success/10 text-success",
  },
};

function getDaysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateISO + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fefoBadge(dias: number) {
  if (dias < 0)
    return { cls: "border-destructive/40 bg-destructive/15 text-destructive", label: "Vencido" };
  if (dias <= 7)
    return { cls: "border-destructive/35 bg-destructive/10 text-destructive", label: `${dias}d` };
  if (dias <= 15)
    return { cls: "border-warning/30 bg-warning/10 text-warning", label: `${dias}d` };
  return { cls: "border-success/30 bg-success/10 text-success", label: `${dias}d` };
}

export function EstoqueItemRow({
  item,
  canSeeCosts,
  canManage,
  onDetail,
  onEdit,
  onMovement,
  isFirst,
}: EstoqueItemRowProps) {
  const status = getStatus(item.saldo, item.estoque_minimo);
  const sBadge = statusBadge[status];

  // FEFO — lote prioritário (primeiro com qty > 0)
  const fefoLote = item.lotes.find((l) => l.quantidade > 0);
  const fefoDias = fefoLote ? getDaysUntil(fefoLote.validade) : null;
  const fefo = fefoDias !== null ? fefoBadge(fefoDias) : null;
  const totalLotes = item.lotes.filter((l) => l.quantidade > 0).length;

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-1 transition-colors hover:border-border hover:bg-surface-2/30"
      data-guide={isFirst ? "product-row" : undefined}
    >
      {/* Accent stripe */}
      <div className={cn("absolute left-0 top-0 h-full w-[3px]", stripeCls[status])} />

      <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 pl-5">
        {/* Nome + categoria */}
        <div className="col-span-12 sm:col-span-4 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                sBadge.cls,
              )}
            >
              {sBadge.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {item.marca ? `${item.marca} · ` : ""}
            {item.categoria} · {item.unidade_nome}
          </p>
        </div>

        {/* Saldo */}
        <div className="col-span-4 sm:col-span-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo</p>
          <p
            className={cn(
              "text-sm font-bold tabular-nums",
              status === "critico" || status === "zero"
                ? "text-destructive"
                : status === "atencao"
                  ? "text-warning"
                  : "text-foreground",
            )}
          >
            {item.saldo.toFixed(item.saldo % 1 === 0 ? 0 : 2)}{" "}
            <span className="text-[11px] font-medium text-muted-foreground">
              {item.unidade_medida}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground">mín. {item.estoque_minimo}</p>
        </div>

        {/* FEFO */}
        <div className="col-span-8 sm:col-span-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Layers className="h-2.5 w-2.5" /> FEFO
          </p>
          {fefoLote && fefo ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                  fefo.cls,
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {fefo.label}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {fefoLote.codigo ? `Lote ${fefoLote.codigo}` : "Lote sem código"}
                {totalLotes > 1 && (
                  <span className="ml-1 text-muted-foreground/70">+{totalLotes - 1}</span>
                )}
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-0.5">Sem lote ativo</p>
          )}
        </div>

        {/* Custo */}
        {canSeeCosts && (
          <div className="col-span-6 sm:col-span-2 text-right sm:text-left">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo un.</p>
            <p className="text-sm font-medium tabular-nums text-foreground">
              R$ {Number(item.custo_unitario || 0).toFixed(2)}
            </p>
          </div>
        )}

        {/* Ações */}
        <div className={cn("flex justify-end", canSeeCosts ? "col-span-6 sm:col-span-1" : "col-span-12 sm:col-span-3")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-surface-2"
                data-guide={isFirst ? "product-actions" : undefined}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDetail}>
                <Eye className="h-4 w-4 mr-2" /> Detalhes
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onMovement}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Movimentar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* FEFO vencido — strip de alerta */}
      {fefoDias !== null && fefoDias < 0 && (
        <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-5 py-1.5">
          <AlertTriangle className="h-3 w-3 text-destructive" />
          <p className="text-[11px] font-medium text-destructive">
            Lote vencido há {Math.abs(fefoDias)} dia(s) — consumir imediatamente ou descartar
          </p>
        </div>
      )}
    </div>
  );
}
