// routes/feedback.js
// Avaliações públicas do Ministério Acolher.
//
//   GET  /feedback      -> página pública de avaliação (HTML)
//   POST /api/feedback  -> registra a avaliação (JSON)
//
// Segurança:
//   • Queries 100% parametrizadas (placeholders `?`).
//   • Nota validada como inteiro entre 1 e 5 (aplicação + CHECK no banco).
//   • Mensagem opcional, limitada a 1000 caracteres e sem NUL bytes.
//   • Limitador de taxa em memória (anti-spam) por IP.
//   • Nenhum dado pessoal é solicitado: o único vínculo possível é o
//     `ref` (Base64 do id do cadastro) enviado pelo acolhedor, validado
//     contra a tabela `cadastros` antes de ser gravado.

const express = require('express');
const path = require('path');

const LIMITE_MENSAGEM = 1000;
const LIMITE_REF = 64;

// ─── Decodificação da referência do prontuário ─────────────────────────────
// O acolhedor envia o link `.../feedback?ref=<base64(id)>`. Base64 aqui é
// apenas ofuscação — o valor é decodificado, validado como inteiro positivo
// e conferido contra a tabela `cadastros`. Qualquer falha resulta em NULL
// (avaliação avulsa), nunca em erro para o utente.
function decodificarReferencia(valor) {
    if (typeof valor !== 'string') return null;

    const ref = valor.trim();
    if (!ref || ref.length > LIMITE_REF) return null;
    if (!/^[A-Za-z0-9+/=_-]+$/.test(ref)) return null;

    try {
        const normalizado = ref.replace(/-/g, '+').replace(/_/g, '/');
        const texto = Buffer.from(normalizado, 'base64').toString('utf8').trim();

        if (!/^\d{1,10}$/.test(texto)) return null;

        const id = Number.parseInt(texto, 10);
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch (_) {
        return null;
    }
}

// ─── Limitador de taxa simples (em memória) ────────────────────────────────
// 5 envios por minuto por IP. Suficiente para bloquear scripts de spam sem
// trazer dependências extras. Em múltiplas instâncias, migrar para Redis.
const JANELA_MS = 60 * 1000;
const MAX_ENVIOS_POR_JANELA = 5;
const TENTATIVAS = new Map();

function excedeuLimite(ip) {
    const agora = Date.now();

    // Limpeza preguiçosa para o Map não crescer indefinidamente.
    if (TENTATIVAS.size > 5000) {
        for (const [chave, registro] of TENTATIVAS) {
            if (agora - registro.inicio > JANELA_MS) TENTATIVAS.delete(chave);
        }
    }

    const registro = TENTATIVAS.get(ip);

    if (!registro || agora - registro.inicio > JANELA_MS) {
        TENTATIVAS.set(ip, { inicio: agora, total: 1 });
        return false;
    }

    registro.total += 1;
    return registro.total > MAX_ENVIOS_POR_JANELA;
}

// ─── Normalização da mensagem (opcional) ───────────────────────────────────
function normalizarMensagem(valor) {
    if (typeof valor !== 'string') return null;

    const texto = valor
        .replace(/\u0000/g, '') // remove NUL bytes
        .replace(/\r\n?/g, '\n') // normaliza quebras de linha
        .trim();

    if (!texto) return null;
    return texto.slice(0, LIMITE_MENSAGEM);
}

module.exports = function (dbPool) {
    const router = express.Router();

    // ─── GET /feedback — página pública ───────────────────────────────────
    router.get('/feedback', (req, res) => {
        res.type('html').sendFile(path.join(__dirname, '..', 'views', 'feedback.html'));
    });

    // ─── POST /api/feedback — registra a avaliação ────────────────────────
    router.post('/api/feedback', async (req, res) => {
        if (excedeuLimite(req.ip)) {
            return res.status(429).json({
                ok: false,
                mensagem: 'Recebemos muitas avaliações deste dispositivo. Aguarde um instante e tente novamente.'
            });
        }

        const corpo = req.body || {};

        // Aceita 1..5 como número ou string numérica ("5").
        const nota = typeof corpo.nota === 'string'
            ? Number.parseInt(corpo.nota, 10)
            : corpo.nota;

        if (typeof nota !== 'number' || !Number.isInteger(nota) || nota < 1 || nota > 5) {
            return res.status(400).json({
                ok: false,
                mensagem: 'Selecione uma nota entre 1 e 5 corações.'
            });
        }

        if (corpo.mensagem !== undefined && corpo.mensagem !== null && typeof corpo.mensagem !== 'string') {
            return res.status(400).json({
                ok: false,
                mensagem: 'O testemunho deve ser um texto.'
            });
        }

        const mensagem = normalizarMensagem(corpo.mensagem);
        let cadastroId = decodificarReferencia(corpo.ref);

        try {
            // Confirma que o prontuário referenciado existe. Se não existir,
            // a avaliação é registrada sem vínculo (evita erro de FK).
            if (cadastroId !== null) {
                const [existe] = await dbPool.query(
                    'SELECT id FROM cadastros WHERE id = ? LIMIT 1',
                    [cadastroId]
                );
                if (!existe.length) cadastroId = null;
            }

            const [resultado] = await dbPool.query(
                'INSERT INTO feedbacks (nota, mensagem, cadastro_id) VALUES (?, ?, ?)',
                [nota, mensagem, cadastroId]
            );

            return res.status(201).json({
                ok: true,
                mensagem: 'Obrigado por compartilhar! Sua avaliação foi registrada com carinho.',
                id: resultado.insertId
            });
        } catch (err) {
            console.error('❌ Erro ao registrar feedback:', err.message);
            return res.status(500).json({
                ok: false,
                mensagem: 'Não foi possível registrar sua avaliação agora. Tente novamente em instantes.'
            });
        }
    });

    return router;
};
