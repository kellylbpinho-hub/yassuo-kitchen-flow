

# Plano: Painel Completo da Nutricionista

## Situacao Atual

### O que existe
- **Desperdicio**: Apenas 2 pesagens (Sobra Rampa + Organico). Falta a terceira: **Sobra de Prato (Resto-Ingesta)**.
- **Cardapio**: Cadastro avulso por data, sem estrutura semanal (seg-dom). Sem tabela nutricional nem tabela de custo.
- **Pedido Interno**: A nutri esta **bloqueada** em `/pedido-interno` (ProtectedRoute linha 19). Deveria ter acesso.
- **Sidebar**: Nutri ve Compras no menu (deveria estar oculto). Nao tem dashboard proprio.
- **Dashboard**: Nutri ve o mesmo painel do gestor. Deveria ver apenas desperdicios + cardapio da semana.
- **Alertas**: Nutri nao deveria ver.

### O que precisa mudar

1. **Desperdicio: 3 pesagens** (Prato / Rampa / Compostagem)
2. **Cardapio Semanal** (seg-dom editavel, com ficha tecnica item a item, tabela nutricional + custo, PDF)
3. **Desbloquear Pedido Interno** para Nutricionista
4. **Dashboard exclusivo da Nutri** (desperdicios + cardapio da semana)
5. **Bloquear**: Alertas, Compras, Estoque (ja parcial), Dashboard do gestor

---

## Implementacao em 5 blocos

### Bloco 1: Desperdicio com 3 pesagens

**Banco de dados:**
- Adicionar coluna `sobra_prato numeric NOT NULL DEFAULT 0` na tabela `waste_logs`
- Habilitar UPDATE na `waste_logs` para a empresa (RLS policy)

**Frontend (`Desperdicio.tsx`):**
- Formulario com 3 campos: Sobra de Prato (kg), Sobra da Rampa (kg), Sobra Producao/Compostagem (kg)
- Total = soma das 3
- Tabela de registros exibe as 3 colunas

**RPC (`rpc_consume_fefo`):**
- Motivo atualizado para incluir as 3 pesagens

---

### Bloco 2: Cardapio Semanal com Ficha Nutricional e Custos

**Banco de dados:**
- Nova tabela `cardapio_semanal`: `id, unidade_id, company_id, semana_inicio (date), created_by, created_at`
- Nova tabela `cardapio_semanal_itens`: `id, cardapio_semanal_id, dia_semana (integer 0-6), refeicao (text), product_id, peso_per_capita (numeric), fator_correcao (numeric), company_id`
- Cada dia pode ter N itens (incluindo temperos). Dias sem funcionamento ficam sem itens.

**Frontend: Nova pagina `/cardapio-semanal`**
- Interface por abas: Seg | Ter | Qua | Qui | Sex | Sab | Dom
- Cada aba: lista de itens com produto, peso per capita, fator correcao
- Botao "Adicionar Item" por dia (busca fuzzy de produtos incluindo temperos)
- Dias sem itens = "Sem funcionamento" (editavel, nao travado)
- Rodape: tabela resumo nutricional (proteina por 100g * quantidade) e tabela de custo (custo_unitario * demanda)
- Botao "Gerar PDF" com ficha nutricional completa + custos por dia + total semanal

**PDF (`pdfExport.ts`):**
- Nova funcao `generateCardapioSemanalPDF()` com:
  - Tabela por dia: produto, peso, fator, demanda, proteina, custo
  - Totais nutricionais e financeiros

---

### Bloco 3: Desbloquear Pedido Interno para Nutri

**`ProtectedRoute.tsx`:**
- Remover `/pedido-interno` de `NUTRICIONISTA_BLOCKED_ROUTES`

**`AppLayout.tsx`:**
- Ja condicional para `showPedidoInterno` mas exclui nutri. Ajustar para incluir nutricionista.
- Remover Compras e Estoque do sidebar da nutri (ja parcial, precisa completar)

**`AuthContext.tsx`:**
- Ajustar `isEstoquista` e `isComprador` para NAO incluir nutricionista (ja correto)

---

### Bloco 4: Dashboard exclusivo da Nutricionista

**`Dashboard.tsx`:**
- Se `isNutricionista`:
  - KPIs: Total desperdicios da semana (3 tipos), cardapios ativos
  - Grafico de desperdicios por dia (bar chart)
  - Lista de cardapios da semana atual
- Se NAO nutri: dashboard atual (sem mudanca)

---

### Bloco 5: Restricoes de acesso da Nutri

**`ProtectedRoute.tsx`:**
- Adicionar `/alertas` a `NUTRICIONISTA_BLOCKED_ROUTES`
- Manter `/compras` bloqueada
- Adicionar `/estoque` como bloqueada para nutri

**`AppLayout.tsx`:**
- Ocultar do sidebar da nutri: Compras, Estoque, Alertas, Recebimento, Aprovacoes CD, Usuarios, Unidades, Config Acesso
- Mostrar para nutri: Dashboard, Desperdicio, Cardapio Semanal, Pedido Interno, Meus Pedidos

**`MobileBottomNav.tsx`:**
- Versao condicional para nutri: Dashboard, Desperdicio, Pedido Interno, Meus Pedidos

---

## Arquivos modificados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Adicionar `sobra_prato`, criar `cardapio_semanal` + `cardapio_semanal_itens` |
| `src/pages/Desperdicio.tsx` | 3 campos de pesagem |
| `src/pages/CardapioSemanal.tsx` | **NOVO** - pagina completa |
| `src/pages/Dashboard.tsx` | Dashboard condicional para nutri |
| `src/components/ProtectedRoute.tsx` | Ajustar bloqueios |
| `src/components/AppLayout.tsx` | Sidebar condicional |
| `src/components/MobileBottomNav.tsx` | Nav condicional |
| `src/lib/pdfExport.ts` | Nova funcao PDF cardapio |
| `src/App.tsx` | Adicionar rota `/cardapio-semanal` |

## Ordem de execucao

Fase A (1 mensagem): Blocos 1 + 3 + 5 (banco + restricoes + desperdicio 3 pesagens)
Fase B (1 mensagem): Bloco 2 (cardapio semanal completo com PDF)
Fase C (1 mensagem): Bloco 4 (dashboard da nutri)

