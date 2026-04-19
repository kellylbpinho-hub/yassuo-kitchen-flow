import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, Loader2, AlertTriangle, CheckCircle2, Plus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { parseNFePdf, type NFePdfData } from "@/lib/nfePdfParser";
import { supabase } from "@/lib/supabase";
import type { Product } from "./types";

interface NFeImportPdfProps {
  allProducts: Product[];
  defaultUnitId: string;
  onComplete: () => void;
  onCancel: () => void;
}

interface ManualItem {
  id: string;
  productId: string;
  quantidade: string;
  lote: string;
  validade: string;
}

const newItem = (): ManualItem => ({
  id: crypto.randomUUID(),
  productId: "",
  quantidade: "",
  lote: "",
  validade: "",
});

export function NFeImportPdf({ allProducts, defaultUnitId, onComplete, onCancel }: NFeImportPdfProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfData, setPdfData] = useState<NFePdfData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Header (editável)
  const [numero, setNumero] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emitente, setEmitente] = useState("");
  const [dataEmissao, setDataEmissao] = useState("");
  const [valorTotal, setValorTotal] = useState("");

  // Itens manuais
  const [items, setItems] = useState<ManualItem[]>([newItem()]);

  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF.");
      return;
    }

    setLoading(true);
    try {
      const data = await parseNFePdf(file);
      setPdfData(data);
      setNumero(data.numero);
      setCnpj(data.cnpjEmitente);
      setEmitente(data.emitente);
      setDataEmissao(data.dataEmissao);
      setValorTotal(data.valorTotal ? data.valorTotal.toFixed(2) : "");

      if (data.ocrConfidence === "alta") {
        toast.success("PDF lido. Confira os campos e adicione os itens.");
      } else if (data.ocrConfidence === "media") {
        toast.message("Leitura parcial — confirme os campos.");
      } else {
        toast.warning("Não foi possível ler automaticamente. Preencha os campos manualmente.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao ler o PDF.");
      // Mesmo com falha, abre formulário manual
      setPdfData({
        numero: "",
        cnpjEmitente: "",
        emitente: "",
        dataEmissao: "",
        valorTotal: 0,
        items: [],
        rawText: "",
        ocrConfidence: "baixa",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (id: string, patch: Partial<ManualItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const addItem = () => setItems((prev) => [...prev, newItem()]);
  const removeItem = (id: string) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.id !== id)));

  const processReceipts = async () => {
    const valid = items.filter(
      (it) => it.productId && it.quantidade && Number(it.quantidade) > 0 && it.lote && it.validade
    );

    if (valid.length === 0) {
      toast.error("Adicione pelo menos um item completo (produto, quantidade, lote e validade).");
      return;
    }

    setProcessing(true);
    let success = 0;
    const errors: string[] = [];

    for (const it of valid) {
      const product = allProducts.find((p) => p.id === it.productId);
      const { error } = await supabase.rpc("rpc_receive_digital", {
        p_product_id: it.productId,
        p_unidade_id: defaultUnitId,
        p_validade: it.validade,
        p_lote_codigo: it.lote,
        p_quantidade: Number(it.quantidade),
      });

      if (error) {
        errors.push(`${product?.nome || "Item"}: ${error.message}`);
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

  // Resultados
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

  // Upload inicial
  if (!pdfData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Envie o PDF da DANFE. O sistema tenta ler automaticamente os dados; se não conseguir, você preenche manualmente.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            PDFs escaneados (imagem) podem não ser lidos automaticamente. Para máxima precisão, prefira o XML.
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={handleFile}
        />
        <div className="flex gap-2">
          <Button onClick={() => fileRef.current?.click()} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Lendo PDF...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Selecionar PDF
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // Formulário (pré-preenchido ou manual)
  const confidenceLabel =
    pdfData.ocrConfidence === "alta"
      ? { text: "Leitura completa", cls: "bg-success/10 text-success border-success/20" }
      : pdfData.ocrConfidence === "media"
      ? { text: "Leitura parcial", cls: "bg-warning/10 text-warning border-warning/30" }
      : { text: "Preenchimento manual", cls: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-display font-bold text-foreground truncate">Confirmar dados da NF-e</h3>
        </div>
        <Badge variant="outline" className={`text-[10px] ${confidenceLabel.cls}`}>
          {confidenceLabel.text}
        </Badge>
      </div>

      {pdfData.ocrConfidence === "baixa" && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning-foreground/90">
            Não foi possível ler automaticamente. Preencha os campos abaixo manualmente.
          </p>
        </div>
      )}

      {/* Header da nota */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Número da NF-e</Label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="000000000" className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Data de emissão</Label>
          <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">CNPJ do fornecedor</Label>
          <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Razão social</Label>
          <Input value={emitente} onChange={(e) => setEmitente(e.target.value)} placeholder="Nome do fornecedor" className="h-9" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Valor total da nota (R$)</Label>
          <Input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" className="h-9" />
        </div>
      </div>

      {/* Itens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Itens recebidos</h4>
          <Button variant="ghost" size="sm" onClick={addItem} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" />
            Adicionar item
          </Button>
        </div>

        {items.map((it, idx) => (
          <div key={it.id} className="rounded-lg border border-border bg-background/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Item {idx + 1}
              </span>
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(it.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div>
              <Label className="text-xs">Produto</Label>
              <Select
                value={it.productId}
                onValueChange={(v) => updateItem(it.id, { productId: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.marca ? ` · ${p.marca}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={it.quantidade}
                  onChange={(e) => updateItem(it.id, { quantidade: e.target.value })}
                  placeholder="0"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Lote</Label>
                <Input
                  value={it.lote}
                  onChange={(e) => updateItem(it.id, { lote: e.target.value })}
                  placeholder="Lote"
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Validade</Label>
                <Input
                  type="date"
                  value={it.validade}
                  onChange={(e) => updateItem(it.id, { validade: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={processReceipts} disabled={processing} className="gap-2">
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Receber itens
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
