// scripts/restart-server.js
// Reinicia o servidor na VPS via PM2 (acolher.life).
// Uso: node scripts/restart-server.js
//
// Configuração via variáveis de ambiente (VPS_*). SEM credenciais hardcoded.
//   VPS_HOST          (padrão: 187.127.39.48)
//   VPS_USER          (padrão: deploy)
//   VPS_PRIVATE_KEY   (padrão: ~/.ssh/id_ed25519)
//   VPS_PASS          (opcional — fallback por senha, caso não use chave)
//   VPS_DIR           (padrão: /home/acolher/htdocs/acolher.life)

require('dotenv').config();
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = process.env.VPS_HOST || '187.127.39.48';
const USER = process.env.VPS_USER || 'deploy';
const PASS = process.env.VPS_PASS;
const KEY = process.env.VPS_PRIVATE_KEY || path.join(process.env.HOME || '.', '.ssh', 'id_ed25519');
const DIR = process.env.VPS_DIR || '/home/acolher/htdocs/acolher.life';

const c = new Client();

c.on('ready', () => {
    console.log(`✅ Conectado como ${USER}@${HOST}`);
    c.exec(`cd ${DIR} && pm2 restart acolher.life 2>&1; echo "---STATUS---"; pm2 status 2>&1`, (err, stream) => {
        let out = '';
        stream.on('data', d => out += d);
        stream.stderr.on('data', d => out += d);
        stream.on('close', () => {
            console.log(out);
            console.log('✅ Servidor reiniciado. Verifique https://acolher.life/admin/');
            c.end();
            process.exit(0);
        });
    });
});

c.on('error', (e) => {
    console.error('❌ Erro de conexão:', e.message);
    process.exit(1);
});

const opts = { host: HOST, port: 22, username: USER, readyTimeout: 15000 };
if (PASS) {
    opts.password = PASS;
} else if (fs.existsSync(KEY)) {
    opts.privateKey = fs.readFileSync(KEY);
} else {
    console.error(`❌ Nenhuma credencial encontrada: defina VPS_PASS ou a chave em ${KEY}`);
    process.exit(1);
}

console.log(`🔌 Conectando a ${USER}@${HOST}...`);
c.connect(opts);
