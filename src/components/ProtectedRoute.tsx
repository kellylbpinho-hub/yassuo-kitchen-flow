import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const FINANCEIRO_BLOCKED_ROUTES = [
  "/recebimento-digital",
  "/pedido-interno",
  "/aprovacoes-cd",
  "/usuarios",
  "/unidades",
];

const NUTRICIONISTA_BLOCKED_ROUTES = [
  "/compras",
  "/recebimento-digital",
  "/pedido-interno",
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, profile, loading, isFinanceiro, isNutricionista } = useAuth();
  const location = useLocation();
  const toastShown = useRef(false);

  useEffect(() => {
    toastShown.current = false;
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

  // User is authenticated but has no role assigned yet
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

  // Block financeiro from restricted routes
  if (isFinanceiro && FINANCEIRO_BLOCKED_ROUTES.includes(location.pathname)) {
    if (!toastShown.current) {
      toastShown.current = true;
      setTimeout(() => toast.error("Acesso restrito. Perfil somente leitura."), 0);
    }
    return <Navigate to="/dashboard" replace />;
  }

  // Block nutricionista from restricted routes (also block /compras/xxx sub-routes)
  if (isNutricionista && NUTRICIONISTA_BLOCKED_ROUTES.some((r) => location.pathname === r || location.pathname.startsWith(r + "/"))) {
    if (!toastShown.current) {
      toastShown.current = true;
      setTimeout(() => toast.error("Acesso restrito para Nutricionista."), 0);
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
