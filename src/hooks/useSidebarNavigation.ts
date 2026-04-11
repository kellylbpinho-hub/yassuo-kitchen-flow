import {
  LayoutDashboard, Package, ShoppingCart, Trash2, BarChart3,
  Users, Building2, Shield, ScanBarcode, Bell, ClipboardList,
  ClipboardCheck, FileText, UtensilsCrossed, DollarSign,
  CalendarDays, Calculator, Radar, Crown, FileSearch,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
}

export interface NavGroup {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

export function useSidebarNavigation(): NavGroup[] {
  const { role, isNutricionista, isGerenteOperacional, isCeo, canManageUsers } = useAuth();

  if (isNutricionista) {
    return [
      {
        label: "🍎 Nutrição",
        icon: UtensilsCrossed,
        items: [
          { to: "/cardapio-semanal", icon: CalendarDays, label: "Cardápio Semanal" },
          { to: "/painel-nutri", icon: LayoutDashboard, label: "Painel da Nutri" },
          { to: "/pratos", icon: UtensilsCrossed, label: "Pratos" },
          { to: "/planejamento-insumos", icon: Calculator, label: "Previsão Insumos" },
          { to: "/desperdicio", icon: Trash2, label: "Desperdício" },
        ],
      },
      {
        label: "📦 Suprimentos",
        icon: Package,
        items: [
          { to: "/pedido-interno", icon: ClipboardList, label: "Pedido Interno" },
          { to: "/meus-pedidos", icon: FileText, label: "Meus Pedidos" },
        ],
      },
    ];
  }

  const isFinanceiroRole = role === "gerente_financeiro";
  const isComprador = role === "comprador";
  const isEstoquistaRole = role === "estoquista";
  const isFuncionarioRole = role === "funcionario";
  const showPedidoInterno = isGerenteOperacional || isCeo;
  const showAprovacoes = isCeo || isGerenteOperacional;
  const showMeusPedidos = isGerenteOperacional || isCeo;

  // Suprimentos
  const suprimentosItems: NavItem[] = [
    { to: "/estoque", icon: Package, label: "Estoque" },
  ];
  if (!isFinanceiroRole) {
    suprimentosItems.push({ to: "/recebimento-digital", icon: ScanBarcode, label: "Recebimento" });
  }
  if (showPedidoInterno) {
    suprimentosItems.push({ to: "/pedido-interno", icon: ClipboardList, label: "Transferência" });
  }
  if (showAprovacoes) {
    suprimentosItems.push({ to: "/aprovacoes-cd", icon: ClipboardCheck, label: "Aprovações CD" });
  }
  if (showMeusPedidos) {
    suprimentosItems.push({ to: "/meus-pedidos", icon: FileText, label: "Meus Pedidos" });
  }

  // Nutrição
  const nutricaoItems: NavItem[] = [];
  if (!isComprador) {
    nutricaoItems.push({ to: "/desperdicio", icon: Trash2, label: "Desperdício" });
    nutricaoItems.push({ to: "/desperdicio-contrato", icon: BarChart3, label: "Desp. Contrato" });
  }
  nutricaoItems.push({ to: "/alertas", icon: Bell, label: "Alertas" });
  if (isCeo || isGerenteOperacional) {
    nutricaoItems.push({ to: "/planejamento-insumos", icon: Calculator, label: "Previsão Insumos" });
  }

  // Administração
  const showDashFinanceiro = isCeo || isFinanceiroRole || isGerenteOperacional;
  const adminItems: NavItem[] = [];
  if (isCeo) {
    adminItems.push({ to: "/painel-ceo", icon: Crown, label: "Painel do CEO" });
  }
  if (showDashFinanceiro) {
    adminItems.push({ to: "/dashboard-financeiro", icon: DollarSign, label: "Dash Financeiro" });
  }
  if (isCeo || isGerenteOperacional) {
    adminItems.push({ to: "/radar-operacao", icon: Radar, label: "Radar Operação" });
  }
  if (!isEstoquistaRole && !isFuncionarioRole) {
    adminItems.push({ to: "/compras", icon: ShoppingCart, label: "Compras" });
    adminItems.push({ to: "/cotacoes", icon: FileSearch, label: "Cotações" });
  }
  adminItems.push({ to: "/categorias", icon: Shield, label: "Contratos" });
  if (canManageUsers) {
    adminItems.push({ to: "/usuarios", icon: Users, label: "Usuários" });
    adminItems.push({ to: "/unidades", icon: Building2, label: "Unidades" });
  }
  if (isCeo) {
    adminItems.push({ to: "/configuracoes-acesso", icon: Shield, label: "Config. Acesso" });
  }

  return [
    { label: "📦 Suprimentos", icon: Package, items: suprimentosItems },
    { label: "🍎 Nutrição", icon: UtensilsCrossed, items: nutricaoItems },
    { label: "💰 Administração", icon: DollarSign, items: adminItems },
  ];
}
