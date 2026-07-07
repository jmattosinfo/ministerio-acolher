require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const session = require('express-session'); // NOVO

const app = express();
const PORT = process.env.PORT || 3000;

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
    waitForConnections: true,
    connectionLimit: 10
});

// ─── Criação da tabela ───────────────────────────────────────────────────────
async function inicializarBanco() {
    try {
        const conn = await dbPool.getConnection();
        await conn.query(`
            CREATE TABLE IF NOT EXISTS cadastros (
                id                       INT AUTO_INCREMENT PRIMARY KEY,
                perfil_triagem           VARCHAR(30)  NOT NULL,
                profissional_responsavel VARCHAR(50)  NOT NULL,
                nome                     VARCHAR(150) NOT NULL,
                data_nascimento          DATE,
                localizacao              VARCHAR(150),
                whatsapp                 VARCHAR(30)  NOT NULL,
                estado_civil             VARCHAR(30),
                rede_apoio               VARCHAR(30),
                motivo_terapia           TEXT,
                preferencia_horario      VARCHAR(30),
                termo_sigilo             TINYINT(1) DEFAULT 0,
                termo_sessoes            TINYINT(1) DEFAULT 0,
                termo_gratuidade         TINYINT(1) DEFAULT 0,
                criado_em                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        conn.release();
        console.log('✅ Banco de dados inicializado com sucesso.');
    } catch (err) {
        console.error('❌ Erro ao inicializar banco:', err.message);
    }
}

inicializarBanco();

// ─── Rotas do painel administrativo (NOVO) ───────────────────────────────────
const adminRoutes = require('./routes/admin')(dbPool);
app.use('/admin', adminRoutes);

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
                <tr><td style="padding:8px;font-weight:bold;">WhatsApp</td><td style="padding:8px;">${d.whatsapp || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Estado civil</td><td style="padding:8px;">${d.estado_civil || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;">Rede de apoio</td><td style="padding:8px;">${d.rede_apoio || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Horário preferido</td><td style="padding:8px;">${d.preferencia_horario || '-'}</td></tr>
                <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">Motivo</td><td style="padding:8px;">${d.motivo_terapia || '-'}</td></tr>
                <tr style="background:#F4EFE6"><td style="padding:8px;font-weight:bold;">Perfil de triagem</td><td style="padding:8px;">${d.perfil_triagem || '-'}</td></tr>
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

    try {
        // Salva no banco
        const conn = await dbPool.getConnection();
        await conn.query(`
            INSERT INTO cadastros (
                perfil_triagem, profissional_responsavel,
                nome, data_nascimento, localizacao, whatsapp,
                estado_civil, rede_apoio, motivo_terapia, preferencia_horario,
                termo_sigilo, termo_sessoes, termo_gratuidade
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            perfil, profissional.nome,
            d.nome || null, d.data_nascimento || null,
            d.localizacao || null, d.whatsapp || null,
            d.estado_civil || null, d.rede_apoio || null,
            d.motivo_terapia || null, d.preferencia_horario || null,
            d.termo_sigilo ? 1 : 0,
            d.termo_sessoes ? 1 : 0,
            d.termo_gratuidade ? 1 : 0
        ]);
        conn.release();

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

// ─── Fallback ────────────────────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌹 Servidor do Ministério Acolher rodando na porta ${PORT}`);
});