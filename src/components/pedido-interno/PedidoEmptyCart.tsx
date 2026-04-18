import { ShoppingCart, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function PedidoEmptyCart({ canSeeForecast = true }: { canSeeForecast?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-8 sm:p-12 text-center">
      <div className="mx-auto mb-5 relative w-fit">
        <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" />
        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center">
          <ShoppingCart className="h-7 w-7 text-primary" />
        </div>
      </div>
      <h3 className="text-lg font-display font-bold text-foreground mb-2">
        Nenhum item adicionado ainda
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
        Adicione itens manualmente ou gere o pedido automaticamente a partir da previsão de
        insumos da semana.
      </p>
      {canSeeForecast && (
        <Button
          variant="outline"
          className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
          onClick={() => navigate("/planejamento-insumos")}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Ver previsão de insumos
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
