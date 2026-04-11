import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

export interface LowStockItem {
  nome: string;
  saldo: number;
  minimo: number;
}

export interface ExpiryAlert {
  nome: string;
  dias: number;
  qtd: number;
}

export interface WeekMenuItem {
  date: string;
  nome: string;
  dishCount: number;
}

export interface BlockedProduct {
  product_id: string;
  nome: string;
}

export interface PainelNutriData {
  pendingOrders: number;
  lowStockItems: LowStockItem[];
  blockedItems: number;
  blockedProducts: string[];
  weekMenu: WeekMenuItem[];
  wasteToday: number;
  wasteCount: number;
  expiryAlerts: ExpiryAlert[];
}

export interface OperationalAlert {
  message: string;
  type: "danger" | "warning";
}

const INITIAL_DATA: PainelNutriData = {
  pendingOrders: 0,
  lowStockItems: [],
  blockedItems: 0,
  blockedProducts: [],
  weekMenu: [],
  wasteToday: 0,
  wasteCount: 0,
  expiryAlerts: [],
};

export function usePainelNutriData() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<PainelNutriData>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const unitId = profile?.unidade_id;

  const loadData = useCallback(async () => {
    if (!unitId || !user) return;
    setLoading(true);

    const { data: rpcData, error } = await supabase.rpc("rpc_painel_nutri", {
      p_unit_id: unitId,
    });

    if (error) {
      console.error("rpc_painel_nutri error:", error);
      setLoading(false);
      return;
    }

    const result = rpcData as any;
    const blocked = (result.blocked || []) as BlockedProduct[];

    setData({
      pendingOrders: result.pending_orders ?? 0,
      lowStockItems: (result.low_stock || []) as LowStockItem[],
      blockedItems: blocked.length,
      blockedProducts: blocked.map((b) => b.nome).slice(0, 5),
      weekMenu: (result.week_menu || []) as WeekMenuItem[],
      wasteToday: Number(result.waste_today) || 0,
      wasteCount: result.waste_count ?? 0,
      expiryAlerts: (result.expiry_alerts || []) as ExpiryAlert[],
    });

    setLastUpdated(new Date());
    setLoading(false);
  }, [unitId, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build operational alerts from data
  const operationalAlerts: OperationalAlert[] = [];
  if (data.pendingOrders > 0) {
    operationalAlerts.push({
      message: `${data.pendingOrders} pedido(s) pendente(s) no CD`,
      type: "warning",
    });
  }
  for (const item of data.lowStockItems.slice(0, 3)) {
    operationalAlerts.push({
      message: `${item.nome} com estoque baixo (${item.saldo}/${item.minimo})`,
      type: "danger",
    });
  }
  for (const name of data.blockedProducts.slice(0, 3)) {
    operationalAlerts.push({
      message: `${name} bloqueado por contrato`,
      type: "warning",
    });
  }
  for (const a of data.expiryAlerts.slice(0, 3)) {
    operationalAlerts.push({
      message: `${a.nome} ${a.dias <= 0 ? "vencido" : `vence em ${a.dias}d`}`,
      type: a.dias <= 0 ? "danger" : "warning",
    });
  }

  return { data, loading, lastUpdated, operationalAlerts, refresh: loadData };
}
