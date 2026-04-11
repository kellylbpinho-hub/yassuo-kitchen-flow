import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Radar } from "lucide-react";
import type { RadarRow } from "@/hooks/useCeoData";

const statusColor = (s: string) => {
  if (["Saudável", "OK"].includes(s)) return "bg-success/15 text-success border-success/30";
  if (["Monitorar", "Margem Crítica", "Atenção", "Divergência"].includes(s)) return "bg-yellow-500/15 text-yellow-500 border-yellow-500/30";
  return "bg-destructive/15 text-destructive border-destructive/30";
};

interface Props {
  radarRows: RadarRow[];
}

export function CeoRadarTable({ radarRows }: Props) {
  if (radarRows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Radar className="h-4 w-4 text-primary" /> Radar por Unidade
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Financeiro</TableHead>
              <TableHead className="text-center">Estoque</TableHead>
              <TableHead className="text-center">Recebimento</TableHead>
              <TableHead className="text-center">Geral</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {radarRows.map(r => (
              <TableRow key={r.name}>
                <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={statusColor(r.financeiro)}>{r.financeiro}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={statusColor(r.estoque)}>{r.estoque}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={statusColor(r.recebimento)}>{r.recebimento}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={`font-bold ${statusColor(r.geral)}`}>{r.geral}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
