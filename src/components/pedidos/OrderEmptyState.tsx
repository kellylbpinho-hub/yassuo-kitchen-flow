import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OrderEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryCta?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryCta?: { label: string; onClick: () => void; icon?: LucideIcon };
  className?: string;
}

export function OrderEmptyState({
  icon: Icon,
  title,
  description,
  primaryCta,
  secondaryCta,
  className,
}: OrderEmptyStateProps) {
  return (
    <div
      className={cn(
        "glass-card p-10 text-center flex flex-col items-center gap-4 relative overflow-hidden",
        className,
      )}
    >
      {/* Subtle radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="rounded-2xl bg-primary/10 ring-1 ring-primary/30 p-4 shadow-[0_0_32px_-12px_hsl(var(--primary)/0.6)]">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-display font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {(primaryCta || secondaryCta) && (
          <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full sm:w-auto">
            {primaryCta && (
              <Button onClick={primaryCta.onClick} className="gap-2">
                {primaryCta.icon && <primaryCta.icon className="h-4 w-4" />}
                {primaryCta.label}
              </Button>
            )}
            {secondaryCta && (
              <Button variant="outline" onClick={secondaryCta.onClick} className="gap-2">
                {secondaryCta.icon && <secondaryCta.icon className="h-4 w-4" />}
                {secondaryCta.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
