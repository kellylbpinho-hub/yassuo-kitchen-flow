import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";
import type { LowStockItem } from "@/hooks/usePainelNutriData";

interface Props {
  items: LowStockItem[];
}

export function LowStockCard({ items }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Package className="h-4 w-4 text-destructive" /> Estoque Baixo
          </CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/pedido-interno")}
            >
              Fazer pedido <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhum item abaixo do mínimo.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate max-w-[60%]">{item.nome}</span>
                <span className="text-xs text-destructive font-medium">
                  {item.saldo} / {item.minimo}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
