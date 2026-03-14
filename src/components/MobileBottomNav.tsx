import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, ClipboardList, Trash2, DollarSign, ScanBarcode } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isNutricionista, isFinanceiro, role } = useAuth();

  const isEstoquista = role === "estoquista";

  const navItems = isNutricionista
    ? [
        { path: "/dashboard", icon: LayoutDashboard, label: "Início" },
        { path: "/desperdicio", icon: Trash2, label: "Desperdício" },
        { path: "/pedido-interno", icon: ClipboardList, label: "Pedido" },
        { path: "/meus-pedidos", icon: Package, label: "Meus Pedidos" },
      ]
    : isFinanceiro
    ? [
        { path: "/dashboard", icon: LayoutDashboard, label: "Início" },
        { path: "/estoque", icon: Package, label: "Estoque" },
        { path: "/dashboard-financeiro", icon: DollarSign, label: "Financeiro" },
        { path: "/compras", icon: ShoppingCart, label: "Compras" },
      ]
    : isEstoquista
    ? [
        { path: "/dashboard", icon: LayoutDashboard, label: "Início" },
        { path: "/estoque", icon: Package, label: "Estoque" },
        { path: "/recebimento-digital", icon: ScanBarcode, label: "Recebimento" },
        { path: "/alertas", icon: ClipboardList, label: "Alertas" },
      ]
    : [
        { path: "/dashboard", icon: LayoutDashboard, label: "Início" },
        { path: "/estoque", icon: Package, label: "Estoque" },
        { path: "/compras", icon: ShoppingCart, label: "Pedidos" },
        { path: "/meus-pedidos", icon: ClipboardList, label: "Meus Pedidos" },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border lg:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}