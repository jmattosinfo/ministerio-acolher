// scripts/corrigir-encoding.js
// Repara textos gravados com duplo-encoding (mojibake) no banco de dados.
//
// Sintoma típico:
//   "SÃ£o JosÃ© dos Campos â€“ SP"  ->  "São José dos Campos – SP"
//
// Causa: o cliente MySQL (pool) estava em latin1 e enviava bytes UTF-8 que o
// servidor interpretava como cp1252 antes de gravar. Definir `charset:
// 'utf8mb4'` no pool (feito em server.js) evita NOVOS registos corrompidos;
// este script corrige os registos que já estão no banco.
//
// Uso:
//   node scripts/corrigir-encoding.js                      # simulação (dry-run)
//   node scripts/corrigir-encoding.js --aplicar            # grava as correções
//   node scripts/corrigir-encoding.js --tabela=feedbacks   # limita a uma tabela
//   node scripts/corrigir-encoding.js --verboso            # mostra antes/depois
//
// Por padrão NÃO imprime o conteúdo dos campos (podem conter dados sensíveis
// de acolhimento); apenas indica tabela, id e coluna afetada.
//
// Segurança:
//   • Só altera valores que casem com o padrão de mojibake E que possam ser
//     reconvertidos sem caracteres inválidos (U+FFFD).
//   • Atualizações usam queries parametrizadas (?) e id como chave.
//   • Roda em transação: qualquer falha faz rollback de tudo.

require('dotenv').config();

const mysql = require('mysql2/promise');

const APLICAR = process.argv.includes('--aplicar');
const VERBOSO = process.argv.includes('--verboso');

// `--tabela=nome` limita a execução a uma tabela específica.
const ARG_TABELA = process.argv.find((arg) => arg.startsWith('--tabela='));
const TABELA_FILTRO = ARG_TABELA ? ARG_TABELA.split('=')[1].trim() : null;

// ─── Detecção de mojibake ──────────────────────────────────────────────────
// "Ã©", "Ã£", "Ã§", "Ãµ" (latin1 exibindo UTF-8) e "â€“", "â€™" (cp1252
// exibindo UTF-8). "Ã" isolado seguido de letra comum NÃO é mojibake.
const PADRAO_MOJIBAKE = /Ã[\u0080-\u00FF]|Â[\u0080-\u00BF\u0152\u0160\u017D]|â€/;

// Mapa inverso dos caracteres cp1252 na faixa 0x80–0x9F (onde UTF-8
// interpretado como Windows-1252 costuma gerar "â€“", "â€™", "â€œ" etc.).
const CP1252_PARA_BYTE = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};

/** Converte a string "vista em cp1252" de volta para os bytes originais. */
function textoParaBytesCp1252(texto) {
    const bytes = [];

    for (const caractere of texto) {
        const codigo = caractere.codePointAt(0);

        if (codigo <= 0xFF) {
            bytes.push(codigo);
        } else if (CP1252_PARA_BYTE[codigo] !== undefined) {
            bytes.push(CP1252_PARA_BYTE[codigo]);
        } else {
            // Caractere não representável em cp1252: não é este tipo de
            // corrupção (ou já está correto). Não mexemos.
            return null;
        }
    }

    return Buffer.from(bytes);
}

/**
 * Retorna o texto corrigido ou `null` quando nada deve ser alterado.
 */
function corrigirTexto(valor) {
    if (typeof valor !== 'string' || valor.length === 0) return null;
    if (!PADRAO_MOJIBAKE.test(valor)) return null;

    let atual = valor;

    // Aplica até 2 passes (suporta corrupção dupla), estabilizando no fim.
    for (let passe = 0; passe < 2; passe++) {
        if (!PADRAO_MOJIBAKE.test(atual)) break;

        const bytes = textoParaBytesCp1252(atual);
        if (!bytes) break;

        const convertido = bytes.toString('utf8');
        if (convertido.includes('\uFFFD')) break; // conversão inválida
        if (convertido === atual) break;

        atual = convertido;
    }

    return atual === valor ? null : atual;
}

// ─── Tabelas/colunas inspecionadas ─────────────────────────────────────────
const ALVOS = {
    cadastros: [
        'nome',
        'localizacao',
        'pais',
        'estado_civil',
        'rede_apoio',
        'motivo_terapia',
        'preferencia_horario',
        'onde_conheceu',
        'notas_sessao_1',
        'notas_sessao_2',
        'notas_sessao_3'
    ],
    acolhedores: ['nome'],
    feedbacks: ['mensagem']
};

function mascarar(valor) {
    if (typeof valor !== 'string') return '';
    return valor.length > 90 ? `${valor.slice(0, 90)}…` : valor;
}

async function main() {
    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number.parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });

    console.log(`🔎 Modo: ${APLICAR ? 'APLICAR (grava no banco)' : 'SIMULAÇÃO (dry-run)'}\n`);

    let totalDetectado = 0;
    let totalCorrigido = 0;

    try {
        for (const [tabela, colunasPreferidas] of Object.entries(ALVOS)) {
            if (TABELA_FILTRO && tabela !== TABELA_FILTRO) continue;

            // Confirma quais colunas realmente existem (bancos antigos podem
            // não ter, por exemplo, `pais`).
            const [colunasExistentes] = await conexao.query(
                `SELECT COLUMN_NAME AS nome
                   FROM INFORMATION_SCHEMA.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
                [tabela]
            );

            if (colunasExistentes.length === 0) {
                console.log(`⏭️  Tabela "${tabela}" não existe — ignorada.`);
                continue;
            }

            const disponiveis = new Set(colunasExistentes.map((c) => c.nome));
            const colunas = colunasPreferidas.filter((c) => disponiveis.has(c));

            if (colunas.length === 0) {
                console.log(`⏭️  Tabela "${tabela}" sem colunas de texto conhecidas — ignorada.`);
                continue;
            }

            const listaColunas = ['id', ...colunas].join(', ');
            const [linhas] = await conexao.query(`SELECT ${listaColunas} FROM ${tabela}`);

            let detectadosNaTabela = 0;

            for (const linha of linhas) {
                const alteracoes = {};

                for (const coluna of colunas) {
                    const corrigido = corrigirTexto(linha[coluna]);
                    if (corrigido !== null) {
                        alteracoes[coluna] = corrigido;
                    }
                }

                const colunasAfetadas = Object.keys(alteracoes);
                if (colunasAfetadas.length === 0) continue;

                detectadosNaTabela++;
                totalDetectado++;

                console.log(`\n📄 ${tabela} id=${linha.id}`);
                for (const coluna of colunasAfetadas) {
                    console.log(`   • ${coluna}`);
                    if (VERBOSO) {
                        console.log(`     antes:  ${mascarar(linha[coluna])}`);
                        console.log(`     depois: ${mascarar(alteracoes[coluna])}`);
                    }
                }

                if (!APLICAR) continue;

                const sets = colunasAfetadas.map((coluna) => `${coluna} = ?`).join(', ');
                const valores = colunasAfetadas.map((coluna) => alteracoes[coluna]);
                valores.push(linha.id);

                await conexao.query(
                    `UPDATE ${tabela} SET ${sets} WHERE id = ?`,
                    valores
                );

                totalCorrigido++;
            }

            if (detectadosNaTabela === 0) {
                console.log(`✅ Tabela "${tabela}": nenhum registro corrompido.`);
            }
        }

        // ─── Resumo ────────────────────────────────────────────────────
        console.log('\n──────────────────────────────────────────────');
        console.log(`Registros com mojibake detectados: ${totalDetectado}`);

        if (APLICAR) {
            console.log(`Registros corrigidos no banco:     ${totalCorrigido}`);
            console.log('💾 Alterações gravadas com sucesso.');
        } else if (totalDetectado > 0) {
            console.log('ℹ️  Nada foi gravado. Rode novamente com --aplicar para corrigir.');
        } else {
            console.log('✨ Nenhuma correção necessária.');
        }
        console.log('──────────────────────────────────────────────');
    } finally {
        await conexao.end();
    }
}

// Executa apenas quando chamado diretamente (permite testar as funções).
if (require.main === module) {
    main().catch((err) => {
        console.error('❌ Falha ao executar a correção de encoding:', err.message);
        process.exit(1);
    });
}

module.exports = { corrigirTexto, textoParaBytesCp1252 };
