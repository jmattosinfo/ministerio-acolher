# Guia de Implantação — Ministério Acolher (DEPLOY.md)

> Guia operacional para publicar e operar o **Ministério Acolher** (`acolher.life`) em produção.
> Documento complementar ao [`README.md`](README.md) (setup local) e ao [`contexto.md`](contexto.md) (contexto geral do projeto).
> **A implantação é 100% automatizada via GitHub Actions + Docker Compose. O deploy manual por PM2/SFTP foi aposentado** — ver seções 8 e 15.

---

## 1. Visão Geral do Deploy

O projeto é uma aplicação **Node.js/Express** empacotada em **Docker** e orquestrada por **Docker Compose** na VPS. **Não há etapa de build/bundle de frontend** (as bibliotecas são consumidas via CDN).

A publicação é realizada por um pipeline de **CI/CD no GitHub Actions** (`.github/workflows/deploy.yml`), disparado a cada push na branch `main`:

1. **CI (job `validate`)** — `npm ci`, checagem de sintaxe (`node --check`) dos módulos principais.
2. **CD (job `deploy`)** — acesso SSH à VPS, backup preventivo do banco, atualização do repositório (`git reset --hard origin/main`), reconstrução e subida dos containers (`docker compose up -d --build`), smoke test de saúde e limpeza.

> ℹ️ **Não existe mais deploy manual** por SFTP/VSCode nem gerenciamento de processo por **PM2**. Os scripts legados [`scripts/deploy-vps.js`](scripts/deploy-vps.js) e [`scripts/restart-server.js`](scripts/restart-server.js) permanecem no repositório apenas como histórico e **não devem ser utilizados**.

---

## 2. Arquitetura em Produção

A stack de produção é definida em [`docker-compose.yml`](docker-compose.yml) (projeto Compose `acolher`) e composta por **dois containers**:

| Container | Imagem | Porta | Papel |
|-----------|--------|-------|-------|
| `acolher-db` | `mysql:8.4.0` | **sem porta publicada** | Banco MySQL 8.4, acessível apenas na rede interna |
| `acolher-life` | build local (ver [`Dockerfile`](Dockerfile)) | **`127.0.0.1:3000`** | Aplicação Node.js 22 (Alpine) |

| Item | Valor | Fonte |
|------|-------|-------|
| **VPS (host)** | `187.127.39.48` | secrets do GitHub Actions / configuração da VPS |
| **Diretório da aplicação** | `/home/acolher/htdocs/acolher.life` | `.github/workflows/deploy.yml` |
| **Diretório de backups** | `/home/acolher/htdocs/acolher.life/backups` | `.github/workflows/deploy.yml` |
| **Domínio** | `https://acolher.life` | proxy reverso (CloudPanel/Nginx) → `127.0.0.1:3000` |
| **Rede interna** | `acolher-net` (bridge) | `docker-compose.yml` |
| **Volume do banco** | `acolher_mysql_data` | `docker-compose.yml` |
| **Gerenciador de containers** | Docker Compose v2 | `.github/workflows/deploy.yml` |

**Fluxo de requisições:** cliente → `https://acolher.life` → proxy reverso/TLS (CloudPanel/Nginx) → `127.0.0.1:3000` → container `acolher-life` → container `acolher-db` (MySQL) + serviços externos (SMTP Brevo, Nominatim, CDNs).

> 🔒 O container da aplicação **não** é exposto diretamente à internet: a porta é publicada apenas em **loopback** (`127.0.0.1:3000`). O MySQL **não** publica porta alguma.

---

## 3. Pré-requisitos

### 3.1. Na VPS

- **Docker Engine** 24+ e **Docker Compose v2** (`docker compose`).
- **Git** com acesso (pull) ao repositório `https://github.com/jmattosinfo/ministerio-acolher`.
- Usuário SSH pertencente ao grupo `docker` (necessário para `docker ps`/`exec`), com permissão de escrita no diretório da aplicação e em `backups/`.
- Diretório `/home/acolher/htdocs/acolher.life` já clonado do repositório.
- Arquivo `.env` de produção presente no diretório da aplicação (**não versionado** — sobrevive ao `git reset --hard`).
- Proxy reverso (CloudPanel/Nginx) configurado para `https://acolher.life` → `127.0.0.1:3000`.

### 3.2. Secrets no GitHub

O workflow consome os seguintes **repository secrets** (`Settings → Secrets and variables → Actions`):

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `VPS_HOST` | **Sim** | Endereço da VPS (`187.127.39.48`) |
| `VPS_USER` | **Sim** | Usuário SSH (membro do grupo `docker`) |
| `VPS_SSH_KEY` | **Sim** | Chave privada SSH para autenticação |
| `VPS_PORT` | Não | Porta SSH (padrão `22`) |

> 🔑 A chave privada (`VPS_SSH_KEY`) deve corresponder a uma chave pública autorizada em `~/.ssh/authorized_keys` do usuário SSH. Recomenda-se restringir o comando autorizado (opção `command=`) e proteger o job `deploy` com um **GitHub Environment** com revisores.

### 3.3. Na máquina do operador

- **Git** com acesso ao repositório.
- Acesso SSH à VPS para operações manuais de diagnóstico (opcional): `ssh deploy@187.127.39.48`.

---

## 4. Variáveis de Configuração (`.env` de produção)

O arquivo `.env` **não é versionado** (está no [`.gitignore`](.gitignore)) e **não deve ser enviado por deploy** — ele reside exclusivamente na VPS, em `/home/acolher/htdocs/acolher.life/.env`. O workflow **aborta** o deploy caso o arquivo não exista.

O modelo versionado é o [`.env.example`](.env.example) (uso em desenvolvimento).

### 4.1. Lista de variáveis

| Variável | Obrigatória | Descrição | Padrão |
|----------|-------------|-----------|--------|
| `PORT` | Não | Porta do servidor | `3000` |
| `NODE_ENV` | Sim | `production` em produção (forçado pelo Compose) | — |
| `DB_HOST` | Não | Host do MySQL (forçado para `db` pelo Compose) | `db` |
| `DB_PORT` | Não | Porta do MySQL (forçada para `3306` pelo Compose) | `3306` |
| `DB_USER` | **Sim** | Usuário do MySQL | — |
| `DB_PASSWORD` | **Sim** | Senha do MySQL | — |
| `DB_NAME` | **Sim** | Nome do banco | `ministerio_acolher` |
| `DB_ROOT_PASSWORD` | **Sim** | Senha root do MySQL (usada pelo container `acolher-db`) | — |
| `SESSION_SECRET` | **Sim** | Chave secreta das sessões (valor forte e único) | — |
| `EMAIL_HOST` | **Sim** | Host SMTP (ex.: `smtp-relay.brevo.com`) | — |
| `EMAIL_PORT` | Não | Porta SMTP | `587` |
| `EMAIL_USER` | **Sim** | Usuário SMTP (Brevo) | — |
| `EMAIL_PASS` | **Sim** | Senha/chave SMTP (Brevo: `xkeysib-...`) | — |
| `EMAIL_FROM` | Não | Nome/exibição do remetente | `EMAIL_USER` |

> 🔐 **Autenticação unificada:** `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` foram descontinuadas. O login consulta a tabela `acolhedores` (e-mail + `senha_hash`). Crie o admin com `node scripts/criar-admin-inicial.js "Nome" "email" "senha"` dentro da aplicação já com o banco acessível.

> `NODE_ENV=production` é importante porque o cookie de sessão usa `secure: true` nesse caso — sem HTTPS, a sessão não funcionará.

### 4.2. Criar o administrador inicial

```bash
# Com o container da aplicação no ar e o banco acessível:
docker compose -f docker-compose.yml exec acolher-app \
  node scripts/criar-admin-inicial.js "Nome do Admin" "admin@acolher.life" "SuaSenhaForte"
```

> Também é possível rodar o script localmente apontando o `.env` para o MySQL de produção. O script cria o registro na tabela `acolhedores` com `perfil='admin'` e senha hasheada com bcrypt. Os demais membros da equipe são convidados pelo painel e definem a senha no primeiro acesso; o fluxo **“Esqueci minha senha”** envia um link válido por 2 horas.

### 4.3. Regra obrigatória das aspas simples

O Docker Compose interpreta o caractere `$` como início de **interpolação de variável** ao processar o `.env`. Qualquer valor que contenha `$` (senhas de banco, chaves SMTP) **deve** ser envolvido por **aspas simples**:

```env
# CORRETO
DB_PASSWORD='S3nh@Com$Cifrao'

# INCORRETO — o Compose tentará interpolar o trecho após '$' e corromperá o valor
DB_PASSWORD=S3nh@Com$Cifrao
```

> 🔐 Os valores reais de produção (credenciais MySQL, SMTP, `SESSION_SECRET`) **não constam no repositório** e devem ser mantidos apenas no `.env` da VPS. As credenciais de acesso ao painel ficam na tabela `acolhedores` (hash bcrypt), nunca em texto puro.

---

## 5. Dependências de Infraestrutura

| Dependência | Papel | Observação |
|-------------|-------|------------|
| **MySQL 8.4** (container `acolher-db`) | Persistência dos cadastros | Tabela `cadastros` auto-criada na inicialização; dados no volume `acolher_mysql_data` |
| **SMTP Brevo** | Notificação por e-mail aos profissionais | Host `smtp-relay.brevo.com`, porta 587, chave `xkeysib-...` |
| **Nominatim (OSM)** | Geocoding de cidades (cidade → UF) | Requer acesso HTTPS; `User-Agent` e timeout de 4s; cache em memória |
| **country-state-city** | Países, estados e cidades (npm) | Dados locais do pacote |
| **CDNs** | Frontend (Tailwind, Chart.js, Lucide, html2canvas, Google Fonts) | Requer acesso externo no navegador; sem eles a UI degrada |
| **Leaflet tiles** | Mapa do dashboard | Requer acesso externo |
| **Docker Compose** | Orquestração dos containers | Substitui o antigo PM2 |

---

## 6. Build da Imagem

O build é executado **na própria VPS** pelo `docker compose up -d --build` (durante o CD). Definição em [`Dockerfile`](Dockerfile):

- Base `node:22-alpine` (runtime validado no CI).
- `npm ci --omit=dev` para instalar apenas dependências de produção (o `scripts/` e o `ssh2` ficam fora da imagem — ver [`.dockerignore`](.dockerignore)).
- Usuário não-root (`node`), `EXPOSE 3000`.
- `HEALTHCHECK` consultando o endpoint `GET /healthz`.
- `CMD ["node", "server.js"]` (forma *exec*, garante o recebimento de `SIGTERM`).

Passos locais de verificação **antes** do push (executados automaticamente pelo CI):

```bash
npm ci
node --check server.js
node --check routes/admin.js
node --check routes/location.js
node --check middleware/auth.js
node --check utils/geocode.js
```

---

## 7. Migrações de Banco de Dados

**Não existe ferramenta de migração** (sem Prisma, Sequelize, Knex ou pastas de migrations). O esquema é gerenciado imperativamente na inicialização do servidor em [`server.js`](server.js) (`inicializarBanco()`):

1. `CREATE TABLE IF NOT EXISTS cadastros (...)` — cria a tabela com todas as colunas atuais.
2. **Auto-migração**: para cada coluna em `colunasNecessarias` (ex.: `pais`, `onde_conheceu`), verifica em `INFORMATION_SCHEMA.COLUMNS` e executa `ALTER TABLE cadastros ADD COLUMN` se ausente.
3. A rotina possui **retry com backoff exponencial** e encerra o processo (`process.exit(1)`) caso o banco permaneça inacessível — evitando um container "saudável" sem schema.

### 7.1. Procedimento ao alterar o schema

- Colunas novas devem ser adicionadas ao `CREATE TABLE` **e** ao mapa `colunasNecessarias`.
- Após o deploy, conferir o log: `docker compose logs acolher-app | grep "Banco de dados"`.

### 7.2. Verificação manual em produção

```bash
cd /home/acolher/htdocs/acolher.life
docker compose exec acolher-db \
  mysql -u"$DB_USER" -p"$DB_PASSWORD" ministerio_acolher -e "DESCRIBE cadastros;"
```

> ⚠️ **Risco conhecido**: o `ALTER TABLE` roda automaticamente e sem lock controlado. Para tabelas grandes, considere execução planejada em janela de baixo tráfego.

---

## 8. Pipeline de Deploy (GitHub Actions)

Definido em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Dispara em **push na branch `main`** ou manualmente (`workflow_dispatch`). O bloco `concurrency` (`group: deploy-acolher-prod`) garante que **dois deploys jamais rodem em paralelo**.

### 8.1. Estágio de validação (CI)

| Passo | Comando |
|-------|---------|
| Checkout do código | `actions/checkout@v4` |
| Node.js 22 + cache npm | `actions/setup-node@v4` |
| Instalação | `npm ci` |
| Checagem de sintaxe | `node --check` (server.js, routes/admin.js, routes/location.js, middleware/auth.js, utils/geocode.js) |

### 8.2. Estágio de deploy (CD)

Executado via `appleboy/ssh-action` (`needs: validate`, `command_timeout: 20m`, `script_stop: true`) na VPS. Script remoto (`set -e`):

1. **Validação de pré-condições**: define `APP_DIR` e `BK_DIR`; **aborta** se o `.env` não existir.
2. **Backup preventivo** (se o container `acolher-db` estiver ativo) — detalhado na seção 10.
3. **Atualização do repositório**:
   ```bash
   git -c safe.directory="$APP_DIR" fetch --prune origin main
   git -c safe.directory="$APP_DIR" reset --hard origin/main
   ```
4. **Reconstrução e subida da stack**:
   ```bash
   docker compose up -d --build --remove-orphans
   ```
5. **Smoke test de saúde** (aguarda o app responder antes de encerrar o legado):
   ```bash
   curl -fsS --retry 10 --retry-delay 3 --retry-all-errors http://127.0.0.1:3000/healthz
   ```
6. **Desativação do legado PM2** (apenas se ainda existir, e **somente após** o smoke test passar):
   ```bash
   pm2 stop acolher.life && pm2 delete acolher.life && pm2 save
   ```
7. **Limpeza**: `docker image prune -f` (remove apenas imagens *dangling*).

> ✅ A ordem é intencional: o PM2 legado (única forma de servir o site antes dos containers) só é removido **depois** de o container responder OK. Isso preserva a continuidade do serviço em caso de falha do build.

---

## 9. Persistência: Volume `acolher_mysql_data`

Os dados do banco residem em um **volume Docker nomeado e persistente**:

```yaml
volumes:
  mysql_data:
    name: acolher_mysql_data
```

O nome é **declarado explicitamente** (`name:`) e o projeto Compose tem `name: acolher` — ou seja, o volume **não** depende do nome do diretório nem do `COMPOSE_PROJECT_NAME`. Isso evita que uma mudança de diretório/cwd crie um volume novo e vazio (perda aparente de dados).

Inspeção e cuidados:

```bash
docker volume ls | grep acolher_mysql_data
docker volume inspect acolher_mysql_data
```

> 🚫 **NUNCA** execute `docker compose down -v` neste projeto — a flag `-v` **remove o volume** e apaga todos os dados do banco.
> ⚠️ Ao migrar de uma instalação antiga, confirme com `docker volume ls` o nome real do volume em uso **antes** de subir a stack, para não apontar para um volume novo/vazio.

---

## 10. Rotina de Backup Automática (gzip)

A cada deploy (antes de atualizar o código), o workflow executa um **backup preventivo do banco**, armazenado no diretório `backups/` (dentro do `APP_DIR`):

```bash
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
```

**Características da rotina:**

| Aspecto | Implementação |
|---------|---------------|
| **Nome do arquivo** | `db_pre_deploy_YYYYMMDD_HHMMSS.sql.gz` |
| **Compressão** | `gzip` (reduz significativamente o tamanho do dump) |
| **Consistência** | `mysqldump --single-transaction --no-tablespaces` (dump consistente sem bloquear escritas) |
| **Segurança da senha** | uso de `MYSQL_PWD` (a senha **não** aparece em `ps`/`docker top`) |
| **Permissões** | `umask 077` → arquivos `0600` (não legíveis por outros usuários) |
| **Verificação** | `[ -s ... ]` aborta o deploy se o dump sair vazio/truncado |
| **Retenção** | mantém os **10 backups mais recentes** (`tail -n +11` remove os excedentes) |

> ⚠️ Os backups residem **no mesmo disco da VPS** e são gerados **apenas no deploy**. Recomenda-se complementar com um **cron/systemd timer diário** e uma cópia **offsite criptografada** (ex.: restic/rclone → S3/Backblaze B2), dada a natureza sensível dos dados (LGPD, art. 11).

### 10.1. Verificação manual dos backups

```bash
cd /home/acolher/htdocs/acolher.life
ls -lh backups/
gzip -t backups/db_pre_deploy_*.sql.gz && echo "Backups íntegros"
```

---

## 11. Operação do Dia a Dia

Comandos operacionais padrão (executar em `/home/acolher/htdocs/acolher.life`):

```bash
# Estado dos containers
docker compose ps

# Logs da aplicação / do banco (acompanhar em tempo real)
docker compose logs -f acolher-app
docker compose logs -f acolher-db

# Reiniciar apenas a aplicação (aplica o código já presente na VPS)
docker compose restart acolher-app

# Reconstruir e subir a stack (equivalente ao que o CI/CD faz)
docker compose up -d --build --remove-orphans

# Encerrar os containers (os dados do volume são preservados)
docker compose down
```

---

## 12. Rollback

### 12.1. Rollback de código

Como o deploy usa `git reset --hard origin/main`, o rollback é feito revertendo o commit problemático e publicando novamente:

1. Identificar o commit bom: `git log --oneline -10` (ou tags `vX.Y.Z`).
2. Criar um revert seguro e publicar (mantém histórico):
   ```bash
   git checkout main && git pull origin main
   git revert <COMMIT_RUIM>
   git push origin main
   # o pipeline de CI/CD assume a publicação automaticamente
   ```
3. **Emergência** (sem novo pipeline): na VPS, restaurar o commit anterior e reconstruir:
   ```bash
   cd /home/acolher/htdocs/acolher.life
   git -c safe.directory="$PWD" reset --hard <COMMIT_ANTERIOR>
   docker compose up -d --build --remove-orphans
   ```

### 12.2. Rollback de banco

- **Sem migrations versionadas**: um rollback de schema é manual (ex.: `ALTER TABLE ... DROP COLUMN`), avaliando o impacto nos dados.
- **Dados**: para restaurar um backup, descomprimir e importar dentro do container:
  ```bash
  gunzip -c backups/db_pre_deploy_<TIMESTAMP>.sql.gz | \
    docker compose exec -T acolher-db mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
  ```
- **Remoção de registro de teste**: [`scripts/deletar-ultimo-registro.js`](scripts/deletar-ultimo-registro.js) (uso cirúrgico, não automatizado).

---

## 13. Monitoramento e Health Check

### 13.1. Containers

```bash
docker compose ps
docker inspect --format '{{json .State.Health}}' acolher-life
docker stats --no-stream
```

### 13.2. Health check (sem autenticação)

- Endpoint interno (usado pelo `HEALTHCHECK` e pelo smoke test do deploy):
  ```bash
  curl -fsS http://127.0.0.1:3000/healthz   # → {"ok":true,"timestamp":"..."}
  ```
- Página pública: `curl -I https://acolher.life/` → espera HTTP 200.
- API de localização: `curl -s https://acolher.life/api/location/countries | head -c 200`.
- Painel: `curl -I https://acolher.life/admin/login` → espera 200.

### 13.3. Banco

```bash
docker compose exec acolher-db \
  mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM cadastros;"
```

### 13.4. E-mail e geocoding

- Testar envio: criar um cadastro de teste e confirmar o recebimento no e-mail do profissional (usar o script de deleção para limpar depois).
- Geocoding: verificar falhas do Nominatim nos logs (timeout de 4s com fallback para o valor original).

---

## 14. Resolução de Problemas

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Site fora do ar (502/504) | Container `acolher-life` parado ou unhealthy | `docker compose ps`; `docker compose logs acolher-app`; `docker compose up -d --build` |
| Deploy aborta com "`.env` ausente" | `.env` removido na VPS | Recriar o `.env` em `APP_DIR` (nunca versionar) |
| Login do admin falha mesmo com senha correta | `ADMIN_PASSWORD_HASH` corrompido por falta de aspas simples | Regerar o hash e reescrever a linha **entre aspas simples** |
| Sessão do admin não persiste / login falha | `NODE_ENV=production` sem HTTPS, ou `SESSION_SECRET` incorreto | Garantir o proxy HTTPS; revisar o `.env` |
| Erro "conexão com o banco" no dashboard | Credenciais/host MySQL errados ou `acolher-db` fora do ar | Conferir `DB_*` no `.env`; `docker compose logs acolher-db` |
| Container sobe "saudável" mas responde 500 | Schema ausente (ver seção 7) | Conferir log de `inicializarBanco()`; validar a conexão com o banco |
| E-mail não chega ao profissional | SMTP Brevo sem crédito/chave inválida | Validar `EMAIL_*`; testar envio; ver logs |
| Cadastro salvo sem UF/cidade | Nominatim indisponível/timeout | Fallback aplicado; verificar conectividade e logs |
| Dados "desaparecem" após mudança de diretório | Volume apontando para nome errado | `docker volume ls`; garantir `acolher_mysql_data` (seção 9) |
| Frontend sem estilos/gráficos | CDN bloqueada no cliente | Confirmar acesso aos CDNs |

---

## 15. Segurança

**Controles já implementados:**

- **`.env` fora da imagem e do repositório**: passado ao container via `env_file`, mantido apenas na VPS (sobrevive ao `git reset --hard`).
- **Deploy automatizado e auditável** via GitHub Actions, sem credenciais hardcoded no repositório.
- **Banco não exposto**: MySQL sem porta publicada; app acessível apenas em `127.0.0.1:3000`.
- **Backup seguro**: `umask 077` (0600), compressão `gzip`, senha via `MYSQL_PWD`, verificação de conteúdo e retenção controlada.
- **Container endurecido**: usuário não-root, `mem_limit`, `init: true`, `security_opt: no-new-privileges`, rotação de logs (`json-file` `max-size`/`max-file`).
- **Imagem enxuta**: `scripts/` (deploy) e `ssh2` não entram na imagem de produção.

**Pendências recomendadas:**

1. Rotacionar quaisquer credenciais que tenham estado expostas no **histórico do Git** (usuário/senha em scripts legados de deploy).
2. Pinar as GitHub Actions por **commit SHA** (em vez de tags mutáveis) e proteger o job `deploy` com **GitHub Environment** + revisores.
3. Complementar o backup com **cron diário + cópia offsite criptografada**.
4. Adicionar **rate limiting** (`express-rate-limit`) em `/api/cadastro` e `/admin/login`, e headers de segurança (`helmet`).
5. Pinar as imagens (`node:22-alpine`, `mysql:8.4.0`) por **digest**.

> Referência detalhada de achados e remediações: [`AUDITORIA-CONTEINERIZACAO.md`](AUDITORIA-CONTEINERIZACAO.md).

---

## 16. Checklist Operacional de Deploy

**Antes do push (desenvolvedor):**

- [ ] `npm ci` executa sem erros.
- [ ] `node --check` limpo nos módulos alterados.
- [ ] `.env.example` atualizado, se novas variáveis foram introduzidas.

**Publicação (automática):**

- [ ] Push na branch `main` dispara o workflow `CI/CD — Deploy Acolher.life`.
- [ ] Job `validate` (CI) concluído com sucesso.
- [ ] Job `deploy` (CD) concluído com sucesso.
- [ ] Backup `db_pre_deploy_*.sql.gz` gerado em `backups/`.
- [ ] Smoke test `GET /healthz` retornou OK.
- [ ] PM2 legado removido (apenas na primeira execução do novo modelo).

**Verificação pós-deploy:**

- [ ] `docker compose ps` — containers `Up`/`healthy`.
- [ ] Health checks da seção 13.2 (página, API, painel).
- [ ] Fluxo real de cadastro testado (se aplicável à release).
- [ ] Logs verificados: `docker compose logs --tail=100 acolher-app`.
