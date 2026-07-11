// Deploy: admin.js + .env (senha do banco corrigida) + restart
const { Client } = require('ssh2');
const path = require('path');

const HOST = '187.127.39.48';
const USER = 'deploy';
const PASS = 'C:\\Users\\jcmat\\.ssh\\id_rsa.pub';
const DIR = '/home/acolher/htdocs/acolher.life';

const c = new Client();
c.on('ready', () => {
    console.log('✅ Conectado');
    
    c.sftp((err, sftp) => {
        if (err) { console.error('SFTP err:', err.message); c.end(); return; }
        
        // Envia admin.js
        sftp.fastPut(
            path.join(__dirname, '..', 'routes', 'admin.js'),
            `${DIR}/routes/admin.js`, (err1) => {
            if (err1) console.error('❌ admin.js:', err1.message);
            else console.log('✅ admin.js');
            
            // Envia .env com a senha corrigida
            sftp.fastPut(
                path.join(__dirname, '..', '.env'),
                `${DIR}/.env`, (err2) => {
                if (err2) console.error('❌ .env:', err2.message);
                else console.log('✅ .env');
                
                sftp.end();
                
                console.log('🔄 Reiniciando...');
                c.exec(`cd ${DIR} && pm2 restart acolher.life 2>&1`, (e, s) => {
                    let o = '';
                    s.on('data', d => o += d);
                    s.stderr.on('data', d => o += d);
                    s.on('close', () => { console.log(o); console.log('✅ OK'); c.end(); process.exit(0); });
                });
            });
        });
    });
});
c.on('error', e => { console.error('ERR:', e.message); process.exit(1); });
console.log('🔌 Conectando...');
c.connect({ host: HOST, username: USER, password: PASS, readyTimeout: 15000 });
