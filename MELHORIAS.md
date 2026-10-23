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
