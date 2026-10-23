# MunilaLog — Redesign e refatoração (out/2026)

Todas as funcionalidades anteriores foram mantidas: mesmas tabelas e colunas do Supabase, mesmas regras de negócio (anti-duplicidade de NF e de chave de CTE, rateio do CTE nas entregas, sincronização retroativa, agendamento automático pelo cliente, status "Entregue" ao informar a data de entrega, logs de auditoria, permissões Operador/Administrador).

Para comparar com a versão anterior: `git diff` (nada foi commitado).

---

## 1. Redesign responsivo

| Tela | Computador (≥ 1024 px) | Tablet (768–1023 px) | Celular (< 768 px) |
|---|---|---|---|
| Menu | Lateral completo, recolhível | Barra de ícones | Barra superior + menu deslizante |
| Tabelas | Cabeçalho fixo, ordenação por coluna, ações fixas à direita | Igual, com rolagem horizontal | Viram **cartões** legíveis |
| Formulários | Modais em grade de 2–4 colunas | Grade adaptável | Folha de baixo para cima, 1 coluna |
| Filtros | Sempre visíveis | Sempre visíveis | Recolhidos atrás do botão "Filtros" |

- **Tema claro e escuro** (botão no rodapé do menu; segue o sistema por padrão).
- **Logo da Munila** no menu e no login; menu agrupado por rotina: Operação, Análise, Cadastros, Administração.
- Visual unificado: um único design system em `src/index.css` (cores, botões, cards, badges, tabelas, modais), sem os ~600 estilos inline espalhados nas telas.
- Suporte a área segura (notch) para o app Android/Capacitor e CSS de impressão (o botão "PDF" agora imprime só a tabela, sem menu).

## 2. Melhorias para o dia a dia

**Painel de Entregas**
- **Troca de status direto na tabela** (sem abrir o formulário) — com log de auditoria.
- **Duplicar entrega**: cria uma nova entrega com os dados de outra (mesmo cliente/destino/transportadora), só trocar a NF.
- **Duplo clique na linha** abre a edição (no celular, toque no cartão).
- **Filtros salvos** neste dispositivo e exibidos como "chips" removíveis um a um, com contador no botão.
- **Escolher colunas visíveis** e alternar tabela **compacta/confortável** (preferência salva).
- Botão **Atualizar** com horário da última atualização.
- Ao escolher o cliente, **cidade e UF são sugeridas** a partir do cadastro (se ainda vazias).
- Campos de valor aceitam vírgula e ponto (`1.234,56`).

**Atalhos de teclado**
- `/` foca a busca · `N` nova entrega · `Ctrl + Enter` salva qualquer formulário · `Esc` fecha · `↑ ↓ Enter` na busca de cliente.

**Outras telas**
- **Logística & SLA**: cartões Críticas / Em alerta / No prazo / Concluídas que filtram a lista com um clique; exportação CSV.
- **Financeiro**: filtro "Só aguardando frete real" e exportação CSV.
- **CTE**: formulário recolhível, barra de progresso na sincronização ("Sincronizando 12/80"), resultado da integração em aviso na tela.
- **Clientes**: importação de CSV agora aceita `;` (padrão do Excel em português) além de `,`, e pede confirmação mostrando quantos clientes serão importados; telefone e e-mail clicáveis.
- **Calculadora**: busca no catálogo e botão **Copiar** o texto `xCX yKG` para colar na NF.
- **Transportadoras / Equipe**: busca.
- Buscas **ignoram acentos** ("sao joao" encontra "SÃO JOÃO").
- `alert()` e `confirm()` do navegador substituídos por **avisos (toasts)** e **diálogos de confirmação** do próprio sistema.

## 3. Correções de bugs encontrados

1. **Limite de 1.000 registros** — o Supabase devolve no máximo 1.000 linhas por consulta. A partir da 1.001ª entrega (ou CTE/devolução/cliente), os registros mais antigos **sumiam silenciosamente** das telas, dos totais e do BI. Agora tudo é carregado em blocos (`fetchAll` em `src/lib/db.ts`).
2. **Exportação CSV cortada** — o método antigo (`data:` + `encodeURI`) truncava o arquivo quando alguma observação tinha `#`. Agora usa Blob, com aspas/`;` tratados corretamente.
3. **Hora da auditoria** — a correção de "-3 horas" fixa estava errada em qualquer computador fora do fuso de Brasília. Agora a hora é convertida corretamente para `America/Sao_Paulo`.
4. **Permissão de administrador** — se a consulta de perfis falhasse (rede/RLS), **todos viravam administrador** (`perfis.length === 0`). Agora isso só vale quando a lista realmente carregou vazia (primeiro acesso). As rotas de admin aguardam os perfis antes de redirecionar.
5. **Dados carregados em dobro** ao abrir o sistema (`getSession` + `onAuthStateChange`).
6. Tabela de **Transportadoras** com coluna de ações quebrada (`display:flex` em `<td>`).
7. Título da aba "munila-logistica", idioma `en` e favicon declarado como SVG sendo PNG.

## 4. Performance

- Carregamento inicial **1,6 MB → 453 KB** (≈ 454 KB → 132 KB gzip): cada tela é carregada sob demanda; gráficos (Recharts) e geração de PDF (html2canvas + jsPDF, ~600 KB) só baixam ao abrir o BI / exportar.
- Tabelas renderizam 100 linhas por vez ("Mostrar mais" / "Mostrar todos"), mantendo a rolagem leve com milhares de NFs.
- `favicon.png`: 1,38 MB → 66 KB (mesmo logo, 256 px).

## 5. Estrutura do código

```
src/
  App.tsx                 rotas + sessão (antes: 571 linhas com toda a lógica)
  types.ts                tipos das tabelas (Entrega, Cliente, Cte…)
  state/                  AppDataProvider: sessão, perfil, dados e filtros compartilhados
  feedback/               avisos (toasts) e confirmações
  lib/
    constants.ts          status, cores, UFs, regiões, modais — em um só lugar
    format.ts             datas, moeda, %, dias, busca sem acento
    filtrosEntrega.ts     regras de filtro do Painel
    db.ts                 fetchAll, selects, registrarLog, mensagens de erro
    xml.ts                leitura de XML de CTE e NF-e
    csv.ts                exportação/importação CSV
  components/
    layout/               menu, topo mobile, carregamento
    ui/                   DataTable, Modal, KpiCard, Badge, Combobox, Dropdown…
  modals/                 ModalEntrega, ModalCliente
  pages/                  uma tela por arquivo
```

- **0 erros de lint** (antes: 66) e TypeScript sem `any` nas telas.
- Removidos: `App.css` (resto do template Vite, não era usado) e `components/Header.tsx`, `Layout.tsx`, `Sidebar.tsx` (substituídos).
- **Nenhuma dependência nova.** Basta `npm run dev` / `npm run build` como antes.

## 6. Próximos passos sugeridos (não implementados)

1. **Segurança no Supabase (prioridade):** hoje as regras de Operador/Administrador são aplicadas na tela. Quem tiver a chave anônima pode gravar direto na API. Criar políticas **RLS** em `entregas`, `ctes`, `devolucoes`, `clientes`, `transportadoras`, `metas_frete`, `perfis` usando a tabela `perfis` (ex.: só `Administrador` pode `insert/update/delete`).
2. **Alerta de meta de frete:** as metas por cliente × transportadora já existem, mas nenhuma tela as usa. Sugestão: destacar no Painel as NFs com % de frete acima da meta.
3. **Integração CTE no banco:** mover o rateio para uma função/trigger no Supabase, garantindo atomicidade e evitando o loop de requisições na sincronização.
4. **Tempo real:** usar `supabase.channel()` para o Painel atualizar sozinho quando outra pessoa alterar uma entrega.
5. **Editar/excluir metas** e **ver quem alterou cada entrega** (histórico por NF a partir da auditoria).
6. Gerar os tipos automaticamente com `supabase gen types typescript` e adicionar testes (Vitest) para `filtrosEntrega`, `xml` e `format`.

## 7. Como testar

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint       # 0 problemas
npm run build
npx cap sync android   # para atualizar o app Android
```

Roteiro rápido: login → Painel (filtros, colunas, status inline, duplicar) → Nova entrega (`N`) → CTE (importar XML) → Devoluções (ler XML) → BI (exportar PDF) → alternar tema → testar no celular (F12 › modo dispositivo).

---

## 8. Indicadores Diários do Armazém (out/2026)

Novo item no menu: **Armazém › Indicadores Diários** (`/indicadores`). É o "Painel Logístico Munila" (HTML) incorporado ao sistema, com a mesma estrutura visual e as mesmas fórmulas:

| Sigla | Área | O que se lança por dia | Indicadores |
|---|---|---|---|
| PNL | Visão geral | — | 1 indicador por área + "Lançamentos de hoje" |
| REC | Recebimento | Fornecedores, NFs, volumes, divergências (ou lista de NFs) | Índice de divergências |
| ARM | Armazenagem | Posições, endereços auditados/corretos | Ocupação, acuracidade |
| EXP | Expedição/Separação | Lista de NFs do pedido (cliente, NF, volumes, transportadora, destino, status) | Notas, volumes, no prazo, tempo até a coleta |
| COL | Coleta | Coletas agendadas/no prazo, aguardando | Coletas no prazo |
| DEV | Devoluções | Entregues, devolvidos, avarias, faltas, custo | Índices de devolução e avarias |
| TRP / CLI | Acompanhamento | — | NFs por transportadora / cliente, pendentes e atrasadas |

Mantido do original: filtros de período (com dias da semana, agrupamento e comparação com o período anterior), gráficos, lista de NFs com totais automáticos, prévia dos índices, rascunho automático, aviso de data diferente de hoje, troca de status direto na lista, prazo de coleta (D+0…D+5), exportação CSV, tema escuro e celular.

**Novo:** botão **"Importar do Painel de Entregas"** na Expedição — traz as NFs cuja *data de entrada do pedido* é a data do lançamento (cliente, NF, volumes, transportadora, destino, coleta), evitando digitar duas vezes.

### Supabase — passo obrigatório (uma vez)

Abra **Supabase › SQL Editor › New query**, cole o conteúdo de **`supabase/indicadores_diarios.sql`** e clique **Run**. Ele cria:

- `indicadores_diarios` — um registro por área e por dia (`valores` e `notas` em JSON; único por `area + data`).
- `configuracoes` — guarda o prazo de coleta (`prazo_coleta_dias`).
- Segurança (RLS): qualquer usuário logado consulta e lança; **excluir um dia** e **alterar o prazo de coleta** só Administrador (função `is_admin()` baseada na tabela `perfis`).

Enquanto o SQL não for executado, a tela mostra um aviso explicando o que fazer.

Os dados que estavam no painel HTML antigo (base do Claude) **não** são migrados automaticamente; se precisar, exporte o CSV de cada área no painel antigo e peça a importação.

---

## 9. Painel de BI para reuniões — etapa 1 (out/2026)

**Números corrigidos**
- **% de frete** agora é calculado só com as NFs que já têm frete real (CTE), dividindo pelo valor *dessas mesmas* NFs. Antes o frete real era dividido pelo faturamento de todas as NFs (inclusive as ~40% sem CTE), o que deixava o % artificialmente baixo.
- **Frete real × cotado** compara apenas NFs que têm os dois valores.
- **Pesos fora do padrão** (peso igual ao nº da NF ou kg/volume 20× acima do normal) ficam fora do total — no BI e no Painel de Entregas — e são listados para correção.

**Novo layout** em 5 blocos numerados: Resumo do período · Prazo e nível de serviço · Evolução · Clientes e transportadoras · Destinos.
- **Resumo:** 4 números grandes (faturamento, % de frete, entregas no prazo, lead time) com **seta ↑ ↓ comparando com o período anterior** (verde = melhorou), faixa com NFs, volumes, peso, real × cotado e cobertura de CTE, e **Destaques escritos automaticamente** (frases prontas para falar na reunião).
- **Prazo:** % de entregas até a *Data de previsão*, atraso médio, **jornada do pedido** (pedido → faturamento → coleta → entrega, em dias), NFs em aberto com previsão vencida, % no prazo por mês e por transportadora.
- Comparação: mês escolhido × mês anterior (se for o mês atual, compara os mesmos dias); 30/90 dias × período anterior; "Este ano" × mesmo período do ano passado.

**Modo apresentação** (botão *Apresentar* ou *Apresentar daqui* em cada bloco): tela cheia, um bloco por slide, letras maiores, `← →` / espaço / PageDown para avançar, `Esc` para sair, botão de tema claro/escuro.

**PDF:** A4 deitado, uma página por bloco, com cabeçalho do período.

Arquivos: `src/lib/bi.ts` (cálculos), `src/pages/Analise.tsx`, `src/pages/bi/*`.

## 10. Painel de BI — etapa 2 (out/2026)

Três blocos novos (o BI agora tem 6 blocos / 6 slides / 6 páginas no PDF):

- **4 · Ranking de transportadoras** — NFs, faturamento, custo de frete, % de frete (CTE), entregas no prazo, atraso médio, real × cotado e ocorrências críticas em aberto. Cada transportadora recebe uma **nota de 0 a 100** e um **semáforo** (verde/amarelo/vermelho):
  - prazo (peso 50%): ≥ 90% verde · ≥ 75% amarelo · abaixo vermelho;
  - % de frete (30%): até a média geral da empresa verde · até 20% acima amarelo · acima vermelho;
  - real × cotado (20%): igual/abaixo do cotado verde · até 5% acima amarelo · acima vermelho;
  - com menos de 3 NFs a métrica fica cinza e não entra na nota.
- **5 · Clientes e metas de frete** — Top 10 clientes com participação no faturamento e a **comparação das metas cadastradas (cliente × transportadora) com o % de frete realizado** pelo CTE: barra com a bandeira da meta, quantas NFs passaram da meta e um resumo "dentro / acima / sem CTE".
- **6 · Destinos** — **mapa do Brasil por estado** (um quadrado por UF), colorido por faturamento, % de frete ou entregas no prazo, com a tabela dos estados ao lado.

Os "Destaques do período" passam a citar a melhor (e a pior) transportadora e o resultado das metas de frete.

Arquivos novos: `src/pages/bi/SecoesEtapa2.tsx`, `src/pages/bi/mapaBrasil.ts`; cálculos em `src/lib/bi.ts` (`rankingTransportadoras`, `avaliarMetas`).

## 11. Painel de BI — etapa 3 (out/2026)

- **7 · Armazém** — os Indicadores Diários no BI, com as mesmas fórmulas da tela do armazém e seta de comparação com o período anterior: NFs e volumes recebidos, índice de divergências (e divergências por tipo), ocupação, acuracidade, notas faturadas, pedidos expedidos no prazo, tempo até a coleta, coletas no prazo, pedidos aguardando coleta, índices de devolução e de avarias/faltas e custo das devoluções. Não é filtrado por região.
- **8 · Devoluções** — a partir da tela Devoluções (data de emissão da NFD): quantidade, valor devolvido (% do faturamento), frete de retorno, devoluções em aberto, tempo médio de retorno, motivos e clientes que mais devolveram.
- **9 · Qualidade dos dados** (só para a equipe — **não entra no modo apresentação nem no PDF**): % das NFs sem erro de cadastro e a lista de pendências com as NFs afetadas e botão "Copiar NFs": sem CTE, peso fora do padrão, entregue sem data de entrega, sem data de previsão, datas fora de ordem, sem transportadora, sem UF, valor da NF zerado, sem frete cotado.
- Blocos sem dados no período (ex.: nenhum lançamento do armazém) são pulados automaticamente na apresentação e no PDF.
- Os "Destaques do período" passam a citar o armazém (pedidos coletados no prazo, divergência no recebimento) e as devoluções (quantidade, % do faturamento e principal motivo).

Arquivos novos: `src/pages/bi/SecoesEtapa3.tsx`, `src/pages/bi/armazem.ts`; cálculos em `src/lib/bi.ts` (`calcularDevolucoes`, `checarQualidade`).
