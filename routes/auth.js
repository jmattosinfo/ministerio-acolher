// routes/auth.js
// Fluxo unificado de recuperação/redefinição de senha do Ministério Acolher.
//
//   POST /api/esqueci-senha   -> gera token e envia e-mail (Nodemailer/Brevo)
//   GET  /redefinir-senha     -> valida o token e entrega a view de redefinição
//   POST /api/redefinir-senha -> grava a nova senha e invalida o token
//
// Todas as consultas usam parâmetros (?) para evitar SQL injection.
// O token é salvo na tabela `tokens_primeiro_acesso`, que também é usada
// para convites de primeiro acesso — o campo `usado` diferencia os estados.

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Validade do link de redefinição: 2 horas (aplicada no próprio MySQL,
// via DATE_ADD(NOW(), ...), evitando divergência de fuso horário entre Node e DB).

const MENSAGEM_GENERICA =
    'Se este e-mail estiver cadastrado em nossa equipe, enviaremos as instruções de recuperação em instantes. Verifique também sua caixa de spam.';

module.exports = function (dbPool, transporter) {
    const router = express.Router();

    // ─── POST /api/esqueci-senha ──────────────────────────────────────────
    router.post('/api/esqueci-senha', async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();

        if (!email) {
            return res.status(400).json({ ok: false, mensagem: 'Informe o e-mail cadastrado.' });
        }

        try {
            const [usuarios] = await dbPool.query(
                'SELECT id, nome, email, ativo FROM acolhedores WHERE email = ?',
                [email]
            );

            const usuario = usuarios[0];

            // Segurança: mesmo que o e-mail não exista (ou esteja inativo),
            // devolvemos a mesma mensagem para evitar enumeração de contas.
            if (usuario && usuario.ativo) {
                // Invalida tokens anteriores ainda não utilizados deste usuário
                await dbPool.query(
                    'UPDATE tokens_primeiro_acesso SET usado = 1 WHERE acolhedor_id = ? AND usado = 0',
                    [usuario.id]
                );

                const token = crypto.randomBytes(32).toString('hex');

                // A expiração é calculada pelo banco (NOW() + 2h) para não depender
                // do fuso horário do processo Node em relação ao servidor MySQL.
                await dbPool.query(
                    `INSERT INTO tokens_primeiro_acesso (acolhedor_id, token, usado, expira_em)
                     VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL 2 HOUR))`,
                    [usuario.id, token]
                );

                const link = `${req.protocol}://${req.get('host')}/redefinir-senha?token=${token}`;

                try {
                    await transporter.sendMail({
                        from: `"Ministério Acolher" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                        to: usuario.email,
                        subject: 'Redefinição de senha — Ministério Acolher',
                        text: `Olá, ${usuario.nome}.\n\nRecebemos um pedido para redefinir a senha da sua conta no Ministério Acolher.\nAcesse o link abaixo (válido por 2 horas):\n${link}\n\nSe você não solicitou esta alteração, ignore este e-mail.`,
                        html: montarEmailRecuperacao(usuario.nome, link)
                    });
                } catch (errEmail) {
                    // Não expõe falha de e-mail ao cliente (evita enumeração/sondagem)
                    console.error('❌ Falha ao enviar e-mail de recuperação:', errEmail.message);
                }
            }

            return res.json({ ok: true, mensagem: MENSAGEM_GENERICA });
        } catch (err) {
            console.error('❌ Erro em /api/esqueci-senha:', err.message);
            return res.status(500).json({
                ok: false,
                mensagem: 'Não foi possível processar a solicitação agora. Tente novamente em instantes.'
            });
        }
    });

    // ─── GET /redefinir-senha?token=... ───────────────────────────────────
    router.get('/redefinir-senha', async (req, res) => {
        const token = String(req.query.token || '').trim();
        const viewInvalida = path.join(__dirname, '..', 'views', 'acolhedor', 'redefinir-senha-invalido.html');

        if (!token) {
            return res.status(400).sendFile(viewInvalida);
        }

        try {
            const [registos] = await dbPool.query(
                `SELECT t.id
                   FROM tokens_primeiro_acesso t
                   INNER JOIN acolhedores a ON a.id = t.acolhedor_id
                  WHERE t.token = ? AND t.usado = 0 AND t.expira_em > NOW() AND a.ativo = 1`,
                [token]
            );

            if (registos.length === 0) {
                return res.status(400).sendFile(viewInvalida);
            }

            return res.sendFile(path.join(__dirname, '..', 'views', 'acolhedor', 'redefinir-senha.html'));
        } catch (err) {
            console.error('❌ Erro ao validar token de redefinição:', err.message);
            return res.status(500).sendFile(viewInvalida);
        }
    });

    // ─── POST /api/redefinir-senha ────────────────────────────────────────
    router.post('/api/redefinir-senha', async (req, res) => {
        const token = String(req.body.token || '').trim();
        const senha = String(req.body.senha || '');

        if (!token) {
            return res.status(400).json({ ok: false, mensagem: 'Token de redefinição ausente.' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ ok: false, mensagem: 'A nova senha deve ter pelo menos 6 caracteres.' });
        }

        let conn;
        try {
            const [tokens] = await dbPool.query(
                `SELECT t.id, t.acolhedor_id
                   FROM tokens_primeiro_acesso t
                   INNER JOIN acolhedores a ON a.id = t.acolhedor_id
                  WHERE t.token = ? AND t.usado = 0 AND t.expira_em > NOW() AND a.ativo = 1`,
                [token]
            );

            if (tokens.length === 0) {
                return res.status(400).json({ ok: false, mensagem: 'Link inválido, expirado ou já utilizado.' });
            }

            const tokenInfo = tokens[0];
            const senhaHash = await bcrypt.hash(senha, 10);

            conn = await dbPool.getConnection();
            try {
                await conn.beginTransaction();

                await conn.query(
                    'UPDATE acolhedores SET senha_hash = ? WHERE id = ?',
                    [senhaHash, tokenInfo.acolhedor_id]
                );
                await conn.query(
                    'UPDATE tokens_primeiro_acesso SET usado = 1 WHERE id = ?',
                    [tokenInfo.id]
                );

                await conn.commit();
            } catch (errTransacao) {
                await conn.rollback();
                throw errTransacao;
            } finally {
                conn.release();
                conn = null;
            }

            return res.json({
                ok: true,
                mensagem: 'Senha redefinida com sucesso! Você já pode entrar com a nova senha.'
            });
        } catch (err) {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
            console.error('❌ Erro ao redefinir senha:', err.message);
            return res.status(500).json({
                ok: false,
                mensagem: 'Não foi possível redefinir a senha agora. Tente novamente em instantes.'
            });
        }
    });

    return router;
};

// ─── Template do e-mail de recuperação ────────────────────────────────────────
// Visual sóbrio e empático, alinhado à identidade do Ministério Acolher.
function montarEmailRecuperacao(nome, link) {
    const nomeSeguro = String(nome || 'acolhedor(a)').replace(/[<>&"]/g, '');
    const linkSeguro = String(link || '').replace(/"/g, '"');

    return `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; color: #2C1A1A; background:#FFFDF9; border:1px solid #E8E0D4; border-radius:12px; overflow:hidden;">
            <div style="background:#7A1C1C; padding:24px; text-align:center;">
                <h2 style="margin:0; color:#fff; font-size:20px; font-weight:600;">🌹 Ministério Acolher</h2>
                <p style="margin:6px 0 0; color:#F4EFE6; font-size:13px;">Cuidado, escuta e acolhimento</p>
            </div>

            <div style="padding:28px 24px;">
                <p style="font-size:16px;">Olá, <strong>${nomeSeguro}</strong>.</p>
                <p style="font-size:15px; line-height:1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta de acesso ao
                    Ministério Acolher. Se foi você, é simples continuar:
                </p>

                <p style="text-align:center; margin:28px 0;">
                    <a href="${linkSeguro}"
                       style="display:inline-block; background:#7A1C1C; color:#fff; text-decoration:none;
                              padding:13px 28px; border-radius:8px; font-size:15px; font-weight:600;">
                        Redefinir minha senha
                    </a>
                </p>

                <p style="font-size:13px; color:#7A5C5C; line-height:1.5;">
                    Este link é válido por <strong>2 horas</strong> e pode ser usado apenas uma vez.
                    Caso o botão não funcione, copie e cole o endereço abaixo no navegador:
                </p>
                <p style="font-size:12px; word-break:break-all; background:#F4EFE6; padding:10px 12px; border-radius:6px; color:#5C1414;">
                    ${linkSeguro}
                </p>

                <p style="font-size:13px; color:#7A5C5C; line-height:1.5; margin-top:24px;">
                    Se você não solicitou esta alteração, não se preocupe: nenhuma mudança foi feita.
                    Basta ignorar este e-mail. Em caso de dúvidas, fale com a administração da equipe.
                </p>
            </div>

            <div style="background:#F4EFE6; padding:16px 24px; text-align:center;">
                <p style="margin:0; font-size:11px; color:#7A5C5C;">
                    Ministério Acolher — mensagem automática. Não responda a este e-mail.
                </p>
            </div>
        </div>
    `;
}

module.exports.montarEmailRecuperacao = montarEmailRecuperacao;
