# 🌹 Ministério Acolher

**Um espaço de escuta, cuidado e respeito.**

Plataforma web para acolhimento emocional e espiritual especializado, gratuito e sigiloso, voltado para homens e mulheres maiores de 18 anos que vivenciam ou vivenciaram violência doméstica no relacionamento conjugal, divórcio, ou abuso sexual fora do casamento.

---

## 📋 Índice

- [🌹 Ministério Acolher](#-ministério-acolher)
  - [📋 Índice](#-índice)
  - [💜 Sobre o Projeto](#-sobre-o-projeto)
  - [✨ Funcionalidades](#-funcionalidades)
    - [🌐 Página Pública](#-página-pública)
    - [🌍 Internacionalização (i18n)](#-internacionalização-i18n)
    - [📊 Painel Administrativo](#-painel-administrativo)
    - [🔔 Notificações por E-mail](#-notificações-por-e-mail)
    - [🗺️ Geocoding](#️-geocoding)
    - [♿ Acessibilidade](#-acessibilidade)
  - [🛠️ Tecnologias Utilizadas](#️-tecnologias-utilizadas)
  - [📁 Estrutura do Projeto](#-estrutura-do-projeto)
  - [✅ Pré-requisitos](#-pré-requisitos)
  - [🚀 Instalação e Execução](#-instalação-e-execução)
    - [1. Clone o repositório](#1-clone-o-repositório)
    - [2. Instale as dependências](#2-instale-as-dependências)
    - [3. Configure o banco de dados MySQL](#3-configure-o-banco-de-dados-mysql)
    - [4. Configure as variáveis de ambiente](#4-configure-as-variáveis-de-ambiente)
    - [5. Gere o hash da senha administrativa](#5-gere-o-hash-da-senha-administrativa)
    - [6. Execute o servidor](#6-execute-o-servidor)
    - [7. Acesse](#7-acesse)
  - [🔐 Variáveis de Ambiente](#-variáveis-de-ambiente)
    - [Exemplo de `.env`](#exemplo-de-env)
  - [📜 Scripts Disponíveis](#-scripts-disponíveis)
  - [📖 Guia de Uso](#-guia-de-uso)
    - [Fluxo do Usuário](#fluxo-do-usuário)
    - [Painel Administrativo](#painel-administrativo)
    - [Internacionalização](#internacionalização)
  - [🔌 Exemplo de Integração](#-exemplo-de-integração)
    - [Envio de formulário via API](#envio-de-formulário-via-api)
  - [🌐 API Endpoints](#-api-endpoints)
    - [Localização](#localização)
    - [Cadastro](#cadastro)
    - [Administração](#administração)
  - [🤝 Contribuição](#-contribuição)
    - [Padrões de commit](#padrões-de-commit)
    - [Diretrizes](#diretrizes)
  - [📄 Licença](#-licença)
  - [📞 Contato](#-contato)

---

## 💜 Sobre o Projeto

O **Ministério Acolher** é uma iniciativa que oferece acolhimento emocional e espiritual gratuito para pessoas em situação de vulnerabilidade emocional. O atendimento é **100% online**, **totalmente gratuito** e **estritamente sigiloso**.

Cada pessoa é direcionada a um profissional qualificado de acordo com seu perfil e necessidade:

| Perfil | Profissional | Descrição |
|--------|-------------|-----------|
| 👤 **Homens** | Matheus | Violência doméstica, divórcio, abuso sexual |
| 👩 **Mulheres** | Agda, Gabriela ou Shirley (round-robin) | Violência doméstica, crises conjugais, divórcio |
| 🛡️ **Vítimas de abuso sexual** | Kelly | Abuso sexual fora do contexto conjugal |

O acolhimento **não substitui** o atendimento psicológico, psiquiátrico ou jurídico, mas atua como um suporte complementar importante, respeitando a dimensão espiritual e as convicções individuais de cada pessoa.

---

## ✨ Funcionalidades

### 🌐 Página Pública

- **Landing Page** com apresentação do projeto, equipe e formulário de acolhimento
- **Formulário de triagem** com seleção de perfil (masculino, feminino, vítima de abuso)
- **Seleção geográfica** dinâmica: países, estados/províncias e cidades via API
- **Máscara de telefone** automática para WhatsApp no formato `(XX) XXXXX-XXXX`
- **Validação completa** dos campos no frontend e backend
- **Modo codinome** para vítimas de abuso (proteção de identidade)
- **Termos de consentimento** (sigilo, sessões, gratuidade)
- **Compartilhamento** via Web Share API ou clipboard
- **Animações suaves** com Intersection Observer (reveal on scroll)
- **Modal de profissionais** acessível com focus trap e navegação por teclado

### 🌍 Internacionalização (i18n)

- Suporte a **Português (pt-BR)**, **Inglês (en)** e **Espanhol (es)**
- Detecção automática do idioma do navegador
- Persistência da preferência em `localStorage`
- Tradução de todo o conteúdo textual, placeholders, aria-labels e meta tags

### 📊 Painel Administrativo

- **Autenticação** via sessão com senha hasheada (bcryptjs)
- **Dashboard** com gráficos interativos (Chart.js):
  - Distribuição por faixa etária
  - Distribuição por perfil de triagem
  - Estado civil
  - Motivo da procura
  - Pessoas acolhidas por estado
  - Onde conheceu o Acolher
  - Rede de apoio
  - Países estrangeiros
- **Mapa coroplético** interativo (Leaflet) com distribuição geográfica
- **Filtros temporais**: última semana, último mês, último ano, total

### 🔔 Notificações por E-mail

- Disparo automático de e-mail para o profissional responsável ao receber um novo cadastro
- Template HTML responsivo com dados do formulário
- Integração com **Brevo** (antigo Sendinblue) via Nodemailer

### 🗺️ Geocoding

- Enriquecimento automático de localização via **Nominatim** (OpenStreetMap)
- Cache em memória para evitar chamadas repetidas à API
- Resolução de nomes de cidades para UF (sigla do estado)
- Mapa de fallback para nomes completos de estados brasileiros

### ♿ Acessibilidade

- **Skip link** para pular para o formulário
- **Focus trap** no modal de profissionais
- **ARIA labels** e atributos semânticos
- **Preferência por animações reduzidas** (`prefers-reduced-motion`)
- Navegação por teclado completa
- **WCAG 2.1 AA** como referência
- E-mail para reportar problemas de acessibilidade: acessibilidade@acolher.life

---

## 🛠️ Tecnologias Utilizadas

| Categoria | Tecnologia | Versão |
|-----------|-----------|--------|
| **Runtime** | [Node.js](https://nodejs.org/) | ≥ 18.x |
| **Framework Web** | [Express](https://expressjs.com/) | ^5.2.1 |
| **Banco de Dados** | [MySQL](https://www.mysql.com/) + [mysql2](https://github.com/sidorares/node-mysql2) | ^3.22.5 |
| **Autenticação** | [express-session](https://github.com/expressjs/session) + [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | ^1.19.0 / ^2.4.3 |
| **E-mail** | [Nodemailer](https://nodemailer.com/) | ^9.0.3 |
| **Geolocalização** | [country-state-city](https://github.com/dr5hn/country-state-city) + [Nominatim (OSM)](https://nominatim.openstreetmap.org/) | ^3.2.1 |
| **Frontend** | [Tailwind CSS](https://tailwindcss.com/) (CDN) | 3.x |
| **Gráficos** | [Chart.js](https://www.chartjs.org/) | 4.x |
| **Mapa** | [Leaflet](https://leafletjs.com/) | 1.9.x |
| **Ícones** | [Lucide](https://lucide.dev/) | — |
| **Fontes** | [Google Fonts](https://fonts.google.com/) (Cinzel, Playfair Display, Plus Jakarta Sans, Alex Brush) | — |
| **Variáveis de Ambiente** | [dotenv](https://github.com/motdotla/dotenv) | ^17.4.2 |
| **Dev** | [Nodemon](https://nodemon.io/) | ^3.1.14 |

---

## 📁 Estrutura do Projeto

```
ministerio-acolher/
│
├── .gitignore
├── package.json
├── server.js                          # Servidor principal Express
├── .env                               # Variáveis de ambiente (não versionado)
│
├── middleware/
│   └── auth.js                        # Middleware de autenticação (sessão)
│
├── public/                            # Arquivos estáticos (servidos na raiz)
│   ├── index.html                     # Landing page principal
│   │
│   ├── admin/
│   │   └── dashboard.js               # Lógica do dashboard (Chart.js + Leaflet)
│   │
│   ├── assets/
│   │   └── images/                    # Imagens, ícones, logotipos
│   │
│   ├── css/
│   │   └── styles.css                 # Estilos customizados + animações
│   │
│   └── js/
│       ├── i18n.js                    # Sistema de internacionalização
│       └── main.js                    # Lógica do frontend (formulário, etc.)
│
├── routes/
│   ├── admin.js                       # Rotas do painel administrativo
│   └── location.js                    # API de países, estados e cidades
│
├── scripts/
│   └── gerar-hash-senha.js            # Utilitário para gerar hash de senha
│
├── utils/
│   └── geocode.js                     # Geocoding via Nominatim (OSM)
│
└── views/
    └── admin/
        ├── login.html                 # Tela de login administrativo
        └── dashboard.html             # Template do dashboard
```

---

## ✅ Pré-requisitos

- **Node.js** versão 18 ou superior
- **MySQL** 8.0+ (ou MariaDB 10.5+)
- **npm** (gerenciador de pacotes do Node.js)
- Acesso à internet para consumo de APIs externas (Nominatim, Leaflet tiles)

---

## 🚀 Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ministerio-acolher.git
cd ministerio-acolher
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o banco de dados MySQL

Crie um banco de dados MySQL:

```sql
CREATE DATABASE ministerio_acolher CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> A tabela `cadastros` é criada automaticamente na primeira execução do servidor.

### 4. Configure as variáveis de ambiente

Copie o arquivo de exemplo ou crie um arquivo `.env` na raiz do projeto:

```bash
# Não existe .env.example — crie manualmente o arquivo .env
```

Veja a [seção de variáveis de ambiente](#-variáveis-de-ambiente) para a lista completa.

### 5. Gere o hash da senha administrativa

```bash
node scripts/gerar-hash-senha.js "sua-senha-aqui"
```

Copie o hash gerado e adicione ao `.env` como `ADMIN_PASSWORD_HASH`.

### 6. Execute o servidor

```bash
# Modo produção
npm start

# Modo desenvolvimento (com reload automático)
npm run dev
```

### 7. Acesse

- **Site público**: [http://localhost:3000](http://localhost:3000)
- **Painel administrativo**: [http://localhost:3000/admin](http://localhost:3000/admin/login)

---

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

| Variável | Obrigatória | Descrição | Padrão |
|----------|-------------|-----------|--------|
| `PORT` | Não | Porta do servidor | `3000` |
| `DB_HOST` | Não | Host do MySQL | `127.0.0.1` |
| `DB_PORT` | Não | Porta do MySQL | `3306` |
| `DB_USER` | **Sim** | Usuário do MySQL | — |
| `DB_PASSWORD` | **Sim** | Senha do MySQL | — |
| `DB_NAME` | **Sim** | Nome do banco de dados | — |
| `SESSION_SECRET` | **Sim** | Chave secreta para sessões Express | — |
| `EMAIL_HOST` | **Sim** | Servidor SMTP (ex: Brevo) | — |
| `EMAIL_PORT` | Não | Porta SMTP | `587` |
| `EMAIL_USER` | **Sim** | Usuário SMTP | — |
| `EMAIL_PASS` | **Sim** | Senha SMTP | — |
| `EMAIL_FROM` | Não | Nome/exibição do remetente | `EMAIL_USER` |
| `ADMIN_USERNAME` | **Sim** | Nome de usuário do painel admin | — |
| `ADMIN_PASSWORD_HASH` | **Sim** | Hash bcrypt da senha admin | — |
| `NODE_ENV` | Não | Ambiente (`development` \| `production`) | — |

### Exemplo de `.env`

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=minha-senha-mysql
DB_NAME=ministerio_acolher

# Sessão
SESSION_SECRET=uma-chave-secreta-muito-forte-aqui

# E-mail (Brevo / Sendinblue)
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USER=meu-email@exemplo.com
EMAIL_PASS=xkeysib-xxxxx
EMAIL_FROM="Ministério Acolher <meu-email@exemplo.com>"

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$... (hash gerado pelo script)
```

> ⚠️ **Importante**: O arquivo `.env` não deve ser versionado. Ele já está incluído no [`.gitignore`](.gitignore).

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o servidor em modo produção com `node server.js` |
| `npm run dev` | Inicia o servidor com `nodemon` (reload automático em alterações) |
| `node scripts/gerar-hash-senha.js "senha"` | Gera o hash bcrypt de uma senha para o painel admin |

---

## 📖 Guia de Uso

### Fluxo do Usuário

1. O usuário acessa a landing page e conhece o projeto
2. Navega pela seção "Sobre" para entender a proposta
3. Conhece a equipe de profissionais na seção "Equipe"
4. Preenche o **Formulário de Acolhimento**:
   - Seleciona o perfil de triagem (homem / mulher / vítima de abuso)
   - Informa dados pessoais (nome, data de nascimento, localização, WhatsApp)
   - Escolhe estado civil, rede de apoio, preferência de horário
   - Descreve o motivo da procura
   - Indica onde conheceu o projeto
   - Aceita os termos de consentimento
5. Os dados são validados e enviados ao servidor
6. O servidor:
   - Enriquece a localização via Nominatim (cidade → cidade + UF)
   - Salva os dados no MySQL
   - Seleciona o profissional responsável (round-robin para perfil feminino)
   - Dispara e-mail de notificação ao profissional
   - Retorna os dados de contato do profissional
7. O usuário é redirecionado a uma tela de sucesso com botão para iniciar conversa no WhatsApp com o profissional designado

### Painel Administrativo

1. Acesse `/admin/login` e faça login com as credenciais configuradas
2. Visualize o dashboard com estatísticas e gráficos interativos
3. Utilize os filtros temporais (semana / mês / ano / total) para refinar os dados
4. O mapa interativo mostra a distribuição geográfica das pessoas acolhidas

### Internacionalização

O site detecta automaticamente o idioma do navegador e aplica a tradução correspondente. O usuário pode alternar manualmente entre os idiomas clicando nas bandeiras no canto superior direito:

- 🇧🇷 **Português** (pt-BR)
- 🇺🇸 **English** (en)
- 🇪🇸 **Español** (es)

A preferência é salva no `localStorage` do navegador.

---

## 🔌 Exemplo de Integração

### Envio de formulário via API

```javascript
const dados = {
  perfil_triagem: 'homem',
  nome: 'João Silva',
  data_nascimento: '1990-05-15',
  pais: 'BR',
  cidade: 'São Paulo',
  estado: 'São Paulo',
  whatsapp: '11987654321',
  estado_civil: 'divorciado',
  rede_apoio: 'Sim (família, amigos, igreja...)',
  preferencia_horario: 'Noite',
  motivo_terapia: 'Estou passando por um divórcio difícil e preciso de apoio emocional.',
  onde_conheceu: 'instagram',
  termo_sigilo: true,
  termo_sessoes: true,
  termo_gratuidade: true
};

const response = await fetch('/api/cadastro', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(dados)
});

const result = await response.json();

if (result.ok) {
  console.log('Profissional designado:', result.profissional.nome);
  console.log('WhatsApp:', result.profissional.whatsappFormatado);
  // Redirecionar o usuário para o WhatsApp:
  // window.location.href = `https://wa.me/${result.profissional.whatsapp}?text=...`;
} else {
  console.error('Erro:', result.mensagem);
}
```

---

## 🌐 API Endpoints

### Localização

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/location/countries` | Lista todos os países com ISO, nome, código telefônico e coordenadas |
| `GET` | `/api/location/countries/coordinates` | Apenas coordenadas dos países para mapas |
| `GET` | `/api/location/states/:countryCode` | Lista estados/províncias de um país |
| `GET` | `/api/location/cities/:countryCode/:stateCode` | Lista cidades de um estado |

### Cadastro

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/cadastro` | Envia formulário de acolhimento (salva no banco, dispara e-mail) |

### Administração

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/admin/login` | Página de login |
| `POST` | `/admin/login` | Autenticação (usuário + senha) → retorna `{ ok: true }` |
| `POST` | `/admin/logout` | Encerra sessão |
| `GET` | `/admin` | Dashboard (HTML protegido) |
| `GET` | `/admin/api/stats?periodo=semana\|mes\|ano\|todos` | Dados estatísticos (JSON protegido) |

---

## 🤝 Contribuição

Contribuições são bem-vindas! Siga os passos abaixo:

1. Faça um **fork** do projeto
2. Crie uma **branch** para sua feature: `git checkout -b feat/nova-feature`
3. Faça **commit** das alterações: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Faça **push** para a branch: `git push origin feat/nova-feature`
5. Abra um **Pull Request**

### Padrões de commit

- `feat:` — nova funcionalidade
- `fix:` — correção de bug
- `refactor:` — refatoração de código
- `style:` — formatação, estilos (sem mudança de lógica)
- `docs:` — documentação
- `chore:` — tarefas de manutenção

### Diretrizes

- Mantenha o código limpo e bem comentado
- Siga a arquitetura existente (middleware → rotas → views)
- Teste manualmente antes de abrir o PR
- Atualize a documentação se necessário

---

## 📄 Licença

Este projeto está licenciado sob a licença **ISC**.

---

## 📞 Contato

- **Instagram**: [@acolher.life](https://www.instagram.com/acolher.life/)
- **E-mail de acessibilidade**: acessibilidade@acolher.life
- **Site**: [http://localhost:3000](http://localhost:3000) (em desenvolvimento)

---

<div align="center">

**Ministério Acolher** · 💜 *Escuta, Cuidado e Respeito*

*"Um gesto simples pode abrir caminhos de cuidado, e novas histórias podem começar a ser escritas."*

</div>
