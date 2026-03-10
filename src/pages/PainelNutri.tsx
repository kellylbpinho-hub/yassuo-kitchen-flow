import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, CalendarDays, CalendarX2, ClipboardList, Scale } from "lucide-react";
import { startOfWeek, endOfWeek, format, eachDayOfInterval, isToday, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WasteLog {
  id: string;
  quantidade: number;
  sobra_prato: number;
  sobra_limpa_rampa: number;
  desperdicio_total_organico: number;
  product_id: string;
  created_at: string;
}

interface Product {
  id: string;
  nome: string;
}

export default function PainelNutri() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuDates, setMenuDates] = useState<string[]>([]);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const unidadeId = profile?.unidade_id;

    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEnd, "yyyy-MM-dd");
    const todayStart = startOfDay(today).toISOString();
    const todayEnd = endOfDay(today).toISOString();

    // Fetch week waste logs, products, and menu dates in parallel
    const [logsRes, productsRes, menusRes] = await Promise.all([
      supabase
        .from("waste_logs")
        .select("id, quantidade, sobra_prato, sobra_limpa_rampa, desperdicio_total_organico, product_id, created_at")
        .gte("created_at", weekStartStr)
        .lte("created_at", weekEndStr + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("products").select("id, nome").eq("ativo", true),
      supabase
        .from("menus")
        .select("data")
        .gte("data", weekStartStr)
        .lte("data", weekEndStr),
    ]);

    setWasteLogs((logsRes.data as WasteLog[]) || []);
    setProducts((productsRes.data as Product[]) || []);
    setMenuDates((menusRes.data || []).map((m: any) => m.data));
    setLoading(false);
  };

  const getProductName = (id: string) => products.find((p) => p.id === id)?.nome || "—";

  // Calculations
  const todayLogs = wasteLogs.filter((l) => isToday(new Date(l.created_at)));
  const totalWasteWeek = wasteLogs.reduce((s, l) => s + Number(l.quantidade), 0);
  const totalWasteToday = todayLogs.reduce((s, l) => s + Number(l.quantidade), 0);
  const totalPrato = wasteLogs.reduce((s, l) => s + Number(l.sobra_prato), 0);
  const totalRampa = wasteLogs.reduce((s, l) => s + Number(l.sobra_limpa_rampa), 0);
  const totalOrganico = wasteLogs.reduce((s, l) => s + Number(l.desperdicio_total_organico), 0);

  const daysWithMenu = new Set(menuDates);
  const daysWithMenuCount = weekDays.filter((d) => daysWithMenu.has(format(d, "yyyy-MM-dd"))).length;
  const daysWithoutMenuCount = weekDays.filter((d) => !daysWithMenu.has(format(d, "yyyy-MM-dd")) && d <= today).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold text-foreground">Painel da Nutricionista</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Desperdício Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{totalWasteToday.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">{todayLogs.length} registro(s)</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> Desperdício Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-foreground">{totalWasteWeek.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg</span></p>
            <p className="text-xs text-muted-foreground">{wasteLogs.length} registro(s)</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Dias com Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-primary">{daysWithMenuCount} <span className="text-sm font-normal text-muted-foreground">/ 7</span></p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarX2 className="h-3.5 w-3.5" /> Dias sem Cardápio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold text-destructive">{daysWithoutMenuCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por tipo */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">Distribuição por Tipo (Semana)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{totalPrato.toFixed(1)} kg</p>
              <p className="text-xs text-muted-foreground">Sobra Prato</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{totalRampa.toFixed(1)} kg</p>
              <p className="text-xs text-muted-foreground">Sobra Rampa</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{totalOrganico.toFixed(1)} kg</p>
              <p className="text-xs text-muted-foreground">Orgânico/Compostagem</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Últimos registros */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4" /> Últimos Registros de Desperdício
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Prato</TableHead>
                  <TableHead className="text-right">Rampa</TableHead>
                  <TableHead className="text-right">Orgânico</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteLogs.slice(0, 10).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), "dd/MM HH:mm")}</TableCell>
                    <TableCell className="text-xs font-medium">{getProductName(log.product_id)}</TableCell>
                    <TableCell className="text-right text-xs">{Number(log.sobra_prato).toFixed(1)}</TableCell>
                    <TableCell className="text-right text-xs">{Number(log.sobra_limpa_rampa).toFixed(1)}</TableCell>
                    <TableCell className="text-right text-xs">{Number(log.desperdicio_total_organico).toFixed(1)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{Number(log.quantidade).toFixed(1)} kg</TableCell>
                  </TableRow>
                ))}
                {wasteLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhum registro de desperdício esta semana.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
