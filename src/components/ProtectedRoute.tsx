import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert, ShieldX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const FINANCEIRO_BLOCKED_ROUTES = [
  "/recebimento-digital",
  "/pedido-interno",
  "/aprovacoes-cd",
  "/usuarios",
  "/unidades",
  "/configuracoes-acesso",
  "/radar-operacao",
];

const NUTRICIONISTA_BLOCKED_ROUTES = [
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
];

const ESTOQUISTA_BLOCKED_ROUTES = [
  "/compras",
  "/dashboard-financeiro",
  "/usuarios",
  "/unidades",
  "/aprovacoes-cd",
  "/configuracoes-acesso",
  "/radar-operacao",
];

const COMPRADOR_BLOCKED_ROUTES = [
  "/recebimento-digital",
  "/dashboard-financeiro",
  "/pedido-interno",
  "/aprovacoes-cd",
  "/usuarios",
  "/unidades",
  "/configuracoes-acesso",
  "/desperdicio",
];

const FUNCIONARIO_BLOCKED_ROUTES = [
  "/compras",
  "/dashboard-financeiro",
  "/recebimento-digital",
  "/pedido-interno",
  "/aprovacoes-cd",
  "/usuarios",
  "/unidades",
  "/configuracoes-acesso",
  "/painel-nutri",
];

const NON_NUTRI_BLOCKED_ROUTES = ["/painel-nutri"];

const CEO_ONLY_ROUTES = ["/configuracoes-acesso", "/painel-ceo"];

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  gerente_financeiro: "Gerente Financeiro",
  gerente_operacional: "Gerente Operacional",
  nutricionista: "Nutricionista",
  estoquista: "Estoquista",
  comprador: "Comprador",
  funcionario: "Funcionário",
};

function isBlocked(role: string | null, pathname: string): boolean {
  if (!role) return false;
  const matchRoute = (routes: string[]) =>
    routes.some((r) => pathname === r || pathname.startsWith(r + "/"));

  switch (role) {
    case "gerente_financeiro":
      return matchRoute(FINANCEIRO_BLOCKED_ROUTES) || matchRoute(NON_NUTRI_BLOCKED_ROUTES);
    case "nutricionista":
      return matchRoute(NUTRICIONISTA_BLOCKED_ROUTES);
    case "estoquista":
      return matchRoute(ESTOQUISTA_BLOCKED_ROUTES) || matchRoute(NON_NUTRI_BLOCKED_ROUTES);
    case "comprador":
      return matchRoute(COMPRADOR_BLOCKED_ROUTES) || matchRoute(NON_NUTRI_BLOCKED_ROUTES);
    case "funcionario":
      return matchRoute(FUNCIONARIO_BLOCKED_ROUTES);
    case "gerente_operacional":
      return matchRoute(NON_NUTRI_BLOCKED_ROUTES);
    case "ceo":
      return matchRoute(NON_NUTRI_BLOCKED_ROUTES);
    default:
      return matchRoute(NON_NUTRI_BLOCKED_ROUTES);
  }
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, profile, loading } = useAuth();
  const location = useLocation();
  const [showDenied, setShowDenied] = useState(false);

  useEffect(() => {
    setShowDenied(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="glass-card p-8 max-w-md text-center space-y-4 animate-fade-in">
          <div className="mx-auto h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-accent-foreground" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground">
            Aguardando permissão
          </h2>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada, mas ainda não possui um cargo atribuído.
            Entre em contato com o administrador do sistema.
          </p>
          <p className="text-xs text-muted-foreground">
            Logado como: {profile?.email || user.email}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (isBlocked(role, location.pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="glass-card p-8 max-w-md text-center space-y-4 animate-fade-in">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/15 flex items-center justify-center">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Acesso restrito
          </h2>
          <p className="text-sm text-muted-foreground">
            Seu cargo de <span className="font-semibold text-foreground">{roleLabels[role] || role}</span> não tem permissão para acessar esta área.
          </p>
          <p className="text-xs text-muted-foreground">
            Se você acredita que deveria ter acesso, entre em contato com o administrador (CEO).
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="mt-2"
          >
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
