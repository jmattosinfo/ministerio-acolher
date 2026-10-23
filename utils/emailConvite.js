// utils/emailConvite.js
// Templates do e-mail de convite (primeiro acesso / reenvio de link).
// Reutilizado por routes/admin.js e por scripts/sincronizar-acolhedores.js.

const VALIDADE_PADRAO_HORAS = 48;

// Entidades montadas com String.fromCharCode para evitar ambiguidade de
// escaping no código-fonte (o conteúdo é estático e seguro).
const AMP = String.fromCharCode(38); // "&"
const ENTIDADES_HTML = {
    '&': AMP + 'amp;',
    '<': AMP + 'lt;',
    '>': AMP + 'gt;',
    '"': AMP + 'quot;',
    "'": AMP + '#39;'
};

function escaparHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

/**
 * Monta o HTML do convite de primeiro acesso.
 * @param {string} nome
 * @param {string} link
 * @param {number} validadeHoras
 */
function montarEmailConvite(nome, link, validadeHoras = VALIDADE_PADRAO_HORAS) {
    const nomeSeguro = escaparHtml(nome || 'acolhedor(a)');
    const linkSeguro = escaparHtml(link);

    return `
        <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; color: #2C1A1A; background:#FFFDF9; border:1px solid #E8E0D4; border-radius:12px; overflow:hidden;">
            <div style="background:#7A1C1C; padding:24px; text-align:center;">
                <h2 style="margin:0; color:#fff; font-size:20px; font-weight:600;">🌹 Ministério Acolher</h2>
                <p style="margin:6px 0 0; color:#F4EFE6; font-size:13px;">Cuidado, escuta e acolhimento</p>
            </div>

            <div style="padding:28px 24px;">
                <p style="font-size:16px;">Olá, <strong>${nomeSeguro}</strong>.</p>
                <p style="font-size:15px; line-height:1.6;">
                    Seu acesso ao painel de acompanhamento do Ministério Acolher está pronto.
                    Para começar, basta criar sua senha pelo botão abaixo:
                </p>

                <p style="text-align:center; margin:28px 0;">
                    <a href="${linkSeguro}"
                       style="display:inline-block; background:#7A1C1C; color:#fff; text-decoration:none;
                              padding:13px 28px; border-radius:8px; font-size:15px; font-weight:600;">
                        Criar minha senha
                    </a>
                </p>

                <p style="font-size:13px; color:#7A5C5C; line-height:1.5;">
                    Este link é válido por <strong>${validadeHoras} horas</strong> e pode ser usado apenas uma vez.
                    Se o botão não funcionar, copie e cole o endereço abaixo no navegador:
                </p>
                <p style="font-size:12px; word-break:break-all; background:#F4EFE6; padding:10px 12px; border-radius:6px; color:#5C1414;">
                    ${linkSeguro}
                </p>

                <p style="font-size:13px; color:#7A5C5C; line-height:1.5; margin-top:24px;">
                    Se você não reconhece este convite, basta ignorar esta mensagem — nenhuma
                    alteração será feita na sua conta.
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

/**
 * Versão em texto puro do convite (fallback/alternativa ao HTML).
 */
function montarTextoConvite(nome, link, validadeHoras = VALIDADE_PADRAO_HORAS) {
    return [
        `Olá, ${nome || 'acolhedor(a)'}.`,
        '',
        'Seu acesso ao painel de acompanhamento do Ministério Acolher está pronto.',
        `Crie sua senha pelo link abaixo (válido por ${validadeHoras} horas):`,
        link,
        '',
        'Se você não reconhece este convite, ignore esta mensagem.',
        '',
        'Ministério Acolher'
    ].join('\n');
}

module.exports = {
    VALIDADE_PADRAO_HORAS,
    montarEmailConvite,
    montarTextoConvite
};
