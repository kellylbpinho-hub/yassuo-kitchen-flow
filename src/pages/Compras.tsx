import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PurchaseOrder {
  id: string;
  status: string;
  observacao: string | null;
  unidade_id: string;
  created_at: string;
  created_by: string;
  numero: number;
}

interface Unit { id: string; name: string; type: string; }

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-primary/20 text-primary",
  aprovado: "bg-success/20 text-success",
  recebido: "bg-success text-success-foreground",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recebido: "Recebido",
};

export default function Compras() {
  const { user, profile, isFinanceiro } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: o }, { data: u }] = await Promise.all([
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("units").select("id, name, type"),
    ]);
    setOrders((o || []) as PurchaseOrder[]);
    setUnits((u || []) as Unit[]);
    if (u && u.length > 0) setSelectedUnit(profile?.unidade_id || u[0].id);
    setLoading(false);
  };

  const createOrder = async () => {
    if (!selectedUnit) return;
    const { data, error } = await supabase.from("purchase_orders").insert({
      status: "rascunho",
      unidade_id: selectedUnit,
      created_by: user!.id,
      company_id: profile!.company_id,
    }).select("id").single();
    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success("Pedido criado!");
      setCreateOpen(false);
      navigate(`/compras/${data.id}`);
    }
  };


  const getUnitName = (id: string) => units.find((u) => u.id === id)?.name || "—";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Compras</h1>
        {!isFinanceiro && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Pedido</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-sm">
              <DialogHeader>
                <DialogTitle className="font-display">Novo Pedido de Compra</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Unidade</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createOrder} className="w-full">Criar Pedido</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nº Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id} className="border-border cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/compras/${o.id}`)}>
                    <TableCell className="font-mono text-sm font-medium">OC-{new Date(o.created_at).getFullYear()}-{String(o.numero).padStart(4, "0")}</TableCell>
                    <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{getUnitName(o.unidade_id)}</Badge></TableCell>
                    <TableCell>
                      <Badge className={statusColors[o.status]}>{statusLabels[o.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/compras/${o.id}`); }}>
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
