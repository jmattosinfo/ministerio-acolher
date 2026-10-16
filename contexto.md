# 🧠 contexto.md — Documento de Contexto do Projeto Ministério Acolher

> **Objetivo deste documento:** permitir que **outra IA (ou novo desenvolvedor)** entenda rapidamente o projeto Ministério Acolher em sua totalidade — propósito, arquitetura, stack, arquivos, fluxos, modelo de dados, integrações, design system, regras de negócio, convenções e infraestrutura — a ponto de **participar ativamente** (sugerir, revisar e implementar mudanças) sem quebrar premissas existentes.
>
> **Leia também:** [`README.md`](README.md) (setup e visão geral), [`AI_GUIDELINES.md`](AI_GUIDELINES.md) (diretrizes obrigatórias para agentes de IA), [`DEPLOY.md`](DEPLOY.md) (operação em produção) e [`relatorio.md`](relatorio.md) (análise técnica detalhada).

---

## 1. Visão Geral e Propósito

O **Ministério Acolher** é uma **plataforma web de acolhimento emocional e espiritual**, gratuito, sigiloso e 100% online, destinada a **homens e mulheres maiores de 18 anos** que vivenciam ou vivenciaram:

- Violência doméstica no relacionamento conjugal;
- Divórcio ou processo de separação;
- Abuso sexual fora do contexto conjugal.

**O acolhimento NÃO é atendimento clínico.** O projeto **não substitui** atendimento psicológico, psiquiátrico ou jurídico — atua como **suporte complementar**, respeitando a fé e a visão de mundo de cada pessoa, **sem qualquer imposição religiosa**.

**Domínio de produção:** [`https://acolher.life`](https://acolher.life) · **Instagram:** [@acolher.life](https://www.instagram.com/acolher.life/)
**E-mail de acessibilidade:** `acessibilidade@acolher.life`

---

## 2. Stack Tecnológica

### Backend (Node.js 22)
| Dependência | Versão | Papel |
|---|---|---|
| `express` | ^5.2.1 | Framework web / servidor HTTP |
| `mysql2` | ^3.22.5 | Pool de conexões MySQL (promises) |
| `express-session` | ^1.19.0 | Sessão do painel admin |
| `bcryptjs` | ^2.4.3 | Hash da senha administrativa |
| `nodemailer` | ^9.0.3 | Envio de e-mail via SMTP **Brevo** |
| `dotenv` | ^17.4.2 | Variáveis de ambiente |
| `country-state-city` | ^3.2.1 | Base local de países/estados/cidades |
| `ssh2` (dev) | ^1.17.0 | Automação de deploy (scripts legados, aposentados) |
| `nodemon` (dev) | ^3.1.14 | Reload automático |

- Projeto em **CommonJS** (`"type": "commonjs"`), sem build/bundler.
- Pontos de entrada: [`server.js`](server.js) (`npm start` / `npm run dev`).

### Frontend (vanilla JS + libs via CDN)
- **Tailwind CSS 3.x** (CDN, config de tema inline no [`public/index.html`](public/index.html:24))
- **Chart.js 4.x** (gráficos do dashboard)
- **Leaflet 1.9.x** (mencionado no README para mapa coroplético)
- **Lucide** (ícones)
- **html2canvas 1.4.1** (geração de card para compartilhar)
- **Google Fonts**: Cinzel, Playfair Display, Plus Jakarta Sans, Alex Brush
- **i18n próprio** (vanilla) em [`public/js/i18n.js`](public/js/i18n.js)

### Geolocalização
- `country-state-city` (dados locais) para selects de país/estado/cidade.
- **Nominatim (OpenStreetMap)** para enriquecer cidade → `Cidade – UF` (com cache em memória).

### Infra (Conteinerizada)
- **Docker + Docker Compose** — orquestração de app e banco em produção e desenvolvimento.
- **MySQL 8.4** (imagem `mysql:8.4.0`), tabela única `cadastros`, com volume persistente nomeado **`acolher_mysql_data`**.
- Aplicação empacotada em imagem própria ([`Dockerfile`](Dockerfile), base `node:22-alpine`), usuário não-root e `HEALTHCHECK` no endpoint `GET /healthz`.
- **GitHub Actions** — pipeline de CI/CD ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) que valida (`npm ci` + `node --check`) e publica na VPS via SSH + Docker Compose.
- **PM2 aposentado** — o gerenciamento de processo e o deploy manual por SFTP foram substituídos pelos containers.

---

## 3. Arquitetura

**Monólito leve em Node.js/Express**: serve páginas estáticas de [`public/`](public) e expõe uma API JSON. Lógica de frontend isolada em `public/js`.

```
Cliente → acolher.life → proxy/TLS (CloudPanel/Nginx) → 127.0.0.1:3000 (container acolher-life) → container acolher-db (MySQL) + SMTP Brevo + Nominatim + CDNs
```

Camadas: `middleware → routes → views` (backend) e `public/js` (frontend). **Regra de estrutura:** novos arquivos devem seguir o layout existente; não criar pastas/estruturas paralelas.

### Estrutura de arquivos com responsabilidades

```
ministerio-acolher/
├── server.js                       # Servidor Express principal
├── package.json / package-lock.json
├── .env                            # Variáveis de ambiente (NÃO versionado)
├── .env.example                    # Modelo das variáveis de ambiente (versionado)
├── .dockerignore                   # Exclusões do contexto de build da imagem
├── .gitignore
│
├── Dockerfile                      # Imagem de produção (node:22-alpine)
├── docker-compose.yml              # Stack de produção (acolher-app + acolher-db)
├── docker-compose.dev.yml          # Stack de desenvolvimento (hot-reload via nodemon)
│
├── .github/workflows/
│   └── deploy.yml                  # CI/CD: validação (CI) + deploy automático na VPS (CD)
│
├── middleware/
│   └── auth.js                     # requireAuth: protege rotas admin por sessão
│
├── routes/
│   ├── admin.js                    # Login/logout + dashboard HTML + API /admin/api/stats
│   └── location.js                 # API de países, estados e cidades
│
├── utils/
│   └── geocode.js                  # Geocoding Nominatim (OSM) + cache em memória
│
├── public/                         # Servido na raiz (express.static)
│   ├── index.html                  # Landing page (Tailwind config + seções + modais)
│   ├── css/styles.css              # Estilos customizados, animações, modais, a11y
│   ├── js/
│   │   ├── i18n.js                 # Sistema de internacionalização pt-BR/en/es
│   │   └── main.js                 # Formulário, máscara, países/estados/cidades, modais, share
│   ├── admin/
│   │   └── dashboard.js            # Lógica do dashboard (Chart.js)
│   └── assets/images/              # Logos, fotos da equipe, fundos
│
├── views/admin/
│   ├── login.html                  # Tela de login (meta noindex)
│   └── dashboard.html              # Template do dashboard (Chart.js + Lucide)
│
└── scripts/
    ├── gerar-hash-senha.js         # Gera hash bcrypt p/ ADMIN_PASSWORD_HASH
    ├── deploy-vps.js               # (LEGADO) Deploy SFTP + pm2 — aposentado
    ├── restart-server.js           # (LEGADO) pm2 restart remoto — aposentado
    └── deletar-ultimo-registro.js  # Remove o último registro (uso de teste)
```

---

## 4. Fluxo do Usuário (fim a fim)

1. Usuário acessa a landing page; conhece o projeto (**Hero → Sobre → Equipe → Formulário**).
2. Preenche o **Formulário de Acolhimento** ([`public/index.html`](public/index.html:331)):
   - **Perfil de triagem** (radio): `homem`, `mulher`, `vitima_abuso`.
   - Dados: nome, data de nascimento, **país → estado → cidade** (selects dinâmicos via API), WhatsApp (máscara).
   - Estado civil, rede de apoio, preferência de horário, motivo, onde conheceu o Acolher.
   - Aceite de **3 termos** de consentimento (sigilo, sessões, gratuidade).
   - **Modo codinome**: ao selecionar `vitima_abuso`, exibe aviso âmbar informando que o nome real não é obrigatório.
3. Frontend ([`public/js/main.js`](public/js/main.js:268)) valida (radio, WhatsApp com 11 dígitos, país, cidade, onde_conheceu) e envia `POST /api/cadastro` (JSON, WhatsApp só com dígitos).
4. Backend ([`server.js`](server.js:201)):
   - Valida perfil e exige `cidade` e `pais`.
   - Monta `localizacao` (Brasil → `Cidade – UF`; outros países → `Cidade, Estado – País`) e enriquece via Nominatim.
   - Insere no MySQL (`INSERT INTO cadastros`).
   - Dispara e-mail HTML ao profissional responsável (Nodemailer/Brevo).
   - Retorna `{ ok, profissional: { nome, whatsapp, whatsappFormatado } }`.
5. Frontend **redireciona automaticamente** para o WhatsApp do profissional:
   - Pré-checa o `wa.me` com `fetch(HEAD, no-cors)` e timeout de 3s.
   - Se disponível → `window.location.href = wa.me/...`.
   - Se indisponível → **tela de sucesso com botão** de contato (fallback).
   - **Caso especial Shirley**: como não aparece na listagem pública (questão jurídica), um modal de aviso é exibido antes de abrir o WhatsApp dela; ao fechar, segue o redirecionamento normal. Ver [`public/js/main.js`](public/js/main.js:832).
   - Mensagem pré-preenchida é traduzida conforme o idioma ativo.

---

## 5. Triagem e Profissionais (regra de negócio central)

Definidos em [`server.js`](server.js:115). **Não alterar sem ordem explícita do usuário.**

| Perfil (`perfil_triagem`) | Categoria | Profissional | Regra |
|---|---|---|---|
| `homem` | Acolhimento masculino | **Matheus** | Fixo |
| `mulher` | Acolhimento feminino | **Agda, Gabriela, Shirley** | **Round-robin** em memória |
| `vitima_abuso` | Mulher — vítima de abuso | **Kelly** | Fixo (suporta codinome) |

- Round-robin: `indiceRoundRobin` + `proximoProfissionalMulher()` ([`server.js`](server.js:152)).
- Contatos (whatsapp/formatado/e-mail) estão hardcoded em [`server.js`](server.js:115) — a equipe é **real e fixa**. **Nunca inventar** nomes, fotos, e-mails ou números.

---

## 6. Modelo de Dados

Tabela **`cadastros`**, criada/gerenciada imperativamente em [`server.js`](server.js:41) (`inicializarBanco()`) — **sem ferramenta de migrations** (sem Prisma/Sequelize/Knex).

```sql
CREATE TABLE IF NOT EXISTS cadastros (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    perfil_triagem           VARCHAR(30)  NOT NULL,
    profissional_responsavel VARCHAR(50)  NOT NULL,
    nome                     VARCHAR(150) NOT NULL,
    data_nascimento          DATE,
    localizacao              VARCHAR(200),   -- "Cidade – UF" (BR) ou "Cidade, Estado – País"
    pais                     VARCHAR(100),
    whatsapp                 VARCHAR(30)  NOT NULL,
    estado_civil             VARCHAR(30),
    rede_apoio               VARCHAR(30),
    motivo_terapia           TEXT,
    preferencia_horario      VARCHAR(30),
    onde_conheceu            VARCHAR(50),
    termo_sigilo             TINYINT(1) DEFAULT 0,
    termo_sessoes            TINYINT(1) DEFAULT 0,
    termo_gratuidade         TINYINT(1) DEFAULT 0,
    criado_em                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Auto-migração:** para colunas em `colunasNecessarias` (`pais`, `onde_conheceu`), verifica `INFORMATION_SCHEMA.COLUMNS` e executa `ALTER TABLE ... ADD COLUMN` se ausente.
**Ao alterar schema:** adicionar a coluna tanto no `CREATE TABLE` quanto no mapa `colunasNecessarias` e confirmar o log `✅ Coluna "X" adicionada com sucesso.`

---

## 7. API Endpoints

### Localização ([`routes/location.js`](routes/location.js)) — públicas
| Método | Rota | Retorno |
|---|---|---|
| GET | `/api/location/countries` | `{ ok, dados: [{ value, label, phonecode, lat, lng }] }` |
| GET | `/api/location/countries/coordinates` | Países com lat/lng |
| GET | `/api/location/states/:countryCode` | `[{ value, label }]` |
| GET | `/api/location/cities/:countryCode/:stateCode` | `string[]` (nomes ordenados, sem duplicatas) |

### Cadastro ([`server.js`](server.js:201)) — pública
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/cadastro` | Salva no banco, envia e-mail e retorna profissional (WhatsApp) |

### Administração ([`routes/admin.js`](routes/admin.js)) — sessão
| Método | Rota | Descrição |
|---|---|---|
| GET | `/admin/login` | Página de login (redireciona p/ `/admin` se já autenticado) |
| POST | `/admin/login` | `{ usuario, senha }` → `{ ok: true }` ou `401` |
| POST | `/admin/logout` | Destrói a sessão |
| GET | `/admin` | Dashboard HTML (protegido por `requireAuth`) |
| GET | `/admin/api/stats?periodo=semana\|mes\|ano\|todos` | Estatísticas JSON (protegido) |

**Autenticação:** `ADMIN_USERNAME` + `bcrypt.compare` com `ADMIN_PASSWORD_HASH`. Sessão em cookie `httpOnly`, `secure` quando `NODE_ENV=production`. Middleware [`requireAuth`](middleware/auth.js:4) devolve `401` JSON em rotas `/admin/api/*` e redireciona nas demais.

**Fallback:** [`server.js`](server.js:292) — qualquer rota não tratada serve `public/index.html` (padrão Express 5: `/{*path}`).

---

## 8. Dashboard Administrativo

- **Backend** [`routes/admin.js`](routes/admin.js:48): cada métrica roda em bloco `try/catch` individual (resiliência). Filtros temporais via `WHERE criado_em >= DATE_SUB(NOW(), INTERVAL ...)`.
- **Métricas retornadas:** `total`, `sexo` (perfil_triagem), `estadoCivil`, `faixaEtaria` (calculada em [`calcularFaixasEtarias()`](routes/admin.js:207)), `motivo` (top 10 + "Outros" em [`agruparMotivos()`](routes/admin.js:245)), `localizacao`, `ondeConheceu`, `redeApoio`, `paises`.
- **Frontend** [`public/admin/dashboard.js`](public/admin/dashboard.js): busca `/admin/api/stats?periodo=`, desenha gráficos com Chart.js; traduz rótulos (`MAPA_ONDE_CONHECEU`, `MAPA_REDE_APOIO`); filtra países excluindo Brasil e "Não informado".
- **View** [`views/admin/dashboard.html`](views/admin/dashboard.html): filtros (semana/mês/ano/todos), card de total e grade de 8 gráficos (Leaflet referenciado no README).
- Paleta de dados do dashboard: `#7A1C1C, #C08552, #4A6C6F, #D9A441, #8E9775, #B0413E, #5A5A5A, #3E5C76, #A16E83, #6B8F71`.

---

## 9. Integrações Externas

1. **Nominatim / OpenStreetMap** — [`utils/geocode.js`](utils/geocode.js): converte cidade → `Cidade – UF` (Brasil), com `User-Agent`, timeout de 4s, cache em `Map` e fallback para o valor original. Também expõe `estadoParaSigla()` (nome completo → UF) e `resolverCidadeParaUF()`.
2. **Brevo (SMTP)** — [`server.js`](server.js:104): Nodemailer envia e-mail HTML ([`montarEmailHtml()`](server.js:171)) ao profissional a cada novo cadastro. Host padrão `smtp-relay.brevo.com:587`.
3. **WhatsApp Web (`wa.me`)** — links diretos com mensagem pré-formatada traduzida.
4. **CDNs** — Tailwind, Chart.js, Lucide, html2canvas, Google Fonts (UI degrada se bloqueadas).

---

## 10. Internacionalização (i18n)

Arquivo [`public/js/i18n.js`](public/js/i18n.js) — objeto global `I18N`:

- **Idiomas:** `pt-BR` (padrão), `en`, `es`. `availableLangs` + `labels` (nome/bandeira/short).
- **Dicionário:** `translations = { 'chave': { 'pt-BR', 'en', 'es' } }`. Suporta HTML inline (`<b>`, `<br>`, emojis).
- **API:**
  - `I18N.t(key, lang?, replacements?)` — retorna string traduzida com fallback `pt-BR` e substituição de `{var}`.
  - `I18N.applyTranslation(lang)` — percorre o DOM: `[data-i18n]`, `[data-i18n-placeholder]`, `[data-i18n-aria-label]`, `meta[data-i18n-content]`, botões `[data-lang-btn]`; salva em `localStorage['acolher-lang']`.
  - `I18N.init()` — detecta `localStorage` ou `navigator.language`; chamado em `DOMContentLoaded`.
- **Convenção:** todo texto visível deve usar `data-i18n` e existir nos **3 idiomas**. `main.js` faz hook em `applyTranslation` para re-renderizar o preview do modal de compartilhamento.

---

## 11. Design System / Identidade Visual

Estética acolhedora, sóbria e elegante. **Tom de marca: vinho/bordô.** Paleta oficial (config Tailwind em [`public/index.html`](public/index.html:34)):

| Token | HEX | Uso |
|---|---|---|
| `brand-dark` | `#7A1C1C` | **Primária** (botões, links, títulos, foco) |
| `brand-deep` | `#5C1414` | Vinho profundo (hover) |
| `brand-light` | `#FFFDF9` | Off-white (fundo principal) |
| `brand-cream` | `#F4EFE6` | Creme (seções alternadas, chips) |
| `brand-muted` | `#E8E0D4` | Bege (bordas, separadores) |
| `brand-accent` | `#E05A5A` | Coral (destaque, gradientes) |
| `brand-text` | `#2C1A1A` | Quase-preto quente (texto) |
| `brand-soft` | `#7A5C5C` | Marrom acinzentado (texto secundário) |

**Tipografia:** Cinzel (`font-title`), Playfair Display (`font-serif`), Plus Jakarta Sans (`font-sans`), Alex Brush (`font-cursive`).

### ⚠️ Regra do Amarelo
Amarelo **NÃO é cor de marca**. Permitido apenas em **avisos de segurança/sigilo** (ex.: aviso de codinome para vítimas de abuso, `bg-amber-50/200/800`) e como cor **secundária de dados** em gráficos (`#D9A441`). Proibido como cor primária/decorativa. Em qualquer outro contexto, usar a paleta `brand`.

### Tags de perfil (página pública)
Homens: azul (`bg-blue-50`/`text-blue-700`) · Mulheres: rosa (`bg-rose-50`/`text-rose-700`) · Abuso: roxo (`bg-purple-50`/`text-purple-700`).

---

## 12. Acessibilidade (WCAG 2.1 AA)

- **Skip link** para o formulário ([`.skip-link`](public/css/styles.css:6)).
- **Focus trap** + navegação por teclado nos modais (compartilhamento, aviso Shirley, perfil de profissional); fechamento por `Escape`.
- **Foco visível** `outline: 2.5px solid #7A1C1C`.
- **ARIA** extensivo: `aria-label`, `aria-expanded`, `aria-pressed`, `aria-controls`, `role`.
- Respeito a `prefers-reduced-motion` (animações `.reveal` via IntersectionObserver).
- Textos alternativos em imagens; `aria-live` no estado de sucesso do formulário.

---

## 13. Variáveis de Ambiente (`.env`, não versionado)

O modelo versionado é o [`.env.example`](.env.example) (gerar o `.env` com `cp .env.example .env`).

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `PORT` | Não | `3000` | Porta do servidor |
| `NODE_ENV` | Produção | `development` | `production` ativa cookie `secure` (exige HTTPS); forçado pelo `docker-compose.yml` |
| `DB_HOST` | Não | `127.0.0.1` | Host MySQL (no Compose é sobrescrito para `db`) |
| `DB_PORT` | Não | `3307` | Porta MySQL (manual: 3307 via Docker; no Compose é sobrescrita para `3306`) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | **Sim** | `acolher` / `acolher123` / `ministerio_acolher` | Credenciais do banco |
| `DB_ROOT_PASSWORD` | **Sim** (Compose) | `root` | Senha root do MySQL (container `acolher-db`) |
| `SESSION_SECRET` | **Sim** | — | Chave das sessões |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` | **Sim** (porta não) | `587` | SMTP Brevo |
| `EMAIL_FROM` | Não | = `EMAIL_USER` | Remetente exibido |
| `ADMIN_USERNAME` | **Sim** | — | Usuário do admin |
| `ADMIN_PASSWORD_HASH` | **Sim** | — | Hash bcrypt (gerar via script), **entre aspas simples** |

**Gerar hash:** `node scripts/gerar-hash-senha.js "sua-senha"` → copiar para `ADMIN_PASSWORD_HASH`.

> ⚠️ **Regra do `ADMIN_PASSWORD_HASH` e de senhas com caracteres especiais:** o valor **deve** ser escrito **entre aspas simples** no `.env` (`ADMIN_PASSWORD_HASH='$2b$10$...'`). Sem as aspas, o Docker Compose interpreta o `$` como **interpolação de variável** e corrompe o hash (ou a senha), impedindo o login no painel administrativo. A mesma regra vale para senhas de banco/SMTP que contenham `$`.

---

## 14. Como Rodar Localmente

### Opção A — Docker Compose (recomendada)

```bash
cp .env.example .env                          # 1. gera o .env a partir do modelo
node scripts/gerar-hash-senha.js "sua-senha"  # 2. cole o hash em ADMIN_PASSWORD_HASH (entre aspas simples)
docker compose -f docker-compose.dev.yml up   # 3. sobe app (porta 3000) + MySQL (porta 3307)
```

- Container `acolher-life-dev` (Node.js 22, hot-reload via nodemon) monta o código por bind mount.
- Container `acolher-db-dev` (MySQL 8.4) publica a porta **3307** e usa o volume `acolher_mysql_dev_data`.
- Encerrar: `docker compose -f docker-compose.dev.yml down` (**nunca** usar `-v`, que apaga o volume).
- Dentro do Compose, `DB_HOST=db` e `DB_PORT=3306` são definidos automaticamente (rede interna).

### Opção B — Execução manual

```bash
npm install
# (opcional) MySQL via Docker — porta host 3307:
# docker run -d --name acolher-db -p 3307:3306 \
#   -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=ministerio_acolher \
#   -e MYSQL_USER=acolher -e MYSQL_PASSWORD=acolher123 mysql:8.4.0
node scripts/gerar-hash-senha.js "sua-senha"   # -> .env ADMIN_PASSWORD_HASH

npm run dev     # nodemon (reload automático)
npm start       # produção
```

- Site público: `http://localhost:3000`
- Painel: `http://localhost:3000/admin/login` (credenciais do `.env`)
- A tabela `cadastros` é criada automaticamente na primeira execução.

**Checagem rápida de sintaxe:** `node --check server.js routes/admin.js routes/location.js middleware/auth.js utils/geocode.js`.

---

## 15. Deploy e Operação (resumo — detalhes em [`DEPLOY.md`](DEPLOY.md))

- **CI/CD automatizado via GitHub Actions** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): dispara no push da `main`; job `validate` (CI: `npm ci` + `node --check`) e job `deploy` (CD: SSH na VPS + Docker Compose). **Sem build de assets.**
- **Conteinerização:** produção com dois containers via [`docker-compose.yml`](docker-compose.yml) — `acolher-life` (imagem do [`Dockerfile`](Dockerfile), publicada em `127.0.0.1:3000`) e `acolher-db` (`mysql:8.4.0`, sem porta publicada).
- **Volume persistente nomeado:** `acolher_mysql_data` (nome declarado explicitamente no Compose). **Nunca** executar `docker compose down -v`.
- **Rotina de deploy:** backup preventivo do banco (`mysqldump | gzip` → `backups/db_pre_deploy_<timestamp>.sql.gz`, permissão `600`, retenção de 10 arquivos) → `git reset --hard origin/main` → `docker compose up -d --build` → smoke test `GET /healthz` → remoção do PM2 legado.
- **Produção:** VPS `187.127.39.48`, diretório `/home/acolher/htdocs/acolher.life`; proxy CloudPanel/Nginx → `127.0.0.1:3000`.
- **PM2 / SFTP / scripts `deploy-vps.js` e `restart-server.js`: aposentados.** As operações usam `docker compose`.
- **Auto-migração roda no boot** (`ALTER TABLE` sem lock, com retry/fail-fast) — para tabelas grandes, planejar janela de baixo tráfego.
- **Backup:** automatizado a cada deploy (gzip, retenção de 10); recomendada cópia diária **offsite** criptografada (pendência).

---

## 16. Convenções de Código e Regras para IA (obrigatórias)

Consulte sempre [`AI_GUIDELINES.md`](AI_GUIDELINES.md). Resumo:

1. **Código limpo e comentado** (comentários em português, explicando o "porquê").
2. Respeitar a arquitetura: `middleware → routes → views`; frontend em `public/js`.
3. Tailwind + tokens `brand.*`; evitar CSS custom desnecessário.
4. **SQL sempre parametrizado** (placeholders `?`).
5. **Segredos só no `.env`** — nunca hardcodear credenciais.
6. **i18n obrigatório** para textos visíveis (adicionar nos 3 idiomas).
7. `node --check` e **teste manual** (formulário, dashboard, i18n, a11y) antes de concluir.
8. Commits: `feat:`/`fix:`/`refactor:`/`style:`/`docs:`/`chore:`.

### 🚫 Não Inventar Conteúdo Profissional
A equipe é **real e fixa** (Matheus, Agda, Gabriela, Shirley, Kelly). **Nunca** inventar nomes, fotos, currículos, e-mails, números ou estatísticas; não alterar o direcionamento por perfil; não inventar conteúdo clínico/jurídico nem termos de consentimento.

### 🧘 Não Criar Complexidade Sem Necessidade
Princípio do **mínimo viável**. Não adicionar bibliotecas/abstrações não pedidas; **não "modernizar"** (React, Vue, TypeScript, bundlers, SSR) sem autorização explícita; não refatorar o que funciona; **uma mudança por vez** (sem "aproveitar" para alterar coisas não relacionadas).

### 📦 Dependências
Preferir o que já existe. **Nova dependência** só se estritamente necessária e aprovada. Proibido adicionar frameworks/bundlers/TypeScript sem autorização — o projeto é deliberadamente **HTML + CSS + JS vanilla + Node/Express**.

---

## 17. Estado Atual e Dívidas Técnicas Conhecidas

Documentado em [`relatorio.md`](relatorio.md) (análise técnica), na seção 15 do [`DEPLOY.md`](DEPLOY.md) (Segurança) e em [`AUDITORIA-CONTEINERIZACAO.md`](AUDITORIA-CONTEINERIZACAO.md):

- **Segurança — pendências:** rate limiting (`express-rate-limit`) em `/api/cadastro` e `/admin/login`; headers de segurança (`helmet`); validação de schema no backend (`zod`/`express-validator`); rotacionar credenciais que estiveram no histórico do Git (scripts de deploy legados, já aposentados); pinar imagens e GitHub Actions por digest/SHA.
- **Testes:** só o placeholder no `package.json` (`npm test` retorna erro). Recomendado Jest + Supertest cobrindo `/api/cadastro`, round-robin, `utils/geocode.js` e `i18n.js`.
- **Migrations:** inexistentes — schema gerenciado imperativamente em [`server.js`](server.js:41).
- **Staging:** inexistente (produção recebe `main` diretamente).
- **Itens a confirmar:** configuração exata do proxy/TLS (CloudPanel/Nginx), provedor de tiles do Leaflet e cópia de backup **offsite**.
- **Pontos fortes:** arquitetura enxuta, foco em UX/empatia, dashboard resiliente (try/catch por métrica), privacidade (codinome + termos), i18n leve sem dependências pesadas.

---

## 18. Referência Rápida de Arquivos-Chave

| Assunto | Arquivo | Linha-âncora |
|---|---|---|
| Servidor / sessão / pool MySQL | [`server.js`](server.js) | 17, 30, 41 |
| Triagem e profissionais | [`server.js`](server.js:115) | 115 |
| Endpoint de cadastro | [`server.js`](server.js:201) | 201 |
| Template de e-mail | [`server.js`](server.js:171) | 171 |
| Rotas admin + stats | [`routes/admin.js`](routes/admin.js) | 19, 48 |
| API de localização | [`routes/location.js`](routes/location.js) | 9–80 |
| Middleware de auth | [`middleware/auth.js`](middleware/auth.js) | 4 |
| Geocoding Nominatim | [`utils/geocode.js`](utils/geocode.js) | 35, 153 |
| i18n (API) | [`public/js/i18n.js`](public/js/i18n.js) | 707, 719, 768 |
| Formulário e redirecionamento | [`public/js/main.js`](public/js/main.js) | 268, 445, 832 |
| Landing page | [`public/index.html`](public/index.html) | 24 (tema), 331 (form) |
| Dashboard (front) | [`public/admin/dashboard.js`](public/admin/dashboard.js) | 25, 56 |
| Deploy (CI/CD) | [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | — |
| Conteinerização | [`docker-compose.yml`](docker-compose.yml) · [`Dockerfile`](Dockerfile) | — |

---

*Documento de contexto do projeto Ministério Acolher · 💜 Escuta, Cuidado e Respeito.*
*Mantenha este arquivo atualizado quando houver mudanças estruturais relevantes.*
