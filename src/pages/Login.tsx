import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Database } from "lucide-react";
import { runSeed } from "@/lib/seedDemo";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLoadDemo = async () => {
    setSeedLoading(true);
    const result = await runSeed();
    setSeedLoading(false);
    if (result.success) {
      const summary = result.details
        ? Object.entries(result.details).map(([k, v]) => `${k}: ${v}`).join(", ")
        : "";
      toast.success("Demo carregada!", { description: summary });
    } else {
      toast.error("Falha ao carregar demo", { description: result.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error, role } = await signIn(email, password);
    if (error) {
      setError("Email ou senha inválidos. Tente novamente.");
    } else {
      navigate(role === "nutricionista" ? "/cardapio-semanal" : "/dashboard");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");

    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        setError("Erro ao fazer login com Google.");
        setGoogleLoading(false);
        return;
      }

      if (result.redirected) {
        return;
      }

      // Session set, navigate
      navigate("/", { replace: true });
    } catch {
      setError("Erro ao fazer login com Google.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-sans font-bold text-foreground tracking-tight">
            Yassuo <span className="text-primary">App</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Controle de estoque e operações
          </p>
        </div>

        <div className="glass-card p-6">
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Google Login */}
            <Button
              onClick={handleGoogleLogin}
              className="w-full"
              variant="outline"
              disabled={googleLoading || loading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Entrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            {/* Email/Password Login */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="bg-input border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-input border-border"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || googleLoading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Entrar
              </Button>
            </form>
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/esqueci-senha"
              className="text-sm hover:underline text-popover-foreground"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed border-amber/40 text-amber hover:bg-amber/10"
              onClick={handleLoadDemo}
              disabled={seedLoading}
            >
              {seedLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Carregar Demo (DEV)
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Faça login como CEO antes de clicar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
