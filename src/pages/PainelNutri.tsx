import { Loader2, Clock, ShieldX, Trash2, CalendarDays, Package } from "lucide-react";
import { usePainelNutriData } from "@/hooks/usePainelNutriData";
import { LastUpdated } from "@/components/LastUpdated";
import { KpiCard } from "@/components/painel-nutri/KpiCard";
import { WeekMenuCard } from "@/components/painel-nutri/WeekMenuCard";
import { LowStockCard } from "@/components/painel-nutri/LowStockCard";
import { ExpiryAlertsCard } from "@/components/painel-nutri/ExpiryAlertsCard";
import { OperationalAlertsCard } from "@/components/painel-nutri/OperationalAlertsCard";

export default function PainelNutri() {
  const { data, loading, lastUpdated, operationalAlerts } = usePainelNutriData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Dashboard da Cozinha
        </h1>
        <LastUpdated timestamp={lastUpdated} />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Pedidos Pendentes"
          value={data.pendingOrders}
          accent={data.pendingOrders > 0 ? "warning" : "default"}
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Estoque Baixo"
          value={data.lowStockItems.length}
          accent={data.lowStockItems.length > 0 ? "destructive" : "default"}
        />
        <KpiCard
          icon={<ShieldX className="h-4 w-4" />}
          label="Itens Bloqueados"
          value={data.blockedItems}
          accent={data.blockedItems > 0 ? "muted" : "default"}
        />
        <KpiCard
          icon={<Trash2 className="h-4 w-4" />}
          label="Desperdício Hoje"
          value={`${data.wasteToday.toFixed(1)} kg`}
          sub={`${data.wasteCount} registro(s)`}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Cardápios na Semana"
          value={`${data.weekMenu.length} / 7`}
          accent={data.weekMenu.length < 5 ? "warning" : "default"}
        />
      </div>

      {/* Main grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        <WeekMenuCard weekMenu={data.weekMenu} />
        <div className="space-y-4">
          <LowStockCard items={data.lowStockItems} />
          <ExpiryAlertsCard alerts={data.expiryAlerts} />
        </div>
      </div>

      <OperationalAlertsCard alerts={operationalAlerts} />
    </div>
  );
}
