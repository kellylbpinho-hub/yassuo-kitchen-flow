import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Package, DollarSign, ArrowRight, Radar, ScanBarcode,
  Download, FileText, FileSpreadsheet, ShoppingCart, FileSearch,
} from "lucide-react";
import { LastUpdated } from "@/components/LastUpdated";
import { generateCeoPDF, generateCeoExcel, type CeoExportData } from "@/lib/ceoExport";
import { toast } from "sonner";
import { useCeoData } from "@/hooks/useCeoData";
import { CeoKpiCards } from "@/components/painel-ceo/CeoKpiCards";
import { CeoSummaryCards } from "@/components/painel-ceo/CeoSummaryCards";
import { CeoPurchaseCard } from "@/components/painel-ceo/CeoPurchaseCard";
import { CeoRadarTable } from "@/components/painel-ceo/CeoRadarTable";
import { CeoFinanceTable } from "@/components/painel-ceo/CeoFinanceTable";

export default function PainelCeo() {
  const navigate = useNavigate();
  const { loading, lastUpdated, kpis, recentDivergences, unitFinRows, radarRows, purchaseSummary } = useCeoData();

  const handleExport = (type: "pdf" | "excel") => {
    toast.success(type === "pdf" ? "Gerando PDF..." : "Gerando Excel...", { duration: 2000 });
    const exportData: CeoExportData = {
      generatedAt: new Date().toLocaleString("pt-BR"),
      kpis, unitFinance: unitFinRows, radar: radarRows, divergences: recentDivergences,
    };
    if (type === "pdf") generateCeoPDF(exportData);
    else generateCeoExcel(exportData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel do CEO</h1>
          <p className="text-sm text-muted-foreground">Visão executiva consolidada da operação</p>
          <LastUpdated timestamp={lastUpdated} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar Relatório
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2 cursor-pointer">
              <FileText className="h-4 w-4" /> Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("excel")} className="gap-2 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CeoKpiCards kpis={kpis} />
      <CeoSummaryCards kpis={kpis} recentDivergences={recentDivergences} />
      <CeoPurchaseCard purchaseSummary={purchaseSummary} />
      <CeoRadarTable radarRows={radarRows} />
      <CeoFinanceTable unitFinRows={unitFinRows} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Atalhos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Dashboard Financeiro", route: "/dashboard-financeiro", icon: DollarSign },
              { label: "Estoque", route: "/estoque", icon: Package },
              { label: "Recebimento Digital", route: "/recebimento-digital", icon: ScanBarcode },
              { label: "Radar da Operação", route: "/radar-operacao", icon: Radar },
              { label: "Compras", route: "/compras", icon: ShoppingCart },
              { label: "Cotações", route: "/cotacoes", icon: FileSearch },
            ].map(link => (
              <Button key={link.route} variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(link.route)}>
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
                <ArrowRight className="h-3 w-3" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
