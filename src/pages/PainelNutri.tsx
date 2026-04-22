import { useNavigate } from "react-router-dom";
import {
  Clock,
  ShieldX,
  Trash2,
  CalendarDays,
  Package,
  ChefHat,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { usePainelNutriData } from "@/hooks/usePainelNutriData";
import { LastUpdated } from "@/components/LastUpdated";
import { ContextualLoader } from "@/components/ContextualLoader";
import { Button } from "@/components/ui/button";
import { WeekMenuCard } from "@/components/painel-nutri/WeekMenuCard";
import { LowStockCard } from "@/components/painel-nutri/LowStockCard";
import { ExpiryAlertsCard } from "@/components/painel-nutri/ExpiryAlertsCard";
import { NutriHeroKpi } from "@/components/painel-nutri/NutriHeroKpi";
import { NutriActionCenter } from "@/components/painel-nutri/NutriActionCenter";
import { cn } from "@/lib/utils";

export default function PainelNutri() {
  const navigate = useNavigate();
  const { data, loading, lastUpdated, operationalAlerts } = usePainelNutriData();

  if (loading) {
    return <ContextualLoader message="Carregando comando da cozinha..." />;
  }

  const weekProgress = Math.round((data.weekMenu.length / 7) * 100);
  const hasAnyAlert =
    data.pendingOrders > 0 ||
    data.lowStockItems.length > 0 ||
    data.blockedItems > 0 ||
    data.expiryAlerts.length > 0 ||
    data.weekMenu.length < 5;

  return (
    <div className="space-y-6 animate-fade-in pb-6 nutri-page -mx-3 -my-3 px-3 py-3 lg:-mx-5 lg:-my-5 lg:px-5 lg:py-5">
      {/* ============ HERO BANNER FULL-WIDTH ============ */}
      <div className="relative -mx-3 -mt-3 lg:-mx-5 lg:-mt-5 overflow-hidden border-b border-amber/30">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[#0A0A0A]" />
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_15%_20%,hsl(38_95%_58%)_0%,transparent_45%),radial-gradient(circle_at_85%_80%,hsl(38_95%_58%)_0%,transparent_50%)]" />
        <div className="pointer-events-none absolute -top-32 -right-20 h-80 w-80 rounded-full bg-amber/[0.10] blur-3xl" />

        <div className="relative px-4 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber/40 bg-amber/10 text-amber shadow-[0_0_32px_-8px_hsl(38_95%_58%/0.5)]">
                <ChefHat className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber">
                  Yassuo · Nutrição
                </p>
                <h1 className="nutri-hero-title mt-1.5 text-foreground text-4xl sm:text-5xl lg:text-6xl">
                  Comando da Cozinha
                </h1>
                <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                  Cardápio, estoque e ações priorizadas para a sua nutrição — em tempo real.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <LastUpdated timestamp={lastUpdated} />
            </div>
          </div>

          {/* Hero KPI grid */}
          <div className="relative mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <NutriHeroKpi
              icon={<CalendarDays className="h-4 w-4" />}
              label="Semana planejada"
              value={`${data.weekMenu.length}/7`}
              sub={`${weekProgress}% concluída`}
              tone={data.weekMenu.length >= 5 ? "primary" : "warning"}
              highlight
            />
            <NutriHeroKpi
              icon={<Clock className="h-4 w-4" />}
              label="Pedidos pendentes"
              value={data.pendingOrders}
              tone={data.pendingOrders > 0 ? "warning" : "success"}
            />
            <NutriHeroKpi
              icon={<Package className="h-4 w-4" />}
              label="Estoque baixo"
              value={data.lowStockItems.length}
              tone={data.lowStockItems.length > 0 ? "destructive" : "success"}
            />
            <NutriHeroKpi
              icon={<ShieldX className="h-4 w-4" />}
              label="Bloqueados"
              value={data.blockedItems}
              tone={data.blockedItems > 0 ? "muted" : "success"}
            />
            <NutriHeroKpi
              icon={<Trash2 className="h-4 w-4" />}
              label="Desperdício hoje"
              value={`${data.wasteToday.toFixed(1)} kg`}
              sub={`${data.wasteCount} registro(s)`}
              tone="accent"
            />
          </div>

          {/* Quick actions */}
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Button
              size="sm"
              className="btn-amber-solid h-9 gap-1.5 text-xs"
              onClick={() => navigate("/cardapio-semanal")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Planejar semana
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-border/60 bg-surface-1/60 backdrop-blur text-xs"
              onClick={() => navigate("/pedido-interno")}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Novo pedido interno
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-border/60 bg-surface-1/60 backdrop-blur text-xs"
              onClick={() => navigate("/desperdicio")}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Registrar desperdício
            </Button>
          </div>
        </div>

        {/* Linha gradiente dourado/âmbar inferior */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber to-transparent shadow-[0_0_20px_hsl(38_95%_58%/0.6)]" />
      </div>

      {/* ============ ACTION CENTER (alerts) ============ */}
      <NutriActionCenter
        alerts={operationalAlerts}
        weekProgress={weekProgress}
        weekCount={data.weekMenu.length}
        hasAnyAlert={hasAnyAlert}
      />

      {/* ============ MAIN GRID ============ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WeekMenuCard weekMenu={data.weekMenu} />
        <div className="space-y-4">
          <LowStockCard items={data.lowStockItems} />
          <ExpiryAlertsCard alerts={data.expiryAlerts} />
        </div>
      </div>
    </div>
  );
}
