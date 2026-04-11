import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowRight } from "lucide-react";
import type { PurchaseSummary } from "@/hooks/useCeoData";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  purchaseSummary: PurchaseSummary;
}

export function CeoPurchaseCard({ purchaseSummary }: Props) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" /> Resumo de Compras
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{purchaseSummary.total_orders}</p>
            <p className="text-xs text-muted-foreground">Últimos pedidos</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{formatCurrency(purchaseSummary.total_value)}</p>
            <p className="text-xs text-muted-foreground">Total em itens</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{purchaseSummary.pending_quotations}</p>
            <p className="text-xs text-muted-foreground">Cotações pendentes</p>
          </div>
        </div>
        {purchaseSummary.recent_orders.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border">
            {purchaseSummary.recent_orders.slice(0, 3).map((o, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">OC-{String(o.numero).padStart(4, "0")}</span>
                <span className="text-muted-foreground truncate max-w-[100px]">{o.fornecedor}</span>
                <Badge variant="outline" className="text-[10px]">{o.status}</Badge>
                <span className="font-medium text-foreground">{o.total > 0 ? formatCurrency(o.total) : "—"}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => navigate("/compras")}>
            Compras <ArrowRight className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => navigate("/cotacoes")}>
            Cotações <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
