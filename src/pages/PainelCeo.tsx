import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, UtensilsCrossed, DollarSign, Package, AlertTriangle,
  Download, FileText, FileSpreadsheet, TrendingUp, TrendingDown,
  Clock, ShieldAlert, ChevronRight, Activity, Zap,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart,
} from "recharts";
import { LastUpdated } from "@/components/LastUpdated";
import { generateCeoPDF, generateCeoExcel, type CeoExportData } from "@/lib/ceoExport";
import { toast } from "sonner";
import { useCeoData } from "@/hooks/useCeoData";
import { useCeoChartData } from "@/hooks/useCeoChartData";

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PIE_COLORS = [
  "hsl(350, 85%, 46%)", "hsl(45, 100%, 50%)", "hsl(142, 71%, 45%)",
  "hsl(200, 70%, 50%)", "hsl(280, 60%, 50%)", "hsl(30, 80%, 55%)",
  "hsl(170, 60%, 45%)", "hsl(320, 70%, 50%)",
];

const statusDot = (s: string) => {
  if (["Saudável", "OK"].includes(s)) return "bg-success";
  if (["Monitorar", "Margem Crítica", "Atenção", "Divergência"].includes(s)) return "bg-warning";
  return "bg-destructive";
};

export default function PainelCeo() {
  const navigate = useNavigate();
  const { loading, lastUpdated, kpis, recentDivergences, unitFinRows, radarRows, purchaseSummary } = useCeoData();
  const { consumptionData, categoryData, loading: chartsLoading } = useCeoChartData();

  const handleExport = (type: "pdf" | "excel") => {
    toast.success(type === "pdf" ? "Gerando PDF..." : "Gerando Excel...", { duration: 2000 });
    const exportData: CeoExportData = {
      generatedAt: new Date().toLocaleString("pt-BR"),
      kpis, unitFinance: unitFinRows, radar: radarRows, divergences: recentDivergences,
    };
    if (type === "pdf") generateCeoPDF(exportData);
    else generateCeoExcel(exportData);
  };

  const totalAlerts = kpis.criticalProducts + kpis.expiringAlerts + kpis.ruptureRisk + kpis.weightDivergences;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Painel do CEO</h1>
              <p className="text-xs text-muted-foreground">Visão executiva em tempo real</p>
            </div>
          </div>
          <LastUpdated timestamp={lastUpdated} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={UtensilsCrossed}
          label="Refeições / dia"
          value={kpis.mealsToday.toLocaleString("pt-BR")}
          trend={null}
          onClick={() => navigate("/dashboard-financeiro")}
        />
        <KpiCard
          icon={DollarSign}
          label="Custo médio / refeição"
          value={kpis.avgMealCost > 0 ? fmt(kpis.avgMealCost) : "—"}
          trend={kpis.lossUnits > 0 ? "down" : kpis.marginCriticalUnits > 0 ? "warn" : "up"}
          onClick={() => navigate("/dashboard-financeiro")}
        />
        <KpiCard
          icon={Package}
          label="Estoque crítico"
          value={String(kpis.criticalProducts)}
          trend={kpis.criticalProducts > 0 ? "down" : "up"}
          onClick={() => navigate("/estoque")}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Alertas ativos"
          value={String(totalAlerts)}
          trend={totalAlerts > 3 ? "down" : totalAlerts > 0 ? "warn" : "up"}
          onClick={() => navigate("/alertas")}
        />
      </div>

      {/* Main content: Charts + Alert Feed */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left: Charts */}
        <div className="lg:col-span-2 space-y-5">
          {/* Consumption Line Chart */}
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Consumo ao longo do tempo
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[240px] pr-2">
              {chartsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : consumptionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consumptionData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(350, 85%, 46%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(350, 85%, 46%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(228, 8%, 20%)" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(220, 8%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220, 8%, 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(228, 10%, 11%)",
                        border: "1px solid hsl(228, 8%, 20%)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "hsl(220, 10%, 93%)",
                      }}
                    />
                    <Area type="monotone" dataKey="quantidade" stroke="hsl(350, 85%, 46%)" strokeWidth={2} fill="url(#colorConsumo)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sem dados de consumo disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie + Unit Map side by side */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Pie Chart */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Consumo por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {categoryData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(228, 10%, 11%)",
                          border: "1px solid hsl(228, 8%, 20%)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "hsl(220, 10%, 93%)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Sem dados de categoria
                  </div>
                )}
                {categoryData.length > 0 && (
                  <div className="flex flex-wrap gap-2 -mt-2 px-1">
                    {categoryData.slice(0, 5).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Unit Performance Map */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Performance das Unidades</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {radarRows.length > 0 ? radarRows.map(r => (
                  <div
                    key={r.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 hover:bg-secondary/60 hover:scale-[1.01] transition-all duration-200 cursor-pointer ring-1 ring-border/20"
                    onClick={() => navigate("/radar-operacao")}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${statusDot(r.geral)} ring-2 ring-offset-1 ring-offset-card ${
                        r.geral === "Saudável" ? "ring-success/30" :
                        r.geral === "Risco" || r.geral === "Atenção" ? "ring-destructive/30" :
                        "ring-warning/30"
                      }`} />
                      <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{r.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0.5 font-semibold ${
                        r.geral === "Saudável" ? "bg-success/10 text-success border-success/25" :
                        r.geral === "Risco" || r.geral === "Atenção" ? "bg-destructive/10 text-destructive border-destructive/25" :
                        "bg-warning/10 text-warning border-warning/25"
                      }`}
                    >
                      {r.geral}
                    </Badge>
                  </div>
                )) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem unidades</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: Alert Center Feed */}
        <div className="space-y-5">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Central de Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {/* Expiring */}
              {kpis.expiringAlerts > 0 && (
                <AlertItem
                  icon={Clock}
                  color="text-warning"
                  title="Produtos vencendo"
                  desc={`${kpis.expiringAlerts} lotes próximos do vencimento`}
                  onClick={() => navigate("/alertas")}
                />
              )}

              {/* Low stock */}
              {kpis.criticalProducts > 0 && (
                <AlertItem
                  icon={Package}
                  color="text-destructive"
                  title="Estoque baixo"
                  desc={`${kpis.criticalProducts} produtos abaixo do mínimo`}
                  onClick={() => navigate("/estoque")}
                />
              )}

              {/* Rupture risk */}
              {kpis.ruptureRisk > 0 && (
                <AlertItem
                  icon={AlertTriangle}
                  color="text-destructive"
                  title="Risco de ruptura"
                  desc={`${kpis.ruptureRisk} produtos com ≤3 dias de estoque`}
                  onClick={() => navigate("/estoque")}
                />
              )}

              {/* Financial loss */}
              {kpis.lossUnits > 0 && (
                <AlertItem
                  icon={TrendingDown}
                  color="text-destructive"
                  title="Unidades com prejuízo"
                  desc={`${kpis.lossUnits} unidade(s) operando no vermelho`}
                  onClick={() => navigate("/dashboard-financeiro")}
                />
              )}

              {/* Margin critical */}
              {kpis.marginCriticalUnits > 0 && (
                <AlertItem
                  icon={DollarSign}
                  color="text-warning"
                  title="Margem crítica"
                  desc={`${kpis.marginCriticalUnits} unidade(s) com margem < 5%`}
                  onClick={() => navigate("/dashboard-financeiro")}
                />
              )}

              {/* Weight divergences */}
              {kpis.weightDivergences > 0 && (
                <AlertItem
                  icon={Activity}
                  color="text-warning"
                  title="Divergências de peso"
                  desc={`${kpis.weightDivergences} divergência(s) nas últimas 48h`}
                  onClick={() => navigate("/recebimento-digital")}
                />
              )}

              {/* Recent divergences detail */}
              {recentDivergences.slice(0, 3).map((d, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" />
                  <span className="text-muted-foreground truncate">{d.product_name}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-warning/15 text-warning border-warning/30">
                    {d.percentual_desvio.toFixed(0)}%
                  </Badge>
                </div>
              ))}

              {/* Purchase summary */}
              {purchaseSummary.pending_quotations > 0 && (
                <AlertItem
                  icon={FileText}
                  color="text-primary"
                  title="Cotações pendentes"
                  desc={`${purchaseSummary.pending_quotations} cotação(ões) aguardando resposta`}
                  onClick={() => navigate("/cotacoes")}
                />
              )}

              {totalAlerts === 0 && recentDivergences.length === 0 && (
                <div className="text-center py-8">
                  <div className="h-10 w-10 rounded-full bg-success/15 flex items-center justify-center mx-auto mb-2">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <p className="text-sm text-success font-medium">Operação saudável</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Nenhum alerta ativo no momento</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Finance Summary */}
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Radar Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FinanceStat label="Saudáveis" value={kpis.healthyUnits} color="text-success" />
              <FinanceStat label="Margem crítica" value={kpis.marginCriticalUnits} color="text-warning" />
              <FinanceStat label="Com prejuízo" value={kpis.lossUnits} color="text-destructive" />
              <div className="pt-2">
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground gap-1" onClick={() => navigate("/dashboard-financeiro")}>
                  Ver dashboard financeiro <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function KpiCard({ icon: Icon, label, value, trend, onClick }: {
  icon: any; label: string; value: string; trend: "up" | "down" | "warn" | null; onClick: () => void;
}) {
  const glowClass = trend === "down" ? "glow-destructive" : trend === "warn" ? "glow-warning" : "";
  return (
    <Card
      className={`glass-card cursor-pointer transition-all duration-300 group hover:scale-[1.02] hover:border-primary/30 active:scale-[0.98] ${glowClass}`}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/15 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              trend === "up" ? "text-success bg-success/10 ring-1 ring-success/20" :
              trend === "warn" ? "text-warning bg-warning/10 ring-1 ring-warning/20" :
              "text-destructive bg-destructive/10 ring-1 ring-destructive/20"
            }`}>
              {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "warn" ? <AlertTriangle className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend === "up" ? "OK" : trend === "warn" ? "Atenção" : "Crítico"}
            </div>
          )}
        </div>
        <p className="text-3xl font-extrabold text-foreground mt-4 tracking-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1 font-medium uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  );
}

function AlertItem({ icon: Icon, color, title, desc, onClick }: {
  icon: any; color: string; title: string; desc: string; onClick: () => void;
}) {
  const bgColor = color === "text-destructive"
    ? "bg-destructive/8 hover:bg-destructive/15 ring-1 ring-destructive/15"
    : color === "text-warning"
    ? "bg-warning/8 hover:bg-warning/15 ring-1 ring-warning/15"
    : "bg-primary/8 hover:bg-primary/15 ring-1 ring-primary/15";

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl ${bgColor} transition-all duration-200 cursor-pointer group hover:scale-[1.01] active:scale-[0.99]`}
      onClick={onClick}
    >
      <div className={`mt-0.5 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0" />
    </div>
  );
}

function FinanceStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}
