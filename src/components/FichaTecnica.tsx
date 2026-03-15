import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calculator, Users, Loader2, ShoppingCart, Printer, FileText, Save, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { fuzzyMatch } from "@/lib/fuzzySearch";
import { generateRequisicaoInternaPDF, generateFichaTecnicaPDF } from "@/lib/pdfExport";
import { EmptyState } from "@/components/EmptyState";
import { ContextualLoader } from "@/components/ContextualLoader";

interface RecipeIngredient {
  id: string;
  menu_id: string;
  dish_id: string | null;
  product_id: string;
  peso_limpo_per_capita: number;
  fator_correcao: number;
}

interface Product { id: string; nome: string; unidade_medida: string; custo_unitario: number | null; }

interface DishExtra {
  modo_preparo: string | null;
  tempo_preparo: string | null;
  equipamento: string | null;
  peso_porcao: number | null;
}

interface Props {
  menuId: string;
  unidadeId: string;
  companyId: string;
  dishName?: string;
  dishCategory?: string;
  dishDescricao?: string;
  dishId?: string;
}

export function FichaTecnica({ menuId, unidadeId, companyId, dishName, dishCategory, dishDescricao, dishId }: Props) {
  const { isFinanceiro, user, profile } = useAuth();
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [numColaboradores, setNumColaboradores] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [newForm, setNewForm] = useState({ product_id: "", peso_limpo_per_capita: "", fator_correcao: "1" });
  const [ingredientSearch, setIngredientSearch] = useState("");

  // Dish extra fields
  const [dishExtra, setDishExtra] = useState<DishExtra>({ modo_preparo: null, tempo_preparo: null, equipamento: null, peso_porcao: null });
  const [savingExtra, setSavingExtra] = useState(false);

  useEffect(() => { loadData(); }, [menuId, dishId]);

  const loadData = async () => {
    setLoading(true);

    // Query by dish_id if available, otherwise fall back to menu_id
    const riQuery = dishId
      ? supabase.from("recipe_ingredients").select("*").eq("dish_id", dishId)
      : supabase.from("recipe_ingredients").select("*").eq("menu_id", menuId);

    const [riRes, prodsRes, unitRes] = await Promise.all([
      riQuery,
      supabase.from("products").select("id, nome, unidade_medida, custo_unitario").eq("ativo", true),
      supabase.from("units").select("numero_colaboradores").eq("id", unidadeId).single(),
    ]);

    setIngredients((riRes.data || []) as RecipeIngredient[]);
    setProducts((prodsRes.data || []) as Product[]);
    setNumColaboradores(unitRes.data?.numero_colaboradores || 0);

    if (dishId) {
      const { data: dishData } = await supabase.from("dishes").select("*").eq("id", dishId).single();
      if (dishData) {
        const d = dishData as any;
        setDishExtra({
          modo_preparo: d.modo_preparo || null,
          tempo_preparo: d.tempo_preparo || null,
          equipamento: d.equipamento || null,
          peso_porcao: d.peso_porcao || null,
        });
      }
    }
    setLoading(false);
  };

  const saveDishExtra = async () => {
    if (!dishId) return;
    setSavingExtra(true);
    const { error } = await supabase.from("dishes").update({
      modo_preparo: dishExtra.modo_preparo || null,
      tempo_preparo: dishExtra.tempo_preparo || null,
      equipamento: dishExtra.equipamento || null,
      peso_porcao: dishExtra.peso_porcao,
    } as any).eq("id", dishId);
    if (error) toast.error(error.message);
    else toast.success("Informações da preparação salvas!");
    setSavingExtra(false);
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
      dish_id: dishId || null,
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
  const getProductCost = (id: string) => products.find(p => p.id === id)?.custo_unitario ?? null;

  const calcDemanda = (peso: number, fator: number) => peso * fator * numColaboradores;
  const totalDemanda = ingredients.reduce((sum, i) => sum + calcDemanda(i.peso_limpo_per_capita, i.fator_correcao), 0);

  const custoTotal = ingredients.reduce((sum, i) => {
    const custo = getProductCost(i.product_id);
    if (custo == null) return sum;
    return sum + custo * calcDemanda(i.peso_limpo_per_capita, i.fator_correcao);
  }, 0);
  const custoPorcao = numColaboradores > 0 ? custoTotal / numColaboradores : 0;

  const handleExportPDF = () => {
    setExportingPdf(true);
    try {
      generateFichaTecnicaPDF({
        dishName: dishName || "Ficha Técnica",
        category: dishCategory || "Geral",
        rendimentoKg: totalDemanda,
        numPorcoes: numColaboradores,
        modoPreparo: dishExtra.modo_preparo || undefined,
        observacoes: dishDescricao || undefined,
        tempoPreparo: dishExtra.tempo_preparo || undefined,
        equipamento: dishExtra.equipamento || undefined,
        pesoPorcao: dishExtra.peso_porcao || undefined,
        ingredients: ingredients.map((i) => {
          const prod = products.find(p => p.id === i.product_id);
          const demand = calcDemanda(i.peso_limpo_per_capita, i.fator_correcao);
          const custo = prod?.custo_unitario ?? null;
          return {
            produto: prod?.nome || "—",
            quantidade: demand,
            unidade: prod?.unidade_medida || "kg",
            custoUnitario: custo,
            custoTotal: custo != null ? custo * demand : null,
          };
        }),
      });
      toast.success("Ficha técnica PDF gerada!");
    } finally {
      setExportingPdf(false);
    }
  };

  const generatePurchaseOrder = async () => {
    if (ingredients.length === 0) {
      toast.error("Nenhum ingrediente na ficha técnica.");
      return;
    }
    if (numColaboradores === 0) {
      toast.error("Configure o número de colaboradores na unidade antes de gerar a necessidade.");
      return;
    }

    setGenerating(true);
    try {
      const { data: stockData } = await supabase
        .from("v_estoque_por_unidade")
        .select("product_id, saldo")
        .eq("unidade_id", unidadeId)
        .in("product_id", ingredients.map(i => i.product_id));

      const stockMap = new Map<string, number>();
      (stockData || []).forEach((s: any) => stockMap.set(s.product_id, s.saldo || 0));

      const shortfalls: { product_id: string; quantidade: number }[] = [];
      for (const ing of ingredients) {
        const demand = calcDemanda(ing.peso_limpo_per_capita, ing.fator_correcao);
        const stock = stockMap.get(ing.product_id) || 0;
        const deficit = demand - stock;
        if (deficit > 0) {
          shortfalls.push({ product_id: ing.product_id, quantidade: Math.ceil(deficit * 100) / 100 });
        }
      }

      if (shortfalls.length === 0) {
        toast.success("Estoque suficiente! Não é necessário gerar pedido de compra.");
        setGenerating(false);
        return;
      }

      const { data: order, error: orderError } = await supabase
        .from("purchase_orders")
        .insert({
          status: "rascunho",
          unidade_id: unidadeId,
          created_by: user!.id,
          company_id: companyId,
          observacao: `Gerado automaticamente a partir da ficha técnica`,
        })
        .select("id")
        .single();

      if (orderError) {
        toast.error("Erro ao criar pedido: " + orderError.message);
        setGenerating(false);
        return;
      }

      const items = shortfalls.map(s => ({
        purchase_order_id: order.id,
        product_id: s.product_id,
        quantidade: s.quantidade,
        company_id: companyId,
      }));

      const { error: itemsError } = await supabase.from("purchase_items").insert(items);
      if (itemsError) {
        toast.error("Erro ao adicionar itens: " + itemsError.message);
        setGenerating(false);
        return;
      }

      toast.success(`Pedido de compra criado com ${shortfalls.length} itens em falta!`);
      navigate(`/compras/${order.id}`);
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    }
    setGenerating(false);
  };

  const availableProducts = products
    .filter(p => !ingredients.find(i => i.product_id === p.id))
    .filter(p => fuzzyMatch(p.nome, ingredientSearch));

  if (loading) {
    return <ContextualLoader message="Carregando ficha técnica..." />;
  }

  return (
    <div className="space-y-4">
      {/* Production info (if dishId available) */}
      {dishId && !isFinanceiro && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Informações de Produção</span>
            </div>
            <Button size="sm" variant="outline" onClick={saveDishExtra} disabled={savingExtra} className="gap-1.5">
              {savingExtra ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Tempo de Preparo</Label>
              <Input
                placeholder="Ex: 45 min"
                value={dishExtra.tempo_preparo || ""}
                onChange={(e) => setDishExtra({ ...dishExtra, tempo_preparo: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label className="text-xs">Peso por Porção (kg)</Label>
              <Input
                type="number" step="0.001" min="0" placeholder="Ex: 0.350"
                value={dishExtra.peso_porcao ?? ""}
                onChange={(e) => setDishExtra({ ...dishExtra, peso_porcao: e.target.value ? Number(e.target.value) : null })}
                className="bg-input border-border"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Equipamento</Label>
              <Input
                placeholder="Ex: Forno combinado, Caldeirão"
                value={dishExtra.equipamento || ""}
                onChange={(e) => setDishExtra({ ...dishExtra, equipamento: e.target.value })}
                className="bg-input border-border"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Modo de Preparo</Label>
            <Textarea
              placeholder="Descreva o passo a passo da preparação..."
              value={dishExtra.modo_preparo || ""}
              onChange={(e) => setDishExtra({ ...dishExtra, modo_preparo: e.target.value })}
              rows={4}
              className="bg-input border-border"
            />
          </div>
        </div>
      )}

      {/* Demand + cost summary card */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Necessidade e Custo</span>
          </div>
          {!isFinanceiro && ingredients.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="gap-1.5"
              >
                {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Ficha Técnica PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  generateRequisicaoInternaPDF({
                    menuName: dishName || "Ficha Técnica",
                    unitName: `Unidade`,
                    numColaboradores: numColaboradores,
                    date: new Date().toLocaleDateString("pt-BR"),
                    items: ingredients.map((i) => ({
                      produto: getProductName(i.product_id),
                      quantidade: calcDemanda(i.peso_limpo_per_capita, i.fator_correcao),
                      unidade: getProductUnit(i.product_id),
                    })),
                  });
                  toast.success("Requisição interna gerada!");
                }}
                className="gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir Requisição
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={generatePurchaseOrder}
                disabled={generating}
                className="gap-1.5"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                Gerar Necessidade de Compra
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{numColaboradores} colaboradores</span>
          </div>
          <div className="text-lg font-bold text-primary">
            {totalDemanda.toFixed(2)} kg
          </div>
          {custoTotal > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="text-sm font-semibold text-foreground">
                Total: R$ {custoTotal.toFixed(2)}
              </div>
              <div className="text-sm text-muted-foreground">
                Porção: R$ {custoPorcao.toFixed(2)}
              </div>
            </>
          )}
        </div>
        {numColaboradores === 0 && (
          <p className="text-xs text-warning mt-1">⚠ Configure o número de colaboradores na tela de Unidades.</p>
        )}
      </div>

      {/* Ingredients table */}
      {ingredients.length === 0 && !adding ? (
        <EmptyState
          icon={Plus}
          title="Nenhum ingrediente cadastrado"
          description="Adicione ingredientes à ficha técnica para calcular custos e demanda automaticamente."
          actionLabel={!isFinanceiro ? "Adicionar Ingrediente" : undefined}
          onAction={!isFinanceiro ? () => setAdding(true) : undefined}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Per Capita (g)</TableHead>
              <TableHead className="text-right">Fator Correção</TableHead>
              <TableHead className="text-right">Demanda Total</TableHead>
              <TableHead className="text-right">Custo Unit.</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              {!isFinanceiro && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredients.map((i) => {
              const cost = getProductCost(i.product_id);
              const demand = calcDemanda(i.peso_limpo_per_capita, i.fator_correcao);
              return (
                <TableRow key={i.id} className="border-border">
                  <TableCell className="font-medium">{getProductName(i.product_id)}</TableCell>
                  <TableCell className="text-right">{(i.peso_limpo_per_capita * 1000).toFixed(0)}g</TableCell>
                  <TableCell className="text-right">{i.fator_correcao.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {demand.toFixed(2)} {getProductUnit(i.product_id)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {cost != null ? `R$ ${cost.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {cost != null ? `R$ ${(cost * demand).toFixed(2)}` : "—"}
                  </TableCell>
                  {!isFinanceiro && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeIngredient(i.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Add ingredient form */}
      {!isFinanceiro && (
        <>
          {adding ? (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
              <div>
                <Label className="text-xs">Buscar Produto</Label>
                <Input
                  placeholder="Digite para buscar (ex: limao)..."
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  className="bg-input border-border mb-2"
                />
                <Label className="text-xs">Produto</Label>
                <Select value={newForm.product_id} onValueChange={(v) => setNewForm({ ...newForm, product_id: v })}>
                  <SelectTrigger className="bg-input border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
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
                <Button size="sm" variant="outline" onClick={() => { setAdding(false); setIngredientSearch(""); }}>Cancelar</Button>
              </div>
            </div>
          ) : (
            ingredients.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Adicionar Ingrediente
              </Button>
            )
          )}
        </>
      )}
    </div>
  );
}
