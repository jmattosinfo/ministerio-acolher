# 🤖 AI_GUIDELINES.md — Diretrizes para Agentes de IA

> Este arquivo é a **fonte de orientação** para qualquer IA que trabalhar no projeto **Ministério Acolher**.
> Sempre que uma alteração for solicitada, consulte este documento antes de escrever código, textos ou alterar a identidade visual.
> Se uma instrução do usuário conflitar com estas diretrizes, **questione antes de executar**.

---

## 🎯 Objetivo do Projeto

O **Ministério Acolher** é uma plataforma web de **acolhimento emocional e espiritual**, gratuita, sigilosa e 100% online, destinada a **homens e mulheres maiores de 18 anos** que vivenciam ou vivenciaram:

- Violência doméstica no relacionamento conjugal;
- Divórcio ou processo de separação;
- Abuso sexual fora do contexto conjugal.

Cada pessoa é direcionada a um **profissional qualificado** de acordo com seu perfil:

| Perfil | Profissional |
|--------|-------------|
| Homens | Matheus |
| Mulheres | Agda, Gabriela e Shirley (round-robin) |
| Vítimas de abuso sexual | Kelly |

**Acolhimento NÃO é atendimento clínico.** O projeto **não substitui** atendimento psicológico, psiquiátrico ou jurídico — é um suporte complementar que respeita a fé e a visão de mundo de cada pessoa, **sem imposição religiosa**.

---

## 🛠️ Stack

### Backend (Node.js ≥ 18)
- **Express** (^5.2.1) — framework web
- **MySQL** via `mysql2` (^3.22.5) — banco de dados
- **express-session** (^1.19.0) — sessão do painel admin
- **bcryptjs** (^2.4.3) — hash de senha administrativa
- **Nodemailer** (^9.0.3) — e-mail via SMTP **Brevo** (Sendinblue)
- **dotenv** (^17.4.2) — variáveis de ambiente
- **ssh2** (^1.17.0) — automação de deploy em VPS (scripts)

### Frontend (via CDN)
- **Tailwind CSS 3.x** — estilos utilitários (config de tema no HTML)
- **Chart.js 4.x** — gráficos do dashboard
- **Leaflet 1.9.x** — mapa coroplético
- **Lucide** — ícones
- **html2canvas** — geração de imagem de compartilhamento
- **Google Fonts** — Cinzel, Playfair Display, Plus Jakarta Sans, Alex Brush
- **i18n próprio** — pt-BR, en, es (arquivo `public/js/i18n.js`)

### Geolocalização
- **country-state-city** — países, estados e cidades
- **Nominatim (OpenStreetMap)** — geocoding (com cache em memória)

### Dev
- **Nodemon** — reload automático

---

## 🎨 Identidade Visual

Estética **acolhedora, sóbria e elegante**, com leve toque clássico. Tom de marca: **vinho/bordô (rosa-escuro)**. Elementos característicos:

- Barra superior com gradiente vinho → coral → vinho;
- Títulos em serifa clássica (Cinzel) com espaçamento de letras;
- Citações em itálico (Playfair Display) e frases em caligrafia (Alex Brush);
- Divisórias ornamentais com linha em gradiente;
- Avatares com anel em gradiente (conic-gradient);
- Logo com efeito de "pulso" (pulsar suave de brilho);
- Cartões arredondados com sombra suave e borda clara;
- Fundos em off-white/creme, nunca branco puro em áreas extensas.

---

## 🎨 Paleta de Cores

### Paleta oficial (definida no Tailwind config — `public/index.html`)

| Token | HEX | Uso |
|-------|-----|-----|
| `brand-dark` | `#7A1C1C` | **Primária** — vinho/bordô. Botões, links, títulos, foco |
| `brand-deep` | `#5C1414` | Vinho profundo — hover dos botões primários, extremidades do gradiente |
| `brand-light` | `#FFFDF9` | Off-white — fundo principal da página |
| `brand-cream` | `#F4EFE6` | Creme — fundos de seção alternados, chips, avatares |
| `brand-muted` | `#E8E0D4` | Bege — bordas, separadores, trilhas de slider |
| `brand-accent` | `#E05A5A` | Coral — destaque pontual, gradiente da barra e do anel |
| `brand-text` | `#2C1A1A` | Quase-preto quente — texto principal |
| `brand-soft` | `#7A5C5C` | Marrom acinzentado — texto secundário |

### Cores de dados (dashboard — `public/admin/dashboard.js`)
`#7A1C1C`, `#C08552`, `#4A6C6F`, `#D9A441`, `#8E9775`, `#B0413E`, `#5A5A5A`, `#3E5C76`, `#A16E83`, `#6B8F71`

### Cores de tags de perfil (página pública)
- Homens: azul (`bg-blue-50` / `text-blue-700`)
- Mulheres: rosa (`bg-rose-50` / `text-rose-700`)
- Abuso: roxo (`bg-purple-50` / `text-purple-700`)

---

## ⚠️ Regra de Uso do Amarelo

O **amarelo NÃO é cor de marca** do projeto.

- **Uso permitido (único):** contexto de **alerta/aviso** — ex.: aviso de sigilo e codinome para vítimas de abuso (`bg-amber-50`, `border-amber-200`, `text-amber-800`) e avisos de ajuda no WhatsApp (`text-amber-600`).
- **Uso em dados:** apenas como **cor secundária** de gráficos (`#D9A441` dourado na paleta do dashboard).
- **Proibido:**
  - Usar amarelo/âmbar como cor primária ou de destaque de marca;
  - Usar amarelo em grandes áreas, fundos de seção ou botões principais;
  - Introduzir novas tonalidades amarelas para fins decorativos.
- **Regra prática:** se a mudança não for um **aviso de segurança/sigilo** nem **coloração de dado em gráfico**, **não use amarelo**. Prefira as cores da paleta `brand`.

---

## 🧭 Princípios de UX

1. **Escuta como protagonista** — a interface deve transmitir segurança, acolhimento e respeito.
2. **Fluxo simples e guiado** — landing page com seções claras: Hero → Sobre → Equipe → Formulário.
3. **Triagem por perfil** — o formulário direciona a pessoa ao profissional correto automaticamente.
4. **Formulário acessível e validado** — máscara de telefone `(XX) XXXXX-XXXX`, seleção geográfica dinâmica (país → estado → cidade), validação no frontend e backend.
5. **Privacidade por padrão** — modo codinome para vítimas de abuso, termos de consentimento (sigilo, sessões, gratuidade).
6. **Comunicação clara e acolhedora** — linguagem simples, sem jargão, sem imposição religiosa.
7. **Feedback imediato** — estados de carregamento, sucesso e erro bem definidos; redirecionamento para WhatsApp do profissional após cadastro.
8. **Compartilhamento social** — Web Share API com fallback para clipboard.
9. **i18n** — pt-BR (padrão), en e es; detecção automática + persistência em `localStorage`.
10. **Consistência visual** — sempre usar os tokens `brand.*`; nunca hardcode cores fora da paleta sem justificativa.

---

## ♿ Princípios de Acessibilidade

Referência: **WCAG 2.1 AA**.

- **Skip link** para pular direto ao formulário.
- **Focus trap** no modal de profissionais e navegação completa por teclado.
- **Foco visível** nas cores do ministério (`outline: 2.5px solid #7A1C1C`).
- **ARIA labels** e atributos semânticos em todos os componentes interativos (`aria-label`, `aria-pressed`, `aria-expanded`, `aria-controls`).
- **Respeitar `prefers-reduced-motion`** — reduzir/desativar animações quando o usuário solicitar.
- **Contraste adequado** de texto sobre fundos claros.
- **Textos alternativos** em imagens relevantes (logo, fotos da equipe).
- E-mail de contato para problemas de acessibilidade: `acessibilidade@acolher.life`.

---

## ⚡ Princípios de Performance

1. **Pouco JavaScript próprio** — manter `main.js` e `i18n.js` enxutos; delegar estilos ao Tailwind.
2. **Cache em memória** para geocoding (evitar chamadas repetidas à API Nominatim).
3. **Carregamento de bibliotecas via CDN** — não duplicar dependências nem adicionar scripts sem necessidade.
4. **Imagens otimizadas** — fotos e logos com tamanho adequado; usar `onerror` com fallback para avatares.
5. **Evitar renderização pesada no servidor** — páginas públicas são estáticas; apenas dados dinâmicos vêm da API.
6. **Consultas SQL parametrizadas** — sempre usar placeholders (`?`) para evitar injeção e melhorar o plano de execução.

---

## 📁 Estrutura Prevista

```
ministerio-acolher/
├── server.js                          # Servidor principal Express (pool MySQL, sessão, e-mail, rotas)
├── middleware/
│   └── auth.js                        # Middleware de autenticação por sessão
├── public/                            # Arquivos estáticos (servidos na raiz)
│   ├── index.html                     # Landing page principal (i18n + Tailwind config)
│   ├── admin/dashboard.js             # Lógica do dashboard (Chart.js + Leaflet)
│   ├── assets/images/                 # Logos, fotos da equipe, selos
│   ├── css/styles.css                 # Estilos customizados + animações
│   └── js/
│       ├── i18n.js                    # Sistema de internacionalização (pt/en/es)
│       └── main.js                    # Lógica do frontend (formulário, modal, share)
├── routes/
│   ├── admin.js                       # Rotas do painel administrativo
│   └── location.js                    # API de países, estados e cidades
├── scripts/
│   ├── gerar-hash-senha.js            # Gera hash bcrypt para senha admin
│   ├── deploy-vps.js                  # Deploy automatizado via SSH
│   ├── restart-server.js              # Reinicia o servidor na VPS
│   └── deletar-ultimo-registro.js     # Utilitário de manutenção do banco
├── utils/
│   └── geocode.js                     # Geocoding via Nominatim (OSM) + cache
├── views/admin/
│   ├── login.html                     # Tela de login administrativo
│   └── dashboard.html                 # Template do dashboard
└── .env                               # Variáveis de ambiente (NÃO versionar)
```

**Regra de estrutura:** novos arquivos devem seguir este layout. Não criar pastas/estruturas paralelas sem necessidade.

---

## 📐 Regras de Código

1. **Código limpo e comentado** — comentários em português, explicando o "porquê", não o "o quê".
2. **Respeitar a arquitetura existente**: `middleware → routes → views`, lógica de frontend em `public/js`.
3. **Frontend em Tailwind + tokens `brand.*`** — não criar CSS customizado quando a utilidade Tailwind resolve.
4. **SQL sempre parametrizado** (placeholders `?`).
5. **Segredos só via `.env`** — nunca hardcodear senhas, chaves SMTP ou credenciais.
6. **i18n obrigatório para textos visíveis** — usar `data-i18n` e adicionar as chaves nos 3 idiomas (`pt-BR`, `en`, `es`).
7. **Cores fora da paleta** exigem justificativa (ex.: tags de perfil, avisos).
8. **Padrões de commit:**
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `refactor:` refatoração (sem mudar comportamento)
   - `style:` formatação/estilos sem mudar lógica
   - `docs:` documentação
   - `chore:` manutenção
9. **Testar manualmente antes de concluir** — fluxo do formulário, dashboard, i18n e acessibilidade.
10. **Atualizar a documentação** quando houver mudanças relevantes.

---

## 📦 Dependências Permitidas

- **Já instaladas (npm):** `express`, `express-session`, `mysql2`, `bcryptjs`, `nodemailer`, `dotenv`, `country-state-city`, `ssh2`; dev: `nodemon`.
- **Via CDN (frontend):** Tailwind CSS 3, Chart.js 4, Leaflet 1.9, Lucide, html2canvas, Google Fonts.
- **APIs externas já utilizadas:** Nominatim (OpenStreetMap) e Brevo (SMTP).
- **Nova dependência:** somente se **estritamente necessária** e **aprovada** pelo usuário. Evitar alternativas quando o que já existe resolve.
- **Proibido:** adicionar frameworks (React/Vue/Svelte), TypeScript ou bundlers sem autorização explícita — o projeto é deliberadamente simples (HTML + CSS + JS vanilla + Node/Express).

---

## 🚫 Regra: Não Inventar Conteúdo Profissional

- **A equipe é real e fixa:** Matheus, Agda, Gabriela, Shirley e Kelly. **Nunca** inventar nomes, sobrenomes, fotos, currículos, especialidades, títulos, e-mails ou números de WhatsApp.
- **Não alterar o direcionamento por perfil** (homens → Matheus; mulheres → round-robin Agda/Gabriela/Shirley; abuso → Kelly) sem ordem explícita do usuário.
- **Não inventar conteúdo clínico, psicológico ou jurídico.** O projeto deixa claro que o acolhimento **não substitui** atendimento profissional especializado.
- **Não inventar estatísticas, depoimentos ou números** no dashboard ou nos textos — dados exibidos devem vir do banco real.
- **Não inventar termos de consentimento ou promessas** (ex.: número de sessões, prazos, garantias). Manter exatamente o que já está documentado no site.
- Em caso de dúvida sobre conteúdo sensível, **pergunte ao usuário** antes de publicar qualquer texto.

---

## 🧘 Regra: Não Criar Complexidade Sem Necessidade

- **Princípio do mínimo viável:** escolher sempre a solução mais simples que funcione e atenda à solicitação.
- **Não adicionar** bibliotecas, abstrações, camadas, configurações ou funcionalidades que não foram pedidas.
- **Não "modernizar"** o projeto (React, TypeScript, bundlers, SSR) sem solicitação explícita.
- **Não refatorar** código que funciona sem motivo claro — mudanças devem ter propósito.
- **Uma mudança por vez:** implementar somente o escopo solicitado, sem "aproveitar" para alterar coisas não relacionadas.
- Se uma ideia de implementação aumentar a complexidade sem ganho real para o usuário final, **proponha a versão mais simples**.

---

*Documento de referência permanente — Ministério Acolher · 💜 Escuta, Cuidado e Respeito.*
