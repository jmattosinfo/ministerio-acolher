// scripts/gerar-hash-senha.js
// Uso: node scripts/gerar-hash-senha.js "minhaSenhaSuperSecreta"
// Copie o hash gerado para a variável ADMIN_PASSWORD_HASH no .env

const bcrypt = require('bcryptjs');

const senha = process.argv[2];

if (!senha) {
    console.log('Uso: node scripts/gerar-hash-senha.js "sua-senha-aqui"');
    process.exit(1);
}

const hash = bcrypt.hashSync(senha, 10);
console.log('\nAdicione esta linha ao seu .env:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
