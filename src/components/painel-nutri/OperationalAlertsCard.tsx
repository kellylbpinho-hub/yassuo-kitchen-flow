import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import type { OperationalAlert } from "@/hooks/usePainelNutriData";

interface Props {
  alerts: OperationalAlert[];
}

export function OperationalAlertsCard({ alerts }: Props) {
  if (alerts.length === 0) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-primary" /> Alertas Operacionais
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {alerts.map((alert, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  alert.type === "danger" ? "bg-destructive" : "bg-warning/15"
                }`}
              />
              <span className="text-foreground">{alert.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
