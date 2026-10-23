// scripts/criar-admin-inicial.js
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function criarAdminInicial() {
    const nome = process.argv[2] || 'Administrador';
    const email = process.argv[3] || 'admin@acolher.life';
    const senha = process.argv[4] || 'Admin@2026';

    console.log(`\n⏳ Criando administrador: ${nome} (${email})...`);

    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const [existe] = await pool.query('SELECT id FROM acolhedores WHERE email = ?', [email]);
        
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        if (existe.length > 0) {
            await pool.query(
                'UPDATE acolhedores SET nome = ?, senha_hash = ?, perfil = "admin", ativo = 1 WHERE email = ?',
                [nome, senhaHash, email]
            );
            console.log(`✅ Administrador atualizado com sucesso!`);
        } else {
            await pool.query(
                'INSERT INTO acolhedores (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, "admin", 1)',
                [nome, email, senhaHash]
            );
            console.log(`✅ Administrador criado com sucesso!`);
        }

        console.log(`\n🔑 Credenciais de acesso inicial:`);
        console.log(`   E-mail: ${email}`);
        console.log(`   Palavra-passe: ${senha}\n`);
    } catch (err) {
        console.error('❌ Erro ao criar administrador:', err.message);
    } finally {
        await pool.end();
    }
}

criarAdminInicial();