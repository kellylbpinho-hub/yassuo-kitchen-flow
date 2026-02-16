import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["ceo", "gerente_operacional", "gerente_financeiro", "nutricionista", "estoquista", "comprador"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!callerRole || !["ceo", "gerente_operacional"].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Sem permissão para criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, full_name, cargo, unidade_id, unidade_ids, company_id } = await req.json();

    // Resolve company_id: use provided or get from caller's profile
    let resolvedCompanyId = company_id;
    if (!resolvedCompanyId) {
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("company_id")
        .eq("user_id", caller.id)
        .maybeSingle();
      resolvedCompanyId = callerProfile?.company_id;
    }
    if (!resolvedCompanyId) {
      return new Response(JSON.stringify({ error: "company_id não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_ROLES.includes(cargo)) {
      return new Response(JSON.stringify({ error: `Cargo inválido: ${cargo}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, cargo, company_id: resolvedCompanyId },
    });

    if (userError) {
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const primaryUnit = unidade_ids?.[0] || unidade_id || null;
    await supabaseAdmin.from("profiles").update({
      full_name,
      cargo,
      unidade_id: primaryUnit,
      company_id: resolvedCompanyId,
    }).eq("user_id", userId);

    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: cargo,
      company_id: resolvedCompanyId,
    }, { onConflict: "user_id" });

    const unitIds: string[] = unidade_ids || (unidade_id ? [unidade_id] : []);
    if (unitIds.length > 0) {
      const links = unitIds.map((uid: string) => ({
        user_id: userId,
        unidade_id: uid,
        company_id: resolvedCompanyId,
      }));
      await supabaseAdmin.from("user_unidades").insert(links);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
