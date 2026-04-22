/**
 * Seed de dados fictícios para demonstração.
 * IMPORTANTE: Requer usuário autenticado com cargo CEO ou gerente_operacional
 * para passar pelas políticas RLS. Use apenas em ambiente de desenvolvimento.
 */
import { supabase } from "@/integrations/supabase/client";

type SeedResult = {
  success: boolean;
  message: string;
  details?: Record<string, number>;
};

const PRODUCT_SEEDS = [
  { nome: "Arroz Branco Tipo 1", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 30, custo: 6.5, marca: "Tio João" },
  { nome: "Feijão Carioca", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 25, custo: 8.9, marca: "Camil" },
  { nome: "Frango Peito Resfriado", categoria: "Proteínas", unidade_medida: "kg", estoque_minimo: 20, custo: 18.5, marca: "Sadia" },
  { nome: "Óleo de Soja", categoria: "Mercearia", unidade_medida: "L", estoque_minimo: 15, custo: 7.2, marca: "Soya" },
  { nome: "Sal Refinado", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 10, custo: 2.1, marca: "Cisne" },
  { nome: "Cebola Branca", categoria: "Hortifruti", unidade_medida: "kg", estoque_minimo: 12, custo: 4.5, marca: "Hortifruti Amazônia" },
  { nome: "Alho Nacional", categoria: "Hortifruti", unidade_medida: "kg", estoque_minimo: 5, custo: 28.0, marca: "Hortifruti Amazônia" },
  { nome: "Tomate Italiano", categoria: "Hortifruti", unidade_medida: "kg", estoque_minimo: 15, custo: 6.8, marca: "Hortifruti Amazônia" },
  { nome: "Batata Inglesa", categoria: "Hortifruti", unidade_medida: "kg", estoque_minimo: 20, custo: 5.2, marca: "Hortifruti Amazônia" },
  { nome: "Macarrão Espaguete", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 12, custo: 6.3, marca: "Renata" },
  { nome: "Açúcar Refinado", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 10, custo: 4.8, marca: "União" },
  { nome: "Café Torrado e Moído", categoria: "Bebidas", unidade_medida: "kg", estoque_minimo: 8, custo: 32.5, marca: "Pilão" },
  { nome: "Leite Integral UHT", categoria: "Laticínios", unidade_medida: "L", estoque_minimo: 20, custo: 5.4, marca: "Italac" },
  { nome: "Ovos Brancos", categoria: "Proteínas", unidade_medida: "un", estoque_minimo: 60, custo: 0.65, marca: "Granja Norte" },
  { nome: "Farinha de Trigo", categoria: "Mercearia", unidade_medida: "kg", estoque_minimo: 15, custo: 4.5, marca: "Dona Benta" },
];

const FORNECEDOR_SEEDS = [
  { nome: "Distribuidora Pará Alimentos", cnpj: "12.345.678/0001-90", contato: "Carlos Mendes", telefone: "(91) 3222-1100", email: "vendas@paraalimentos.com.br", categoria: "Mercearia", condicao_pagamento: "30 dias" },
  { nome: "Frigorífico Norte Proteínas", cnpj: "23.456.789/0001-80", contato: "Mariana Silva", telefone: "(91) 3333-2200", email: "comercial@norteproteinas.com.br", categoria: "Proteínas", condicao_pagamento: "21 dias" },
  { nome: "Hortifruti Amazônia", cnpj: "34.567.890/0001-70", contato: "João Pereira", telefone: "(91) 3444-3300", email: "pedidos@hortifrutiamazonia.com.br", categoria: "Hortifruti", condicao_pagamento: "15 dias" },
];

const DISH_SEEDS = [
  { nome: "Arroz com Feijão e Frango Grelhado", categoria: "Prato Principal", peso_porcao: 0.45 },
  { nome: "Macarrão à Bolonhesa", categoria: "Prato Principal", peso_porcao: 0.4 },
  { nome: "Bife Acebolado com Batata", categoria: "Prato Principal", peso_porcao: 0.42 },
  { nome: "Frango Assado com Legumes", categoria: "Prato Principal", peso_porcao: 0.4 },
  { nome: "Feijoada Light", categoria: "Prato Principal", peso_porcao: 0.5 },
  { nome: "Salada Tropical", categoria: "Acompanhamento", peso_porcao: 0.15 },
  { nome: "Purê de Batata", categoria: "Acompanhamento", peso_porcao: 0.18 },
  { nome: "Arroz Branco", categoria: "Acompanhamento", peso_porcao: 0.15 },
  { nome: "Feijão Carioca", categoria: "Acompanhamento", peso_porcao: 0.12 },
  { nome: "Farofa de Cebola", categoria: "Acompanhamento", peso_porcao: 0.05 },
];

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

export async function runSeed(): Promise<SeedResult> {
  try {
    // 1. Verifica auth e perfil
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Faça login como CEO antes de carregar a demo." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, cargo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return { success: false, message: "Perfil sem empresa vinculada." };
    }

    const company_id = profile.company_id;
    const counts: Record<string, number> = {};

    // 2. Garante unidades CD e Cozinha Central
    const { data: existingUnits } = await supabase
      .from("units")
      .select("id, name, type")
      .eq("company_id", company_id);

    let cdUnit = existingUnits?.find((u) => u.type === "cd");
    let kitchenUnit = existingUnits?.find((u) => u.name === "Cozinha Central")
      || existingUnits?.find((u) => u.type === "kitchen");

    if (!cdUnit) {
      const { data, error } = await supabase
        .from("units")
        .insert({ name: "CD Depósito", type: "cd", company_id, numero_colaboradores: 5 })
        .select("id, name, type")
        .single();
      if (error) throw new Error(`Unidades CD: ${error.message}`);
      cdUnit = data;
      counts.units_created = (counts.units_created || 0) + 1;
    }

    if (!kitchenUnit) {
      const { data, error } = await supabase
        .from("units")
        .insert({
          name: "Cozinha Central",
          type: "kitchen",
          company_id,
          numero_colaboradores: 100,
          target_meal_cost: 12.5,
          contract_value: 95000,
        })
        .select("id, name, type")
        .single();
      if (error) throw new Error(`Unidades Cozinha: ${error.message}`);
      kitchenUnit = data;
      counts.units_created = (counts.units_created || 0) + 1;
    }

    // 3. Fornecedores
    const fornecedorIds: string[] = [];
    for (const f of FORNECEDOR_SEEDS) {
      const { data: existing } = await supabase
        .from("fornecedores")
        .select("id")
        .eq("company_id", company_id)
        .eq("nome", f.nome)
        .maybeSingle();
      if (existing) {
        fornecedorIds.push(existing.id);
        continue;
      }
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({ ...f, company_id, ativo: true })
        .select("id")
        .single();
      if (error) throw new Error(`Fornecedor ${f.nome}: ${error.message}`);
      fornecedorIds.push(data.id);
      counts.fornecedores = (counts.fornecedores || 0) + 1;
    }

    // 4. Produtos + lotes no CD
    const productIds: { id: string; nome: string; custo: number; um: string }[] = [];
    for (const p of PRODUCT_SEEDS) {
      const { data: existing } = await supabase
        .from("products")
        .select("id, nome, custo_unitario, unidade_medida")
        .eq("company_id", company_id)
        .eq("nome", p.nome)
        .maybeSingle();

      let productId: string;
      if (existing) {
        productId = existing.id;
        await supabase
          .from("products")
          .update({
            custo_unitario: p.custo,
            estoque_minimo: p.estoque_minimo,
            categoria: p.categoria,
            marca: p.marca,
          })
          .eq("id", productId);
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert({
            nome: p.nome,
            categoria: p.categoria,
            marca: p.marca,
            unidade_medida: p.unidade_medida,
            estoque_minimo: p.estoque_minimo,
            custo_unitario: p.custo,
            unidade_id: cdUnit!.id,
            company_id,
            ativo: true,
            validade_minima_dias: 30,
          })
          .select("id")
          .single();
        if (error) throw new Error(`Produto ${p.nome}: ${error.message}`);
        productId = data.id;
        counts.products = (counts.products || 0) + 1;
      }

      productIds.push({ id: productId, nome: p.nome, custo: p.custo, um: p.unidade_medida });

      // Lote ativo (se não houver)
      const { data: existingLote } = await supabase
        .from("lotes")
        .select("id")
        .eq("product_id", productId)
        .eq("unidade_id", cdUnit!.id)
        .eq("status", "ativo")
        .gt("quantidade", 0)
        .limit(1)
        .maybeSingle();

      if (!existingLote) {
        const qtd = Math.max(p.estoque_minimo * 2, 30);
        const validadeDias = 60 + Math.floor(Math.random() * 120);
        const { error: loteErr } = await supabase
          .from("lotes")
          .insert({
            product_id: productId,
            unidade_id: cdUnit!.id,
            company_id,
            quantidade: qtd,
            validade: todayPlus(validadeDias),
            codigo: `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 999)}`,
            status: "ativo",
            entrada_manual: false,
          });
        if (loteErr) throw new Error(`Lote ${p.nome}: ${loteErr.message}`);
        counts.lotes = (counts.lotes || 0) + 1;

        await supabase
          .from("products")
          .update({ estoque_atual: qtd })
          .eq("id", productId);
      }
    }

    // 5. Compras: 9 ordens aprovadas nas últimas 2 semanas
    for (let i = 0; i < 9; i++) {
      const fornecedorId = fornecedorIds[i % fornecedorIds.length];
      const diasAtras = Math.floor(Math.random() * 14);
      const { data: order, error: orderErr } = await supabase
        .from("purchase_orders")
        .insert({
          company_id,
          unidade_id: cdUnit!.id,
          fornecedor_id: fornecedorId,
          created_by: user.id,
          approved_by: user.id,
          status: "aprovada",
          observacao: `Pedido demo #${i + 1}`,
        })
        .select("id, created_at")
        .single();
      if (orderErr) throw new Error(`Ordem compra ${i}: ${orderErr.message}`);

      // backdate
      await supabase
        .from("purchase_orders")
        .update({ created_at: daysAgo(diasAtras), updated_at: daysAgo(diasAtras) })
        .eq("id", order.id);

      const itens = pick(productIds, 3 + Math.floor(Math.random() * 4));
      for (const it of itens) {
        const qtd = 10 + Math.floor(Math.random() * 40);
        const { error: itemErr } = await supabase
          .from("purchase_items")
          .insert({
            company_id,
            purchase_order_id: order.id,
            product_id: it.id,
            quantidade: qtd,
            quantidade_estoque: qtd,
            custo_unitario: it.custo,
            fator_conversao: 1,
            purchase_unit_nome: it.um,
          });
        if (itemErr) throw new Error(`Item compra: ${itemErr.message}`);
      }
      counts.purchase_orders = (counts.purchase_orders || 0) + 1;
    }

    // 6. Pratos (biblioteca)
    const dishIds: { id: string; nome: string }[] = [];
    for (const d of DISH_SEEDS) {
      const { data: existingDish } = await supabase
        .from("dishes")
        .select("id, nome")
        .eq("company_id", company_id)
        .eq("nome", d.nome)
        .maybeSingle();
      if (existingDish) {
        dishIds.push(existingDish);
        continue;
      }
      const { data, error } = await supabase
        .from("dishes")
        .insert({
          nome: d.nome,
          peso_porcao: d.peso_porcao,
          company_id,
          created_by: user.id,
          ativo: true,
        })
        .select("id, nome")
        .single();
      if (error) throw new Error(`Prato ${d.nome}: ${error.message}`);
      dishIds.push(data);
      counts.dishes = (counts.dishes || 0) + 1;
    }

    // 7. Cardápio: 5 dias (segunda a sexta) com 2-3 pratos cada
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=dom, 1=seg
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    const menuIds: string[] = [];
    for (let d = 0; d < 5; d++) {
      const data = new Date(monday);
      data.setDate(monday.getDate() + d);
      const dataStr = data.toISOString().split("T")[0];

      const { data: existingMenu } = await supabase
        .from("menus")
        .select("id")
        .eq("company_id", company_id)
        .eq("unidade_id", kitchenUnit!.id)
        .eq("data", dataStr)
        .maybeSingle();

      let menuId: string;
      if (existingMenu) {
        menuId = existingMenu.id;
      } else {
        const { data: menu, error: menuErr } = await supabase
          .from("menus")
          .insert({
            company_id,
            unidade_id: kitchenUnit!.id,
            data: dataStr,
            nome: `Cardápio ${data.toLocaleDateString("pt-BR", { weekday: "long" })}`,
            descricao: `${80 + Math.floor(Math.random() * 41)} refeições previstas`,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (menuErr) throw new Error(`Cardápio ${dataStr}: ${menuErr.message}`);
        menuId = menu.id;
        counts.menus = (counts.menus || 0) + 1;
      }
      menuIds.push(menuId);

      // Anexa 2-3 pratos
      const dishesForDay = pick(dishIds, 2 + Math.floor(Math.random() * 2));
      for (let idx = 0; idx < dishesForDay.length; idx++) {
        const { data: existingMd } = await supabase
          .from("menu_dishes")
          .select("id")
          .eq("menu_id", menuId)
          .eq("dish_id", dishesForDay[idx].id)
          .maybeSingle();
        if (existingMd) continue;
        await supabase.from("menu_dishes").insert({
          company_id,
          menu_id: menuId,
          dish_id: dishesForDay[idx].id,
          ordem: idx,
        });
      }
    }

    // 8. Desperdício: 5 registros na última semana
    for (let i = 0; i < 5; i++) {
      const menuId = menuIds[i % menuIds.length];
      const dishForWaste = dishIds[Math.floor(Math.random() * dishIds.length)];
      const sobraPrato = +(2 + Math.random() * 5).toFixed(2);
      const sobraRampa = +(1 + Math.random() * 3).toFixed(2);
      const totalOrganico = +(sobraPrato + sobraRampa + Math.random() * 2).toFixed(2);

      const { error: wErr } = await supabase.from("waste_logs").insert({
        company_id,
        unidade_id: kitchenUnit!.id,
        menu_id: menuId,
        dish_id: dishForWaste.id,
        user_id: user.id,
        quantidade: totalOrganico,
        sobra_prato: sobraPrato,
        sobra_limpa_rampa: sobraRampa,
        desperdicio_total_organico: totalOrganico,
        observacao: `Pesagens demo dia ${i + 1}`,
      });
      if (wErr) throw new Error(`Desperdício: ${wErr.message}`);
      counts.waste_logs = (counts.waste_logs || 0) + 1;
    }

    return {
      success: true,
      message: "Demo carregada com sucesso!",
      details: counts,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return { success: false, message: msg };
  }
}
