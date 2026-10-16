# 🔒 Auditoria de Conteinerização & CI/CD — Ministério Acolher (acolher.life)

> **Documento de transferência de contexto (handoff) para outro agente de IA.**
> Objetivo: permitir que outro agente (ou humano) entenda **o sistema**, **o que foi auditado**, **as evidências coletadas**, **os achados com IDs rastreáveis**, **as correções propostas** e **como provar que cada correção funcionou** — sem precisar refazer a investigação.
>
> **Data da auditoria:** 2026-10-16
> **Última atualização:** 2026-10-16 — **pós-remediação** (documento revisado após as correções serem aplicadas ao repositório; ver §12)
> **Modo:** revisão técnica + auditoria de segurança. A auditoria original foi somente leitura; esta atualização descreve o **estado atual** dos arquivos já corrigidos.
> **Escopo:** `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, com análise cruzada de `server.js`, `package.json`, `.gitignore`, `DEPLOY.md` e `docker-compose.dev.yml`

---

## 0. TL;DR para o próximo agente

O alicerce da conteinerização está **bom** (usuário não-root, portas em loopback, camadas de build otimizadas, `.env` fora da imagem, MySQL isolado na bridge). **Os riscos não estavam no Dockerfile.** A auditoria original identificou 4 problemas P0 e 3 P1 que vinham de **interações entre arquivos** e de **semântica de baixo nível do Docker/Compose/Shell**.

> **Atualização (pós-remediação):** a maioria dos achados foi **corrigida** no repositório. Permanecem abertos `OPS-01` (MemoryStore) e `SEC-03` (rate-limit), além de alguns itens **parciais** (`CICD-01`, `PERF-02`, `OPS-02`) e pontos de hardening opcionais. O status item a item está na coluna **Status** e o detalhamento das mudanças em §12.

| ID | Severidade | Resumo (1 linha) | Arquivo | Status |
|---|---|---|---|---|
| `SEC-01` | 🔴 P0 | `.env` montado como **arquivo** via bind mount → leitura pelo uid 1000 não garantida e falha **silenciosa**; inode travado ignora edições via SFTP/VSCode | `docker-compose.yml:30` | ✅ Corrigido (`env_file`) · ⚠️ fail-fast opcional pendente |
| `RES-01` | 🔴 P0 | `inicializarBanco()` rodava **uma vez, sem retry**, e engolia a exceção → volume novo podia ficar sem a tabela `cadastros` e o app respondia 500 "estando saudável" | `server.js:42-95` | ✅ Corrigido (retry + `process.exit`) |
| `PERS-01` | 🔴 P0 | Volume `mysql_data` era **namespaced pelo nome do diretório** → renomear dir / outro `cwd` / `COMPOSE_PROJECT_NAME` criava volume **novo e vazio** | `docker-compose.yml:42-43` | ✅ Corrigido (`name` + `volumes.name`) · ⚠️ validar volume atual na VPS |
| `SEC-02` | 🔴 P0 | Backup pré-deploy: dump **texto puro, não comprimido, world-readable, sem verificação de tamanho, no mesmo disco** — dados do art. 11 da LGPD | `deploy.yml:51-56` | ✅ Corrigido (umask/gzip/`-s`/`MYSQL_PWD`) · ⚠️ offsite/cron pendente |
| `RES-02` | 🟠 P1 | Healthcheck usava `-h localhost` (**socket Unix**) e `-p$$MYSQL_ROOT_PASSWORD` **nunca expandido** (forma exec = sem shell) | `docker-compose.yml:17` | ✅ Corrigido (`CMD-SHELL` + TCP + `start_period`) |
| `CICD-01` | 🟠 P1 | Sem `concurrency` → dois pushes abriam **duas sessões SSH concorrentes**; `git reset --hard` falhava com `dubious ownership`; `command_timeout` padrão podia matar o build | `deploy.yml:34-73` | ⚠️ Parcial (concurrency/timeout/safe.directory OK; actions ainda em tags mutáveis; sem `npm audit`/`hadolint`/`docker build`) |
| `CICD-02` | 🟠 P1 | `pm2 delete` acontecia **antes** do sucesso do Docker → rollback impossível; nenhuma verificação pós-deploy | `deploy.yml:63-73` | ✅ Corrigido (smoke test antes do PM2) |
| `PERF-01` | 🟡 P2 | `ssh2` em `dependencies` e `scripts/` **não** no `.dockerignore` → dependência nativa compilada no Alpine sem uso em runtime | `package.json:23`, `.dockerignore:1` | ✅ Corrigido |
| `PERF-02` | 🟡 P2 | **Node 20 estava EOL** (2026-04-30) e o CI validava Node **22** → artefato ≠ runtime validado | `Dockerfile:1`, `deploy.yml:20` | ⚠️ Parcial (base já é Node 22; falta `engines` e pin por digest) |
| `PERF-03` | 🟡 P2 | Logs `json-file` sem rotação e containers sem `mem_limit` → disco cheio / OOM killer pode derrubar Nginx+CloudPanel | `docker-compose.yml:2,22` | ✅ Corrigido (logging + `mem_limit` + `init` + `security_opt`) |
| `OPS-01` | 🟡 P2 | `MemoryStore` de sessões: admin é **deslogado em todo deploy** + aviso de vazamento de memória em produção | `server.js:19` | ❌ Aberto |
| `OPS-02` | 🟢 P3 | `docker-compose.dev.yml` está **vazio (0 bytes)**; `scripts/` entrava na imagem; `.gitignore` local difere do esperado | vários | ⚠️ Parcial (`.dockerignore` corrigido; `compose.dev.yml` ainda vazio) |
| `SEC-03` | 🟢 P3 | Sem rate-limit/lockout em `/admin/login` e sem rate-limit em `/api/cadastro` (abuso + consumo de cota Brevo) | `server.js`, `routes/admin.js` | ❌ Aberto (fora do escopo de containers) |

---

## 1. Contexto do sistema (o que o próximo agente precisa saber)

- **Produto:** plataforma web de acolhimento emocional **gratuito, sigiloso e online** para vítimas de violência doméstica, divórcio/separação e abuso sexual. Público-alvo: maiores de 18 anos em vulnerabilidade emocional.
- **Implicação crítica:** os dados armazenados incluem **nome, WhatsApp, estado civil, motivo da terapia, perfil de triagem** — ou seja, **dado pessoal sensível de saúde/vida íntima** (art. 5º, II e art. 11 da LGPD). Qualquer decisão de infra deve tratar backup, logs e dumps como material sensível.
- **Stack:** monólito enxuto **Node.js / Express 5 (CommonJS)**, sem build/bundle de frontend (Tailwind, Chart.js, Leaflet, Lucide via CDN). Serve estáticos de `public/` e expõe APIs REST.
- **Dependências de runtime:** `express@5.2.1`, `mysql2@3.22.5` (`mysql2/promise`), `express-session@1.19.0`, `nodemailer@9.0.3` (SMTP Brevo), `bcryptjs@2.4.3`, `country-state-city@3.2.1`, `dotenv@17.4.2`. (`ssh2@1.17.0` foi movido para **devDependencies** — usado apenas por scripts de deploy; ver `PERF-01`.)
- **Banco:** MySQL **8.4** (imagem `mysql:8.4.0`), tabela única `cadastros`, criada/“migrada” imperativamente na inicialização (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` condicional contra `INFORMATION_SCHEMA`). **Não há ferramenta de migração** (sem Prisma/Knex/Sequelize/pasta `migrations`).
- **Entrega:** dois containers Compose — `acolher-db` (MySQL, sem porta publicada) e `acolher-life` (app, publicado **apenas** em `127.0.0.1:3000`). O **CloudPanel/Nginx** faz reverse proxy de `https://acolher.life` → `127.0.0.1:3000`.
- **Deploy:** GitHub Actions → `appleboy/ssh-action` → SSH na VPS → `git reset --hard origin/main` + `docker compose up -d --build --remove-orphans`.
- **Estado legado:** o app rodava em **PM2** (processo `acolher.life`), com `scripts/deploy-vps.js` e `scripts/restart-server.js` (SFTP/SSH via `ssh2`). O workflow novo remove o PM2 na primeira execução — detalhes em `CICD-02`.

---

## 2. Inventário: conteúdo dos arquivos auditados (verbatim)

> Esta seção existe para que o próximo agente não precise reler os arquivos e para eliminar ambiguidade de versão. **Cópias literais do disco em 2026-10-16, já no estado PÓS-REMEDIAÇÃO.**
> O conteúdo **pré-correção** (que originou os achados) está preservado descritivamente em §5 e o mapeamento do que foi alterado em §12.

### 2.1 `.dockerignore` (19 linhas — **atualizado**)

```dockerignore
node_modules
dist
.git
.gitignore
.github
.vscode
plans
scripts
*.md
*.sql
*.sql.gz
Dockerfile
docker-compose*.yml
.env
.env.*
!.env.example
ecosystem.config.*
coverage
*.log
```

**Observações factuais (estado atual):**
- ✅ Exclui `.env`, `.env.*` (o `!.env.example` só re-inclui um arquivo que **não existe** no repo).
- ✅ Exclui `node_modules`, `.git`, `Dockerfile`, `docker-compose*.yml`, `*.md`, `*.log`.
- ✅ **Não** exclui `package-lock.json` (correto — é exigido por `npm ci`).
- ✅ **`PERF-01` corrigido:** o arquivo agora exclui `scripts/` → `scripts/deploy-vps.js` e `scripts/restart-server.js` (que fazem `require('ssh2')`) **não** entram mais na imagem.
- ✅ **Corrigido:** exclui `*.sql` / `*.sql.gz` → um `mysqldump > db.sql` na raiz do checkout não é mais cozido num layer (evita vazar dados do art. 11 LGPD para a imagem).
- ✅ **Corrigido:** exclui `.github/` (reduz ruído no artefato).

### 2.2 `Dockerfile` (17 linhas — **atualizado**)

```dockerfile
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=3000 TZ=America/Sao_Paulo

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
```

**Observações factuais (estado atual):**
- ✅ Ordem de camadas ótima: a camada de `npm ci` só é invalidada quando `package.json`/`package-lock.json` mudam → rebuilds são rápidos.
- ✅ `npm cache clean --force` na **mesma** camada do `npm ci` (economiza dezenas de MB).
- ✅ `CMD` em forma *exec* → sem shell intermediário → `SIGTERM` do `docker stop` chega ao processo Node.
- ✅ `USER node` presente (uid **1000** — confirmado empiricamente, ver §3).
- ✅ **`PERF-01` corrigido:** `COPY --chown=node:node . .` → arquivos passam a ter dono `node` na imagem (antes ficavam com `root`).
- ✅ **`RES-02`/`CICD-02` corrigidos:** `HEALTHCHECK` agora existe e consulta o novo endpoint `/healthz` → habilita `docker compose up --wait` e o smoke test do deploy.
- ✅ **`PERF-02` corrigido (parte):** base subiu de `node:20-alpine` (EOL) para `node:22-alpine`, alinhada ao Node 22 do CI.
- ✅ **`TZ` corrigido:** `TZ=America/Sao_Paulo` via `ENV`, alinhando os logs do app ao MySQL.
- ❌ **Ainda pendente:** pin da imagem base por digest (`node:22-alpine@sha256:...`).
- ⚠️ `npm ci --no-audit --no-fund` omite o gate de vulnerabilidades no build — parcialmente compensável por `npm audit` no CI (ainda **não** presente; ver `CICD-01`).

### 2.3 `docker-compose.yml` (66 linhas — **atualizado**)

```yaml
name: acolher

services:
  db:
    image: mysql:8.4.0
    container_name: acolher-db
    restart: unless-stopped
    command: ["--innodb-buffer-pool-size=256M"]
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      TZ: America/Sao_Paulo
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - acolher-net
    mem_limit: 512m
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD-SHELL", "mysql -h 127.0.0.1 -u\"$$MYSQL_USER\" -p\"$$MYSQL_PASSWORD\" -D \"$$MYSQL_DATABASE\" -e 'SELECT 1' >/dev/null 2>&1"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 60s

  acolher-app:
    build: .
    container_name: acolher-life
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env
    environment:
      DB_HOST: db
      DB_PORT: 3306
      NODE_ENV: production
      TZ: America/Sao_Paulo
    init: true
    mem_limit: 384m
    security_opt:
      - "no-new-privileges:true"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    depends_on:
      db:
        condition: service_healthy
    networks:
      - acolher-net

volumes:
  mysql_data:
    name: acolher_mysql_data

networks:
  acolher-net:
    driver: bridge
```

**Observações factuais (estado atual):**
- ✅ `127.0.0.1:3000:3000` → o app **não** fica exposto diretamente à internet.
- ✅ `db` **sem** `ports` → MySQL acessível apenas dentro da bridge `acolher-net`.
- ✅ `depends_on` com `condition: service_healthy` (melhor que `depends_on` simples).
- ✅ `TZ` no DB → `criado_em` (TIMESTAMP) no fuso de Brasília, coerente com o público brasileiro.
- ✅ **Não há `down -v` em lugar nenhum** do pipeline.
- ✅ **`SEC-01` corrigido:** `env_file: [.env]` substituiu o bind mount `./.env:/app/.env:ro` → o Docker lê o arquivo no start e injeta as variáveis (imune a permissão do uid 1000 e a troca de inode por rename/SFTP).
- ✅ **`PERS-01` corrigido:** `name: acolher` (topo) + `volumes.mysql_data.name: acolher_mysql_data` → o volume deixa de depender do nome do diretório.
- ✅ **`RES-02` corrigido:** healthcheck virou `CMD-SHELL` com `-h 127.0.0.1` (TCP) + `SELECT 1` (valida credenciais, não só o socket) + `start_period: 60s` e `retries: 12`.
- ✅ **`PERF-03` corrigido:** `logging` com rotação (`max-size`/`max-file`), `mem_limit` em ambos os serviços, `init: true` e `security_opt: no-new-privileges`.
- ⚠️ `mysql:8.4.0` ainda **sem pin por digest**.
- ⚠️ **Risco de migração (`PERS-01`):** se o volume em uso na VPS tiver nome diferente (ex.: `ministerio-acolher_mysql_data`), declarar `acolher_mysql_data` aponta para um volume **novo e vazio**. **Rodar `docker volume ls` na VPS ANTES de subir** e, se necessário, renomear/relabelar o volume existente.

### 2.4 `.github/workflows/deploy.yml` (90 linhas — **atualizado**)

```yaml
name: CI/CD — Deploy Acolher.life

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: deploy-acolher-prod
  cancel-in-progress: false

jobs:
  validate:
    name: Validar Sintaxe (CI)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do código
        uses: actions/checkout@v4

      - name: Configurar Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci

      - name: Checagem de sintaxe (node --check)
        run: |
          node --check server.js
          node --check routes/admin.js
          node --check routes/location.js
          node --check middleware/auth.js
          node --check utils/geocode.js

  deploy:
    name: Deploy na VPS via Docker (CD)
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: Acessar VPS e atualizar container
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          command_timeout: 20m
          script_stop: true
          script: |
            set -e
            export GIT_TERMINAL_PROMPT=0
            APP_DIR=/home/acolher/htdocs/acolher.life
            BK_DIR=$APP_DIR/backups
            cd "$APP_DIR"
            
            [ -f .env ] || { echo "ERRO: .env ausente — abortando deploy"; exit 1; }

            # Backup preventivo seguro caso o container do MySQL já esteja ativo
            if docker ps --format '{{.Names}}' | grep -qx acolher-db; then
              mkdir -p "$BK_DIR"
              umask 077
              TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
              docker exec acolher-db sh -c \
                'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
                | gzip > "$BK_DIR/db_pre_deploy_$TIMESTAMP.sql.gz"
              [ -s "$BK_DIR/db_pre_deploy_$TIMESTAMP.sql.gz" ] || { echo "ERRO: backup gerado está vazio — abortando"; exit 1; }
              ls -1t "$BK_DIR"/db_pre_deploy_*.sql.gz | tail -n +11 | xargs -r rm --
            fi

            # Atualiza repositório de forma segura
            git -c safe.directory="$APP_DIR" fetch --prune origin main
            git -c safe.directory="$APP_DIR" reset --hard origin/main

            # Sobe a stack e aguarda os healthchecks
            docker compose up -d --build --remove-orphans

            # Smoke Test HTTP interno antes de desativar o PM2
            echo "Aguardando inicialização da aplicação..."
            curl -fsS --retry 10 --retry-delay 3 http://127.0.0.1:3000/healthz >/dev/null

            # Desativa o processo legado do PM2 somente após o container responder OK
            if command -v pm2 >/dev/null 2>&1 && pm2 describe acolher.life >/dev/null 2>&1; then
              pm2 stop acolher.life && pm2 delete acolher.life && pm2 save
            fi

            # Limpa imagens antigas sem tag
            docker image prune -f
```

**Observações factuais (estado atual):**
- ✅ `needs: validate` (o deploy só ocorre se o `node --check` passar).
- ✅ `set -e` no script remoto **e** `script_stop: true` na action (aborta no primeiro erro).
- ✅ **`CICD-01` corrigido (parte):** `concurrency: deploy-acolher-prod` impede dois deploys simultâneos; `command_timeout: 20m` evita matar o build no meio; `export GIT_TERMINAL_PROMPT=0` evita `git fetch` travado pedindo credenciais; `git -c safe.directory="$APP_DIR"` resolve o erro `dubious ownership`.
- ✅ **`CICD-01` corrigido (parte):** `[ -f .env ] || { ...; exit 1; }` aborta se o `.env` sumir (antes o app subia sem segredos).
- ✅ **`SEC-02` corrigido:** o backup agora usa `MYSQL_PWD` (senha fora do `argv`), `--single-transaction` (dump consistente), `umask 077` (não world-readable), `gzip` (menor), teste `[ -s ]` (aborta em dump vazio) e retenção contando apenas `.sql.gz`.
- ✅ **`CICD-02` corrigido:** o PM2 só é removido **depois** do smoke test `curl .../healthz` responder OK → rollback/continuidade preservados.
- ✅ `docker image prune -f` remove apenas imagens **dangling** → não destrói a imagem em uso.
- ⚠️ **Ainda pendente (`CICD-01`):** actions continuam em **tags mutáveis** (`@v1.0.3`, `@v4`) → risco de supply-chain.
- ⚠️ **Ainda pendente (`CICD-01`):** `validate` só faz checagem de sintaxe — não roda `npm audit`, `hadolint` nem `docker build` (e `npm test` continua placeholder com `exit 1`).
- ⚠️ O `--build` roda **na VPS** (consome CPU/RAM do host que serve o site); migrar o build para o CI + GHCR é otimização futura.

### 2.5 Trechos relevantes de `server.js`

```js
// server.js:1
require('dotenv').config(); // carrega variáveis de ambiente .env
```

```js
// server.js:11-12
app.set('trust proxy', 1); // necessário se estiver atrás de um proxy (ex: Heroku, Nginx)
const PORT = process.env.PORT || 3000;
```

```js
// server.js:19-28
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 4, // 4 horas
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' // exige HTTPS em produção
    }
}));
```

```js
// server.js:31-39
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});
```

```js
// server.js:42-109 (estrutura — ATUALIZADA)
async function inicializarBanco(tentativas = 10) {
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        try {
            const conn = await dbPool.getConnection();
            await conn.query(`CREATE TABLE IF NOT EXISTS cadastros ( ... )`);
            // "migrações" condicionais: checa INFORMATION_SCHEMA e faz ALTER TABLE ADD COLUMN
            conn.release();
            console.log('✅ Banco de dados inicializado com sucesso.');
            return;
        } catch (err) {
            console.error(`❌ Erro ao inicializar banco (tentativa ${tentativa}/${tentativas}):`, err.message);

            // Fail-fast: encerra o processo se o banco não responder após todas as tentativas
            if (tentativa >= tentativas) {
                console.error('❌ Banco de dados indisponível após todas as tentativas. Encerrando o processo.');
                process.exit(1);
            }

            // Backoff exponencial com teto de 15s (1s, 2s, 4s, 8s, 15s, 15s, ...)
            const delay = Math.min(1000 * 2 ** (tentativa - 1), 15000);
            console.log(`⏳ Nova tentativa em ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}

inicializarBanco();                    //  ← disparo único (mas agora com retry + fail-fast)
```

```js
// server.js:306-308 (NOVO)
app.get('/healthz', (req, res) => {
    res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});
```

```js
// server.js:310-312
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌹 Servidor do Ministério Acolher rodando na porta ${PORT}`);
});
```

**Observações factuais (interações importantes — estado atual):**
- ✅ **`dotenv` não sobrescreve variáveis já definidas** (comportamento padrão da lib). Portanto `DB_HOST=db`, `DB_PORT=3306`, `NODE_ENV=production` e `TZ` (do `docker-compose.yml`) e `PORT=3000` (do `ENV` do `Dockerfile`) **vencem** o `.env`. Isso é exatamente o desejado: evita o clássico “app aponta para `127.0.0.1:3306` dentro do container”. **Não mude isso sem entender a consequência.**
- ✅ `trust proxy: 1` está correto com Nginx à frente e é **requisito** para o `cookie.secure` funcionar.
- ✅ `app.listen(PORT)` sem hostname → ouve em `0.0.0.0` dentro do container (necessário para o port-forward funcionar).
- ✅ **`RES-01` corrigido:** `inicializarBanco()` agora faz **retry** (10 tentativas, backoff exponencial 1s→15s) e chama `process.exit(1)` ao esgotar → não fica mais “vivo e inútil” sem schema.
- ✅ **Novo endpoint `GET /healthz`** (`server.js:306`) consumido pelo `HEALTHCHECK` do Dockerfile e pelo smoke test do deploy.
- ⚠️ `createPool` continua **lazy** (não conecta na criação) → o app não crasha se o MySQL estiver fora; a diferença agora é que `inicializarBanco()` faz o gating de boot.
- ⚠️ **Ainda pendente (`SEC-01`, parte opcional):** não há validação fail-fast das variáveis obrigatórias no boot (`if (!process.env.DB_USER) process.exit(1)`). Com o `env_file` o risco caiu bastante, mas a validação explícita continua recomendada.
- ⚠️ **Ainda pendente:** pool sem `timezone: '-03:00'` (app em UTC por padrão, DB em `America/Sao_Paulo`).
- ⚠️ `app.get('/{*path}')` devolve `index.html` para **qualquer** caminho inexistente, inclusive `/api/inexistente` (ruído de diagnóstico, não é vulnerabilidade).

### 2.6 `docker-compose.dev.yml`

```text
(arquivo vazio — 0 bytes / apenas linhas em branco)
```

Continua sem conteúdo, apesar de referenciado na documentação como *dev*. Ver `OPS-02` — recomenda-se **implementar ou remover** para não induzir a erro.

### 2.7 Fatos de documentação cruzada

- [`DEPLOY.md`](DEPLOY.md) documenta: VPS `187.127.39.48`, **usuário SSH `deploy`**, diretório `/home/acolher/htdocs/acolher.life`, PM2 como gerenciador legado, deploy por SFTP do VSCode com `uploadOnSave: true`, e **declara explicitamente que não existe rotina de backup do MySQL** (pendência crítica). Também lista o `.env` de produção como o único repositório de segredos.
- [`relatorio.md`](relatorio.md) confirma: rotas `/admin/*` protegidas por `middleware/auth.js`, endpoint `POST /api/cadastro`, admin autenticado contra `ADMIN_PASSWORD_HASH` com `bcrypt.compare`, e o perfil sensível dos dados coletados.

---

## 3. Evidências empíricas coletadas (comandos e saídas)

> Estas evidências sustentaram a severidade de `SEC-01` **no momento da auditoria** (registro histórico). Foram obtidas **na máquina local**, não na VPS. Após a remediação, o `env_file` tornou a leitura do `.env` imune ao uid 1000 (§2.3), mas a checagem de permissões continua útil.

```console
$ stat -c 'MODO=%A (%a)  UID:GID=%u:%g  DONO=%U:%G' .env
MODO=-rwxr-xr-x (755)  UID:GID=1000:1000  DONO=jmattos:jmattos

$ docker run --rm node:20-alpine id -u node
1000
```

**Interpretação:**
1. O `.env` local tem **bit de execução ligado** e leitura world (755) — má prática que tende a ser reproduzida na VPS.
2. O usuário `node` da imagem tem **uid 1000**. O bind mount `./.env:/app/.env:ro` preserva `uid:gid:modo` do **host**. Logo, a leitura depende inteiramente de o arquivo na VPS ser legível pelo **uid 1000**.
3. No CloudPanel, é comum o site user ter uid/gid fora de 1000 (ex.: 1001+) e arquivos em `0600`/`0640`. Nesse caso, **o `node` não consegue ler o `.env`**.

**O que ficou NÃO verificado (premissas a checar na VPS):**
- uid/gid reais do arquivo `.env` de produção (`stat -c '%a %u:%g' .env` na VPS).
- UID do usuário SSH (`secrets.VPS_USER` — a doc diz `deploy`) e dono do diretório `/home/acolher/htdocs/acolher.life` (a doc sugere `acolher`). Isso decide `CICD-01`.
- Se o usuário SSH pertence ao grupo `docker` (sem isso, `docker ps`/`exec` falham e o `set -e` aborta o deploy).
- Plugin de autenticação do usuário MySQL (8.4 tem `mysql_native_password` desabilitado por padrão; `mysql2@3.x` suporta `caching_sha2_password`, mas vale confirmar via `SELECT user,host,plugin FROM mysql.user;`).
- Configuração exata do proxy no CloudPanel (porta/upstream) para confirmar que a porta 3000 é o único caminho.

---

## 4. Fatos técnicos que o próximo agente DEVE considerar (semântica de plataforma)

Estes pontos são a **causa-raiz** dos achados e não são óbvios:

1. **Bind mount de arquivo é atrelado ao inode.** Ferramentas que escrevem por *write-then-rename* (upload SFTP do VSCode — que é o fluxo recomendado em `DEPLOY.md`, `sed -i`, muitos editores) **trocam o inode**. O container continua lendo o **conteúdo antigo** até ser recriado. Trocar `.env` por `env_file` elimina isso.
2. **`dotenv` não lança exceção** quando o arquivo não pode ser lido (retorna `{ error }`, ignorado em `server.js:1`). Por isso a falha de permissão é **silenciosa**.
3. **Se o arquivo de bind mount não existir no host, o Docker cria um DIRETÓRIO** no lugar. `dotenv` apontando para um diretório → nenhuma variável carregada.
4. **Forma *exec* (`["CMD", ...]`) não tem shell** → `$$VAR` virou `$VAR` literal e é entregue como texto ao binário. Só `CMD-SHELL` expande variáveis.
5. **`mysqladmin ping` retorna 0 mesmo em `Access denied`** (comportamento documentado: o servidor está de pé, só recusou a conexão). Consequência: um healthcheck baseado em `ping` **não valida credenciais** — só “o servidor responde”.
6. **`-h localhost` no cliente MySQL = socket Unix**; `-h 127.0.0.1` = TCP. São caminhos diferentes.
7. **O entrypoint da imagem `mysql` inicia um servidor TEMPORÁRIO** (`--skip-networking`) no **mesmo socket** para criar banco/usuários. Um `ping` via socket pode responder “vivo” nessa fase, **antes** de existir TCP.
8. **`restart: unless-stopped` não respeita ordenação** de `depends_on` em reboot do host/`docker restart`: os containers sobem simultaneamente.
9. **O nome do volume é namespaced pelo nome do projeto Compose**, que por padrão é o **nome do diretório**. `container_name` fixo **não** corrige isso.
10. **`MYSQL_DATABASE`/`MYSQL_USER`/`MYSQL_PASSWORD` só têm efeito na PRIMEIRA inicialização** de um datadir vazio. Trocar a senha no `.env` depois **não** atualiza o usuário no banco → o app para de conectar sem mensagem óbvia.
11. **`docker inspect` mostra variáveis de ambiente em texto puro** — qualquer membro do grupo `docker` lê `MYSQL_ROOT_PASSWORD` e todos os segredos do app.
12. **Sem `pipefail`, um pipeline falho pode passar como sucesso**; com `>` já criado antes de o comando falhar, existe “arquivo vazio de sucesso”.

---

## 5. Achados detalhados (ID, evidência, impacto, correção)

> **Nota de atualização:** os textos abaixo descrevem o **problema original** (pré-correção) e foram mantidos como registro histórico. Cada achado recebeu um selo **Status**; o detalhamento das mudanças aplicadas está em §12.

### 🔴 `SEC-01` — Bind mount do `.env` não garante leitura e falha em silêncio
- **Status:** ✅ **Corrigido (núcleo)** — `env_file: [.env]` substituiu o bind mount. ⚠️ Validação fail-fast das variáveis obrigatórias ainda **não** implementada (opcional).
- **Local (original):** [`docker-compose.yml:30`](docker-compose.yml:30) — hoje em [`docker-compose.yml:38`](docker-compose.yml:38)
- **Evidência:** §3 (uid 1000 × permissões do host) + §4.2/4.3
- **Cenários de falha:**
  - `.env` em `0600` com dono ≠ uid 1000 → `EACCES` → `dotenv` retorna erro ignorado → app sobe com `DB_USER`/`DB_PASSWORD`/`EMAIL_*` indefinidos; `inicializarBanco()` engole a exceção (`server.js:90-92`) → 500 em `/api/cadastro`.
  - `.env` ausente na VPS → Docker cria **diretório** `/app/.env` → zero variáveis.
  - Edição do `.env` via SFTP/VSCode (`uploadOnSave`) → inode trocado → container continua com o **valor antigo** (rotação de credenciais “não pega”).
- **Único fail-fast acidental:** `SESSION_SECRET` indefinido faz `express-session` lançar no boot. Nos outros casos, o app fica “vivo e inútil”.
- **Correção:**
  ```yaml
    acolher-app:
      env_file: [.env]     # substitui: volumes: - ./.env:/app/.env:ro
  ```
  Manter o `.env` na raiz (o Compose ainda o usa para interpolar `${DB_NAME}` etc.). No VPS: `chmod 600 .env` (remover o bit de execução). Opção mais forte: `secrets:` + leitura de `/run/secrets/...` em `server.js:1`.

### 🔴 `RES-01` — `inicializarBanco()` sem retry pode deixar a tabela inexistente
- **Status:** ✅ **Corrigido** — retry (10×, backoff 1s→15s) + `process.exit(1)` ao esgotar (ver §2.5/§6.2).
- **Local (original):** [`server.js:42`](server.js:42) (função), [`server.js:90`](server.js:90) (catch que engole), [`server.js:95`](server.js:95) (disparo único)
- **Mecanismo:** pool *lazy* + disparo único + `catch` que só loga. Se a conexão falhar (DB subindo, restart do host, janela de init do MySQL — §4.7), **as migrações imperativas nunca rodam e nada tenta de novo**.
- **Impacto:** em datadir novo, a tabela `cadastros` nunca é criada; o app responde 500 em `POST /api/cadastro` e vazio/500 em `/admin/api/stats` **parecendo saudável** (HTTP up). Em datadir existente, colunas novas (`pais`, `onde_conheceu`) podem nunca ser adicionadas.
- **Correção:** retry com backoff + `process.exit(1)` após N tentativas (ver §6.2).

### 🔴 `PERS-01` — Volume acoplado ao nome do diretório
- **Status:** ✅ **Corrigido no arquivo** (`name: acolher` + `volumes.mysql_data.name: acolher_mysql_data`). ⚠️ **Ação na VPS obrigatória:** confirmar `docker volume ls` antes de subir, para não apontar para um volume novo/vazio.
- **Local (original):** [`docker-compose.yml:42`](docker-compose.yml:42)
- **Mecanismo:** §4.9. `container_name: acolher-db` (linha 4) **mascara** o problema, dando falsa sensação de estabilidade.
- **Impacto:** renomear o diretório, rodar o Compose de outro `cwd`, entrar por symlink/bind-path ou definir `COMPOSE_PROJECT_NAME` faz o Compose tratar como **outro projeto** → cria `<novo-projeto>_mysql_data` **vazio** → MySQL re-inicializa banco/usuário → a aplicação vê banco vazio e os dados permanecem órfãos no volume antigo. **Sintoma indistinguível de perda total de dados.**
- **Risco secundário:** `docker compose down -v` (comando popular de “limpar tudo”) apaga o volume de fato. Não está no pipeline, mas deve ser documentado como proibido.
- **Correção:** `name: acolher` no topo do arquivo **e** `volumes.mysql_data.name: acolher_mysql_data` (ver §6.1).

### 🔴 `SEC-02` — Backup pré-deploy inseguro e não verificável
- **Status:** ✅ **Corrigido no deploy** — `umask 077`, `MYSQL_PWD`, `--single-transaction`, `gzip`, teste `[ -s ]`, retenção só de `.sql.gz`. ❌ **Pendente:** cron diário + cópia offsite criptografada.
- **Local (original):** [`deploy.yml:51-56`](.github/workflows/deploy.yml:51) — hoje em [`deploy.yml:61-71`](.github/workflows/deploy.yml:61)
- **Problemas (todos no mesmo bloco):**
  1. **Sem verificação de conteúdo**: se o `docker exec` falhar, o `>` já criou o arquivo; um dump vazio/truncado entra na retenção de 10 e **expulsa backups válidos**. Sem `pipefail`, a falha pode passar como sucesso.
  2. **World-readable** (umask padrão do SSH, tipicamente `022` → `644`): dados do art. 11 LGPD legíveis por qualquer usuário da VPS.
  3. **Sem compressão e sem criptografia**.
  4. **Mesmo disco da VPS** e **apenas no deploy** (não protege contra perda do host, corrupção ou exclusão acidental; a própria `DEPLOY.md` admite a ausência de rotina de backup).
  5. **Senha no `argv`**: `-p"$MYSQL_PASSWORD"` fica visível em `docker top acolher-db` / `ps`.
  6. **Dependência de permissão de escrita** em `/home/acolher/backups` pelo usuário SSH (a doc indica `deploy` escrevendo sob `/home/acolher/` — se falhar, `set -e` **aborta o deploy inteiro antes de atualizar o código**).
  7. **Condicional**: se o container `acolher-db` estiver parado, o deploy prossegue **sem backup algum**, com um comentário que transmite falsa segurança.
  8. Dumps **sem `--single-transaction`** → risco de dump inconsistente com o app escrevendo.
- **Correção:** §6.4 (umask 077, `MYSQL_PWD`, `--single-transaction`, `gzip`, teste `-s`, retenção contando só arquivos válidos; cron diário + offsite criptografado).

### 🟠 `RES-02` — Healthcheck valida socket (não TCP) e a senha nunca é expandida
- **Status:** ✅ **Corrigido** — `CMD-SHELL` com `mysql -h 127.0.0.1 ... -e 'SELECT 1'` + `start_period: 60s` + `retries: 12` (ver §2.3).
- **Local (original):** [`docker-compose.yml:17`](docker-compose.yml:17) — hoje em [`docker-compose.yml:25-30`](docker-compose.yml:26)
- **Mecanismo:** §4.4 + §4.5 + §4.6 + §4.7.
- **Resposta direta à pergunta “o Express pode subir antes de o MySQL aceitar TCP?”: SIM, pode.** Três furos: (a) socket ≠ TCP; (b) janela do servidor temporário de init; (c) `restart: unless-stopped` ignora ordenação em reboot.
- **Agravante:** sem `start_period`, num primeiro init mais longo os checks falham e consomem os 10 retries (~50 s) → `docker compose up` aborta com `dependency failed to start: container acolher-db is unhealthy`.
- **Mitigador existente:** o pool é *lazy* → o app **não crasha**. Mas combinado com `RES-01`, o resultado é um processo saudável que não criou o schema.
- **Correção:** §6.3 (`CMD-SHELL` com `mysql -h 127.0.0.1` + `SELECT 1` + `start_period: 60s`).

### 🟠 `CICD-01` — Deploys concorrentes, ownership do git e timeout
- **Status:** ⚠️ **Parcial** — corrigidos `concurrency`, `command_timeout: 20m`, `script_stop`, `GIT_TERMINAL_PROMPT=0`, `safe.directory` e o guarda `[ -f .env ]`. ❌ Pendentes: pin das actions por SHA e os gates do `validate` (`npm audit`/`hadolint`/`docker build`).
- **Local (original):** [`deploy.yml:34-73`](.github/workflows/deploy.yml:34)
- **Armadilhas:**
  1. **Sem `concurrency`** → dois pushes em sequência → duas sessões SSH rodando `git reset --hard` + `docker compose up` no mesmo diretório/nomes fixos → corrida real.
  2. **`git reset --hard` + `dubious ownership`**: se o diretório pertence a outro UID (doc: arquivos de `acolher`, SSH como `deploy`), o git aborta → deploy falha com erro opaco. Checar/resolver com `git -c safe.directory="$APP_DIR"`.
  3. **`git fetch` pode travar** pedindo credenciais sem `GIT_TERMINAL_PROMPT=0`, até estourar o timeout.
  4. **`command_timeout` padrão de 10 min**: `docker compose up --build` com cache frio numa VPS pequena pode ultrapassar → sessão morta no meio do build; o app pode ficar fora do ar.
  5. **Sem verificação pós-deploy** e sem `[ -f .env ]` → pipeline verde com container em crash-loop.
  6. **Actions em tags mutáveis** → supply-chain; a chave SSH de produção é usada sem `command=` restrito no `authorized_keys` e sem GitHub Environment com aprovação.
- **Correção:** §6.5.

### 🟠 `CICD-02` — Remoção do PM2 antes do sucesso do Docker
- **Status:** ✅ **Corrigido** — o smoke test `curl -fsS .../healthz` precede (e protege) a remoção do PM2 (ver §2.4).
- **Local (original):** [`deploy.yml:63-67`](.github/workflows/deploy.yml:63) — hoje o bloco PM2 está em [`deploy.yml:85-87`](.github/workflows/deploy.yml:85)
- **Impacto:** o processo PM2 legado é a única forma de servir o site enquanto os containers não sobem. Deletá-lo antes, e depois falhar o `compose up`, deixa o serviço **fora do ar sem plano B** (o `pm2 save` inclusive zera a lista de processos persistidos). Não há healthcheck pós-deploy para perceber isso.
- **Correção:** mover a remoção do PM2 para **depois** do smoke test HTTP bem-sucedido (ou mantê-la como passo manual separado).

### 🟡 `PERF-01` — `ssh2` em `dependencies` + `scripts/` na imagem
- **Status:** ✅ **Corrigido** — `ssh2` movido para `devDependencies` e `.dockerignore` passou a excluir `scripts/`, `*.sql`, `*.sql.gz`, `.github`.
- **Local (original):** [`package.json:23`](package.json:23) — hoje em [`package.json:26`](package.json:26); [`.dockerignore:1`](.dockerignore:1)
- **Evidência:** `require('ssh2')` aparece **apenas** em [`scripts/deploy-vps.js:16`](scripts/deploy-vps.js:16) e [`scripts/restart-server.js:13`](scripts/restart-server.js:13) (confirmado por busca no repositório). Nenhum caminho de runtime usa `ssh2`.
- **Impacto:** `npm ci --omit=dev` no Alpine instala `ssh2` e suas dependências opcionais com binding nativo (`cpu-features`), tentando compilar durante o build → tempo de build e tamanho de imagem sem contrapartida. Além disso, os scripts de deploy (que já contiveram credenciais no histórico, conforme `DEPLOY.md` §12) ficam copiados dentro da imagem.
- **Correção:** mover `ssh2` para `devDependencies`; adicionar `scripts`, `*.sql`, `*.sql.gz`, `.github` ao `.dockerignore`.

### 🟡 `PERF-02` — Node 20 (EOL) na imagem × Node 22 no CI
- **Status:** ⚠️ **Parcial** — a base já é `node:22-alpine` (alinhada ao CI). ❌ Pendentes: campo `engines` no `package.json` e pin por digest.
- **Local (original):** [`Dockerfile:1`](Dockerfile:1), [`deploy.yml:20`](.github/workflows/deploy.yml:20)
- **Fatos:** Node 20 saiu de suporte em **2026-04-30** (a auditoria é de 2026-10-16 → runtime **sem patches de segurança**). Não há `engines` no `package.json` nem `.nvmrc`. O CI valida o código em Node 22 e publica uma imagem Node 20: o artefato implantado **não é o runtime validado**.
- **Correção:** Node 22 (ou 24 LTS) nos dois lugares; `engines.node`; pin da base por digest.

### 🟡 `PERF-03` — Sem rotação de logs e sem limites de memória
- **Status:** ✅ **Corrigido** — `logging` com rotação, `mem_limit` (db 512m / app 384m), `init: true` e `security_opt: no-new-privileges`.
- **Local (original):** [`docker-compose.yml:2`](docker-compose.yml:2) e seguintes
- **Impacto:** o driver `json-file` cresce indefinidamente com os `console.log` do app → causa mais comum de disco cheio na VPS; e sem `mem_limit` um `mysqld` desgovernado pode acionar o OOM killer e derrubar **outros** serviços do host (incluindo Nginx/CloudPanel).
- **Correção:** §6.6.

### 🟡 `OPS-01` — `MemoryStore` de sessões
- **Status:** ❌ **Aberto** — ainda em uso o `MemoryStore` padrão do `express-session`.
- **Local:** [`server.js:19`](server.js:19)
- **Impacto:** (a) `express-session` avisa que `MemoryStore` não é para produção (vazamento de memória); (b) **todo deploy recria o container do app** → todas as sessões do admin caem → o admin é deslogado a cada release. Isso também inviabiliza qualquer escala horizontal futura.
- **Correção:** `express-mysql-session` reusando o MySQL existente (zero infra nova) ou Redis. Ainda: `sameSite: 'lax'` explícito.

### 🟢 `OPS-02` — Higiene de repositório
- **Status:** ⚠️ **Parcial** — `.dockerignore` corrigido; `docker-compose.dev.yml` continua **vazio**.
- `docker-compose.dev.yml` está **vazio** (0 bytes) — implementar ou remover (evita induzir a erro quem lê a doc). **(ainda pendente)**
- ✅ `.dockerignore` **agora cobre** `scripts/`, `*.sql`, `*.sql.gz`, `.github`.
- O `.env` local com modo `755` (bit de execução) não deve ser reproduzido no servidor.

### 🟢 `SEC-03` — Superfície de abuso no app (fora do escopo de containers)
- **Status:** ❌ **Aberto** — sem `express-rate-limit` e sem lockout.
- `POST /admin/login` sem rate-limit/lockout (brute-force); `POST /api/cadastro` público e sem rate-limit (spam + consumo de cota do Brevo, já que cada cadastro dispara e-mail). Recomendado `express-rate-limit` e bcrypt com custo ≥ 12 para `ADMIN_PASSWORD_HASH`.

---

## 6. Pacote de correções proposto (diffs concretos)

> **Status da aplicação:** os itens §6.1 (`docker-compose.yml`), §6.3 (`Dockerfile`), §6.4 (backup) e §6.5 (workflow) foram **aplicados** ao repositório. Permanecem **não aplicados**: `engines`/pin por digest (`PERF-02`, §6.6 parcial), `timezone` no pool e validação fail-fast (`SEC-01`, §6.2 parcial), `express-mysql-session`/rate-limit (`OPS-01`/`SEC-03`) e o cron/offsite (§6.4 complemento).

### 6.1 `docker-compose.yml` — identidade + `.env` + recursos
```yaml
name: acolher                        # fixa o nome do projeto → nome do volume estável

services:
  db:
    image: mysql:8.4.0               # ideal: pin por digest (mysql:8.4.0@sha256:...)
    container_name: acolher-db
    restart: unless-stopped
    command: ["--innodb-buffer-pool-size=256M"]
    environment:
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      TZ: America/Sao_Paulo
    volumes:
      - mysql_data:/var/lib/mysql
    networks: [acolher-net]
    mem_limit: 512m
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
    healthcheck:
      test: ["CMD-SHELL", "mysql -h 127.0.0.1 -u\"$$MYSQL_USER\" -p\"$$MYSQL_PASSWORD\" -D \"$$MYSQL_DATABASE\" -e 'SELECT 1' >/dev/null 2>&1"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 60s

  acolher-app:
    build: .
    container_name: acolher-life
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    env_file: [.env]                 # ← substitui o bind mount do arquivo
    environment:
      DB_HOST: db
      DB_PORT: 3306
      NODE_ENV: production
      TZ: America/Sao_Paulo
    init: true
    mem_limit: 384m
    security_opt: ["no-new-privileges:true"]
    logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }
    depends_on:
      db:
        condition: service_healthy
    networks: [acolher-net]

volumes:
  mysql_data:
    name: acolher_mysql_data         # ← nome explícito, imune a rename/mudança de cwd

networks:
  acolher-net:
    driver: bridge
```
**Notas obrigatórias:**
- O `.env` continua na raiz (o Compose o usa para interpolar `${DB_NAME}` etc.).
- `env_file` **não** interpola valores internos (sem `$VAR` expansion) — para as chaves do Brevo (`xkeysib-...`) não há impacto.
- `env_file` mantém os segredos visíveis em `docker inspect`; para eliminar isso, migrar para `secrets:` + `/run/secrets/*` no `server.js`.
- `CMD-SHELL` é **essencial**: cria a shell que expande as variáveis do container (corrige §4.4 mantendo o escape `$$` do Compose).
- Alternativa de hardening posterior (app não escreve em disco em runtime): `read_only: true` + `tmpfs: [/tmp]`.

### 6.2 `server.js` — fail-fast + retry
```js
// Após require('dotenv').config(), antes de tudo:
const REQUIRED = ['DB_USER','DB_PASSWORD','DB_NAME','SESSION_SECRET','EMAIL_HOST','EMAIL_USER','EMAIL_PASS'];
const faltantes = REQUIRED.filter(k => !process.env[k]);
if (faltantes.length) {
  console.error('❌ Variáveis de ambiente ausentes:', faltantes.join(', '));
  process.exit(1);                       // falha alto e claro, em vez de 500 silencioso
}
```
```js
async function inicializarBanco(tentativas = 10) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const conn = await dbPool.getConnection();
      try {
        await conn.query(`CREATE TABLE IF NOT EXISTS cadastros ( /* ...inalterado... */ )`);
        for (const [coluna, definicao] of Object.entries(colunasNecessarias)) { /* ...inalterado... */ }
      } finally { conn.release(); }
      console.log('✅ Banco de dados inicializado com sucesso.');
      return;
    } catch (err) {
      console.error(`❌ Banco indisponível (tentativa ${i}/${tentativas}):`, err.message);
      if (i === tentativas) { console.error('Encerrando: banco inacessível.'); process.exit(1); }
      await new Promise(r => setTimeout(r, Math.min(i * 2000, 10000)));
    }
  }
}
inicializarBanco();
```
Ainda no pool (`server.js:31`): adicionar `timezone: '-03:00'` para alinhar o parse de datas com o `TZ` do MySQL.

### 6.3 `Dockerfile` — runtime atualizado + healthcheck
```dockerfile
FROM node:22-alpine                 # ideal: node:22-alpine@sha256:...

WORKDIR /app
ENV NODE_ENV=production PORT=3000 TZ=America/Sao_Paulo

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --chown=node:node . .

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
```
Combina com um novo endpoint trivial no `server.js` (`app.get('/healthz', (_,res)=>res.json({ok:true}))`) e com `docker compose up -d --wait` no deploy.

### 6.4 Bloco de backup endurecido (substitui `deploy.yml:51-56`)
```sh
if docker ps --format '{{.Names}}' | grep -qx acolher-db; then
  mkdir -p "$BK_DIR"; umask 077
  ts=$(date +%Y%m%d_%H%M%S)
  docker exec acolher-db sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" exec mysqldump --single-transaction --no-tablespaces -u"$MYSQL_USER" "$MYSQL_DATABASE"' \
    | gzip > "$BK_DIR/db_pre_deploy_$ts.sql.gz"
  [ -s "$BK_DIR/db_pre_deploy_$ts.sql.gz" ] || { echo "ERRO: backup vazio — abortando"; exit 1; }
  ls -1t "$BK_DIR"/db_pre_deploy_*.sql.gz | tail -n +11 | xargs -r rm --
fi
```
Ganhos: senha fora do `argv` (`MYSQL_PWD`), dump consistente sem lock (`--single-transaction`), não world-readable (`umask 077`), ~80 % menor (`gzip`), falha detectada antes de seguir, retenção contando apenas arquivos válidos. **Complemento obrigatório:** cron/systemd timer diário + cópia **offsite criptografada** (restic/rclone → Backblaze B2/S3), com política de retenção — sem isso, o “backup” não cobre perda do host e continua sendo dado sensível em texto puro.

### 6.5 Workflow endurecido (estrutura)
```yaml
concurrency:                       # impede dois deploys simultâneos
  group: deploy-prod
  cancel-in-progress: false

jobs:
  deploy:
    steps:
      - uses: appleboy/ssh-action@<commit-sha>   # em vez de @v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          command_timeout: 20m                   # evita matar o build no meio
          script_stop: true                      # aborta no 1º erro (equivale ao set -e)
          script: |
            set -e
            export GIT_TERMINAL_PROMPT=0
            APP_DIR=/home/acolher/htdocs/acolher.life
            BK_DIR=$APP_DIR/backups
            cd "$APP_DIR"
            [ -f .env ] || { echo "ERRO: .env ausente — abortando"; exit 1; }

            # ... bloco de backup do §6.4 ...

            git -c safe.directory="$APP_DIR" fetch --prune origin main
            git -c safe.directory="$APP_DIR" reset --hard origin/main

            docker compose up -d --build --remove-orphans
            docker compose ps
            curl -fsS --retry 10 --retry-delay 3 http://127.0.0.1:3000/api/location/countries >/dev/null

            # Só agora remove o legado PM2 (ver CICD-02)
            if command -v pm2 >/dev/null 2>&1 && pm2 describe acolher.life >/dev/null 2>&1; then
              pm2 stop acolher.life && pm2 delete acolher.life && pm2 save
            fi

            docker image prune -f
```
Complementos: no job `validate`, pinar Node 22 **igual ao Dockerfile**, adicionar `npm audit --audit-level=high`, `hadolint` e um `docker build` de verificação; pinar as actions por SHA; proteger `deploy` com GitHub Environment + reviewers; considerar build no CI + push para GHCR + `docker compose pull` na VPS (tira CPU/RAM do host que serve o site e garante que o artefato publicado é o validado).

### 6.6 `.dockerignore` e `package.json`
```dockerignore
# adicionar
scripts
*.sql
*.sql.gz
.github
```
```json
// package.json: mover para devDependencies
"devDependencies": { "nodemon": "^3.1.14", "ssh2": "^1.17.0" }
// e adicionar
"engines": { "node": ">=22 <23" }
```

---

## 7. Critérios de aceite / como PROVAR cada correção

Execute na VPS (ou localmente, conforme indicado) e compare:

| Achado | Comando de verificação | Resultado esperado após a correção |
|---|---|---|
| `SEC-01` | `docker compose exec acolher-app node -e "console.log(Object.keys(process.env).filter(k=>/DB_|EMAIL_|SESSION/.test(k)))"` | Variáveis presentes (vêm do `env_file`). **Antes:** ausentes se `.env` não fosse legível pelo uid 1000 |
| `SEC-01` | `stat -c '%a %U:%G' .env` na VPS | `600` e dono legível pelo Docker (via `env_file` o uid não importa mais) |
| `SEC-01` | editar o `.env` na VPS (trocar um valor de teste) e reiniciar só o app: `docker compose up -d acolher-app` | Novo valor aplicado. **Antes:** o valor antigo persistia (inode travado) |
| `RES-01` | `docker compose stop db && docker compose up -d acolher-app && docker logs -f acolher-life` | Log de retry aparecendo e, se o DB não voltar, `process.exit(1)` (não um processo “vivo e inútil”) |
| `RES-01` | `docker compose exec acolher-db mysql -u"$DB_USER" -p -e "SHOW TABLES" $DB_NAME` | Tabela `cadastros` existe após qualquer ordem de subida |
| `PERS-01` | `docker volume ls \| grep mysql_data` e `docker volume inspect acolher_mysql_data` | Nome fixo `acolher_mysql_data`; `docker compose -p outronome config` não altera o nome do volume declarado |
| `RES-02` | `docker inspect --format '{{json .State.Health}}' acolher-db` e `docker compose up -d` a partir de volume vazio | `start_period` respeitado; sem flapping; `up` não aborta com “dependency failed to start” |
| `CICD-01` | disparar dois pushes seguidos em `main` | O segundo deploy aguarda o primeiro (grupo de concorrência), sem corrida |
| `CICD-02` | forçar falha no `compose up` e verificar `pm2 status` | PM2 **intacto** (e o site continua servido) |
| `SEC-02` | `ls -l /home/acolher/backups/` e `gzip -t *.sql.gz && echo OK` | Arquivos `-rw-------` (0600), `.sql.gz`, válidos; nenhum arquivo 0 byte retido |
| `PERF-01` | `docker run --rm --entrypoint sh acolher-life -c "ls /app/scripts 2>/dev/null; npm ls ssh2"` | Sem `scripts/` e sem `ssh2` na imagem |
| `PERF-02` | `docker compose exec acolher-app node -v` | `v22.x` (igual ao `node_version` do CI) |
| `PERF-03` | `docker inspect --format '{{.HostConfig.LogConfig}}' acolher-db` / `.Memory` | `max-size`/`max-file` configurados e limites de memória aplicados |
| `OPS-01` | login no admin, rodar `docker compose up -d --build` e recarregar `/admin` | Sessão **preservada** (store em MySQL) |
| Geral | `curl -fsS https://acolher.life/api/location/countries \| head -c 100` | 200 com JSON (valida proxy CloudPanel → 3000 intacto) |

---

## 8. Restrições e proibições (não quebrar o que já funciona)

1. **Não alterar a porta 3000 publicada em `127.0.0.1`**: o CloudPanel/Nginx aponta para `127.0.0.1:3000`. Mudar a porta derruba o site com 502.
2. **Não remover `NODE_ENV=production`** do Compose nem do Dockerfile: o `cookie.secure` em `server.js:26` depende disso e, sem HTTPS, a sessão do admin quebra.
3. **Não trocar `app.set('trust proxy', 1)`** por `false`: com `cookie.secure: true` e Nginx à frente, o login para de funcionar.
4. **Não “corrigir” a precedência de env**: `dotenv` deve continuar **não** sobrescrevendo o ambiente do container (`DB_HOST=db` precisa vencer o `.env`).
5. **Nunca executar `docker compose down -v`** neste projeto (destrói `mysql_data`).
6. **Não rodar `docker builder prune` em todo deploy**: destruiria o cache de camadas que hoje torna os rebuilds rápidos (se necessário, `--max-age 168h`).
7. **Não commitar o `.env`** — e garantir que ele permaneça **não versionado** para sobreviver ao `git reset --hard`.
8. **Nunca imprimir/commitar segredos**: ao validar, use apenas nomes-chave de variáveis, nunca valores.
9. **Toda alteração de credencial no `.env` exige atenção ao datadir já inicializado**: `MYSQL_USER`/`MYSQL_PASSWORD` só têm efeito na primeira inicialização (ver §4.10). Rotacionar senha implica `ALTER USER` dentro do MySQL.
10. **Não deletar o PM2 antes de o Docker estar validado** (ver `CICD-02`).

---

## 9. Divergência importante: texto colado ≠ arquivos reais

A solicitação original continha um bloco que **concatenava** o conteúdo de 4 arquivos distintos, com diferenças materiais em relação ao repositório. Um agente que confiar no texto colado vai auditar/corrigir o arquivo errado:

> **Nota:** a coluna *“No repositório real”* abaixo reflete o estado **no momento da auditoria** (pré-remediação). Hoje esses pontos já foram alterados — ver §2 e §12.

| Item | No texto colado | **No repositório real (autoritativo)** |
|---|---|---|
| `.dockerignore` | listava `scripts`, `*.sql` como ignorados | **não** ignora `scripts` nem `*.sql` |
| Node no CI | `node-version: '20'` | `'22'` |
| `deploy.yml` | sem bloco de PM2 | **tem** `pm2 stop/delete/save` (linhas 63-67) |
| `docker-compose.yml` | sem os comentários do autor | tem comentários explicando a montagem do `.env` |

**Regra para o próximo agente:** sempre partir dos arquivos em disco, não do texto de entrada.

---

## 10. Ordem de execução recomendada (plano de ação)

| # | Passo | Achados cobertos | Status |
|---|---|---|---|
| 1 | No VPS: `stat` do `.env`, `whoami`/UID e dono do diretório, `groups` (membro de `docker`?) | pré-requisito | ⏳ verificar na VPS |
| 2 | `env_file` + `chmod 600 .env` + validação fail-fast no `server.js` | `SEC-01` | ✅ `env_file` aplicado · ⚠️ `chmod`/fail-fast pendentes |
| 3 | Retry em `inicializarBanco()` | `RES-01`, `RES-02` (impacto) | ✅ aplicado |
| 4 | `name:`/`volumes.name` no Compose **e** confirmar nome real do volume em uso (`docker volume ls`) | `PERS-01` | ✅ aplicado no arquivo · ⚠️ **validar volume na VPS antes de subir** |
| 5 | Healthcheck `CMD-SHELL` + `start_period` | `RES-02` | ✅ aplicado |
| 6 | Backup endurecido + cron diário + offsite criptografado | `SEC-02` | ✅ backup no deploy · ❌ cron/offsite pendentes |
| 7 | Workflow: `concurrency`, `command_timeout`, `safe.directory`, smoke test, PM2 depois | `CICD-01`, `CICD-02` | ✅ aplicado (exceto pin por SHA e gates de `validate`) |
| 8 | Dockerfile Node 22 + `.dockerignore` + `ssh2` → devDeps + `engines` | `PERF-01`, `PERF-02` | ✅ Node 22/.dockerignore/ssh2 aplicados · ❌ `engines`/digest pendentes |
| 9 | Logs com rotação + `mem_limit` + `TZ` + `timezone` no pool | `PERF-03` | ✅ logs/mem/TZ aplicados · ❌ `timezone` no pool pendente |
| 10 | `express-mysql-session`, rate-limit, `/healthz` + `--wait` | `OPS-01`, `SEC-03` | ✅ `/healthz` aplicado · ❌ `express-mysql-session`/rate-limit pendentes |

---

## 11. Glossário rápido (armadilhas usadas neste documento)

- **Bind mount de arquivo × `env_file`:** o primeiro injeta um inode do host no container (sensível a permissão e a *rename*); o segundo faz o Docker **ler** o arquivo no start e injetar variáveis de ambiente (imune a ambos, mas visível em `docker inspect`).
- **Forma *exec* × `CMD-SHELL`:** sem shell não há expansão de variáveis; `CMD-SHELL` roda `sh -c` dentro do container, onde as variáveis existem.
- **Projeto Compose:** agrupamento lógico que dá prefixo a volumes e redes; o padrão é o **nome do diretório** do arquivo Compose.
- **`mysqladmin ping`:** verifica se o servidor responde, **não** se as credenciais estão corretas (retorna 0 mesmo em `Access denied`).
- **`MYSQL_PWD`:** variável de ambiente lida pelo cliente MySQL — evita expor a senha no `argv` (visível em `ps`/`docker top`).
- **`--single-transaction`:** dump consistente de tabelas InnoDB sem bloquear escritas — correto para um dump com a aplicação no ar.

---

## 12. Registro de remediação (changelog desta atualização)

> Esta seção é o **delta** entre a auditoria original e o estado atual do repositório (2026-10-16).

### 12.1 Arquivos alterados

| Arquivo | Mudança aplicada | Achados |
|---|---|---|
| `.dockerignore` | adicionados `scripts`, `*.sql`, `*.sql.gz`, `.github` | `PERF-01`, `OPS-02` |
| `Dockerfile` | base `node:22-alpine`; `COPY --chown=node:node`; `ENV` unificado com `TZ`; `HEALTHCHECK` em `/healthz` | `PERF-01`, `PERF-02`, `PERF-03`, `RES-02` |
| `docker-compose.yml` | `name: acolher`; `volumes.mysql_data.name`; `env_file` no lugar do bind mount; healthcheck `CMD-SHELL` TCP + `start_period`; `mem_limit`/`logging`/`init`/`security_opt`; `command` innodb buffer pool | `PERS-01`, `SEC-01`, `RES-02`, `PERF-03` |
| `.github/workflows/deploy.yml` | `concurrency`; `command_timeout: 20m`; `script_stop`; `GIT_TERMINAL_PROMPT=0`; `safe.directory`; guarda `[ -f .env ]`; backup endurecido (umask/gzip/`MYSQL_PWD`/`--single-transaction`/`-s`); smoke test `/healthz`; PM2 só após sucesso | `CICD-01`, `CICD-02`, `SEC-02` |
| `server.js` | `inicializarBanco()` com retry (10×, backoff 1s→15s) + `process.exit(1)`; novo endpoint `GET /healthz` | `RES-01` (e suporte a `RES-02`/`CICD-02`) |
| `package.json` | `ssh2` movido para `devDependencies` | `PERF-01` |

### 12.2 Pendências remanescentes (backlog)

| Achado | O que falta |
|---|---|
| `SEC-01` | validação fail-fast das variáveis obrigatórias no boot (`server.js`); opcional migrar para `secrets:` |
| `PERS-01` | **validar na VPS** o nome do volume em uso (`docker volume ls`) antes de subir, para não apontar para volume vazio |
| `SEC-02` | cron/systemd timer **diário** + cópia **offsite criptografada** (restic/rclone) com política de retenção |
| `CICD-01` | pinar actions por **commit SHA**; adicionar `npm audit --audit-level=high`, `hadolint` e `docker build` no job `validate` |
| `PERF-02` | adicionar `"engines": { "node": ">=22 <23" }` ao `package.json`; pin da base e do `mysql` por digest |
| `OPS-01` | trocar `MemoryStore` por `express-mysql-session` (ou Redis); `sameSite: 'lax'` explícito |
| `OPS-02` | implementar ou remover `docker-compose.dev.yml` (segue vazio) |
| `SEC-03` | `express-rate-limit` em `/api/cadastro` e `/admin/login` (+ lockout); bcrypt com custo ≥ 12 |
| Geral | `timezone: '-03:00'` no pool MySQL ([`server.js:31`](server.js:31)); hardening opcional `read_only: true` + `tmpfs: [/tmp]` |
