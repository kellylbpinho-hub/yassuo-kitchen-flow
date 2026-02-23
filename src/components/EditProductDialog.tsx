import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditProductDialogProps {
  product: { id: string; nome: string; ativo?: boolean; codigo_barras?: string | null } | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditProductDialog({ product, open, onClose, onSaved }: EditProductDialogProps) {
  const [nome, setNome] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!product) return;
    setNome(product.nome ?? "");
    setAtivo(product.ativo ?? true);
  }, [product?.id]);

  const handleSave = async () => {
    if (!product) return;
    if (!nome.trim()) {
      toast.error("Nome do produto é obrigatório.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ nome: nome.trim(), ativo })
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
