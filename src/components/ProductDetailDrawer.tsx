import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  productId: string | null;
  productName: string;
  filterUnitId?: string;
  open: boolean;
  onClose: () => void;
}

interface Lote {
  id: string;
  codigo: string | null;
  validade: string;
  quantidade: number;
  status: string;
  unidade_name: string;
}

interface Movement {
  id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  created_at: string;
  user_name: string;
  unidade_name: string;
}

export function ProductDetailDrawer({ productId, productName, filterUnitId, open, onClose }: Props) {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && productId) {
      loadDetails();
    }
  }, [open, productId, filterUnitId]);

  const loadDetails = async () => {
    if (!productId) return;
    setLoading(true);

    let lotesQuery = supabase
      .from("lotes")
      .select("id, codigo, validade, quantidade, status, unidade_id")
      .eq("product_id", productId)
      .order("validade", { ascending: true });

    let movQuery = supabase
      .from("movements")
      .select("id, tipo, quantidade, motivo, created_at, user_id, unidade_id")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (filterUnitId && filterUnitId !== "all") {
      lotesQuery = lotesQuery.eq("unidade_id", filterUnitId);
      movQuery = movQuery.eq("unidade_id", filterUnitId);
    }

    const [lotesRes, movRes, unitsRes, profilesRes] = await Promise.all([
      lotesQuery,
      movQuery,
      supabase.from("units").select("id, name"),
      supabase.from("profiles").select("user_id, full_name"),
    ]);

    const units = unitsRes.data || [];
    const profiles = profilesRes.data || [];
    const getUnitName = (id: string) => units.find((u: any) => u.id === id)?.name || "—";
    const getUserName = (id: string) => profiles.find((p: any) => p.user_id === id)?.full_name || "—";

    setLotes(
      (lotesRes.data || []).map((l: any) => ({
        ...l,
        unidade_name: getUnitName(l.unidade_id),
      }))
    );

    setMovements(
      (movRes.data || []).map((m: any) => ({
        ...m,
        user_name: getUserName(m.user_id),
        unidade_name: getUnitName(m.unidade_id),
      }))
    );

    setLoading(false);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-auto">
        <SheetHeader>
          <SheetTitle className="font-display">{productName}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="lotes" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="lotes" className="flex-1">Lotes ({lotes.length})</TabsTrigger>
              <TabsTrigger value="historico" className="flex-1">Histórico ({movements.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="lotes">
              {lotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum lote encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Código</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Unidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotes.map((l) => {
                        const expired = l.validade < today;
                        const statusLabel = l.status === "ativo" && expired ? "vencido" : l.status;
                        return (
                          <TableRow key={l.id} className="border-border">
                            <TableCell className="text-xs">{l.codigo || "—"}</TableCell>
                            <TableCell className={`text-xs ${expired ? "text-destructive font-semibold" : ""}`}>
                              {format(new Date(l.validade + "T00:00:00"), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-xs">{l.quantidade}</TableCell>
                            <TableCell>
                              <Badge
                                variant={statusLabel === "vencido" ? "destructive" : statusLabel === "ativo" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{l.unidade_name}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico">
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação encontrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Tipo</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.id} className="border-border">
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{m.tipo}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{m.quantidade}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate">{m.motivo || "—"}</TableCell>
                          <TableCell className="text-xs">{format(new Date(m.created_at), "dd/MM HH:mm")}</TableCell>
                          <TableCell className="text-xs">{m.user_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
