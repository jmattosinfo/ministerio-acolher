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

    // ─── API de estatísticas (JSON protegido) ─────────────────────────────
    router.get('/api/stats', requireAuth, async (req, res) => {
        const periodo = req.query.periodo || 'todos'; // semana | mes | ano | todos

        let filtroData = '';
        if (periodo === 'semana') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        else if (periodo === 'mes') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        else if (periodo === 'ano') filtroData = 'WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';

        try {
            const conn = await dbPool.getConnection();

            const [totalRows] = await conn.query(
                `SELECT COUNT(*) AS total FROM cadastros ${filtroData}`
            );

            const [sexoRows] = await conn.query(
                `SELECT perfil_triagem AS chave, COUNT(*) AS total
                 FROM cadastros ${filtroData}
                 GROUP BY perfil_triagem`
            );

            const [estadoCivilRows] = await conn.query(
                `SELECT COALESCE(estado_civil, 'Não informado') AS chave, COUNT(*) AS total
                 FROM cadastros ${filtroData}
                 GROUP BY estado_civil`
            );

            const [nascimentoRows] = await conn.query(
                `SELECT data_nascimento FROM cadastros ${filtroData}`
            );

            const [motivoRows] = await conn.query(
                `SELECT COALESCE(NULLIF(TRIM(motivo_terapia), ''), 'Não informado') AS chave, COUNT(*) AS total
                 FROM cadastros ${filtroData}
                 GROUP BY chave
                 ORDER BY total DESC`
            );

            // Busca dados brutos de localização para agregar por estado no JS
            const [localizacaoRows] = await conn.query(
                `SELECT localizacao FROM cadastros ${filtroData}`
            );

            conn.release();

            res.json({
                ok: true,
                total: totalRows[0].total,
                sexo: sexoRows,
                estadoCivil: estadoCivilRows,
                faixaEtaria: calcularFaixasEtarias(nascimentoRows),
                motivo: agruparMotivos(motivoRows),
                localizacao: agregarPorEstado(localizacaoRows)
            });
        } catch (err) {
            console.error('❌ Erro ao buscar estatísticas:', err.message);
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

// Extrai a UF (sigla do estado) de strings como "Porto Alegre – RS", "SP", etc.
function extrairUF(localizacao) {
    if (!localizacao || typeof localizacao !== 'string') return null;
    const trimmed = localizacao.trim();
    // Tenta separar por "–" (em dash) ou "-" (hífen)
    const partes = trimmed.split(/[–-]/).map(s => s.trim());
    if (partes.length > 1) {
        const uf = partes[partes.length - 1].toUpperCase();
        if (/^[A-Z]{2}$/.test(uf)) return uf;
    }
    // Se a string inteira for uma UF válida
    if (/^[A-Z]{2}$/.test(trimmed.toUpperCase())) return trimmed.toUpperCase();
    return null;
}

// Agrega os registros de localização por estado (UF)
function agregarPorEstado(linhas) {
    const mapa = new Map();
    linhas.forEach(({ localizacao }) => {
        const uf = extrairUF(localizacao);
        const chave = uf || 'Não informado';
        mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return Array.from(mapa.entries())
        .map(([chave, total]) => ({ chave, total }))
        .sort((a, b) => b.total - a.total);
}
