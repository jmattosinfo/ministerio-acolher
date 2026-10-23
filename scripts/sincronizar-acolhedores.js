#!/usr/bin/env node
// scripts/sincronizar-acolhedores.js
//
// Sincroniza a equipe atual do Ministério Acolher com a tabela `acolhedores`
// e gera um link de primeiro acesso (token válido por 48h) para cada pessoa.
//
// Uso:
//   node scripts/sincronizar-acolhedores.js                  -> apenas DB + links no console
//   node scripts/sincronizar-acolhedores.js --enviar-email   -> DB + e-mail (SMTP do .env) + links
//   node scripts/sincronizar-acolhedores.js --help
//
// Observações de segurança:
//   • Todas as consultas usam placeholders (?) — sem interpolação de SQL.
//   • O `senha_hash` existente NUNCA é sobrescrito: quem já tem senha continua
//     com a senha atual; o token serve apenas para (re)definir o acesso.
//   • Tokens anteriores ainda não usados são invalidados a cada execução,
//     garantindo que apenas o link mais recente esteja válido.

const path = require('path');
const crypto = require('crypto');

// Carrega o .env da raiz do projeto, independentemente do diretório atual
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

// ─── Equipe atual (espaço reservado para os e-mails pessoais) ────────────────
// Ao cadastrar uma nova pessoa, basta acrescentar um item nesta lista.
const EQUIPE = [
    { nome: 'Agda',     email: 'acolhedoraagda@gmail.com',        perfil: 'acolhedor' },
    { nome: 'Gabriela', email: 'gabrielaherculano1987@gmail.com', perfil: 'acolhedor' },
    { nome: 'Shirley',  email: 'shirleyvale@gmail.com',           perfil: 'acolhedor' },
    { nome: 'Kelly',    email: 'orquideawolff@gmail.com',         perfil: 'acolhedor' },
    { nome: 'Matheus',  email: 'matheussantosqmc@gmail.com',      perfil: 'acolhedor' }
];

const VALIDADE_HORAS = 48;
const URL_BASE = String(process.env.APP_URL || process.env.BASE_URL || 'https://acolher.life')
    .trim()
    .replace(/\/+$/, '');

const ENVIAR_EMAIL = process.argv.includes('--enviar-email');
const MOSTRAR_AJUDA = process.argv.includes('--help') || process.argv.includes('-h');

// ─── Template do e-mail de convite ───────────────────────────────────────────
function montarEmailConvite(nome, link) {
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
                    Este link é válido por <strong>${VALIDADE_HORAS} horas</strong> e pode ser usado apenas uma vez.
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

function montarTextoConvite(nome, link) {
    return [
        `Olá, ${nome}.`,
        '',
        'Seu acesso ao painel de acompanhamento do Ministério Acolher está pronto.',
        `Crie sua senha pelo link abaixo (válido por ${VALIDADE_HORAS} horas):`,
        link,
        '',
        'Se você não reconhece este convite, ignore esta mensagem.',
        '',
        'Ministério Acolher'
    ].join('\n');
}

function criarPool() {
    const obrigatorias = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'];
    const faltando = obrigatorias.filter((chave) => !process.env[chave]);

    if (faltando.length > 0) {
        throw new Error(`Variáveis de banco ausentes no .env: ${faltando.join(', ')}`);
    }

    return mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 5
    });
}

function criarTransporter() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('SMTP ausente no .env (EMAIL_HOST / EMAIL_USER / EMAIL_PASS).');
    }

    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number.parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

/**
 * Insere ou atualiza o acolhedor e gera um novo token de primeiro acesso.
 * @param {import('mysql2/promise').Pool} pool
 * @param {{nome: string, email: string, perfil: string}} membro
 */
async function sincronizarMembro(pool, membro) {
    // A presença é verificada antes do upsert porque o mysql2 usa
    // CLIENT_FOUND_ROWS por padrão (affectedRows deixa de ser confiável
    // para distinguir "inserido" de "atualizado sem mudanças").
    const [existentes] = await pool.query(
        'SELECT id FROM acolhedores WHERE email = ?',
        [membro.email]
    );
    const situacao = existentes.length > 0 ? 'atualizado' : 'inserido';

    await pool.query(
        `INSERT INTO acolhedores (nome, email, perfil, ativo)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
             nome = VALUES(nome),
             perfil = VALUES(perfil),
             ativo = 1`,
        [membro.nome, membro.email, membro.perfil]
    );

    const [registos] = await pool.query(
        'SELECT id, nome, email FROM acolhedores WHERE email = ?',
        [membro.email]
    );

    if (registos.length === 0) {
        throw new Error('Registro não localizado após o upsert.');
    }

    const acolhedor = registos[0];

    // Invalida convites antigos ainda não utilizados
    await pool.query(
        'UPDATE tokens_primeiro_acesso SET usado = 1 WHERE acolhedor_id = ? AND usado = 0',
        [acolhedor.id]
    );

    const token = crypto.randomBytes(32).toString('hex');

    // Expiração calculada pelo MySQL (NOW() + 48h) para evitar divergência de fuso
    await pool.query(
        `INSERT INTO tokens_primeiro_acesso (acolhedor_id, token, usado, expira_em)
         VALUES (?, ?, 0, DATE_ADD(NOW(), INTERVAL ${VALIDADE_HORAS} HOUR))`,
        [acolhedor.id, token]
    );

    return {
        id: acolhedor.id,
        nome: membro.nome,
        email: membro.email,
        perfil: membro.perfil,
        situacao,
        link: `${URL_BASE}/redefinir-senha?token=${token}`
    };
}

function imprimirResumo(resultados, falhas) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('🌹 Ministério Acolher — Sincronização da equipe');
    console.log('══════════════════════════════════════════════════════════════\n');

    resultados.forEach((r) => {
        const envio = r.emailEnviado === undefined
            ? ''
            : r.emailEnviado
                ? '  ✉️  convite enviado'
                : `  ⚠️  falha no e-mail: ${r.erroEmail}`;

        console.log(`• ${r.nome} <${r.email}> — ${r.situacao}${envio}`);
    });

    if (falhas.length > 0) {
        console.log('\n❌ Falhas:');
        falhas.forEach((f) => console.log(`   • ${f.nome} <${f.email}>: ${f.erro}`));
    }

    console.log('\n🔗 Links de primeiro acesso (válidos por 48h)');
    console.log('   Copie e envie por WhatsApp quando necessário:\n');

    resultados.forEach((r) => {
        console.log(`   ${r.nome}:`);
        console.log(`   ${r.link}\n`);
    });

    console.log('══════════════════════════════════════════════════════════════');
    console.log(
        `✅ Concluído: ${resultados.length} sincronizado(s), ${falhas.length} falha(s).` +
        (ENVIAR_EMAIL ? ' E-mails processados.' : ' Nenhum e-mail enviado (use --enviar-email).')
    );
    console.log('══════════════════════════════════════════════════════════════\n');
}

async function main() {
    if (MOSTRAR_AJUDA) {
        console.log(`
Sincroniza a equipe do Ministério Acolher e gera convites de primeiro acesso.

Uso:
  node scripts/sincronizar-acolhedores.js                 Gera os links e imprime no console
  node scripts/sincronizar-acolhedores.js --enviar-email  Também envia por e-mail (SMTP do .env)

Variável opcional:
  APP_URL   Base dos links gerados (padrão: https://acolher.life)
`);
        return;
    }

    let pool;
    let transporter = null;

    try {
        pool = criarPool();

        if (ENVIAR_EMAIL) {
            try {
                transporter = criarTransporter();
            } catch (err) {
                console.warn(`⚠️  ${err.message} Os links serão apenas impressos no console.`);
            }
        }

        const resultados = [];
        const falhas = [];

        for (const membro of EQUIPE) {
            try {
                const resultado = await sincronizarMembro(pool, membro);

                if (transporter) {
                    try {
                        await transporter.sendMail({
                            from: `"Ministério Acolher" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                            to: resultado.email,
                            subject: 'Convite de acesso — Ministério Acolher',
                            text: montarTextoConvite(resultado.nome, resultado.link),
                            html: montarEmailConvite(resultado.nome, resultado.link)
                        });
                        resultado.emailEnviado = true;
                    } catch (errEmail) {
                        resultado.emailEnviado = false;
                        resultado.erroEmail = errEmail.message;
                    }
                }

                resultados.push(resultado);
                console.log(`✅ ${resultado.nome} (${resultado.email}) — ${resultado.situacao}`);
            } catch (err) {
                falhas.push({ nome: membro.nome, email: membro.email, erro: err.message });
                console.error(`❌ ${membro.nome} (${membro.email}): ${err.message}`);
            }
        }

        imprimirResumo(resultados, falhas);
        process.exitCode = falhas.length > 0 ? 1 : 0;
    } catch (err) {
        console.error('❌ Erro fatal na sincronização:', err.message);
        process.exitCode = 1;
    } finally {
        if (pool) {
            try { await pool.end(); } catch (_) { /* ignora */ }
        }
    }
}

// Executa apenas quando chamado diretamente (permite `require` em testes)
if (require.main === module) {
    main();
}

module.exports = {
    EQUIPE,
    montarEmailConvite,
    montarTextoConvite,
    sincronizarMembro
};
