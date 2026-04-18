import { cn } from "@/lib/utils";

type Tone = "primary" | "warning" | "destructive" | "muted" | "success" | "accent";

interface NutriHeroKpiProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  highlight?: boolean;
}

export function NutriHeroKpi({
  icon,
  label,
  value,
  sub,
  tone = "accent",
  highlight = false,
}: NutriHeroKpiProps) {
  const toneStyles: Record<Tone, { ring: string; iconCls: string; valueCls: string }> = {
    primary: {
      ring: "border-primary/30 bg-primary/[0.06]",
      iconCls: "border-primary/40 bg-primary/15 text-primary",
      valueCls: "text-foreground",
    },
    warning: {
      ring: "border-amber-500/30 bg-amber-500/[0.05]",
      iconCls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
      valueCls: "text-amber-200",
    },
    destructive: {
      ring: "border-destructive/30 bg-destructive/[0.05]",
      iconCls: "border-destructive/40 bg-destructive/10 text-destructive",
      valueCls: "text-destructive",
    },
    success: {
      ring: "border-border/60 bg-surface-1/70",
      iconCls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      valueCls: "text-foreground",
    },
    muted: {
      ring: "border-border/60 bg-surface-1/70",
      iconCls: "border-border/60 bg-surface-3/70 text-muted-foreground",
      valueCls: "text-muted-foreground",
    },
    accent: {
      ring: "border-border/60 bg-surface-1/70",
      iconCls: "border-border/60 bg-surface-3/70 text-foreground/80",
      valueCls: "text-foreground",
    },
  };

  const t = toneStyles[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border px-3 py-3 transition-all duration-300",
        t.ring,
        highlight && "shadow-[0_0_24px_-12px_hsl(var(--primary)/0.55)]",
      )}
    >
      {highlight && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90 leading-tight">
          {label}
        </span>
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border [&_svg]:size-3.5",
            t.iconCls,
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold tabular-nums leading-none", t.valueCls)}>
          {value}
        </span>
      </div>

      {sub && (
        <p className="mt-1 text-[11px] text-muted-foreground/80 leading-tight">{sub}</p>
      )}
    </div>
  );
}
