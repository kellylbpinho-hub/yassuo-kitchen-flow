import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, ShieldAlert } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, role, profile, loading } = useAuth();

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

  return <>{children}</>;
}
