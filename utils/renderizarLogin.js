// utils/renderizarLogin.js
// Renderiza o template único views/login.html com a configuração de cada
// área (admin ou acolhedor).
//
// Antes existiam duas cópias quase idênticas (views/admin/login.html e
// views/acolhedor/login.html), o que fazia com que correções fossem aplicadas
// em apenas uma delas. Agora há um único template com placeholders.
//
// Placeholders suportados:
//   {{TITULO}}          -> <title> da página
//   {{SUBTITULO}}       -> texto abaixo do cabeçalho
//   {{MARCA}}           -> HTML do cabeçalho (logo ou emoji + título)
//   {{VARIANTE}}        -> "admin" | "acolhedor" (atributo data-variante)
//   {{DESTINO_PADRAO}}  -> destino de fallback pós-login (data-destino-padrao)

const fs = require('fs');
const path = require('path');

const CAMINHO_TEMPLATE = path.join(__dirname, '..', 'views', 'login.html');

// Entidades montadas com String.fromCharCode para evitar ambiguidade de
// escaping (mesma estratégia usada em public/admin/dashboard.js).
const AMP = String.fromCharCode(38); // "&"

const ENTIDADES_HTML = {
    [AMP]: AMP + 'amp;',
    '<': AMP + 'lt;',
    '>': AMP + 'gt;',
    '"': AMP + 'quot;',
    "'": AMP + '#39;'
};

function escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

// Configuração de cada área. `marca` é HTML controlado pelo servidor
// (nunca recebe entrada de usuário), por isso não passa por escapeHtml.
const VARIANTES_LOGIN = {
    admin: {
        titulo: 'Área Restrita — Ministério Acolher',
        subtitulo: 'Acesso à Equipe',
        destinoPadrao: '/admin',
        marca: [
            '<img src="/assets/images/logo.svg" alt="Ministério Acolher"',
            ' style="height: 48px; display: block; margin: 0 auto 12px;"',
            " onerror=\"this.style.display='none'\">",
            'Área Restrita'
        ].join('')
    },
    acolhedor: {
        titulo: 'Entrar — Ministério Acolher',
        subtitulo: 'Acesso da equipe de acolhedores',
        destinoPadrao: '/acolhedor/painel',
        marca: '🌹 Ministério Acolher'
    }
};

/**
 * Devolve o HTML do login já parametrizado.
 * @param {'admin'|'acolhedor'} variante
 * @returns {string}
 */
function renderizarLogin(variante = 'admin') {
    const nomeVariante = Object.prototype.hasOwnProperty.call(VARIANTES_LOGIN, variante)
        ? variante
        : 'admin';
    const config = VARIANTES_LOGIN[nomeVariante];

    const template = fs.readFileSync(CAMINHO_TEMPLATE, 'utf8');

    const valores = {
        TITULO: escaparHtml(config.titulo),
        SUBTITULO: escaparHtml(config.subtitulo),
        MARCA: config.marca,
        VARIANTE: nomeVariante,
        DESTINO_PADRAO: escaparHtml(config.destinoPadrao)
    };

    const html = Object.entries(valores).reduce(
        (resultado, [chave, valor]) => resultado.split(`{{${chave}}}`).join(valor),
        template
    );

    // Falha cedo se algum placeholder ficar sem valor (evita página quebrada).
    const pendentes = html.match(/\{\{[A-Z_]+\}\}/g);
    if (pendentes) {
        console.warn('⚠️ Placeholders não preenchidos no template de login:', pendentes.join(', '));
    }

    return html;
}

module.exports = {
    renderizarLogin,
    VARIANTES_LOGIN
};
