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
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      style={{
        background: "linear-gradient(180deg, hsl(222 14% 5% / 0.85) 0%, hsl(222 14% 4%) 60%)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderTop: "1px solid hsl(var(--sidebar-border))",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200 active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground/80 hover:text-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
                />
              )}
              <div
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/12 ring-1 ring-primary/25"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]")} />
              </div>
              <span className={cn("text-[10px] font-medium tracking-tight", isActive && "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
