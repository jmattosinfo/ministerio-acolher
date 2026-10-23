require('dotenv').config(); // carrega variáveis de ambiente .env
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const session = require('express-session');
const { enriquecerLocalizacao, estadoParaSigla } = require('./utils/geocode');
const locationRoutes = require('./routes/location');

const app = express();
app.set('trust proxy', 1); // necessário se estiver atrás de um proxy (ex: Heroku, Nginx)
const PORT = process.env.PORT || 3000;

// ─── Codificação UTF-8 (correção crítica) ────────────────────────────────────
// Garante `charset=utf-8` em TODAS as respostas textuais (HTML, JSON, CSS,
// JS, SVG). Sem isto, alguns clientes/proxies assumem ISO-8859-1 e a acentuação
// aparece corrompida ("SÃ£o JosÃ© dos Campos â€“ SP").
app.use((req, res, next) => {
    const setHeaderOriginal = res.setHeader.bind(res);

    res.setHeader = (nome, valor) => {
        if (
            String(nome).toLowerCase() === 'content-type' &&
            typeof valor === 'string' &&
            /^(text\/|application\/(json|javascript|xml|manifest\+json))/i.test(valor) &&
            !/charset=/i.test(valor)
        ) {
            valor = `${valor}; charset=utf-8`;
        }
        return setHeaderOriginal(nome, valor);
    };

    next();
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Sessão (NOVO) ────────────────────────────────────────────────────────────
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

// ─── Pool de conexão MySQL ───────────────────────────────────────────────────
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // utf8mb4 evita o duplo-encoding ("SÃ£o" em vez de "São") e suporta
    // acentos, cedilhas, travessões (â€“) e emojis nos testemunhos.
    // No mysql2, `charset` define o par charset/collation da conexão
    // (a opção `collation` não é aceita pelo pool).
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10
});

// ─── Criação da tabela ───────────────────────────────────────────────────────
async function inicializarBanco(tentativas = 10) {
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
        try {
            const conn = await dbPool.getConnection();
            await conn.query(`
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
                    status_acolhimento       VARCHAR(30) DEFAULT 'pendente',
                    notas_sessao_1           TEXT,
                    notas_sessao_2           TEXT,
                    notas_sessao_3           TEXT,
                    tentativas_contato       INT DEFAULT 0,
                    proximo_lembrete         DATE,
                    criado_em                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS acolhedores (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    nome          VARCHAR(100) NOT NULL,
                    email         VARCHAR(150) NOT NULL UNIQUE,
                    senha_hash    VARCHAR(255) NULL,
                    perfil        ENUM('admin', 'acolhedor') DEFAULT 'acolhedor',
                    ativo         TINYINT(1) DEFAULT 1,
                    sessao_versao INT NOT NULL DEFAULT 0,
                    criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            await conn.query(`
                CREATE TABLE IF NOT EXISTS tokens_primeiro_acesso (
                    id            INT AUTO_INCREMENT PRIMARY KEY,
                    acolhedor_id  INT NOT NULL,
                    token         VARCHAR(128) NOT NULL UNIQUE,
                    usado         TINYINT(1) DEFAULT 0,
                    expira_em     DATETIME NOT NULL,
                    criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (acolhedor_id) REFERENCES acolhedores(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // ─── Avaliações (feedback) recebidas pelo site público ────────
            // `cadastro_id` é opcional: o link enviado pelo acolhedor carrega um
            // `?ref=` (Base64 do id do cadastro) que vincula a avaliação ao
            // prontuário. Se o utente avaliar pelo site público, fica NULL.
            // ON DELETE SET NULL preserva a avaliação mesmo que o prontuário
            // precise ser eliminado por pedido de titular (LGPD).
            await conn.query(`
                CREATE TABLE IF NOT EXISTS feedbacks (
                    id          INT AUTO_INCREMENT PRIMARY KEY,
                    nota        INT NOT NULL COMMENT 'Nota de 1 a 5',
                    mensagem    TEXT NULL,
                    cadastro_id INT NULL COMMENT 'Vínculo opcional com o prontuário avaliado',
                    criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_feedbacks_criado_em (criado_em),
                    INDEX idx_feedbacks_cadastro_id (cadastro_id),
                    CONSTRAINT fk_feedbacks_cadastro
                        FOREIGN KEY (cadastro_id) REFERENCES cadastros(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);

            // ─── Migração: vínculo feedback ↔ prontuário ─────────────────
            // Tabelas `feedbacks` criadas antes desta versão não possuem a
            // coluna nem a chave estrangeira; criamos ambas se necessário.
            try {
                const [colunaFeedback] = await conn.query(
                    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS
                      WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'feedbacks'
                        AND COLUMN_NAME = 'cadastro_id'`
                );

                if (colunaFeedback[0].total === 0) {
                    await conn.query(
                        'ALTER TABLE feedbacks ADD COLUMN cadastro_id INT NULL AFTER mensagem'
                    );
                    await conn.query(
                        'ALTER TABLE feedbacks ADD INDEX idx_feedbacks_cadastro_id (cadastro_id)'
                    ).catch(() => { /* índice já existente ou versão sem suporte */ });
                    console.log('✅ Coluna "feedbacks.cadastro_id" adicionada com sucesso.');
                }

                const [chaveEstrangeira] = await conn.query(
                    `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                      WHERE TABLE_SCHEMA = DATABASE()
                        AND TABLE_NAME = 'feedbacks'
                        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
                        AND CONSTRAINT_NAME = 'fk_feedbacks_cadastro'`
                );

                if (chaveEstrangeira[0].total === 0) {
                    await conn.query(
                        `ALTER TABLE feedbacks
                           ADD CONSTRAINT fk_feedbacks_cadastro
                           FOREIGN KEY (cadastro_id) REFERENCES cadastros(id) ON DELETE SET NULL`
                    );
                    console.log('✅ Chave estrangeira "fk_feedbacks_cadastro" criada com sucesso.');
                }
            } catch (e) {
                console.warn('⚠️ Não foi possível migrar o vínculo "feedbacks.cadastro_id":', e.message);
            }

            // Integridade da nota garantida também no banco (MySQL 8+).
            // Em versões sem suporte a CHECK o erro é ignorado — a validação
            // da aplicação continua sendo a fonte de verdade.
            try {
                await conn.query(
                    'ALTER TABLE feedbacks ADD CONSTRAINT chk_feedbacks_nota CHECK (nota BETWEEN 1 AND 5)'
                );
            } catch (_) {
                /* constraint já existe ou versão sem suporte a CHECK */
            }

            // Migração: adiciona colunas que podem não existir em tabelas antigas
            const colunasNecessarias = {
                'pais': 'VARCHAR(100) AFTER localizacao',
                'onde_conheceu': 'VARCHAR(50) AFTER preferencia_horario',
                'status_acolhimento': "VARCHAR(30) DEFAULT 'pendente' AFTER termo_gratuidade",
                'notas_sessao_1': 'TEXT AFTER status_acolhimento',
                'notas_sessao_2': 'TEXT AFTER notas_sessao_1',
                'notas_sessao_3': 'TEXT AFTER notas_sessao_2',
                'tentativas_contato': 'INT DEFAULT 0 AFTER notas_sessao_3',
                'proximo_lembrete': 'DATE AFTER tentativas_contato',
                'atualizado_em': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em'
            };

            for (const [coluna, definicao] of Object.entries(colunasNecessarias)) {
                try {
                    const [existe] = await conn.query(
                        `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS
                         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cadastros' AND COLUMN_NAME = ?`,
                        [coluna]
                    );
                    if (existe[0].total === 0) {
                        await conn.query(`ALTER TABLE cadastros ADD COLUMN ${coluna} ${definicao}`);
                        console.log(`✅ Coluna "${coluna}" adicionada com sucesso.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Não foi possível verificar/adicionar coluna "${coluna}":`, e.message);
                }
            }

            // Migração da tabela `acolhedores`: coluna de versão de sessão,
            // usada para invalidar sessões ativas quando um admin bloqueia
            // ou reativa um usuário.
            const colunasAcolhedores = {
                'sessao_versao': 'INT NOT NULL DEFAULT 0 AFTER ativo'
            };

            for (const [coluna, definicao] of Object.entries(colunasAcolhedores)) {
                try {
                    const [existe] = await conn.query(
                        `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.COLUMNS
                         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'acolhedores' AND COLUMN_NAME = ?`,
                        [coluna]
                    );
                    if (existe[0].total === 0) {
                        await conn.query(`ALTER TABLE acolhedores ADD COLUMN ${coluna} ${definicao}`);
                        console.log(`✅ Coluna "acolhedores.${coluna}" adicionada com sucesso.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Não foi possível verificar/adicionar coluna "acolhedores.${coluna}":`, e.message);
                }
            }

            // ─── Garantia de charset nas tabelas de texto ─────────────────
            // `CREATE TABLE IF NOT EXISTS` não altera tabelas antigas criadas
            // com o charset padrão do servidor (frequentemente latin1). Sem
            // esta migração o pool utf8mb4 não é suficiente para preservar
            // acentos no banco.
            const tabelasUtf8mb4 = ['cadastros', 'acolhedores', 'tokens_primeiro_acesso', 'feedbacks'];

            for (const tabela of tabelasUtf8mb4) {
                try {
                    const [colacao] = await conn.query(
                        `SELECT TABLE_COLLATION AS collation
                           FROM INFORMATION_SCHEMA.TABLES
                          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                        [tabela]
                    );
                    const atual = colacao[0] && colacao[0].collation;

                    if (atual && !/^utf8mb4/i.test(atual)) {
                        // Nome de tabela vem de lista fixa (sem injeção).
                        await conn.query(
                            `ALTER TABLE ${tabela} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
                        );
                        console.log(`✅ Tabela "${tabela}" convertida para utf8mb4.`);
                    }
                } catch (e) {
                    console.warn(`⚠️ Não foi possível converter a tabela "${tabela}" para utf8mb4:`, e.message);
                }
            }

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

inicializarBanco();

// ─── Configuração do Nodemailer (Brevo) ─────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ─── Rotas do painel administrativo ─────────────────────────────────────────
// O dashboard admin precisa do transporter para disparar convites de acesso
// (cadastro de acolhedores / reenvio de link).
const adminRoutes = require('./routes/admin')(dbPool, transporter);
app.use('/admin', adminRoutes);

// ─── Rotas de localização (países, estados, cidades) ────────────────────────
app.use('/api/location', locationRoutes);

// ─── Rotas unificadas de autenticação / recuperação de senha ────────────────
// Montadas na raiz porque expõem:
//   POST /api/esqueci-senha
//   GET  /redefinir-senha
//   POST /api/redefinir-senha
const authRoutes = require('./routes/auth')(dbPool, transporter);
app.use('/', authRoutes);

// ─── Feedback público (avaliações) ─────────────────────────────────────────
//   GET  /feedback      -> página pública de avaliação (HTML)
//   POST /api/feedback  -> registra a avaliação (JSON, queries parametrizadas)
const feedbackRoutes = require('./routes/feedback')(dbPool);
app.use('/', feedbackRoutes);

// ─── Rotas de gestão do ACOLHEDOR ───────────────────────────────────────────
// Um único prefixo ('/acolhedor') serve a VIEW e a API JSON:
//   GET   /acolhedor/painel            -> entrega views/acolhedor/painel.html
//   GET   /acolhedor/atendimentos      -> JSON (lista, filtros via query string)
//   PATCH /acolhedor/atendimentos/:id  -> JSON (atualização parcial)
// O front-end (public/js/acolhedor.js) usa API_BASE = '/acolhedor'.
const acolhedorRoutes = require('./routes/acolhedor')(dbPool);
app.use('/acolhedor', acolhedorRoutes);

// -----ROTAS DE GESTÃO DO PROFISSIONAL---------
// const profissionalRoutes = require('./routes/profissional')(dbPool);
// app.use('/api/profissional', profissionalRoutes);


// ─── Profissionais ───────────────────────────────────────────────────────────
const PROFISSIONAIS = {
    homem: {
        nome: 'Matheus',
        email: 'matheussantosqmc@gmail.com',
        whatsapp: '5548996685580',
        whatsappFormatado: '(48) 9 9668-5580'
    },
    vitima_abuso: {
        nome: 'Kelly',
        email: 'orquideawolff@gmail.com',
        whatsapp: '5551999336247',
        whatsappFormatado: '(51) 9 9933-6247'
    }
};

// Round-robin entre Agda, Gabriela e Shirley para categoria "mulher"
const EQUIPE_MULHER = [
    {
        nome: 'Agda',
        email: 'acolhedoraagda@gmail.com',
        whatsapp: '5561996266348',
        whatsappFormatado: '(61) 9 9626-6348'
    },
    {
        nome: 'Gabriela',
        email: 'gabrielaherculano1987@gmail.com',
        whatsapp: '5585984355097',
        whatsappFormatado: '(85) 9 8435-5097'
    },
    {
        nome: 'Shirley',
        email: 'shirleyvale@gmail.com',
        whatsapp: '556581187655',
        whatsappFormatado: '(65) 9 8118-7655'
    }
];

let indiceRoundRobin = 0;

function proximoProfissionalMulher() {
    const prof = EQUIPE_MULHER[indiceRoundRobin];
    indiceRoundRobin = (indiceRoundRobin + 1) % EQUIPE_MULHER.length;
    return prof;
}

function obterProfissional(perfil) {
    if (perfil === 'mulher') return proximoProfissionalMulher();
    return PROFISSIONAIS[perfil] || null;
}

// ─── Geocoding via Nominatim (OpenStreetMap) ─────────────────────────────────
// A função enriquecerLocalizacao() está definida em ./utils/geocode.js
// É importada no topo deste arquivo e usada no POST /api/cadastro
// O cache é compartilhado com routes/admin.js via mesmo módulo

// ─── Template de e-mail ──────────────────────────────────────────────────────
function montarEmailHtml(d, profissional) {
    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #2C1A1A;">
            <h2 style="color: #7A1C1C; border-bottom: 2px solid #F4EFE6; padding-bottom: 8px;">
                🌹 Novo acolhimento recebido
            </h2>
            <p>Um novo formulário foi preenchido e direcionado a <strong>${profissional.nome}</strong>.</p>

            <table style="width:100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Nome</td><td style="padding:8px;">${d.nome || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">Data de nascimento</td><td style="padding:8px;">${d.data_nascimento || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Cidade / Estado</td><td style="padding:8px;">${d.localizacao || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">País</td><td style="padding:8px;">${d.pais || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">WhatsApp</td><td style="padding:8px;">${d.whatsapp || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Estado civil</td><td style="padding:8px;">${d.estado_civil || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">Rede de apoio</td><td style="padding:8px;">${d.rede_apoio || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Horário preferido</td><td style="padding:8px;">${d.preferencia_horario || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">Motivo</td><td style="padding:8px;">${d.motivo_terapia || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Onde conheceu o Acolher</td><td style="padding:8px;">${d.onde_conheceu || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">Perfil de triagem</td><td style="padding:8px;">${d.perfil_triagem || '-'}</td></tr>
            </table>

            <p style="margin-top:24px; font-size:12px; color:#888; border-top:1px solid #eee; padding-top:12px;">
                Ministério Acolher — informação estritamente confidencial. Trate com sigilo absoluto.
            </p>
        </div>
    `;
}

// ─── POST /api/cadastro ──────────────────────────────────────────────────────
app.post('/api/cadastro', async (req, res) => {
    const d = req.body;
    const perfil = d.perfil_triagem;
    const profissional = obterProfissional(perfil);

    if (!profissional) {
        return res.status(400).json({ ok: false, mensagem: 'Perfil de triagem inválido.' });
    }

    // Valida cidade e país (obrigatórios)
    const cidade = (d.cidade || '').trim();
    const estado = (d.estado || '').trim();
    const pais = (d.pais || '').trim();
    if (!cidade || !pais) {
        return res.status(400).json({ ok: false, mensagem: 'Cidade e país são obrigatórios.' });
    }

    try {
        // Monta localizacao com formato padronizado para permitir agregação por UF no dashboard
        let localizacaoRaw;
        if (estado && pais === 'BR') {
            // Para o Brasil, converte o nome completo do estado para a sigla UF
            // Ex: "Rio Grande do Sul" → "RS", "SP" (já sigla) → "SP"
            const uf = /^[A-Z]{2}$/i.test(estado)
                ? estado.toUpperCase()
                : estadoParaSigla(estado.toUpperCase()) || estado;
            localizacaoRaw = `${cidade} – ${uf}`;
        } else if (estado) {
            // Para outros países com estado/província
            localizacaoRaw = `${cidade}, ${estado} – ${pais}`;
        } else {
            localizacaoRaw = `${cidade} – ${pais}`;
        }
        // Tenta enriquecer via Nominatim (fallback p/ dados sem estado, ex: API externa)
        const localizacao = await enriquecerLocalizacao(localizacaoRaw);

        // Salva no banco
        const conn = await dbPool.getConnection();
        await conn.query(`
            INSERT INTO cadastros (
                perfil_triagem, profissional_responsavel,
                nome, data_nascimento, localizacao, pais, whatsapp,
                estado_civil, rede_apoio, motivo_terapia, preferencia_horario,
                onde_conheceu,
                termo_sigilo, termo_sessoes, termo_gratuidade
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            perfil, profissional.nome,
            d.nome || null, d.data_nascimento || null,
            localizacao, pais || null, d.whatsapp || null,
            d.estado_civil || null, d.rede_apoio || null,
            d.motivo_terapia || null, d.preferencia_horario || null,
            d.onde_conheceu || null,
            d.termo_sigilo ? 1 : 0,
            d.termo_sessoes ? 1 : 0,
            d.termo_gratuidade ? 1 : 0
        ]);
        conn.release();

        // Garante que o campo localizacao esteja disponível no template de e-mail
        d.localizacao = localizacaoRaw;

        // Dispara e-mail para o profissional
        await transporter.sendMail({
            from: `"Ministério Acolher" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: profissional.email,
            subject: `🌹 Novo acolhimento — ${d.nome || 'Pessoa em busca de apoio'}`,
            html: montarEmailHtml(d, profissional)
        });

        // Retorna contato do profissional para o front
        res.status(200).json({
            ok: true,
            mensagem: 'Formulário recebido com sucesso.',
            profissional: {
                nome: profissional.nome,
                whatsapp: profissional.whatsapp,
                whatsappFormatado: profissional.whatsappFormatado
            }
        });

    } catch (err) {
        console.error('❌ Erro ao processar cadastro:', err.message);
        res.status(500).json({
            ok: false,
            mensagem: 'Erro ao processar o envio. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.'
        });
    }
});

app.get('/healthz', (req, res) => {
    res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});
// ─── Fallback ────────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌹 Servidor do Ministério Acolher rodando na porta ${PORT}`);
});