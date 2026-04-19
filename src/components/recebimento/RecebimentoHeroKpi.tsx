import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PackageCheck, Boxes, Scale, AlertTriangle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiItem {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "warning" | "muted";
  pulse?: boolean;
}

const toneCls: Record<KpiItem["tone"], { glow: string; icon: string; ring: string }> = {
  primary: { glow: "shadow-[0_0_24px_-10px_hsl(var(--primary)/0.6)]", icon: "text-primary",       ring: "ring-primary/30" },
  success: { glow: "shadow-[0_0_24px_-10px_rgba(16,185,129,0.6)]",     icon: "text-success",   ring: "ring-success/30" },
  warning: { glow: "shadow-[0_0_24px_-10px_rgba(245,158,11,0.6)]",     icon: "text-warning",     ring: "ring-warning/30" },
  muted:   { glow: "",                                                  icon: "text-muted-foreground", ring: "ring-border" },
};

export function RecebimentoHeroKpi() {
  const [stats, setStats] = useState({
    todayCount: 0,
    todayKg: 0,
    weekCount: 0,
    divergencias: 0,
  });

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const [todayRes, weekRes, divRes] = await Promise.all([
      supabase
        .from("movements")
        .select("quantidade")
        .eq("tipo", "entrada")
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("movements")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "entrada")
        .gte("created_at", weekStart.toISOString()),
      supabase
        .from("weight_divergence_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
    ]);

    const todayRows = (todayRes.data || []) as { quantidade: number }[];
    setStats({
      todayCount: todayRows.length,
      todayKg: todayRows.reduce((s, r) => s + Number(r.quantidade || 0), 0),
      weekCount: weekRes.count ?? 0,
      divergencias: divRes.count ?? 0,
    });
  };

  const items: KpiItem[] = [
    {
      label: "Hoje",
      value: stats.todayCount,
      hint: "recebimentos",
      icon: PackageCheck,
      tone: "primary",
    },
    {
      label: "Volume hoje",
      value: stats.todayKg.toFixed(1),
      hint: "kg/un acumulados",
      icon: Scale,
      tone: "success",
    },
    {
      label: "Últimos 7 dias",
      value: stats.weekCount,
      hint: "entradas",
      icon: Boxes,
      tone: "muted",
    },
    {
      label: "Divergências",
      value: stats.divergencias,
      hint: "peso fora do padrão",
      icon: AlertTriangle,
      tone: stats.divergencias > 0 ? "warning" : "muted",
      pulse: stats.divergencias > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it, idx) => {
        const t = toneCls[it.tone];
        const Icon = it.icon;
        return (
          <div
            key={idx}
            className={cn(
              "glass-card p-4 ring-1 transition-all duration-300 relative overflow-hidden",
              t.ring,
              t.glow,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium truncate">
                  {it.label}
                </p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">
                  {it.value}
                </p>
                {it.hint && (
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{it.hint}</p>
                )}
              </div>
              <div className={cn("rounded-lg p-2 bg-background/50", t.icon, it.pulse && "animate-pulse")}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
