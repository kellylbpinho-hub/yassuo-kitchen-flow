import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PurchaseOrderPDFData {
  orderId: string;
  date: string;
  unitName: string;
  status: string;
  items: { produto: string; quantidade: number; unidade: string; custoUnit: number | null; total: number | null }[];
}

export function generatePurchaseOrderPDF(data: PurchaseOrderPDFData) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestão de Food Service", 14, 26);

  doc.setDrawColor(200);
  doc.line(14, 30, 196, 30);

  // Order info
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Ordem de Compra", 14, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº Pedido: ${data.orderId.substring(0, 8).toUpperCase()}`, 14, 48);
  doc.text(`Data: ${data.date}`, 14, 54);
  doc.text(`Unidade: ${data.unitName}`, 14, 60);
  doc.text(`Status: ${data.status}`, 14, 66);

  // Table
  const tableData = data.items.map((item) => [
    item.produto,
    item.quantidade.toString(),
    item.unidade,
    item.custoUnit != null ? `R$ ${item.custoUnit.toFixed(2)}` : "—",
    item.total != null ? `R$ ${item.total.toFixed(2)}` : "—",
  ]);

  const totalGeral = data.items.reduce((s, i) => s + (i.total || 0), 0);

  autoTable(doc, {
    startY: 74,
    head: [["Produto", "Qtd", "Unidade", "Preço Unit.", "Total"]],
    body: tableData,
    foot: [["", "", "", "Total Geral:", `R$ ${totalGeral.toFixed(2)}`]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    theme: "grid",
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`ordem-compra-${data.orderId.substring(0, 8)}.pdf`);
}

interface RequisicaoInternaData {
  menuName: string;
  unitName: string;
  numColaboradores: number;
  date: string;
  items: { produto: string; quantidade: number; unidade: string }[];
}

export function generateRequisicaoInternaPDF(data: RequisicaoInternaData) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Requisição Interna de Insumos", 14, 26);

  doc.setDrawColor(200);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Requisição para Produção", 14, 40);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Cardápio: ${data.menuName}`, 14, 48);
  doc.text(`Unidade: ${data.unitName}`, 14, 54);
  doc.text(`Colaboradores: ${data.numColaboradores}`, 14, 60);
  doc.text(`Data: ${data.date}`, 14, 66);

  autoTable(doc, {
    startY: 74,
    head: [["Produto", "Quantidade Necessária", "Unidade"]],
    body: data.items.map((i) => [i.produto, i.quantidade.toFixed(3), i.unidade]),
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
  });

  // Signature area
  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(9);
  doc.text("Solicitado por: ___________________________", 14, finalY + 20);
  doc.text("Liberado por: ___________________________", 14, finalY + 30);
  doc.text("Data: ___/___/______", 14, finalY + 40);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação`, 14, doc.internal.pageSize.height - 10);

  doc.save(`requisicao-interna-${data.menuName.replace(/\s/g, "-").substring(0, 20)}.pdf`);
}

export function generatePerformancePDF(dashData: {
  sobraLimpa: number;
  restoIngesta: number;
  custoMedioRefeicao: number;
  perdasKg: number;
  rankingUnidades: { name: string; desperdicio: number }[];
  canSeeCosts: boolean;
}) {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Performance", 14, 26);
  doc.text(`Período: ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`, 14, 32);

  doc.setDrawColor(200);
  doc.line(14, 36, 196, 36);

  // KPIs
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores do Mês", 14, 46);

  const kpis: string[][] = [
    ["Sobra Limpa (kg)", dashData.sobraLimpa.toFixed(2)],
    ["Resto Ingesta (kg)", dashData.restoIngesta.toFixed(2)],
    ["Total Perdas (kg)", dashData.perdasKg.toFixed(2)],
  ];
  if (dashData.canSeeCosts) {
    kpis.push(["Custo Médio por Refeição", `R$ ${dashData.custoMedioRefeicao.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: 52,
    head: [["Indicador", "Valor"]],
    body: kpis,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" } },
  });

  // Ranking
  if (dashData.rankingUnidades.length > 0) {
    const y2 = (doc as any).lastAutoTable?.finalY || 90;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Desperdício por Unidade", 14, y2 + 12);

    autoTable(doc, {
      startY: y2 + 18,
      head: [["Unidade", "Desperdício (kg)"]],
      body: dashData.rankingUnidades.map((u) => [u.name, u.desperdicio.toFixed(2)]),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [30, 30, 30], textColor: 255 },
      theme: "grid",
      columnStyles: { 1: { halign: "right" } },
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação`, 14, doc.internal.pageSize.height - 10);

  doc.save(`relatorio-performance-${new Date().toISOString().slice(0, 7)}.pdf`);
}
