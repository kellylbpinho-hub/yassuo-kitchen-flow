# Diagnóstico Completo da Arquitetura — Yassuo Control
**Data do congelamento:** 2026-03-15  
**Versão:** v1.0 — Snapshot Arquitetural

---

## 1. Estrutura do Banco de Dados

### 1.1 Tabelas Principais

| Tabela | Finalidade | Campos-chave |
|--------|-----------|-------------|
| `companies` | Multi-tenant (empresa) | id, nome, cnpj, ativo |
| `units` | Unidades (CD/Kitchen) | id, name, type, company_id, numero_colaboradores, target_meal_cost |
| `profiles` | Perfil do usuário | id, user_id, full_name, email, cargo, company_id, unidade_id, guided_mode/step/task_id |
| `user_roles` | Cargo (enum `app_role`) | user_id, role, company_id |
| `user_unidades` | Vínculo usuário↔unidade | user_id, unidade_id, company_id |
| `products` | Cadastro de produtos | id, nome, unidade_medida, codigo_barras, marca, categoria, category_id, estoque_atual, estoque_minimo, custo_unitario, validade_minima_dias, proteina_por_100g, unidade_id, company_id |
| `product_categories` | Categorias de produto | id, name, company_id |
| `product_purchase_units` | Unidade de compra (cx, fardo…) | id, product_id, nome, fator_conversao, company_id |
| `product_fornecedores` | Vínculo produto↔fornecedor | product_id, fornecedor_id, preco_referencia |
| `fornecedores` | Fornecedores | id, nome, cnpj, contato, telefone, email |
| `lotes` | Lotes de estoque (FEFO) | id, product_id, unidade_id, quantidade, validade, codigo, status(ativo/consumido) |
| `movements` | Movimentações de estoque | id, product_id, unidade_id, tipo(entrada/saida/consumo/perda), quantidade, motivo, user_id |
| `purchase_orders` | Pedidos de compra (cabeçalho) | id, numero, status(rascunho/enviado/aprovado/recebido), unidade_id, created_by, approved_by |
| `purchase_items` | Itens do pedido de compra | id, purchase_order_id, product_id, quantidade, custo_unitario, purchase_unit_id, fator_conversao, quantidade_estoque |
| `internal_orders` | Pedidos internos (cabeçalho) | id, numero, unidade_origem_id, unidade_destino_id, solicitado_por, status(pendente/parcial/aprovado) |
| `internal_order_items` | Itens do pedido interno | id, order_id, product_id, quantidade, quantidade_aprovada, status, observacao |
| `transferencias` | Transferências entre unidades | id, product_id, unidade_origem/destino_id, quantidade, status(pendente/aprovada/rejeitada), solicitado_por, aprovado_por |
| `dishes` | Preparações/Pratos | id, nome, descricao, category_id, modo_preparo, tempo_preparo, equipamento, peso_porcao |
| `dish_categories` | Categorias de prato | id, nome, ordem |
| `menus` | Cardápios (por dia/unidade) | id, data, nome, unidade_id, created_by |
| `menu_dishes` | Vínculo cardápio↔prato | menu_id, dish_id, ordem |
| `recipe_ingredients` | Ficha técnica (ingredientes) | id, menu_id, dish_id, product_id, peso_limpo_per_capita, fator_correcao |
| `waste_logs` | Registros de desperdício | id, product_id, dish_id, menu_id, quantidade, sobra_prato, sobra_limpa_rampa, desperdicio_total_organico, unidade_id |
| `unit_product_rules` | Contrato/bloqueio produto↔unidade | unit_id, product_id, status(bloqueado) |
| `audit_log` | Log de auditoria | user_id, tabela, acao, registro_id, dados(jsonb) |

### 1.2 Views

| View | Finalidade |
|------|-----------|
| `v_estoque_por_unidade` | Saldo de lotes ativos por produto/unidade (security_invoker) |
| `meal_cost_daily` | Custo diário de refeição por unidade |

### 1.3 RPCs (Server-side)

| RPC | Finalidade |
|-----|-----------|
| `rpc_receive_digital` | Entrada de estoque via recebimento (cria lote + movement + atualiza estoque) |
| `rpc_consume_fefo` | Consumo/desperdício/perda seguindo FEFO |
| `rpc_create_product` | Criação de produto com normalização de barcode |
| `rpc_request_transfer` | Solicitar transferência CD→Kitchen |
| `rpc_approve_transfer` | Aprovar/rejeitar transferência (atômico: consome lotes origem, cria na destino) |
| `rpc_get_cd_balance` | Saldo de um produto em um CD específico |
| `rpc_ensure_profile` | Garante existência de profile ao login |
| `current_company_id` | Retorna company_id do usuário logado |
| `has_role`, `is_ceo`, `is_financeiro`, `is_estoquista`, `is_comprador` | Verificações de cargo (SECURITY DEFINER) |
| `user_can_manage`, `user_can_approve`, `user_can_see_costs`, `user_can_see_unit` | Permissões compostas |

### 1.4 Relacionamentos Principais

```
companies ──┬── units ──┬── products (unidade_id)
             │           ├── lotes (unidade_id)
             │           ├── menus (unidade_id)
             │           └── purchase_orders (unidade_id)
             ├── profiles (company_id)
             ├── user_roles (company_id)
             └── fornecedores (company_id)

products ──┬── lotes (product_id)
            ├── movements (product_id)
            ├── purchase_items (product_id)
            ├── recipe_ingredients (product_id)
            ├── product_purchase_units (product_id)
            ├── product_fornecedores (product_id)
            └── unit_product_rules (product_id)

menus ──┬── menu_dishes → dishes → dish_categories
         └── recipe_ingredients → products

purchase_orders ── purchase_items → products
internal_orders ── internal_order_items → products
```

---

## 2. Fluxos Operacionais

### 2.1 Recebimento Digital
1. Escanear barcode (GS1-128 com parsing automático) ou buscar produto manual
2. Selecionar unidade tipo CD
3. Preencher: lote, validade, quantidade
4. Verificação de desvio de peso (compara últimas 5 entradas)
5. `rpc_receive_digital` → cria lote + movement(entrada) + atualiza estoque_atual
6. Se produto não existe → cadastro inline via `rpc_create_product`

### 2.2 Pedido Interno (Transferência Multi-item)
1. Selecionar CD (origem) e Cozinha (destino)
2. Adicionar múltiplos produtos com quantidade
3. Validação de contrato (unit_product_rules)
4. Submeter → cria `internal_orders` + `internal_order_items`
5. Aprovação granular no CD (Aprovações CD): aprovar total, parcial ou rejeitar por item
6. Aprovação dispara `rpc_approve_transfer` por item (consumo FEFO no CD, criação de lotes na cozinha)

### 2.3 Compras Externas
1. Criar pedido → `purchase_orders` (rascunho)
2. Adicionar itens com unidade de compra (fator de conversão)
3. Fluxo: Rascunho → Enviado → Aprovado → Recebido
4. "Receber" executa `rpc_receive_digital` para cada item
5. PDF de pedido de compra disponível

### 2.4 Planejamento de Insumos
1. Selecionar unidade e semana
2. Cruza: cardápio semanal × ficha técnica × numero_colaboradores
3. Fórmula: `peso_limpo_per_capita × fator_correcao × numero_colaboradores`
4. Compara necessidade vs estoque real (v_estoque_por_unidade)
5. Agrupamento por categoria (Proteínas, Hortifruti, Grãos, etc.)
6. Status visual: Verde (suficiente) / Amarelo (atenção ≤120%) / Vermelho (falta)
7. KPIs executivos: dias, ingredientes, em falta, custo total
8. "Gerar Pedido de Compra" → cria purchase_order rascunho com itens em déficit
9. Exportação PDF e Excel

### 2.5 Cardápio Semanal
1. Visualização semanal por unidade
2. Criar/editar cardápio diário (menus → menu_dishes)
3. Adicionar pratos ao dia
4. Status por dia (planejado, confirmado, etc.)
5. Aba "Ficha Técnica" no sheet de cada dia
6. Exportação: PDF Cardápio Simples e PDF Cardápio Técnico

### 2.6 Ficha Técnica
1. Acessível via cardápio diário (aba no CardapioDiaSheet)
2. Ingredientes: produto + peso_limpo_per_capita + fator_correcao
3. Cálculo de demanda: per_capita × fator × colaboradores
4. Custo por porção e custo total
5. Informações de preparo (modo_preparo, tempo_preparo, equipamento)
6. Exportação PDF
7. "Gerar Requisição Interna" (PDF)
8. "Gerar Pedido de Compra" (cria purchase_order com itens em déficit)

### 2.7 Estoque
1. Listagem de produtos com filtros (busca, unidade, categoria)
2. Saldo por unidade (via v_estoque_por_unidade)
3. Movimentações de saída via `rpc_consume_fefo`
4. Alerta de estoque mínimo
5. Exportação Excel (financeiro/nutri)
6. Importação via planilha
7. Detalhes do produto (drawer) e edição

### 2.8 Desperdício
1. Registro por cardápio/prato: sobra_prato, sobra_limpa_rampa, desperdicio_total_organico
2. Consumo de estoque via `rpc_consume_fefo(tipo='desperdicio')`
3. Histórico por unidade
4. Dashboard de desperdício contratual (DesperdicioContrato): análise por período, gráficos

### 2.9 Dashboard Financeiro
1. KPIs: custo médio refeição, variação, desperdício financeiro
2. Gráficos de custo por unidade e tendência
3. Dados da view `meal_cost_daily`
4. Exportação PDF

### 2.10 Dashboard Operacional
1. KPIs: estoque total, itens abaixo mínimo, perdas, lotes vencendo
2. Ranking de desperdício por unidade
3. Giro de estoque (slow turnover)
4. Status de pedidos
5. Exportação PDF

---

## 3. Mapa de Telas

| Rota | Página | Perfis com Acesso | Ações Principais |
|------|--------|-------------------|------------------|
| `/` | Index (redirect) | Todos | Redireciona para dashboard ou cardápio |
| `/login` | Login | Público | Autenticação |
| `/esqueci-senha` | ForgotPassword | Público | Reset de senha |
| `/redefinir-senha` | ResetPassword | Público | Nova senha |
| `/dashboard` | Dashboard | CEO, G.Op, G.Fin(RO), Est, Comp, Func | KPIs, gráficos, alertas |
| `/estoque` | Estoque | CEO, G.Op, G.Fin(RO), Nutri(RO), Est, Comp, Func(RO) | CRUD produtos, movimentações |
| `/recebimento-digital` | Recebimento | CEO, G.Op, Est | Entrada de mercadoria com lote |
| `/pedido-interno` | Pedido Interno | CEO, G.Op, (Nutri via sidebar) | Criar pedido multi-item |
| `/aprovacoes-cd` | Aprovações CD | CEO, G.Op | Aprovar/rejeitar itens de pedido |
| `/meus-pedidos` | Meus Pedidos | CEO, G.Op, Nutri | Histórico de pedidos |
| `/compras` | Compras | CEO, G.Op, G.Fin(RO), Comp | Listar/criar pedidos de compra |
| `/compras/:id` | Detalhe Compra | CEO, G.Op, G.Fin(RO), Comp | Itens, status, PDF, receber |
| `/desperdicio` | Desperdício | CEO, G.Op, G.Fin(RO), Nutri, Est, Func | Registrar desperdício |
| `/desperdicio-contrato` | Desp. Contrato | CEO, G.Op, G.Fin(RO), Est, Func | Análise contratual |
| `/dashboard-financeiro` | Dash Financeiro | CEO, G.Fin, G.Op | Custo refeição, tendências |
| `/alertas` | Alertas | CEO, G.Op, G.Fin(RO), Nutri, Est, Comp, Func | Validade, estoque mínimo |
| `/categorias` | Categorias/Contratos | CEO, G.Op, G.Fin(RO), Nutri | Gerenciar categorias e bloqueios |
| `/usuarios` | Usuários | CEO, G.Op | CRUD usuários, atribuir cargo |
| `/unidades` | Unidades | CEO, G.Op | CRUD unidades |
| `/configuracoes-acesso` | Config. Acesso | CEO | Matriz de permissões (read-only) |
| `/cardapio-semanal` | Cardápio Semanal | Nutri, CEO, G.Op | Montar cardápio, fichas técnicas |
| `/painel-nutri` | Painel Nutri | Nutri | Dashboard operacional da cozinha |
| `/pratos` | Pratos | Nutri, CEO, G.Op | CRUD preparações |
| `/planejamento-insumos` | Planej. Insumos | Nutri, CEO, G.Op | Previsão de compra semanal |
| `/relatorio-executivo` | Relatório Executivo | CEO, G.Op, G.Fin | Documentação do sistema |
| `/qa` | QA Checklist | CEO, G.Op | Testes manuais do sistema |

**Legenda:** RO = Somente Leitura | G.Op = Gerente Operacional | G.Fin = Gerente Financeiro | Est = Estoquista | Comp = Comprador | Func = Funcionário | Nutri = Nutricionista

---

## 4. Verificação de Inconsistências

### 4.1 ⚠️ Campos não expostos na interface

| Campo | Tabela | Status |
|-------|--------|--------|
| `marca` | products | **Não exposto** — existe no banco mas não há campo de entrada/exibição na UI |
| `proteina_por_100g` | products | **Parcialmente exposto** — pode aparecer em ficha técnica mas sem input de cadastro |
| `validade_minima_dias` | products | Usado internamente para alertas, sem edição direta |
| `target_meal_cost` | units | Usado no dashboard financeiro, editável na tela de Unidades |
| `descricao` | menus | Existe mas sem campo de input visível |
| `observacao` | purchase_orders | Existe mas sem campo de input na criação |

### 4.2 ⚠️ Rota duplicada no App.tsx

```tsx
// Linha 72 e 73 — rota /pratos duplicada
<Route path="/pratos" element={<Pratos />} />
<Route path="/pratos" element={<Pratos />} />
```

### 4.3 ⚠️ Inconsistência recipe_ingredients.menu_id

- `recipe_ingredients` usa `menu_id` como FK, mas conceitualmente a ficha técnica deveria ser vinculada ao **prato (dish)**, não ao cardápio. Isso significa que a mesma ficha técnica precisa ser recriada para cada cardápio diferente que use o mesmo prato. **Impacto**: retrabalho para a nutricionista.

### 4.4 ⚠️ Campo `categoria` (texto) vs `category_id` (FK)

- `products` tem dois campos de categoria: `categoria` (texto livre legado) e `category_id` (FK para product_categories). Ambos coexistem. A UI usa `category_id` preferencialmente, mas `categoria` pode conter dados legados não sincronizados.

### 4.5 ⚠️ `estoque_atual` desnormalizado

- `products.estoque_atual` é um saldo global atualizado a cada RPC. Não representa o saldo por unidade. O saldo por unidade é calculado via `v_estoque_por_unidade` (soma de lotes). Pode haver drift entre o valor global e a soma real dos lotes ao longo do tempo.

### 4.6 ✅ Fluxos alinhados

- Pedido Interno: estrutura cabeçalho+itens ✓
- Compras Externas: estrutura cabeçalho+itens ✓
- Recebimento integrado com Compras ✓
- Planejamento gera pedido de compra automaticamente ✓
- FEFO implementado em todas as saídas ✓
- RLS consistente com company_id em todas as tabelas ✓

---

## 5. Relacionamento entre Módulos

```
┌─────────────────┐     gera pedido      ┌──────────────────┐
│  PLANEJAMENTO   │ ──────────────────→  │  COMPRAS (OC)     │
│  DE INSUMOS     │                      │  purchase_orders   │
│                 │                      │  purchase_items    │
│  cardápio ×     │                      └────────┬──────────┘
│  ficha técnica  │                               │
│  × colaboradores│                          "Receber"
└───────┬─────────┘                               │
        │ lê                                      ▼
        │                               ┌──────────────────┐
┌───────▼─────────┐                     │  RECEBIMENTO     │
│  CARDÁPIO       │                     │  DIGITAL         │
│  SEMANAL        │                     │  rpc_receive_    │
│  menus +        │                     │  digital         │
│  menu_dishes    │                     └────────┬─────────┘
└───────┬─────────┘                              │
        │ vincula                           cria lote +
        │                                  movement(entrada)
┌───────▼─────────┐                              │
│  FICHA TÉCNICA  │                              ▼
│  recipe_        │                     ┌──────────────────┐
│  ingredients    │                     │  ESTOQUE         │
│  (per_capita    │ ◄───── consulta ──  │  lotes + products│
│   × fator)     │                     │  v_estoque_por_  │
└─────────────────┘                     │  unidade         │
                                        └───┬──────┬───────┘
                                            │      │
                              saída FEFO    │      │  transferência
                                            ▼      ▼
                                   ┌──────────┐ ┌──────────────┐
                                   │DESPERDÍCIO│ │PEDIDO INTERNO│
                                   │waste_logs │ │internal_     │
                                   │rpc_consume│ │orders/items  │
                                   │_fefo      │ │rpc_approve_  │
                                   └─────┬─────┘ │transfer      │
                                         │       └──────────────┘
                                         ▼
                                ┌──────────────────┐
                                │  DASHBOARD       │
                                │  FINANCEIRO      │
                                │  meal_cost_daily │
                                │  (custo refeição)│
                                └──────────────────┘
```

### Fluxo Completo (Ciclo):
```
Planejamento → Compra → Recebimento → Estoque → Consumo/Desperdício → Custo
     ↑                                    │
     └──────── feedback (déficit) ─────────┘
```

---

## 6. Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui (Radix) |
| Estado | TanStack Query (cache) + useState local |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Excel | XLSX (SheetJS) |
| Backend | Supabase (PostgreSQL + RLS + Auth + Edge Functions) |
| Autenticação | Supabase Auth (email/password) |
| Barcode | GS1-128 parser customizado |
| Busca | Fuzzy search customizado |

---

## 7. Recomendações para Próximas Evoluções

1. **Remover rota duplicada** `/pratos` no App.tsx (linha 73)
2. **Considerar migrar `recipe_ingredients`** de `menu_id` para `dish_id` para permitir reuso de fichas técnicas entre cardápios
3. **Depreciar `products.categoria`** (texto) em favor de `category_id` (FK)
4. **Expor campo `marca`** na UI de cadastro/edição de produtos
5. **Monitorar drift** entre `products.estoque_atual` e soma real de lotes
6. **Manter regra**: toda alteração de módulo deve atualizar guidedSteps correspondente

---

*Este documento serve como snapshot da arquitetura v1.0 do Yassuo Control. Qualquer evolução deve ser verificada contra este diagnóstico para garantir que nenhuma funcionalidade seja perdida.*
