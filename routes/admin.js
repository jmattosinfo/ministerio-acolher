// routes/admin.js
// Painel administrativo: autenticação, estatísticas globais e Gestão de
// Usuários (acolhedores). O admin NÃO acessa dados clínicos/prontuários.
//
//   GET    /admin                       -> dashboard (HTML, só admin)
//   GET    /admin/api/stats             -> estatísticas globais anonimizadas
//   GET    /admin/api/equipe            -> lista de acolhedores
//   POST   /admin/api/equipe            -> cadastra acolhedor + convite por e-mail
//   PATCH  /admin/api/equipe/:id/status -> ativa/bloqueia (invalida sessões)
//   POST   /admin/api/equipe/:id/reenviar-link -> novo token + e-mail
//   DELETE /admin/api/equipe/:id        -> remove (com confirmação se houver vínculos)
//
// Todas as consultas usam placeholders (?) e as escritas sensíveis rodam em
// transação.

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { criarGuardaSessao } = require('../middleware/acolhedorAuth');
const { montarEmailConvite, montarTextoConvite, VALIDADE_PADRAO_HORAS } = require('../utils/emailConvite');
const { renderizarLogin } = require('../utils/renderizarLogin');

// Hash fictício usado apenas para manter tempo de resposta constante quando
// o e-mail informado não existe (mitiga ataques de enumeração por timing).
const HASH_FALSO = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// ─── Helpers ────────────────────────────────────────────────────────────────

// Regenera a sessão (mitiga session fixation) e grava o usuário autenticado.
function iniciarSessao(req, usuario) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) return reject(err);

            // `sessao_versao` é a fonte de verdade para revogação imediata:
            // se o admin bloquear o usuário, a coluna é incrementada e a
            // sessão deixa de bater no próximo request.
            // `versaoSessao` é mantido como alias legado.
            const versao = Number(usuario.sessao_versao || 0);

            req.session.usuario = {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                perfil: usuario.perfil,
                sessao_versao: versao,
                versaoSessao: versao
            };
            // Flag mantida para compatibilidade com o dashboard administrativo
            req.session.autenticado = usuario.perfil === 'admin';

            req.session.save((errSave) => (errSave ? reject(errSave) : resolve()));
        });
    });
}

function emailValido(email) {
    return typeof email === 'string'
        && email.length <= 150
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function baseUrl(req) {
    const configurada = String(process.env.APP_URL || process.env.BASE_URL || '')
        .trim()
        .replace(/\/+$/, '');
    if (configurada) return configurada;
    return `${req.protocol}://${req.get('host')}`;
}

function linkPrimeiroAcesso(req, token) {
    return `${baseUrl(req)}/acolhedor/primeiro-acesso?token=${token}`;
}

/** Envia o convite; nunca lança exceção (o link é devolvido ao admin). */
async function enviarConvite(transporter, acolhedor, link) {
    if (!transporter) {
        return { enviado: false, erro: 'Serviço de e-mail não configurado.' };
    }
    try {
        await transporter.sendMail({
            from: `"Ministério Acolher" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: acolhedor.email,
            subject: 'Convite de acesso — Ministério Acolher',
            text: montarTextoConvite(acolhedor.nome, link, VALIDADE_PADRAO_HORAS),
            html: montarEmailConvite(acolhedor.nome, link, VALIDADE_PADRAO_HORAS)
        });
        return { enviado: true };
    } catch (err) {
        console.error('❌ Falha ao enviar convite:', err.message);
        return { enviado: false, erro: err.message };
    }
}

function normalizarBooleano(valor) {
    if (valor === undefined || valor === null) return null;
    if (valor === true || valor === 1) return true;
    const texto = String(valor).trim().toLowerCase();
    if (['1', 'true', 'sim', 'ativo'].includes(texto)) return true;
    if (['0', 'false', 'nao', 'não', 'bloqueado'].includes(texto)) return false;
    return null;
}

// Recebe o dbPool já criado no server.js e o transporter (Nodemailer/Brevo).
module.exports = function (dbPool, transporter) {
    const router = express.Router();
    const { requireAcolhedorAuth, requireAdmin } = criarGuardaSessao(dbPool);

    // ─── Tela de login ────────────────────────────────────────────────────
    // Template único (views/login.html) parametrizado para a variante admin.
    router.get('/login', (req, res) => {
        const usuario = req.session && req.session.usuario;

        if (usuario && usuario.perfil === 'admin') {
            return res.redirect('/admin');
        }
        if (usuario) {
            return res.redirect('/acolhedor/painel');
        }

        return res.type('html').send(renderizarLogin('admin'));
    });

    // ─── POST /admin/login (autenticação unificada) ───────────────────────
    router.post('/login', async (req, res) => {
        // Aceita `email` (novo) e `usuario` (compatibilidade com clientes antigos)
        const email = String(req.body.email || req.body.usuario || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        if (!email || !senha) {
            return res.status(400).json({ ok: false, mensagem: 'Informe e-mail e senha.' });
        }

        try {
            const [usuarios] = await dbPool.query(
                `SELECT id, nome, email, senha_hash, perfil, ativo, sessao_versao
                   FROM acolhedores
                  WHERE email = ?`,
                [email]
            );

            if (usuarios.length === 0) {
                await bcrypt.compare(senha, HASH_FALSO); // tempo de resposta constante
                return res.status(401).json({ ok: false, mensagem: 'E-mail ou senha inválidos.' });
            }

            const usuario = usuarios[0];

            if (!usuario.ativo) {
                return res.status(403).json({ ok: false, mensagem: 'Conta desativada. Entre em contato com a administração.' });
            }

            if (!usuario.senha_hash) {
                return res.status(403).json({
                    ok: false,
                    mensagem: 'Sua senha ainda não foi definida. Utilize a opção "Esqueci minha senha" para criar uma.'
                });
            }

            const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
            if (!senhaValida) {
                return res.status(401).json({ ok: false, mensagem: 'E-mail ou senha inválidos.' });
            }

            await iniciarSessao(req, usuario);

            const redirecionarPara = usuario.perfil === 'admin'
                ? '/admin'
                : '/acolhedor/painel';

            return res.json({
                ok: true,
                redirecionarPara,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('❌ Erro no login:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao processar o login. Tente novamente.' });
        }
    });

    router.post('/logout', (req, res) => {
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.json({ ok: true });
        });
    });

    // ─── Dashboard (HTML protegido — exclusivo admin) ─────────────────────
    router.get('/', requireAcolhedorAuth, requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'views', 'admin', 'dashboard.html'));
    });

    // ─── API de estatísticas (JSON protegido) — 100% resiliente ──────────
    router.get('/api/stats', requireAcolhedorAuth, requireAdmin, async (req, res) => {
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
            conn = null;

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
            if (conn) try { conn.release(); } catch (_) { /* ignora */ }
            res.status(500).json({ ok: false, mensagem: 'Erro ao buscar estatísticas.' });
        }
    });

    // ─── Avaliações recebidas (feedback público) ──────────────────────────
    // GET /admin/api/feedbacks?limite=50
    // Retorna nota média global, distribuição por nota e as últimas
    // mensagens. As mensagens são texto livre do público e devem ser
    // escapadas no cliente (public/admin/dashboard.js já o faz).
    router.get('/api/feedbacks', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        const limiteSolicitado = Number.parseInt(req.query.limite, 10);
        const limite = Number.isInteger(limiteSolicitado)
            ? Math.min(Math.max(limiteSolicitado, 1), 200)
            : 50;

        try {
            const [resumo] = await dbPool.query(
                `SELECT COUNT(*) AS total,
                        COALESCE(ROUND(AVG(nota), 2), 0) AS media
                   FROM feedbacks`
            );

            const [distribuicao] = await dbPool.query(
                `SELECT nota, COUNT(*) AS total
                   FROM feedbacks
                  GROUP BY nota
                  ORDER BY nota DESC`
            );

            const [ultimos] = await dbPool.query(
                `SELECT id, nota, mensagem, criado_em
                   FROM feedbacks
                  ORDER BY criado_em DESC, id DESC
                  LIMIT ?`,
                [limite]
            );

            const total = Number(resumo[0]?.total || 0);
            const media = Number(resumo[0]?.media || 0);

            // Garante as 5 faixas mesmo quando não há avaliações de
            // determinada nota (facilita a renderização das barras).
            const mapaDistribuicao = new Map(
                (distribuicao || []).map((linha) => [Number(linha.nota), Number(linha.total)])
            );
            const distribuicaoCompleta = [5, 4, 3, 2, 1].map((nota) => ({
                nota,
                total: mapaDistribuicao.get(nota) || 0
            }));

            res.json({
                ok: true,
                total,
                media,
                distribuicao: distribuicaoCompleta,
                feedbacks: (ultimos || []).map((f) => ({
                    id: f.id,
                    nota: Number(f.nota),
                    mensagem: f.mensagem || null,
                    criado_em: f.criado_em
                }))
            });
        } catch (err) {
            console.error('❌ Erro ao consultar feedbacks:', err.message);
            res.status(500).json({ ok: false, mensagem: 'Erro ao consultar as avaliações.' });
        }
    });

    // ─── Gestão de Usuários (acolhedores) ────────────────────────────────

    // GET /admin/api/equipe
    router.get('/api/equipe', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        try {
            const [membros] = await dbPool.query(
                `SELECT id, nome, email, perfil, ativo, criado_em
                   FROM acolhedores
                  ORDER BY perfil ASC, nome ASC`
            );

            res.json({
                ok: true,
                dados: membros.map((m) => ({
                    ...m,
                    ativo: Boolean(m.ativo),
                    gerenciável: m.perfil === 'acolhedor',
                    status: m.ativo ? 'Ativo' : 'Bloqueado'
                }))
            });
        } catch (err) {
            console.error('❌ Erro ao listar equipa:', err.message);
            res.status(500).json({ ok: false, mensagem: 'Erro ao consultar membros da equipa.' });
        }
    });

    // POST /admin/api/equipe — cadastra acolhedor e envia convite
    router.post('/api/equipe', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

        if (nome.length < 2 || nome.length > 100) {
            return res.status(400).json({ ok: false, mensagem: 'O nome deve ter entre 2 e 100 caracteres.' });
        }
        if (!emailValido(email)) {
            return res.status(400).json({ ok: false, mensagem: 'Informe um e-mail válido.' });
        }

        let conn;
        try {
            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            const [existe] = await conn.query(
                'SELECT id FROM acolhedores WHERE email = ?',
                [email]
            );

            if (existe.length > 0) {
                await conn.rollback();
                return res.status(409).json({ ok: false, mensagem: 'Já existe um utilizador com este e-mail.' });
            }

            const [inserido] = await conn.query(
                `INSERT INTO acolhedores (nome, email, perfil, ativo)
                 VALUES (?, ?, 'acolhedor', 1)`,
                [nome, email]
            );

            const acolhedorId = inserido.insertId;
            const token = crypto.randomBytes(32).toString('hex');

            // Expiração calculada pelo MySQL para evitar divergência de fuso.
            await conn.query(
                `INSERT INTO tokens_primeiro_acesso (acolhedor_id, token, usado, expira_em)
                 VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
                [acolhedorId, token, VALIDADE_PADRAO_HORAS]
            );

            await conn.commit();

            const link = linkPrimeiroAcesso(req, token);
            const envio = await enviarConvite(transporter, { nome, email }, link);

            return res.status(201).json({
                ok: true,
                mensagem: envio.enviado
                    ? 'Acolhedor cadastrado e convite enviado por e-mail.'
                    : 'Acolhedor cadastrado. O e-mail não pôde ser enviado — use o link abaixo.',
                acolhedor: {
                    id: acolhedorId,
                    nome,
                    email,
                    perfil: 'acolhedor',
                    ativo: true
                },
                link_convite: link,
                email_enviado: envio.enviado,
                email_erro: envio.enviado ? null : envio.erro
            });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }

            if (err && err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ ok: false, mensagem: 'Já existe um utilizador com este e-mail.' });
            }

            console.error('❌ Erro ao cadastrar acolhedor:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao cadastrar utilizador.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    // PATCH /admin/api/equipe/:id/status — ativa/bloqueia e invalida sessões
    router.patch('/api/equipe/:id/status', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ ok: false, mensagem: 'Identificador inválido.' });
        }

        let conn;
        try {
            const [registos] = await dbPool.query(
                'SELECT id, nome, email, perfil, ativo FROM acolhedores WHERE id = ?',
                [id]
            );
            const alvo = registos[0];

            if (!alvo) {
                return res.status(404).json({ ok: false, mensagem: 'Acolhedor não encontrado.' });
            }
            if (alvo.perfil !== 'acolhedor') {
                return res.status(403).json({
                    ok: false,
                    mensagem: 'O status de administradores não pode ser alterado pelo painel.'
                });
            }

            const statusSolicitado = normalizarBooleano(req.body && req.body.ativo);
            const novoStatus = statusSolicitado === null ? !alvo.ativo : statusSolicitado;

            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            // Incrementa a versão da sessão: invalida imediatamente qualquer
            // sessão ativa deste usuário em todos os dispositivos.
            await conn.query(
                `UPDATE acolhedores
                    SET ativo = ?, sessao_versao = sessao_versao + 1
                  WHERE id = ? AND perfil = 'acolhedor'`,
                [novoStatus ? 1 : 0, id]
            );

            // Ao bloquear, invalida convites pendentes.
            if (!novoStatus) {
                await conn.query(
                    'UPDATE tokens_primeiro_acesso SET usado = 1 WHERE acolhedor_id = ? AND usado = 0',
                    [id]
                );
            }

            await conn.commit();

            return res.json({
                ok: true,
                mensagem: novoStatus
                    ? `Acesso de ${alvo.nome} reativado.`
                    : `Acesso de ${alvo.nome} bloqueado e sessões encerradas.`,
                acolhedor: {
                    id: alvo.id,
                    nome: alvo.nome,
                    email: alvo.email,
                    ativo: novoStatus,
                    status: novoStatus ? 'Ativo' : 'Bloqueado'
                }
            });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }
            console.error('❌ Erro ao alterar status do acolhedor:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao alterar o status.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    // POST /admin/api/equipe/:id/reenviar-link — novo token + e-mail
    router.post('/api/equipe/:id/reenviar-link', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ ok: false, mensagem: 'Identificador inválido.' });
        }

        let conn;
        try {
            const [registos] = await dbPool.query(
                'SELECT id, nome, email, perfil, ativo FROM acolhedores WHERE id = ?',
                [id]
            );
            const alvo = registos[0];

            if (!alvo) {
                return res.status(404).json({ ok: false, mensagem: 'Acolhedor não encontrado.' });
            }
            if (alvo.perfil !== 'acolhedor') {
                return res.status(403).json({
                    ok: false,
                    mensagem: 'Links de acesso de administradores não são gerenciados aqui.'
                });
            }
            if (!alvo.ativo) {
                return res.status(409).json({
                    ok: false,
                    mensagem: 'A conta está bloqueada. Reative o acesso antes de reenviar o link.'
                });
            }

            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            await conn.query(
                'UPDATE tokens_primeiro_acesso SET usado = 1 WHERE acolhedor_id = ? AND usado = 0',
                [id]
            );

            const token = crypto.randomBytes(32).toString('hex');

            await conn.query(
                `INSERT INTO tokens_primeiro_acesso (acolhedor_id, token, usado, expira_em)
                 VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
                [id, token, VALIDADE_PADRAO_HORAS]
            );

            await conn.commit();

            const link = linkPrimeiroAcesso(req, token);
            const envio = await enviarConvite(transporter, alvo, link);

            return res.json({
                ok: true,
                mensagem: envio.enviado
                    ? `Novo link enviado para ${alvo.email}.`
                    : 'Novo link gerado. O e-mail não pôde ser enviado — use o link abaixo.',
                link_convite: link,
                email_enviado: envio.enviado,
                email_erro: envio.enviado ? null : envio.erro
            });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }
            console.error('❌ Erro ao reenviar link de acesso:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao gerar novo link.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    // DELETE /admin/api/equipe/:id — remove apenas se não houver vínculos,
    // ou se o admin confirmar explicitamente (?confirmar=1).
    router.delete('/api/equipe/:id', requireAcolhedorAuth, requireAdmin, async (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ ok: false, mensagem: 'Identificador inválido.' });
        }

        let conn;
        try {
            const [registos] = await dbPool.query(
                'SELECT id, nome, email, perfil FROM acolhedores WHERE id = ?',
                [id]
            );
            const alvo = registos[0];

            if (!alvo) {
                return res.status(404).json({ ok: false, mensagem: 'Acolhedor não encontrado.' });
            }
            if (alvo.perfil !== 'acolhedor') {
                return res.status(403).json({
                    ok: false,
                    mensagem: 'Não é permitido excluir uma conta de administrador.'
                });
            }

            const confirmado = normalizarBooleano(
                req.query.confirmar !== undefined ? req.query.confirmar : (req.body && req.body.confirmar)
            ) === true;

            const [vinculos] = await dbPool.query(
                'SELECT COUNT(*) AS total FROM cadastros WHERE profissional_responsavel = ?',
                [alvo.nome]
            );
            const totalVinculos = Number(vinculos[0]?.total || 0);

            if (totalVinculos > 0 && !confirmado) {
                return res.status(409).json({
                    ok: false,
                    requer_confirmacao: true,
                    vinculados: totalVinculos,
                    mensagem: `${alvo.nome} possui ${totalVinculos} prontuário(s) vinculado(s). A exclusão manterá esses registros (sem acesso clínico). Confirme para continuar.`
                });
            }

            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            // tokens_primeiro_acesso possui ON DELETE CASCADE.
            const [resultado] = await conn.query(
                `DELETE FROM acolhedores
                  WHERE id = ? AND perfil = 'acolhedor'`,
                [id]
            );

            await conn.commit();

            if (resultado.affectedRows === 0) {
                return res.status(404).json({ ok: false, mensagem: 'Acolhedor não encontrado.' });
            }

            return res.json({
                ok: true,
                mensagem: `${alvo.nome} foi removido(a) da equipe.`,
                vinculados_preservados: totalVinculos
            });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }
            console.error('❌ Erro ao excluir acolhedor:', err.message);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao excluir utilizador.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    return router;
};

// ─── Helpers de estatística ────────────────────────────────────────────────

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
