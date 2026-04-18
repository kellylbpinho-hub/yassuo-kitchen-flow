import { AlertTriangle, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecurrenceAlert {
  name: string;
  weeks: number;
}

interface WasteRecurrenceAlertProps {
  alerts: RecurrenceAlert[];
}

export function WasteRecurrenceAlert({ alerts }: WasteRecurrenceAlertProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-destructive/40 bg-gradient-to-r from-destructive/10 via-destructive/5 to-transparent p-4",
        "shadow-[0_0_30px_-10px_hsl(var(--destructive)/0.4)]",
      )}
    >
      <div className="absolute top-0 left-0 h-full w-1 bg-destructive animate-pulse" />
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 border border-destructive/30 shrink-0">
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-destructive" /> Padrão de recorrência detectado
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            {alerts.length === 1
              ? "1 preparação com desperdício recorrente"
              : `${alerts.length} preparações com desperdício recorrente`}
          </p>
          <ul className="space-y-1">
            {alerts.slice(0, 4).map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md bg-background/40 border border-destructive/20"
              >
                <span className="font-medium text-foreground truncate">{a.name}</span>
                <span className="text-destructive font-semibold tabular-nums whitespace-nowrap">
                  {a.weeks}ª semana consecutiva
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
