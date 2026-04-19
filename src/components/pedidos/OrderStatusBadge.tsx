import { Clock, CheckCircle2, XCircle, Truck, FileEdit, PackageCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderStatus =
  | "rascunho"
  | "pendente"
  | "parcial"
  | "enviado"
  | "aprovado"
  | "em_entrega"
  | "recebido"
  | "rejeitado"
  | "cancelado";

const config: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  rascunho:    { label: "Rascunho",    cls: "bg-muted/50 text-muted-foreground border-border",                    Icon: FileEdit },
  pendente:    { label: "Pendente",    cls: "bg-warning/15 text-warning border-warning/30",                  Icon: Clock },
  parcial:     { label: "Parcial",     cls: "bg-warning/15 text-warning border-warning/30",                  Icon: Clock },
  enviado:     { label: "Enviado",     cls: "bg-primary/15 text-primary border-primary/30",                        Icon: Send },
  aprovado:    { label: "Aprovado",    cls: "bg-success/15 text-success border-success/30",            Icon: CheckCircle2 },
  em_entrega:  { label: "Em entrega",  cls: "bg-info/15 text-info border-info/30",                        Icon: Truck },
  recebido:    { label: "Recebido",    cls: "bg-success/20 text-success border-success/40",            Icon: PackageCheck },
  rejeitado:   { label: "Rejeitado",   cls: "bg-destructive/15 text-destructive border-destructive/30",            Icon: XCircle },
  cancelado:   { label: "Cancelado",   cls: "bg-destructive/10 text-destructive/80 border-destructive/20",         Icon: XCircle },
};

export function OrderStatusBadge({
  status,
  size = "sm",
  pulse = false,
}: { status: string; size?: "xs" | "sm" | "md"; pulse?: boolean }) {
  const c = config[status] || config.pendente;
  const Icon = c.Icon;
  const sizeCls = size === "xs"
    ? "text-[10px] px-2 py-0.5 gap-1 [&>svg]:h-2.5 [&>svg]:w-2.5"
    : size === "md"
    ? "text-xs px-3 py-1 gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5"
    : "text-[11px] px-2.5 py-0.5 gap-1 [&>svg]:h-3 [&>svg]:w-3";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold whitespace-nowrap transition-colors",
        sizeCls,
        c.cls,
        pulse && "animate-pulse",
      )}
    >
      <Icon />
      {c.label}
    </span>
  );
}

export const orderStatusLabel = (s: string) => config[s]?.label || s;
