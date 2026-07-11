// Script para deletar o último registro de teste da tabela cadastros
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 5
        });

        const conn = await pool.getConnection();
        const [rows] = await conn.query(
            'SELECT id, nome, criado_em FROM cadastros ORDER BY id DESC LIMIT 1'
        );

        if (rows.length === 0) {
            console.log('Nenhum registro encontrado na tabela cadastros.');
        } else {
            console.log('Último registro encontrado:', rows[0]);
            const [del] = await conn.query('DELETE FROM cadastros WHERE id = ?', [rows[0].id]);
            console.log(`Registro ID ${rows[0].id} excluído com sucesso.`);
        }

        conn.release();
        await pool.end();
    } catch (err) {
        console.error('Erro ao conectar ao banco:', err.message);
    }
})();
