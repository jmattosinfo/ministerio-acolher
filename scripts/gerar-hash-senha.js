// scripts/gerar-hash-senha.js
// Uso: node scripts/gerar-hash-senha.js "minhaSenhaSuperSecreta"
//
// A autenticação é unificada na tabela `acolhedores` (coluna `senha_hash`).
// Para criar um administrador com senha, prefira:
//   node scripts/criar-admin-inicial.js "Nome" "email" "senha"
//
// Este script serve para uso manual/emergencial (ex.: atualizar uma senha
// diretamente no banco com SQL).

const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
    console.log('Uso: node scripts/gerar-hash-senha.js "sua-senha-aqui"');
    process.exit(1);
}

const hash = bcrypt.hashSync(senha, 10);
console.log('\nHash bcrypt gerado:\n');
console.log(hash + '\n');
console.log('Exemplo de uso manual no MySQL:\n');
console.log(`UPDATE acolhedores SET senha_hash = '${hash}' WHERE email = 'usuario@acolher.life';\n`);
