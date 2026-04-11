import { Button } from "@/components/ui/button";
import { CheckCircle2, RotateCcw } from "lucide-react";
import type { Product } from "./types";

interface ReceiptSuccessProps {
  product: Product;
  quantidade: string;
  novoSaldo: number;
  onNewReceipt: () => void;
  onSameProduct: () => void;
}

export function ReceiptSuccess({ product, quantidade, novoSaldo, onNewReceipt, onSameProduct }: ReceiptSuccessProps) {
  return (
    <div className="glass-card p-6 max-w-sm text-center space-y-4">
      <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
      <h2 className="font-display font-bold text-lg text-foreground">
        Recebimento Registrado!
      </h2>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Produto: {product.nome} · Qtd: {quantidade} {product.unidade_medida}</p>
        <p className="text-xs font-medium text-foreground">
          Novo saldo: {novoSaldo.toFixed(3)} {product.unidade_medida}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={onSameProduct} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Receber outro lote de {product.nome}
        </Button>
        <Button onClick={onNewReceipt}>Novo Recebimento</Button>
      </div>
    </div>
  );
}
