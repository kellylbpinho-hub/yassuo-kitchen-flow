export type GuidedCompletionType =
  | "field_filled"
  | "select_chosen"
  | "numeric_gt_zero"
  | "button_clicked"
  | "submit_success"
  | "viewed";

export interface GuidedStep {
  /** CSS selector for the element to highlight */
  selector: string;
  /** Short instruction text */
  instruction: string;
  /** Position of the tooltip relative to the element */
  position?: "top" | "bottom" | "left" | "right";
  /** Completion rule for this step */
  completionType: GuidedCompletionType;
  /** Optional selector to read value from (inside or outside selector root) */
  completionSelector?: string;
  /** Required for submit_success; event dispatched by page after successful action */
  successEvent?: string;
  /** If step element does not exist, auto-skip (useful for conditional UI) */
  optional?: boolean;
  /** Delay in ms before auto-advance after completion */
  advanceDelay?: number;
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
    label: "Registrar desperdicio",
    emoji: "",
    route: "/desperdicio",
    blockedRoles: ["comprador", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="btn-registrar-perda"]',
        instruction: "Clique em 'Registrar Perda' para abrir o formulário de desperdício.",
        position: "bottom",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="select-menu"]',
        instruction: "Selecione o cardápio do dia correspondente.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="select-dish"]',
        instruction: "Escolha a preparação (prato) que teve desperdício.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="input-weights"]',
        instruction: "Informe as 3 pesagens: Sobra Prato, Sobra Rampa e Orgânico (em kg).",
        position: "top",
        completionType: "numeric_gt_zero",
        advanceDelay: 1200,
      },
      {
        selector: '[data-guide="btn-submit-waste"]',
        instruction: "Clique em 'Registrar' para salvar o desperdício.",
        position: "top",
        completionType: "submit_success",
        successEvent: "guided:waste:success",
      },
    ],
  },
  {
    id: "pedido-interno",
    label: "Fazer pedido interno",
    emoji: "",
    route: "/pedido-interno",
    blockedRoles: ["comprador", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="order-header"]',
        instruction: "Preencha o cabeçalho do pedido: selecione o CD de origem (e cozinha de destino, se aplicável).",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 2000,
      },
      {
        selector: '[data-guide="search-product"]',
        completionSelector: '[data-guide="search-product"] input',
        instruction: "Busque e selecione o produto desejado por nome.",
        position: "bottom",
        completionType: "field_filled",
      },
      {
        selector: '[data-guide="input-qty"]',
        completionSelector: '[data-guide="input-qty"] input',
        instruction: "Informe a quantidade desejada na unidade de medida do produto.",
        position: "bottom",
        completionType: "numeric_gt_zero",
      },
      {
        selector: '[data-guide="btn-add-item"]',
        instruction: "Clique em 'Adicionar item' para incluir o produto na lista do pedido.",
        position: "top",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="items-list"]',
        instruction: "Confira os itens adicionados. Você pode adicionar mais produtos ou remover itens.",
        position: "top",
        completionType: "viewed",
        advanceDelay: 2000,
      },
      {
        selector: '[data-guide="btn-submit-transfer"]',
        instruction: "Clique em 'Enviar Pedido ao CD' para enviar todos os itens de uma vez.",
        position: "top",
        completionType: "submit_success",
        successEvent: "guided:transfer:success",
      },
    ],
  },
  {
    id: "consultar-estoque",
    label: "Consultar estoque",
    emoji: "",
    route: "/estoque",
    steps: [
      {
        selector: '[data-guide="search-estoque"]',
        completionSelector: '[data-guide="search-estoque"] input',
        instruction: "Use o campo de busca para encontrar um produto pelo nome.",
        position: "bottom",
        completionType: "field_filled",
      },
      {
        selector: '[data-guide="filter-unit"]',
        instruction: "Filtre por unidade para ver o saldo específico de cada local.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="category-chips"]',
        instruction: "Filtre por categoria clicando em um chip (ex: Proteínas, Hortifruti).",
        position: "bottom",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="product-row"]',
        instruction: "Veja os dados do produto na tabela: saldo, mínimo e unidade.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 1400,
      },
      {
        selector: '[data-guide="product-actions"]',
        instruction: "Clique nos 3 pontos para ver Detalhes, Editar ou Movimentar o produto.",
        position: "left",
        completionType: "button_clicked",
      },
    ],
  },
  {
    id: "registrar-recebimento",
    label: "Registrar recebimento",
    emoji: "",
    route: "/recebimento-digital",
    blockedRoles: ["gerente_financeiro", "comprador", "nutricionista"],
    steps: [
      {
        selector: '[data-guide="btn-scan"]',
        instruction: "Escaneie o código de barras do produto ou clique em 'Buscar produto' para buscar manualmente.",
        position: "bottom",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="input-validade"]',
        instruction: "Informe a data de validade conforme a etiqueta do produto.",
        position: "bottom",
        completionType: "field_filled",
      },
      {
        selector: '[data-guide="input-lote"]',
        instruction: "Digite o código do lote impresso na embalagem.",
        position: "bottom",
        completionType: "field_filled",
      },
      {
        selector: '[data-guide="input-qty-receb"]',
        completionSelector: '[data-guide="input-qty-receb"] input',
        instruction: "Informe a quantidade (ou peso) recebida.",
        position: "bottom",
        completionType: "numeric_gt_zero",
      },
      {
        selector: '[data-guide="btn-confirm-receb"]',
        instruction: "Clique em 'Confirmar Recebimento' para finalizar a entrada no estoque.",
        position: "top",
        completionType: "submit_success",
        successEvent: "guided:receipt:success",
      },
    ],
  },
  {
    id: "criar-compra",
    label: "Criar compra",
    emoji: "",
    route: "/compras",
    blockedRoles: ["estoquista", "funcionario", "gerente_financeiro"],
    steps: [
      {
        selector: '[data-guide="btn-nova-compra"]',
        instruction: "Clique em 'Novo Pedido' para iniciar uma ordem de compra.",
        position: "bottom",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="select-unit-compra"]',
        instruction: "Selecione a unidade de destino da compra.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="btn-criar-oc"]',
        instruction: "Clique em 'Criar Pedido' para gerar a OC.",
        position: "top",
        completionType: "submit_success",
        successEvent: "guided:purchase-order:success",
      },
    ],
  },
  {
    id: "ver-dashboard-financeiro",
    label: "Ver dashboard financeiro",
    emoji: "",
    route: "/dashboard-financeiro",
    allowedRoles: ["ceo", "gerente_financeiro", "gerente_operacional"],
    steps: [
      {
        selector: '[data-guide="filter-period"]',
        instruction: "Selecione o período de análise (3, 6 ou 12 meses).",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="filter-unit-fin"]',
        instruction: "Filtre por unidade específica ou veja todas.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="kpi-cards"]',
        instruction: "Aqui estão os KPIs: custo por refeição, custo total, desperdício e % desp/custo.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 1400,
      },
      {
        selector: '[data-guide="chart-monthly"]',
        instruction: "Acompanhe a evolução mensal de compras vs desperdício.",
        position: "top",
        completionType: "viewed",
        advanceDelay: 1400,
      },
      {
        selector: '[data-guide="ranking-table"]',
        instruction: "Veja o ranking por contrato/unidade com custo e eficiência.",
        position: "top",
        completionType: "viewed",
        advanceDelay: 1400,
      },
    ],
  },
  // ──────────── Nutrition Module Tasks ────────────
  {
    id: "montar-cardapio",
    label: "Montar cardapio semanal",
    emoji: "",
    route: "/cardapio-semanal",
    blockedRoles: ["comprador", "gerente_financeiro", "estoquista"],
    steps: [
      {
        selector: '[data-guide="week-nav"]',
        instruction: "Navegue até a semana desejada usando as setas ou clique em 'Hoje'.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 1500,
      },
      {
        selector: '[data-guide="week-grid"]',
        instruction: "Clique em um dia da semana para abrir o cardápio do dia.",
        position: "top",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="select-status-dia"]',
        instruction: "Defina o status do dia (Com Cardápio, Folga, Feriado ou Sem Produção).",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="add-dish-section"]',
        instruction: "Busque e adicione pratos ao cardápio do dia clicando no '+'.",
        position: "top",
        completionType: "viewed",
        advanceDelay: 2000,
      },
    ],
  },
  {
    id: "ficha-tecnica",
    label: "Criar ficha tecnica",
    emoji: "",
    route: "/cardapio-semanal",
    blockedRoles: ["comprador", "gerente_financeiro", "estoquista"],
    steps: [
      {
        selector: '[data-guide="week-grid"]',
        instruction: "Clique em um dia que já possua cardápio montado.",
        position: "top",
        completionType: "button_clicked",
      },
      {
        selector: '[data-guide="tab-ficha-tecnica"]',
        instruction: "Clique na aba 'Ficha Técnica' para acessar os ingredientes.",
        position: "bottom",
        completionType: "button_clicked",
      },
    ],
  },
  {
    id: "planejar-insumos",
    label: "Planejar insumos da semana",
    emoji: "",
    route: "/planejamento-insumos",
    blockedRoles: ["comprador", "gerente_financeiro", "estoquista", "funcionario"],
    steps: [
      {
        selector: '[data-guide="select-unit-insumos"]',
        instruction: "Selecione a unidade (cozinha) para calcular a previsão.",
        position: "bottom",
        completionType: "select_chosen",
      },
      {
        selector: '[data-guide="btn-prev-week"]',
        instruction: "Navegue até a semana desejada.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 1500,
      },
      {
        selector: '[data-guide="kpi-insumos"]',
        instruction: "Veja o resumo: ingredientes planejados, itens em falta e custo previsto.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 2000,
      },
      {
        selector: '[data-guide="btn-gerar-compra"]',
        instruction: "Clique em 'Gerar Pedido de Compra' para criar um pedido com os itens em falta.",
        position: "top",
        completionType: "submit_success",
        successEvent: "guided:purchase-from-forecast:success",
        optional: true,
      },
    ],
  },
  {
    id: "exportar-cardapio-tecnico",
    label: "Exportar cardapio tecnico",
    emoji: "",
    route: "/cardapio-semanal",
    blockedRoles: ["comprador", "estoquista", "funcionario"],
    steps: [
      {
        selector: '[data-guide="week-nav"]',
        instruction: "Navegue até a semana que deseja exportar.",
        position: "bottom",
        completionType: "viewed",
        advanceDelay: 1500,
      },
      {
        selector: '[data-guide="btn-pdf-tecnico"]',
        instruction: "Clique em 'PDF Técnico' para gerar o documento com preparações e nº de refeições.",
        position: "bottom",
        completionType: "button_clicked",
      },
    ],
  },
  // ──── Painel CEO ────
  {
    id: "explorar-painel-ceo",
    label: "Explorar Painel CEO",
    emoji: "",
    route: "/painel-ceo",
    allowedRoles: ["ceo"],
    steps: [
      { selector: '[data-guide="hero-kpi-grid"]', instruction: "Aqui estão os 4 KPIs principais: custo médio por refeição, refeições do dia, estoque crítico e alertas ativos.", position: "bottom", completionType: "viewed", advanceDelay: 2000 },
      { selector: '[data-guide="chart-consumo"]', instruction: "Este gráfico mostra o consumo dos últimos 14 dias. Use para identificar tendências.", position: "top", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="performance-unidades"]', instruction: "Veja o status de cada unidade: Saudável, Atenção ou Risco.", position: "left", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="alertas-criticos"]', instruction: "Ação imediata: aqui aparecem os alertas que precisam de resposta hoje.", position: "left", completionType: "viewed", advanceDelay: 1500 },
    ],
  },
  // ──── Radar de Operação ────
  {
    id: "radar-operacao",
    label: "Usar Radar de Operacao",
    emoji: "",
    route: "/radar-operacao",
    allowedRoles: ["ceo", "gerente_operacional"],
    steps: [
      { selector: '[data-guide="radar-chart"]', instruction: "O radar mostra 5 dimensões de cada unidade: estoque, desperdício, cardápio, pedidos e financeiro.", position: "bottom", completionType: "viewed", advanceDelay: 2000 },
      { selector: '[data-guide="radar-tabela"]', instruction: "A tabela detalha o status de cada unidade com pontuação e tendência.", position: "top", completionType: "viewed", advanceDelay: 1500 },
    ],
  },
  // ──── Alertas ────
  {
    id: "gerenciar-alertas",
    label: "Gerenciar Alertas",
    emoji: "",
    route: "/alertas",
    steps: [
      { selector: '[data-guide="alert-list"]', instruction: "Aqui ficam todos os alertas do sistema: validade crítica, estoque baixo e divergências.", position: "bottom", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="filter-alert-type"]', instruction: "Filtre por tipo de alerta para focar no que é prioritário.", position: "bottom", completionType: "button_clicked" },
      { selector: '[data-guide="alert-item"]', instruction: "Clique em um alerta para ver os detalhes e tomar ação.", position: "right", completionType: "button_clicked" },
    ],
  },
  // ──── Aprovações CD ────
  {
    id: "aprovar-transferencia",
    label: "Aprovar transferencia CD",
    emoji: "",
    route: "/aprovacoes-cd",
    allowedRoles: ["ceo", "gerente_operacional"],
    steps: [
      { selector: '[data-guide="pending-transfers"]', instruction: "Aqui ficam as transferências aguardando sua aprovação.", position: "bottom", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="transfer-item"]', instruction: "Clique em uma transferência para ver os itens solicitados.", position: "bottom", completionType: "button_clicked" },
      { selector: '[data-guide="btn-approve"]', instruction: "Clique em 'Aprovar' para liberar a transferência para o CD.", position: "top", completionType: "button_clicked" },
    ],
  },
  // ──── Cotações ────
  {
    id: "gerenciar-cotacoes",
    label: "Gerenciar Cotacoes",
    emoji: "",
    route: "/cotacoes",
    blockedRoles: ["estoquista", "funcionario", "nutricionista"],
    steps: [
      { selector: '[data-guide="cotacoes-list"]', instruction: "Aqui ficam todas as cotações criadas, com status e fornecedores.", position: "bottom", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="btn-nova-cotacao"]', instruction: "Clique em 'Nova Cotação' para solicitar preços a fornecedores.", position: "bottom", completionType: "button_clicked" },
      { selector: '[data-guide="link-cotacao-publica"]', instruction: "Este é o link público para o fornecedor preencher os preços sem precisar de login.", position: "top", completionType: "viewed", advanceDelay: 2000 },
    ],
  },
  // ──── Fornecedores ────
  {
    id: "gerenciar-fornecedores",
    label: "Gerenciar Fornecedores",
    emoji: "",
    route: "/fornecedores",
    blockedRoles: ["estoquista", "funcionario", "nutricionista"],
    steps: [
      { selector: '[data-guide="fornecedores-list"]', instruction: "Lista de todos os fornecedores cadastrados com categoria e status.", position: "bottom", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="btn-novo-fornecedor"]', instruction: "Clique aqui para cadastrar um novo fornecedor.", position: "bottom", completionType: "button_clicked" },
      { selector: '[data-guide="input-nome-fornecedor"]', instruction: "Preencha o nome, CNPJ e categoria do fornecedor.", position: "bottom", completionType: "field_filled" },
    ],
  },
  // ──── Desperdício por Contrato ────
  {
    id: "desperdicio-contrato",
    label: "Analisar desperdicio por contrato",
    emoji: "",
    route: "/desperdicio-contrato",
    allowedRoles: ["ceo", "gerente_operacional", "gerente_financeiro", "nutricionista"],
    steps: [
      { selector: '[data-guide="ranking-contratos"]', instruction: "Ranking de unidades por % de desperdício. Vermelho = acima da meta.", position: "bottom", completionType: "viewed", advanceDelay: 2000 },
      { selector: '[data-guide="chart-desperdicio"]', instruction: "Evolução mensal do desperdício por contrato.", position: "top", completionType: "viewed", advanceDelay: 1500 },
    ],
  },
  // ──── Painel Nutri ────
  {
    id: "explorar-painel-nutri",
    label: "Explorar Painel da Nutri",
    emoji: "",
    route: "/painel-nutri",
    blockedRoles: ["comprador", "gerente_financeiro"],
    steps: [
      { selector: '[data-guide="nutri-kpis"]', instruction: "Veja o status da semana: dias planejados, pedidos pendentes, estoque baixo e desperdício.", position: "bottom", completionType: "viewed", advanceDelay: 2000 },
      { selector: '[data-guide="week-menu-card"]', instruction: "Resumo do cardápio da semana com status de cada dia.", position: "top", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="low-stock-card"]', instruction: "Produtos com estoque baixo que podem impactar o cardápio.", position: "top", completionType: "viewed", advanceDelay: 1500 },
    ],
  },
  // ──── Biblioteca de Pratos ────
  {
    id: "gerenciar-pratos",
    label: "Gerenciar Biblioteca de Pratos",
    emoji: "",
    route: "/pratos",
    blockedRoles: ["comprador", "gerente_financeiro", "estoquista"],
    steps: [
      { selector: '[data-guide="pratos-grid"]', instruction: "Todos os pratos cadastrados com foto, categoria e custo estimado.", position: "bottom", completionType: "viewed", advanceDelay: 1500 },
      { selector: '[data-guide="btn-novo-prato"]', instruction: "Clique aqui para cadastrar um novo prato na biblioteca.", position: "bottom", completionType: "button_clicked" },
      { selector: '[data-guide="input-nome-prato"]', instruction: "Informe o nome do prato — ele será usado no cardápio e na ficha técnica.", position: "bottom", completionType: "field_filled" },
    ],
  },
];
