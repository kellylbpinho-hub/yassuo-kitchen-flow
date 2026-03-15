import { Loader2 } from "lucide-react";

interface ContextualLoaderProps {
  message?: string;
}

export function ContextualLoader({ message = "Carregando..." }: ContextualLoaderProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-12">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
