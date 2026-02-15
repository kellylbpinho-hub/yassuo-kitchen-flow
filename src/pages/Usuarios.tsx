import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ProfileUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  cargo: string;
  unidade_id: string | null;
  avatar_url: string | null;
  ativo: boolean;
}

interface Unit { id: string; name: string; }

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  gerente_financeiro: "Gerente Financeiro",
  gerente_operacional: "Gerente Operacional",
  nutricionista: "Nutricionista",
  funcionario: "Funcionário",
};

export default function Usuarios() {
  const { canManage, isCeo } = useAuth();
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", cargo: "funcionario", unidade_id: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: p }, { data: u }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("units").select("id, name"),
    ]);
    setUsers((p || []) as ProfileUser[]);
    setUnits((u || []) as Unit[]);
    if (u && u.length > 0 && !form.unidade_id) setForm((f) => ({ ...f, unidade_id: u[0].id }));
    setLoading(false);
  };

  const createUser = async () => {
    if (!form.full_name || !form.email || !form.password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setCreating(true);
    setError("");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          cargo: form.cargo,
          unidade_id: form.unidade_id || null,
        },
      });

      if (fnErr || data?.error) {
        setError("Erro ao criar usuário: " + (data?.error || fnErr?.message));
        setCreating(false);
        return;
      }

      toast.success("Usuário criado com sucesso!");
      setAddOpen(false);
      setForm({ full_name: "", email: "", password: "", cargo: "funcionario", unidade_id: units[0]?.id || "" });
      loadData();
    } catch (err: any) {
      setError("Erro: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (profile: ProfileUser) => {
    const { error } = await supabase.from("profiles").update({ ativo: !profile.ativo }).eq("id", profile.id);
    if (error) toast.error("Erro: " + error.message);
    else loadData();
  };

  const getUnitName = (id: string | null) => (id ? units.find((u) => u.id === id)?.name : null) || "—";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Usuários</h1>
        {canManage && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="h-4 w-4 mr-2" />Novo Usuário</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Cadastrar Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />{error}
                  </div>
                )}
                <div>
                  <Label>Nome Completo *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Senha *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-input border-border" />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).filter(([k]) => isCeo || k !== "ceo").map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Select value={form.unidade_id} onValueChange={(v) => setForm({ ...form, unidade_id: v })}>
                    <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={createUser} className="w-full" disabled={creating}>
                  {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Cadastrar
                </Button>
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
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário.</TableCell></TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="border-border">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-semibold">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        {u.full_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{roleLabels[u.cargo] || u.cargo}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getUnitName(u.unidade_id)}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Switch checked={u.ativo} onCheckedChange={() => toggleActive(u)} />
                      ) : (
                        <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Sim" : "Não"}</Badge>
                      )}
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
