export interface GuidedStep {
  /** CSS selector for the element to highlight */
  selector: string;
  /** Short instruction text */
  instruction: string;
  /** Position of the tooltip relative to the element */
  position?: "top" | "bottom" | "left" | "right";
}

export interface GuidedTask {
  id: string;
  label: string;
  emoji: string;
  route: string;
  /** Roles that can access this task (empty = all) */
  allowedRoles?: string[];
  /** Roles that are blocked from this task */
  blockedRoles?: string[];
  steps: GuidedStep[];
}

export const guidedTasks: GuidedTask[] = [
  {
    id: "registrar-desperdicio",
    label: "Registrar desperdício",
    emoji: "🗑️",
    route: "/desperdicio",
    blockedRoles: ["comprador", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="btn-registrar-perda"]',
        instruction: "Clique em 'Registrar Perda' para abrir o formulário de desperdício.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-menu"]',
        instruction: "Selecione o cardápio do dia correspondente.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-dish"]',
        instruction: "Escolha a preparação (prato) que teve desperdício.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-weights"]',
        instruction: "Informe as 3 pesagens: Sobra Prato, Sobra Rampa e Orgânico (em kg).",
        position: "top",
      },
      {
        selector: '[data-guide="btn-submit-waste"]',
        instruction: "Clique em 'Registrar' para salvar o desperdício.",
        position: "top",
      },
    ],
  },
  {
    id: "pedido-interno",
    label: "Fazer pedido interno",
    emoji: "📋",
    route: "/pedido-interno",
    blockedRoles: ["comprador", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="search-product"]',
        instruction: "Busque o produto desejado por nome ou categoria.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-cd"]',
        instruction: "Selecione o Centro de Distribuição (CD) de origem.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-qty"]',
        instruction: "Informe a quantidade desejada na unidade de medida do produto.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-submit-transfer"]',
        instruction: "Clique em 'Enviar Pedido ao CD' para solicitar a transferência.",
        position: "top",
      },
    ],
  },
  {
    id: "consultar-estoque",
    label: "Consultar estoque",
    emoji: "📦",
    route: "/estoque",
    steps: [
      {
        selector: '[data-guide="search-estoque"]',
        instruction: "Use o campo de busca para encontrar um produto pelo nome.",
        position: "bottom",
      },
      {
        selector: '[data-guide="filter-unit"]',
        instruction: "Filtre por unidade para ver o saldo específico de cada local.",
        position: "bottom",
      },
      {
        selector: '[data-guide="category-chips"]',
        instruction: "Filtre por categoria clicando nos chips (ex: Proteínas, Hortifruti).",
        position: "bottom",
      },
      {
        selector: '[data-guide="product-row"]',
        instruction: "Veja os dados do produto na tabela: saldo, mínimo e unidade.",
        position: "bottom",
      },
      {
        selector: '[data-guide="product-actions"]',
        instruction: "Clique nos 3 pontos para ver Detalhes, Editar ou Movimentar o produto.",
        position: "left",
      },
    ],
  },
  {
    id: "registrar-recebimento",
    label: "Registrar recebimento",
    emoji: "📥",
    route: "/recebimento-digital",
    blockedRoles: ["gerente_financeiro", "comprador", "nutricionista"],
    steps: [
      {
        selector: '[data-guide="btn-scan"]',
        instruction: "Escaneie o código de barras do produto ou clique em 'Buscar produto' para buscar manualmente.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-validade"]',
        instruction: "Informe a data de validade conforme a etiqueta do produto.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-lote"]',
        instruction: "Digite o código do lote impresso na embalagem.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-qty-receb"]',
        instruction: "Informe a quantidade (ou peso) recebida.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-confirm-receb"]',
        instruction: "Clique em 'Confirmar Recebimento' para finalizar a entrada no estoque.",
        position: "top",
      },
    ],
  },
  {
    id: "criar-compra",
    label: "Criar compra",
    emoji: "🛒",
    route: "/compras",
    blockedRoles: ["estoquista", "funcionario", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="btn-nova-compra"]',
        instruction: "Clique em 'Novo Pedido' para iniciar uma ordem de compra.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-unit-compra"]',
        instruction: "Selecione a unidade de destino da compra.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-criar-oc"]',
        instruction: "Clique em 'Criar Pedido' para gerar a OC. Depois adicione itens na tela de detalhes.",
        position: "top",
      },
    ],
  },
  {
    id: "ver-dashboard-financeiro",
    label: "Ver dashboard financeiro",
    emoji: "💰",
    route: "/dashboard-financeiro",
    allowedRoles: ["ceo", "gerente_financeiro", "gerente_operacional"],
    steps: [
      {
        selector: '[data-guide="filter-period"]',
        instruction: "Selecione o período de análise (3, 6 ou 12 meses).",
        position: "bottom",
      },
      {
        selector: '[data-guide="filter-unit-fin"]',
        instruction: "Filtre por unidade específica ou veja todas.",
        position: "bottom",
      },
      {
        selector: '[data-guide="kpi-cards"]',
        instruction: "Aqui estão os KPIs: custo por refeição, custo total, desperdício e % desp/custo.",
        position: "bottom",
      },
      {
        selector: '[data-guide="chart-monthly"]',
        instruction: "Acompanhe a evolução mensal de compras vs desperdício.",
        position: "top",
      },
      {
        selector: '[data-guide="ranking-table"]',
        instruction: "Veja o ranking por contrato/unidade com custo e eficiência.",
        position: "top",
      },
    ],
  },
];
