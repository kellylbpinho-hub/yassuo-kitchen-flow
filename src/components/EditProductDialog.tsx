import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];

interface EditProductDialogProps {
  product: { id: string; nome: string; marca?: string | null; ativo?: boolean; codigo_barras?: string | null; categoria?: string | null } | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProductDialog({ product, open, onClose, onSaved }: EditProductDialogProps) {
  const [nome, setNome] = useState("");
  const [marca, setMarca] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [categoria, setCategoria] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setNome(product.nome ?? "");
    setMarca((product as any).marca ?? "");
    setAtivo(product.ativo ?? true);
    setCategoria(product.categoria ?? "");
  }, [product?.id]);

  const handleSave = async () => {
    if (!product) return;
    if (!nome.trim()) {
      toast.error("Nome do produto é obrigatório.");
      return;
    }
    if (!marca.trim()) {
      toast.error("Marca é obrigatória.");
      return;
    }
    if (!categoria) {
      toast.error("Categoria é obrigatória.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ nome: nome.trim(), marca: marca.trim() || null, ativo, categoria: categoria || null })
      .eq("id", product.id);

    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(ativo ? "Produto atualizado!" : "Produto desativado!");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Editar Produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {product?.codigo_barras && (
            <div>
              <Label>Código de barras</Label>
              <div className="mt-1">
                <Badge variant="secondary">{product.codigo_barras}</Badge>
                <span className="text-xs text-muted-foreground ml-2">(somente leitura)</span>
              </div>
            </div>
          )}
          <div>
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="bg-input border-border"
              autoFocus
            />
          </div>
          <div>
            <Label>Marca *</Label>
            <Input
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="bg-input border-border"
              placeholder="Ex: Nestlé, Sadia..."
            />
          </div>
          <div>
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_FIXAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Produto ativo</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
          {!ativo && (
            <p className="text-xs text-destructive">
              Produto inativo não aparecerá nas listagens, scanner ou pedidos.
            </p>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
