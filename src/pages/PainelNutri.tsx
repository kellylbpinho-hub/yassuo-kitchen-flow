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
    <div className="space-y-6 animate-fade-in pb-6">
      {/* ============ HERO HEADER ============ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-surface-2 via-surface-1 to-background p-5 sm:p-6">
        {/* Red signature glow */}
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-primary/[0.10] blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.6)]">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary/80">
                Comando da Cozinha
              </p>
              <h1 className="mt-0.5 text-2xl font-display font-bold leading-tight text-foreground sm:text-[28px]">
                Visão operacional da semana
              </h1>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                Cardápio, estoque e ações priorizadas para a sua nutrição.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LastUpdated timestamp={lastUpdated} />
          </div>
        </div>

        {/* Hero KPI grid */}
        <div className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
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
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => navigate("/cardapio-semanal")}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Planejar semana
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
            onClick={() => navigate("/pedido-interno")}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Novo pedido interno
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-border/60 bg-surface-1 text-xs"
            onClick={() => navigate("/desperdicio")}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Registrar desperdício
          </Button>
        </div>
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
