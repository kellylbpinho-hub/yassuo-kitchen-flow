import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AlertaLote {
  loteId: string;
  loteCodigo: string;
  produtoNome: string;
  unidadeNome: string;
  validade: string;
  diasParaVencer: number;
  quantidade: number;
}

export default function Alertas() {
  const { profile } = useAuth();
  const [alertas, setAlertas] = useState<AlertaLote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlertas();
  }, []);

  const loadAlertas = async () => {
    try {
      // Fetch active lots with product and unit info
      const { data: lotes } = await supabase
        .from("lotes")
        .select("id, codigo, validade, quantidade, product_id, unidade_id, status")
        .eq("status", "ativo")
        .gt("quantidade", 0);

      if (!lotes || lotes.length === 0) {
        setAlertas([]);
        return;
      }

      const productIds = [...new Set(lotes.map((l) => l.product_id))];
      const unitIds = [...new Set(lotes.map((l) => l.unidade_id))];

      const [{ data: products }, { data: units }] = await Promise.all([
        supabase.from("products").select("id, nome, validade_minima_dias").in("id", productIds),
        supabase.from("units").select("id, name").in("id", unitIds),
      ]);

      const prodMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
      const unitMap = Object.fromEntries((units || []).map((u) => [u.id, u.name]));

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result: AlertaLote[] = [];
      const expiredLoteIds: string[] = [];

      for (const lote of lotes) {
        const prod = prodMap[lote.product_id];
        if (!prod) continue;

        const validade = new Date(lote.validade + "T00:00:00");
        const diffMs = validade.getTime() - today.getTime();
        const diasParaVencer = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const limiar = prod.validade_minima_dias ?? 30;

        if (diasParaVencer < 0) {
          // Already expired — mark for status update
          expiredLoteIds.push(lote.id);
        }

        if (diasParaVencer <= limiar) {
          result.push({
            loteId: lote.id,
            loteCodigo: lote.codigo || "—",
            produtoNome: prod.nome,
            unidadeNome: unitMap[lote.unidade_id] || "—",
            validade: lote.validade,
            diasParaVencer,
            quantidade: Number(lote.quantidade),
          });
        }
      }

      // Mark expired lots and audit
      if (expiredLoteIds.length > 0) {
        await supabase
          .from("lotes")
          .update({ status: "vencido" })
          .in("id", expiredLoteIds);

        // Audit log for each expired lot
        if (profile) {
          const auditRows = expiredLoteIds.map((loteId) => {
            const lote = lotes.find((l) => l.id === loteId);
            return {
              user_id: profile.user_id,
              company_id: profile.company_id,
              unidade_id: lote?.unidade_id || null,
              tabela: "lotes",
              acao: "vencido",
              registro_id: loteId,
              dados: { motivo: "Lote marcado como vencido automaticamente" },
            };
          });
          await supabase.from("audit_log").insert(auditRows);
        }
      }

      result.sort((a, b) => a.diasParaVencer - b.diasParaVencer);
      setAlertas(result);
    } catch (err) {
      console.error("Alertas error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeVariant = (dias: number) => {
    if (dias < 0) return "destructive";
    if (dias <= 7) return "destructive";
    if (dias <= 15) return "default";
    return "secondary";
  };

  const getDiasLabel = (dias: number) => {
    if (dias < 0) return `Vencido há ${Math.abs(dias)}d`;
    if (dias === 0) return "Vence hoje";
    return `${dias}d restantes`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-warning" />
        <h1 className="text-2xl font-display font-bold text-foreground">Alertas de Validade</h1>
        {alertas.length > 0 && (
          <Badge variant="destructive" className="text-sm">
            {alertas.length}
          </Badge>
        )}
      </div>

      {alertas.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Clock className="h-12 w-12 text-success mx-auto mb-3" />
          <p className="text-lg font-medium text-foreground">Nenhum alerta no momento</p>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os lotes estão dentro do prazo de validade.
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertas.map((a) => (
                <TableRow key={a.loteId}>
                  <TableCell className="font-medium text-foreground">{a.produtoNome}</TableCell>
                  <TableCell className="text-muted-foreground">{a.loteCodigo}</TableCell>
                  <TableCell className="text-muted-foreground">{a.unidadeNome}</TableCell>
                  <TableCell className="text-right text-foreground">{a.quantidade}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(a.validade + "T00:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(a.diasParaVencer)}>
                      {getDiasLabel(a.diasParaVencer)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
