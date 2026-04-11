import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "GET") {
    // Fetch quotation by token
    const { data: quotation, error: qErr } = await supabase
      .from("quotation_requests")
      .select("id, status, observacao, expires_at, fornecedor_id")
      .eq("token", token)
      .single();

    if (qErr || !quotation) {
      return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (new Date(quotation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Cotação expirada" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quotation.status !== "pendente") {
      return new Response(
        JSON.stringify({ error: "Cotação já foi respondida", status: quotation.status }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get supplier name
    const { data: fornecedor } = await supabase
      .from("fornecedores")
      .select("nome")
      .eq("id", quotation.fornecedor_id)
      .single();

    // Get items (only public info: name, unit, quantity)
    const { data: items } = await supabase
      .from("quotation_items")
      .select("id, nome_produto, unidade_medida, quantidade")
      .eq("quotation_id", quotation.id)
      .eq("adicionado_pelo_fornecedor", false)
      .order("created_at");

    return new Response(
      JSON.stringify({
        quotation_id: quotation.id,
        observacao: quotation.observacao,
        fornecedor_nome: fornecedor?.nome || "",
        items: items || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method === "POST") {
    const body = await req.json();
    const { quotation_id, items, new_items } = body;

    if (!quotation_id || !items) {
      return new Response(JSON.stringify({ error: "Dados incompletos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify quotation is valid and pending
    const { data: quotation, error: qErr } = await supabase
      .from("quotation_requests")
      .select("id, status, expires_at, company_id")
      .eq("token", token)
      .single();

    if (qErr || !quotation) {
      return new Response(JSON.stringify({ error: "Cotação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(quotation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Cotação expirada" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (quotation.status !== "pendente") {
      return new Response(JSON.stringify({ error: "Cotação já respondida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update prices for existing items
    for (const item of items) {
      if (!item.id || item.preco_unitario === undefined || item.preco_unitario === null) continue;
      const preco = Number(item.preco_unitario);
      if (isNaN(preco) || preco < 0) continue;

      await supabase
        .from("quotation_items")
        .update({
          preco_unitario: preco,
          observacao_fornecedor: item.observacao_fornecedor || null,
        })
        .eq("id", item.id)
        .eq("quotation_id", quotation.id);
    }

    // Add new items from supplier
    if (Array.isArray(new_items)) {
      for (const ni of new_items) {
        if (!ni.nome_produto || !ni.quantidade || !ni.preco_unitario) continue;
        await supabase.from("quotation_items").insert({
          quotation_id: quotation.id,
          company_id: quotation.company_id,
          nome_produto: String(ni.nome_produto).trim().substring(0, 255),
          unidade_medida: String(ni.unidade_medida || "kg").substring(0, 20),
          quantidade: Math.max(0, Number(ni.quantidade)),
          preco_unitario: Math.max(0, Number(ni.preco_unitario)),
          adicionado_pelo_fornecedor: true,
        });
      }
    }

    // Update quotation status
    await supabase
      .from("quotation_requests")
      .update({ status: "respondida", respondido_em: new Date().toISOString() })
      .eq("id", quotation.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Método não suportado" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
