import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calculator, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RecipeIngredient {
  id: string;
  menu_id: string;
  product_id: string;
  peso_limpo_per_capita: number;
  fator_correcao: number;
}

interface Product { id: string; nome: string; unidade_medida: string; }

interface Props {
  menuId: string;
  unidadeId: string;
  companyId: string;
}

export function FichaTecnica({ menuId, unidadeId, companyId }: Props) {
  const { isFinanceiro } = useAuth();
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [numColaboradores, setNumColaboradores] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ product_id: "", peso_limpo_per_capita: "", fator_correcao: "1" });

  useEffect(() => { loadData(); }, [menuId]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: ri }, { data: prods }, { data: unit }] = await Promise.all([
      supabase.from("recipe_ingredients").select("*").eq("menu_id", menuId),
      supabase.from("products").select("id, nome, unidade_medida").eq("ativo", true),
      supabase.from("units").select("numero_colaboradores").eq("id", unidadeId).single(),
    ]);
    setIngredients((ri || []) as RecipeIngredient[]);
    setProducts((prods || []) as Product[]);
    setNumColaboradores(unit?.numero_colaboradores || 0);
    setLoading(false);
  };

  const addIngredient = async () => {
    if (!newForm.product_id || !newForm.peso_limpo_per_capita) {
      toast.error("Selecione produto e informe o peso per capita.");
      return;
    }
    const peso = Number(newForm.peso_limpo_per_capita);
    const fator = Number(newForm.fator_correcao) || 1;
    if (peso <= 0) { toast.error("Peso per capita deve ser maior que zero."); return; }
    if (fator < 1) { toast.error("Fator de correção deve ser ≥ 1."); return; }

    const existing = ingredients.find(i => i.product_id === newForm.product_id);
    if (existing) { toast.error("Produto já adicionado à ficha técnica."); return; }

    const { error } = await supabase.from("recipe_ingredients").insert({
      menu_id: menuId,
      product_id: newForm.product_id,
      peso_limpo_per_capita: peso,
      fator_correcao: fator,
      company_id: companyId,
    });

    if (error) { toast.error(error.message); return; }
    toast.success("Ingrediente adicionado!");
    setNewForm({ product_id: "", peso_limpo_per_capita: "", fator_correcao: "1" });
    setAdding(false);
    loadData();
  };

  const removeIngredient = async (id: string) => {
    const { error } = await supabase.from("recipe_ingredients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido."); loadData(); }
  };

  const getProductName = (id: string) => products.find(p => p.id === id)?.nome || "—";
  const getProductUnit = (id: string) => products.find(p => p.id === id)?.unidade_medida || "kg";

  const calcDemanda = (peso: number, fator: number) => peso * fator * numColaboradores;
  const totalDemanda = ingredients.reduce((sum, i) => sum + calcDemanda(i.peso_limpo_per_capita, i.fator_correcao), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Demand summary card */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Necessidade Total para esta Unidade</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{numColaboradores} colaboradores</span>
          </div>
          <div className="text-lg font-bold text-primary">
            {totalDemanda.toFixed(2)} kg
          </div>
        </div>
        {numColaboradores === 0 && (
          <p className="text-xs text-warning mt-1">⚠ Configure o número de colaboradores na tela de Unidades.</p>
        )}
      </div>

      {/* Ingredients table */}
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Produto</TableHead>
            <TableHead className="text-right">Per Capita (g)</TableHead>
            <TableHead className="text-right">Fator Correção</TableHead>
            <TableHead className="text-right">Demanda Total</TableHead>
            {!isFinanceiro && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.length === 0 && !adding ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                Nenhum ingrediente na ficha técnica.
              </TableCell>
            </TableRow>
          ) : (
            ingredients.map((i) => (
              <TableRow key={i.id} className="border-border">
                <TableCell className="font-medium">{getProductName(i.product_id)}</TableCell>
                <TableCell className="text-right">{(i.peso_limpo_per_capita * 1000).toFixed(0)}g</TableCell>
                <TableCell className="text-right">{i.fator_correcao.toFixed(2)}</TableCell>
                <TableCell className="text-right font-semibold">
                  {calcDemanda(i.peso_limpo_per_capita, i.fator_correcao).toFixed(2)} {getProductUnit(i.product_id)}
                </TableCell>
                {!isFinanceiro && (
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => removeIngredient(i.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Add ingredient form */}
      {!isFinanceiro && (
        <>
          {adding ? (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-xs">Produto</Label>
                <Select value={newForm.product_id} onValueChange={(v) => setNewForm({ ...newForm, product_id: v })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {products
                      .filter(p => !ingredients.find(i => i.product_id === p.id))
                      .map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Peso Limpo Per Capita (kg)</Label>
                  <Input
                    type="number" step="0.001" min="0" placeholder="Ex: 0.120"
                    value={newForm.peso_limpo_per_capita}
                    onChange={(e) => setNewForm({ ...newForm, peso_limpo_per_capita: e.target.value })}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fator de Correção</Label>
                  <Input
                    type="number" step="0.01" min="1" placeholder="Ex: 1.15"
                    value={newForm.fator_correcao}
                    onChange={(e) => setNewForm({ ...newForm, fator_correcao: e.target.value })}
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addIngredient}>Adicionar</Button>
                <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar Ingrediente
            </Button>
          )}
        </>
      )}
    </div>
  );
}
