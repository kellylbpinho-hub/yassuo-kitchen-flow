import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];
const UNIDADES_MEDIDA = ["kg", "g", "L", "ml", "un"];

const DB_COLUMNS = [
  { key: "nome", label: "Nome *", required: true },
  { key: "categoria", label: "Categoria *", required: true },
  { key: "codigo_barras", label: "Código de Barras", required: false },
  { key: "marca", label: "Marca", required: false },
  { key: "unidade_compra", label: "Unidade de Compra", required: false },
  { key: "fator_conversao", label: "Unidades por Embalagem", required: false },
  { key: "unidade_medida", label: "Unidade de Estoque", required: false },
  { key: "estoque_minimo", label: "Estoque Mínimo", required: false },
] as const;

type DBColumnKey = (typeof DB_COLUMNS)[number]["key"];

interface ImportRow {
  [key: string]: string | number | null;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportProductsDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  units: { id: string; name: string; type: string }[];
  defaultUnitId: string;
}

export function ImportProductsDialog({ open, onClose, onImported, units, defaultUnitId }: ImportProductsDialogProps) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<DBColumnKey, string>>({} as any);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [unitId, setUnitId] = useState(defaultUnitId);

  const reset = useCallback(() => {
    setStep("upload");
    setFileHeaders([]);
    setRawData([]);
    setMapping({} as any);
    setErrors([]);
    setImporting(false);
    setImportResult(null);
    setUnitId(defaultUnitId);
  }, [defaultUnitId]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Formato não suportado. Use CSV, XLSX ou XLS.");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });

      if (json.length === 0) {
        toast.error("Planilha vazia.");
        return;
      }

      const headers = Object.keys(json[0]);
      setFileHeaders(headers);
      setRawData(json);

      // Auto-map columns by fuzzy name matching
      const autoMap: Record<string, string> = {};
      DB_COLUMNS.forEach((col) => {
        const match = headers.find((h) => {
          const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const colLower = col.label.replace(" *", "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return lower.includes(colLower) || colLower.includes(lower) || lower === col.key;
        });
        if (match) autoMap[col.key] = match;
      });
      setMapping(autoMap as Record<DBColumnKey, string>);
      setStep("mapping");
    } catch {
      toast.error("Erro ao ler arquivo.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = (): ValidationError[] => {
    const errs: ValidationError[] = [];
    rawData.forEach((row, i) => {
      const nome = mapping.nome ? String(row[mapping.nome] || "").trim() : "";
      const categoria = mapping.categoria ? String(row[mapping.categoria] || "").trim() : "";

      if (!nome) errs.push({ row: i + 1, field: "Nome", message: "Nome é obrigatório" });
      if (!categoria) errs.push({ row: i + 1, field: "Categoria", message: "Categoria é obrigatória" });
      else if (!CATEGORIAS_FIXAS.includes(categoria)) {
        errs.push({ row: i + 1, field: "Categoria", message: `"${categoria}" não é uma categoria válida` });
      }
    });
    return errs;
  };

  const goToPreview = () => {
    if (!mapping.nome || !mapping.categoria) {
      toast.error("Mapeie pelo menos Nome e Categoria.");
      return;
    }
    const errs = validate();
    setErrors(errs);
    setStep("preview");
  };

  const doImport = async () => {
    if (errors.length > 0) {
      toast.error(`Corrija ${errors.length} erro(s) antes de importar.`);
      return;
    }

    setImporting(true);
    setStep("importing");
    let success = 0;
    let failed = 0;

    for (const row of rawData) {
      const nome = String(row[mapping.nome] || "").trim();
      const categoria = String(row[mapping.categoria] || "").trim();
      let codigoBarras = mapping.codigo_barras ? String(row[mapping.codigo_barras] || "").trim() || null : null;
      const marca = mapping.marca ? String(row[mapping.marca] || "").trim() || null : null;
      const unidadeMedida = mapping.unidade_medida ? String(row[mapping.unidade_medida] || "").trim() : "kg";
      const estoqueMinimo = mapping.estoque_minimo ? Number(row[mapping.estoque_minimo]) || 0 : 0;
      const unidadeCompra = mapping.unidade_compra ? String(row[mapping.unidade_compra] || "").trim() : null;
      const fatorConversao = mapping.fator_conversao ? Number(row[mapping.fator_conversao]) || 1 : 1;

      // If barcode equals product name, treat as no barcode (item without label)
      if (codigoBarras && codigoBarras === nome) {
        codigoBarras = null;
      }

      const validUnit = UNIDADES_MEDIDA.includes(unidadeMedida) ? unidadeMedida : "kg";

      try {
        // Create product via RPC (handles company_id automatically)
        const { data, error } = await supabase.rpc("rpc_create_product", {
          p_unidade_id: unitId,
          p_nome: nome,
          p_unidade_medida: validUnit,
          p_codigo_barras: codigoBarras,
        });

        if (error) {
          failed++;
          continue;
        }

        const result = data as any;
        const productId = result?.id;

        if (productId && !result?.already_existed) {
          // Update categoria, estoque_minimo, and marca
          const updateData: any = { categoria, estoque_minimo: estoqueMinimo };
          if (marca) updateData.marca = marca;
          await supabase.from("products").update(updateData).eq("id", productId);

          // Create purchase unit if provided
          if (unidadeCompra && profile?.company_id) {
            await supabase.from("product_purchase_units").insert({
              product_id: productId,
              nome: unidadeCompra,
              fator_conversao: fatorConversao,
              company_id: profile.company_id,
            });
          }
        }

        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);

    if (success > 0) {
      toast.success(`${success} produto(s) importado(s)!`);
      onImported();
    }
    if (failed > 0) {
      toast.error(`${failed} produto(s) falharam.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Planilha
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-foreground font-medium">Selecione um arquivo CSV ou Excel</p>
              <p className="text-sm text-muted-foreground">Suporte a .csv, .xlsx e .xls</p>
            </div>
            <Button onClick={() => fileInputRef.current?.click()} size="lg">
              <Upload className="h-4 w-4 mr-2" />Escolher Arquivo
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        )}

        {/* Step: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Mapeie as colunas da sua planilha ({rawData.length} linhas detectadas):
            </p>

            <div>
              <Label>Unidade de destino *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.type.toUpperCase()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              {DB_COLUMNS.map((col) => (
                <div key={col.key} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-right text-sm">
                    {col.label}
                  </Label>
                  <Select
                    value={mapping[col.key] || "__none__"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [col.key]: v === "__none__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="— Ignorar —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Ignorar —</SelectItem>
                      {fileHeaders.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={goToPreview}>Pré-visualizar</Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold text-destructive">{errors.length} erro(s) encontrado(s)</span>
                </div>
                <ScrollArea className="max-h-24">
                  {errors.slice(0, 20).map((e, i) => (
                    <p key={i} className="text-xs text-destructive">
                      Linha {e.row}: {e.message}
                    </p>
                  ))}
                  {errors.length > 20 && <p className="text-xs text-muted-foreground">+{errors.length - 20} mais...</p>}
                </ScrollArea>
              </div>
            )}

            {errors.length === 0 && (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">
                  {rawData.length} produto(s) prontos para importação
                </span>
              </div>
            )}

            <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs">#</TableHead>
                    {DB_COLUMNS.filter((c) => mapping[c.key]).map((c) => (
                      <TableHead key={c.key} className="text-xs">{c.label.replace(" *", "")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawData.slice(0, 50).map((row, i) => {
                    const rowErrors = errors.filter((e) => e.row === i + 1);
                    return (
                      <TableRow key={i} className={rowErrors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        {DB_COLUMNS.filter((c) => mapping[c.key]).map((c) => (
                          <TableCell key={c.key} className="text-xs">
                            {String(row[mapping[c.key]] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rawData.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando 50 de {rawData.length} linhas
                </p>
              )}
            </ScrollArea>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>Voltar</Button>
              <Button onClick={doImport} disabled={errors.length > 0}>
                Importar {rawData.length} Produto(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-6 py-8">
            {importing ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-foreground font-medium">Importando produtos...</p>
              </>
            ) : importResult && (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-foreground font-medium">Importação concluída!</p>
                  <div className="flex gap-3 justify-center">
                    <Badge variant="default">{importResult.success} importados</Badge>
                    {importResult.failed > 0 && (
                      <Badge variant="destructive">{importResult.failed} falharam</Badge>
                    )}
                  </div>
                </div>
                <Button onClick={handleClose}>Fechar</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
