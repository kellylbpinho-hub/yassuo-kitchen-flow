import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WeekMenuItem } from "@/hooks/usePainelNutriData";

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

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-primary" /> Cardápio da Semana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {weekDays.map((d) => {
          const dateStr = format(d, "yyyy-MM-dd");
          const menu = weekMenu.find((m) => m.date === dateStr);
          const dayLabel = format(d, "EEE dd/MM", { locale: ptBR });
          const isTodayDate = isToday(d);
          return (
            <div
              key={dateStr}
              onClick={() => navigate("/cardapio-semanal")}
              className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-accent transition-colors ${
                isTodayDate ? "bg-primary/10 font-medium" : "bg-muted/40"
              }`}
            >
              <span className="capitalize text-foreground">{dayLabel}</span>
              {menu ? (
                <span className="text-xs text-muted-foreground">
                  {menu.nome} · {menu.dishCount} prato(s)
                </span>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Sem cardápio
                </Badge>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
