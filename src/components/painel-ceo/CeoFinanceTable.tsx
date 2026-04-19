import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign } from "lucide-react";
import type { UnitFinRow } from "@/hooks/useCeoData";

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusBadge = (s: string) => {
  if (s === "Saudável") return "bg-success/15 text-success border-success/30";
  if (s === "Margem Crítica") return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
};

interface Props {
  unitFinRows: UnitFinRow[];
}

export function CeoFinanceTable({ unitFinRows }: Props) {
  if (unitFinRows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" /> Financeiro por Unidade
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Contrato</TableHead>
              <TableHead className="text-right">Custo Total</TableHead>
              <TableHead className="text-right">Refeições</TableHead>
              <TableHead className="text-right">Custo Médio</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Eficiência</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unitFinRows.map(r => (
              <TableRow key={r.name}>
                <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.contractValue ? formatCurrency(r.contractValue) : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.totalCost > 0 ? formatCurrency(r.totalCost) : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.totalMeals > 0 ? r.totalMeals.toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.avgCost > 0 ? formatCurrency(r.avgCost) : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.target ? formatCurrency(r.target) : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">{r.efficiency ? `${r.efficiency.toFixed(0)}%` : "—"}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={statusBadge(r.status)}>{r.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
