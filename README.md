# 🚚 MunilaLog - Sistema de Acompanhamento Logístico

O **MunilaLog** é uma plataforma web moderna desenvolvida para revolucionar e automatizar a gestão logística, substituindo o antigo controle manual em planilhas por um sistema centralizado, inteligente e em tempo real.

## ✨ Principais Funcionalidades

- **📊 Dashboard Inteligente e Dinâmico:** Painel de controle com métricas em tempo real (Faturamento, Custo Logístico, % Frete Médio, Volume Total, etc.) e filtros avançados de múltipla escolha (cruze dados por status, transportadora, datas, modais e regras de agendamento).
- **📦 Gestão Completa de Entregas:** Controle de ponta a ponta das notas fiscais, incluindo valores de frete, cubagem e mudança automatizada de status (com inteligência de preenchimento de datas e gatilhos visuais para "frete conferido" e "com agendamento").
- **🧾 Módulo Avançado de CTEs:**
  - **Leitura Automática de XML:** Importação de arquivos `.xml` com extração instantânea e preenchimento de todos os dados cruciais (Emissor, CNPJ, CFOP, Datas, Valor, etc.).
  - **Captura Inteligente de Chaves:** Identificação e extração de múltiplas Chaves de NFe (infNFe) vinculadas a um único Conhecimento de Transporte, bem como captura de observações (apólices e agendamentos).
  - **Barreira de Segurança (Anti-Duplicidade):** Bloqueio automático de registro caso qualquer chave de acesso informada já conste na base de dados, prevenindo pagamentos ou lançamentos duplicados.
  - **Resumos em Tempo Real:** Cartões interativos que somam o valor total financeiro e a volumetria de documentos baseados nos filtros de tela.
- **🧮 Calculadora Volumétrica:** Auditoria de peso e caixaria automática com base no cadastro de produtos para preenchimento exato em faturamentos de grandes redes varejistas.
- **🏢 Cadastros Inteligentes:** Gestão de Clientes e Transportadoras. O sistema "lembra" regras de negócio, como clientes que exigem agendamento padrão, automatizando a criação de novas entregas.
- **🔄 Controle de Devoluções:** Acompanhamento de recusas e retornos de mercadorias.
- **🔐 Controle de Acesso e Perfis:** Autenticação segura com níveis de acesso estruturados (Operador e Administrador).
- **📥 Exportações Práticas:** Geração de arquivos PDF e planilhas Excel (CSV) perfeitamente formatados a partir do histórico visível na tela.

## 🛠 Tecnologias e Bibliotecas Utilizadas

O sistema foi construído utilizando as melhores práticas modernas de desenvolvimento Front-end e Back-end (Serverless).

### Frontend (Interface e Lógica)
- **[React 18+](https://react.dev/)**: Biblioteca central para a construção reativa e modular da interface de usuário (UI).
- **[TypeScript](https://www.typescriptlang.org/)**: Superconjunto de JavaScript que adiciona tipagem estática rigorosa, garantindo um código mais seguro, inteligente e livre de erros.
- **[Vite](https://vitejs.dev/)**: Ferramenta de build de última geração, garantindo um ambiente de desenvolvimento ultra-rápido.
- **[React Router Dom](https://reactrouter.com/)**: Gerenciamento de rotas para criação da Single Page Application (SPA), permitindo navegação fluida sem recarregamentos.
- **[Lucide React](https://lucide.dev/)**: Biblioteca leve de ícones SVG limpos e padronizados.
- **Leitor DOMParser (Nativo)**: API nativa do navegador utilizada para varrer e extrair os dados lógicos dos arquivos XML da SEFAZ (NFe e CTe).
- **CSS3 (Customizado)**: Estilização construída do zero, focada em performance. Utiliza variáveis CSS nativas, Flexbox, Grid e Media Queries exclusivas, resultando em um sistema *100% responsivo* (com soluções avançadas de UX para tabelas scrolláveis no Desktop e Mobile).

### Backend e Infraestrutura
- **[Supabase](https://supabase.com/)**: Plataforma Backend-as-a-Service (BaaS) de código aberto.
  - **PostgreSQL**: Banco de dados relacional altamente escalável utilizado para armazenar e relacionar as entidades (entregas, ctes, devoluções, clientes e transportadoras).
  - **Supabase Auth**: Sistema de autenticação blindada para gestão de sessões dos usuários logados.

## 🚀 Como Executar o Projeto Localmente

1. Clone o repositório na sua máquina.
2. Acesse a pasta do projeto e instale as dependências:
   ```bash
   npm install
