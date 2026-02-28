import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield, Check, X as XIcon, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ROLES = [
  { key: "ceo", label: "CEO" },
  { key: "gerente_operacional", label: "Gerente Operacional" },
  { key: "gerente_financeiro", label: "Gerente Financeiro" },
  { key: "nutricionista", label: "Nutricionista" },
  { key: "estoquista", label: "Estoquista" },
  { key: "comprador", label: "Comprador" },
  { key: "funcionario", label: "Funcionário" },
] as const;

interface PageAccess {
  page: string;
  path: string;
  roles: Record<string, "full" | "readonly" | "blocked">;
}

const ACCESS_MATRIX: PageAccess[] = [
  {
    page: "Dashboard",
    path: "/dashboard",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "full", estoquista: "full", comprador: "full", funcionario: "full",
    },
  },
  {
    page: "Estoque",
    path: "/estoque",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "readonly", estoquista: "full", comprador: "full", funcionario: "readonly",
    },
  },
  {
    page: "Recebimento Digital",
    path: "/recebimento-digital",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "full", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Transferência Interna",
    path: "/pedido-interno",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "full", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Aprovações CD",
    path: "/aprovacoes-cd",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Meus Pedidos",
    path: "/meus-pedidos",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "full", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Compras",
    path: "/compras",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "blocked", estoquista: "blocked", comprador: "full", funcionario: "blocked",
    },
  },
  {
    page: "Desperdício",
    path: "/desperdicio",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "full", estoquista: "full", comprador: "full", funcionario: "full",
    },
  },
  {
    page: "Alertas",
    path: "/alertas",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "full", estoquista: "full", comprador: "full", funcionario: "full",
    },
  },
  {
    page: "Categorias",
    path: "/categorias",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "readonly",
      nutricionista: "full", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Usuários",
    path: "/usuarios",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Unidades",
    path: "/unidades",
    roles: {
      ceo: "full", gerente_operacional: "full", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
  {
    page: "Config. de Acesso",
    path: "/configuracoes-acesso",
    roles: {
      ceo: "full", gerente_operacional: "blocked", gerente_financeiro: "blocked",
      nutricionista: "blocked", estoquista: "blocked", comprador: "blocked", funcionario: "blocked",
    },
  },
];

function AccessIcon({ level }: { level: "full" | "readonly" | "blocked" }) {
  if (level === "full") return <Check className="h-4 w-4 text-emerald-400 mx-auto" />;
  if (level === "readonly") return <Minus className="h-4 w-4 text-yellow-400 mx-auto" />;
  return <XIcon className="h-4 w-4 text-destructive mx-auto" />;
}

export default function ConfiguracoesAcesso() {
  const { isCeo } = useAuth();

  if (!isCeo) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações de Acesso</h1>
          <p className="text-sm text-muted-foreground">Matriz de permissões por cargo e página</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Check className="h-4 w-4 text-emerald-400" />
          <span className="text-muted-foreground">Acesso total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus className="h-4 w-4 text-yellow-400" />
          <span className="text-muted-foreground">Somente leitura</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XIcon className="h-4 w-4 text-destructive" />
          <span className="text-muted-foreground">Bloqueado</span>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">Página</TableHead>
                {ROLES.map((r) => (
                  <TableHead key={r.key} className="text-center min-w-[100px]">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {r.label}
                    </Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACCESS_MATRIX.map((row) => (
                <TableRow key={row.path}>
                  <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                    <div>
                      <span>{row.page}</span>
                      <span className="block text-[10px] text-muted-foreground">{row.path}</span>
                    </div>
                  </TableCell>
                  {ROLES.map((r) => (
                    <TableCell key={r.key} className="text-center">
                      <AccessIcon level={row.roles[r.key]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
