import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface MealCostExportData {
  period: string;
  filterUnitName: string;
  kpi: {
    avgCost: number;
    totalFood: number;
    totalWaste: number;
    totalMeals: number;
    trend: number;
  };
  avgTarget: number | null;
  chartData: {
    label: string;
    realCost: number;
    foodCost: number;
    wasteCost: number;
  }[];
  unitTable: {
    name: string;
    grossCost: number;
    realCost: number;
    waste: number;
    meals: number;
    days: number;
    target: number | null;
  }[];
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function deviationLabel(real: number, target: number | null): string {
  if (target === null || target <= 0 || real === 0) return "Sem meta";
  const pct = ((real - target) / target) * 100;
  if (pct <= 0) return "Dentro da meta";
  if (pct <= 5) return "Atenção";
  return "Acima da meta";
}

function deviationPct(real: number, target: number | null): string {
  if (target === null || target <= 0 || real === 0) return "—";
  const pct = ((real - target) / target) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function deviationValue(real: number, target: number | null): string {
  if (target === null || target <= 0 || real === 0) return "—";
  const diff = real - target;
  return `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`;
}

// ============ PDF ============

export function generateMealCostPDF(data: MealCostExportData) {
  const doc = new jsPDF();
  const { kpi, avgTarget, chartData, unitTable } = data;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Custo Real da Refeição", 14, 26);
  doc.text(`Período: ${data.period} | Unidade: ${data.filterUnitName}`, 14, 32);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 38);

  doc.setDrawColor(200);
  doc.line(14, 42, 196, 42);

  // Section 1: Resumo Executivo
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo Executivo", 14, 52);

  const grossPerMeal = kpi.totalMeals > 0 ? kpi.totalFood / kpi.totalMeals : 0;
  const wastePerMeal = kpi.totalMeals > 0 ? kpi.totalWaste / kpi.totalMeals : 0;
  const deviationPctVal = avgTarget && avgTarget > 0 && kpi.avgCost > 0
    ? ((kpi.avgCost - avgTarget) / avgTarget * 100) : null;
  const deviationRVal = avgTarget && avgTarget > 0 && kpi.avgCost > 0
    ? kpi.avgCost - avgTarget : null;

  const kpiRows: string[][] = [
    ["Custo Real / Refeição", kpi.avgCost > 0 ? formatCurrency(kpi.avgCost) : "—"],
    ["Custo Bruto / Refeição", grossPerMeal > 0 ? formatCurrency(grossPerMeal) : "—"],
    ["Impacto Desperdício / Refeição", wastePerMeal > 0 ? formatCurrency(wastePerMeal) : "—"],
    ["Meta de Custo / Refeição", avgTarget && avgTarget > 0 ? formatCurrency(avgTarget) : "Sem meta definida"],
    ["Desvio da Meta (%)", deviationPctVal !== null ? `${deviationPctVal > 0 ? "+" : ""}${deviationPctVal.toFixed(1)}%` : "—"],
    ["Desvio da Meta (R$)", deviationRVal !== null ? `${deviationRVal > 0 ? "+" : ""}${formatCurrency(deviationRVal)}` : "—"],
    ["Total de Refeições", kpi.totalMeals.toLocaleString("pt-BR")],
    ["Variação vs Mês Anterior", kpi.trend !== 0 ? `${kpi.trend > 0 ? "+" : ""}${kpi.trend.toFixed(1)}%` : "—"],
  ];

  // Color the status row
  const statusLabel = avgTarget && avgTarget > 0 && kpi.avgCost > 0
    ? deviationLabel(kpi.avgCost, avgTarget) : "—";
  kpiRows.push(["Status", statusLabel]);

  autoTable(doc, {
    startY: 56,
    head: [["Indicador", "Valor"]],
    body: kpiRows,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (hookData) => {
      // Color the status row
      if (hookData.section === "body" && hookData.row.index === kpiRows.length - 1 && hookData.column.index === 1) {
        const val = hookData.cell.raw as string;
        if (val === "Dentro da meta") {
          hookData.cell.styles.textColor = [34, 139, 34];
          hookData.cell.styles.fontStyle = "bold";
        } else if (val === "Atenção") {
          hookData.cell.styles.textColor = [200, 150, 0];
          hookData.cell.styles.fontStyle = "bold";
        } else if (val === "Acima da meta") {
          hookData.cell.styles.textColor = [200, 50, 50];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Section 2: Evolução Mensal
  let y = (doc as any).lastAutoTable?.finalY || 120;
  if (y > 230) { doc.addPage(); y = 20; }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Evolução Mensal", 14, y + 12);

  const monthHeaders = ["Mês", "Custo Real/Ref", "Custo Bruto/Ref", "Impacto Desperdício/Ref"];
  if (avgTarget && avgTarget > 0) monthHeaders.push("Meta");

  const monthRows = chartData.map(m => {
    const row = [
      m.label,
      m.realCost > 0 ? formatCurrency(m.realCost) : "—",
      m.foodCost > 0 ? formatCurrency(m.foodCost) : "—",
      m.wasteCost > 0 ? formatCurrency(m.wasteCost) : "—",
    ];
    if (avgTarget && avgTarget > 0) row.push(formatCurrency(avgTarget));
    return row;
  });

  autoTable(doc, {
    startY: y + 16,
    head: [monthHeaders],
    body: monthRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  // Section 3: Tabela por Contrato/Unidade
  y = (doc as any).lastAutoTable?.finalY || 180;
  if (y > 210) { doc.addPage(); y = 20; }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Custo Real por Contrato/Unidade", 14, y + 12);

  const tableHeaders = ["Contrato", "Meta/Ref", "Custo Real/Ref", "Desvio", "Custo Bruto/Ref", "Desp./Ref", "Refeições", "Dias"];
  const tableRows = unitTable.map(u => {
    const wastePerM = u.meals > 0 ? u.waste / u.meals : 0;
    return [
      u.name,
      u.target !== null && u.target > 0 ? formatCurrency(u.target) : "Sem meta",
      formatCurrency(u.realCost),
      deviationPct(u.realCost, u.target),
      formatCurrency(u.grossCost),
      formatCurrency(wastePerM),
      u.meals.toLocaleString("pt-BR"),
      `${u.days}d`,
    ];
  });

  autoTable(doc, {
    startY: y + 16,
    head: [tableHeaders],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    theme: "grid",
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const val = hookData.cell.raw as string;
        if (val.startsWith("+")) {
          const num = parseFloat(val);
          if (num > 5) {
            hookData.cell.styles.textColor = [200, 50, 50];
            hookData.cell.styles.fontStyle = "bold";
          } else {
            hookData.cell.styles.textColor = [200, 150, 0];
            hookData.cell.styles.fontStyle = "bold";
          }
        } else if (val.startsWith("-") || val.startsWith("0")) {
          hookData.cell.styles.textColor = [34, 139, 34];
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} — Yassuo Alimentação — Página ${i}/${pageCount}`,
      14, doc.internal.pageSize.height - 10
    );
  }

  doc.save(`custo-real-refeicao-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============ EXCEL ============

export function generateMealCostExcel(data: MealCostExportData) {
  const wb = XLSX.utils.book_new();
  const { kpi, avgTarget, chartData, unitTable } = data;

  const grossPerMeal = kpi.totalMeals > 0 ? kpi.totalFood / kpi.totalMeals : 0;
  const wastePerMeal = kpi.totalMeals > 0 ? kpi.totalWaste / kpi.totalMeals : 0;
  const deviationPctVal = avgTarget && avgTarget > 0 && kpi.avgCost > 0
    ? ((kpi.avgCost - avgTarget) / avgTarget * 100) : null;
  const deviationRVal = avgTarget && avgTarget > 0 && kpi.avgCost > 0
    ? kpi.avgCost - avgTarget : null;

  // Sheet 1: Resumo
  const resumoData = [
    ["Relatório de Custo Real da Refeição"],
    [`Período: ${data.period}`, `Unidade: ${data.filterUnitName}`],
    [`Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    ["Indicador", "Valor"],
    ["Custo Real / Refeição", kpi.avgCost > 0 ? kpi.avgCost : "—"],
    ["Custo Bruto / Refeição", grossPerMeal > 0 ? grossPerMeal : "—"],
    ["Impacto Desperdício / Refeição", wastePerMeal > 0 ? wastePerMeal : "—"],
    ["Meta de Custo / Refeição", avgTarget && avgTarget > 0 ? avgTarget : "Sem meta"],
    ["Desvio da Meta (%)", deviationPctVal !== null ? `${deviationPctVal.toFixed(1)}%` : "—"],
    ["Desvio da Meta (R$)", deviationRVal !== null ? deviationRVal : "—"],
    ["Total de Refeições", kpi.totalMeals],
    ["Variação vs Mês Anterior", kpi.trend !== 0 ? `${kpi.trend.toFixed(1)}%` : "—"],
    ["Status", avgTarget && avgTarget > 0 && kpi.avgCost > 0 ? deviationLabel(kpi.avgCost, avgTarget) : "—"],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(resumoData);
  ws1["!cols"] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Resumo");

  // Sheet 2: Evolução Mensal
  const evolHeaders = ["Mês", "Custo Real/Ref (R$)", "Custo Bruto/Ref (R$)", "Impacto Desperdício/Ref (R$)"];
  if (avgTarget && avgTarget > 0) evolHeaders.push("Meta (R$)");
  const evolRows = chartData.map(m => {
    const row: (string | number)[] = [m.label, m.realCost, m.foodCost, m.wasteCost];
    if (avgTarget && avgTarget > 0) row.push(avgTarget);
    return row;
  });
  const ws2 = XLSX.utils.aoa_to_sheet([evolHeaders, ...evolRows]);
  ws2["!cols"] = evolHeaders.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws2, "Evolução Mensal");

  // Sheet 3: Por Contrato
  const contratoHeaders = ["Contrato", "Meta/Ref (R$)", "Custo Real/Ref (R$)", "Desvio (%)", "Desvio (R$)", "Status", "Custo Bruto/Ref (R$)", "Desperdício/Ref (R$)", "Refeições", "Dias"];
  const contratoRows = unitTable.map(u => {
    const wastePerM = u.meals > 0 ? u.waste / u.meals : 0;
    const pct = u.target && u.target > 0 && u.realCost > 0 ? ((u.realCost - u.target) / u.target * 100) : null;
    const diff = u.target && u.target > 0 && u.realCost > 0 ? u.realCost - u.target : null;
    return [
      u.name,
      u.target !== null && u.target > 0 ? u.target : "Sem meta",
      u.realCost,
      pct !== null ? `${pct.toFixed(1)}%` : "—",
      diff !== null ? diff : "—",
      u.target !== null && u.target > 0 && u.realCost > 0 ? deviationLabel(u.realCost, u.target) : "Sem meta",
      u.grossCost,
      wastePerM,
      u.meals,
      u.days,
    ];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([contratoHeaders, ...contratoRows]);
  ws3["!cols"] = contratoHeaders.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, "Por Contrato");

  XLSX.writeFile(wb, `custo-real-refeicao-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
