import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardCheck, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CheckItem {
  id: string;
  title: string;
  steps: string[];
  expected: string;
  category: string;
}

const checklist: CheckItem[] = [
  {
    id: "rec-existente",
    category: "Recebimento Digital",
    title: "Recebimento com produto existente",
    steps: [
      "Acesse /recebimento-digital",
      "Selecione um produto já cadastrado",
      "Selecione uma unidade do tipo CD",
      "Preencha código do lote, validade e quantidade",
      "Confirme o recebimento",
    ],
    expected:
      "Lote criado com status 'ativo', movement tipo 'entrada' registrado, estoque_atual do produto incrementado, audit_log com ação 'create' em tabela 'recebimento_digital'.",
  },
  {
    id: "rec-novo",
    category: "Recebimento Digital",
    title: "Recebimento com produto não cadastrado",
    steps: [
      "Acesse /estoque e crie um novo produto com estoque_atual = 0",
      "Acesse /recebimento-digital",
      "Selecione o produto recém-criado",
      "Selecione unidade CD, preencha lote/validade/quantidade",
      "Confirme o recebimento",
    ],
    expected:
      "Produto recebe estoque, lote criado, movement registrado. Verificar que estoque_atual = quantidade recebida.",
  },
  {
    id: "fefo-parcial",
    category: "Saída FEFO",
    title: "Saída FEFO parcial (consome parte de um lote)",
    steps: [
      "Certifique-se de ter um produto com pelo menos 1 lote ativo com quantidade > 10",
      "Acesse /estoque, clique no ícone de movimentação do produto",
      'Selecione tipo "Saída" e quantidade menor que o saldo do lote mais antigo',
      "Confirme a movimentação",
    ],
    expected:
      "Lote mais antigo (menor validade) tem quantidade reduzida mas status permanece 'ativo'. Movement tipo 'saida' criado. estoque_atual decrementado.",
  },
  {
    id: "fefo-zera",
    category: "Saída FEFO",
    title: "Saída FEFO que zera um lote",
    steps: [
      "Identifique um lote ativo com quantidade conhecida (ex: 5 kg)",
      "Acesse /estoque e faça saída com quantidade exata do lote",
      "Verifique o status do lote no banco",
    ],
    expected:
      "Lote muda para status 'consumido' (quantidade = 0). Se havia outros lotes, o próximo pela validade é consumido para o restante. Movement registrado corretamente.",
  },
  {
    id: "transfer-aprovada",
    category: "Transferências",
    title: "Transferência pendente → aprovada",
    steps: [
      "Crie uma transferência de um produto do CD para uma cozinha (rpc_request_transfer)",
      "Verifique que a transferência aparece com status 'pendente'",
      "Um gestor (CEO/GF) aprova a transferência",
      "Verifique os saldos: CD deve ter estoque reduzido, cozinha deve ter lote novo",
    ],
    expected:
      "Transferência muda para 'aprovada'. Lotes consumidos no CD via FEFO. Novo lote criado na unidade destino. Movements registrados em ambas as unidades. Audit log registrado.",
  },
  {
    id: "alerta-vencimento",
    category: "Alertas",
    title: "Alerta de vencimento (lote com validade próxima)",
    steps: [
      "Crie ou edite um lote com validade dentro dos próximos 30 dias (ou validade_minima_dias do produto)",
      "Acesse /alertas",
      "Verifique que o lote aparece na lista",
      "Acesse /dashboard e verifique o card 'Vence em Breve'",
    ],
    expected:
      "Lote aparece em /alertas com badge indicando dias restantes. Dashboard mostra contagem correta. Se lote já venceu, status muda para 'vencido' e audit_log é criado.",
  },
  {
    id: "rls-funcionario",
    category: "Segurança (RLS)",
    title: "Funcionário não acessa recebimento nem estoque CRUD",
    steps: [
      "Faça login com um usuário de cargo 'funcionario' (sem role de estoquista/comprador/gerente)",
      "Tente acessar /recebimento-digital — deve ser bloqueado ou sem permissão",
      "Tente criar um produto via /estoque — deve falhar com erro de RLS",
      "Tente registrar uma movimentação — deve falhar",
      "Verifique que o usuário consegue apenas visualizar dados permitidos pela policy",
    ],
    expected:
      "Todas as tentativas de INSERT/UPDATE devem falhar com erro de RLS. O funcionário só visualiza dados da sua empresa/unidade conforme policies. Nenhum dado de outra empresa é visível.",
  },
];

const categories = [...new Set(checklist.map((c) => c.category))];

export default function QA() {
  const { canManage } = useAuth();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalChecked = Object.values(checked).filter(Boolean).length;

  if (!canManage) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
          <p className="text-foreground font-medium">Acesso restrito a gestores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-foreground">QA — Checklist de Testes</h1>
        <Badge variant={totalChecked === checklist.length ? "default" : "secondary"}>
          {totalChecked}/{checklist.length}
        </Badge>
      </div>

      {categories.map((cat) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
            {cat}
          </h2>
          {checklist
            .filter((c) => c.category === cat)
            .map((item) => (
              <div
                key={item.id}
                className={cn(
                  "glass-card p-4 transition-all cursor-pointer",
                  checked[item.id] && "border-success/40 opacity-70"
                )}
                onClick={() => toggle(item.id)}
              >
                <div className="flex items-start gap-3">
                  {checked[item.id] ? (
                    <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium text-foreground",
                      checked[item.id] && "line-through"
                    )}>
                      {item.title}
                    </p>
                    <ol className="mt-2 space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                      {item.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <div className="mt-3 bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Resultado esperado
                      </p>
                      <p className="text-sm text-foreground">{item.expected}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
