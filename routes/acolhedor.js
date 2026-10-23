// routes/acolhedor.js
// Camada de rotas do painel do ACOLHEDOR (entrega da view HTML + API JSON).
// É montada em server.js como: app.use('/acolhedor', acolhedorRoutes)
//
// Separação ética de perfis (Privacy by Design):
//   • As rotas clínicas aceitam EXCLUSIVAMENTE `perfil === 'acolhedor'`.
//   • O perfil `admin` é redirecionado para /admin (ou recebe 403 JSON),
//     sem acesso a painel, atendimentos ou prontuários.
//   • Apenas /api/me é compartilhado (cada usuário gerencia a própria conta).
//
//   GET   /acolhedor/painel                 -> HTML (somente acolhedor)
//   GET   /acolhedor/atendimentos           -> lista do próprio profissional
//   PATCH /acolhedor/atendimentos/:id       -> atualiza o próprio prontuário
//   GET   /acolhedor/api/minhas-estatisticas -> indicadores do próprio profissional
//   GET   /acolhedor/api/me                 -> perfil do usuário autenticado
//   PATCH /acolhedor/api/me                 -> atualiza o próprio perfil

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { criarGuardaSessao } = require('../middleware/acolhedorAuth');
const { renderizarLogin } = require('../utils/renderizarLogin');

// Regenera a sessão (mitiga session fixation) e grava o usuário autenticado.
function iniciarSessao(req, usuario) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
            if (err) return reject(err);

            // `sessao_versao` é a fonte de verdade para revogação imediata
            // (bloqueio administrativo incrementa a coluna no banco).
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

module.exports = function (dbPool) {
    const router = express.Router();
    const { requireAcolhedorAuth, requireApenasAcolhedor } = criarGuardaSessao(dbPool);

    // ----------------------------------------------------
    // VISTAS (HTML)
    // ----------------------------------------------------

    // GET /acolhedor/login
    // Template único (views/login.html) parametrizado para a variante acolhedor.
    router.get('/login', (req, res) => {
        const usuario = req.session && req.session.usuario;
        if (usuario) {
            return res.redirect(usuario.perfil === 'admin' ? '/admin' : '/acolhedor/painel');
        }
        return res.type('html').send(renderizarLogin('acolhedor'));
    });

    // GET /acolhedor/primeiro-acesso?token=...
    router.get('/primeiro-acesso', async (req, res) => {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send('Token de primeiro acesso ausente ou inválido.');
        }

        try {
            const [registos] = await dbPool.query(`
                SELECT t.id, t.expira_em, t.usado, a.nome, a.email
                FROM tokens_primeiro_acesso t
                INNER JOIN acolhedores a ON a.id = t.acolhedor_id
                WHERE t.token = ? AND t.usado = 0 AND t.expira_em > NOW() AND a.ativo = 1
            `, [token]);

            if (registos.length === 0) {
                return res.status(400).sendFile(path.join(__dirname, '..', 'views', 'acolhedor', 'redefinir-senha-invalido.html'));
            }

            // O convite usa a mesma view e o mesmo endpoint do fluxo de
            // redefinição de senha (token na tabela tokens_primeiro_acesso).
            res.sendFile(path.join(__dirname, '..', 'views', 'acolhedor', 'redefinir-senha.html'));
        } catch (err) {
            console.error('Erro ao validar token:', err);
            res.status(500).send('Erro interno ao processar validação do convite.');
        }
    });

    // GET /acolhedor/painel — EXCLUSIVO do perfil acolhedor (admin é redirecionado)
    router.get('/painel', requireAcolhedorAuth, requireApenasAcolhedor, (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'views', 'acolhedor', 'painel.html'));
    });

    // Redirecionamento amigável
    router.get('/', (req, res) => {
        res.redirect('/acolhedor/painel');
    });

    // ----------------------------------------------------
    // API: AUTENTICAÇÃO E SESSÃO
    // ----------------------------------------------------

    // POST /acolhedor/api/login
    router.post('/api/login', async (req, res) => {
        try {
            const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
            const senha = typeof req.body.senha === 'string' ? req.body.senha : '';

            if (!email || !senha) {
                return res.status(400).json({ ok: false, mensagem: 'E-mail e palavra-passe são obrigatórios.' });
            }

            const [usuarios] = await dbPool.query(
                `SELECT id, nome, email, senha_hash, perfil, ativo, sessao_versao
                   FROM acolhedores
                  WHERE email = ?`,
                [email]
            );

            if (usuarios.length === 0) {
                return res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas.' });
            }

            const usuario = usuarios[0];

            if (!usuario.ativo) {
                return res.status(403).json({ ok: false, mensagem: 'Conta desativada. Contacte a administração.' });
            }

            if (!usuario.senha_hash) {
                return res.status(403).json({ ok: false, mensagem: 'Defina a sua palavra-passe através do link de primeiro acesso.' });
            }

            const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
            if (!senhaValida) {
                return res.status(401).json({ ok: false, mensagem: 'Credenciais inválidas.' });
            }

            await iniciarSessao(req, usuario);

            const redirecionarPara = usuario.perfil === 'admin'
                ? '/admin'
                : '/acolhedor/painel';

            res.json({
                ok: true,
                mensagem: 'Sessão iniciada com sucesso.',
                redirecionarPara,
                usuario: req.session.usuario
            });
        } catch (err) {
            console.error('Erro na autenticação:', err);
            res.status(500).json({ ok: false, mensagem: 'Erro interno ao processar início de sessão.' });
        }
    });

    // POST /acolhedor/api/logout
    router.post('/api/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ ok: false, mensagem: 'Erro ao terminar sessão.' });
            }
            res.clearCookie('connect.sid');
            res.json({ ok: true, mensagem: 'Sessão terminada com sucesso.' });
        });
    });

    // GET /acolhedor/api/me (compartilhado: acolhedor e admin gerenciam a própria conta)
    router.get('/api/me', requireAcolhedorAuth, (req, res) => {
        // requireAcolhedorAuth já revalidou e sincronizou a sessão com o banco.
        res.json({ ok: true, usuario: req.session.usuario });
    });

    // PATCH /acolhedor/api/me (Atualização segura do próprio perfil)
    // Regras:
    //   - Alterar e-mail ou palavra-passe exige a palavra-passe atual.
    //   - Nova palavra-passe: mínimo 6 caracteres (máx. 72, limite do bcrypt).
    //   - Ao mudar o nome de exibição de um acolhedor, os prontuários vinculados
    //     ao nome antigo são migrados na mesma transação (mantém o isolamento RBAC).
    router.patch('/api/me', requireAcolhedorAuth, async (req, res) => {
        const sessao = req.session.usuario;

        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ ok: false, mensagem: 'Corpo da requisição inválido.' });
        }

        // Tipagem estrita: apenas strings são aceites (evita "null"/"undefined"
        // serem convertidos em texto e gravados no banco).
        if (req.body.nome !== undefined && typeof req.body.nome !== 'string') {
            return res.status(400).json({ ok: false, mensagem: 'O nome deve ser um texto.' });
        }
        if (req.body.email !== undefined && typeof req.body.email !== 'string') {
            return res.status(400).json({ ok: false, mensagem: 'O e-mail deve ser um texto.' });
        }

        const nomeInformado = req.body.nome !== undefined ? req.body.nome.trim() : undefined;
        const emailInformado = req.body.email !== undefined
            ? req.body.email.trim().toLowerCase()
            : undefined;
        const senhaAtual = typeof req.body.senhaAtual === 'string' ? req.body.senhaAtual : '';
        const novaSenha = typeof req.body.novaSenha === 'string' ? req.body.novaSenha : '';
        const confirmarNovaSenha = typeof req.body.confirmarNovaSenha === 'string'
            ? req.body.confirmarNovaSenha
            : '';

        // ── Validações de tipagem / tamanho ────────────────────────────────
        if (nomeInformado !== undefined && (nomeInformado.length < 2 || nomeInformado.length > 100)) {
            return res.status(400).json({ ok: false, mensagem: 'O nome deve ter entre 2 e 100 caracteres.' });
        }

        if (emailInformado !== undefined) {
            const formatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInformado);
            if (!formatoValido || emailInformado.length > 150) {
                return res.status(400).json({ ok: false, mensagem: 'Informe um e-mail válido.' });
            }
        }

        if (novaSenha && (novaSenha.length < 6 || novaSenha.length > 72)) {
            return res.status(400).json({ ok: false, mensagem: 'A nova palavra-passe deve ter entre 6 e 72 caracteres.' });
        }

        if (novaSenha !== confirmarNovaSenha) {
            return res.status(400).json({ ok: false, mensagem: 'A confirmação da nova palavra-passe não coincide.' });
        }

        if (nomeInformado === undefined && emailInformado === undefined && !novaSenha) {
            return res.status(400).json({ ok: false, mensagem: 'Nenhum campo fornecido para atualização.' });
        }

        let conn;
        try {
            const [registos] = await dbPool.query(
                'SELECT id, nome, email, senha_hash, perfil, ativo FROM acolhedores WHERE id = ?',
                [sessao.id]
            );
            const atual = registos[0];

            if (!atual || !atual.ativo) {
                return res.status(401).json({ ok: false, mensagem: 'Conta indisponível. Inicie sessão novamente.' });
            }

            const nomeFinal = nomeInformado !== undefined ? nomeInformado : atual.nome;
            const emailFinal = emailInformado !== undefined ? emailInformado : atual.email;

            const nomeMudou = nomeFinal !== atual.nome;
            const emailMudou = emailFinal !== String(atual.email).toLowerCase();
            const senhaMudou = Boolean(novaSenha);

            // ── Alterações sensíveis exigem a palavra-passe atual ──────────
            if (emailMudou || senhaMudou) {
                if (!senhaAtual) {
                    return res.status(400).json({
                        ok: false,
                        mensagem: 'Informe a palavra-passe atual para confirmar esta alteração.'
                    });
                }
                if (!atual.senha_hash) {
                    return res.status(400).json({
                        ok: false,
                        mensagem: 'Defina a sua palavra-passe pelo link de primeiro acesso antes de alterar estes dados.'
                    });
                }
                const senhaConfere = await bcrypt.compare(senhaAtual, atual.senha_hash);
                if (!senhaConfere) {
                    return res.status(401).json({ ok: false, mensagem: 'Palavra-passe atual incorreta.' });
                }
            }

            // ── Unicidade do e-mail ────────────────────────────────────────
            if (emailMudou) {
                const [duplicados] = await dbPool.query(
                    'SELECT id FROM acolhedores WHERE email = ? AND id <> ?',
                    [emailFinal, sessao.id]
                );
                if (duplicados.length > 0) {
                    return res.status(409).json({ ok: false, mensagem: 'Este e-mail já está associado a outra conta.' });
                }
            }

            const campos = [];
            const valores = [];

            if (nomeMudou) {
                campos.push('nome = ?');
                valores.push(nomeFinal);
            }
            if (emailMudou) {
                campos.push('email = ?');
                valores.push(emailFinal);
            }
            if (senhaMudou) {
                const novoHash = await bcrypt.hash(novaSenha, 10);
                campos.push('senha_hash = ?');
                valores.push(novoHash);
            }

            if (campos.length === 0) {
                return res.status(400).json({ ok: false, mensagem: 'Nenhuma alteração detectada.' });
            }

            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            // Mantém o vínculo dos prontuários ao renomear um acolhedor
            // (a coluna cadastros.profissional_responsavel guarda o nome).
            if (nomeMudou && atual.perfil !== 'admin') {
                await conn.query(
                    'UPDATE cadastros SET profissional_responsavel = ? WHERE profissional_responsavel = ?',
                    [nomeFinal, atual.nome]
                );
            }

            valores.push(sessao.id);
            await conn.query(`UPDATE acolhedores SET ${campos.join(', ')} WHERE id = ?`, valores);

            await conn.commit();

            // Reflete imediatamente os novos dados na sessão
            req.session.usuario.nome = nomeFinal;
            req.session.usuario.email = emailFinal;

            const versaoSessao = Number(
                req.session.usuario.sessao_versao !== undefined
                    ? req.session.usuario.sessao_versao
                    : (req.session.usuario.versaoSessao || 0)
            );

            const usuarioAtualizado = {
                id: sessao.id,
                nome: nomeFinal,
                email: emailFinal,
                perfil: atual.perfil,
                sessao_versao: versaoSessao,
                versaoSessao
            };

            req.session.save((errSessao) => {
                if (errSessao) console.error('Erro ao persistir sessão após atualização:', errSessao);
                return res.json({
                    ok: true,
                    mensagem: senhaMudou
                        ? 'Dados e palavra-passe atualizados com sucesso.'
                        : 'Dados atualizados com sucesso.',
                    usuario: usuarioAtualizado
                });
            });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }
            console.error('Erro em PATCH /acolhedor/api/me:', err);
            return res.status(500).json({ ok: false, mensagem: 'Erro interno ao atualizar o perfil.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    // POST /acolhedor/api/definir-senha (Consome token de primeiro acesso)
    router.post('/api/definir-senha', async (req, res) => {
        try {
            const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
            const senha = typeof req.body.senha === 'string' ? req.body.senha : '';

            if (!token || !senha || senha.length < 6) {
                return res.status(400).json({ ok: false, mensagem: 'A palavra-passe deve conter pelo menos 6 caracteres.' });
            }

            const [tokens] = await dbPool.query(`
                SELECT t.id, t.acolhedor_id, a.nome, a.email, a.perfil, a.sessao_versao
                FROM tokens_primeiro_acesso t
                INNER JOIN acolhedores a ON a.id = t.acolhedor_id
                WHERE t.token = ? AND t.usado = 0 AND t.expira_em > NOW() AND a.ativo = 1
            `, [token]);

            if (tokens.length === 0) {
                return res.status(400).json({ ok: false, mensagem: 'Token expirado, inválido ou já utilizado.' });
            }

            const tokenInfo = tokens[0];
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash(senha, salt);

            // Transação: atualiza palavra-passe e invalida o token (uso único)
            const conn = await dbPool.getConnection();
            try {
                await conn.beginTransaction();

                await conn.query('UPDATE acolhedores SET senha_hash = ? WHERE id = ?', [senhaHash, tokenInfo.acolhedor_id]);
                await conn.query('UPDATE tokens_primeiro_acesso SET usado = 1 WHERE id = ?', [tokenInfo.id]);

                await conn.commit();
            } catch (error) {
                await conn.rollback();
                throw error;
            } finally {
                conn.release();
            }

            // Inicia sessão automaticamente após definição de palavra-passe
            await iniciarSessao(req, {
                id: tokenInfo.acolhedor_id,
                nome: tokenInfo.nome,
                email: tokenInfo.email,
                perfil: tokenInfo.perfil,
                sessao_versao: tokenInfo.sessao_versao
            });

            const redirecionarPara = tokenInfo.perfil === 'admin'
                ? '/admin'
                : '/acolhedor/painel';

            res.json({
                ok: true,
                mensagem: 'Palavra-passe registada com sucesso!',
                redirecionarPara
            });
        } catch (err) {
            console.error('Erro ao definir palavra-passe:', err);
            res.status(500).json({ ok: false, mensagem: 'Erro interno ao guardar palavra-passe.' });
        }
    });

    // ----------------------------------------------------
    // API: ATENDIMENTOS (ISOLAMENTO RBAC — EXCLUSIVO ACOLHEDOR)
    // ----------------------------------------------------

    router.get('/atendimentos', requireAcolhedorAuth, requireApenasAcolhedor, async (req, res) => {
        try {
            const status = typeof req.query.status === 'string' ? req.query.status : '';
            const busca = typeof req.query.busca === 'string' ? req.query.busca.trim() : '';
            const usuarioLogado = req.session.usuario;

            const condicoes = [];
            const params = [];

            // ── ISOLAMENTO RBAC (regra dura) ─────────────────────────────
            // A consulta é SEMPRE restrita ao nome do próprio profissional.
            // Qualquer parâmetro `profissional` enviado pelo cliente é ignorado.
            condicoes.push('c.profissional_responsavel = ?');
            params.push(usuarioLogado.nome);

            if (status && status !== 'todos') {
                condicoes.push('c.status_acolhimento = ?');
                params.push(status);
            }

            if (busca !== '') {
                condicoes.push('(c.nome LIKE ? OR c.whatsapp LIKE ?)');
                const termo = `%${busca}%`;
                params.push(termo, termo);
            }

            // O feedback é opcional (avaliação pode nunca ter sido enviada) e
            // um prontuário pode receber mais de uma avaliação. A subconsulta
            // garante apenas a MAIS RECENTE, evitando linhas duplicadas.
            let sql = `
                SELECT c.id, c.perfil_triagem, c.profissional_responsavel, c.nome, c.data_nascimento,
                       c.localizacao, c.pais, c.whatsapp, c.estado_civil, c.rede_apoio, c.motivo_terapia,
                       c.preferencia_horario, c.onde_conheceu, c.status_acolhimento,
                       c.notas_sessao_1, c.notas_sessao_2, c.notas_sessao_3,
                       c.tentativas_contato, c.proximo_lembrete, c.criado_em, c.atualizado_em,
                       f.nota AS feedback_nota,
                       f.mensagem AS feedback_mensagem,
                       f.criado_em AS feedback_criado_em
                  FROM cadastros c
                  LEFT JOIN (
                        SELECT cadastro_id, MAX(id) AS ultimo_feedback_id
                          FROM feedbacks
                         WHERE cadastro_id IS NOT NULL
                         GROUP BY cadastro_id
                  ) ult ON ult.cadastro_id = c.id
                  LEFT JOIN feedbacks f ON f.id = ult.ultimo_feedback_id
                 WHERE ${condicoes.join(' AND ')}
                 ORDER BY c.criado_em DESC, c.id DESC
            `;

            const [registos] = await dbPool.query(sql, params);

            res.json({
                ok: true,
                escopo: 'proprio',
                dados: registos
            });
        } catch (err) {
            console.error('Erro ao consultar atendimentos:', err);
            res.status(500).json({ ok: false, mensagem: 'Erro interno no servidor.' });
        }
    });

    // PATCH /acolhedor/atendimentos/:id — exclusivo do acolhedor responsável
    router.patch('/atendimentos/:id', requireAcolhedorAuth, requireApenasAcolhedor, async (req, res) => {
        const id = Number.parseInt(req.params.id, 10);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ ok: false, mensagem: 'Identificador inválido.' });
        }

        const {
            status_acolhimento,
            notas_sessao_1,
            notas_sessao_2,
            notas_sessao_3,
            tentativas_contato,
            proximo_lembrete
        } = req.body || {};

        const campos = [];
        const valores = [];

        if (status_acolhimento !== undefined) {
            campos.push('status_acolhimento = ?');
            valores.push(status_acolhimento);
        }
        if (notas_sessao_1 !== undefined) {
            campos.push('notas_sessao_1 = ?');
            valores.push(notas_sessao_1);
        }
        if (notas_sessao_2 !== undefined) {
            campos.push('notas_sessao_2 = ?');
            valores.push(notas_sessao_2);
        }
        if (notas_sessao_3 !== undefined) {
            campos.push('notas_sessao_3 = ?');
            valores.push(notas_sessao_3);
        }
        if (tentativas_contato !== undefined) {
            campos.push('tentativas_contato = ?');
            valores.push(Math.max(0, Number.parseInt(tentativas_contato, 10) || 0));
        }
        if (proximo_lembrete !== undefined) {
            campos.push('proximo_lembrete = ?');
            valores.push(proximo_lembrete ? proximo_lembrete : null);
        }

        if (campos.length === 0) {
            return res.status(400).json({ ok: false, mensagem: 'Nenhum campo fornecido para atualização.' });
        }

        const usuarioLogado = req.session.usuario;
        let conn;

        try {
            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            // Validação de posse dentro da transação (evita TOCTOU):
            // o registro precisa pertencer ao acolhedor autenticado.
            const [pertence] = await conn.query(
                'SELECT id FROM cadastros WHERE id = ? AND profissional_responsavel = ? FOR UPDATE',
                [id, usuarioLogado.nome]
            );

            if (pertence.length === 0) {
                await conn.rollback();
                return res.status(403).json({
                    ok: false,
                    mensagem: 'Não possui autorização para alterar este prontuário.'
                });
            }

            valores.push(id);
            const sql = `UPDATE cadastros SET ${campos.join(', ')} WHERE id = ? AND profissional_responsavel = ?`;
            valores.push(usuarioLogado.nome);

            const [resultado] = await conn.query(sql, valores);

            if (resultado.affectedRows === 0) {
                await conn.rollback();
                return res.status(404).json({ ok: false, mensagem: 'Atendimento não encontrado.' });
            }

            await conn.commit();

            res.json({ ok: true, mensagem: 'Atendimento atualizado com sucesso.' });
        } catch (err) {
            if (conn) {
                try { await conn.rollback(); } catch (_) { /* ignora */ }
            }
            console.error('Erro ao atualizar atendimento:', err);
            res.status(500).json({ ok: false, mensagem: 'Erro interno no servidor.' });
        } finally {
            if (conn) {
                try { conn.release(); } catch (_) { /* ignora */ }
            }
        }
    });

    // ----------------------------------------------------
    // API: ESTATÍSTICAS RESUMIDAS DO ACOLHEDOR
    // ----------------------------------------------------

    // GET /acolhedor/api/minhas-estatisticas
    //
    // Retorna dois blocos:
    //   • `individuais` → métricas do próprio acolhedor (escopo por nome);
    //   • `equipe`      → somas agregadas de toda a plataforma (sem qualquer
    //                     nome, lista de profissionais ou dado de prontuário).
    //
    // Todas as consultas usam placeholders (?) — nenhuma interpolação de SQL.
    router.get('/api/minhas-estatisticas', requireAcolhedorAuth, requireApenasAcolhedor, async (req, res) => {
        try {
            const profissional = req.session.usuario.nome;
            const STATUS_CONCLUIDO = 'realizado';

            // Consultas independentes em paralelo para reduzir a latência.
            const [
                [totalRows],
                [statusRows],
                [recentesRows],
                [equipeTotalRows],
                [equipeConcluidosRows],
                [equipeMesRows]
            ] = await Promise.all([
                // ── Individuais ────────────────────────────────────────────
                dbPool.query(
                    'SELECT COUNT(*) AS total FROM cadastros WHERE profissional_responsavel = ?',
                    [profissional]
                ),
                dbPool.query(
                    `SELECT status_acolhimento AS status, COUNT(*) AS total
                       FROM cadastros
                      WHERE profissional_responsavel = ?
                      GROUP BY status_acolhimento`,
                    [profissional]
                ),
                dbPool.query(
                    `SELECT COUNT(*) AS total
                       FROM cadastros
                      WHERE profissional_responsavel = ?
                        AND criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
                    [profissional]
                ),
                // ── Equipe (apenas somas anônimas) ─────────────────────────
                dbPool.query('SELECT COUNT(*) AS total FROM cadastros'),
                dbPool.query(
                    'SELECT COUNT(*) AS total FROM cadastros WHERE status_acolhimento = ?',
                    [STATUS_CONCLUIDO]
                ),
                dbPool.query(
                    `SELECT COUNT(*) AS total
                       FROM cadastros
                      WHERE YEAR(criado_em) = YEAR(NOW())
                        AND MONTH(criado_em) = MONTH(NOW())`
                )
            ]);

            const porStatus = {
                pendente: 0,
                em_andamento: 0,
                realizado: 0,
                nao_realizado: 0
            };

            statusRows.forEach((linha) => {
                const chave = linha.status || 'pendente';
                porStatus[chave] = (porStatus[chave] || 0) + Number(linha.total || 0);
            });

            const totalAtendimentos = Number(totalRows[0]?.total || 0);
            const emAndamento = Number(porStatus.em_andamento || 0);
            const concluidos = Number(porStatus.realizado || 0);
            const ultimos30Dias = Number(recentesRows[0]?.total || 0);

            const totalClassificado = Object.values(porStatus).reduce((soma, n) => soma + n, 0);
            // Categorias fora da lista padrão (dados legados) entram em "outros"
            const outros = Math.max(0, totalAtendimentos - totalClassificado);

            const taxaConclusao = totalAtendimentos > 0
                ? Math.round((concluidos / totalAtendimentos) * 100)
                : 0;

            res.json({
                ok: true,
                profissional,
                individuais: {
                    total_atendimentos: totalAtendimentos,
                    em_andamento: emAndamento,
                    concluidos,
                    ultimos_30_dias: ultimos30Dias,
                    taxa_conclusao: taxaConclusao
                },
                equipe: {
                    total_vidas: Number(equipeTotalRows[0]?.total || 0),
                    total_concluidos: Number(equipeConcluidosRows[0]?.total || 0),
                    atendimentos_mes: Number(equipeMesRows[0]?.total || 0)
                },
                // ── Compatibilidade com consumidores anteriores ────────────
                totalAcolhidos: totalAtendimentos,
                porStatus: {
                    ...porStatus,
                    outros
                },
                ultimos30Dias,
                taxaConclusao,
                atualizadoEm: new Date().toISOString()
            });
        } catch (err) {
            console.error('Erro ao calcular estatísticas do acolhedor:', err);
            res.status(500).json({ ok: false, mensagem: 'Erro ao buscar suas estatísticas.' });
        }
    });

    return router;
};
