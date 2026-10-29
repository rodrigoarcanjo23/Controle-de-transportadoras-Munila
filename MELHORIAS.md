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

---

## 12. Segurança, alertas, histórico, tempo real e fechamento mensal (out/2026)

### Passo obrigatório no Supabase (uma vez)
**SQL Editor › New query** → cole **`supabase/seguranca_e_novidades.sql`** → **Run**. Ele:
- liga a segurança (RLS) em todas as tabelas: **sem login ninguém lê nem grava**; Operador consulta e lança Indicadores Diários; criar/editar/excluir entregas, CTEs, devoluções, clientes, metas, transportadoras, produtos e equipe só Administrador (as mesmas regras das telas). Auditoria: cada um registra só no próprio nome; ninguém edita/apaga. As políticas antigas ficam guardadas em `_backup_policies`;
- cria a tabela `fechamentos_mensais` e a configuração dos alertas;
- liga o tempo real nas tabelas `entregas` e `devolucoes`.

Se algo parar de funcionar: rode `supabase/reverter_seguranca.sql` (volta ao acesso livre para usuários logados).

> Importante: o e-mail de login de cada pessoa precisa estar cadastrado em **Equipe** com o nível certo. Quem não estiver na Equipe só consegue consultar.

### Alertas (menu Operação › Alertas)
- Central com o que precisa de ação hoje: previsão vencida, status Atrasado/Problema, previsão para hoje, faturada sem coleta, frete acima da meta, real acima do cotado, devoluções paradas, NFs sem CTE e Indicadores Diários de ontem não lançados. Contador vermelho no menu.
- **Copiar resumo** e **Enviar no WhatsApp** (abre o WhatsApp com o texto pronto).
- **E-mail diário** (seg–sáb, 8h): função `api/alertas-diarios.ts` agendada em `vercel.json`. Para ligar: Alertas › Configurar (destinatários e prazos) e, na Vercel, as variáveis `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e (recomendado) `CRON_SECRET`. Para enviar a outros e-mails além do dono da conta Resend, verifique o domínio no Resend e crie `ALERTAS_REMETENTE`.

### Histórico por NF
Ícone de relógio em cada linha do Painel de Entregas (para todos os usuários): datas da operação (pedido → entrega) e a linha do tempo da auditoria — quem criou, mudou status, editou (agora com **o que mudou**: "status: Pendente → Entregue; frete real: … → …") e qual CTE aplicou o frete.

### Tempo real
O Painel de Entregas, o BI e os alertas se atualizam sozinhos quando outra pessoa altera uma entrega ou devolução (indicador "ao vivo" no topo do Painel).

### Fechamento mensal (Painel de BI › Período: Mês)
Administrador clica **Fechar o mês** depois da reunião: os números do BI ficam congelados. Ao abrir um mês fechado, o BI mostra a foto do fechamento e avisa o que mudou desde então ("+2 NFs · % de frete 5,82% → 5,90%"), com botão para ver os números atuais e opção de **Reabrir**.

## 13. Gestão Financeira renovada (out/2026)

- **Filtros**: período de faturamento (com comparação ↑ ↓ com o período anterior, como no BI) e transportadora.
- **Topo com os números certos**: % de frete só das NFs com CTE (o antigo "impacto 3,46%" dividia pelo faturamento de todas as NFs, inclusive as sem CTE), frete a conferir (cotado das NFs sem CTE e há quantos dias), economia/gasto real × cotado (só NFs com os dois valores), custo total previsto, % conferido e **CTEs a lançar no Infarma** (situação ABERTO).
- **Visão geral**: custo de frete por mês (real + a conferir) com a linha do **orçamento de frete**, barra de orçamento do mês e **projeção** do custo do período.
- **Conferência de frete**: abas Acima do cotado · Acima da meta · Fora do padrão · Sem cotação · Aguardando CTE · Conferido, selo de situação por NF, colunas de data/transportadora/modal, "igual ao cotado" para diferenças de centavos, totais no rodapé e clique na NF para o histórico.
- **Transportadoras**: frete real, % de frete, real × cotado, NFs aguardando CTE, CTEs do período e **CTEs a lançar no Infarma** (identificados pelo CNPJ do emitente).
- **Clientes**: custo para atender — ticket médio, custo de frete, % do custo total, frete por NF, % de frete e NFs acima da meta.
- **Parâmetros** (administrador): orçamento de frete (% da receita), limite de "fora do padrão" e margem real × cotado. Exportação CSV da aba aberta.

## 14. Logística & SLA mais precisa (out/2026)

- **Prazos em dias úteis** (sem fins de semana e feriados nacionais, incluindo Carnaval, Sexta-feira Santa e Corpus Christi), **aprendidos com o histórico**: para cada transportadora × UF, o sistema mede a coleta → entrega das NFs entregues no último ano e usa o prazo em que 80% chegaram. Sem histórico suficiente usa a UF, e depois o padrão. A Data de previsão preenchida na NF sempre vale.
- **Etapas e responsáveis**: Aguardando coleta (expedição/transportadora, D+N dos Indicadores Diários), Aguardando agendamento (cliente), Agendado (data marcada) e Em trânsito (transportadora). Cada NF fica No prazo, Vence hoje/amanhã ou **Atrasada X dias úteis**.
- **Devoluções e recusas saem da conta**.
- **Verificar status**: NFs com mais que o dobro do prazo e sem atualização (provavelmente já entregues). Administrador marca várias como **Entregue** de uma vez, com a data da previsão de cada NF ou uma data única. Fica registrado na auditoria e no histórico de cada NF.
- **Cobrar transportadoras**: lista de NFs atrasadas por transportadora com mensagem pronta (copiar, WhatsApp ou e-mail do cadastro) e atalho para ver no Painel.
- **Desempenho**: envelhecimento por etapa, entregas no prazo por mês e mapa de calor **transportadora × UF** com o tempo real de trânsito.
- **Prazos**: tabela por UF e por transportadora × UF com o sugerido pelo histórico; o administrador pode fixar um prazo manual (prazo combinado com a transportadora), além do prazo de agendamento e do trânsito padrão.
- Filtros por transportadora e UF; exportação CSV com etapa, responsável, previsão e origem do prazo.

## 15. Fase 1 — portal do transportador, tabela de frete e expedição (out/2026)

> Requer rodar `supabase/fase1_portal_frete_expedicao.sql` no Supabase (uma vez; pode rodar de novo sem problema) e `npm install` (leitor de código de barras).

- **Portal do transportador** (`/portal/<link>`): cada transportadora recebe um link próprio, sem login (Transportadoras › ícone de link: copiar, WhatsApp, e-mail, desativar ou gerar novo). No celular, ela vê só as NFs dela em aberto e informa coletado, agendado, entregue, cliente ausente, reentrega, endereço, avaria, recusa ou outra ocorrência, com data, nova previsão e **foto do canhoto**. O status da NF é atualizado na hora e fica registrado como "portal: NOME".
- **Ocorrências e canhoto no histórico da NF**: lista do que a transportadora (ou a equipe) informou, com botão para abrir o canhoto. Administrador também pode registrar ocorrências internas.
- **Tabela de frete por transportadora** (Transportadoras › ícone de recibo): faixas de peso, excedente por kg, ad valorem, GRIS, pedágio por 100 kg, frete mínimo, ICMS por dentro, taxas fixas (TDE, TAS…) e prazo contratado, geral ou por UF, com simulador.
- **Auditoria pela tabela** (Gestão Financeira): cada CTE recalculado pela tabela, com Acima/Conforme/Abaixo, detalhamento por componente, **NF cobrada em 2+ CTEs** e mensagem de contestação pronta por transportadora. Tolerância ajustável em Parâmetros.
- **Cotação** (Calculadora): compara o custo pela tabela de cada transportadora para UF, peso e valor, com o prazo contratado ou o do histórico.
- **Prazo contratado** da tabela entra automaticamente na Logística & SLA (prazo manual continua valendo primeiro).
- **Expedição**: monta o **romaneio de coleta** por transportadora (motorista, placa) e imprime com campos de assinatura; **confere o carregamento bipando o DANFE** (leitor USB ou câmera do celular/app) com aviso sonoro, NFs faltantes e leituras fora do romaneio; ao confirmar, grava a data de coleta e muda as NFs para "Em Transporte".
- Segurança: o link do portal só enxerga e altera NFs da própria transportadora; fotos ficam em armazenamento privado.
- **Gere e envie o link pelo sistema publicado (Vercel)**, não pelo app ou pelo servidor de teste (lá o endereço é "localhost"). Opcional: defina `VITE_APP_URL` (ex.: `https://seu-sistema.vercel.app`) na Vercel e no `.env.local` para o link sair sempre certo.

## 16. Faturas de frete — conferência, contestação e pagamento (out/2026)

> Requer rodar `supabase/faturas_frete.sql` no Supabase (uma vez; pode rodar de novo sem problema).

- **Menu Análise › Faturas de frete**: registre a fatura/boleto da transportadora (nº, vencimento, valor e os CTEs cobrados — cole os números do boleto/e-mail ou marque na lista de CTEs sem fatura; PDF opcional).
- **Conferência automática** de cada fatura: soma dos CTEs × valor cobrado, CTE repetido na fatura, CTE já cobrado em outra fatura, CTE de outra transportadora, CTE acima da tabela de frete, CTE não registrado no sistema, NF em 2+ CTEs e NF ainda não entregue. Mostra o **valor a contestar** sugerido.
- **Fluxo**: A conferir → Conferida ou Contestada (mensagem pronta para copiar/WhatsApp/e-mail) → Aprovada para pagar (valor final, com a economia) → Paga. Tudo fica na linha do tempo da fatura e na Auditoria. Também dá para cancelar (fatura substituída) e desfazer etapas.
- **Infarma**: na fatura, um clique marca os CTEs como lançados (ABERTO → FECHADO).
- **CTEs sem fatura**: o que a transportadora ainda vai cobrar, por transportadora, com "Montar fatura com estes CTEs".
- Indicadores: vencidas, vencem em 7 dias, em conferência, liberadas a pagar e **economia com contestações**. Exportação CSV.
- **Alertas** (tela e e-mail diário): faturas vencidas sem pagamento (crítico), que vencem em até N dias (ajustável em Alertas › Configurar) e contestações sem resposta há mais de 5 dias. Os alertas agora aparecem em ordem: críticos, atenção, informativos.
- Segurança: todos consultam; registrar, aprovar e pagar só Administrador. PDFs em armazenamento privado.

## 17. Avaliação mensal das transportadoras (out/2026)

- **Menu Análise › Avaliação mensal**: nota de 0 a 10 por transportadora e mês, com conceito A (≥ 8,5 excelente), B (≥ 7 bom), C (≥ 5 regular) e D (crítico), comparação com o mês anterior e evolução de 6 meses.
- **Cinco critérios** (pesos ajustáveis em "Critérios", só administrador):
  - **Prazo de entrega (35)**: entregas do mês até a previsão, em dias úteis. A transportadora é comparada com a previsão da NF, o prazo contratado na tabela de frete ou o tempo que as transportadoras em geral levam para a UF (não com o próprio histórico). NFs em aberto já vencidas contam como atraso.
  - **Coleta no prazo (15)**: coletadas até D+N (prazo de coleta dos Indicadores Diários).
  - **Qualidade (20)**: avarias (peso 1) e cliente ausente, endereço, reentrega, recusa e devoluções (peso ½) sobre as NFs do mês.
  - **Cobrança (20)**: CTEs dentro da tabela de frete (sem tabela: real até a margem sobre o cotado); cada fatura contestada no mês tira 1 ponto.
  - **Informação e canhoto (10)**: entregas informadas no portal com foto do canhoto — só entra na nota quando o portal já estiver em uso.
  - Critério sem dados no mês fica de fora e os demais são reponderados. Menos de 5 NFs no mês = "amostra pequena".
- **Relatório por transportadora**: critérios, pontos de atenção, destaques, NFs atrasadas, ocorrências e CTEs acima da tabela. **Imprimir / PDF** (A4 retrato), **copiar**, **WhatsApp** e **e-mail** com o resumo pronto (o envio fica registrado na Auditoria).
- Exportação CSV do ranking. Não precisa de nada novo no Supabase.
