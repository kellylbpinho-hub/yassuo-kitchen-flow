import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { format } from "date-fns";

interface RecentEntry {
  id: string;
  quantidade: number;
  created_at: string;
  product_id: string;
  products: { nome: string; unidade_medida: string } | null;
}

export function RecentReceipts() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("movements")
      .select("id, quantidade, created_at, product_id, products(nome, unidade_medida)")
      .eq("tipo", "entrada")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) setEntries(data as unknown as RecentEntry[]);
  };

  if (entries.length === 0) return null;

  return (
    <div className="glass-card p-4 max-w-lg space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <ClipboardList className="h-4 w-4" />
        Recebimentos de hoje
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center justify-between text-sm bg-accent/30 rounded-md px-3 py-2">
            <span className="font-medium text-foreground truncate mr-2">
              {e.products?.nome || "Produto"}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">
                {e.quantidade} {e.products?.unidade_medida || ""}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(e.created_at), "HH:mm")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
