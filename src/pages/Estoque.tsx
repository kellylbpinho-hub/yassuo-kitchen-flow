import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  ShoppingCart,
  Package,
  Boxes,
  CalendarClock,
  PackageX,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { fuzzyMatchProduct } from "@/lib/fuzzySearch";
import { ProductDetailDrawer } from "@/components/ProductDetailDrawer";
import { EditProductDialog } from "@/components/EditProductDialog";
import { exportEstoqueExcel } from "@/lib/excelExport";
import { ImportProductsDialog } from "@/components/ImportProductsDialog";
import { EstoqueHeroKpi } from "@/components/estoque/EstoqueHeroKpi";
import { EstoqueItemRow, type EstoqueItemLote } from "@/components/estoque/EstoqueItemRow";
import { EstoqueEmptyState } from "@/components/estoque/EstoqueEmptyState";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  nome: string;
  marca: string | null;
  categoria: string | null;
  category_id: string | null;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  validade: string | null;
  unidade_id: string;
  product_categories?: { name: string } | null;
}

interface Unit {
  id: string;
  name: string;
  type: string;
}

interface StockByUnit {
  product_id: string;
  unidade_id: string;
  saldo: number;
}

interface MovementRow {
  product_id: string;
  quantidade: number;
  created_at: string;
  tipo: string;
}

interface LoteRow {
  id: string;
  product_id: string;
  unidade_id: string;
  codigo: string | null;
  quantidade: number;
  validade: string;
  status: string;
}

const CATEGORIAS_FIXAS = [
  "Grãos",
  "Proteínas",
  "Laticínios",
  "Hortifruti",
  "Bebidas",
  "Descartáveis",
  "Limpeza",
  "Temperos",
  "Outros",
];

export default function Estoque() {
  const { canSeeCosts, profile, isFinanceiro, isNutricionista } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stockByUnit, setStockByUnit] = useState<StockByUnit[]>([]);
  const [consumptionMovements, setConsumptionMovements] = useState<MovementRow[]>([]);
  const [lotes, setLotes] = useState<LoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [movOpen, setMovOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    nome: "",
    marca: "",
    categoria: "",
    unidade_medida: "kg",
    estoque_minimo: "0",
    unidade_id: "",
  });

  const [movForm, setMovForm] = useState({ tipo: "saida", quantidade: "", motivo: "" });

  const canManage = !isFinanceiro && !isNutricionista;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString();

    const [{ data: prods }, { data: u }, { data: cats }, { data: sbu }, { data: mvs }, { data: lts }] =
      await Promise.all([
        supabase.from("products").select("*, product_categories(name)").eq("ativo", true).order("nome"),
        supabase.from("units").select("id, name, type"),
        supabase.from("product_categories").select("id, name").order("name"),
        supabase.from("v_estoque_por_unidade").select("product_id, unidade_id, saldo"),
        supabase
          .from("movements")
          .select("product_id, quantidade, created_at, tipo")
          .in("tipo", ["consumo", "saida", "perda"])
          .gte("created_at", thirtyDaysAgoISO),
        supabase
          .from("lotes")
          .select("id, product_id, unidade_id, codigo, quantidade, validade, status")
          .eq("status", "ativo")
          .gt("quantidade", 0)
          .order("validade", { ascending: true }),
      ]);
    setProducts((prods || []) as Product[]);
    setUnits((u || []) as Unit[]);
    setCategories((cats || []) as Category[]);
    setStockByUnit((sbu || []) as StockByUnit[]);
    setConsumptionMovements((mvs || []) as MovementRow[]);
    setLotes((lts || []) as LoteRow[]);
    if (u && u.length > 0 && !form.unidade_id) {
      setForm((f) => ({ ...f, unidade_id: profile?.unidade_id || u[0].id }));
    }
    setLoading(false);
  };

  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";
  const getCategoryName = (p: Product) => p.product_categories?.name || p.categoria || "—";

  const getSaldoForProduct = (productId: string): number => {
    if (filterUnit !== "all") {
      return stockByUnit.find((s) => s.product_id === productId && s.unidade_id === filterUnit)?.saldo ?? 0;
    }
    return stockByUnit
      .filter((s) => s.product_id === productId)
      .reduce((acc, s) => acc + (Number(s.saldo) || 0), 0);
  };

  const getLotesForProduct = (productId: string): EstoqueItemLote[] => {
    return lotes
      .filter((l) => l.product_id === productId && (filterUnit === "all" || l.unidade_id === filterUnit))
      .map((l) => ({
        id: l.id,
        codigo: l.codigo,
        quantidade: Number(l.quantidade),
        validade: l.validade,
      }));
  };

  const addProduct = async () => {
    if (!form.nome || !form.unidade_id) {
      toast.error("Preencha nome e unidade.");
      return;
    }
    if (!form.marca.trim()) {
      toast.error("Marca é obrigatória.");
      return;
    }
    if (!form.categoria) {
      toast.error("Selecione uma categoria.");
      return;
    }
    const { data, error } = await supabase.rpc("rpc_create_product", {
      p_unidade_id: form.unidade_id,
      p_nome: form.nome,
      p_unidade_medida: form.unidade_medida,
    });
    if (error) {
      toast.error("Erro ao adicionar produto: " + error.message);
    } else {
      const result = data as any;
      const productId = result?.id;
      if (productId && !result?.already_existed) {
        const updateData: any = { categoria: form.categoria };
        if (form.marca.trim()) updateData.marca = form.marca.trim();
        await supabase.from("products").update(updateData).eq("id", productId);
      }
      toast.success("Produto adicionado!");
      setAddOpen(false);
      setForm({
        nome: "",
        marca: "",
        categoria: "",
        unidade_medida: "kg",
        estoque_minimo: "0",
        unidade_id: form.unidade_id,
      });
      loadData();
    }
  };

  const addMovement = async () => {
    if (!selectedProduct || !movForm.quantidade) return;
    const qty = Number(movForm.quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    const { error } = await supabase.rpc("rpc_consume_fefo", {
      p_product_id: selectedProduct.id,
      p_unidade_id: selectedProduct.unidade_id,
      p_quantidade: qty,
      p_tipo: movForm.tipo,
      p_motivo: movForm.motivo || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Movimentação registrada!");
    setMovOpen(false);
    setMovForm({ tipo: "saida", quantidade: "", motivo: "" });
    loadData();
  };

  const filtered = products.filter((p) => {
    const matchesSearch = fuzzyMatchProduct(p, search);
    const matchesCategory = filterCategory === "all" || getCategoryName(p) === filterCategory;
    if (filterUnit === "all") return matchesSearch && matchesCategory;
    const hasStock = stockByUnit.some(
      (s) => s.product_id === p.id && s.unidade_id === filterUnit && s.saldo > 0,
    );
    const isAssigned = p.unidade_id === filterUnit;
    return matchesSearch && matchesCategory && (hasStock || isAssigned);
  });

  // KPIs
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);

    let critico = 0;
    let zerados = 0;

    products.forEach((p) => {
      const saldo = getSaldoForProduct(p.id);
      if (saldo <= 0) zerados++;
      else if (saldo < p.estoque_minimo) critico++;
    });

    const lotesProximos = lotes.filter((l) => {
      if (filterUnit !== "all" && l.unidade_id !== filterUnit) return false;
      const v = new Date(l.validade + "T00:00:00");
      return v <= sevenDays;
    });
    const produtosVencProximos = new Set(lotesProximos.map((l) => l.product_id)).size;

    return {
      total: products.length,
      critico,
      zerados,
      vencProximo: produtosVencProximos,
    };
  }, [products, stockByUnit, lotes, filterUnit]);

  // Previsão de Pedido — consumption forecast
  const forecastData = useMemo(() => {
    const consumoMap: Record<string, number> = {};
    consumptionMovements.forEach((m) => {
      consumoMap[m.product_id] = (consumoMap[m.product_id] || 0) + Number(m.quantidade);
    });

    return products
      .filter((p) => (consumoMap[p.id] || 0) > 0)
      .map((p) => {
        const consumoTotal = consumoMap[p.id] || 0;
        const consumoMedioDiario = consumoTotal / 30;
        const estoqueAtual = Number(p.estoque_atual);
        const diasRestantes = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : Infinity;
        const sugestaoCompra = consumoMedioDiario * 7;

        return {
          id: p.id,
          nome: p.nome,
          marca: p.marca,
          unidade_medida: p.unidade_medida,
          estoqueAtual,
          consumoMedioDiario,
          diasRestantes: diasRestantes === Infinity ? null : Math.round(diasRestantes * 10) / 10,
          sugestaoCompra: Math.ceil(sugestaoCompra * 10) / 10,
        };
      })
      .filter((p) => p.diasRestantes !== null)
      .sort((a, b) => (a.diasRestantes ?? 999) - (b.diasRestantes ?? 999));
  }, [products, consumptionMovements]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground leading-tight">
            Estoque
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Controle por lotes com prioridade FEFO — primeiro a vencer, primeiro a sair
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-48" data-guide="search-estoque">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border"
            />
          </div>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-40 bg-input border-border" data-guide="filter-unit">
              <SelectValue placeholder="Todas unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas unidades</SelectItem>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.type.toUpperCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { data: lotesAll } = await supabase
                .from("lotes")
                .select("product_id, codigo, quantidade, validade, status, unidade_id")
                .eq("status", "ativo")
                .gt("quantidade", 0);
              exportEstoqueExcel({
                canSeeCosts,
                produtos: filtered.map((p) => ({
                  nome: p.nome,
                  categoria: getCategoryName(p),
                  unidade_medida: p.unidade_medida,
                  estoque_atual: Number(p.estoque_atual),
                  estoque_minimo: Number(p.estoque_minimo),
                  custo_unitario: Number(p.custo_unitario),
                  valor_em_estoque: Number(p.estoque_atual) * Number(p.custo_unitario),
                  unidade: getUnitName(p.unidade_id),
                })),
                lotes: (lotesAll || []).map((l: any) => ({
                  produto: products.find((p) => p.id === l.product_id)?.nome || "—",
                  codigo: l.codigo || "—",
                  quantidade: Number(l.quantidade),
                  validade: new Date(l.validade).toLocaleDateString("pt-BR"),
                  status: l.status,
                  unidade: getUnitName(l.unidade_id),
                })),
              });
              toast.success("Relatório Excel exportado!");
            }}
          >
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            Exportar
          </Button>
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Importar
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">Novo Produto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome *</Label>
                      <Input
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        className="bg-input border-border"
                      />
                    </div>
                    <div>
                      <Label>Marca *</Label>
                      <Input
                        value={form.marca}
                        onChange={(e) => setForm({ ...form, marca: e.target.value })}
                        className="bg-input border-border"
                        placeholder="Ex: Nestlé, Sadia..."
                      />
                    </div>
                    <div>
                      <Label>Categoria *</Label>
                      <Select
                        value={form.categoria}
                        onValueChange={(v) => setForm({ ...form, categoria: v })}
                      >
                        <SelectTrigger className="bg-input border-border">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_FIXAS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Unid. Medida</Label>
                        <Select
                          value={form.unidade_medida}
                          onValueChange={(v) => setForm({ ...form, unidade_medida: v })}
                        >
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["kg", "g", "L", "ml", "un"].map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Unidade</Label>
                        <Select
                          value={form.unidade_id}
                          onValueChange={(v) => setForm({ ...form, unidade_id: v })}
                        >
                          <SelectTrigger className="bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {units.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Estoque Mínimo</Label>
                      <Input
                        type="number"
                        value={form.estoque_minimo}
                        onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })}
                        className="bg-input border-border"
                      />
                    </div>
                    <Button onClick={addProduct} className="w-full">
                      Adicionar Produto
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <EstoqueHeroKpi
          icon={Boxes}
          label="Itens cadastrados"
          value={kpis.total}
          tone="primary"
          sub="ativos no catálogo"
        />
        <EstoqueHeroKpi
          icon={AlertTriangle}
          label="Abaixo do mínimo"
          value={kpis.critico}
          tone={kpis.critico > 0 ? "destructive" : "accent"}
          sub={kpis.critico > 0 ? "atenção imediata" : "sob controle"}
          pulse={kpis.critico > 0}
        />
        <EstoqueHeroKpi
          icon={CalendarClock}
          label="Vencimento ≤ 7d"
          value={kpis.vencProximo}
          tone={kpis.vencProximo > 0 ? "warning" : "accent"}
          sub={kpis.vencProximo > 0 ? "consumir prioridade FEFO" : "sem alertas"}
        />
        <EstoqueHeroKpi
          icon={PackageX}
          label="Itens zerados"
          value={kpis.zerados}
          tone={kpis.zerados > 0 ? "warning" : "accent"}
          sub={kpis.zerados > 0 ? "ruptura ativa" : "todos com saldo"}
        />
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2" data-guide="category-chips">
        {["all", ...CATEGORIAS_FIXAS].map((cat) => (
          <Button
            key={cat}
            variant={filterCategory === cat ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 px-3"
            onClick={() => setFilterCategory(cat)}
          >
            {cat === "all" ? "Todos" : cat}
          </Button>
        ))}
      </div>

      {/* Movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              Movimentação: {selectedProduct?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={movForm.tipo} onValueChange={(v) => setMovForm({ ...movForm, tipo: v })}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="consumo">Consumo</SelectItem>
                  <SelectItem value="perda">Perda</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Entradas devem ser feitas via Recebimento Digital (com lote/validade). Ajustes manuais
                desativados para manter FEFO.
              </p>
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number"
                value={movForm.quantidade}
                onChange={(e) => setMovForm({ ...movForm, quantidade: e.target.value })}
                className="bg-input border-border"
              />
            </div>
            <div>
              <Label>Motivo</Label>
              <Textarea
                value={movForm.motivo}
                onChange={(e) => setMovForm({ ...movForm, motivo: e.target.value })}
                className="bg-input border-border"
                placeholder="Opcional"
              />
            </div>
            <Button onClick={addMovement} className="w-full">
              Registrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Critical ruptura banner */}
      {kpis.critico > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-destructive/35 bg-destructive/[0.07] p-4 ring-1 ring-destructive/20 shadow-[0_0_24px_-12px_hsl(var(--destructive)/0.4)]">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-3xl bg-destructive/30" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-semibold text-destructive">
                {kpis.critico} {kpis.critico === 1 ? "item em ruptura" : "itens em ruptura"}
              </p>
              <p className="text-xs text-foreground/70 mt-0.5">
                Itens abaixo do estoque mínimo definido. Considere reabastecer via Recebimento ou
                Pedido Interno.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Previsão de Pedido */}
      {forecastData.length > 0 && (
        <Card className="border-border/60 bg-surface-1">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Previsão de pedido
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Baseado no consumo médio dos últimos 30 dias
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Estoque atual</TableHead>
                    <TableHead className="text-right">Consumo méd./dia</TableHead>
                    <TableHead className="text-right">Dias restantes</TableHead>
                    <TableHead className="text-right">Sugestão de compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecastData.slice(0, 20).map((p) => {
                    const dias = p.diasRestantes ?? 999;
                    const statusColor =
                      dias <= 3
                        ? "text-destructive"
                        : dias <= 7
                          ? "text-warning"
                          : "text-success";
                    const statusBg =
                      dias <= 3
                        ? "bg-destructive/10 border-destructive/30"
                        : dias <= 7
                          ? "bg-warning/10 border-warning/30"
                          : "bg-success/10 border-success/30";
                    const statusLabel = dias <= 3 ? "Crítico" : dias <= 7 ? "Atenção" : "OK";

                    return (
                      <TableRow
                        key={p.id}
                        className={`border-border ${dias <= 3 ? "bg-destructive/5" : ""}`}
                      >
                        <TableCell>
                          <div>
                            <span className="font-medium text-foreground">{p.nome}</span>
                            {p.marca && (
                              <span className="block text-xs text-muted-foreground">{p.marca}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.estoqueAtual.toFixed(1)} {p.unidade_medida}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.consumoMedioDiario.toFixed(1)} {p.unidade_medida}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={`${statusColor} ${statusBg} font-semibold border tabular-nums`}
                          >
                            {p.diasRestantes?.toFixed(1)}d · {statusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-foreground">
                          {p.sugestaoCompra} {p.unidade_medida}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Item list */}
      {products.length === 0 ? (
        <EstoqueEmptyState
          canManage={canManage}
          onCreate={() => setAddOpen(true)}
          onImport={() => setImportOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-surface-1 p-8 sm:p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40 ring-1 ring-border">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum item encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros ou tente outra busca.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "item" : "itens"} ·{" "}
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Layers className="h-3 w-3" />
                FEFO ativo
              </span>
            </p>
          </div>
          {filtered.map((p, idx) => (
            <EstoqueItemRow
              key={p.id}
              isFirst={idx === 0}
              canSeeCosts={canSeeCosts}
              canManage={canManage}
              item={{
                id: p.id,
                nome: p.nome,
                marca: p.marca,
                categoria: getCategoryName(p),
                unidade_medida: p.unidade_medida,
                unidade_nome: getUnitName(p.unidade_id),
                estoque_minimo: Number(p.estoque_minimo),
                custo_unitario: Number(p.custo_unitario),
                saldo: getSaldoForProduct(p.id),
                lotes: getLotesForProduct(p.id),
              }}
              onDetail={() => setDetailProduct(p)}
              onEdit={() => setEditProduct(p)}
              onMovement={() => {
                setSelectedProduct(p);
                setMovOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Product detail drawer */}
      <ProductDetailDrawer
        productId={detailProduct?.id || null}
        productName={detailProduct?.nome || ""}
        filterUnitId={filterUnit}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
      />

      {/* Edit product dialog */}
      <EditProductDialog
        product={editProduct}
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSaved={loadData}
      />

      {/* Import products dialog */}
      <ImportProductsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
        units={units}
        defaultUnitId={profile?.unidade_id || units[0]?.id || ""}
      />
    </div>
  );
}
