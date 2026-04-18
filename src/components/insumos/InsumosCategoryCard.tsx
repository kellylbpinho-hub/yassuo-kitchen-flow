import { useState } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InsumoItem {
  productId: string;
  productName: string;
  unidadeMedida: string;
  totalNeeded: number;
  stockAvailable: number;
  deficit: number;
  custoUnitario: number;
  custoTotal: number;
  appearsInDays: number;
}

type Status = "ok" | "atencao" | "falta";

interface InsumosCategoryCardProps {
  category: string;
  icon: LucideIcon;
  items: InsumoItem[];
  defaultOpen?: boolean;
}

function getStatus(item: InsumoItem): Status {
  if (item.deficit > 0) return "falta";
  const ratio = item.totalNeeded > 0 ? item.stockAvailable / item.totalNeeded : 999;
  if (ratio <= 1.2) return "atencao";
  return "ok";
}

const statusBar: Record<Status, string> = {
  ok: "bg-emerald-500",
  atencao: "bg-amber-500",
  falta: "bg-destructive",
};

const statusDot: Record<Status, string> = {
  ok: "bg-emerald-400 shadow-[0_0_8px_hsl(var(--success-500,142_71%_45%)/0.6)]",
  atencao: "bg-amber-400",
  falta: "bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.6)]",
};

const statusLabel: Record<Status, string> = {
  ok: "Coberto",
  atencao: "Parcial",
  falta: "Crítico",
};

const statusLabelCls: Record<Status, string> = {
  ok: "text-emerald-300",
  atencao: "text-amber-300",
  falta: "text-destructive",
};

export function InsumosCategoryCard({
  category,
  icon: Icon,
  items,
  defaultOpen = true,
}: InsumosCategoryCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const counts = items.reduce(
    (acc, i) => {
      acc[getStatus(i)]++;
      return acc;
    },
    { ok: 0, atencao: 0, falta: 0 } as Record<Status, number>,
  );

  // Worst status drives accent stripe
  const worstStatus: Status =
    counts.falta > 0 ? "falta" : counts.atencao > 0 ? "atencao" : "ok";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface-1 transition-colors hover:border-border">
      {/* Accent stripe */}
      <div className={cn("absolute left-0 top-0 h-full w-[3px]", statusBar[worstStatus])} />

      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-2 text-muted-foreground group-hover:text-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{category}</p>
            <p className="text-[11px] text-muted-foreground">
              {items.length} {items.length === 1 ? "ingrediente" : "ingredientes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {counts.falta > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-destructive/35 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              {counts.falta}
            </span>
          )}
          {counts.atencao > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {counts.atencao}
            </span>
          )}
          {counts.ok > 0 && counts.falta === 0 && counts.atencao === 0 && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              tudo coberto
            </span>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-border/50">
          <ul className="divide-y divide-border/40">
            {items.map((item) => {
              const status = getStatus(item);
              const balance = item.stockAvailable - item.totalNeeded;
              const coverage =
                item.totalNeeded > 0
                  ? Math.min(100, (item.stockAvailable / item.totalNeeded) * 100)
                  : 100;
              return (
                <li
                  key={item.productId}
                  className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 transition-colors hover:bg-surface-2/30"
                >
                  {/* Name & unit */}
                  <div className="col-span-12 flex items-center gap-2.5 sm:col-span-5">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDot[status])} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.productName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {item.appearsInDays}{" "}
                        {item.appearsInDays === 1 ? "dia" : "dias"} · {item.unidadeMedida}
                      </p>
                    </div>
                  </div>

                  {/* Coverage bar (mobile + desktop) */}
                  <div className="col-span-7 sm:col-span-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            status === "ok"
                              ? "bg-gradient-to-r from-emerald-500/70 to-emerald-400"
                              : status === "atencao"
                                ? "bg-gradient-to-r from-amber-500/70 to-amber-400"
                                : "bg-gradient-to-r from-destructive/70 to-destructive",
                          )}
                          style={{ width: `${coverage}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {Math.round(coverage)}%
                      </span>
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="col-span-5 text-right sm:col-span-2">
                    <p className="text-[11px] text-muted-foreground">Necess.</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {item.totalNeeded.toFixed(2)}
                    </p>
                  </div>

                  <div className="col-span-7 text-right sm:col-span-2">
                    <p className="text-[11px] text-muted-foreground">
                      {balance >= 0 ? "Sobra" : "Falta"}
                    </p>
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        statusLabelCls[status],
                      )}
                    >
                      {balance >= 0
                        ? `+${balance.toFixed(2)}`
                        : balance.toFixed(2)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
