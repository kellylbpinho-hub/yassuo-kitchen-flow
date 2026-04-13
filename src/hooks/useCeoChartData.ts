import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

interface ConsumptionPoint {
  label: string;
  quantidade: number;
}

interface CategoryPoint {
  name: string;
  value: number;
}

export function useCeoChartData() {
  const { profile } = useAuth();
  const [consumptionData, setConsumptionData] = useState<ConsumptionPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.company_id) load();
  }, [profile?.company_id]);

  const load = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [{ data: movements }, { data: products }] = await Promise.all([
        supabase
          .from("movements")
          .select("created_at, quantidade, tipo, product_id")
          .in("tipo", ["consumo", "saida", "perda"])
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("products")
          .select("id, categoria, category_id"),
      ]);

      // Group consumption by day
      const dayMap: Record<string, number> = {};
      const catMap: Record<string, number> = {};
      const productCatMap: Record<string, string> = {};

      (products || []).forEach((p: any) => {
        productCatMap[p.id] = p.categoria || "Sem categoria";
      });

      (movements || []).forEach((m: any) => {
        const date = new Date(m.created_at);
        const dayKey = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
        dayMap[dayKey] = (dayMap[dayKey] || 0) + Number(m.quantidade);

        const cat = productCatMap[m.product_id] || "Outros";
        catMap[cat] = (catMap[cat] || 0) + Number(m.quantidade);
      });

      setConsumptionData(
        Object.entries(dayMap).map(([label, quantidade]) => ({ label, quantidade: Math.round(quantidade * 100) / 100 }))
      );

      const sorted = Object.entries(catMap)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value);

      setCategoryData(sorted.slice(0, 8));
    } catch {
      // silent
    }
    setLoading(false);
  };

  return { consumptionData, categoryData, loading };
}
