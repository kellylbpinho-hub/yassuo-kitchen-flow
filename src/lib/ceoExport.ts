import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface CeoExportData {
  generatedAt: string;
  kpis: {
    mealsToday: number;
    criticalProducts: number;
    avgMealCost: number;
    marginCriticalUnits: number;
    lossUnits: number;
    healthyUnits: number;
    weightDivergences: number;
    ruptureRisk: number;
    expiringAlerts: number;
  };
  unitFinance: {
    name: string;
    contractValue: number | null;
    totalCost: number;
    totalMeals: number;
    avgCost: number;
    target: number | null;
    efficiency: number | null;
    status: string;
  }[];
  radar: {
    name: string;
    financeiro: string;
    estoque: string;
    recebimento: string;
    geral: string;
  }[];
  divergences: {
    product_name: string;
    percentual_desvio: number;
    created_at: string;
  }[];
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number | null) =>
  v !== null ? `${v.toFixed(1)}%` : "—";

export function generateCeoPDF(data: CeoExportData) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = doc.internal.pageSize.getWidth();
  let y = 15;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Executivo — Painel do CEO", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em: ${data.generatedAt}`, pageW / 2, y, { align: "center" });
  y += 10;

  // KPIs
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores Principais", 14, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Refeições estimadas/dia", data.kpis.mealsToday.toLocaleString("pt-BR")],
      ["Custo médio/refeição", data.kpis.avgMealCost > 0 ? fmt(data.kpis.avgMealCost) : "—"],
      ["Produtos críticos", String(data.kpis.criticalProducts)],
      ["Risco de ruptura", String(data.kpis.ruptureRisk)],
      ["Alertas de validade", String(data.kpis.expiringAlerts)],
      ["Unidades saudáveis", String(data.kpis.healthyUnits)],
      ["Margem crítica", String(data.kpis.marginCriticalUnits)],
      ["Com prejuízo", String(data.kpis.lossUnits)],
      ["Divergências recebimento (48h)", String(data.kpis.weightDivergences)],
    ],
    theme: "striped",
    headStyles: { fillColor: [180, 30, 50] },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Financial per unit
  if (data.unitFinance.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumo Financeiro por Unidade", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Unidade", "Contrato", "Custo Total", "Refeições", "Custo/Ref.", "Meta", "Eficiência", "Status"]],
      body: data.unitFinance.map(u => [
        u.name,
        u.contractValue ? fmt(u.contractValue) : "—",
        fmt(u.totalCost),
        u.totalMeals.toLocaleString("pt-BR"),
        u.avgCost > 0 ? fmt(u.avgCost) : "—",
        u.target ? fmt(u.target) : "—",
        fmtPct(u.efficiency),
        u.status,
      ]),
      theme: "striped",
      headStyles: { fillColor: [180, 30, 50] },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Radar
  if (data.radar.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Radar da Operação", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Unidade", "Financeiro", "Estoque", "Recebimento", "Status Geral"]],
      body: data.radar.map(r => [r.name, r.financeiro, r.estoque, r.recebimento, r.geral]),
      theme: "striped",
      headStyles: { fillColor: [180, 30, 50] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Divergences
  if (data.divergences.length > 0) {
    if (y > 240) { doc.addPage(); y = 15; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Divergências de Recebimento (últimas 48h)", 14, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["Produto", "Desvio (%)", "Data/Hora"]],
      body: data.divergences.map(d => [
        d.product_name,
        `${d.percentual_desvio.toFixed(1)}%`,
        new Date(d.created_at).toLocaleString("pt-BR"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [180, 30, 50] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save("relatorio-executivo-ceo.pdf");
}

export function generateCeoExcel(data: CeoExportData) {
  const wb = XLSX.utils.book_new();

  // KPIs
  const kpiRows = [
    ["Indicador", "Valor"],
    ["Refeições estimadas/dia", data.kpis.mealsToday],
    ["Custo médio/refeição", data.kpis.avgMealCost],
    ["Produtos críticos", data.kpis.criticalProducts],
    ["Risco de ruptura", data.kpis.ruptureRisk],
    ["Alertas de validade", data.kpis.expiringAlerts],
    ["Unidades saudáveis", data.kpis.healthyUnits],
    ["Margem crítica", data.kpis.marginCriticalUnits],
    ["Com prejuízo", data.kpis.lossUnits],
    ["Divergências recebimento (48h)", data.kpis.weightDivergences],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiRows), "KPIs");

  // Finance
  if (data.unitFinance.length > 0) {
    const finRows = [
      ["Unidade", "Contrato", "Custo Total", "Refeições", "Custo/Ref.", "Meta", "Eficiência %", "Status"],
      ...data.unitFinance.map(u => [
        u.name, u.contractValue || "", u.totalCost, u.totalMeals,
        u.avgCost, u.target || "", u.efficiency || "", u.status,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finRows), "Financeiro");
  }

  // Radar
  if (data.radar.length > 0) {
    const radarRows = [
      ["Unidade", "Financeiro", "Estoque", "Recebimento", "Status Geral"],
      ...data.radar.map(r => [r.name, r.financeiro, r.estoque, r.recebimento, r.geral]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(radarRows), "Radar");
  }

  // Divergences
  if (data.divergences.length > 0) {
    const divRows = [
      ["Produto", "Desvio (%)", "Data/Hora"],
      ...data.divergences.map(d => [
        d.product_name, d.percentual_desvio,
        new Date(d.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(divRows), "Divergências");
  }

  XLSX.writeFile(wb, "relatorio-executivo-ceo.xlsx");
}
