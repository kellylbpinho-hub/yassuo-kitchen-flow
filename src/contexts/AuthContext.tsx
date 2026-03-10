import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type AppRole = "ceo" | "gerente_financeiro" | "gerente_operacional" | "nutricionista" | "estoquista" | "comprador" | "funcionario";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cargo: string;
  unidade_id: string | null;
  avatar_url: string | null;
  ativo: boolean;
  company_id: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; role: AppRole | null }>;
  signOut: () => Promise<void>;
  isCeo: boolean;
  isGerenteOperacional: boolean;
  isGerenteFinanceiro: boolean;
  isNutricionista: boolean;
  isEstoquista: boolean;
  isComprador: boolean;
  canSeeCosts: boolean;
  canManage: boolean;
  canManageUsers: boolean;
  canApprove: boolean;
  isFinanceiro: boolean;
  canWrite: boolean;
  canAccessRecebimento: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // Ensure profile exists (creates one if missing, using company from user_roles)
    const { data: ensuredProfile, error: ensureError } = await supabase.rpc("rpc_ensure_profile");

    if (ensureError) {
      const msg = ensureError.message || "";
      if (msg.includes("sem empresa vinculada")) {
        console.error("Usuário sem empresa vinculada.");
        setProfile(null);
        setRole(null);
        // Sign out so the user sees the error on login
        await supabase.auth.signOut();
        toast.error("Usuário sem empresa vinculada. Contate o administrador.");
        return;
      }
      // Non-critical: fall through to direct query
      console.warn("rpc_ensure_profile warning:", msg);
    }

    if (ensuredProfile) {
      setProfile(ensuredProfile as unknown as Profile);
    } else {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setProfile(profileData as Profile | null);
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    setRole((roleData?.role as AppRole) || null);
    setRoleLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { error: error as Error | null, role: null as AppRole | null };
    // Fetch role immediately so caller can redirect
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const userRole = (roleData?.role as AppRole) || null;
    return { error: null as Error | null, role: userRole };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRole(null);
  };

  const isCeo = role === "ceo";
  const isGerenteOperacional = role === "gerente_operacional";
  const isGerenteFinanceiro = role === "gerente_financeiro";
  const isFinanceiro = role === "gerente_financeiro";
  const isNutricionista = role === "nutricionista";
  const isEstoquista = role === "ceo" || role === "gerente_operacional" || role === "estoquista";
  const isComprador = role === "ceo" || role === "gerente_operacional" || role === "comprador";
  const canSeeCosts = role === "ceo" || role === "gerente_financeiro";
  const canManage = role === "ceo" || role === "gerente_financeiro" || role === "gerente_operacional";
  const canManageUsers = role === "ceo" || role === "gerente_operacional";
  const canApprove = role === "ceo" || role === "gerente_financeiro";
  const canWrite = !!role && role !== "gerente_financeiro";
  const canAccessRecebimento = role === "ceo" || role === "gerente_operacional" || role === "estoquista";

  return (
    <AuthContext.Provider
      value={{
        user, session, profile, role, loading, signIn, signOut,
        isCeo, isGerenteOperacional, isGerenteFinanceiro, isNutricionista,
        isEstoquista, isComprador, canSeeCosts, canManage, canManageUsers, canApprove,
        isFinanceiro, canWrite, canAccessRecebimento,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
