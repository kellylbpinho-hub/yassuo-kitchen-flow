import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, token } = await req.json();

    // Action: "validate" — check if token is valid (public, no auth needed)
    if (action === "validate") {
      const { data: invite, error } = await supabaseAdmin
        .from("invitations")
        .select("id, token, cargo, unidade_ids, expires_at, status, company_id, companies(nome)")
        .eq("token", token)
        .maybeSingle();

      if (error || !invite) {
        return new Response(JSON.stringify({ error: "Convite não encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invite.status !== "pendente") {
        return new Response(JSON.stringify({ error: "Este convite já foi utilizado." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Este convite expirou." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        valid: true,
        cargo: invite.cargo,
        company_name: (invite as any).companies?.nome || "Empresa",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: "accept" — requires authenticated user
    if (action === "accept") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get and validate invite
      const { data: invite, error: inviteError } = await supabaseAdmin
        .from("invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (inviteError || !invite) {
        return new Response(JSON.stringify({ error: "Convite não encontrado." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (invite.status !== "pendente") {
        return new Response(JSON.stringify({ error: "Este convite já foi utilizado." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Este convite expirou." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = user.id;
      const companyId = invite.company_id;
      const cargo = invite.cargo;
      const unidadeIds: string[] = invite.unidade_ids || [];
      const primaryUnit = unidadeIds[0] || null;

      // Upsert profile
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingProfile) {
        await supabaseAdmin.from("profiles").update({
          cargo,
          company_id: companyId,
          unidade_id: primaryUnit,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
        }).eq("user_id", userId);
      } else {
        await supabaseAdmin.from("profiles").insert({
          user_id: userId,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          cargo,
          company_id: companyId,
          unidade_id: primaryUnit,
        });
      }

      // Upsert role
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: cargo,
        company_id: companyId,
      }, { onConflict: "user_id" });

      // Link units
      if (unidadeIds.length > 0) {
        // Remove old links
        await supabaseAdmin.from("user_unidades").delete().eq("user_id", userId);
        const links = unidadeIds.map((uid: string) => ({
          user_id: userId,
          unidade_id: uid,
          company_id: companyId,
        }));
        await supabaseAdmin.from("user_unidades").insert(links);
      }

      // Mark invite as used
      await supabaseAdmin.from("invitations").update({
        status: "usado",
        used_by: userId,
      }).eq("id", invite.id);

      return new Response(JSON.stringify({
        success: true,
        role: cargo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
