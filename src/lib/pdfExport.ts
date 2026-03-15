import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ──────────────────── Purchase Order PDF ────────────────────

interface PurchaseOrderPDFData {
  orderNumber: string;
  date: string;
  unitName: string;
  status: string;
  items: {
    produto: string;
    quantidade: number;
    unidadeCompra: string;
    unidadeEstoque: string;
    equivalenteEstoque?: string;
    custoUnit: number | null;
    total: number | null;
  }[];
}

export function generatePurchaseOrderPDF(data: PurchaseOrderPDFData) {
  const doc = new jsPDF();
  addHeader(doc, "Ordem de Compra");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº Pedido: ${data.orderNumber}`, 14, 48);
  doc.text(`Data: ${data.date}`, 14, 54);
  doc.text(`Unidade: ${data.unitName}`, 14, 60);
  doc.text(`Status: ${data.status}`, 14, 66);

  const tableData = data.items.map((item) => [
    item.produto,
    item.quantidade.toString(),
    item.unidadeCompra,
    item.equivalenteEstoque || `${item.quantidade} ${item.unidadeEstoque}`,
    item.custoUnit != null ? `R$ ${item.custoUnit.toFixed(2)}` : "—",
    item.total != null ? `R$ ${item.total.toFixed(2)}` : "—",
  ]);

  const totalGeral = data.items.reduce((s, i) => s + (i.total || 0), 0);

  autoTable(doc, {
    startY: 74,
    head: [["Produto", "Qtd", "Und. Compra", "Equiv. Estoque", "Preço Unit.", "Total"]],
    body: tableData,
    foot: [["", "", "", "", "Total Geral:", `R$ ${totalGeral.toFixed(2)}`]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    theme: "grid",
  });

  addFooter(doc);
  doc.save(`${data.orderNumber}.pdf`);
}

// ──────────────────── Requisição Interna PDF ────────────────────

interface RequisicaoInternaData {
  menuName: string;
  unitName: string;
  numColaboradores: number;
  date: string;
  items: { produto: string; quantidade: number; unidade: string }[];
}

export function generateRequisicaoInternaPDF(data: RequisicaoInternaData) {
  const doc = new jsPDF();
  addHeader(doc, "Requisição Interna de Insumos");

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

  const finalY = (doc as any).lastAutoTable?.finalY || 120;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Solicitado por: ___________________________", 14, finalY + 20);
  doc.text("Liberado por: ___________________________", 14, finalY + 30);
  doc.text("Data: ___/___/______", 14, finalY + 40);

  addFooter(doc);
  doc.save(`requisicao-interna-${data.menuName.replace(/\s/g, "-").substring(0, 20)}.pdf`);
}

// ──────────────────── Performance PDF ────────────────────

export function generatePerformancePDF(dashData: {
  sobraLimpa: number;
  restoIngesta: number;
  custoMedioRefeicao: number;
  perdasKg: number;
  rankingUnidades: { name: string; desperdicio: number }[];
  canSeeCosts: boolean;
}) {
  const doc = new jsPDF();
  addHeader(doc, "Relatório de Performance");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`, 14, 48);

  const kpis: string[][] = [
    ["Sobra Limpa (kg)", dashData.sobraLimpa.toFixed(2)],
    ["Resto Ingesta (kg)", dashData.restoIngesta.toFixed(2)],
    ["Total Perdas (kg)", dashData.perdasKg.toFixed(2)],
  ];
  if (dashData.canSeeCosts) {
    kpis.push(["Custo Médio por Refeição", `R$ ${dashData.custoMedioRefeicao.toFixed(2)}`]);
  }

  autoTable(doc, {
    startY: 56,
    head: [["Indicador", "Valor"]],
    body: kpis,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" } },
  });

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

  addFooter(doc);
  doc.save(`relatorio-performance-${new Date().toISOString().slice(0, 7)}.pdf`);
}

// ──────────────────── Internal Order PDF ────────────────────

interface InternalOrderPDFData {
  numero: number;
  date: string;
  originName: string;
  destName: string;
  solicitante: string;
  observacao: string | null;
  status: string;
  items: {
    produto: string;
    unidade: string;
    qtdSolicitada: number;
    qtdAprovada: number | null;
    status: string;
    observacao: string | null;
  }[];
}

export function generateInternalOrderPDF(data: InternalOrderPDFData) {
  const doc = new jsPDF();
  addHeader(doc, "Pedido Interno");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Pedido Nº: ${data.numero}`, 14, 48);
  doc.text(`Data/Hora: ${data.date}`, 14, 54);
  doc.text(`Unidade Solicitante: ${data.destName}`, 14, 60);
  doc.text(`CD de Origem: ${data.originName}`, 14, 66);
  doc.text(`Solicitante: ${data.solicitante}`, 14, 72);
  doc.text(`Status: ${data.status}`, 14, 78);
  if (data.observacao) {
    doc.text(`Observação: ${data.observacao}`, 14, 84);
  }

  const startY = data.observacao ? 92 : 86;

  autoTable(doc, {
    startY,
    head: [["Produto", "Und", "Qtd Solicitada", "Qtd Aprovada", "Status", "Obs"]],
    body: data.items.map((i) => [
      i.produto,
      i.unidade,
      i.qtdSolicitada.toString(),
      i.qtdAprovada != null ? i.qtdAprovada.toString() : "—",
      i.status,
      i.observacao || "",
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // Signature area
  const finalY = (doc as any).lastAutoTable?.finalY || 140;
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Conferido por: ___________________________", 14, finalY + 20);
  doc.text("Assinatura: ___________________________", 14, finalY + 30);
  doc.text("Data: ___/___/______", 14, finalY + 40);

  addFooter(doc);
  doc.save(`pedido-interno-${data.numero}.pdf`);
}

// ──────────────────── Menu PDF (Simple) ────────────────────

interface MenuPDFDay {
  dayLabel: string;
  dateLabel: string;
  status: string;
  dishes: { nome: string; category: string }[];
}

interface MenuPDFData {
  weekLabel: string;
  unitName?: string;
  days: MenuPDFDay[];
}

export function generateMenuWeekPDF(data: MenuPDFData) {
  const doc = new jsPDF();
  addHeader(doc, "Cardápio Semanal");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Semana: ${data.weekLabel}`, 14, 48);
  if (data.unitName) doc.text(`Unidade: ${data.unitName}`, 14, 54);

  let yPos = data.unitName ? 62 : 56;

  for (const day of data.days) {
    // Check page break
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`${day.dayLabel} — ${day.dateLabel}`, 14, yPos);
    yPos += 5;

    if (day.status !== "Com cardápio" && day.status !== "com_cardapio") {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text(day.status, 18, yPos);
      yPos += 8;
      continue;
    }

    if (day.dishes.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text("Nenhum prato definido", 18, yPos);
      yPos += 8;
      continue;
    }

    // Group by category
    const groups: Record<string, string[]> = {};
    for (const d of day.dishes) {
      const cat = d.category || "Geral";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d.nome);
    }

    for (const [cat, dishes] of Object.entries(groups)) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80);
      doc.text(cat.toUpperCase(), 18, yPos);
      yPos += 4;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0);
      for (const dish of dishes) {
        if (yPos > 275) { doc.addPage(); yPos = 20; }
        doc.text(`• ${dish}`, 22, yPos);
        yPos += 4.5;
      }
      yPos += 2;
    }

    yPos += 4;
  }

  addFooter(doc);
  doc.save(`cardapio-semanal-${data.weekLabel.replace(/\//g, "-")}.pdf`);
}

// ──────────────────── Shared helpers ────────────────────

function addHeader(doc: jsPDF, subtitle: string) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0);
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, 26);
  doc.setDrawColor(200);
  doc.line(14, 30, 196, 30);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(subtitle, 14, 40);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação`,
      14,
      doc.internal.pageSize.height - 10
    );
  }
}
