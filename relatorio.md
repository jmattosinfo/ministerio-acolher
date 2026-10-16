# 📋 Relatório de Análise Técnica — Ministério Acolher

> **Data da Análise:** 28 de Agosto de 2026  
> **Escopo:** Análise completa da arquitetura, backend, frontend, banco de dados, geolocalização, segurança, internacionalização (i18n), infraestrutura e devops.

---

## 📑 Sumário

1. [Visão Geral e Propósito](#1-visão-geral-e-propósito)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Análise Detalhada do Backend](#3-análise-detalhada-do-backend)
4. [Análise Detalhada do Frontend](#4-análise-detalhada-do-frontend)
5. [Banco de Dados e Persistência](#5-banco-de-dados-e-persistência)
6. [Integrações e Serviços Externos](#6-integrações-e-serviços-externos)
7. [Segurança, Privacidade e LGPD](#7-segurança-privacidade-e-lgpd)
8. [Automação e Scripts de Deploy](#8-automação-e-scripts-de-deploy)
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
├── server.js                          # Servidor principal (Express, MySQL pool, Nodemailer, rotas)
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
└── scripts/                           # Automação de deploy e manutenção
    ├── deploy-vps.js                  # Deploy via SFTP + PM2 remote restart
    ├── gerar-hash-senha.js            # Utilitário Bcrypt para senha admin
    ├── deletar-ultimo-registro.js     # Script de limpeza de teste no banco
    └── restart-server.js              # Reinicialização de processo
```

---

## 3. Análise Detalhada do Backend

### 3.1 Tecnologias e Dependências Primárias
- **Node.js (≥ 18)** e **Express 5.2.1**: Servidor web resiliente e de alta performance.
- **`mysql2/promise` (v3.22.5)**: Pool de conexões MySQL assíncrono.
- **`express-session` (v1.19.0)**: Gerenciamento de sessão de usuário autenticado no painel admin.
- **`bcryptjs` (v2.4.3)**: Hashing seguro de senhas.
- **`nodemailer` (v9.0.3)**: Envio automatizado de e-mails de triagem via SMTP Brevo (Sendinblue).
- **`country-state-city` (v3.2.1)**: Base local para listagem rápida de países, estados e cidades.
- **`ssh2` (v1.17.0)**: Automação de deploy via protocolo SSH/SFTP.

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
Na inicialização da aplicação (`inicializarBanco()` em `server.js`), o sistema verifica dinamicamente a presença de colunas introduzidas em atualizações recentes (`pais`, `onde_conheceu`) através da tabela `INFORMATION_SCHEMA.COLUMNS`, executando `ALTER TABLE` automaticamente se necessário.

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

## 8. Automação e Scripts de Deploy

O repositório possui uma suíte de automação em Node.js localizada na pasta `scripts/`:

- **`scripts/deploy-vps.js`**:
  - Conecta-se à VPS via SSH (`ssh2`) utilizando autenticação por chave privada (`id_ed25519`) ou senha.
  - Realiza upload SFTP incremental dos diretórios e arquivos da aplicação.
  - **Filtro de Segurança**: Bloqueia o envio de arquivos sensíveis como `.env`, `.env.example`, `.git`, `node_modules`, `scripts` e `.vscode`.
  - Executa comando remoto para reiniciar o processo gerenciado pelo PM2 (`pm2 restart acolher.life`).
- **`scripts/gerar-hash-senha.js`**: Auxiliar de linha de comando para gerar a hash Bcrypt da senha de administrador.
- **`scripts/deletar-ultimo-registro.js`**: Utilitário para exclusão rápida do último registro cadastrado durante testes.

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

---

*Relatório gerado automaticamente para análise e documentação do projeto Ministério Acolher.*

