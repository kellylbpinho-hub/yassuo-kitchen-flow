import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getSuggestedValidityDays, type GS1Data } from "@/lib/gs1Parser";
import type { Product, Unit, PurchaseUnit } from "./types";

interface ReceiptFormProps {
  product: Product;
  barcode: string;
  gs1Data: GS1Data | null;
  units: Unit[];
  purchaseUnits: PurchaseUnit[];
  defaultUnitId: string;
  onSuccess: (product: Product, quantidade: string, novoSaldo: number) => void;
  onCancel: () => void;
}

export function ReceiptForm({
  product,
  barcode,
  gs1Data,
  units,
  purchaseUnits,
  defaultUnitId,
  onSuccess,
  onCancel,
}: ReceiptFormProps) {
  const { user, profile } = useAuth();
  const [validade, setValidade] = useState("");
  const [lote, setLote] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [selectedUnit, setSelectedUnit] = useState(defaultUnitId);
  const [loading, setLoading] = useState(false);
  const [weightWarning, setWeightWarning] = useState(false);

  const isWeightUnit = product.unidade_medida && ["kg", "g"].includes(product.unidade_medida);
  const quantityLabel = isWeightUnit ? "Peso da Caixa (kg)" : "Quantidade na Caixa";
  const purchaseUnit = purchaseUnits.find((pu) => pu.product_id === product.id) || null;

  const today = new Date().toISOString().split("T")[0];
  const isExpired = validade && validade < today;

  // Prefill from GS1
  useEffect(() => {
    if (gs1Data?.isGS1) {
      if (gs1Data.expiryDate) setValidade(gs1Data.expiryDate);
      if (gs1Data.lotNumber) setLote(gs1Data.lotNumber);
      if (gs1Data.netWeightKg !== undefined) setQuantidade(String(gs1Data.netWeightKg));
    }
  }, [gs1Data]);

  // Check weight deviation in real-time for visual feedback
  useEffect(() => {
    const qty = parseFloat(quantidade);
    if (isNaN(qty) || qty <= 0) {
      setWeightWarning(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: lastEntries } = await supabase
        .from("movements")
        .select("quantidade")
        .eq("product_id", product.id)
        .eq("tipo", "entrada")
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled || !lastEntries || lastEntries.length < 2) return;
      const avg = lastEntries.reduce((s, e) => s + Number(e.quantidade), 0) / lastEntries.length;
      const deviation = Math.abs(qty - avg) / avg;
      setWeightWarning(deviation > 0.3);
    })();
    return () => { cancelled = true; };
  }, [quantidade, product.id]);

  const checkAndLogWeightDeviation = async (productId: string, currentQty: number) => {
    const { data: lastEntries } = await supabase
      .from("movements")
      .select("quantidade")
      .eq("product_id", productId)
      .eq("tipo", "entrada")
      .order("created_at", { ascending: false })
      .limit(5);

    if (!lastEntries || lastEntries.length < 2) return;
    const avg = lastEntries.reduce((s, e) => s + Number(e.quantidade), 0) / lastEntries.length;
    const deviation = Math.abs(currentQty - avg) / avg;

    if (deviation > 0.3 && profile?.company_id) {
      await supabase.from("weight_divergence_logs").insert({
        company_id: profile.company_id,
        product_id: productId,
        product_name: product.nome,
        peso_informado: currentQty,
        media_historica: Math.round(avg * 1000) / 1000,
        percentual_desvio: Math.round(deviation * 10000) / 100,
        user_id: user!.id,
        user_name: profile.full_name,
        unidade_id: selectedUnit,
      });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validade || !lote.trim() || !quantidade || !selectedUnit) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const qty = parseFloat(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    setLoading(true);
    await checkAndLogWeightDeviation(product.id, qty);

    const { data, error } = await supabase.rpc("rpc_receive_digital", {
      p_product_id: product.id,
      p_unidade_id: selectedUnit,
      p_validade: validade,
      p_lote_codigo: lote.trim(),
      p_quantidade: qty,
    });

    setLoading(false);
    if (error) {
      toast.error(error.message || "Erro desconhecido");
      return;
    }

    const novoSaldo = data ? (data as any).novo_estoque_atual : product.estoque_atual + qty;
    toast.success("Recebimento registrado com sucesso!");
    window.dispatchEvent(new CustomEvent("guided:receipt:success"));
    onSuccess({ ...product, estoque_atual: novoSaldo }, quantidade, novoSaldo);
  };

  const cdUnits = units.filter((u) => u.type === "cd");

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4">
      <h2 className="font-display font-bold text-foreground">Recebimento</h2>

      {/* Product info */}
      <div className="bg-accent/50 rounded-lg p-3 space-y-1">
        <p className="text-sm font-medium text-foreground">{product.nome}</p>
        {product.marca && (
          <p className="text-xs text-muted-foreground">Marca: {product.marca}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {barcode ? `Código: ${barcode} · ` : ""}Medida: {product.unidade_medida}
        </p>
        {purchaseUnit && (
          <div className="flex items-center gap-1 mt-1">
            <Info className="h-3 w-3 text-primary" />
            <span className="text-xs text-primary font-medium">
              Peso/Qtd Esperada: {purchaseUnit.fator_conversao} {product.unidade_medida} ({purchaseUnit.nome})
            </span>
          </div>
        )}
      </div>

      {/* GS1 badge */}
      {gs1Data?.isGS1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
            GS1-128 detectado
          </Badge>
          {gs1Data.netWeightKg !== undefined && (
            <Badge variant="outline" className="text-xs">Peso: {gs1Data.netWeightKg} kg</Badge>
          )}
          {gs1Data.lotNumber && (
            <Badge variant="outline" className="text-xs">Lote: {gs1Data.lotNumber}</Badge>
          )}
        </div>
      )}

      <div className="space-y-3">
        {/* Validade */}
        <div>
          <Label>Validade * (data da etiqueta)</Label>
          <Input
            type="date"
            value={validade}
            onChange={(e) => setValidade(e.target.value)}
            className={isExpired ? "border-destructive focus-visible:ring-destructive" : ""}
            data-guide="input-validade"
          />
          {isExpired && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atenção: data de validade já expirada. Confira a etiqueta.
            </p>
          )}
          {product.categoria && !gs1Data?.isGS1 && !isExpired && (
            <p className="text-xs text-muted-foreground mt-1">
              Referência: ~{getSuggestedValidityDays(product.categoria)} dias para {product.categoria}
            </p>
          )}
        </div>

        {/* Lote */}
        <div>
          <Label>Lote *</Label>
          <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L2025-001" data-guide="input-lote" />
        </div>

        {/* Quantidade */}
        <div data-guide="input-qty-receb">
          <Label>{quantityLabel} *</Label>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder={isWeightUnit ? "Ex: 12.450" : `Em ${product.unidade_medida}`}
            className={weightWarning ? "border-warning focus-visible:ring-warning" : ""}
          />
          {weightWarning && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Peso diferente do habitual — confira antes de confirmar.
            </p>
          )}
          {isWeightUnit && !weightWarning && (
            <p className="text-xs text-muted-foreground mt-1">
              Aceita decimais para peso real (ex: 12.450 kg)
            </p>
          )}
        </div>

        {/* Local */}
        <div>
          <Label>Local de recebimento (CD) *</Label>
          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cdUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} (CD)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} data-guide="btn-confirm-receb">
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Confirmar Recebimento
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
