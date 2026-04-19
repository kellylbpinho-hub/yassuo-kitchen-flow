import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, PackagePlus, Info } from "lucide-react";
import { toast } from "sonner";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";

interface ProductOption {
  id: string;
  nome: string;
  marca: string | null;
  unidade_medida: string;
  unidade_id: string;
}

interface UnitOption {
  id: string;
  name: string;
  type: string;
}

interface FornecedorOption {
  id: string;
  nome: string;
}

interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductOption[];
  units: UnitOption[];
  defaultUnitId?: string;
  onSuccess: () => void;
}

export function ManualEntryDialog({
  open,
  onOpenChange,
  products,
  units,
  defaultUnitId,
  onSuccess,
}: ManualEntryDialogProps) {
  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("");
  const [validade, setValidade] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fornecedorId, setFornecedorId] = useState<string>("none");
  const [fornecedores, setFornecedores] = useState<FornecedorOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Default to CD unit if available, else profile unit
  const cdUnit = useMemo(() => units.find((u) => u.type === "cd"), [units]);

  useEffect(() => {
    if (open) {
      setUnitId(defaultUnitId || cdUnit?.id || units[0]?.id || "");
      // Load fornecedores once
      supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome")
        .then(({ data }) => setFornecedores((data || []) as FornecedorOption[]));
    } else {
      // Reset on close
      setSearch("");
      setProductId("");
      setQuantidade("");
      setValidade("");
      setCodigo("");
      setFornecedorId("none");
    }
  }, [open, defaultUnitId, cdUnit, units]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50);
    return products.filter((p) => fuzzyMatchProduct(p as any, search)).slice(0, 50);
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === productId);

  const handleSubmit = async () => {
    if (!productId) {
      toast.error("Selecione um produto.");
      return;
    }
    if (!unitId) {
      toast.error("Selecione a unidade de destino.");
      return;
    }
    const qty = Number(quantidade.replace(",", "."));
    if (!qty || qty <= 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    if (!validade) {
      toast.error("Informe a data de validade.");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("rpc_create_manual_lote", {
      p_product_id: productId,
      p_unidade_id: unitId,
      p_quantidade: qty,
      p_validade: validade,
      p_lote_codigo: codigo.trim() || null,
      p_fornecedor_id: fornecedorId !== "none" ? fornecedorId : null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Erro ao registrar entrada: " + error.message);
      return;
    }

    const result = data as any;
    toast.success(`Lote ${result?.lote_codigo || ""} criado com sucesso.`);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <div className="rounded-md bg-primary/15 ring-1 ring-primary/30 p-1.5">
              <PackagePlus className="h-4 w-4 text-primary" />
            </div>
            Entrada manual de lote
          </DialogTitle>
          <DialogDescription className="text-xs">
            Atalho para popular estoque inicial. Para recebimentos reais, use o Recebimento Digital.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product search */}
          <div className="space-y-1.5">
            <Label className="text-xs">Produto *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto por nome ou marca..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-input border-border h-9"
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-background/40 divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  Nenhum produto encontrado.
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProductId(p.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors ${
                      productId === p.id ? "bg-primary/10 ring-1 ring-primary/30" : ""
                    }`}
                  >
                    <div className="font-medium text-foreground truncate">{p.nome}</div>
                    <div className="text-muted-foreground flex gap-2">
                      {p.marca && <span>{p.marca}</span>}
                      <span className="font-mono">{p.unidade_medida}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
            {selectedProduct && (
              <Badge variant="secondary" className="text-[10px]">
                Selecionado: {selectedProduct.nome}
              </Badge>
            )}
          </div>

          {/* Unit + quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade destino *</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="bg-input border-border h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Quantidade * {selectedProduct && <span className="text-muted-foreground">({selectedProduct.unidade_medida})</span>}
              </Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="bg-input border-border h-9"
                placeholder="0,000"
              />
            </div>
          </div>

          {/* Validade + Codigo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Validade *</Label>
              <Input
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="bg-input border-border h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código do lote</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="bg-input border-border h-9 font-mono"
                placeholder="Auto se vazio"
              />
            </div>
          </div>

          {/* Fornecedor */}
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor (opcional)</Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger className="bg-input border-border h-9">
                <SelectValue placeholder="Sem fornecedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem fornecedor —</SelectItem>
                {fornecedores.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 rounded-md bg-muted/30 ring-1 ring-border p-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O lote será marcado como <span className="font-mono text-foreground">entrada_manual</span> para rastreabilidade
              e entrará na fila FEFO normalmente.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !productId}
              className="flex-1"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PackagePlus className="h-4 w-4 mr-1.5" />
                  Criar lote
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
