import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";

export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [inviteData, setInviteData] = useState<{ cargo: string; company_name: string } | null>(null);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"choose" | "email">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    setValidating(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("accept-invite", {
        body: { action: "validate", token },
      });
      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || "Convite inválido.");
      } else if (data?.valid) {
        setInviteData({ cargo: data.cargo, company_name: data.company_name });
      }
    } catch {
      setError("Erro ao validar convite.");
    }
    setValidating(false);
  };

  const acceptInvite = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("accept-invite", {
        body: { action: "accept", token },
      });
      if (fnErr || data?.error) {
        setError(data?.error || fnErr?.message || "Erro ao aceitar convite.");
        setLoading(false);
        return;
      }
      const role = data?.role;
      navigate(role === "nutricionista" ? "/cardapio-semanal" : "/dashboard", { replace: true });
    } catch {
      setError("Erro ao aceitar convite.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      // Store token in sessionStorage so we can accept after redirect
      sessionStorage.setItem("pending_invite_token", token || "");

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/convite/${token}`,
      });

      if (result.error) {
        setError("Erro ao fazer login com Google.");
        setLoading(false);
        return;
      }

      if (result.redirected) {
        return; // Browser will redirect
      }

      // If we got tokens directly, accept the invite
      await acceptInvite();
    } catch {
      setError("Erro ao fazer login com Google.");
      setLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    if (!fullName || !email || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    setError("");

    // Try sign up first
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/convite/${token}`,
      },
    });

    if (signUpError) {
      // If user exists, try sign in
      if (signUpError.message.includes("already registered")) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError("Email já registrado. Verifique sua senha.");
          setLoading(false);
          return;
        }
      } else {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
    }

    await acceptInvite();
  };

  // Check if user is already logged in (e.g., after Google redirect)
  useEffect(() => {
    const checkSession = async () => {
      const pendingToken = sessionStorage.getItem("pending_invite_token");
      if (pendingToken && pendingToken === token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sessionStorage.removeItem("pending_invite_token");
          await acceptInvite();
        }
      }
    };
    if (inviteData) {
      checkSession();
    }
  }, [inviteData]);

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-sans font-bold text-foreground tracking-tight">
              Yassuo <span className="text-primary">App</span>
            </h1>
          </div>
          <div className="glass-card p-6 text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Convite Inválido</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => navigate("/login")}>
              Ir para Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-sans font-bold text-foreground tracking-tight">
            Yassuo <span className="text-primary">App</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Convite para acesso ao sistema
          </p>
        </div>

        <div className="glass-card p-6 space-y-4">
          {/* Invite info */}
          <div className="text-center space-y-2 pb-4 border-b border-border">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Você foi convidado para <span className="font-semibold text-foreground">{inviteData?.company_name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Cargo: <span className="font-semibold text-foreground">{ROLE_LABELS[inviteData?.cargo || ""] || inviteData?.cargo}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}

          {mode === "choose" ? (
            <div className="space-y-3">
              <Button
                onClick={handleGoogleLogin}
                className="w-full"
                disabled={loading}
                variant="outline"
              >
                {loading ? (
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

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setMode("email")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Entrar com Email
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Nome Completo</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="bg-input border-border"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-input border-border"
                />
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-input border-border"
                />
              </div>
              <Button
                onClick={handleEmailSignup}
                className="w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Aceitar Convite
              </Button>
              <Button
                variant="ghost"
                className="w-full text-sm"
                onClick={() => setMode("choose")}
              >
                Voltar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
