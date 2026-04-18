import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calculator,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  FileText,
  Download,
  CheckCircle2,
  Beef,
  Apple,
  Wheat,
  Milk,
  Soup,
  GlassWater,
  Box,
  Sparkles,
  Layers,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { ContextualLoader } from "@/components/ContextualLoader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { generateInsumosPDF } from "@/lib/pdfExport";
import { exportInsumosExcel } from "@/lib/excelExport";
import { InsumosHeroKpi } from "@/components/insumos/InsumosHeroKpi";
import {
  InsumosCategoryCard,
  type InsumoItem,
} from "@/components/insumos/InsumosCategoryCard";
import { InsumosEmptyState } from "@/components/insumos/InsumosEmptyState";

interface ConsolidatedIngredient extends InsumoItem {
  categoria: string;
}

const CATEGORY_ORDER = [
  "Proteínas",
  "Hortifruti",
  "Grãos",
  "Laticínios",
  "Temperos",
  "Bebidas",
  "Descartáveis",
  "Limpeza",
  "Outros",
];

const CATEGORY_ICONS: Record<string, typeof Beef> = {
  Proteínas: Beef,
  Hortifruti: Apple,
  Grãos: Wheat,
  Laticínios: Milk,
  Temperos: Soup,
  Bebidas: GlassWater,
  Descartáveis: Box,
  Limpeza: Box,
  Outros: Layers,
};

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("units").select("id, name, numero_colaboradores, type").order("name");
      const list = (data || []) as typeof units;
      setUnits(list);
      const kitchens = list.filter((u) => u.type === "kitchen");
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

      const { data: menus } = await supabase
        .from("menus")
        .select("id, nome, data, unidade_id")
        .eq("unidade_id", unitId)
        .gte("data", startStr)
        .lte("data", endStr);

      const menuList = menus || [];
      const validMenus = menuList.filter((m) => !["Folga", "Feriado", "Sem Produção"].includes(m.nome));
      setMenuCount(validMenus.length);

      if (validMenus.length === 0) {
        setConsolidated([]);
        setDishCount(0);
        setLoading(false);
        return;
      }

      const menuIds = validMenus.map((m) => m.id);
      const [mdRes, unitRes] = await Promise.all([
        supabase.from("menu_dishes").select("menu_id, dish_id").in("menu_id", menuIds),
        supabase.from("units").select("numero_colaboradores").eq("id", unitId).single(),
      ]);

      const menuDishes = mdRes.data || [];
      const numColab = unitRes.data?.numero_colaboradores || 0;
      setDishCount(menuDishes.length);

      const dishIds = [...new Set(menuDishes.map((md) => md.dish_id).filter(Boolean))];
      if (dishIds.length === 0) {
        setConsolidated([]);
        setLoading(false);
        return;
      }

      const dishAppearances = new Map<string, number>();
      for (const md of menuDishes) {
        dishAppearances.set(md.dish_id, (dishAppearances.get(md.dish_id) || 0) + 1);
      }

      const { data: riData } = await supabase
        .from("recipe_ingredients")
        .select("dish_id, product_id, peso_limpo_per_capita, fator_correcao")
        .in("dish_id", dishIds);

      const recipeIngredients = riData || [];
      if (recipeIngredients.length === 0) {
        setConsolidated([]);
        setLoading(false);
        return;
      }

      const productIds = [...new Set(recipeIngredients.map((ri) => ri.product_id))];
      const [prodRes, stockRes] = await Promise.all([
        supabase.from("products").select("id, nome, unidade_medida, custo_unitario, categoria").in("id", productIds),
        supabase.from("v_estoque_por_unidade").select("product_id, saldo").eq("unidade_id", unitId).in("product_id", productIds),
      ]);

      const products = prodRes.data || [];
      const stockData = stockRes.data || [];
      const productMap = new Map(products.map((p) => [p.id, p]));
      const stockMap = new Map(stockData.map((s) => [s.product_id, Number(s.saldo) || 0]));

      const map = new Map<string, ConsolidatedIngredient>();
      for (const ri of recipeIngredients) {
        const dishId = (ri as any).dish_id as string;
        const daysUsed = dishAppearances.get(dishId) || 1;
        const needPerDay = (Number(ri.peso_limpo_per_capita) || 0) * (Number(ri.fator_correcao) || 1) * numColab;
        const totalNeed = needPerDay * daysUsed;
        const product = productMap.get(ri.product_id);
        if (!product) continue;

        const existing = map.get(ri.product_id);
        if (existing) {
          existing.totalNeeded += totalNeed;
          existing.appearsInDays = Math.max(existing.appearsInDays, daysUsed);
        } else {
          map.set(ri.product_id, {
            productId: ri.product_id,
            productName: product.nome,
            unidadeMedida: product.unidade_medida,
            categoria: product.categoria || "Outros",
            totalNeeded: totalNeed,
            stockAvailable: stockMap.get(ri.product_id) || 0,
            deficit: 0,
            custoUnitario: Number(product.custo_unitario) || 0,
            custoTotal: 0,
            appearsInDays: daysUsed,
          });
        }
      }

      const result: ConsolidatedIngredient[] = [];
      map.forEach((item) => {
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

  const selectedUnit = units.find((u) => u.id === unitId);
  const totalCost = consolidated.reduce((s, i) => s + i.custoTotal, 0);
  const itemsWithDeficit = consolidated.filter((i) => i.deficit > 0);
  const itemsAtencao = consolidated.filter((i) => {
    if (i.deficit > 0) return false;
    const ratio = i.totalNeeded > 0 ? i.stockAvailable / i.totalNeeded : 999;
    return ratio <= 1.2;
  });
  const itemsOk = consolidated.length - itemsWithDeficit.length - itemsAtencao.length;
  const purchaseCost = itemsWithDeficit.reduce((s, i) => s + i.deficit * i.custoUnitario, 0);
  const coverageRate = consolidated.length > 0
    ? Math.round((itemsOk / consolidated.length) * 100)
    : 0;

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, ConsolidatedIngredient[]>();
    for (const item of consolidated) {
      const cat = item.categoria;
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    }
    const sorted: [string, ConsolidatedIngredient[]][] = [];
    for (const cat of CATEGORY_ORDER) {
      if (groups.has(cat)) {
        sorted.push([cat, groups.get(cat)!]);
        groups.delete(cat);
      }
    }
    groups.forEach((items, cat) => sorted.push([cat, items]));
    return sorted;
  }, [consolidated]);

  const exportData = useMemo(
    () =>
      consolidated.map((i) => ({
        ingrediente: i.productName,
        unidade: i.unidadeMedida,
        categoria: i.categoria,
        necessario: i.totalNeeded,
        estoque: i.stockAvailable,
        falta: i.deficit,
        custoUnit: i.custoUnitario,
        custoTotal: i.custoTotal,
      })),
    [consolidated],
  );

  const handleGeneratePurchaseOrder = async () => {
    if (itemsWithDeficit.length === 0) {
      toast.info("Não há itens com déficit para gerar pedido de compra.");
      return;
    }
    if (!profile) return;
    try {
      const cdUnit = units.find((u) => u.type === "cd");
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

      const items = itemsWithDeficit.map((item) => ({
        purchase_order_id: po.id,
        product_id: item.productId,
        quantidade: Math.ceil(item.deficit * 10) / 10,
        custo_unitario: item.custoUnitario,
        company_id: profile.company_id,
      }));

      const { error: itemsErr } = await supabase.from("purchase_items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success(`Pedido de compra criado com ${items.length} itens.`);
      window.dispatchEvent(new CustomEvent("guided:purchase-from-forecast:success"));
      navigate(`/compras/${po.id}`);
    } catch (err: any) {
      toast.error("Erro ao gerar pedido: " + (err?.message || ""));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-surface-2 via-surface-1 to-surface-2 p-5 sm:p-7">
        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/3 translate-x-1/4 rounded-full bg-primary/[0.07] blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
              <Calculator className="h-3.5 w-3.5" />
              Previsão inteligente
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              Planejamento de Insumos
            </h1>
            <p className="text-sm text-muted-foreground">
              Consequência direta do cardápio.{" "}
              <span className="text-foreground/80">{weekLabel}</span>
              {selectedUnit && <> · {selectedUnit.name}</>}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger
                className="h-9 w-[170px] border-border/60 bg-surface-1 text-xs"
                data-guide="select-unit-insumos"
              >
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {units
                  .filter((u) => u.type === "kitchen")
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              data-guide="btn-prev-week"
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
              className="h-9 w-9 border-border/60 bg-surface-1"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="h-9 px-3 text-xs font-medium"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              className="h-9 w-9 border-border/60 bg-surface-1"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        {!loading && consolidated.length > 0 && (
          <div data-guide="kpi-insumos" className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <InsumosHeroKpi
              icon={Calculator}
              label="Dias planejados"
              value={menuCount}
              sub={`${dishCount} preparações`}
              tone="primary"
            />
            <InsumosHeroKpi
              icon={Package}
              label="Ingredientes"
              value={consolidated.length}
              sub={`${selectedUnit?.numero_colaboradores || 0} refeições/dia`}
              tone="accent"
            />
            <InsumosHeroKpi
              icon={CheckCircle2}
              label="Cobertos"
              value={`${itemsOk}/${consolidated.length}`}
              sub={`${coverageRate}% de cobertura`}
              tone="success"
            />
            <InsumosHeroKpi
              icon={AlertTriangle}
              label="Em falta"
              value={itemsWithDeficit.length}
              sub={purchaseCost > 0 ? `R$ ${purchaseCost.toFixed(2)} a comprar` : undefined}
              tone="destructive"
              pulse={itemsWithDeficit.length > 0}
            />
            <InsumosHeroKpi
              icon={TrendingUp}
              label="Custo total"
              value={`R$ ${totalCost.toFixed(0)}`}
              sub={itemsAtencao.length > 0 ? `${itemsAtencao.length} em atenção` : "Projeção da semana"}
              tone="warning"
            />
          </div>
        )}

        {/* Export actions */}
        {!loading && consolidated.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
              onClick={() => {
                exportInsumosExcel({
                  weekLabel,
                  unitName: selectedUnit?.name || "",
                  numColaboradores: selectedUnit?.numero_colaboradores || 0,
                  items: exportData,
                });
                toast.success("Excel exportado.");
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
              onClick={() => {
                generateInsumosPDF({
                  weekLabel,
                  unitName: selectedUnit?.name || "",
                  numColaboradores: selectedUnit?.numero_colaboradores || 0,
                  totalCost,
                  purchaseCost,
                  items: exportData,
                });
                toast.success("PDF exportado.");
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <ContextualLoader message="Calculando previsão de insumos..." />
      ) : consolidated.length === 0 ? (
        <InsumosEmptyState
          onGoToMenu={() => navigate("/cardapio-semanal")}
          variant={menuCount === 0 ? "no-menu" : "no-recipes"}
        />
      ) : (
        <>
          {/* Critical action bar */}
          {itemsWithDeficit.length > 0 && (
            <div
              data-guide="btn-gerar-compra"
              className="relative overflow-hidden rounded-xl border border-destructive/35 bg-gradient-to-r from-destructive/[0.08] via-destructive/[0.04] to-transparent"
            >
              <div className="absolute -right-10 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-destructive/15 blur-3xl" />
              <div className="relative flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 text-destructive">
                    <span className="absolute inset-0 animate-ping rounded-lg bg-destructive/20" />
                    <ShoppingCart className="relative h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {itemsWithDeficit.length}{" "}
                      {itemsWithDeficit.length === 1 ? "item crítico" : "itens críticos"} sem cobertura
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Custo estimado de compra:{" "}
                      <span className="font-semibold text-destructive">
                        R$ {purchaseCost.toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-10 gap-2 bg-primary px-4 font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)] hover:bg-primary/90"
                  onClick={handleGeneratePurchaseOrder}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Gerar pedido de compra
                </Button>
              </div>
            </div>
          )}

          {/* Healthy state when nothing is missing */}
          {itemsWithDeficit.length === 0 && itemsAtencao.length === 0 && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-200">
                    Estoque cobre toda a previsão
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nenhuma compra necessária para o cardápio desta semana.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Category cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cobertura por categoria
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {groupedByCategory.length}{" "}
                {groupedByCategory.length === 1 ? "categoria" : "categorias"}
              </span>
            </div>

            {groupedByCategory.map(([category, items]) => (
              <InsumosCategoryCard
                key={category}
                category={category}
                icon={CATEGORY_ICONS[category] || Layers}
                items={items}
                defaultOpen={items.some((i) => i.deficit > 0)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
