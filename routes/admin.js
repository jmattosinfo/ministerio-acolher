// routes/admin.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { extrairUFdaString, resolverCidadeParaUF } = require('../utils/geocode');

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

            // Agregação do campo "Onde conheceu o Acolher" — query resiliente
            let ondeConheceuRows = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(onde_conheceu), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                ondeConheceuRows = rows;
            } catch (err) {
                console.warn('⚠️ Query onde_conheceu falhou (coluna pode não existir):', err.message);
            }

            // Agregação do campo "Rede de apoio"
            const [redeApoioRows] = await conn.query(
                `SELECT COALESCE(NULLIF(TRIM(rede_apoio), ''), 'Não informado') AS chave, COUNT(*) AS total
                 FROM cadastros ${filtroData}
                 GROUP BY rede_apoio`
            );

            // Agregação do campo "País" — query resiliente (não quebra todo o stats se falhar)
            let paisesRows = [];
            try {
                const [rows] = await conn.query(
                    `SELECT COALESCE(NULLIF(TRIM(pais), ''), 'Não informado') AS chave, COUNT(*) AS total
                     FROM cadastros ${filtroData}
                     GROUP BY chave
                     ORDER BY total DESC`
                );
                paisesRows = rows;
            } catch (err) {
                console.warn('⚠️ Query de países falhou (coluna pode não existir):', err.message);
            }

            conn.release();

            res.json({
                ok: true,
                total: totalRows[0].total,
                sexo: sexoRows,
                estadoCivil: estadoCivilRows,
                faixaEtaria: calcularFaixasEtarias(nascimentoRows),
                motivo: agruparMotivos(motivoRows),
                localizacao: await agregarPorEstado(localizacaoRows),
                ondeConheceu: ondeConheceuRows,
                redeApoio: redeApoioRows,
                paises: paisesRows
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
// Delega para a função compartilhada em utils/geocode.js
function extrairUF(localizacao) {
    return extrairUFdaString(localizacao);
}

// Cache para resoluções de cidade → UF feitas durante a agregação de stats
const resolucaoCache = new Map();

// Agrega os registros de localização por estado (UF)
// Se a localização não contiver uma UF reconhecível, tenta resolver
// o nome da cidade via Nominatim (com cache compartilhado).
// Se mesmo assim não for possível, usa o valor original informado pelo usuário.
async function agregarPorEstado(linhas) {
    const mapa = new Map();

    // Primeira passada: extrai UF das strings que já têm formato reconhecível
    const pendentes = []; // valores originais sem UF detectada
    linhas.forEach(({ localizacao }) => {
        const uf = extrairUF(localizacao);
        if (uf) {
            mapa.set(uf, (mapa.get(uf) || 0) + 1);
        } else {
            pendentes.push(localizacao);
        }
    });

    // Segunda passada: tenta resolver cidades sem UF via Nominatim
    if (pendentes.length > 0) {
        // Agrupa cidades iguais para evitar chamadas duplicadas
        const cidadesUnicas = [...new Set(pendentes.map(s => (s || '').trim().toUpperCase()).filter(Boolean))];

        // Resolve cada cidade única (com cache compartilhado via módulo)
        const resolucoes = await Promise.all(
            cidadesUnicas.map(async (cidadeUpper) => {
                const original = pendentes.find(s => s && s.trim().toUpperCase() === cidadeUpper) || cidadeUpper;
                const uf = await resolverCidadeParaUF(original);
                return { cidade: cidadeUpper, uf, original };
            })
        );

        const resolucaoMap = new Map(resolucoes.map(r => [r.cidade, { uf: r.uf, original: r.original }]));

        pendentes.forEach((localizacao) => {
            const chave = localizacao ? localizacao.trim().toUpperCase() : '';
            const resolucao = chave ? resolucaoMap.get(chave) : null;

            if (resolucao && resolucao.uf) {
                // Conseguiu resolver → usa a UF
                mapa.set(resolucao.uf, (mapa.get(resolucao.uf) || 0) + 1);
            } else {
                // Não conseguiu resolver → mostra o valor original que o usuário digitou
                const textoOriginal = (resolucao ? resolucao.original : localizacao || '').trim();
                const chaveExibicao = textoOriginal
                    ? (textoOriginal.length > 40 ? textoOriginal.substring(0, 37) + '...' : textoOriginal)
                    : 'Não informado';
                mapa.set(chaveExibicao, (mapa.get(chaveExibicao) || 0) + 1);
            }
        });
    }

    return Array.from(mapa.entries())
        .map(([chave, total]) => ({ chave, total }))
        .sort((a, b) => b.total - a.total);
}
