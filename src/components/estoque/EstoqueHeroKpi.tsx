import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "primary" | "warning" | "destructive" | "success" | "accent";

interface EstoqueHeroKpiProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  pulse?: boolean;
}

const toneStyles: Record<
  Tone,
  { ring: string; iconCls: string; valueCls: string; glow: string }
> = {
  primary: {
    ring: "border-primary/30 bg-primary/[0.06]",
    iconCls: "text-primary",
    valueCls: "text-foreground",
    glow: "bg-primary/20",
  },
  warning: {
    ring: "border-amber-500/30 bg-amber-500/[0.05]",
    iconCls: "text-amber-300",
    valueCls: "text-amber-200",
    glow: "bg-amber-500/20",
  },
  destructive: {
    ring: "border-destructive/35 bg-destructive/[0.07]",
    iconCls: "text-destructive",
    valueCls: "text-destructive",
    glow: "bg-destructive/25",
  },
  success: {
    ring: "border-emerald-500/30 bg-emerald-500/[0.05]",
    iconCls: "text-emerald-300",
    valueCls: "text-emerald-200",
    glow: "bg-emerald-500/20",
  },
  accent: {
    ring: "border-border/60 bg-surface-2/60",
    iconCls: "text-muted-foreground",
    valueCls: "text-foreground",
    glow: "bg-foreground/10",
  },
};

export function EstoqueHeroKpi({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  pulse,
}: EstoqueHeroKpiProps) {
  const t = toneStyles[tone];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border px-3.5 py-3 transition-colors",
        t.ring,
      )}
    >
      <div
        className={cn(
          "absolute -right-6 -top-6 h-16 w-16 rounded-full blur-2xl opacity-60 transition-opacity group-hover:opacity-100",
          t.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className={cn("mt-1 text-xl font-bold leading-none tabular-nums", t.valueCls)}>
            {value}
          </p>
          {sub && (
            <p className="mt-1 text-[11px] text-muted-foreground truncate">{sub}</p>
          )}
        </div>
        <div className="relative">
          {pulse && (
            <span className={cn("absolute inset-0 rounded-md animate-ping opacity-30", t.glow)} />
          )}
          <Icon className={cn("h-4 w-4 shrink-0", t.iconCls)} />
        </div>
      </div>
    </div>
  );
}
