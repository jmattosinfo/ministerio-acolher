// middleware/acolhedorAuth.js
// Autenticação/RBAC unificado do Ministério Acolher.
//
// Regras de negócio:
//   • `acolhedor`  → único perfil autorizado a acessar o painel clínico
//                    (/acolhedor/painel, /acolhedor/atendimentos, estatísticas).
//   • `admin`      → acesso ao painel administrativo (/admin). NÃO possui
//                    acesso a prontuários nem ao painel clínico (Privacy by
//                    Design). Tentativas de acesso são redirecionadas para
//                    /admin com um aviso.
//
// A sessão é validada no banco a cada requisição protegida, verificando:
//   1. existência do usuário;
//   2. `ativo = 1` (bloqueio imediato de logins/sessões);
//   3. `sessao_versao` (invalida sessões ativas após bloqueio/revogação).
//
// Todas as consultas usam placeholders (?) — sem interpolação de SQL.

// Detecta chamadas de API/JSON (fetch), que devem receber JSON e não HTML.
// Regra: rotas /api/*, cabeçalho `Accept: application/json` ou XHR/fetch.
function esperaJson(req) {
    const aceita = String(req.headers.accept || '').toLowerCase();
    const url = String(req.originalUrl || req.url || '');
    return (
        req.xhr === true ||
        aceita.includes('application/json') ||
        aceita.includes('/json') ||
        url.includes('/api/') ||
        url.startsWith('/api') ||
        url.includes('/atendimentos') ||
        url.includes('/equipe') ||
        url.includes('/minhas-estatisticas')
    );
}

/**
 * Cria os middlewares de proteção, injetando o pool de conexões.
 * @param {import('mysql2/promise').Pool} dbPool
 */
function criarGuardaSessao(dbPool) {
    /**
     * Carrega o usuário da sessão a partir do banco e devolve um diagnóstico.
     * Sempre atualiza `req.session.usuario` quando o estado é válido.
     */
    async function carregarUsuarioAtual(req) {
        const sessao = req.session && req.session.usuario;

        if (!sessao || !sessao.id) {
            return { estado: 'sem-sessao' };
        }

        let usuario;

        try {
            const [registos] = await dbPool.query(
                `SELECT id, nome, email, perfil, ativo, sessao_versao
                   FROM acolhedores
                  WHERE id = ?`,
                [sessao.id]
            );
            usuario = registos[0];
        } catch (err) {
            // Janela de migração: se a coluna ainda não existir, valida sem
            // versionamento (a migração é criada no boot do servidor).
            if (err && err.code === 'ER_BAD_FIELD_ERROR') {
                try {
                    const [registos] = await dbPool.query(
                        'SELECT id, nome, email, perfil, ativo FROM acolhedores WHERE id = ?',
                        [sessao.id]
                    );
                    usuario = registos[0];

                    if (!usuario) return { estado: 'invalida' };
                    if (!usuario.ativo) return { estado: 'bloqueada' };

                    req.session.usuario = {
                        id: usuario.id,
                        nome: usuario.nome,
                        email: usuario.email,
                        perfil: usuario.perfil,
                        sessao_versao: 0,
                        versaoSessao: 0 // alias legado
                    };
                    req.session.autenticado = usuario.perfil === 'admin';
                    return { estado: 'ok', usuario: req.session.usuario };
                } catch (errFallback) {
                    console.error('❌ Erro ao validar a sessão (fallback):', errFallback.message);
                    return { estado: 'erro' };
                }
            }

            console.error('❌ Erro ao validar a sessão no banco:', err.message);
            return { estado: 'erro' };
        }

        if (!usuario) {
            return { estado: 'invalida' };
        }

        if (Number(usuario.ativo) !== 1) {
            return { estado: 'bloqueada' };
        }

        // Compara a versão da sessão com a versão atual do registro.
        // Sessões antigas (antes da coluna existir) têm versão 0.
        // `versaoSessao` é aceito como alias legado de `sessao_versao`.
        const versaoSessao = Number(sessao.sessao_versao !== undefined
            ? sessao.sessao_versao
            : (sessao.versaoSessao || 0));
        const versaoAtual = Number(usuario.sessao_versao || 0);

        if (versaoAtual !== versaoSessao) {
            return { estado: 'invalida' };
        }

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
            sessao_versao: versaoAtual,
            versaoSessao: versaoAtual // alias legado
        };
        req.session.autenticado = usuario.perfil === 'admin';

        return { estado: 'ok', usuario: req.session.usuario };
    }

    /**
     * Destrói a sessão imediatamente e responde de acordo com o tipo de
     * requisição:
     *   • API/JSON → 401 `{ ok: false, sessao_invalida: true, ... }`
     *   • Navegação → redirect para o login (com `motivo=bloqueado`).
     */
    function encerrarSessao(req, res, mensagem, status = 401, motivo = null) {
        const usuarioSessao = req.session && req.session.usuario;
        const perfil = usuarioSessao && usuarioSessao.perfil;
        const urlAtual = String(req.originalUrl || req.url || '');
        const destinoBase = (perfil === 'admin' || urlAtual.startsWith('/admin'))
            ? '/admin/login'
            : '/acolhedor/login';
        const destino = motivo ? `${destinoBase}?motivo=${encodeURIComponent(motivo)}` : destinoBase;

        const responder = () => {
            res.clearCookie('connect.sid');

            if (esperaJson(req)) {
                return res.status(status).json({
                    ok: false,
                    sessao_invalida: true,
                    mensagem,
                    redirecionarPara: destino
                });
            }
            return res.redirect(destino);
        };

        if (req.session) {
            return req.session.destroy((err) => {
                if (err) console.error('Erro ao destruir sessão inválida:', err.message);
                responder();
            });
        }

        return responder();
    }

    /**
     * Exige sessão ativa e válida (qualquer perfil: acolhedor ou admin).
     * Usado, por exemplo, em /acolhedor/api/me (que o admin também acessa
     * para gerenciar a própria conta).
     */
    async function requireAcolhedorAuth(req, res, next) {
        const resultado = await carregarUsuarioAtual(req);

        switch (resultado.estado) {
            case 'ok':
                return next();
            case 'sem-sessao':
                return encerrarSessao(req, res, 'Sessão expirada ou não autenticado.', 401);
            case 'bloqueada':
                // Bloqueio administrativo: revoga a sessão na hora (401).
                return encerrarSessao(
                    req,
                    res,
                    'Sessão revogada ou conta inativa.',
                    401,
                    'bloqueado'
                );
            case 'invalida':
                // Versão de sessão divergente (bloqueio/revogação em outro
                // dispositivo): também encerra a sessão imediatamente.
                return encerrarSessao(
                    req,
                    res,
                    'Sessão revogada ou conta inativa.',
                    401,
                    'bloqueado'
                );
            default:
                return res.status(500).json({
                    ok: false,
                    mensagem: 'Erro interno ao validar a sessão.'
                });
        }
    }

    /**
     * Exige exclusivamente o perfil `acolhedor`.
     * Deve ser usado DEPOIS de requireAcolhedorAuth.
     * Admins são redirecionados para /admin com aviso (ou recebem 403 JSON).
     */
    function requireApenasAcolhedor(req, res, next) {
        const usuario = req.session && req.session.usuario;

        if (usuario && usuario.perfil === 'acolhedor') {
            return next();
        }

        const mensagem = 'O painel de acompanhamento clínico é exclusivo do perfil acolhedor.';

        if (esperaJson(req)) {
            return res.status(403).json({
                ok: false,
                mensagem,
                redirecionarPara: '/admin'
            });
        }

        return res.redirect(`/admin?aviso=${encodeURIComponent(mensagem)}`);
    }

    /** Exige perfil `admin` (gestão de usuários e estatísticas globais). */
    function requireAdmin(req, res, next) {
        const usuario = req.session && req.session.usuario;

        if (usuario && usuario.perfil === 'admin') {
            return next();
        }

        if (esperaJson(req)) {
            return res.status(403).json({
                ok: false,
                mensagem: 'Acesso negado. Apenas administradores.'
            });
        }

        if (usuario) {
            return res.redirect('/acolhedor/painel');
        }

        return res.redirect('/admin/login');
    }

    return {
        requireAcolhedorAuth,
        requireApenasAcolhedor,
        requireAdmin,
        carregarUsuarioAtual,
        encerrarSessao
    };
}

module.exports = {
    criarGuardaSessao,
    esperaJson
};
