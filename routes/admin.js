// routes/admin.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

// Recebe o dbPool já criado no server.js
module.exports = function (dbPool) {
    const router = express.Router();

    // ─── Tela de login ────────────────────────────────────────────────────
    router.get('/login', (req, res) => {
        if (req.session && req.session.autenticado) {
            return res.redirect('/admin');
        }
        res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'login.html'));
    });

    router.post('/login', async (req, res) => {
        const { usuario, senha } = req.body;

        const usuarioValido = usuario === process.env.ADMIN_USERNAME;
        const senhaValida = usuarioValido
            ? await bcrypt.compare(senha || '', process.env.ADMIN_PASSWORD_HASH || '')
            : false;

        if (!usuarioValido || !senhaValida) {
            return res.status(401).json({ ok: false, mensagem: 'Usuário ou senha inválidos.' });
        }

        req.session.autenticado = true;
        req.session.usuario = usuario;
        res.json({ ok: true });
    });

    router.post('/logout', (req, res) => {
        req.session.destroy(() => {
            res.json({ ok: true });
        });
    });

    // ─── Dashboard (HTML protegido) ───────────────────────────────────────
    router.get('/', requireAuth, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'dashboard.html'));
    });

    // ─── API de estatísticas (JSON protegido) — 100% resiliente ──────────
    router.get('/api/stats', requireAuth, async (req, res) => {
        const periodo = req.query.periodo || 'todos';

        let filtroData = '';
        if (periodo === 'semana') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        else if (periodo === 'mes') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        else if (periodo === 'ano') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';

        let conn;
        try {
            conn = await dbPool.getConnection();
        } catch (err) {
            console.error('❌ Erro de conexão com o banco:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro de conexão com o banco de dados.' });
        }

        try {
            // --- Total de pessoas ---
            let total = 0;
            try {
                const [rows] = await conn.query(`SELECT COUNT(*) AS total FROM cadastros ${filtroData}`);
                total = rows[0]?.total || 0;
            } catch (err) {
                console.warn('⚠️ Query total falhou:', err.message);
            }

            // --- Perfil de triagem (sexo) ---
            let sexo = [];
            try {
                const [rows] = await conn.query(
                    `SELECT perfil_triagem AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY perfil_triagem`
                );
                sexo = rows;
            } catch (err) {
                console.warn('⚠️ Query perfil_triagem falhou:', err.message);
            }

            // --- Estado civil ---
            let estadoCivil = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(estado_civil, 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY estado_civil`
                );
                estadoCivil = rows;
            } catch (err) {
                console.warn('⚠️ Query estado_civil falhou:', err.message);
            }

            // --- Data de nascimento (para faixa etária) ---
            let nascimento = [];
            try {
                const [rows] = await conn.query(
                    `SELECT data_nascimento FROM cadastros ${filtroData}`
                );
                nascimento = rows;
            } catch (err) {
                console.warn('⚠️ Query data_nascimento falhou:', err.message);
            }

            // --- Motivo da terapia ---
            let motivo = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(motivo_terapia), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                motivo = rows;
            } catch (err) {
                console.warn('⚠️ Query motivo_terapia falhou:', err.message);
            }

            // --- Localização (Cidade/Estado) ---
            let localizacao = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(localizacao), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                localizacao = rows;
            } catch (err) {
                console.warn('⚠️ Query localizacao falhou:', err.message);
            }

            // --- Onde conheceu o Acolher ---
            let ondeConheceu = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(onde_conheceu), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                ondeConheceu = rows;
            } catch (err) {
                console.warn('⚠️ Query onde_conheceu falhou:', err.message);
            }

            // --- Rede de apoio ---
            let redeApoio = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(rede_apoio), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                redeApoio = rows;
            } catch (err) {
                console.warn('⚠️ Query rede_apoio falhou:', err.message);
            }

            // --- Países ---
            let paises = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(pais), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                paises = rows;
            } catch (err) {
                console.warn('⚠️ Query paises falhou:', err.message);
            }

            conn.release();

            res.json({
                ok: true,
                total,
                sexo,
                estadoCivil,
                faixaEtaria: calcularFaixasEtarias(nascimento),
                motivo: agruparMotivos(motivo),
                localizacao,
                ondeConheceu,
                redeApoio,
                paises
            });
        } catch (err) {
            console.error('❌ Erro inesperado ao buscar estatísticas:', err.message);
            if (conn) try { conn.release(); } catch (_) {}
            res.status(500).json({ ok: false, mensagem: 'Erro ao buscar estatísticas.' });
        }
    });

    return router;
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function calcularFaixasEtarias(linhas) {
    const faixas = {
        'Menor de 18': 0,
        '18-25': 0,
        '26-35': 0,
        '36-45': 0,
        '46-60': 0,
        'Acima de 60': 0,
        'Não informado': 0
    };

    const hoje = new Date();

    linhas.forEach(({ data_nascimento }) => {
        if (!data_nascimento) {
            faixas['Não informado']++;
            return;
        }
        const nascimento = new Date(data_nascimento);
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const aindaNaoFezAniversario =
            hoje.getMonth() < nascimento.getMonth() ||
            (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
        if (aindaNaoFezAniversario) idade--;

        if (idade < 18) faixas['Menor de 18']++;
        else if (idade <= 25) faixas['18-25']++;
        else if (idade <= 35) faixas['26-35']++;
        else if (idade <= 45) faixas['36-45']++;
        else if (idade <= 60) faixas['46-60']++;
        else faixas['Acima de 60']++;
    });

    return Object.entries(faixas).map(([chave, total]) => ({ chave, total }));
}

// Como "motivo_terapia" é texto livre, agrupamos os 10 valores mais frequentes
// e somamos o restante em "Outros" para o gráfico não ficar poluído.
function agruparMotivos(linhas) {
    const topDez = linhas.slice(0, 10);
    const resto = linhas.slice(10).reduce((soma, l) => soma + l.total, 0);
    if (resto > 0) {
        topDez.push({ chave: 'Outros', total: resto });
    }
    return topDez;
}

