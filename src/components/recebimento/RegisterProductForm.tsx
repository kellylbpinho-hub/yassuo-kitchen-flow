import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Product, Unit } from "./types";

const CATEGORIAS_FIXAS = ["Grãos", "Proteínas", "Laticínios", "Hortifruti", "Bebidas", "Descartáveis", "Limpeza", "Temperos", "Outros"];

interface RegisterProductFormProps {
  barcode: string;
  units: Unit[];
  defaultUnitId: string;
  onProductRegistered: (product: Product) => void;
  onBack: () => void;
}

export function RegisterProductForm({ barcode, units, defaultUnitId, onProductRegistered, onBack }: RegisterProductFormProps) {
  const [newName, setNewName] = useState("");
  const [newMarca, setNewMarca] = useState("");
  const [newUnidadeMedida, setNewUnidadeMedida] = useState("kg");
  const [newUnit, setNewUnit] = useState(defaultUnitId);
  const [newCategoria, setNewCategoria] = useState("");
  const [loading, setLoading] = useState(false);

  // Only show CD units for consistency with receiving
  const cdUnits = units.filter((u) => u.type === "cd");

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newName.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!newUnit) {
      toast.error("Selecione a unidade.");
      return;
    }
    if (!newCategoria) {
      toast.error("Selecione a categoria.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("rpc_create_product", {
      p_unidade_id: newUnit,
      p_nome: newName.trim(),
      p_unidade_medida: newUnidadeMedida,
      p_codigo_barras: barcode || null,
    });

    if (error) {
      toast.error("Erro ao cadastrar: " + error.message);
      setLoading(false);
      return;
    }
    const result = data as any;
    if (result?.id && !result?.already_existed) {
      const updateData: any = { categoria: newCategoria };
      if (newMarca.trim()) updateData.marca = newMarca.trim();
      await supabase.from("products").update(updateData).eq("id", result.id);
    }
    const newProduct: Product = {
      ...(result as Product),
      categoria: newCategoria,
      marca: newMarca.trim() || null,
    };
    setLoading(false);
    if (result.already_existed) {
      toast.info("Produto já existente encontrado. Prossiga com o recebimento.");
    } else {
      toast.success("Produto cadastrado!");
    }
    onProductRegistered(newProduct);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 max-w-md space-y-4">
      <h2 className="font-display font-bold text-foreground">Cadastrar Produto</h2>
      {barcode && (
        <p className="text-xs text-muted-foreground">
          Código: <Badge variant="secondary">{barcode}</Badge>
        </p>
      )}
      <div className="space-y-3">
        {barcode && (
          <div>
            <Label>Código de barras</Label>
            <Input value={barcode} readOnly className="bg-muted" />
          </div>
        )}
        <div>
          <Label>Nome do produto *</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
        </div>
        <div>
          <Label>Marca</Label>
          <Input value={newMarca} onChange={(e) => setNewMarca(e.target.value)} placeholder="Ex: Friboi, Sadia..." />
        </div>
        <div>
          <Label>Unidade de medida</Label>
          <Select value={newUnidadeMedida} onValueChange={setNewUnidadeMedida}>
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="g">g</SelectItem>
              <SelectItem value="L">L</SelectItem>
              <SelectItem value="ml">ml</SelectItem>
              <SelectItem value="un">un</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Categoria *</Label>
          <Select value={newCategoria} onValueChange={setNewCategoria}>
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
        <div>
          <Label>Unidade (CD) *</Label>
          <Select value={newUnit} onValueChange={setNewUnit}>
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
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Cadastrar e continuar
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>Voltar</Button>
      </div>
    </form>
  );
}
