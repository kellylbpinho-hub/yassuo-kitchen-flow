import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardList, PackageCheck } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface RecentEntry {
  id: string;
  quantidade: number;
  created_at: string;
  product_id: string;
  products: { nome: string; unidade_medida: string; marca: string | null } | null;
}

export function RecentReceipts() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadRecent();
  }, []);

  const loadRecent = async () => {
    const { data } = await supabase
      .from("movements")
      .select("id, quantidade, created_at, product_id, products(nome, unidade_medida, marca)")
      .eq("tipo", "entrada")
      .order("created_at", { ascending: false })
      .limit(10);

    setEntries((data || []) as unknown as RecentEntry[]);
    setLoading(false);
  };

  if (loading) return null;
  if (entries.length === 0) return null;

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return `Hoje ${format(d, "HH:mm")}`;
    if (isYesterday(d)) return `Ontem ${format(d, "HH:mm")}`;
    return format(d, "dd/MM HH:mm", { locale: ptBR });
  };

  return (
    <div className="glass-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 ring-1 ring-primary/20 p-1.5">
            <ClipboardList className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-foreground">
              Recebimentos recentes
            </h3>
            <p className="text-[11px] text-muted-foreground">Últimas {entries.length} entradas</p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {entries.map((e) => (
          <div
            key={e.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg",
              "bg-background/40 ring-1 ring-border/60",
              "hover:ring-primary/30 transition-all duration-200",
            )}
          >
            <div className="rounded-md bg-success/10 ring-1 ring-success/20 p-1.5 shrink-0">
              <PackageCheck className="h-3.5 w-3.5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate leading-tight">
                {e.products?.nome || "Produto"}
              </p>
              {e.products?.marca && (
                <p className="text-[10px] text-muted-foreground truncate">{e.products.marca}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-xs font-display font-bold text-foreground">
                {Number(e.quantidade).toFixed(3)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">
                  {e.products?.unidade_medida || ""}
                </span>
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatTimestamp(e.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
