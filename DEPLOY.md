# Guia de Implantação — Ministério Acolher (DEPLOY.md)

> Guia operacional para publicar e operar o **Ministério Acolher** em produção.
> Documento complementar ao [`workflow.md`](workflow.md) (ciclo de desenvolvimento) e ao [`README.md`](README.md) (setup local).
> **Leia a seção 12 (Segurança) antes de executar qualquer procedimento com os scripts de deploy existentes.**

---

## 1. Visão Geral do Deploy

O projeto é uma aplicação Node.js/Express que serve arquivos estáticos e expõe uma API. **Não há etapa de build/bundle** (frontend usa bibliotecas via CDN). Publicar consiste em:

1. Garantir código testado na branch `main` (ver [`workflow.md`](workflow.md)).
2. Enviar os arquivos do repositório para o diretório da aplicação na VPS.
3. Garantir o `.env` de produção presente no servidor.
4. Reiniciar o processo (PM2) para aplicar as mudanças.
5. Verificar saúde do serviço.

> ⚠️ **Atenção**: não existe CI/CD automatizado e não há procedimento formal de deploy versionado além dos scripts `scripts/deploy-vps.js` e `scripts/restart-server.js` (que contêm credenciais hardcoded — ver seção 12). Os passos abaixo documentam o fluxo atual e o fluxo recomendado.

---

## 2. Arquitetura em Produção

Identificada a partir dos scripts e configurações do repositório:

| Item | Valor identificado | Fonte |
|------|--------------------|-------|
| **VPS (host)** | `187.127.39.48` | `scripts/deploy-vps.js`, `scripts/restart-server.js`, `.vscode/sftp.json` |
| **Usuário SFTP/SSH** | `deploy` (chave privada `/home/jmattos/.ssh/id_ed25519` no Linux) | `.vscode/sftp.json` |
| **Diretório remoto** | `/home/acolher/htdocs/acolher.life/` | `.vscode/sftp.json`, `scripts/deploy-vps.js` |
| **Gerenciador de processos** | **PM2**, processo nomeado `acolher.life` | `scripts/deploy-vps.js`, `scripts/restart-server.js` |
| **Domínio** | `https://acolher.life` | `scripts/restart-server.js`, `README.md`, `main.js` |
| **Porta da aplicação** | `3000` (padrão) via `PORT` no `.env` | `server.js` |
| **Banco de dados** | MySQL (tabela `cadastros` no banco `ministerio_acolher`) | `server.js`, `README.md` |

**Fluxo de requisições assumido:** cliente → domínio `acolher.life` → servidor web/HTTPS (não identificado: nginx/Apache/LiteSpeed) → proxy/porta `3000` → app Node (PM2) → MySQL e serviços externos (SMTP Brevo, Nominatim, CDNs).

> 🔎 **A confirmar**: configuração de TLS/HTTPS (certificado e proxy reverso), firewalld/ufw/security groups, e se o MySQL roda na própria VPS ou em serviço externo.

---

## 3. Pré-requisitos

### 3.1. Para o operador (máquina local)

- **Node.js ≥ 18** (ambiente de teste: v22.23.2) e **npm ≥ 10**.
- **Git** com acesso ao repositório `https://github.com/jmattosinfo/ministerio-acolher`.
- Acesso SSH/SFTP à VPS (ambiente Linux atual):
  - Chave privada em `/home/jmattos/.ssh/id_ed25519` (usada pelo `.vscode/sftp.json` e pelos scripts de deploy).
  - Verificação de conectividade: `ssh deploy@187.127.39.48 "echo CONEXAO_OK"`.
  - Alternativa (fallback): variável `VPS_PASS` para autenticação por senha (ver seção 4.1).

### 3.2. No servidor (VPS)

- **Node.js ≥ 18** instalado.
- **PM2** instalado globalmente (`npm install -g pm2`).
- **MySQL 8.0+ / MariaDB 10.5+** com banco `ministerio_acolher` criado e usuário com permissão.
- Acesso à internet (Nominatim, CDNs, SMTP Brevo).
- Diretório `/home/acolher/htdocs/acolher.life` com permissão de escrita para o usuário `deploy`.

---

## 4. Variáveis de Configuração (`.env`)

O aplicativo lê um arquivo `.env` na raiz (via `dotenv`, em [`server.js`](server.js:1)). **O arquivo `.env` não é versionado** (está no `.gitignore`) e **não existe `.env.example`** no repositório — crie manualmente.

### 4.1. Lista de variáveis

| Variável | Obrigatória | Descrição | Padrão |
|----------|-------------|-----------|--------|
| `PORT` | Não | Porta do servidor | `3000` |
| `NODE_ENV` | Sim* | `production` em produção (ativa cookie de sessão `secure`/HTTPS) | — |
| `DB_HOST` | Não | Host do MySQL | `127.0.0.1` |
| `DB_PORT` | Não | Porta do MySQL | `3306` |
| `DB_USER` | **Sim** | Usuário do MySQL | — |
| `DB_PASSWORD` | **Sim** | Senha do MySQL | — |
| `DB_NAME` | **Sim** | Nome do banco | `ministerio_acolher` |
| `SESSION_SECRET` | **Sim** | Chave secreta das sessões (valor forte e único) | — |
| `EMAIL_HOST` | **Sim** | Host SMTP (ex.: `smtp-relay.brevo.com`) | — |
| `EMAIL_PORT` | Não | Porta SMTP | `587` |
| `EMAIL_USER` | **Sim** | Usuário SMTP (Brevo) | — |
| `EMAIL_PASS` | **Sim** | Senha/chave SMTP (Brevo: `xkeysib-...`) | — |
| `EMAIL_FROM` | Não | Nome/exibição do remetente | `EMAIL_USER` |
| `ADMIN_USERNAME` | **Sim** | Usuário do painel admin | — |
| `ADMIN_PASSWORD_HASH` | **Sim** | Hash bcrypt da senha do admin | — |
| `VPS_HOST` | Não | Host da VPS (usado pelos scripts de deploy) | `187.127.39.48` |
| `VPS_USER` | Não | Usuário SSH/SFTP (usado pelos scripts de deploy) | `deploy` |
| `VPS_PRIVATE_KEY` | Não | Caminho da chave privada SSH (usado pelos scripts de deploy) | `~/.ssh/id_ed25519` |
| `VPS_PASS` | Não | Senha SSH — fallback, se não usar chave (**não versionar**) | — |
| `VPS_DIR` | Não | Diretório remoto da aplicação (usado pelos scripts de deploy) | `/home/acolher/htdocs/acolher.life` |

\* `NODE_ENV=production` é importante porque o cookie de sessão usa `secure: true` nesse caso (ver [`server.js`](server.js:25)) — sem HTTPS, a sessão não funcionará.

### 4.2. Gerar o hash da senha do admin

```bash
node scripts/gerar-hash-senha.js "sua-senha-strong"
# Saída: ADMIN_PASSWORD_HASH=$2a$10$...
```

> **Confirmação necessária**: os valores reais de produção (credenciais MySQL, SMTP, `SESSION_SECRET`, `ADMIN_USERNAME/HASH`) **não constam no repositório** e não foram determináveis. O `.env` de produção deve ser mantido apenas no servidor.

---

## 5. Dependências de Infraestrutura

| Dependência | Papel | Observação |
|-------------|-------|------------|
| **MySQL** | Persistência dos cadastros | Tabela `cadastros` auto-criada na inicialização |
| **SMTP Brevo** | Notificação por e-mail aos profissionais | Host `smtp-relay.brevo.com`, porta 587, auth com chave `xkeysib-...` |
| **Nominatim (OSM)** | Geocoding de cidades (cidade → UF) | Requer acesso HTTPS; uso com `User-Agent` e timeout 4s; cache em memória |
| **country-state-city** | Países, estados e cidades (npm) | Dados locais do pacote |
| **CDNs** | Frontend (Tailwind, Chart.js, Lucide, html2canvas, Google Fonts) | Requer acesso externo no navegador; sem eles a UI degrada |
| **Leaflet tiles** | Mapa do dashboard | Requer acesso externo (README menciona Leaflet; confirmar provedor de tiles) |
| **PM2** | Manutenção do processo Node | Nome do processo: `acolher.life` |

---

## 6. Passos de Build

Não há build de assets. Passos locais antes do deploy:

```bash
# 1. Instala dependências com base no lockfile (garante versões pinadas)
npm install

# 2. Checagem de sintaxe dos módulos
node --check server.js
node --check routes/admin.js
node --check routes/location.js
node --check middleware/auth.js
node --check utils/geocode.js

# 3. Smoke test local (opcional, sem banco real basta subir e validar HTTP)
npm start   # e testar http://localhost:3000/api/location/countries
```

**Regra**: commitar e usar o `package-lock.json` — ele existe e fixa as versões (`lockfileVersion 3`). Rodar `npm install` na VPS para sincronizar `node_modules` se o `package.json` mudou.

---

## 7. Migrações de Banco de Dados

**Não existe ferramenta de migração** (sem Prisma, Sequelize, Knex ou pastas de migrations). O esquema é gerenciado de forma imperativa na inicialização do servidor em [`server.js`](server.js:41) (`inicializarBanco()`):

1. `CREATE TABLE IF NOT EXISTS cadastros (...)` — cria a tabela com todas as colunas atuais.
2. **Auto-migração**: para cada coluna em `colunasNecessarias` (`pais`, `onde_conheceu`), verifica em `INFORMATION_SCHEMA.COLUMNS` e executa `ALTER TABLE cadastros ADD COLUMN` se ausente.

### 7.1. Procedimento ao alterar o schema

- Colunas novas devem ser adicionadas ao `CREATE TABLE` **e** ao mapa `colunasNecessarias` (para tabelas já existentes em produção).
- Após subir a nova versão, conferir o log: `✅ Banco de dados inicializado com sucesso.` / `✅ Coluna "X" adicionada com sucesso.`

### 7.2. Verificação manual em produção

```bash
# Dentro da VPS (como usuário com acesso ao MySQL)
mysql -u "<DB_USER>" -p ministerio_acolher -e "DESCRIBE cadastros;"
mysql -u "<DB_USER>" -p ministerio_acolher -e "SELECT COUNT(*) AS total FROM cadastros;"
```

> ⚠️ **Risco conhecido**: o `ALTER TABLE` roda automaticamente e sem lock controlado. Para tabelas grandes, considere execução planejada em janela de baixo tráfego. **Confirmar** se há necessidade de política formal de migração (ex.: arquivos SQL versionados).

---

## 8. Procedimentos de Deploy por Ambiente

### 8.1. Desenvolvimento local

Ver [`workflow.md`](workflow.md) seção 7 (`npm run dev`). Não é ambiente de deploy.

> 💡 **Banco local**: em ambiente WSL, o MySQL local costuma ser subido via Docker (`docker run -d --name acolher-db -p 3307:3306 ... mysql:8.4.0`) porque a porta 3306 costuma estar ocupada pelo MySQL nativo do Windows — nesse caso usar `DB_PORT=3307` no `.env`. Detalhes no [`README.md`](README.md) (seção 3).

### 8.2. Homologação/Staging

**Não existe** ambiente de homologação identificado (nem branch nem servidor). Produção recebe o conteúdo de `main` diretamente.

> **A confirmar**: se será criado ambiente de staging antes de produção.

### 8.3. Produção — Método 1: SFTP via VSCode (fluxo atual)

O repositório traz `.vscode/sftp.json` com `uploadOnSave: true` e `autoUpload: true`, enviando `**/*` (ignorando `.env`, `.git`, `node_modules`, `.vscode`) para `/home/acolher/htdocs/acolher.life/`.

Passos:
1. Abrir o projeto no VSCode.
2. Garantir o arquivo de chave SSH no caminho indicado em `.vscode/sftp.json` (`privateKeyPath`).
3. Conectar via extensão SFTP (painel de comandos → `SFTP: Sync Remote → Local` ou o botão de status) e salvar os arquivos alterados (auto-upload).
4. Reiniciar o processo (seção 8.5).

**Limitações**: upload automático pode publicar mudanças intermediárias/incompletas; não valida sintaxe antes de enviar. Prefira o Método 2 para releases.

### 8.4. Produção — Método 2: script de deploy (recomendado)

O script [`scripts/deploy-vps.js`](scripts/deploy-vps.js) envia os arquivos do app (`server.js`, `package.json`, `package-lock.json`, `middleware`, `routes`, `utils`, `views`, `public` — **excluindo** `.env`, `node_modules`, `.git`, `.vscode`, `workflow.md` e `scripts`) via SFTP e executa `pm2 restart acolher.life`.

```bash
node scripts/deploy-vps.js
```

- Credenciais/configuração via variáveis de ambiente `VPS_*` (ver seção 4.1); **sem hardcode**.
- O `.env` de produção **não** é enviado — segredos permanecem apenas no servidor.
- Se `package.json` mudou, instalar dependências na VPS depois do deploy (passo 4 da seção 8.6).

### 8.5. Reiniciar o servidor em produção

Reinício manual (recomendado para operações controladas):

```bash
# Conectar na VPS
ssh deploy@187.127.39.48

# Navegar até o diretório da aplicação
cd /home/acolher/htdocs/acolher.life

# Status do processo
pm2 status

# Reiniciar (aplica o código novo)
pm2 restart acolher.life

# Ver logs
pm2 logs acolher.life
```

Alternativa via script: [`scripts/restart-server.js`](scripts/restart-server.js) executa `pm2 restart acolher.life` + `pm2 status` na VPS (configuração via variáveis `VPS_*`, sem hardcode).

```bash
node scripts/restart-server.js
```

### 8.6. Procedimento completo recomendado (release)

1. Em `main`: testes manuais + `node --check` (ver [`workflow.md`](workflow.md) seção 9).
2. Em produção, salvar uma cópia do `.env` atual:
   ```bash
   ssh deploy@187.127.39.48 "cp /home/acolher/htdocs/acolher.life/.env /home/acolher/htdocs/acolher.life/.env.bak.$(date +%F)"
   ```
3. Enviar os arquivos alterados (SFTP/VSCode ou `scp`), **sem sobrescrever `.env`**:
   ```bash
   scp -r server.js middleware routes utils public views package.json package-lock.json deploy@187.127.39.48:/home/acolher/htdocs/acolher.life/
   ```
4. Se `package.json` mudou, instalar dependências na VPS:
   ```bash
   ssh deploy@187.127.39.48 "cd /home/acolher/htdocs/acolher.life && npm install --omit=dev"
   ```
5. Reiniciar e validar (seções 8.5 e 10).

---

## 9. Rollback

### 9.1. Rollback de código

Como não há deploy atômico/tag de artefato, o rollback restaura arquivos de uma versão anterior:

1. Identificar o commit bom: `git log --oneline -10` (ou tags `vX.Y.Z`).
2. Criar revert seguro e publicar de novo (recomendado, mantém histórico):
   ```bash
   git checkout main && git pull origin main
   git revert <COMMIT_RUIM>
   git push origin main
   # reexecutar o deploy (seção 8)
   ```
3. **Rollback imediato/emergencial**: restaurar os arquivos da versão anterior no diretório remoto (ex.: a partir de cópia local anterior ou `git stash`) e `pm2 restart acolher.life`.

> **A confirmar**: não há snapshot/backup automatizado do diretório remoto. Recomenda-se versionar artefatos ou manter `git checkout <tag-anterior>` como fonte de restauração.

### 9.2. Rollback de banco

- **Sem migrations versionadas**: um rollback de schema deve ser feito manualmente (ex.: `ALTER TABLE ... DROP COLUMN`), avaliando impacto nos dados existentes.
- **Dados**: a coluna `criado_em` (TIMESTAMP) permite reconstruir o estado. Para remover registros de teste, há [`scripts/deletar-ultimo-registro.js`](scripts/deletar-ultimo-registro.js) (remove o último registro — **uso cirúrgico, não automatizado**).
- **Backups**: **não identificado** backup automatizado do MySQL. **Pendência crítica a confirmar/implementar**: rotina de `mysqldump` (ver seção 10).

---

## 10. Monitoramento

### 10.1. PM2

```bash
pm2 status                  # estado do processo acolher.life
pm2 logs acolher.life       # logs (stdout/stderr)
pm2 monit                   # CPU/memória em tempo real
```

### 10.2. Health check (sem autenticação)

- Página pública: `curl -I https://acolher.life/` → espera HTTP 200.
- API de localização (exercita o app sem banco): `curl -s https://acolher.life/api/location/countries | head -c 200`.
- Painel: `curl -I https://acolher.life/admin/login` → espera 200.

### 10.3. Banco

```bash
mysql -u "<DB_USER>" -p ministerio_acolher -e "SELECT COUNT(*) FROM cadastros;"
mysql -u "<DB_USER>" -p ministerio_acolher -e "SHOW PROCESSLIST;"
```

### 10.4. E-mail e geocoding

- Testar envio: criar um cadastro de teste e confirmar recebimento no e-mail do profissional (usar [`scripts/deletar-ultimo-registro.js`](scripts/deletar-ultimo-registro.js) para limpar depois).
- Geocoding: verificar logs de falha do Nominatim (a função tem timeout de 4s e fallback para o valor original).

---

## 11. Resolução de Problemas

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Página não abre (502/504) | Processo Node fora do ar | `pm2 status`; se `errored`, `pm2 logs acolher.life` e `pm2 restart acolher.life` |
| Sessão do admin não persiste / login falha | `NODE_ENV=production` com cookie `secure` sem HTTPS; ou `SESSION_SECRET` incorreto | Garantir HTTPS; conferir `.env` |
| Login rejeitado mesmo com senha certa | `ADMIN_PASSWORD_HASH` errado/desatualizado | Regenerar com `node scripts/gerar-hash-senha.js` e atualizar `.env` |
| Erro `Erro de conexão com o banco` no dashboard | Credenciais/host MySQL errados ou MySQL fora do ar | Conferir `DB_*` no `.env` e conectividade |
| E-mail não chega ao profissional | SMTP Brevo sem crédito/chave inválida | Validar `EMAIL_*`; testar envio manual; ver logs |
| Cadastro salvo mas sem UF/cidade | Nominatim indisponível/timeout | O app salva com fallback (`cidade – país`); verificar conectividade e logs |
| Frontend sem estilos/gráficos | CDN bloqueada no cliente/região | Confirmar acesso aos CDNs (Tailwind, Chart.js, Leaflet tiles) |
| Upload automático publicou mudança incompleta | `uploadOnSave` do VSCode | Preferir deploy por release (seção 8.6); restaurar versão anterior |

---

## 12. Segurança — Pendências Conhecidas

**Crítico — precisa de ação:**

1. **Credenciais hardcoded** em [`scripts/deploy-vps.js`](scripts/deploy-vps.js) e [`scripts/restart-server.js`](scripts/restart-server.js): **JÁ CORRIGIDO** — os scripts foram refatorados para usar variáveis de ambiente (`VPS_*`) e autenticação por chave SSH (`~/.ssh/id_ed25519`), sem credenciais em texto puro. **Pendência remanescente**:
   - **Rotacionar** as senhas que estavam expostas no histórico do Git (usuário `root`/senha em `restart-server.js` e o path de chave usado como senha em `deploy-vps.js`).
   - Remover os valores sensíveis do histórico (recomendado: `git filter-repo` ou rotacionar as credenciais e seguir em frente).
2. **`.env` sendo enviado pelo deploy**: **CORRIGIDO** — o novo [`scripts/deploy-vps.js`](scripts/deploy-vps.js) não envia mais o `.env`; segredos de produção são mantidos apenas no servidor.
3. **Backup do banco**: não identificado. Implementar rotina, por exemplo:
   ```bash
   mysqldump -u "<DB_USER>" -p ministerio_acolher > acolher-$(date +%F).sql
   ```
   com retenção e armazenamento fora da VPS.

**Boas práticas a adotar:**

- Nunca commitar `.env` (já no `.gitignore`).
- `SESSION_SECRET` forte e exclusivo por ambiente.
- `NODE_ENV=production` e HTTPS (confirmar configuração do proxy/TLS).
- Atualizar dependências com controle (express 5, mysql2, nodemailer, bcryptjs).

---

## 13. Suposições e Itens a Confirmar

Itens que **não** puderam ser determinados com as fontes disponíveis:

1. **Servidor web/TLS**: como o domínio `acolher.life` é servido (nginx/Apache/LiteSpeed?) e como o HTTPS/certificado é gerenciado; se há proxy para a porta `3000`.
2. **MySQL em produção**: se roda na própria VPS, credenciais reais, e política de backup/restore.
3. **PM2 em produção**: se há `ecosystem.config.js`, política de startup (`pm2 startup`/`pm2 save`) e versão do Node na VPS.
4. **Credenciais reais de produção** (DB, SMTP, admin): devem ser obtidas com o mantenedor e mantidas apenas no `.env` do servidor.
5. **Homologação/Staging**: inexistente; confirmar se será criado.
6. **Policy de deploy**: quem pode publicar e se haverá CI/CD (GitHub Actions) no futuro.
7. **Provedor de tiles do Leaflet** no dashboard (identificado apenas o uso de Leaflet no README; confirmar URL/tiles).

---

## 14. Checklist Operacional de Deploy

- [ ] `main` atualizada e testada (testes manuais da seção 9 do [`workflow.md`](workflow.md)).
- [ ] `node --check` limpo nos módulos alterados.
- [ ] Backup do `.env` remoto feito (seção 8.6).
- [ ] Arquivos enviados para `/home/acolher/htdocs/acolher.life` **sem sobrescrever `.env`**.
- [ ] (Se `package.json` mudou) `npm install` na VPS.
- [ ] `pm2 restart acolher.life`.
- [ ] Health checks da seção 10.2 (página, API, painel).
- [ ] Teste real do fluxo de cadastro (se aplicável à release).
- [ ] Logs verificados (`pm2 logs acolher.life`).
