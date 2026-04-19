import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, Loader2, Truck, Pencil, Archive, ArchiveRestore, MoreVertical,
  Phone, Mail, FileText, Tag, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { cn } from "@/lib/utils";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  categoria: string | null;
  condicao_pagamento: string | null;
  observacao: string | null;
  ativo: boolean;
  created_at: string;
}

const CATEGORIAS = [
  "Proteínas", "Hortifruti", "Laticínios", "Mercearia",
  "Bebidas", "Descartáveis", "Higiene e Limpeza", "Congelados", "Outros",
];

const CONDICOES = [
  "À vista", "7 dias", "14 dias", "21 dias", "28 dias", "30 dias",
  "30/60 dias", "30/60/90 dias", "Boleto faturado", "Outros",
];

interface FormState {
  nome: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
  categoria: string;
  condicao_pagamento: string;
  observacao: string;
}

const emptyForm: FormState = {
  nome: "", cnpj: "", contato: "", telefone: "", email: "",
  categoria: "", condicao_pagamento: "", observacao: "",
};

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export default function Fornecedores() {
  const { isCeo, isGerenteOperacional, isFinanceiro } = useAuth();
  const canManage = isCeo || isGerenteOperacional;

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "arquivados" | "todos">("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("fornecedores")
      .select("*")
      .order("nome", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar fornecedores: " + error.message);
    } else {
      setFornecedores((data || []) as Fornecedor[]);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fornecedores.filter((f) => {
      if (statusFilter === "ativos" && !f.ativo) return false;
      if (statusFilter === "arquivados" && f.ativo) return false;
      if (!q) return true;
      const cnpjDigits = (f.cnpj || "").replace(/\D/g, "");
      return (
        f.nome.toLowerCase().includes(q) ||
        cnpjDigits.includes(q.replace(/\D/g, "")) ||
        (f.categoria || "").toLowerCase().includes(q)
      );
    });
  }, [fornecedores, search, statusFilter]);

  const stats = useMemo(() => {
    const ativos = fornecedores.filter((f) => f.ativo).length;
    return {
      total: fornecedores.length,
      ativos,
      arquivados: fornecedores.length - ativos,
    };
  }, [fornecedores]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(f: Fornecedor) {
    setEditing(f);
    setForm({
      nome: f.nome || "",
      cnpj: f.cnpj || "",
      contato: f.contato || "",
      telefone: f.telefone || "",
      email: f.email || "",
      categoria: f.categoria || "",
      condicao_pagamento: f.condicao_pagamento || "",
      observacao: f.observacao || "",
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!form.cnpj.trim() || form.cnpj.replace(/\D/g, "").length < 14) {
      toast.error("CNPJ é obrigatório (14 dígitos).");
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cnpj: form.cnpj.trim() || null,
      contato: form.contato.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      categoria: form.categoria || null,
      condicao_pagamento: form.condicao_pagamento || null,
      observacao: form.observacao.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("fornecedores").update(payload).eq("id", editing.id));
    } else {
      // company_id is required by schema; obtain via RPC current_company_id through profile select
      const { data: prof } = await supabase.from("profiles").select("company_id").maybeSingle();
      if (!prof?.company_id) {
        toast.error("Empresa não identificada.");
        setSaving(false);
        return;
      }
      ({ error } = await supabase.from("fornecedores").insert({ ...payload, company_id: prof.company_id, ativo: true }));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editing ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      setDialogOpen(false);
      await loadData();
    }
    setSaving(false);
  }

  async function toggleArchive(f: Fornecedor) {
    const next = !f.ativo;
    const { error } = await supabase.from("fornecedores").update({ ativo: next }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Fornecedor reativado." : "Fornecedor arquivado.");
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-eyebrow text-muted-foreground">Suprimentos</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Fornecedores</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre e gerencie os fornecedores vinculados aos pedidos de compra.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </Button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-3">
          <p className="text-eyebrow text-muted-foreground">Cadastrados</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-eyebrow text-muted-foreground">Ativos</p>
          <p className="text-xl font-bold text-success mt-1">{stats.ativos}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-eyebrow text-muted-foreground">Arquivados</p>
          <p className="text-xl font-bold text-muted-foreground mt-1">{stats.arquivados}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-input border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="bg-input border-border w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="arquivados">Arquivados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        fornecedores.length === 0 ? (
          <div className="glass-card p-8">
            <EmptyState
              icon={Truck}
              title="Nenhum fornecedor cadastrado"
              description="Cadastre seus fornecedores para vincular pedidos de compra e controlar suas aquisições."
              actionLabel={canManage ? "Cadastrar primeiro fornecedor" : undefined}
              onAction={canManage ? openCreate : undefined}
            />
          </div>
        ) : (
          <div className="glass-card p-8">
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description="Ajuste os filtros ou a busca para encontrar fornecedores."
            />
          </div>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => (
            <div
              key={f.id}
              className={cn(
                "glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors",
                !f.ativo && "opacity-70"
              )}
            >
              <div className="h-10 w-10 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground truncate">{f.nome}</h3>
                  {f.ativo ? (
                    <Badge variant="outline" className="text-[10px] border-success/40 text-success bg-success/10">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Arquivado
                    </Badge>
                  )}
                  {f.categoria && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      {f.categoria}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {f.cnpj && <span className="font-mono">{f.cnpj}</span>}
                  {f.telefone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {f.telefone}
                    </span>
                  )}
                  {f.email && (
                    <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                      <Mail className="h-3 w-3" />
                      {f.email}
                    </span>
                  )}
                  {f.condicao_pagamento && (
                    <span className="inline-flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {f.condicao_pagamento}
                    </span>
                  )}
                </div>
              </div>

              {canManage && !isFinanceiro && (
                <div className="flex items-center gap-1 self-end sm:self-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(f)} className="h-8 gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">Editar</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleArchive(f)} className="gap-2">
                        {f.ativo ? (
                          <>
                            <Archive className="h-4 w-4" />
                            Arquivar
                          </>
                        ) : (
                          <>
                            <ArchiveRestore className="h-4 w-4" />
                            Reativar
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do fornecedor."
                : "Cadastre um novo fornecedor para vincular aos pedidos de compra."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome">
                Nome do fornecedor <span className="text-primary">*</span>
              </Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Distribuidora Central Ltda"
                className="bg-input border-border"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cnpj">
                CNPJ <span className="text-primary">*</span>
              </Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCnpj(e.target.value) })}
                placeholder="00.000.000/0000-00"
                className="bg-input border-border font-mono"
                inputMode="numeric"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                <Input
                  id="telefone"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: formatPhone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  className="bg-input border-border"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contato">Contato (pessoa)</Label>
                <Input
                  id="contato"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  placeholder="Nome do vendedor"
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail comercial</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contato@fornecedor.com.br"
                className="bg-input border-border"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria principal</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(v) => setForm({ ...form, categoria: v })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Condição de pagamento</Label>
                <Select
                  value={form.condicao_pagamento}
                  onValueChange={(v) => setForm({ ...form, condicao_pagamento: v })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICOES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observacao" className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Observações
              </Label>
              <Textarea
                id="observacao"
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Informações adicionais, prazos especiais, restrições..."
                className="bg-input border-border min-h-[80px]"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar alterações" : "Cadastrar fornecedor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
