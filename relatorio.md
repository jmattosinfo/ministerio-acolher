# 📋 Relatório de Análise Técnica — Ministério Acolher

> **Data da Análise:** 28 de Agosto de 2026
> **Escopo:** Análise completa da arquitetura, backend, frontend, banco de dados, geolocalização, segurança, internacionalização (i18n), infraestrutura e devops.
> **Atualização (16/10/2026):** a infraestrutura e o deploy foram migrados para **Docker Compose + CI/CD (GitHub Actions)** na VPS; o modelo manual via **PM2/SFTP foi aposentado**. As seções 2 e 8 refletem o novo modelo.

---

## 📑 Sumário

1. [Visão Geral e Propósito](#1-visão-geral-e-propósito)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Análise Detalhada do Backend](#3-análise-detalhada-do-backend)
4. [Análise Detalhada do Frontend](#4-análise-detalhada-do-frontend)
5. [Banco de Dados e Persistência](#5-banco-de-dados-e-persistência)
6. [Integrações e Serviços Externos](#6-integrações-e-serviços-externos)
7. [Segurança, Privacidade e LGPD](#7-segurança-privacidade-e-lgpd)
8. [Automação, Conteinerização e Deploy (CI/CD)](#8-automação-conteinerização-e-deploy-cicd)
9. [Pontos Fortes do Projeto](#9-pontos-fortes-do-projeto)
10. [Oportunidades de Melhoria e Recomendações](#10-oportunidades-de-melhoria-e-recomendações)

---

## 1. Visão Geral e Propósito

O **Ministério Acolher** é uma plataforma web voltada ao atendimento e acolhimento emocional e espiritual, 100% gratuito, sigiloso e online. A plataforma destina-se a pessoas maiores de 18 anos em situação de vulnerabilidade emocional decorrente de:
- Violência doméstica no relacionamento conjugal;
- Divórcio ou processos de separação;
- Abuso sexual fora do contexto conjugal.

### Lógica de Triagem e Atendimento
A plataforma não realiza atendimento clínico (psicológico/psiquiátrico) nem jurídico, funcionando como suporte complementar. O sistema conta com um mecanismo de **triagem automática** que encaminha o usuário ao profissional de acolhimento mais adequado:

| Perfil de Triagem | Categoria | Profissional Responsável | Regra de Direcionamento |
| :--- | :--- | :--- | :--- |
| `homem` | Acolhimento Masculino | **Matheus** | Fixo |
| `mulher` | Acolhimento Feminino | **Agda, Gabriela, Shirley** | Alternado via *Round-Robin* |
| `vitima_abuso` | Mulher — Vítima de Abuso Sexual | **Kelly** | Fixo (com suporte a pseudônimo/codinome) |

---

## 2. Arquitetura do Sistema

A aplicação adota a arquitetura de **Monólito Leve em Node.js (Express)**, combinando páginas estáticas otimizadas servidas pelo Express com uma API RESTful em JSON.

```
ministerio-acolher/
├── server.js                          # Servidor principal (Express, MySQL pool, Nodemailer, rotas, GET /healthz)
├── package.json / package-lock.json
├── Dockerfile                         # Imagem de produção (node:22-alpine)
├── docker-compose.yml                 # Stack de produção (app + MySQL)
├── docker-compose.dev.yml             # Stack de desenvolvimento (hot-reload)
├── .env.example                       # Modelo das variáveis de ambiente (versionado)
├── .dockerignore                      # Exclusões do contexto de build
├── .github/workflows/
│   └── deploy.yml                     # CI/CD: validação (CI) + deploy automático na VPS (CD)
├── middleware/
│   └── auth.js                        # Proteção de sessão do painel administrativo
├── routes/
│   ├── admin.js                       # Rotas administrativas (Login, Logout, API de estatísticas)
│   └── location.js                    # API de localização (Países, Estados, Cidades via country-state-city)
├── utils/
│   └── geocode.js                     # Geocoding inverso via Nominatim (OpenStreetMap) + Cache
├── public/                            # Assets e código frontend público
│   ├── index.html                     # Landing page principal
│   ├── css/styles.css                 # Estilos customizados e animações
│   ├── js/
│   │   ├── i18n.js                    # Sistema completo de internacionalização (PT/EN/ES)
│   │   └── main.js                    # Manipulação de formulário, máscaras, geolocalização e modais
│   ├── admin/
│   │   └── dashboard.js               # Painel estatístico dinâmico com Chart.js
│   └── assets/images/                 # Imagens, logotipos e avatares da equipe
├── views/admin/
│   ├── login.html                     # Interface de login administrativo
│   └── dashboard.html                 # Interface do dashboard analítico
└── scripts/                           # Utilitários de manutenção (deploy legado aposentado)
    ├── gerar-hash-senha.js            # Utilitário Bcrypt para senha admin
    ├── deletar-ultimo-registro.js     # Script de limpeza de teste no banco
    ├── deploy-vps.js                  # (LEGADO) Deploy SFTP + PM2 — substituído pelo CI/CD
    └── restart-server.js              # (LEGADO) Reinício remoto via PM2 — aposentado
```

---

## 3. Análise Detalhada do Backend

### 3.1 Tecnologias e Dependências Primárias
- **Node.js (22)** e **Express 5.2.1**: Servidor web resiliente e de alta performance.
- **`mysql2/promise` (v3.22.5)**: Pool de conexões MySQL assíncrono.
- **`express-session` (v1.19.0)**: Gerenciamento de sessão de usuário autenticado no painel admin.
- **`bcryptjs` (v2.4.3)**: Hashing seguro de senhas.
- **`nodemailer` (v9.0.3)**: Envio automatizado de e-mails de triagem via SMTP Brevo (Sendinblue).
- **`country-state-city` (v3.2.1)**: Base local para listagem rápida de países, estados e cidades.
- **`ssh2` (v1.17.0, devDependency)**: Automação de deploy legado (SSH/SFTP); não entra na imagem de produção.

### 3.2 Rotas e Endpoints

#### Rotas Públicas
- `GET /`: Entrega a landing page (`public/index.html`).
- `POST /api/cadastro`: Recebe os dados do formulário, valida obrigatoriedade, padroniza a localização (com fallback para Nominatim geocoding), persiste no MySQL, envia e-mail ao profissional via Nodemailer e retorna os dados do WhatsApp do profissional atribuído.
- `GET /api/location/countries`: Retorna a lista de países com códigos ISO, DDI e coordenadas.
- `GET /api/location/countries/coordinates`: Retorna países com coordenadas lat/lng.
- `GET /api/location/states/:countryCode`: Retorna estados/províncias de um determinado país.
- `GET /api/location/cities/:countryCode/:stateCode`: Retorna lista ordenada e sem duplicatas de cidades.

#### Rotas Administrativas (`/admin`)
- `GET /admin/login`: Página de login.
- `POST /admin/login`: Valida usuário (`ADMIN_USERNAME`) e senha com `bcrypt.compare` perante `ADMIN_PASSWORD_HASH`.
- `POST /admin/logout`: Destrói a sessão ativada.
- `GET /admin`: Dashboard protegido pelo middleware `requireAuth`.
- `GET /admin/api/stats`: Endpoint analítico protegido. Retorna agregações estatísticas do banco de dados (totais, sexo, estado civil, faixa etária calculada, motivos de terapia agrupados, localização e canal de origem).

---

## 4. Análise Detalhada do Frontend

### 4.1 UI/UX e Estilização
- **Tailwind CSS 3.x** (via CDN) com extensão de tema nativa no HTML:
  - Paleta de cores oficial: `brand-dark` (`#7A1C1C`), `brand-deep` (`#5C1414`), `brand-cream` (`#F4EFE6`), `brand-light` (`#FFFDF9`), `brand-accent` (`#E05A5A`), `brand-text` (`#2C1A1A`), `brand-soft` (`#7A5C5C`).
  - Tipografias refinadas: `Cinzel` (Títulos), `Playfair Display` (Citações/Serif), `Plus Jakarta Sans` (Corpo de texto) e `Alex Brush` (Caligrafia).
- **Responsividade Mobile-First**: Menus adaptáveis com transição suave, suporte a telas pequenas e layouts fluidos.

### 4.2 Acessibilidade (WCAG 2.1 AA)
- **Skip link**: Atalho para pular a navegação e ir direto ao formulário (`.skip-link`).
- **Navegação por Teclado**: Modal de compartilhamento com *focus trap* e gerenciamento de tecla `Escape`.
- **Atributos Semânticos**: Uso extensivo de `aria-label`, `aria-expanded`, `aria-pressed`, `aria-controls` e `role`.
- **Modo Sigilo/Codinome**: Destaque amigável (`bg-amber-50`) informando à vítima de abuso que o uso de nome real não é obrigatório.

### 4.3 Internacionalização (i18n)
- Módulo próprio em `public/js/i18n.js` cobrindo **Português (`pt-BR`)**, **Inglês (`en`)** e **Espanhol (`es`)**.
- Detecção automática de idioma baseada em `localStorage` ou no cabeçalho do navegador (`navigator.language`).
- Atualização dinâmica sem reload da página para textos, placeholders, meta tags OpenGraph e labels acessíveis (`aria-label`).

### 4.4 Recursos Especiais do Frontend
- **Validação de WhatsApp**: Máscara automática `(XX) XXXXX-XXXX` com verificação estrita de 11 dígitos.
- **Redirecionamento Inteligente pós-envio**: Realiza pré-checagem silenciosa da conectividade do `wa.me` via `fetch(..., { mode: 'no-cors' })` com timeout de 3s. Se o WhatsApp estiver acessível, redireciona o usuário automaticamente; caso contrário, exibe uma tela de sucesso com botão manual.
- **Gerador de Card para Redes Sociais**: Integração com `html2canvas` para transformar o resumo do projeto em um card gráfico otimizado (em alta resolução 2.5x Retina) para download ou compartilhamento direto.

---

## 5. Banco de Dados e Persistência

### 5.1 Estrutura da Tabela `cadastros`

```sql
CREATE TABLE IF NOT EXISTS cadastros (
    id                       INT AUTO_INCREMENT PRIMARY KEY,
    perfil_triagem           VARCHAR(30)  NOT NULL,
    profissional_responsavel VARCHAR(50)  NOT NULL,
    nome                     VARCHAR(150) NOT NULL,
    data_nascimento          DATE,
    localizacao              VARCHAR(200),
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

### 5.2 Auto-migração Integrada
Na inicialização da aplicação (`inicializarBanco()` em `server.js`), o sistema verifica dinamicamente a presença de colunas introduzidas em atualizações recentes (`pais`, `onde_conheceu`) através da tabela `INFORMATION_SCHEMA.COLUMNS`, executando `ALTER TABLE` automaticamente se necessário. A rotina possui **retry com backoff exponencial** e encerra o processo (fail-fast) caso o banco permaneça indisponível.

---

## 6. Integrações e Serviços Externos

1. **Nominatim / OpenStreetMap (Geocoding)**:
   - Módulo `utils/geocode.js` consulta o endpoint de busca do Nominatim para padronizar cidades brasileiras sem UF informada para o formato `Cidade – UF`.
   - Inclui timeout rígido de 4.000 ms e cache em memória (`Map`) para economizar requisições repetidas.
2. **Brevo (Sendinblue SMTP)**:
   - Disparo automatizado de e-mail HTML estilizado ao profissional responsável a cada novo formulário enviado.
3. **WhatsApp Web API (`wa.me`)**:
   - Criação de links diretos com mensagem inicial pré-formatada no idioma selecionado pelo usuário.

---

## 7. Segurança, Privacidade e LGPD

- **Sanitização de Consultas SQL**: Todas as queries utilizam *prepared statements* (`?` placeholders) no `mysql2`, eliminando riscos de SQL Injection.
- **Proteção da Área Administrativa**:
  - Sessão com cookie marcado como `httpOnly` e `secure` em ambiente de produção (`NODE_ENV === 'production'`).
  - Senha do administrador tratada via hashing unidirecional `bcrypt` (10 salt rounds).
  - Respostas HTTP 401 JSON em endpoints de API para chamadas não autenticadas.
- **Privacidade e Consentimento (LGPD)**:
  - Obrigatoriedade do aceite de três termos distintos: Sigilo Profissional, Limite de 3 Sessões Gratuitas e Gratuidade do Serviço.
  - Opção de codinome/pseudônimo para o público de abuso sexual.
  - O painel administrativo e a tela de login possuem meta tag `noindex, nofollow` para impedir indexação em motores de busca.

---

## 8. Automação, Conteinerização e Deploy (CI/CD)

A aplicação é empacotada em **Docker** e orquestrada por **Docker Compose**; a publicação é **automatizada via GitHub Actions** (CI/CD), substituindo o modelo manual por PM2/SFTP.

### 8.1 Conteinerização
- **`Dockerfile`**: imagem de produção baseada em `node:22-alpine`, execução como usuário não-root (`node`), `HEALTHCHECK` no endpoint `GET /healthz` e `CMD ["node", "server.js"]`.
- **`docker-compose.yml`** (produção): dois containers — `acolher-life` (app, publicado apenas em `127.0.0.1:3000`) e `acolher-db` (`mysql:8.4.0`, sem porta publicada). Dados persistidos no volume nomeado **`acolher_mysql_data`**.
- **`docker-compose.dev.yml`** (desenvolvimento): app com hot-reload (nodemon) na porta 3000 e MySQL na porta 3307.

### 8.2 Pipeline CI/CD (`.github/workflows/deploy.yml`)
Disparado em push na branch `main` (ou manualmente via `workflow_dispatch`), com `concurrency` para impedir deploys simultâneos:
- **CI (`validate`)**: `npm ci` e checagem de sintaxe (`node --check`) dos módulos principais.
- **CD (`deploy`)**: SSH na VPS → backup preventivo do banco (`mysqldump | gzip` em `backups/`) → `git reset --hard origin/main` → `docker compose up -d --build` → smoke test `GET /healthz` → remoção do PM2 legado → limpeza de imagens.

### 8.3 Scripts de manutenção (`scripts/`)
- **`scripts/gerar-hash-senha.js`**: gera a hash Bcrypt da senha de administrador (para `ADMIN_PASSWORD_HASH`).
- **`scripts/deletar-ultimo-registro.js`**: exclusão rápida do último registro cadastrado durante testes.
- **`scripts/deploy-vps.js`** e **`scripts/restart-server.js`**: **(LEGADOS)** deploy por SFTP + `pm2 restart` via `ssh2` — **aposentados** pelo CI/CD. Mantidos apenas como histórico.

---

## 9. Pontos Fortes do Projeto

1. **Arquitetura Enxuta e Elegante**: Sem overengineering. Utiliza Node.js puro com Express e JavaScript Vanilla, garantindo tempos de resposta na casa dos milissegundos.
2. **Foco Total na Empatia e UX**: Interface extremamente acolhedora, com paleta de cores consistente e orientada ao suporte emocional.
3. **Resiliência do Dashboard**: O endpoint `/admin/api/stats` foi construído com blocos `try/catch` individuais para cada métrica, garantindo que o painel continue funcionando mesmo que um campo retorne erro pontual.
4. **Respeito à Privacidade do Usuário**: Suporte a pseudônimos e envio direto via WhatsApp, evitando fricção no momento da busca por ajuda.
5. **Internacionalização Sem Dependências Pesadas**: Sistema leve e expansível com suporte nativo a 3 idiomas.

---

## 10. Oportunidades de Melhoria e Recomendações

### 10.1 Segurança e Proteção de APIs
- **Rate Limiting**: Recomenda-se adicionar o middleware `express-rate-limit` nos endpoints `/api/cadastro` e `/admin/login` para prevenir ataques de negação de serviço (DoS) e força bruta.
- **HTTP Security Headers**: Adicionar a biblioteca `helmet` para aplicar cabeçalhos de segurança padrão (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`).

### 10.2 Validação de Dados (Schema Validation)
- Adicionar uma camada de validação estruturada no backend (usando `zod` ou `express-validator`) para checar os tipos, comprimentos e formatos de strings recebidas no `POST /api/cadastro` antes de enviar à camada do banco.

### 10.3 Testes Automatizados
- O projeto atualmente possui apenas um placeholder para testes no `package.json`. Seria altamente benéfico implementar testes unitários e de integração (ex.: com `Jest` e `Supertest`) para cobrir:
  - Rota de cadastro (`POST /api/cadastro`);
  - Algoritmo de *Round-Robin* da equipe feminina;
  - Funções de geocoding (`utils/geocode.js`);
  - Sistema de tradução (`public/js/i18n.js`).

### 10.4 Infraestrutura e Deploy
- **Backup do banco**: já automatizado no pipeline (dump `mysqldump | gzip`, permissão `600`, retenção dos 10 mais recentes em `backups/`). Recomenda-se complementar com cópia diária **offsite criptografada**.
- **Hardening**: pinar as imagens (`node:22-alpine`, `mysql:8.4.0`) e as GitHub Actions por digest/SHA; considerar migração de segredos para Docker `secrets`.

---

*Relatório gerado automaticamente para análise e documentação do projeto Ministério Acolher.*

