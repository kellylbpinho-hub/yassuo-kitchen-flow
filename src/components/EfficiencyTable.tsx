import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

interface EfficiencyRow {
  unitId: string;
  unitName: string;
  target: number | null;
  realCost: number;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EfficiencyTable({ data }: { data: EfficiencyRow[] }) {
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Índice de Eficiência da Operação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Custo Real</TableHead>
              <TableHead className="text-center">Eficiência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(row => {
              const hasTarget = row.target !== null && row.target > 0;
              const hasData = row.realCost > 0;
              const efficiency = hasTarget && hasData ? (row.realCost / row.target!) * 100 : null;

              let badgeClass = "bg-muted/50 text-muted-foreground border-border";
              let label = "Sem meta";

              if (efficiency !== null) {
                if (efficiency <= 100) {
                  badgeClass = "bg-success/15 text-success border-success/30";
                  label = `${efficiency.toFixed(0)}%`;
                } else if (efficiency <= 105) {
                  badgeClass = "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
                  label = `${efficiency.toFixed(0)}%`;
                } else {
                  badgeClass = "bg-destructive/15 text-destructive border-destructive/30";
                  label = `${efficiency.toFixed(0)}%`;
                }
              } else if (hasTarget && !hasData) {
                label = "—";
              }

              return (
                <TableRow key={row.unitId}>
                  <TableCell className="font-medium">{row.unitName}</TableCell>
                  <TableCell className="text-right">
                    {hasTarget ? formatCurrency(row.target!) : <span className="text-muted-foreground italic text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasData ? formatCurrency(row.realCost) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={badgeClass}>{label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
