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
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Loader2, AlertCircle, Briefcase, Settings, DollarSign, Leaf, Archive, ShoppingCart, Link2, Copy, Check, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import avatarCeoCaio from "@/assets/avatar-ceo-caio.png";
import avatarGfKaren from "@/assets/avatar-gf-karen.png";

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
interface UserUnidade { user_id: string; unidade_id: string; }

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  gerente_financeiro: "Gerente Financeiro",
  gerente_operacional: "Gerente Operacional",
  nutricionista: "Nutricionista",
  estoquista: "Estoquista",
  comprador: "Comprador",
};

const roleIcons: Record<string, LucideIcon> = {
  ceo: Briefcase,
  gerente_operacional: Settings,
  gerente_financeiro: DollarSign,
  nutricionista: Leaf,
  estoquista: Archive,
  comprador: ShoppingCart,
};

export default function Usuarios() {
  const { canManageUsers, isCeo, profile } = useAuth();
  const [users, setUsers] = useState<ProfileUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [userUnidades, setUserUnidades] = useState<UserUnidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    cargo: "estoquista",
    unidade_ids: [] as string[],
  });

  const [form, setForm] = useState({
    full_name: "", email: "", password: "", cargo: "estoquista", unidade_ids: [] as string[],
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: p }, { data: u }, { data: uu }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("units").select("id, name"),
      supabase.from("user_unidades").select("user_id, unidade_id"),
    ]);
    setUsers((p || []) as ProfileUser[]);
    setUnits((u || []) as Unit[]);
    setUserUnidades((uu || []) as UserUnidade[]);
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
          unidade_ids: form.unidade_ids,
        },
      });

      if (fnErr || data?.error) {
        setError("Erro ao criar usuário: " + (data?.error || fnErr?.message));
        setCreating(false);
        return;
      }

      toast.success("Usuário criado com sucesso!");
      setAddOpen(false);
      setForm({ full_name: "", email: "", password: "", cargo: "estoquista", unidade_ids: [] });
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

  const getUserUnits = (userId: string) =>
    userUnidades
      .filter((uu) => uu.user_id === userId)
      .map((uu) => units.find((u) => u.id === uu.unidade_id)?.name)
      .filter(Boolean);

  const toggleUnit = (unitId: string) => {
    setForm((f) => ({
      ...f,
      unidade_ids: f.unidade_ids.includes(unitId)
        ? f.unidade_ids.filter((id) => id !== unitId)
        : [...f.unidade_ids, unitId],
    }));
  };

  const toggleInviteUnit = (unitId: string) => {
    setInviteForm((f) => ({
      ...f,
      unidade_ids: f.unidade_ids.includes(unitId)
        ? f.unidade_ids.filter((id) => id !== unitId)
        : [...f.unidade_ids, unitId],
    }));
  };

  const generateInvite = async () => {
    if (!profile?.company_id) {
      toast.error("Empresa não encontrada.");
      return;
    }
    setCreating(true);
    setError("");
    setInviteLink("");

    const { data, error: insertError } = await supabase
      .from("invitations")
      .insert({
        company_id: profile.company_id,
        cargo: inviteForm.cargo as any,
        unidade_ids: inviteForm.unidade_ids,
        created_by: profile.user_id,
      })
      .select("token")
      .single();

    if (insertError) {
      setError("Erro ao gerar convite: " + insertError.message);
      setCreating(false);
      return;
    }

    const link = `${window.location.origin}/convite/${data.token}`;
    setInviteLink(link);
    setCreating(false);
    toast.success("Convite gerado com sucesso!");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
      ...f,
      unidade_ids: f.unidade_ids.includes(unitId)
        ? f.unidade_ids.filter((id) => id !== unitId)
        : [...f.unidade_ids, unitId],
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-foreground">Usuários</h1>
        {canManageUsers && (
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
                  <Label>Senha Provisória *</Label>
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
                  <Label>Unidades</Label>
                  <div className="space-y-2 mt-1 p-3 rounded-lg bg-input border border-border max-h-40 overflow-y-auto">
                    {units.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
                    ) : (
                      units.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={form.unidade_ids.includes(u.id)}
                            onCheckedChange={() => toggleUnit(u.id)}
                          />
                          <span className="text-sm">{u.name}</span>
                        </label>
                      ))
                    )}
                  </div>
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
                <TableHead>Unidades</TableHead>
                <TableHead>Ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário.</TableCell></TableRow>
              ) : (
                users.map((u) => {
                  const unitNames = getUserUnits(u.user_id);
                  return (
                    <TableRow key={u.id} className="border-border">
                      <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                          {u.cargo === "ceo" ? (
                            <img src={avatarCeoCaio} alt="CEO" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : u.cargo === "gerente_financeiro" ? (
                            <img src={avatarGfKaren} alt="Gerente Financeiro" className="h-8 w-8 rounded-full object-cover shrink-0" />
                          ) : (() => {
                            const IconComp = roleIcons[u.cargo];
                            return (
                              <div className="h-8 w-8 rounded-full bg-[#D90429] flex items-center justify-center shrink-0">
                                {IconComp ? <IconComp className="h-4 w-4 text-white" /> : <Briefcase className="h-4 w-4 text-white" />}
                              </div>
                            );
                          })()}
                          {u.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{roleLabels[u.cargo] || u.cargo}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {unitNames.length > 0
                          ? unitNames.map((n) => <Badge key={n} variant="outline" className="mr-1 text-xs">{n}</Badge>)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {canManageUsers ? (
                          <Switch checked={u.ativo} onCheckedChange={() => toggleActive(u)} />
                        ) : (
                          <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Sim" : "Não"}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
