import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, UtensilsCrossed, CalendarDays, FileDown, History } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { WasteHeroKpi } from "@/components/desperdicio/WasteHeroKpi";
import { WasteTrendChart, type TrendPoint } from "@/components/desperdicio/WasteTrendChart";
import { WasteTopItems, type TopWasteItem } from "@/components/desperdicio/WasteTopItems";
import { WasteRecurrenceAlert, type RecurrenceAlert } from "@/components/desperdicio/WasteRecurrenceAlert";
import { WasteCategoryBreakdown, type CategoryWaste } from "@/components/desperdicio/WasteCategoryBreakdown";
import { WasteEmptyState } from "@/components/desperdicio/WasteEmptyState";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface WasteLog {
  id: string;
  quantidade: number;
  sobra_prato: number;
  sobra_limpa_rampa: number;
  desperdicio_total_organico: number;
  observacao: string | null;
  unidade_id: string;
  created_at: string;
  product_id: string | null;
  dish_id: string | null;
  menu_id: string | null;
}

interface Dish { id: string; nome: string; category_id: string | null; }
interface DishCategory { id: string; nome: string; }
interface MenuData { id: string; nome: string; data: string; unidade_id: string; }
interface MenuDish { id: string; menu_id: string; dish_id: string; }
interface Unit { id: string; name: string; numero_colaboradores: number; }

type PeriodFilter = "hoje" | "semana" | "mes" | "30d";

// Estimated cost per kg of waste (BRL) — operational baseline for impact estimation
const COST_PER_KG_WASTE = 18;

export default function Desperdicio() {
  const { profile, isFinanceiro, isCeo } = useAuth();
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [menus, setMenus] = useState<MenuData[]>([]);
  const [menuDishes, setMenuDishes] = useState<MenuDish[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>("semana");

  // Form state
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedDishId, setSelectedDishId] = useState("");
  const [sobraPrato, setSobraPrato] = useState("");
  const [sobraRampa, setSobraRampa] = useState("");
  const [organico, setOrganico] = useState("");
  const [observacao, setObservacao] = useState("");

  const userUnitId = profile?.unidade_id || "";
  const canSeeCost = !!(isCeo || isFinanceiro);
  const canRegister = !isFinanceiro && !isCeo;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: w }, { data: d }, { data: dc }, { data: m }, { data: u }] = await Promise.all([
      supabase.from("waste_logs").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("dishes").select("id, nome, category_id").eq("ativo", true),
      supabase.from("dish_categories").select("id, nome"),
      supabase.from("menus").select("id, nome, data, unidade_id").order("data", { ascending: false }).limit(30),
      supabase.from("units").select("id, name, numero_colaboradores"),
    ]);

    setLogs((w || []) as WasteLog[]);
    setDishes((d || []) as Dish[]);
    setCategories((dc || []) as DishCategory[]);
    setUnits((u || []) as Unit[]);

    const menusData = (m || []) as MenuData[];
    setMenus(menusData);

    if (menusData.length > 0) {
      const menuIds = menusData.map(m => m.id);
      const { data: md } = await supabase
        .from("menu_dishes")
        .select("id, menu_id, dish_id")
        .in("menu_id", menuIds);
      setMenuDishes((md || []) as MenuDish[]);
    }

    setLoading(false);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "hoje": return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
      case "semana": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "mes": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "30d": return { start: subDays(now, 30), end: now };
    }
  }, [period]);

  const availableMenus = useMemo(() => {
    if (isCeo || isFinanceiro) return menus;
    if (!userUnitId) return [];
    return menus.filter(m => m.unidade_id === userUnitId);
  }, [menus, userUnitId, isCeo, isFinanceiro]);

  const dishesForMenu = useMemo(() => {
    if (!selectedMenuId) return [];
    const dishIds = menuDishes.filter(md => md.menu_id === selectedMenuId).map(md => md.dish_id);
    return dishes.filter(d => dishIds.includes(d.id));
  }, [selectedMenuId, menuDishes, dishes]);

  const scopedLogs = useMemo(() => {
    if (!isCeo && !isFinanceiro && userUnitId) {
      return logs.filter(l => l.unidade_id === userUnitId);
    }
    return logs;
  }, [logs, userUnitId, isCeo, isFinanceiro]);

  const filteredLogs = useMemo(() => {
    return scopedLogs.filter(l => {
      const d = new Date(l.created_at);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [scopedLogs, dateRange]);

  // KPIs + insights
  const insights = useMemo(() => {
    const totalKg = filteredLogs.reduce((s, l) => s + Number(l.quantidade), 0);

    const unit = units.find(u => u.id === userUnitId);
    const numColab = unit?.numero_colaboradores || 1;
    const uniqueDays = new Set(filteredLogs.map(l => l.created_at.substring(0, 10))).size;
    const perCapitaG = uniqueDays > 0 ? (totalKg * 1000) / (numColab * uniqueDays) : 0;

    // Trend vs previous period
    const periodDays = Math.max(1, Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000));
    const prevStart = subDays(dateRange.start, periodDays);
    const prevEnd = dateRange.start;
    const prevLogs = scopedLogs.filter(l => {
      const d = new Date(l.created_at);
      return d >= prevStart && d < prevEnd;
    });
    const prevTotal = prevLogs.reduce((s, l) => s + Number(l.quantidade), 0);
    const trendPct = prevTotal > 0 ? ((totalKg - prevTotal) / prevTotal) * 100 : 0;

    // Estimated cost
    const estimatedCost = totalKg * COST_PER_KG_WASTE;

    // Top items (by dish)
    const dishMap = new Map<string, { totalKg: number; occurrences: number }>();
    filteredLogs.forEach(l => {
      if (!l.dish_id) return;
      const cur = dishMap.get(l.dish_id) || { totalKg: 0, occurrences: 0 };
      cur.totalKg += Number(l.quantidade);
      cur.occurrences += 1;
      dishMap.set(l.dish_id, cur);
    });
    const topItems: TopWasteItem[] = Array.from(dishMap.entries())
      .map(([dishId, v]) => {
        const dish = dishes.find(d => d.id === dishId);
        const cat = dish?.category_id ? categories.find(c => c.id === dish.category_id)?.nome ?? null : null;
        return { name: dish?.nome || "—", category: cat, totalKg: v.totalKg, occurrences: v.occurrences };
      })
      .sort((a, b) => b.totalKg - a.totalKg);

    // Category breakdown
    const catMap = new Map<string, number>();
    filteredLogs.forEach(l => {
      const dish = l.dish_id ? dishes.find(d => d.id === l.dish_id) : null;
      const catName = dish?.category_id ? categories.find(c => c.id === dish.category_id)?.nome ?? "Sem categoria" : "Sem categoria";
      catMap.set(catName, (catMap.get(catName) || 0) + Number(l.quantidade));
    });
    const categoryBreakdown: CategoryWaste[] = Array.from(catMap.entries()).map(([category, totalKg]) => ({
      category, totalKg,
    }));

    // Weekly trend (last 6 weeks, scoped logs)
    const trendData: TrendPoint[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const sum = scopedLogs
        .filter(l => {
          const d = new Date(l.created_at);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((s, l) => s + Number(l.quantidade), 0);
      trendData.push({ label: `S${format(weekStart, "w")}`, kg: sum });
    }

    // Recurrence: dish appears in 3+ consecutive recent weeks
    const recurrenceAlerts: RecurrenceAlert[] = [];
    const dishWeekMap = new Map<string, Set<number>>();
    scopedLogs.forEach(l => {
      if (!l.dish_id) return;
      const d = new Date(l.created_at);
      // ISO week index (year * 100 + week)
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const wkKey = ws.getFullYear() * 100 + Number(format(ws, "w"));
      const set = dishWeekMap.get(l.dish_id) || new Set<number>();
      set.add(wkKey);
      dishWeekMap.set(l.dish_id, set);
    });
    const currentWk = startOfWeek(today, { weekStartsOn: 1 });
    const currentKey = currentWk.getFullYear() * 100 + Number(format(currentWk, "w"));
    dishWeekMap.forEach((weeks, dishId) => {
      // count consecutive weeks ending at currentKey
      let streak = 0;
      let cursor = new Date(currentWk);
      while (true) {
        const cKey = cursor.getFullYear() * 100 + Number(format(cursor, "w"));
        if (weeks.has(cKey)) {
          streak += 1;
          cursor = subDays(cursor, 7);
        } else break;
      }
      if (streak >= 3) {
        const dish = dishes.find(d => d.id === dishId);
        if (dish) recurrenceAlerts.push({ name: dish.nome, weeks: streak });
      }
    });
    recurrenceAlerts.sort((a, b) => b.weeks - a.weeks);

    return {
      totalKg, perCapitaG, trendPct, estimatedCost, registros: filteredLogs.length, uniqueDays,
      topItems, categoryBreakdown, trendData, recurrenceAlerts,
    };
  }, [filteredLogs, scopedLogs, units, userUnitId, dateRange, dishes, categories]);

  const total = (Number(sobraPrato) || 0) + (Number(sobraRampa) || 0) + (Number(organico) || 0);

  const resetForm = () => {
    setSelectedMenuId(""); setSelectedDishId("");
    setSobraPrato(""); setSobraRampa(""); setOrganico(""); setObservacao("");
  };

  const addWaste = async () => {
    if (!selectedMenuId || !selectedDishId) { toast.error("Selecione o cardápio e a preparação."); return; }
    if (total <= 0) { toast.error("Informe ao menos uma pesagem."); return; }
    const menu = menus.find(m => m.id === selectedMenuId);
    if (!menu) return;
    setSaving(true);
    const { error } = await supabase.from("waste_logs").insert({
      menu_id: selectedMenuId, dish_id: selectedDishId, product_id: null,
      unidade_id: menu.unidade_id, quantidade: total,
      sobra_prato: Number(sobraPrato) || 0, sobra_limpa_rampa: Number(sobraRampa) || 0,
      desperdicio_total_organico: Number(organico) || 0, observacao: observacao || null,
      user_id: profile?.user_id || (await supabase.auth.getUser()).data.user?.id || "",
      company_id: profile?.company_id || "",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Desperdício registrado!");
    window.dispatchEvent(new CustomEvent("guided:waste:success"));
    setAddOpen(false); resetForm(); loadData();
  };

  const getDishName = (id: string | null) => (id ? dishes.find(d => d.id === id)?.nome : null) || "—";
  const getMenuName = (id: string | null) => (id ? menus.find(m => m.id === id)?.nome : null) || "—";
  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || "—";
  const getCategoryName = (categoryId: string | null) => categoryId ? categories.find(c => c.id === categoryId)?.nome || null : null;

  const exportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Desperdício", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${format(dateRange.start, "dd/MM/yyyy")} – ${format(dateRange.end, "dd/MM/yyyy")}`, 14, 28);
    doc.text(`Total: ${insights.totalKg.toFixed(2)} kg | Per capita/dia: ${insights.perCapitaG.toFixed(0)} g`, 14, 34);

    autoTable(doc, {
      startY: 42,
      head: [["Data", "Cardápio", "Preparação", "Prato (kg)", "Rampa (kg)", "Orgânico (kg)", "Total (kg)", "Unidade"]],
      body: filteredLogs.map(l => [
        new Date(l.created_at).toLocaleDateString("pt-BR"),
        getMenuName(l.menu_id), getDishName(l.dish_id),
        l.sobra_prato > 0 ? l.sobra_prato.toFixed(2) : "—",
        l.sobra_limpa_rampa > 0 ? l.sobra_limpa_rampa.toFixed(2) : "—",
        l.desperdicio_total_organico > 0 ? l.desperdicio_total_organico.toFixed(2) : "—",
        Number(l.quantidade).toFixed(2), getUnitName(l.unidade_id),
      ]),
      styles: { fontSize: 8 },
    });

    doc.save(`desperdicio_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF exportado!");
  }, [filteredLogs, dateRange, insights]);

  const exportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const data = filteredLogs.map(l => ({
      Data: new Date(l.created_at).toLocaleDateString("pt-BR"),
      Cardápio: getMenuName(l.menu_id),
      Preparação: getDishName(l.dish_id),
      "Sobra Prato (kg)": l.sobra_prato,
      "Sobra Rampa (kg)": l.sobra_limpa_rampa,
      "Orgânico (kg)": l.desperdicio_total_organico,
      "Total (kg)": Number(l.quantidade),
      Unidade: getUnitName(l.unidade_id),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Desperdício");
    XLSX.writeFile(wb, `desperdicio_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Excel exportado!");
  }, [filteredLogs]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Desperdício</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCeo ? "Visão consolidada de todas as unidades" :
             isFinanceiro ? "Visão financeira de todas as unidades" :
             `Insights da unidade ${getUnitName(userUnitId)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[160px] bg-input border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportPDF} className="h-9" disabled={filteredLogs.length === 0}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="h-9" disabled={filteredLogs.length === 0}>
            <FileDown className="h-4 w-4 mr-1" /> Excel
          </Button>
          {canRegister && (
            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button data-guide="btn-registrar-perda" className="h-9"><Plus className="h-4 w-4 mr-1" />Registrar</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    Registrar Desperdício
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-1.5 mb-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> Cardápio do Dia *
                    </Label>
                    <Select value={selectedMenuId} onValueChange={(v) => { setSelectedMenuId(v); setSelectedDishId(""); }}>
                      <SelectTrigger className="bg-input border-border" data-guide="select-menu"><SelectValue placeholder="Selecione o cardápio..." /></SelectTrigger>
                      <SelectContent>
                        {availableMenus.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cardápio cadastrado.</div>
                        ) : (
                          availableMenus.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.nome} — {format(new Date(m.data + "T12:00:00"), "dd/MM/yyyy")}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedMenuId && (
                    <div>
                      <Label className="flex items-center gap-1.5 mb-1.5">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" /> Preparação *
                      </Label>
                      <Select value={selectedDishId} onValueChange={setSelectedDishId}>
                        <SelectTrigger className="bg-input border-border" data-guide="select-dish"><SelectValue placeholder="Selecione a preparação..." /></SelectTrigger>
                        <SelectContent>
                          {dishesForMenu.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum prato vinculado.</div>
                          ) : (
                            dishesForMenu.map(d => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.nome} {getCategoryName(d.category_id) && <span className="text-muted-foreground">({getCategoryName(d.category_id)})</span>}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {selectedDishId && (
                    <>
                      <div className="space-y-3" data-guide="input-weights">
                        <h4 className="text-sm font-semibold text-foreground">Pesagens (kg)</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Sobra Prato</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={sobraPrato} onChange={(e) => setSobraPrato(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Sobra Rampa</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={sobraRampa} onChange={(e) => setSobraRampa(e.target.value)} className="bg-input border-border" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Orgânico</Label>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" value={organico} onChange={(e) => setOrganico(e.target.value)} className="bg-input border-border" />
                          </div>
                        </div>
                      </div>
                      {total > 0 && (
                        <Card className="bg-muted/50 border-border">
                          <CardContent className="py-2 px-3">
                            <span className="text-sm text-muted-foreground">Total: </span>
                            <span className="text-sm font-semibold text-foreground">{total.toFixed(2)} kg</span>
                          </CardContent>
                        </Card>
                      )}
                      <div>
                        <Label>Observação</Label>
                        <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} className="bg-input border-border" placeholder="Alguma observação..." />
                      </div>
                      <Button onClick={addWaste} className="w-full" disabled={saving} data-guide="btn-submit-waste">
                        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Registrar
                      </Button>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Empty state */}
      {filteredLogs.length === 0 && scopedLogs.length === 0 ? (
        <WasteEmptyState canRegister={canRegister} onRegister={() => setAddOpen(true)} />
      ) : (
        <>
          {/* Hero KPI */}
          <WasteHeroKpi
            totalKg={insights.totalKg}
            trendPct={insights.trendPct}
            estimatedCost={insights.estimatedCost}
            perCapitaG={insights.perCapitaG}
            registros={insights.registros}
            uniqueDays={insights.uniqueDays}
            canSeeCost={canSeeCost}
          />

          {/* Recurrence alert */}
          <WasteRecurrenceAlert alerts={insights.recurrenceAlerts} />

          {/* Insights grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WasteTrendChart data={insights.trendData} />
            <WasteCategoryBreakdown data={insights.categoryBreakdown} totalKg={insights.totalKg} />
          </div>

          <WasteTopItems items={insights.topItems} totalKg={insights.totalKg} />

          {/* Recent records — compact */}
          <Card className="border-border/60 bg-card/80 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
                  <History className="h-4 w-4 text-primary" /> Registros recentes
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Últimos lançamentos no período selecionado
                </p>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-6">
                Nenhum registro no período selecionado.
              </div>
            ) : (
              <ul className="space-y-2">
                {filteredLogs.slice(0, 8).map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/20 border border-border/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{getDishName(l.dish_id)}</span>
                        <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground">
                          {getUnitName(l.unidade_id)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")} · {getMenuName(l.menu_id)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-foreground">
                        {Number(l.quantidade).toFixed(1)} kg
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        P {l.sobra_prato || 0} · R {l.sobra_limpa_rampa || 0} · O {l.desperdicio_total_organico || 0}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
