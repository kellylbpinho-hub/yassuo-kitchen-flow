import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { ExpiryAlert } from "@/hooks/usePainelNutriData";

interface Props {
  alerts: ExpiryAlert[];
}

export function ExpiryAlertsCard({ alerts }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas de Validade
          </CardTitle>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/estoque")}
            >
              Ver estoque <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Sem alertas de validade.</p>
        ) : (
          <div className="space-y-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate max-w-[55%]">{a.nome}</span>
                <Badge
                  variant={a.dias <= 0 ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {a.dias <= 0 ? "Vencido" : `${a.dias}d`} · {a.qtd} un
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
