import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pencil, Check, X, MessageSquare } from "lucide-react";
import { useState } from "react";

export interface CartItem {
  productId: string;
  productName: string;
  marca?: string | null;
  category?: string | null;
  unidade_medida: string;
  quantidade: number;
  observacao: string;
  fromForecast?: boolean;
}

interface CartItemCardProps {
  item: CartItem;
  index: number;
  onUpdate: (index: number, patch: Partial<CartItem>) => void;
  onRemove: (index: number) => void;
}

export function CartItemCard({ item, index, onUpdate, onRemove }: CartItemCardProps) {
  const [editing, setEditing] = useState(false);
  const [tempQty, setTempQty] = useState(String(item.quantidade));
  const [tempObs, setTempObs] = useState(item.observacao);

  const commit = () => {
    const parsed = parseFloat(tempQty.replace(",", "."));
    if (!isNaN(parsed) && parsed > 0) {
      onUpdate(index, { quantidade: parsed, observacao: tempObs.trim() });
    }
    setEditing(false);
  };

  const cancel = () => {
    setTempQty(String(item.quantidade));
    setTempObs(item.observacao);
    setEditing(false);
  };

  return (
    <div className="group rounded-xl border border-border/60 bg-card/40 hover:bg-card/70 hover:border-primary/30 transition-all p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm text-foreground truncate">{item.productName}</p>
            {item.fromForecast && (
              <span className="inline-flex items-center text-[10px] uppercase tracking-wide font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                Sugerido
              </span>
            )}
          </div>
          {item.marca && (
            <p className="text-xs text-muted-foreground/80 truncate">{item.marca}</p>
          )}
        </div>

        {!editing ? (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
              aria-label="Editar item"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              onClick={() => onRemove(index)}
              aria-label="Remover item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/10"
              onClick={commit}
              aria-label="Salvar"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={cancel}
              aria-label="Cancelar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-end gap-3">
        {!editing ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
                {item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
              </span>
              <span className="text-xs text-muted-foreground uppercase font-medium">
                {item.unidade_medida}
              </span>
            </div>
            {item.observacao && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 ml-auto truncate max-w-[60%]">
                <MessageSquare className="h-3 w-3 shrink-0" />
                <span className="truncate italic">{item.observacao}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={tempQty}
              onChange={(e) => setTempQty(e.target.value)}
              className="h-8 text-sm"
              placeholder={item.unidade_medida}
              autoFocus
            />
            <Input
              value={tempObs}
              onChange={(e) => setTempObs(e.target.value)}
              className="h-8 text-sm"
              placeholder="Observação"
            />
          </div>
        )}
      </div>
    </div>
  );
}
