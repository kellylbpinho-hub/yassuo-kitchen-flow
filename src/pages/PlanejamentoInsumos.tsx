import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Calculator, ShoppingCart, Package, AlertTriangle, TrendingUp, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContextualLoader } from "@/components/ContextualLoader";
import { EmptyState } from "@/components/EmptyState";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ConsolidatedIngredient {
  productId: string;
  productName: string;
  unidadeMedida: string;
  totalNeeded: number;
  stockAvailable: number;
  deficit: number;
  custoUnitario: number;
  custoTotal: number;
  appearsInDays: number;
}

export default function PlanejamentoInsumos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [unitId, setUnitId] = useState<string>("");
  const [units, setUnits] = useState<{ id: string; name: string; numero_colaboradores: number; type: string }[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedIngredient[]>([]);
  const [menuCount, setMenuCount] = useState(0);
  const [dishCount, setDishCount] = useState(0);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    return `${format(weekStart, "dd/MM")} – ${format(end, "dd/MM/yyyy")}`;
  }, [weekStart]);

  // Load units on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("units").select("id, name, numero_colaboradores, type").order("name");
      const list = (data || []) as { id: string; name: string; numero_colaboradores: number; type: string }[];
      setUnits(list);
      const kitchens = list.filter(u => u.type === "kitchen");
      if (kitchens.length > 0 && !unitId) setUnitId(kitchens[0].id);
      else if (list.length > 0 && !unitId) setUnitId(list[0].id);
    })();
  }, []);

  const loadForecast = useCallback(async () => {
    if (!profile || !unitId) return;
    setLoading(true);

    try {
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

      // 1. Get menus for the week + unit
      const { data: menus } = await supabase
        .from("menus")
        .select("id, nome, data, unidade_id")
        .eq("unidade_id", unitId)
        .gte("data", startStr)
        .lte("data", endStr);

      const menuList = menus || [];
      const validMenus = menuList.filter(m => !["Folga", "Feriado", "Sem Produção"].includes(m.nome));
      setMenuCount(validMenus.length);

      if (validMenus.length === 0) {
        setConsolidated([]);
        setDishCount(0);
        setLoading(false);
        return;
      }

      const menuIds = validMenus.map(m => m.id);

      // 2. Get menu_dishes + recipe_ingredients in parallel
      const [mdRes, riRes, unitRes] = await Promise.all([
        supabase.from("menu_dishes").select("menu_id, dish_id").in("menu_id", menuIds),
        supabase.from("recipe_ingredients").select("menu_id, product_id, peso_limpo_per_capita, fator_correcao").in("menu_id", menuIds),
        supabase.from("units").select("numero_colaboradores").eq("id", unitId).single(),
      ]);

      const menuDishes = mdRes.data || [];
      const recipeIngredients = riRes.data || [];
      const numColab = unitRes.data?.numero_colaboradores || 0;

      setDishCount(menuDishes.length);

      if (recipeIngredients.length === 0) {
        setConsolidated([]);
        setLoading(false);
        return;
      }

      // 3. Get unique product ids
      const productIds = [...new Set(recipeIngredients.map(ri => ri.product_id))];

      // 4. Get products + stock
      const [prodRes, stockRes] = await Promise.all([
        supabase.from("products").select("id, nome, unidade_medida, custo_unitario").in("id", productIds),
        supabase.from("v_estoque_por_unidade").select("product_id, saldo").eq("unidade_id", unitId).in("product_id", productIds),
      ]);

      const products = prodRes.data || [];
      const stockData = stockRes.data || [];

      const productMap = new Map(products.map(p => [p.id, p]));
      const stockMap = new Map(stockData.map(s => [s.product_id, Number(s.saldo) || 0]));

      // 5. Consolidate: for each recipe_ingredient, need = peso_limpo_per_capita * fator_correcao * numColab
      const consolidated = new Map<string, ConsolidatedIngredient>();

      for (const ri of recipeIngredients) {
        const need = (Number(ri.peso_limpo_per_capita) || 0) * (Number(ri.fator_correcao) || 1) * numColab;
        const product = productMap.get(ri.product_id);
        if (!product) continue;

        const existing = consolidated.get(ri.product_id);
        if (existing) {
          existing.totalNeeded += need;
          existing.appearsInDays += 1;
        } else {
          consolidated.set(ri.product_id, {
            productId: ri.product_id,
            productName: product.nome,
            unidadeMedida: product.unidade_medida,
            totalNeeded: need,
            stockAvailable: stockMap.get(ri.product_id) || 0,
            deficit: 0,
            custoUnitario: Number(product.custo_unitario) || 0,
            custoTotal: 0,
            appearsInDays: 1,
          });
        }
      }

      // Calculate deficit and cost
      const result: ConsolidatedIngredient[] = [];
      consolidated.forEach(item => {
        item.deficit = Math.max(0, item.totalNeeded - item.stockAvailable);
        item.custoTotal = item.totalNeeded * item.custoUnitario;
        result.push(item);
      });

      result.sort((a, b) => b.deficit - a.deficit);
      setConsolidated(result);
    } finally {
      setLoading(false);
    }
  }, [profile, unitId, weekStart]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const selectedUnit = units.find(u => u.id === unitId);
  const totalCost = consolidated.reduce((s, i) => s + i.custoTotal, 0);
  const itemsWithDeficit = consolidated.filter(i => i.deficit > 0);
  const purchaseCost = itemsWithDeficit.reduce((s, i) => s + i.deficit * i.custoUnitario, 0);

  const handleGeneratePurchaseOrder = async () => {
    if (itemsWithDeficit.length === 0) {
      toast.info("Não há itens com déficit para gerar pedido de compra.");
      return;
    }
    if (!profile) return;

    try {
      // Find a CD unit for the purchase order
      const cdUnit = units.find(u => u.type === "cd");
      const targetUnitId = cdUnit?.id || unitId;

      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          unidade_id: targetUnitId,
          created_by: profile.user_id,
          company_id: profile.company_id,
          observacao: `Gerado automaticamente - Previsão ${weekLabel} - ${selectedUnit?.name || ""}`,
        })
        .select("id")
        .single();

      if (poErr || !po) throw poErr;

      const items = itemsWithDeficit.map(item => ({
        purchase_order_id: po.id,
        product_id: item.productId,
        quantidade: Math.ceil(item.deficit * 10) / 10,
        custo_unitario: item.custoUnitario,
        company_id: profile.company_id,
      }));

      const { error: itemsErr } = await supabase.from("purchase_items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success(`Pedido de compra criado com ${items.length} itens.`);
      navigate(`/compras/${po.id}`);
    } catch (err: any) {
      toast.error("Erro ao gerar pedido: " + (err?.message || ""));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Planejamento de Insumos</h1>
          <p className="text-sm text-muted-foreground">Previsão de compra baseada no cardápio planejado</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              {units.filter(u => u.type === "kitchen").map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[160px] text-center">{weekLabel}</span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoje
          </Button>
        </div>
      </div>

      {loading ? (
        <ContextualLoader message="Calculando previsão de insumos..." />
      ) : consolidated.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="Nenhum ingrediente encontrado"
          description={menuCount === 0
            ? "Não há cardápio planejado para esta semana nesta unidade."
            : "Os cardápios desta semana não possuem fichas técnicas com ingredientes cadastrados."}
          actionLabel="Ir para Cardápio"
          onAction={() => navigate("/cardapio-semanal")}
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<Calculator className="h-5 w-5" />} label="Dias com cardápio" value={menuCount} sub={`${dishCount} preparações`} />
            <KpiCard icon={<Package className="h-5 w-5" />} label="Ingredientes" value={consolidated.length} sub={`${selectedUnit?.numero_colaboradores || 0} refeições/dia`} />
            <KpiCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Itens em falta"
              value={itemsWithDeficit.length}
              sub={itemsWithDeficit.length > 0 ? "Necessitam compra" : "Estoque OK"}
              accent={itemsWithDeficit.length > 0 ? "destructive" : "default"}
            />
            <KpiCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Custo previsto"
              value={`R$ ${totalCost.toFixed(2)}`}
              sub={`Compra: R$ ${purchaseCost.toFixed(2)}`}
            />
          </div>

          {/* Action bar */}
          {itemsWithDeficit.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {itemsWithDeficit.length} {itemsWithDeficit.length === 1 ? "ingrediente" : "ingredientes"} com estoque insuficiente
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Custo estimado de compra: R$ {purchaseCost.toFixed(2)}
                    </p>
                  </div>
                </div>
                <Button size="sm" className="gap-1" onClick={handleGeneratePurchaseOrder}>
                  <ShoppingCart className="h-4 w-4" />
                  Gerar Pedido de Compra
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Consolidação de Insumos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-right">Necessidade</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Saldo / Falta</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-right">Custo Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidated.map((item) => {
                    const balance = item.stockAvailable - item.totalNeeded;
                    const hasDeficit = balance < 0;
                    return (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">{item.unidadeMedida}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{item.appearsInDays}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{item.totalNeeded.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm">{item.stockAvailable.toFixed(2)}</TableCell>
                        <TableCell className={`text-right text-sm font-semibold ${hasDeficit ? "text-destructive" : "text-primary"}`}>
                          {balance >= 0 ? `+${balance.toFixed(2)}` : balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-sm">R$ {item.custoUnitario.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm">R$ {item.custoTotal.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          {hasDeficit ? (
                            <Badge variant="destructive" className="text-[10px]">Falta</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent = "default" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "destructive";
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`rounded-lg p-2 ${accent === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
