// scripts/restart-server.js
const { Client } = require('ssh2');
const c = new Client();

c.on('ready', () => {
    console.log('✅ Conectado');
    
    // Verifica se PM2 está disponível
    c.exec('which pm2 || echo "PM2_NOT_FOUND"', (err, stream) => {
        let out = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => out += d.toString());
        stream.on('close', () => {
            const hasPm2 = !out.includes('PM2_NOT_FOUND');
            console.log(`PM2: ${hasPm2 ? '✅' : '❌'}`);
            
            if (hasPm2) {
                // Inicia com PM2
                c.exec('cd /home/acolher/htdocs/acolher.life && pm2 start server.js --name acolher.life 2>&1; echo "---STATUS---"; pm2 status 2>&1', (err, stream) => {
                    let out = '';
                    stream.on('data', d => out += d.toString());
                    stream.stderr.on('data', d => out += d.toString());
                    stream.on('close', () => {
                        console.log('Resultado:', out);
                        console.log('✅ Comando executado. Verifique https://acolher.life/admin/');
                        c.end();
                    });
                });
            } else {
                // Inicia sem PM2
                c.exec('cd /home/acolher/htdocs/acolher.life && nohup node server.js > /tmp/acolher.log 2>&1 & echo $!', (err, stream) => {
                    let out = '';
                    stream.on('data', d => out += d.toString());
                    stream.stderr.on('data', d => out += d.toString());
                    stream.on('close', () => {
                        console.log('PID:', out);
                        console.log('✅ Servidor iniciado. Verifique https://acolher.life/admin/');
                        c.end();
                    });
                });
            }
        });
    });
});

c.on('error', e => {
    console.error('❌ Erro de conexão:', e.message);
    process.exit(1);
});

console.log('🔌 Conectando...');
c.connect({ host:'187.127.39.48', username:'root', password:'Julio-Kelly090911', readyTimeout:15000 });
