import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { parseNFeXml, type NFeData, type NFeItem } from "@/lib/nfeParser";
import { supabase } from "@/lib/supabase";
import type { Product } from "./types";

interface NFeImportXmlProps {
  allProducts: Product[];
  defaultUnitId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface MatchedItem extends NFeItem {
  matched: boolean;
  product: Product | null;
  selected: boolean;
  loteFinal: string;
  validadeFinal: string;
}

export function NFeImportXml({ allProducts, defaultUnitId, onComplete, onCancel }: NFeImportXmlProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [nfeData, setNfeData] = useState<NFeData | null>(null);
  const [items, setItems] = useState<MatchedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xml")) {
      toast.error("Selecione um arquivo XML de NF-e.");
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const data = parseNFeXml(text);
      setNfeData(data);

      const matched = data.items.map((item): MatchedItem => {
        let product: Product | null = null;

        if (item.ean) {
          product = allProducts.find(
            (p) => p.codigo_barras && p.codigo_barras === item.ean
          ) || null;
        }

        if (!product) {
          const normalizedDesc = item.descricao.toLowerCase();
          product = allProducts.find(
            (p) => p.nome.toLowerCase() === normalizedDesc
          ) || null;

          if (!product) {
            product = allProducts.find((p) => {
              const pName = p.nome.toLowerCase();
              return normalizedDesc.includes(pName) || pName.includes(normalizedDesc);
            }) || null;
          }
        }

        return {
          ...item,
          matched: !!product,
          product,
          selected: !!product,
          loteFinal: item.lote,
          validadeFinal: item.validade,
        };
      });

      setItems(matched);
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler o XML.");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemField = (index: number, field: "loteFinal" | "validadeFinal", value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const processReceipts = async () => {
    const selected = items.filter((i) => i.selected && i.product);
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um item para receber.");
      return;
    }

    const missing = selected.filter((i) => !i.loteFinal || !i.validadeFinal);
    if (missing.length > 0) {
      toast.error("Preencha lote e validade de todos os itens selecionados.");
      return;
    }

    setProcessing(true);
    let success = 0;
    const errors: string[] = [];

    for (const item of selected) {
      const { error } = await supabase.rpc("rpc_receive_digital", {
        p_product_id: item.product!.id,
        p_unidade_id: defaultUnitId,
        p_validade: item.validadeFinal,
        p_lote_codigo: item.loteFinal,
        p_quantidade: item.quantidade,
      });

      if (error) {
        errors.push(`${item.descricao}: ${error.message}`);
      } else {
        success++;
      }
    }

    setProcessing(false);
    setResults({ success, errors });

    if (errors.length === 0) {
      toast.success(`${success} item(ns) recebido(s) com sucesso!`);
    } else {
      toast.warning(`${success} recebido(s), ${errors.length} erro(s).`);
    }
  };

  if (results) {
    return (
      <div className="space-y-4 text-center py-4">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
        <h3 className="font-display font-bold text-foreground">Importação Concluída</h3>
        <p className="text-sm text-muted-foreground">
          {results.success} item(ns) recebido(s) com sucesso.
        </p>
        {results.errors.length > 0 && (
          <div className="bg-destructive/10 rounded-lg p-3 text-left space-y-1">
            <p className="text-xs font-medium text-destructive">Erros ({results.errors.length}):</p>
            {results.errors.map((err, i) => (
              <p key={i} className="text-xs text-destructive/80">{err}</p>
            ))}
          </div>
        )}
        <Button onClick={onComplete}>Voltar ao início</Button>
      </div>
    );
  }

  if (!nfeData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione o arquivo XML da Nota Fiscal Eletrônica para importar automaticamente os itens para recebimento.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xml"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Selecionar XML
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    );
  }

  const matchedCount = items.filter((i) => i.matched).length;
  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-foreground">NF-e #{nfeData.numero}</h3>
      </div>

      <div className="bg-accent/50 rounded-lg p-3 space-y-1">
        <p className="text-sm font-medium text-foreground">{nfeData.emitente}</p>
        <p className="text-xs text-muted-foreground">
          CNPJ: {nfeData.cnpjEmitente} · Emissão: {nfeData.dataEmissao}
        </p>
        <div className="flex gap-2 flex-wrap mt-1">
          <Badge variant="outline" className="text-xs">
            {nfeData.items.length} itens na nota
          </Badge>
          <Badge variant={matchedCount === nfeData.items.length ? "default" : "secondary"} className="text-xs">
            {matchedCount} correspondidos
          </Badge>
        </div>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={index}
            className={`rounded-lg border p-3 space-y-2 ${
              item.matched
                ? "border-border bg-background"
                : "border-warning/50 bg-warning/5"
            }`}
          >
            <div className="flex items-start gap-2">
              {item.matched && (
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={() => toggleItem(index)}
                  className="mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.descricao}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.quantidade} {item.unidade} · R$ {item.valorUnitario.toFixed(2)}/un
                </p>
                {item.matched && item.product ? (
                  <Badge variant="outline" className="text-xs mt-1 bg-success/10 text-success border-success/20">
                    → {item.product.nome}
                  </Badge>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    <span className="text-xs text-warning">
                      Produto não encontrado no cadastro
                    </span>
                  </div>
                )}
              </div>
            </div>

            {item.matched && item.selected && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <Label className="text-xs">Lote</Label>
                  <Input
                    value={item.loteFinal}
                    onChange={(e) => updateItemField(index, "loteFinal", e.target.value)}
                    placeholder="Lote"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input
                    type="date"
                    value={item.validadeFinal}
                    onChange={(e) => updateItemField(index, "validadeFinal", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          onClick={processReceipts}
          disabled={processing || selectedCount === 0}
          className="gap-2"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Receber {selectedCount} item(ns)
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
