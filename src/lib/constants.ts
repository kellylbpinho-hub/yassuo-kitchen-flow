// Centralized role labels and permission constants

export const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  gerente_financeiro: "Gerente Financeiro",
  gerente_operacional: "Gerente Operacional",
  nutricionista: "Nutricionista",
  estoquista: "Estoquista",
  comprador: "Comprador",
  funcionario: "Funcionário",
};

// Routes blocked per role — single source of truth for sidebar + ProtectedRoute
export const ROLE_BLOCKED_ROUTES: Record<string, string[]> = {
  gerente_financeiro: [
    "/recebimento-digital",
    "/pedido-interno",
    "/aprovacoes-cd",
    "/usuarios",
    "/unidades",
    "/configuracoes-acesso",
    "/radar-operacao",
    "/painel-nutri",
    "/painel-ceo",
  ],
  nutricionista: [
    "/dashboard",
    "/dashboard-financeiro",
    "/compras",
    "/recebimento-digital",
    "/estoque",
    "/alertas",
    "/usuarios",
    "/unidades",
    "/aprovacoes-cd",
    "/configuracoes-acesso",
    "/radar-operacao",
    "/painel-ceo",
  ],
  estoquista: [
    "/compras",
    "/dashboard-financeiro",
    "/usuarios",
    "/unidades",
    "/aprovacoes-cd",
    "/configuracoes-acesso",
    "/radar-operacao",
    "/painel-nutri",
    "/painel-ceo",
  ],
  comprador: [
    "/recebimento-digital",
    "/dashboard-financeiro",
    "/aprovacoes-cd",
    "/usuarios",
    "/unidades",
    "/configuracoes-acesso",
    "/desperdicio",
    "/radar-operacao",
    "/painel-nutri",
    "/painel-ceo",
  ],
  funcionario: [
    "/compras",
    "/dashboard-financeiro",
    "/recebimento-digital",
    "/pedido-interno",
    "/aprovacoes-cd",
    "/usuarios",
    "/unidades",
    "/configuracoes-acesso",
    "/painel-nutri",
    "/radar-operacao",
    "/painel-ceo",
  ],
  gerente_operacional: [
    "/painel-nutri",
    "/painel-ceo",
  ],
  ceo: [
    "/painel-nutri",
  ],
};

export function isRouteBlocked(role: string | null, pathname: string): boolean {
  if (!role) return false;
  const blockedRoutes = ROLE_BLOCKED_ROUTES[role];
  if (!blockedRoutes) return false;
  return blockedRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}
