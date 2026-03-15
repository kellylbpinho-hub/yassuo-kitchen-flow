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

// ──────────────────── Menu Técnico PDF ────────────────────

interface MenuTecnicoPDFDay {
  dayLabel: string;
  dateLabel: string;
  status: string;
  dishes: { nome: string; category: string; descricao?: string }[];
}

interface MenuTecnicoPDFData {
  weekLabel: string;
  unitName: string;
  numColaboradores: number;
  observacao?: string;
  days: MenuTecnicoPDFDay[];
}

export function generateMenuTecnicoPDF(data: MenuTecnicoPDFData) {
  const doc = new jsPDF();
  addHeader(doc, "Cardápio Técnico");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${data.weekLabel}`, 14, 48);
  doc.text(`Unidade / Contrato: ${data.unitName}`, 14, 54);
  doc.text(`Qtd. Prevista de Refeições: ${data.numColaboradores}`, 14, 60);
  if (data.observacao) doc.text(`Observação: ${data.observacao}`, 14, 66);

  let yPos = data.observacao ? 74 : 68;

  for (const day of data.days) {
    if (yPos > 255) { doc.addPage(); yPos = 20; }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`${day.dayLabel} — ${day.dateLabel}`, 14, yPos);
    yPos += 2;

    if (day.status !== "Com cardápio" && day.status !== "com_cardapio") {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text(day.status, 18, yPos + 4);
      yPos += 10;
      continue;
    }

    if (day.dishes.length === 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text("Nenhuma preparação definida", 18, yPos + 4);
      yPos += 10;
      continue;
    }

    // Table for the day
    const tableBody = day.dishes.map((d) => [d.category || "Geral", d.nome, d.descricao || ""]);

    autoTable(doc, {
      startY: yPos + 2,
      head: [["Categoria", "Preparação", "Observação"]],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
      theme: "grid",
      margin: { left: 14, right: 14 },
      columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 50, fontStyle: "italic" } },
    });

    yPos = ((doc as any).lastAutoTable?.finalY || yPos + 20) + 6;
  }

  // Signature area
  if (yPos > 250) { doc.addPage(); yPos = 20; }
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Nutricionista Responsável: ___________________________  CRN: __________", 14, yPos + 10);
  doc.text("Data: ___/___/______", 14, yPos + 20);

  addFooter(doc);
  doc.save(`cardapio-tecnico-${data.weekLabel.replace(/\//g, "-")}.pdf`);
}

// ──────────────────── Ficha Técnica PDF ────────────────────

interface FichaTecnicaPDFData {
  dishName: string;
  category: string;
  rendimentoKg: number;
  numPorcoes: number;
  modoPreparo?: string;
  observacoes?: string;
  tempoPreparo?: string;
  equipamento?: string;
  pesoPorcao?: number;
  ingredients: {
    produto: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number | null;
    custoTotal: number | null;
  }[];
}

export function generateFichaTecnicaPDF(data: FichaTecnicaPDFData) {
  const doc = new jsPDF();
  addHeader(doc, "Ficha Técnica de Preparação");

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Preparação: ${data.dishName}`, 14, 48);
  doc.text(`Categoria: ${data.category}`, 14, 54);

  let yInfo = 60;
  doc.text(`Rendimento: ${data.rendimentoKg.toFixed(3)} kg`, 14, yInfo);
  doc.text(`Nº de Porções: ${data.numPorcoes}`, 110, yInfo);
  yInfo += 6;

  if (data.pesoPorcao) {
    doc.text(`Peso por Porção: ${(data.pesoPorcao * 1000).toFixed(0)}g`, 14, yInfo);
  } else if (data.numPorcoes > 0) {
    doc.text(`Peso por Porção: ${(data.rendimentoKg / data.numPorcoes * 1000).toFixed(0)}g`, 14, yInfo);
  }
  if (data.tempoPreparo) {
    doc.text(`Tempo de Preparo: ${data.tempoPreparo}`, 110, yInfo);
  }
  yInfo += 6;

  if (data.equipamento) {
    doc.text(`Equipamento: ${data.equipamento}`, 14, yInfo);
    yInfo += 6;
  }

  const custoTotal = data.ingredients.reduce((s, i) => s + (i.custoTotal || 0), 0);
  const custoPorcao = data.numPorcoes > 0 ? custoTotal / data.numPorcoes : 0;

  doc.setFont("helvetica", "bold");
  doc.text(`Custo Total: R$ ${custoTotal.toFixed(2)}`, 14, yInfo);
  doc.text(`Custo por Porção: R$ ${custoPorcao.toFixed(2)}`, 110, yInfo);
  yInfo += 8;

  // Ingredients table
  const tableBody = data.ingredients.map((i) => [
    i.produto,
    i.quantidade.toFixed(3),
    i.unidade,
    i.custoUnitario != null ? `R$ ${i.custoUnitario.toFixed(2)}` : "—",
    i.custoTotal != null ? `R$ ${i.custoTotal.toFixed(2)}` : "—",
  ]);

  autoTable(doc, {
    startY: yInfo,
    head: [["Ingrediente", "Quantidade", "Unidade", "Custo Unit.", "Custo Total"]],
    body: tableBody,
    foot: [["", "", "", "Total:", `R$ ${custoTotal.toFixed(2)}`]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: "bold" },
    theme: "grid",
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  let yPos = ((doc as any).lastAutoTable?.finalY || 130) + 8;

  // Modo de preparo
  if (data.modoPreparo) {
    if (yPos > 240) { doc.addPage(); yPos = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Modo de Preparo", 14, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.modoPreparo, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 4.5 + 6;
  }

  // Observações
  if (data.observacoes) {
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("Observações", 14, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.observacoes, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 4.5 + 6;
  }

  // Signature
  if (yPos > 250) { doc.addPage(); yPos = 20; }
  doc.setFontSize(9);
  doc.setTextColor(0);
  doc.text("Nutricionista Responsável: ___________________________  CRN: __________", 14, yPos + 6);
  doc.text("Data: ___/___/______", 14, yPos + 16);

  addFooter(doc);
  doc.save(`ficha-tecnica-${data.dishName.replace(/\s/g, "-").substring(0, 30)}.pdf`);
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
