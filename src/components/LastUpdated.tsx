import { Clock } from "lucide-react";

interface LastUpdatedProps {
  timestamp: Date | null;
}

export function LastUpdated({ timestamp }: LastUpdatedProps) {
  if (!timestamp) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>Última atualização: {timestamp.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
}
