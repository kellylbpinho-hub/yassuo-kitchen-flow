import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileDown,
  Package,
  ShoppingCart,
  ClipboardCheck,
  TrendingDown,
  DollarSign,
  Target,
  FileSpreadsheet,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  BarChart3,
  Utensils,
  Truck,
  Users,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Helpers ────────────────────────────────────────

const SectionNumber = ({ n }: { n: number }) => (
  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">
    {n}
  </span>
);

const SectionTitle = ({ n, title, subtitle }: { n: number; title: string; subtitle: string }) => (
  <div className="flex items-start gap-4 mb-6">
    <SectionNumber n={n} />
    <div>
      <h2 className="text-xl md:text-2xl font-display font-bold text-foreground leading-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  </div>
);

const ModuleCard = ({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Package;
  title: string;
  items: string[];
}) => (
  <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
    <div className="flex items-center gap-3 mb-3">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
    </div>
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
          <ChevronRight className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const KpiBlock = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={`rounded-xl border p-5 text-center ${accent ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
    <p className="text-2xl md:text-3xl font-bold font-display text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
  </div>
);

const DiffCard = ({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) => (
  <div className="flex gap-4 items-start">
    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <h4 className="font-semibold text-foreground text-sm">{title}</h4>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

// ─── PDF Export ──────────────────────────────────────

function exportPDF() {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.width;

  // Cover
  doc.setFillColor(30, 30, 30);
  doc.rect(0, 0, w, 297, "F");
  doc.setFontSize(32);
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.text("Yassuo Alimentação", w / 2, 80, { align: "center" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório Executivo do Produto", w / 2, 95, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(180);
  doc.text("ERP Profissional para Unidades de Alimentação e Nutrição", w / 2, 108, { align: "center" });
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, w / 2, 260, { align: "center" });

  // Page 2 — Vision
  doc.addPage();
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.text("1. Visão Geral do Produto", 14, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const vision = [
    "O Yassuo é um ERP verticalizado para gestão de Unidades de Alimentação e Nutrição (UAN),",
    "projetado para operações de cozinhas industriais, centros de distribuição e contratos de alimentação coletiva.",
    "",
    "O sistema integra estoque, compras, desperdício, cardápio, ficha técnica e inteligência financeira",
    "em uma plataforma única, com controle por lotes (FEFO), rastreabilidade e gestão multi-unidade.",
    "",
    "Atende cozinhas industriais de todos os portes com foco em eficiência operacional e redução de custos.",
  ];
  vision.forEach((l, i) => doc.text(l, 14, 38 + i * 6));

  // Page 2 — Modules table
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.text("2. Módulos Operacionais", 14, 90);

  autoTable(doc, {
    startY: 96,
    head: [["Módulo", "Funcionalidades"]],
    body: [
      ["Estoque FEFO", "Controle por lotes, rastreabilidade, validade, alertas automáticos"],
      ["Recebimento Digital", "Entrada por código de barras, lote, validade e conferência"],
      ["Compras", "OC com aprovação, custo unitário, unidade de compra vs estoque"],
      ["Pedido Interno", "Requisição kitchen→CD com bloqueio contratual"],
      ["Transferências", "CD→Cozinha com aprovação, consumo FEFO automático"],
      ["Desperdício", "Registro por 3 pesagens, vinculação a cardápio e prato"],
      ["Cardápio Semanal", "Montagem por unidade, fichas técnicas com fator de correção"],
    ],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [180, 30, 40], textColor: 255 },
    theme: "grid",
  });

  // Page 3 — Financial Intelligence
  doc.addPage();
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.text("3. Inteligência Financeira", 14, 25);

  autoTable(doc, {
    startY: 32,
    head: [["Indicador", "Descrição"]],
    body: [
      ["Custo Real / Refeição", "(Custo Insumos − Desperdício) ÷ Nº Refeições"],
      ["Custo Bruto / Refeição", "Custo total de insumos ÷ Nº Refeições"],
      ["Impacto Desperdício / Refeição", "Custo do desperdício ÷ Nº Refeições"],
      ["Meta vs Real", "Desvio percentual e monetário por unidade"],
      ["Status Visual", "Verde (≤ meta), Amarelo (até +5%), Vermelho (> +5%)"],
      ["Evolução Mensal", "Gráfico de tendência com linha de meta de referência"],
      ["Ranking por Contrato", "Comparativo de eficiência entre todas as unidades"],
    ],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [180, 30, 40], textColor: 255 },
    theme: "grid",
  });

  // Differentials
  let y = (doc as any).lastAutoTable?.finalY || 120;
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("4. Diferenciais Competitivos", 14, y + 16);

  autoTable(doc, {
    startY: y + 22,
    head: [["Diferencial", "Detalhes"]],
    body: [
      ["FEFO Automatizado", "Consumo automático do lote mais próximo do vencimento"],
      ["Multi-unidade", "Gestão centralizada de CD + múltiplas cozinhas industriais"],
      ["Controle Contratual", "Bloqueio de produtos fora do escopo por unidade"],
      ["7 Perfis de Acesso", "CEO, Financeiro, Operacional, Nutricionista, Estoquista, Comprador, Funcionário"],
      ["Exportação Profissional", "PDF executivo e Excel analítico com filtros e status visual"],
      ["Onboarding Guiado", "Tutorial progressivo por cargo com persistência de progresso"],
      ["Inteligência de Custo", "Custo real, meta, desvio e ranking em tempo real"],
    ],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [180, 30, 40], textColor: 255 },
    theme: "grid",
  });

  // Closing
  doc.addPage();
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.setFont("helvetica", "bold");
  doc.text("Posicionamento", w / 2, 60, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  const closing = [
    "O Yassuo se posiciona como o ERP mais completo e especializado",
    "para Unidades de Alimentação e Nutrição no Brasil.",
    "",
    "Combinando inteligência financeira, controle operacional rigoroso",
    "e uma experiência de usuário pensada para o dia-a-dia da cozinha industrial,",
    "o sistema transforma dados em decisões e custos em resultados.",
    "",
    "Pronto para escalar. Pronto para o mercado.",
  ];
  closing.forEach((l, i) => doc.text(l, w / 2, 80 + i * 7, { align: "center" }));

  // Footer all pages
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Yassuo Alimentação — Relatório Executivo — Página ${i}/${pages}`, 14, 287);
  }

  doc.save(`yassuo-relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Page Component ─────────────────────────────────

export default function RelatorioExecutivo() {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-fade-in pb-16" ref={contentRef}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-2">Relatório Executivo</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground leading-tight">
            Yassuo Alimentação
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-relaxed">
            ERP profissional para gestão de Unidades de Alimentação e Nutrição — controle operacional,
            inteligência financeira e rastreabilidade completa.
          </p>
        </div>
        <Button onClick={exportPDF} className="gap-2 flex-shrink-0">
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <Separator className="bg-border" />

      {/* 1. Visão Geral */}
      <section>
        <SectionTitle n={1} title="Visão Geral do Produto" subtitle="O que é o Yassuo e qual problema ele resolve" />
        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Yassuo</strong> é um ERP verticalizado para gestão de
            <strong className="text-foreground"> Unidades de Alimentação e Nutrição (UAN)</strong>, projetado para
            operações de cozinhas industriais, centros de distribuição e contratos de alimentação coletiva. O sistema
            integra <strong className="text-foreground">estoque por lotes (FEFO)</strong>, compras, desperdício,
            cardápio, ficha técnica e inteligência financeira em uma plataforma única, com rastreabilidade e gestão
            multi-unidade. Atende cozinhas industriais de todos os portes com foco em{" "}
            <strong className="text-foreground">eficiência operacional e redução de custos</strong>.
          </p>
        </div>
      </section>

      {/* 2. Módulos */}
      <section>
        <SectionTitle n={2} title="Módulos Operacionais" subtitle="Funcionalidades ativas em produção" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={Package}
            title="Estoque FEFO"
            items={[
              "Controle por lotes com rastreabilidade",
              "Consumo automático FEFO (primeiro a vencer, primeiro a sair)",
              "Alertas de validade crítica e estoque mínimo",
            ]}
          />
          <ModuleCard
            icon={ClipboardCheck}
            title="Recebimento Digital"
            items={[
              "Entrada por código de barras (GS1/EAN)",
              "Registro de lote, validade e quantidade",
              "Permitido apenas em unidades tipo CD",
            ]}
          />
          <ModuleCard
            icon={ShoppingCart}
            title="Compras"
            items={[
              "Ordens de compra com fluxo de aprovação",
              "Unidade de compra vs unidade de estoque",
              "Custo unitário e fator de conversão",
            ]}
          />
          <ModuleCard
            icon={Truck}
            title="Pedido Interno & Transferências"
            items={[
              "Requisição cozinha → CD com bloqueio contratual",
              "Aprovação gerencial com consumo FEFO automático",
              "Criação de lotes na unidade destino",
            ]}
          />
          <ModuleCard
            icon={TrendingDown}
            title="Desperdício"
            items={[
              "Registro por 3 pesagens (prato, rampa, orgânico)",
              "Vinculação a cardápio e preparação",
              "Análise por contrato com ranking de eficiência",
            ]}
          />
          <ModuleCard
            icon={Utensils}
            title="Cardápio & Ficha Técnica"
            items={[
              "Montagem semanal por unidade",
              "Ficha técnica com per capita e fator de correção",
              "Categorias de pratos configuráveis",
            ]}
          />
        </div>
      </section>

      {/* 3. Inteligência Financeira */}
      <section>
        <SectionTitle n={3} title="Inteligência Financeira" subtitle="Dashboard com KPIs de custo, desperdício e eficiência" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiBlock label="Custo Real / Refeição" value="R$/ref" accent />
          <KpiBlock label="Custo Bruto / Refeição" value="Insumos" />
          <KpiBlock label="Impacto Desperdício" value="R$/ref" />
          <KpiBlock label="% Desperdício / Custo" value="%" />
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Dashboard Financeiro consolida automaticamente compras (pedidos aprovados/recebidos),
            desperdício e refeições servidas para calcular o{" "}
            <strong className="text-foreground">custo real da refeição</strong> em tempo real. A fonte de dados
            prioriza itens de compra com custo unitário, garantindo precisão nos indicadores. Os KPIs são filtráveis
            por período e unidade, com exportação profissional em PDF e Excel.
          </p>
        </div>
      </section>

      {/* 4. Custo Real da Refeição */}
      <section>
        <SectionTitle n={4} title="Custo Real da Refeição" subtitle="Fórmula e composição do indicador principal" />
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-4">
          <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground text-center">
            Custo Real = (Custo Insumos − Custo Desperdício) ÷ Nº Refeições
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="text-center p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Custo Insumos</p>
              <p className="text-sm text-foreground font-medium">Soma de (qtd × custo unitário) dos itens de compra aprovados</p>
            </div>
            <div className="text-center p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Custo Desperdício</p>
              <p className="text-sm text-foreground font-medium">Soma de (qtd desperdiçada × custo unitário do produto)</p>
            </div>
            <div className="text-center p-4 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Nº Refeições</p>
              <p className="text-sm text-foreground font-medium">Colaboradores × dias úteis com cardápio ativo</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Desperdício por Contrato */}
      <section>
        <SectionTitle n={5} title="Desperdício por Contrato" subtitle="Análise comparativa entre unidades" />
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            O módulo de desperdício permite análise detalhada por contrato/unidade, identificando operações
            com maior impacto financeiro. O ranking compara % de desperdício sobre custo total, custo por
            refeição e dias ativos, fornecendo visibilidade para decisões de gestão.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiBlock label="Ranking por contrato" value="Top 5" />
            <KpiBlock label="% Desperdício / Custo" value="< 5%" />
            <KpiBlock label="Tendência mensal" value="12m" />
          </div>
        </div>
      </section>

      {/* 6. Meta vs Real */}
      <section>
        <SectionTitle n={6} title="Meta vs Real por Unidade" subtitle="Comparação de custo real com meta definida" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cada unidade/contrato pode ter uma <strong className="text-foreground">meta de custo por refeição</strong>{" "}
            (target_meal_cost) definida pelo CEO. O sistema calcula automaticamente o desvio percentual e monetário,
            sinalizando o status com código de cores:
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <div className="h-4 w-4 rounded-full bg-[hsl(var(--success))]" />
              <div>
                <p className="text-sm font-medium text-foreground">Dentro da meta</p>
                <p className="text-xs text-muted-foreground">Desvio ≤ 0%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <div className="h-4 w-4 rounded-full bg-[hsl(var(--warning))]" />
              <div>
                <p className="text-sm font-medium text-foreground">Atenção</p>
                <p className="text-xs text-muted-foreground">Desvio entre 0% e 5%</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <div className="h-4 w-4 rounded-full bg-[hsl(var(--destructive))]" />
              <div>
                <p className="text-sm font-medium text-foreground">Acima da meta</p>
                <p className="text-xs text-muted-foreground">Desvio &gt; 5%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Exportação */}
      <section>
        <SectionTitle n={7} title="Exportação de Relatórios" subtitle="PDF executivo e Excel analítico" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <FileDown className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">PDF — Visão Executiva</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />KPIs consolidados do período</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Evolução mensal com meta de referência</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Ranking por contrato com desvio e status</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Cabeçalho com filtros aplicados</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 mb-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Excel — Visão Analítica</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Aba "Resumo" com todos os indicadores</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Aba "Evolução Mensal" com dados numéricos</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Aba "Por Contrato" com métricas por unidade</li>
              <li className="flex gap-2"><ChevronRight className="h-3 w-3 text-primary mt-0.5" />Colunas formatadas com largura automática</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. Modo Guiado */}
      <section>
        <SectionTitle n={8} title="Onboarding Progressivo" subtitle="Tutorial guiado por cargo com persistência" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O <strong className="text-foreground">Modo Guiado</strong> oferece tutoriais passo a passo para cada
            fluxo operacional, filtrados automaticamente pelo cargo do usuário. O progresso é salvo no perfil,
            permitindo que o usuário retome de onde parou em qualquer dispositivo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Registrar desperdicio" },
              { label: "Fazer pedido interno" },
              { label: "Consultar estoque" },
              { label: "Registrar recebimento" },
              { label: "Criar compra" },
              { label: "Dashboard financeiro" },
            ].map((t) => (
              <div key={t.label} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="text-sm text-foreground font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Diferenciais */}
      <section>
        <SectionTitle n={9} title="Diferenciais Competitivos" subtitle="O que diferencia o Yassuo no mercado" />
        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <DiffCard icon={Layers} title="FEFO Automatizado" desc="Consumo inteligente do lote mais próximo do vencimento, reduzindo perdas por validade." />
            <DiffCard icon={BarChart3} title="Inteligência de Custo em Tempo Real" desc="Custo real, meta, desvio e ranking calculados automaticamente com dados de compra e desperdício." />
            <DiffCard icon={Users} title="7 Perfis de Acesso" desc="CEO, Financeiro, Operacional, Nutricionista, Estoquista, Comprador e Funcionário com permissões granulares." />
            <DiffCard icon={ShieldCheck} title="Controle Contratual" desc="Bloqueio de produtos fora do escopo por unidade, impedindo solicitações não autorizadas." />
            <DiffCard icon={ArrowUpRight} title="Exportação Profissional" desc="PDF executivo e Excel analítico com filtros, status visual e cabeçalhos identificadores." />
            <DiffCard icon={HelpCircle} title="Onboarding Guiado por Cargo" desc="Tutorial progressivo com persistência de progresso, reduzindo curva de aprendizado." />
          </div>
        </div>
      </section>

      {/* 10. Posicionamento Final */}
      <section>
        <SectionTitle n={10} title="Posicionamento" subtitle="O Yassuo como ERP profissional de UAN" />
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 md:p-10 text-center space-y-4">
          <p className="text-lg md:text-xl font-display font-bold text-foreground leading-relaxed max-w-2xl mx-auto">
            O Yassuo se posiciona como o ERP mais completo e especializado para Unidades de Alimentação e
            Nutrição no Brasil.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Combinando inteligência financeira, controle operacional rigoroso e uma experiência de usuário
            pensada para o dia-a-dia da cozinha industrial, o sistema transforma dados em decisões e custos
            em resultados.
          </p>
          <Separator className="bg-border max-w-xs mx-auto" />
          <p className="text-sm font-semibold text-primary">Pronto para escalar. Pronto para o mercado.</p>
        </div>
      </section>
    </div>
  );
}
