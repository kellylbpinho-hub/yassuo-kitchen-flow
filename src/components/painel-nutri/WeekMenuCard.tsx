import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowRight, CheckCircle2, CalendarPlus } from "lucide-react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WeekMenuItem } from "@/hooks/usePainelNutriData";
import { cn } from "@/lib/utils";

interface Props {
  weekMenu: WeekMenuItem[];
}

export function WeekMenuCard({ weekMenu }: Props) {
  const navigate = useNavigate();
  const today = new Date();
  const weekDays = eachDayOfInterval({
    start: startOfWeek(today, { weekStartsOn: 1 }),
    end: endOfWeek(today, { weekStartsOn: 1 }),
  });

  const planned = weekMenu.length;

  return (
    <Card className="bg-card/80 border-border/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            Cardápio da semana
            <span className="ml-1 rounded-full border border-border/60 bg-surface-3/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {planned}/7
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-primary"
            onClick={() => navigate("/cardapio-semanal")}
          >
            Planejar <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-4">
        {weekDays.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const menu = weekMenu.find((m) => m.date === dateStr);
          const dayLabel = format(d, "EEE dd/MM", { locale: ptBR });
          const isTodayDate = isToday(d);
          const hasMenu = !!menu;

          return (
            <button
              key={dateStr}
              onClick={() => navigate("/cardapio-semanal")}
              className={cn(
                "group flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all",
                isTodayDate
                  ? "border-primary/30 bg-primary/[0.06] hover:bg-primary/[0.10]"
                  : "border-border/40 bg-surface-1/40 hover:border-border/80 hover:bg-surface-3/60",
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    hasMenu ? "bg-primary" : "bg-muted-foreground/40",
                    isTodayDate && "ring-2 ring-primary/30",
                  )}
                />
                <span
                  className={cn(
                    "capitalize",
                    isTodayDate ? "font-semibold text-foreground" : "text-foreground/90",
                  )}
                >
                  {dayLabel}
                </span>
                {isTodayDate && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Hoje
                  </span>
                )}
              </div>
              {hasMenu ? (
                <span className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  <span className="text-foreground/80 truncate max-w-[140px]">
                    {menu.nome}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    · {menu.dishCount}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <CalendarPlus className="h-3 w-3" />
                  Sem cardápio
                </span>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
