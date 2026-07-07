// middleware/auth.js
// Protege rotas do painel administrativo verificando se existe sessão autenticada.

function requireAuth(req, res, next) {
    if (req.session && req.session.autenticado) {
        return next();
    }

    // Se for chamada de API, responde com JSON 401 (o front trata isso)
    if (req.path.startsWith('/admin/api/')) {
        return res.status(401).json({ ok: false, mensagem: 'Sessão expirada. Faça login novamente.' });
    }

    // Se for navegação normal, redireciona para a tela de login
    return res.redirect('/admin/login');
}

module.exports = { requireAuth };
