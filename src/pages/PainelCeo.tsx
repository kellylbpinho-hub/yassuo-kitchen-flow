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
  Clock, ShieldAlert, ChevronRight, Activity, Zap, ArrowUpRight,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
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
  "hsl(354 78% 52%)", "hsl(38 95% 58%)", "hsl(152 60% 48%)",
  "hsl(210 80% 60%)", "hsl(280 50% 60%)", "hsl(28 80% 58%)",
  "hsl(170 55% 48%)", "hsl(320 60% 56%)",
];

const statusTheme = (s: string) => {
  if (["Saudável", "OK"].includes(s)) return { dot: "bg-success", pill: "pill-success" };
  if (["Monitorar", "Margem Crítica", "Atenção", "Divergência"].includes(s))
    return { dot: "bg-warning", pill: "pill-warning" };
  return { dot: "bg-destructive", pill: "pill-danger" };
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
  const criticalCount = kpis.criticalProducts + kpis.ruptureRisk + kpis.lossUnits;

  // Tema do KPI principal (custo refeição)
  const costStatus = kpis.lossUnits > 0
    ? { tone: "danger", label: "Crítico", icon: TrendingDown }
    : kpis.marginCriticalUnits > 0
    ? { tone: "warning", label: "Atenção", icon: AlertTriangle }
    : { tone: "success", label: "Saudável", icon: TrendingUp };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 pb-8">
      {/* ============ HERO HEADER ============ */}
      <section className="surface-hero relative overflow-hidden p-5 lg:p-7 animate-rise">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-eyebrow">Painel executivo</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span className="text-eyebrow text-primary/80">Tempo real</span>
            </div>
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary-soft flex items-center justify-center ring-1 ring-primary/30 shadow-glow-primary">
                <Zap className="h-5 w-5 text-amber" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-[28px] font-bold text-foreground tracking-[-0.025em] leading-tight">
                  Bem-vindo ao comando
                </h1>
                <LastUpdated timestamp={lastUpdated} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <button
                onClick={() => navigate("/alertas")}
                className="pill pill-danger animate-pulse-glow"
              >
                <ShieldAlert className="h-3 w-3" />
                {criticalCount} item{criticalCount > 1 ? "s" : ""} crítico{criticalCount > 1 ? "s" : ""}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-border/60 bg-surface-2 hover:bg-surface-3">
                  <Download className="h-3.5 w-3.5" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" /> PDF executivo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" /> Planilha Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Hero KPI grid: 1 destaque + 3 secundários */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4 mt-6 lg:mt-8">
          {/* Destaque: custo médio da refeição */}
          <HeroKpi
            tone={costStatus.tone as any}
            statusLabel={costStatus.label}
            StatusIcon={costStatus.icon}
            label="Custo médio por refeição"
            value={kpis.avgMealCost > 0 ? fmt(kpis.avgMealCost) : "—"}
            sub={`${kpis.mealsToday.toLocaleString("pt-BR")} refeições hoje`}
            onClick={() => navigate("/dashboard-financeiro")}
          />
          <CompactKpi
            icon={UtensilsCrossed}
            label="Refeições / dia"
            value={kpis.mealsToday.toLocaleString("pt-BR")}
            onClick={() => navigate("/dashboard-financeiro")}
          />
          <CompactKpi
            icon={Package}
            label="Estoque crítico"
            value={String(kpis.criticalProducts)}
            tone={kpis.criticalProducts > 0 ? "danger" : "success"}
            onClick={() => navigate("/estoque")}
          />
          <CompactKpi
            icon={AlertTriangle}
            label="Alertas ativos"
            value={String(totalAlerts)}
            tone={totalAlerts > 3 ? "danger" : totalAlerts > 0 ? "warning" : "success"}
            onClick={() => navigate("/alertas")}
          />
        </div>
      </section>

      {/* ============ MAIN GRID ============ */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Coluna esquerda: charts + performance */}
        <div className="lg:col-span-2 space-y-5 lg:space-y-6">
          {/* Consumo */}
          <Card className="surface-card overflow-hidden animate-rise">
            <CardHeader className="pb-2 px-5 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Activity className="h-4 w-4 text-primary" />
                  Consumo ao longo do tempo
                </CardTitle>
                <span className="text-eyebrow">Últimos 14 dias</span>
              </div>
            </CardHeader>
            <CardContent className="h-[240px] px-2 pb-3">
              {chartsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : consumptionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consumptionData} margin={{ top: 8, right: 14, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorConsumo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(354 78% 52%)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="hsl(354 78% 52%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 9% 18%)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(220 8% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(220 8% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(222 12% 9%)",
                        border: "1px solid hsl(222 9% 22%)",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "hsl(220 12% 96%)",
                        boxShadow: "0 8px 24px -8px hsl(222 14% 2% / 0.7)",
                      }}
                    />
                    <Area type="monotone" dataKey="quantidade" stroke="hsl(354 78% 52%)" strokeWidth={2.2} fill="url(#colorConsumo)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Sem dados de consumo disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pie + Performance unidades */}
          <div className="grid md:grid-cols-2 gap-5 lg:gap-6">
            <Card className="surface-card overflow-hidden animate-rise">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm font-semibold text-foreground">Consumo por categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-[230px] px-3">
                {chartsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : categoryData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%" cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          stroke="hsl(222 11% 10%)"
                          strokeWidth={2}
                        >
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "hsl(222 12% 9%)",
                            border: "1px solid hsl(222 9% 22%)",
                            borderRadius: 10,
                            fontSize: 12,
                            color: "hsl(220 12% 96%)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1 mt-1">
                      {categoryData.slice(0, 5).map((c, i) => (
                        <div key={c.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {c.name}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Sem dados de categoria
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="surface-card overflow-hidden animate-rise">
              <CardHeader className="pb-2 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">Performance das unidades</CardTitle>
                  <button
                    onClick={() => navigate("/radar-operacao")}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    Radar <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 max-h-[260px] overflow-y-auto px-3 pb-4">
                {radarRows.length > 0 ? radarRows.map((r, idx) => {
                  const t = statusTheme(r.geral);
                  return (
                    <div
                      key={r.name}
                      style={{ animationDelay: `${idx * 30}ms` }}
                      className="animate-rise flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-3 transition-all duration-200 cursor-pointer group"
                      onClick={() => navigate("/radar-operacao")}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2 w-2 rounded-full ${t.dot} ring-4 ${
                          r.geral === "Saudável" ? "ring-success/15" :
                          r.geral === "Risco" || r.geral === "Atenção" ? "ring-destructive/15" :
                          "ring-warning/15"
                        }`} />
                        <span className="text-sm font-medium text-foreground/90 truncate">{r.name}</span>
                      </div>
                      <span className={`pill ${t.pill}`}>{r.geral}</span>
                    </div>
                  );
                }) : (
                  <p className="text-xs text-muted-foreground text-center py-6">Sem unidades</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Coluna direita: AÇÃO IMEDIATA + radar financeiro */}
        <div className="space-y-5 lg:space-y-6">
          {/* Bloco AÇÃO IMEDIATA */}
          <Card
            className={`surface-card overflow-hidden animate-rise ${criticalCount > 0 ? "ring-1 ring-destructive/25" : ""}`}
          >
            <CardHeader className="pb-3 px-5 pt-5 border-b border-border/50">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-eyebrow">Ação imediata</span>
                  <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground mt-1">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ring-1 ${
                      criticalCount > 0
                        ? "bg-destructive/15 ring-destructive/30"
                        : "bg-success/15 ring-success/30"
                    }`}>
                      <ShieldAlert className={`h-4 w-4 ${criticalCount > 0 ? "text-destructive" : "text-success"}`} />
                    </div>
                    Alertas críticos
                  </CardTitle>
                </div>
                {totalAlerts > 0 && (
                  <span className="pill pill-danger text-numeric">{totalAlerts}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[460px] overflow-y-auto px-4 pt-4 pb-4">
              {kpis.expiringAlerts > 0 && (
                <AlertItem
                  icon={Clock}
                  tone="warning"
                  title="Produtos vencendo"
                  desc={`${kpis.expiringAlerts} lotes próximos do vencimento`}
                  onClick={() => navigate("/alertas")}
                />
              )}
              {kpis.criticalProducts > 0 && (
                <AlertItem
                  icon={Package}
                  tone="danger"
                  title="Estoque baixo"
                  desc={`${kpis.criticalProducts} produtos abaixo do mínimo`}
                  onClick={() => navigate("/estoque")}
                />
              )}
              {kpis.ruptureRisk > 0 && (
                <AlertItem
                  icon={AlertTriangle}
                  tone="danger"
                  title="Risco de ruptura"
                  desc={`${kpis.ruptureRisk} produtos com ≤3 dias de estoque`}
                  onClick={() => navigate("/estoque")}
                />
              )}
              {kpis.lossUnits > 0 && (
                <AlertItem
                  icon={TrendingDown}
                  tone="danger"
                  title="Unidades com prejuízo"
                  desc={`${kpis.lossUnits} unidade(s) operando no vermelho`}
                  onClick={() => navigate("/dashboard-financeiro")}
                />
              )}
              {kpis.marginCriticalUnits > 0 && (
                <AlertItem
                  icon={DollarSign}
                  tone="warning"
                  title="Margem crítica"
                  desc={`${kpis.marginCriticalUnits} unidade(s) com margem < 5%`}
                  onClick={() => navigate("/dashboard-financeiro")}
                />
              )}
              {kpis.weightDivergences > 0 && (
                <AlertItem
                  icon={Activity}
                  tone="warning"
                  title="Divergências de peso"
                  desc={`${kpis.weightDivergences} divergência(s) nas últimas 48h`}
                  onClick={() => navigate("/recebimento-digital")}
                />
              )}

              {recentDivergences.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-rise flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-warning/8 border border-warning/20 text-xs"
                >
                  <div className="h-2 w-2 rounded-full bg-warning ring-4 ring-warning/15 flex-shrink-0" />
                  <span className="text-foreground/85 font-medium truncate flex-1">{d.product_name}</span>
                  <span className="pill pill-warning text-[10px] text-numeric">
                    {d.percentual_desvio.toFixed(0)}%
                  </span>
                </div>
              ))}

              {purchaseSummary.pending_quotations > 0 && (
                <AlertItem
                  icon={FileText}
                  tone="primary"
                  title="Cotações pendentes"
                  desc={`${purchaseSummary.pending_quotations} cotação(ões) aguardando resposta`}
                  onClick={() => navigate("/cotacoes")}
                />
              )}

              {totalAlerts === 0 && recentDivergences.length === 0 && (
                <div className="text-center py-10">
                  <div className="h-12 w-12 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-3 ring-1 ring-success/25">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <p className="text-sm text-success font-semibold">Operação saudável</p>
                  <p className="text-xs text-muted-foreground mt-1">Nenhum alerta crítico no momento</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Radar financeiro */}
          <Card className="surface-card overflow-hidden animate-rise">
            <CardHeader className="pb-3 px-5 pt-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <DollarSign className="h-4 w-4 text-amber" />
                Radar financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              <FinanceStat label="Saudáveis" value={kpis.healthyUnits} tone="success" />
              <FinanceStat label="Margem crítica" value={kpis.marginCriticalUnits} tone="warning" />
              <FinanceStat label="Com prejuízo" value={kpis.lossUnits} tone="danger" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-transparent gap-1 mt-1"
                onClick={() => navigate("/dashboard-financeiro")}
              >
                Ver dashboard financeiro <ChevronRight className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ============ Sub-components ============ */

function HeroKpi({ tone, statusLabel, StatusIcon, label, value, sub, onClick }: {
  tone: "success" | "warning" | "danger";
  statusLabel: string;
  StatusIcon: any;
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
}) {
  const accent =
    tone === "danger" ? "accent-bar-danger"
    : tone === "warning" ? "accent-bar-warning"
    : "accent-bar-success";
  const pillClass =
    tone === "danger" ? "pill-danger"
    : tone === "warning" ? "pill-warning"
    : "pill-success";

  return (
    <button
      onClick={onClick}
      className={`stat-card lg:col-span-2 ${accent} text-left p-5 lg:p-6 group`}
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <p className="text-eyebrow">{label}</p>
        </div>
        <span className={`pill ${pillClass}`}>
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3 mt-4 relative z-10">
        <p className={`kpi-value text-foreground ${tone === "danger" ? "kpi-glow-danger" : tone === "success" ? "kpi-glow-success" : "kpi-glow-primary"}`}>{value}</p>
        <ArrowUpRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
      <p className="text-xs text-muted-foreground mt-2 relative z-10">{sub}</p>
    </button>
  );
}

function CompactKpi({ icon: Icon, label, value, tone = "primary", onClick }: {
  icon: any;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "danger";
  onClick: () => void;
}) {
  const accent =
    tone === "danger" ? "accent-bar-danger"
    : tone === "warning" ? "accent-bar-warning"
    : tone === "success" ? "accent-bar-success"
    : "accent-bar-primary";
  const iconBg =
    tone === "danger" ? "bg-destructive/12 text-destructive"
    : tone === "warning" ? "bg-warning/12 text-warning"
    : tone === "success" ? "bg-success/12 text-success"
    : "bg-primary/12 text-primary";

  return (
    <button onClick={onClick} className={`stat-card ${accent} text-left p-5 group`}>
      <div className="relative z-10 flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBg} ring-1 ring-inset ring-current/10`}>
          <Icon className="h-4 w-4" />
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="kpi-value text-foreground">{value}</p>
      <p className="text-eyebrow mt-1.5 relative z-10">{label}</p>
    </button>
  );
}

function AlertItem({ icon: Icon, tone, title, desc, onClick }: {
  icon: any;
  tone: "danger" | "warning" | "primary";
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const themes = {
    danger:  { bg: "bg-destructive/8 hover:bg-destructive/12 border-destructive/20", icon: "bg-destructive/15 text-destructive" },
    warning: { bg: "bg-warning/8 hover:bg-warning/12 border-warning/20",            icon: "bg-warning/15 text-warning" },
    primary: { bg: "bg-primary/8 hover:bg-primary/12 border-primary/20",            icon: "bg-primary/15 text-primary" },
  } as const;
  const t = themes[tone];

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-lg border ${t.bg} transition-all duration-200 text-left group`}
    >
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
    </button>
  );
}

function FinanceStat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" }) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    danger:  "text-destructive",
  } as const;
  const dotMap = {
    success: "bg-success",
    warning: "bg-warning",
    danger:  "bg-destructive",
  } as const;
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface-3 transition-colors">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotMap[tone]}`} />
        <span className="text-sm text-foreground/85 font-medium">{label}</span>
      </div>
      <span className={`text-2xl font-bold text-numeric ${colorMap[tone]}`}>{value}</span>
    </div>
  );
}
