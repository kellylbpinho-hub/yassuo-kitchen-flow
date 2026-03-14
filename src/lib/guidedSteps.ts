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
        instruction: "Clique em 'Registrar Perda' para abrir o formulário.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-menu"]',
        instruction: "Selecione o cardápio do dia.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-dish"]',
        instruction: "Escolha a preparação (prato).",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-weights"]',
        instruction: "Informe as pesagens: sobra limpa, prato e orgânico.",
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
        selector: '[data-guide="select-cd"]',
        instruction: "Selecione o CD de origem.",
        position: "bottom",
      },
      {
        selector: '[data-guide="search-product"]',
        instruction: "Busque e selecione o produto desejado.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-qty"]',
        instruction: "Informe a quantidade desejada.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-submit-transfer"]',
        instruction: "Clique em 'Solicitar Transferência' para enviar.",
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
        instruction: "Use a busca para encontrar um produto.",
        position: "bottom",
      },
      {
        selector: '[data-guide="filter-unit"]',
        instruction: "Filtre por unidade para ver o saldo específico.",
        position: "bottom",
      },
      {
        selector: '[data-guide="product-row"]',
        instruction: "Clique em um produto para ver lotes e movimentações.",
        position: "bottom",
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
        instruction: "Escaneie o código de barras ou busque manualmente.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-validade"]',
        instruction: "Informe a data de validade do produto.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-lote"]',
        instruction: "Informe o código do lote.",
        position: "bottom",
      },
      {
        selector: '[data-guide="input-qty-receb"]',
        instruction: "Informe a quantidade recebida.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-confirm-receb"]',
        instruction: "Confirme o recebimento.",
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
        instruction: "Clique em 'Nova Compra' para iniciar.",
        position: "bottom",
      },
      {
        selector: '[data-guide="select-unit-compra"]',
        instruction: "Selecione a unidade de destino.",
        position: "bottom",
      },
      {
        selector: '[data-guide="btn-criar-oc"]',
        instruction: "Confirme para criar a ordem de compra.",
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
        instruction: "Selecione o período de análise.",
        position: "bottom",
      },
      {
        selector: '[data-guide="filter-unit-fin"]',
        instruction: "Filtre por unidade, se desejar.",
        position: "bottom",
      },
      {
        selector: '[data-guide="kpi-cards"]',
        instruction: "Aqui estão os indicadores financeiros resumidos.",
        position: "bottom",
      },
    ],
  },
];
