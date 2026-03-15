import * as XLSX from "xlsx";

interface EstoqueExportData {
  produtos: {
    nome: string;
    categoria: string;
    unidade_medida: string;
    estoque_atual: number;
    estoque_minimo: number;
    custo_unitario: number;
    valor_em_estoque: number;
    unidade: string;
  }[];
  lotes: {
    produto: string;
    codigo: string;
    quantidade: number;
    validade: string;
    status: string;
    unidade: string;
  }[];
  canSeeCosts: boolean;
}

export function exportEstoqueExcel(data: EstoqueExportData) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Inventário
  const prodHeaders = ["Produto", "Categoria", "Unid. Medida", "Estoque Atual", "Estoque Mínimo", "Unidade"];
  if (data.canSeeCosts) {
    prodHeaders.push("Custo Unit. (R$)", "Valor em Estoque (R$)");
  }

  const prodRows = data.produtos.map((p) => {
    const row: (string | number)[] = [p.nome, p.categoria, p.unidade_medida, p.estoque_atual, p.estoque_minimo, p.unidade];
    if (data.canSeeCosts) {
      row.push(p.custo_unitario, p.valor_em_estoque);
    }
    return row;
  });

  const ws1 = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
  ws1["!cols"] = prodHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws1, "Inventário");

  // Sheet 2: Lotes
  if (data.lotes.length > 0) {
    const loteHeaders = ["Produto", "Lote", "Quantidade", "Validade", "Status", "Unidade"];
    const loteRows = data.lotes.map((l) => [l.produto, l.codigo, l.quantidade, l.validade, l.status, l.unidade]);
    const ws2 = XLSX.utils.aoa_to_sheet([loteHeaders, ...loteRows]);
    ws2["!cols"] = loteHeaders.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws2, "Lotes");
  }

  XLSX.writeFile(wb, `estoque-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ──────────────────── Insumos Forecast Excel ────────────────────

interface InsumosExportData {
  weekLabel: string;
  unitName: string;
  numColaboradores: number;
  items: {
    ingrediente: string;
    unidade: string;
    categoria: string;
    necessario: number;
    estoque: number;
    falta: number;
    custoUnit: number;
    custoTotal: number;
  }[];
}

export function exportInsumosExcel(data: InsumosExportData) {
  const wb = XLSX.utils.book_new();

  const totalItems = data.items.length;
  const itemsFalta = data.items.filter(i => i.falta > 0).length;
  const totalCost = data.items.reduce((s, i) => s + i.custoTotal, 0);
  const deficitCost = data.items.filter(i => i.falta > 0).reduce((s, i) => s + i.falta * i.custoUnit, 0);

  const info: (string | number)[][] = [
    ["Planejamento de Insumos"],
    [`Período: ${data.weekLabel}`],
    [`Unidade: ${data.unitName}`],
    [`Refeições/dia: ${data.numColaboradores}`],
    [],
    ["Resumo Executivo"],
    ["Ingredientes planejados", totalItems],
    ["Itens em falta", itemsFalta],
    ["Custo total previsto (R$)", totalCost],
    ["Custo em déficit (R$)", deficitCost],
    [],
  ];

  const headers = ["Categoria", "Ingrediente", "Unidade", "Necessário", "Estoque Atual", "Falta", "Status", "Custo Unit. (R$)", "Custo Total (R$)"];
  const rows = data.items.map(i => {
    const balance = i.estoque - i.necessario;
    const status = i.falta > 0 ? "FALTA" : (balance / Math.max(i.necessario, 0.01) <= 0.2 ? "ATENÇÃO" : "OK");
    return [i.categoria, i.ingrediente, i.unidade, i.necessario, i.estoque, i.falta, status, i.custoUnit, i.custoTotal];
  });

  // Sort by category then name
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));

  const ws = XLSX.utils.aoa_to_sheet([...info, headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "Previsão de Insumos");

  XLSX.writeFile(wb, `planejamento-insumos-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
