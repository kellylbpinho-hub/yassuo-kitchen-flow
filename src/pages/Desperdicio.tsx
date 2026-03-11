import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Loader2, UtensilsCrossed, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
interface Unit { id: string; name: string; }

export default function Desperdicio() {
  const { profile, role, isFinanceiro, isCeo } = useAuth();
  const [logs, setLogs] = useState<WasteLog[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [menus, setMenus] = useState<MenuData[]>([]);
  const [menuDishes, setMenuDishes] = useState<MenuDish[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedDishId, setSelectedDishId] = useState("");
  const [sobraPrato, setSobraPrato] = useState("");
  const [sobraRampa, setSobraRampa] = useState("");
  const [organico, setOrganico] = useState("");
  const [observacao, setObservacao] = useState("");

  // The nutricionista's unit or selected unit for filtering
  const userUnitId = profile?.unidade_id || "";

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");

    const [{ data: w }, { data: d }, { data: dc }, { data: m }, { data: u }] = await Promise.all([
      supabase.from("waste_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("dishes").select("id, nome, category_id").eq("ativo", true),
      supabase.from("dish_categories").select("id, nome"),
      supabase.from("menus").select("id, nome, data, unidade_id").order("data", { ascending: false }).limit(30),
      supabase.from("units").select("id, name"),
    ]);

    setLogs((w || []) as WasteLog[]);
    setDishes((d || []) as Dish[]);
    setCategories((dc || []) as DishCategory[]);
    setUnits((u || []) as Unit[]);

    const menusData = (m || []) as MenuData[];
    setMenus(menusData);

    // Load menu_dishes for all loaded menus
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

  // Filter menus by nutricionista's unit
  const availableMenus = useMemo(() => {
    if (isCeo || isFinanceiro) return menus;
    if (!userUnitId) return [];
    return menus.filter(m => m.unidade_id === userUnitId);
  }, [menus, userUnitId, isCeo, isFinanceiro]);

  // Dishes available for the selected menu
  const dishesForMenu = useMemo(() => {
    if (!selectedMenuId) return [];
    const dishIds = menuDishes.filter(md => md.menu_id === selectedMenuId).map(md => md.dish_id);
    return dishes.filter(d => dishIds.includes(d.id));
  }, [selectedMenuId, menuDishes, dishes]);

  // Filter logs by unit for nutricionista
  const filteredLogs = useMemo(() => {
    if (isCeo || isFinanceiro) return logs;
    if (!userUnitId) return [];
    return logs.filter(l => l.unidade_id === userUnitId);
  }, [logs, userUnitId, isCeo, isFinanceiro]);

  const total = (Number(sobraPrato) || 0) + (Number(sobraRampa) || 0) + (Number(organico) || 0);

  const resetForm = () => {
    setSelectedMenuId("");
    setSelectedDishId("");
    setSobraPrato("");
    setSobraRampa("");
    setOrganico("");
    setObservacao("");
  };

  const addWaste = async () => {
    if (!selectedMenuId || !selectedDishId) {
      toast.error("Selecione o cardápio e a preparação.");
      return;
    }
    if (total <= 0) {
      toast.error("Informe ao menos uma pesagem.");
      return;
    }

    const menu = menus.find(m => m.id === selectedMenuId);
    if (!menu) return;

    setSaving(true);

    const { error } = await supabase.from("waste_logs").insert({
      menu_id: selectedMenuId,
      dish_id: selectedDishId,
      product_id: null,
      unidade_id: menu.unidade_id,
      quantidade: total,
      sobra_prato: Number(sobraPrato) || 0,
      sobra_limpa_rampa: Number(sobraRampa) || 0,
      desperdicio_total_organico: Number(organico) || 0,
      observacao: observacao || null,
      user_id: profile?.user_id || (await supabase.auth.getUser()).data.user?.id || "",
      company_id: profile?.company_id || "",
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Desperdício registrado!");
    setAddOpen(false);
    resetForm();
    loadData();
  };

  const getDishName = (id: string | null) => (id ? dishes.find(d => d.id === id)?.nome : null) || "—";
  const getMenuName = (id: string | null) => (id ? menus.find(m => m.id === id)?.nome : null) || "—";
  const getUnitName = (id: string) => units.find(u => u.id === id)?.name || "—";
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find(c => c.id === categoryId)?.nome || null;
  };

  const canRegister = !isFinanceiro && !isCeo;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Desperdício</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCeo ? "Visão consolidada de todas as unidades" :
             isFinanceiro ? "Visão financeira de todas as unidades" :
             `Registros da unidade ${getUnitName(userUnitId)}`}
          </p>
        </div>
        {canRegister && (
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Registrar Perda</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Registrar Desperdício
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Step 1: Select menu (cardápio do dia) */}
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    Cardápio do Dia *
                  </Label>
                  <Select value={selectedMenuId} onValueChange={(v) => { setSelectedMenuId(v); setSelectedDishId(""); }}>
                    <SelectTrigger className="bg-input border-border">
                      <SelectValue placeholder="Selecione o cardápio..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMenus.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum cardápio cadastrado para sua unidade.</div>
                      ) : (
                        availableMenus.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome} — {format(new Date(m.data + "T12:00:00"), "dd/MM/yyyy")}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Select dish (preparação) */}
                {selectedMenuId && (
                  <div>
                    <Label className="flex items-center gap-1.5 mb-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />
                      Preparação / Item *
                    </Label>
                    <Select value={selectedDishId} onValueChange={setSelectedDishId}>
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue placeholder="Selecione a preparação..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dishesForMenu.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum prato vinculado a este cardápio.</div>
                        ) : (
                          dishesForMenu.map(d => {
                            const cat = getCategoryName(d.category_id);
                            return (
                              <SelectItem key={d.id} value={d.id}>
                                {d.nome} {cat && <span className="text-muted-foreground">({cat})</span>}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Step 3: Weights */}
                {selectedDishId && (
                  <>
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Pesagens (kg)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">🍽️ Sobra Prato</Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={sobraPrato}
                            onChange={(e) => setSobraPrato(e.target.value)}
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">🔽 Sobra Rampa</Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={sobraRampa}
                            onChange={(e) => setSobraRampa(e.target.value)}
                            className="bg-input border-border"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">♻️ Orgânico</Label>
                          <Input
                            type="number" step="0.01" min="0" placeholder="0.00"
                            value={organico}
                            onChange={(e) => setOrganico(e.target.value)}
                            className="bg-input border-border"
                          />
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
                      <Textarea
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className="bg-input border-border"
                        placeholder="Alguma observação sobre a perda..."
                      />
                    </div>

                    <Button onClick={addWaste} className="w-full" disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Registrar
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Data</TableHead>
                <TableHead>Cardápio</TableHead>
                <TableHead>Preparação</TableHead>
                <TableHead className="text-right">🍽️ Prato</TableHead>
                <TableHead className="text-right">🔽 Rampa</TableHead>
                <TableHead className="text-right">♻️ Orgânico</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Unidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum registro de desperdício.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((l) => (
                  <TableRow key={l.id} className="border-border">
                    <TableCell className="text-sm">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-muted-foreground">{getMenuName(l.menu_id)}</TableCell>
                    <TableCell className="font-medium">{getDishName(l.dish_id)}</TableCell>
                    <TableCell className="text-right">{l.sobra_prato > 0 ? `${l.sobra_prato} kg` : "—"}</TableCell>
                    <TableCell className="text-right">{l.sobra_limpa_rampa > 0 ? `${l.sobra_limpa_rampa} kg` : "—"}</TableCell>
                    <TableCell className="text-right">{l.desperdicio_total_organico > 0 ? `${l.desperdicio_total_organico} kg` : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(l.quantidade).toFixed(1)} kg</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{getUnitName(l.unidade_id)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
