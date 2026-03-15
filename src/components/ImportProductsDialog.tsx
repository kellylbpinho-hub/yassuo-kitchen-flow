import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2, Download, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];
const UNIDADES_MEDIDA = ["kg", "g", "L", "ml", "un"];

interface ImportRow {
  nome_produto: string;
  marca: string;
  categoria: string;
  unidade: string;
  observacao?: string;
  status?: string;
}

interface RowValidation {
  row: number;
  data: ImportRow;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

interface ImportResult {
  imported: string[];
  ignored: string[];
  errors: { row: number; nome: string; reason: string }[];
}

interface ImportProductsDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  units: { id: string; name: string; type: string }[];
  defaultUnitId: string;
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = ["nome_produto", "marca", "categoria", "unidade", "observacao", "status"];
  const example = ["Arroz Parboilizado", "Tio João", "Grãos", "kg", "Tipo 1", "ativo"];
  const categorias = CATEGORIAS_FIXAS.map((c) => [c]);
  const unidades = UNIDADES_MEDIDA.map((u) => [u]);

  const wsMain = XLSX.utils.aoa_to_sheet([headers, example]);
  wsMain["!cols"] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, wsMain, "Produtos");

  const wsRef = XLSX.utils.aoa_to_sheet([
    ["Categorias válidas"], ...categorias, [], ["Unidades válidas"], ...unidades, [],
    ["Status válidos"], ["ativo"], ["inativo"],
  ]);
  wsRef["!cols"] = [{ wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Referência");

  XLSX.writeFile(wb, "modelo-importacao-produtos.xlsx");
}

export function ImportProductsDialog({ open, onClose, onImported, units, defaultUnitId }: ImportProductsDialogProps) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "report">("upload");
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [existingProducts, setExistingProducts] = useState<{ nome: string; marca: string | null }[]>([]);
  const [existingBrands, setExistingBrands] = useState<string[]>([]);

  const reset = useCallback(() => {
    setStep("upload");
    setRawRows([]);
    setValidations([]);
    setImporting(false);
    setImportResult(null);
    setUnitId(defaultUnitId);
  }, [defaultUnitId]);

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast.error("Formato não suportado. Use .xlsx, .xls ou .csv.");
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      if (json.length === 0) { toast.error("Planilha vazia."); return; }

      const rows: ImportRow[] = json.map((r) => ({
        nome_produto: String(r["nome_produto"] ?? r["Nome"] ?? r["nome"] ?? "").trim(),
        marca: String(r["marca"] ?? r["Marca"] ?? "").trim(),
        categoria: String(r["categoria"] ?? r["Categoria"] ?? "").trim(),
        unidade: String(r["unidade"] ?? r["Unidade"] ?? r["unidade_medida"] ?? "").trim(),
        observacao: String(r["observacao"] ?? r["Observação"] ?? r["obs"] ?? "").trim() || undefined,
        status: String(r["status"] ?? r["Status"] ?? "ativo").trim().toLowerCase(),
      }));

      // Load existing products and brands for duplicate/warning checks
      const [{ data: prods }, { data: allProds }] = await Promise.all([
        supabase.from("products").select("nome, marca").eq("ativo", true),
        supabase.from("products").select("marca").not("marca", "is", null),
      ]);
      const existProds = (prods || []).map((p: any) => ({ nome: p.nome?.toLowerCase(), marca: (p.marca || "")?.toLowerCase() }));
      const brands = [...new Set((allProds || []).map((p: any) => p.marca?.toLowerCase()).filter(Boolean))] as string[];
      setExistingProducts(existProds);
      setExistingBrands(brands);

      // Validate
      const vals: RowValidation[] = rows.map((row, i) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        if (!row.nome_produto) errors.push("Nome obrigatório");
        if (!row.marca) errors.push("Marca obrigatória");
        if (!row.categoria) errors.push("Categoria obrigatória");
        else if (!CATEGORIAS_FIXAS.includes(row.categoria)) errors.push(`Categoria "${row.categoria}" inválida`);
        if (!row.unidade) errors.push("Unidade obrigatória");
        else if (!UNIDADES_MEDIDA.includes(row.unidade)) errors.push(`Unidade "${row.unidade}" inválida`);

        const isDuplicate = row.nome_produto && row.marca
          ? existProds.some((ep) => ep.nome === row.nome_produto.toLowerCase() && ep.marca === row.marca.toLowerCase())
          : false;
        if (isDuplicate) errors.push("Produto + marca já existe");

        // Check for duplicates within the file itself
        const fileIdx = rows.findIndex((r, j) => j < i && r.nome_produto.toLowerCase() === row.nome_produto.toLowerCase() && r.marca.toLowerCase() === row.marca.toLowerCase());
        if (fileIdx >= 0 && row.nome_produto && row.marca) errors.push(`Duplicado na linha ${fileIdx + 2}`);

        if (row.marca && !brands.includes(row.marca.toLowerCase())) warnings.push("Nova marca será criada");
        if (row.status && !["ativo", "inativo"].includes(row.status)) warnings.push(`Status "${row.status}" inválido, será tratado como ativo`);

        return { row: i + 2, data: row, errors, warnings, isDuplicate };
      });

      setRawRows(rows);
      setValidations(vals);
      setStep("preview");
    } catch {
      toast.error("Erro ao ler arquivo.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validRows = validations.filter((v) => v.errors.length === 0);
  const errorRows = validations.filter((v) => v.errors.length > 0);

  const doImport = async () => {
    if (validRows.length === 0) { toast.error("Nenhum produto válido para importar."); return; }
    setImporting(true);
    setStep("importing");

    const result: ImportResult = { imported: [], ignored: [], errors: [] };

    for (const v of validRows) {
      const row = v.data;
      try {
        const { data, error } = await supabase.rpc("rpc_create_product", {
          p_unidade_id: unitId,
          p_nome: row.nome_produto,
          p_unidade_medida: row.unidade || "kg",
        });
        if (error) { result.errors.push({ row: v.row, nome: row.nome_produto, reason: error.message }); continue; }

        const res = data as any;
        if (res?.already_existed) {
          result.ignored.push(`${row.nome_produto} (${row.marca})`);
          continue;
        }

        const productId = res?.id;
        if (productId) {
          const isAtivo = row.status !== "inativo";
          await supabase.from("products").update({
            categoria: row.categoria,
            marca: row.marca,
            ativo: isAtivo,
          }).eq("id", productId);
        }
        result.imported.push(`${row.nome_produto} (${row.marca})`);
      } catch {
        result.errors.push({ row: v.row, nome: row.nome_produto, reason: "Erro inesperado" });
      }
    }

    // Add error rows to result
    for (const v of errorRows) {
      result.ignored.push(`Linha ${v.row}: ${v.data.nome_produto || "—"} — ${v.errors[0]}`);
    }

    setImportResult(result);
    setImporting(false);
    setStep("report");

    if (result.imported.length > 0) {
      toast.success(`${result.imported.length} produto(s) importado(s)!`);
      onImported();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Produtos (Excel)
          </DialogTitle>
        </DialogHeader>

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-foreground font-medium">Selecione um arquivo Excel</p>
              <p className="text-sm text-muted-foreground">
                Colunas: nome_produto, marca, categoria, unidade, observacao, status
              </p>
            </div>

            <div>
              <Label className="text-sm">Unidade de destino *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="bg-input border-border w-64 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.type.toUpperCase()})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />Baixar Modelo
              </Button>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Escolher Arquivo
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {validRows.length} válidos
              </Badge>
              {errorRows.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {errorRows.length} com erro
                </Badge>
              )}
              {validations.some((v) => v.warnings.length > 0) && (
                <Badge variant="secondary" className="gap-1">
                  <Info className="h-3 w-3" /> {validations.filter((v) => v.warnings.length > 0).length} com aviso
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs w-10">#</TableHead>
                    <TableHead className="text-xs">Produto</TableHead>
                    <TableHead className="text-xs">Marca</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs">Unid.</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validations.map((v, i) => (
                    <TableRow key={i} className={v.errors.length > 0 ? "bg-destructive/5" : v.warnings.length > 0 ? "bg-accent/30" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{v.row}</TableCell>
                      <TableCell className="text-xs font-medium">{v.data.nome_produto || "—"}</TableCell>
                      <TableCell className="text-xs">{v.data.marca || "—"}</TableCell>
                      <TableCell className="text-xs">{v.data.categoria || "—"}</TableCell>
                      <TableCell className="text-xs">{v.data.unidade || "—"}</TableCell>
                      <TableCell className="text-xs">{v.data.status === "inativo" ? <Badge variant="secondary">Inativo</Badge> : <Badge variant="default">Ativo</Badge>}</TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {v.errors.length > 0 && (
                          <span className="text-destructive">{v.errors.join("; ")}</span>
                        )}
                        {v.errors.length === 0 && v.warnings.length > 0 && (
                          <span className="text-amber-500">{v.warnings.join("; ")}</span>
                        )}
                        {v.errors.length === 0 && v.warnings.length === 0 && (
                          <span className="text-primary">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
              <Button onClick={doImport} disabled={validRows.length === 0}>
                Importar {validRows.length} Produto(s)
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-foreground font-medium">Importando produtos...</p>
          </div>
        )}

        {/* Step: Report */}
        {step === "report" && importResult && (
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-medium">Importação concluída</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge variant="default">{importResult.imported.length} importados</Badge>
                  {importResult.ignored.length > 0 && <Badge variant="secondary">{importResult.ignored.length} ignorados</Badge>}
                  {importResult.errors.length > 0 && <Badge variant="destructive">{importResult.errors.length} erros</Badge>}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
              <div className="space-y-3 pr-3">
                {importResult.imported.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-primary mb-1">✓ Importados</p>
                    {importResult.imported.map((name, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{name}</p>
                    ))}
                  </div>
                )}
                {importResult.ignored.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">— Ignorados</p>
                    {importResult.ignored.map((name, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{name}</p>
                    ))}
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-destructive mb-1">✗ Erros</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive">Linha {e.row}: {e.nome} — {e.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end pt-2">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
