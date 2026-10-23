// middleware/auth.js
// Camada de compatibilidade: delega para a guarda de sessão unificada.
//
// A autenticação do Ministério Acolher é unificada (tabela `acolhedores`).
// A regra administrativa vive em middleware/acolhedorAuth.js.
//
// Uso (se necessário):
//   const criarAuth = require('../middleware/auth');
//   const { requireAuth } = criarAuth(dbPool);

const { criarGuardaSessao } = require('./acolhedorAuth');

module.exports = function criarAuth(dbPool) {
    const { requireAdmin } = criarGuardaSessao(dbPool);

    return {
        // Sessão válida + perfil administrativo
        requireAuth: requireAdmin,
        requireAdmin
    };
};
