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
