import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface DashboardExportData {
  period: string;
  filterUnitName: string;
  kpis: {
    costPerMeal: number;
    totalPurchaseCost: number;
    totalWasteCost: number;
    totalWasteKg: number;
    wastePercentage: number;
    totalMeals: number;
  };
  mealCost: {
    avgCost: number;
    grossPerMeal: number;
    wastePerMeal: number;
    avgTarget: number | null;
    deviationPct: number | null;
    deviationR: number | null;
    trend: number;
    totalMeals: number;
  };
  monthlyData: {
    label: string;
    purchases: number;
    waste: number;
  }[];
  mealCostChart: {
    label: string;
    realCost: number;
    foodCost: number;
    wasteCost: number;
  }[];
  ranking: {
    name: string;
    type: string;
    purchases: number;
    waste: number;
    wastePercent: number;
    costPerMeal: number;
    meals: number;
    target: number | null;
    realCost: number;
    grossCost: number;
    days: number;
  }[];
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function statusLabel(real: number, target: number | null): string {
  if (target === null || target <= 0 || real === 0) return "Sem meta";
  const pct = ((real - target) / target) * 100;
  if (pct <= 0) return "Dentro da meta";
  if (pct <= 5) return "Atenção";
  return "Acima da meta";
}

function deviationPctStr(real: number, target: number | null): string {
  if (target === null || target <= 0 || real === 0) return "—";
  const pct = ((real - target) / target) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// ============ PDF ============

export function generateDashboardPDF(d: DashboardExportData) {
  const doc = new jsPDF();
  const { kpis, mealCost } = d;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório do Dashboard Financeiro", 14, 26);
  doc.text(`Período: ${d.period} | Unidade: ${d.filterUnitName}`, 14, 32);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 38);
  doc.setDrawColor(200);
  doc.line(14, 42, 196, 42);

  // Section 1: KPIs Consolidados
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Indicadores do Período", 14, 52);

  const statusLbl = statusLabel(mealCost.avgCost, mealCost.avgTarget);
  const kpiRows: string[][] = [
    ["R$/Refeição (compras)", kpis.costPerMeal > 0 ? fmt(kpis.costPerMeal) : "—"],
    ["Custo Total de Compras", fmt(kpis.totalPurchaseCost)],
    ["Custo do Desperdício", fmt(kpis.totalWasteCost)],
    ["Desperdício (kg)", `${kpis.totalWasteKg.toFixed(1)} kg`],
    ["% Desperdício / Custo", kpis.totalPurchaseCost > 0 ? `${kpis.wastePercentage.toFixed(1)}%` : "—"],
    ["Refeições Estimadas", kpis.totalMeals.toLocaleString("pt-BR")],
    ["", ""],
    ["Custo Real / Refeição", mealCost.avgCost > 0 ? fmt(mealCost.avgCost) : "—"],
    ["Custo Bruto / Refeição", mealCost.grossPerMeal > 0 ? fmt(mealCost.grossPerMeal) : "—"],
    ["Impacto Desperdício / Refeição", mealCost.wastePerMeal > 0 ? fmt(mealCost.wastePerMeal) : "—"],
    ["Meta de Custo / Refeição", mealCost.avgTarget && mealCost.avgTarget > 0 ? fmt(mealCost.avgTarget) : "Sem meta"],
    ["Desvio da Meta (%)", mealCost.deviationPct !== null ? `${mealCost.deviationPct > 0 ? "+" : ""}${mealCost.deviationPct.toFixed(1)}%` : "—"],
    ["Desvio da Meta (R$)", mealCost.deviationR !== null ? `${mealCost.deviationR > 0 ? "+" : ""}${fmt(mealCost.deviationR)}` : "—"],
    ["Variação vs Mês Anterior", mealCost.trend !== 0 ? `${mealCost.trend > 0 ? "+" : ""}${mealCost.trend.toFixed(1)}%` : "—"],
    ["Status", statusLbl],
  ];

  autoTable(doc, {
    startY: 56,
    head: [["Indicador", "Valor"]],
    body: kpiRows,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (h) => {
      if (h.section === "body" && h.row.index === kpiRows.length - 1 && h.column.index === 1) {
        const v = h.cell.raw as string;
        if (v === "Dentro da meta") { h.cell.styles.textColor = [34, 139, 34]; h.cell.styles.fontStyle = "bold"; }
        else if (v === "Atenção") { h.cell.styles.textColor = [200, 150, 0]; h.cell.styles.fontStyle = "bold"; }
        else if (v === "Acima da meta") { h.cell.styles.textColor = [200, 50, 50]; h.cell.styles.fontStyle = "bold"; }
      }
    },
  });

  // Section 2: Evolução Mensal
  let y = (doc as any).lastAutoTable?.finalY || 160;
  if (y > 220) { doc.addPage(); y = 20; }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Evolução Mensal", 14, y + 12);

  const mHeaders = ["Mês", "Custo Real/Ref", "Custo Bruto/Ref", "Desp./Ref", "Compras Total", "Desperdício Total"];
  if (mealCost.avgTarget && mealCost.avgTarget > 0) mHeaders.push("Meta");

  const mRows = d.mealCostChart.map((mc, i) => {
    const md = d.monthlyData[i];
    const row = [
      mc.label,
      mc.realCost > 0 ? fmt(mc.realCost) : "—",
      mc.foodCost > 0 ? fmt(mc.foodCost) : "—",
      mc.wasteCost > 0 ? fmt(mc.wasteCost) : "—",
      md ? fmt(md.purchases) : "—",
      md ? fmt(md.waste) : "—",
    ];
    if (mealCost.avgTarget && mealCost.avgTarget > 0) row.push(fmt(mealCost.avgTarget));
    return row;
  });

  autoTable(doc, {
    startY: y + 16,
    head: [mHeaders],
    body: mRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
  });

  // Section 3: Ranking por Contrato
  y = (doc as any).lastAutoTable?.finalY || 200;
  if (y > 210) { doc.addPage(); y = 20; }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Ranking por Contrato/Unidade", 14, y + 12);

  const tHeaders = ["Contrato", "Tipo", "Meta/Ref", "Real/Ref", "Desvio", "Compras", "Desperdício", "% Desp", "Refeições", "Dias"];
  const tRows = d.ranking.map(u => [
    u.name,
    u.type === "cd" ? "CD" : "Cozinha",
    u.target !== null && u.target > 0 ? fmt(u.target) : "Sem meta",
    fmt(u.realCost),
    deviationPctStr(u.realCost, u.target),
    fmt(u.purchases),
    fmt(u.waste),
    u.purchases > 0 ? `${u.wastePercent.toFixed(1)}%` : "—",
    u.meals.toLocaleString("pt-BR"),
    `${u.days}d`,
  ]);

  autoTable(doc, {
    startY: y + 16,
    head: [tHeaders],
    body: tRows,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    didParseCell: (h) => {
      if (h.section === "body" && h.column.index === 4) {
        const v = h.cell.raw as string;
        if (v.startsWith("+")) {
          const n = parseFloat(v);
          h.cell.styles.textColor = n > 5 ? [200, 50, 50] : [200, 150, 0];
          h.cell.styles.fontStyle = "bold";
        } else if (v.startsWith("-") || v.startsWith("0")) {
          h.cell.styles.textColor = [34, 139, 34];
          h.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação — Página ${i}/${pages}`, 14, doc.internal.pageSize.height - 10);
  }

  doc.save(`dashboard-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============ EXCEL ============

export function generateDashboardExcel(d: DashboardExportData) {
  const wb = XLSX.utils.book_new();
  const { kpis, mealCost } = d;

  // Sheet 1: Resumo
  const resumo = [
    ["Relatório do Dashboard Financeiro"],
    [`Período: ${d.period}`, `Unidade: ${d.filterUnitName}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Indicador", "Valor"],
    ["R$/Refeição (compras)", kpis.costPerMeal > 0 ? kpis.costPerMeal : "—"],
    ["Custo Total de Compras", kpis.totalPurchaseCost],
    ["Custo do Desperdício", kpis.totalWasteCost],
    ["Desperdício (kg)", kpis.totalWasteKg],
    ["% Desperdício / Custo", kpis.totalPurchaseCost > 0 ? `${kpis.wastePercentage.toFixed(1)}%` : "—"],
    ["Refeições Estimadas", kpis.totalMeals],
    [],
    ["Custo Real / Refeição", mealCost.avgCost > 0 ? mealCost.avgCost : "—"],
    ["Custo Bruto / Refeição", mealCost.grossPerMeal > 0 ? mealCost.grossPerMeal : "—"],
    ["Impacto Desperdício / Refeição", mealCost.wastePerMeal > 0 ? mealCost.wastePerMeal : "—"],
    ["Meta de Custo / Refeição", mealCost.avgTarget && mealCost.avgTarget > 0 ? mealCost.avgTarget : "Sem meta"],
    ["Desvio da Meta (%)", mealCost.deviationPct !== null ? `${mealCost.deviationPct.toFixed(1)}%` : "—"],
    ["Desvio da Meta (R$)", mealCost.deviationR !== null ? mealCost.deviationR : "—"],
    ["Variação vs Mês Anterior", mealCost.trend !== 0 ? `${mealCost.trend.toFixed(1)}%` : "—"],
    ["Status", statusLabel(mealCost.avgCost, mealCost.avgTarget)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumo);
  ws1["!cols"] = [{ wch: 30 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

  // Sheet 2: Evolução Mensal
  const evolH = ["Mês", "Custo Real/Ref (R$)", "Custo Bruto/Ref (R$)", "Desp./Ref (R$)", "Compras Total (R$)", "Desperdício Total (R$)"];
  if (mealCost.avgTarget && mealCost.avgTarget > 0) evolH.push("Meta (R$)");
  const evolR = d.mealCostChart.map((mc, i) => {
    const md = d.monthlyData[i];
    const row: (string | number)[] = [mc.label, mc.realCost, mc.foodCost, mc.wasteCost, md?.purchases || 0, md?.waste || 0];
    if (mealCost.avgTarget && mealCost.avgTarget > 0) row.push(mealCost.avgTarget);
    return row;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([evolH, ...evolR]);
  ws2["!cols"] = evolH.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws2, "Evolução Mensal");

  // Sheet 3: Por Contrato
  const cH = ["Contrato", "Tipo", "Meta/Ref (R$)", "Real/Ref (R$)", "Desvio (%)", "Status", "Bruto/Ref (R$)", "Compras (R$)", "Desperdício (R$)", "% Desp", "Refeições", "Dias"];
  const cR = d.ranking.map(u => {
    const pct = u.target && u.target > 0 && u.realCost > 0 ? ((u.realCost - u.target) / u.target * 100) : null;
    return [
      u.name,
      u.type === "cd" ? "CD" : "Cozinha",
      u.target !== null && u.target > 0 ? u.target : "Sem meta",
      u.realCost,
      pct !== null ? `${pct.toFixed(1)}%` : "—",
      statusLabel(u.realCost, u.target),
      u.grossCost,
      u.purchases,
      u.waste,
      u.purchases > 0 ? `${u.wastePercent.toFixed(1)}%` : "—",
      u.meals,
      u.days,
    ];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([cH, ...cR]);
  ws3["!cols"] = cH.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, "Por Contrato");

  XLSX.writeFile(wb, `dashboard-financeiro-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
