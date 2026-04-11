import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Radar, Building2 } from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";
import EfficiencyTable from "@/components/EfficiencyTable";
import { toast } from "sonner";

type StatusLevel = "verde" | "amarelo" | "vermelho";

interface UnitRadar {
  id: string;
  name: string;
  financeiro: StatusLevel;
  estoque: StatusLevel;
  recebimento: StatusLevel;
  statusGeral: "Saudável" | "Monitorar" | "Atenção" | "Risco";
}

const statusColors: Record<StatusLevel, string> = {
  verde: "bg-success/15 text-success border-success/30",
  amarelo: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vermelho: "bg-destructive/15 text-destructive border-destructive/30",
};

const geralColors: Record<string, string> = {
  "Saudável": "bg-success/15 text-success border-success/30",
  "Monitorar": "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  "Atenção": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Risco": "bg-destructive/15 text-destructive border-destructive/30",
};

function deriveGeral(f: StatusLevel, e: StatusLevel, r: StatusLevel): UnitRadar["statusGeral"] {
  const scores = { verde: 0, amarelo: 1, vermelho: 2 };
  const total = scores[f] + scores[e] + scores[r];
  if (total === 0) return "Saudável";
  if (total <= 2) return "Monitorar";
  if (total <= 4) return "Atenção";
  return "Risco";
}

export default function RadarOperacao() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [unitRadars, setUnitRadars] = useState<UnitRadar[]>([]);
  const [efficiencyData, setEfficiencyData] = useState<{ unitId: string; unitName: string; target: number | null; realCost: number }[]>([]);

  useEffect(() => {
    if (profile?.company_id) loadData();
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rawData, error } = await supabase.rpc("rpc_dashboard_executive");
      if (error) throw error;
      const data = rawData as any;
      const mealCosts: Record<string, { total_cost: number; total_meals: number }> = {};
      (data.meal_costs || []).forEach((mc: any) => {
        mealCosts[mc.unit_id] = { total_cost: Number(mc.total_cost), total_meals: Number(mc.total_meals) };
      });

      const unitWeightCount: Record<string, number> = {};
      (data.divergences || []).forEach((d: any) => {
        unitWeightCount[d.unidade_id] = (unitWeightCount[d.unidade_id] || 0) + 1;
      });

      const effData: typeof efficiencyData = [];
      const radars: UnitRadar[] = units.map((u: any) => {
        const fin = mealCosts[u.id];
        const hasFin = fin && fin.total_meals > 0;
        const contractValue = u.contract_value ? Number(u.contract_value) : null;
        const avgRealCost = hasFin ? fin.total_cost / fin.total_meals : 0;

        effData.push({
          unitId: u.id, unitName: u.name,
          target: u.target_meal_cost ? Number(u.target_meal_cost) : null,
          realCost: avgRealCost,
        });

        // Financial status
        let financeiro: StatusLevel = "verde";
        if (hasFin && contractValue && contractValue > 0) {
          const lucro = contractValue - fin.total_cost;
          const margem = (lucro / contractValue) * 100;
          if (lucro < 0) financeiro = "vermelho";
          else if (margem < 5) financeiro = "amarelo";
        }

        // Stock status
        let estoque: StatusLevel = "verde";
        if (data.rupture_risk > 0) estoque = "vermelho";
        else if (data.low_stock_count > 0 || data.expiring_count > 0) estoque = "amarelo";

        // Receiving
        let recebimento: StatusLevel = "verde";
        const wCount = unitWeightCount[u.id] || 0;
        if (wCount >= 3) recebimento = "vermelho";
        else if (wCount >= 1) recebimento = "amarelo";

        return { id: u.id, name: u.name, financeiro, estoque, recebimento, statusGeral: deriveGeral(financeiro, estoque, recebimento) };
      });

      const geralOrder = { "Risco": 0, "Atenção": 1, "Monitorar": 2, "Saudável": 3 };
      radars.sort((a, b) => geralOrder[a.statusGeral] - geralOrder[b.statusGeral]);

      setUnitRadars(radars);
      setEfficiencyData(effData);
    } catch (err: any) {
      toast.error("Erro ao carregar radar", { description: err.message });
    }
    setLoading(false);
    setLastUpdated(new Date());
  };

  const summary = useMemo(() => {
    const s = { saudavel: 0, monitorar: 0, atencao: 0, risco: 0 };
    unitRadars.forEach(r => {
      if (r.statusGeral === "Saudável") s.saudavel++;
      else if (r.statusGeral === "Monitorar") s.monitorar++;
      else if (r.statusGeral === "Atenção") s.atencao++;
      else s.risco++;
    });
    return s;
  }, [unitRadars]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Radar da Operação
          </h1>
          <p className="text-sm text-muted-foreground">Consolidação de riscos operacionais e financeiros por unidade</p>
        </div>
        <LastUpdated timestamp={lastUpdated} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Saudável", value: summary.saudavel, color: "text-success" },
          { label: "Monitorar", value: summary.monitorar, color: "text-yellow-500" },
          { label: "Atenção", value: summary.atencao, color: "text-orange-400" },
          { label: "Risco", value: summary.risco, color: "text-destructive" },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Status por Unidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead className="text-center">Financeiro</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Recebimento</TableHead>
                  <TableHead className="text-center">Status Geral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unitRadars.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma unidade encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  unitRadars.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={statusColors[r.financeiro]}>
                          {r.financeiro === "verde" ? "Saudável" : r.financeiro === "amarelo" ? "Margem Crítica" : "Prejuízo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={statusColors[r.estoque]}>
                          {r.estoque === "verde" ? "OK" : r.estoque === "amarelo" ? "Atenção" : "Crítico"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={statusColors[r.recebimento]}>
                          {r.recebimento === "verde" ? "OK" : r.recebimento === "amarelo" ? "Divergência" : "Múltiplas"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={geralColors[r.statusGeral]}>
                          {r.statusGeral}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EfficiencyTable data={efficiencyData} />
    </div>
  );
}
