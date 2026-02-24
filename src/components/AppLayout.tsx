import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Trash2,
  Users,
  Building2,
  Tag,
  ScanBarcode,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  ClipboardList,
  ClipboardCheck,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/estoque", icon: Package, label: "Estoque" },
  { to: "/compras", icon: ShoppingCart, label: "Compras Fornecedor" },
  { to: "/recebimento-digital", icon: ScanBarcode, label: "Recebimento" },
  { to: "/desperdicio", icon: Trash2, label: "Desperdício" },
  { to: "/alertas", icon: Bell, label: "Alertas" },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, role, signOut, canManageUsers, isNutricionista, isGerenteOperacional, isCeo, isEstoquista, canManage } = useAuth();
  const navigate = useNavigate();

  const showPedidoInterno = isNutricionista || isGerenteOperacional || isCeo;
  const showAprovacoes = isCeo || isGerenteOperacional;
  const showMeusPedidos = isNutricionista || isGerenteOperacional || isCeo;

  const navItems = [
    ...baseNavItems,
    ...(showPedidoInterno ? [{ to: "/pedido-interno", icon: ClipboardList, label: "Transferência Interna" }] : []),
    ...(showMeusPedidos ? [{ to: "/meus-pedidos", icon: FileText, label: "Meus Pedidos" }] : []),
    ...(showAprovacoes ? [{ to: "/aprovacoes-cd", icon: ClipboardCheck, label: "Aprovações CD" }] : []),
    { to: "/categorias", icon: Tag, label: "Categorias" },
    ...(canManageUsers ? [
      { to: "/usuarios", icon: Users, label: "Usuários" },
      { to: "/unidades", icon: Building2, label: "Unidades" },
    ] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const roleLabels: Record<string, string> = {
    ceo: "CEO",
    gerente_financeiro: "Gerente Financeiro",
    gerente_operacional: "Gerente Operacional",
    nutricionista: "Nutricionista",
    estoquista: "Estoquista",
    comprador: "Comprador",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
          <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
            Yassuo<span className="text-primary">App</span>
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                isActive ? "sidebar-item-active" : "sidebar-item"
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {role ? roleLabels[role] || role : ""}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
