// Edge Function: admin-bulk-reset
// One-shot helper to standardize test users (reset existing + create missing).
// Skips the protected user kellyalmeida.aiprojects@gmail.com.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COMPANY_ID = "a0000000-0000-0000-0000-000000000001";
const PROTECTED_EMAIL = "kellyalmeida.aiprojects@gmail.com";

// Mapping: standardized email → { existing email to migrate (or null), role, full_name, unidade_id (optional) }
type Plan = {
  standardEmail: string;
  password: string;
  role: "ceo" | "gerente_operacional" | "gerente_financeiro" | "nutricionista" | "estoquista" | "comprador";
  full_name: string;
  resetExisting: string | null; // existing email to also reset (legacy account)
  unidade_id?: string | null;
};

const PLAN: Plan[] = [
  { standardEmail: "ceo@yassuo.com",         password: "Yassuo@ceo1234",         role: "ceo",                 full_name: "CEO Yassuo",         resetExisting: "caio.bigatao@yassuo.com" },
  { standardEmail: "operacional@yassuo.com", password: "Yassuo@operacional1234", role: "gerente_operacional", full_name: "Gerente Operacional", resetExisting: "operacional@yassuo.com" },
  { standardEmail: "financeiro@yassuo.com",  password: "Yassuo@financeiro1234",  role: "gerente_financeiro",  full_name: "Gerente Financeiro",  resetExisting: "karen.financeiro@yassuo.com" },
  { standardEmail: "nutri@yassuo.com",       password: "Yassuo@nutri1234",       role: "nutricionista",       full_name: "Nutricionista",       resetExisting: "kelly.lbpinho@gmail.com",        unidade_id: "01c7a621-2cf2-4832-9c3d-7b1e0e0363d9" },
  { standardEmail: "estoque@yassuo.com",     password: "Yassuo@estoque1234",     role: "estoquista",          full_name: "Estoquista CD",       resetExisting: "kellyalmeidamundovem@gmail.com", unidade_id: "ea301c23-3d7b-4b7c-9d50-ce7d56973a59" },
  { standardEmail: "compras@yassuo.com",     password: "Yassuo@compras1234",     role: "comprador",           full_name: "Comprador",           resetExisting: "kelly351.almeida@gmail.com",     unidade_id: "ea301c23-3d7b-4b7c-9d50-ce7d56973a59" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: any[] = [];

    // Helper: find user by email (paginated)
    async function findUserByEmail(email: string) {
      let page = 1;
      while (page < 20) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        const found = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (found) return found;
        if (data.users.length < 200) return null;
        page++;
      }
      return null;
    }

    async function ensureProfileAndRole(userId: string, email: string, full_name: string, role: Plan["role"], unidade_id?: string | null) {
      // Upsert profile
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        await supabase.from("profiles").update({
          full_name, email, cargo: role, company_id: COMPANY_ID, ativo: true,
          ...(unidade_id !== undefined ? { unidade_id } : {}),
        }).eq("user_id", userId);
      } else {
        await supabase.from("profiles").insert({
          user_id: userId, full_name, email, cargo: role, company_id: COMPANY_ID, ativo: true,
          unidade_id: unidade_id ?? null,
        });
      }

      // Upsert user_roles
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("company_id", COMPANY_ID)
        .maybeSingle();

      if (existingRole) {
        await supabase.from("user_roles").update({ role }).eq("id", existingRole.id);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role, company_id: COMPANY_ID });
      }

      // Optional unit linkage
      if (unidade_id) {
        const { data: existingLink } = await supabase
          .from("user_unidades")
          .select("id")
          .eq("user_id", userId)
          .eq("unidade_id", unidade_id)
          .maybeSingle();
        if (!existingLink) {
          await supabase.from("user_unidades").insert({ user_id: userId, unidade_id, company_id: COMPANY_ID });
        }
      }
    }

    for (const item of PLAN) {
      const log: any = { standardEmail: item.standardEmail, actions: [] };

      // 1) Reset legacy existing account if it differs from standard email and is not protected
      if (item.resetExisting && item.resetExisting.toLowerCase() !== PROTECTED_EMAIL.toLowerCase()) {
        if (item.resetExisting.toLowerCase() !== item.standardEmail.toLowerCase()) {
          const legacy = await findUserByEmail(item.resetExisting);
          if (legacy) {
            const { error } = await supabase.auth.admin.updateUserById(legacy.id, { password: item.password });
            log.actions.push({ resetLegacy: item.resetExisting, ok: !error, error: error?.message });
          } else {
            log.actions.push({ resetLegacy: item.resetExisting, ok: false, error: "not found" });
          }
        }
      }

      // 2) Ensure standardized account exists with the desired password
      let standard = await findUserByEmail(item.standardEmail);
      if (standard) {
        const { error } = await supabase.auth.admin.updateUserById(standard.id, { password: item.password, email_confirm: true });
        log.actions.push({ updateStandard: item.standardEmail, ok: !error, error: error?.message });
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email: item.standardEmail,
          password: item.password,
          email_confirm: true,
          user_metadata: { full_name: item.full_name, cargo: item.role, company_id: COMPANY_ID },
        });
        if (error || !data.user) {
          log.actions.push({ createStandard: item.standardEmail, ok: false, error: error?.message });
          results.push(log);
          continue;
        }
        standard = data.user;
        log.actions.push({ createStandard: item.standardEmail, ok: true });
      }

      // 3) Ensure profile + role + unit linkage
      try {
        await ensureProfileAndRole(standard!.id, item.standardEmail, item.full_name, item.role, item.unidade_id ?? null);
        log.actions.push({ profileRole: "ok" });
      } catch (e) {
        log.actions.push({ profileRole: "error", error: (e as Error).message });
      }

      results.push(log);
    }

    return new Response(JSON.stringify({ ok: true, protected: PROTECTED_EMAIL, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
