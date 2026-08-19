// scripts/deploy-vps.js
// Deploy da aplicação para a VPS via SFTP + restart do PM2 (acolher.life).
// Uso: node scripts/deploy-vps.js
//
// Configuração via variáveis de ambiente (VPS_*). SEM credenciais hardcoded.
//   VPS_HOST          (padrão: 187.127.39.48)
//   VPS_USER          (padrão: deploy)
//   VPS_PRIVATE_KEY   (padrão: ~/.ssh/id_ed25519)
//   VPS_PASS          (opcional — fallback por senha, caso não use chave)
//   VPS_DIR           (padrão: /home/acolher/htdocs/acolher.life)
//
// O .env de produção NUNCA é enviado por este script (evita sobrescrever
// configurações reais). Segredos de produção são mantidos apenas no servidor.

require('dotenv').config();
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const HOST = process.env.VPS_HOST || '187.127.39.48';
const USER = process.env.VPS_USER || 'deploy';
const PASS = process.env.VPS_PASS;
const KEY = process.env.VPS_PRIVATE_KEY || path.join(process.env.HOME || '.', '.ssh', 'id_ed25519');
const DIR = process.env.VPS_DIR || '/home/acolher/htdocs/acolher.life';

const ORIGEM = path.join(__dirname, '..');

// Itens do repositório enviados para produção
const ITENS = ['server.js', 'package.json', 'package-lock.json', 'middleware', 'routes', 'utils', 'views', 'public'];

// Nomes excluídos em qualquer pasta (segredos, controle de versão e dev)
const EXCLUIR = new Set(['.env', '.env.example', '.git', 'node_modules', '.vscode', 'workflow.md', 'scripts']);

// Coleta recursivamente [{local, remoto}] dos arquivos a enviar
const arquivos = [];
function coletar(itemRel) {
    const local = path.join(ORIGEM, itemRel);
    const stat = fs.statSync(local);
    if (stat.isDirectory()) {
        for (const entrada of fs.readdirSync(local)) {
            if (EXCLUIR.has(entrada)) continue;
            coletar(path.join(itemRel, entrada));
        }
    } else {
        arquivos.push({ local, remoto: path.join(DIR, itemRel) });
    }
}
ITENS.forEach(coletar);

if (arquivos.length === 0) {
    console.error('❌ Nenhum arquivo para enviar.');
    process.exit(1);
}

const c = new Client();

c.on('ready', () => {
    console.log(`✅ Conectado como ${USER}@${HOST}`);
    c.sftp((err, sftp) => {
        if (err) {
            console.error('❌ SFTP err:', err.message);
            c.end();
            process.exit(1);
            return;
        }
        uploadSequencial(sftp, 0, () => {
            console.log(`🔄 Reiniciando PM2 (${DIR})...`);
            c.exec(`cd ${DIR} && pm2 restart acolher.life 2>&1`, (e, s) => {
                let out = '';
                s.on('data', d => out += d);
                s.stderr.on('data', d => out += d);
                s.on('close', () => {
                    console.log(out);
                    console.log('✅ Deploy concluído.');
                    c.end();
                    process.exit(0);
                });
            });
        });
    });
});

function uploadSequencial(sftp, i, done) {
    if (i >= arquivos.length) return done();
    const { local, remoto } = arquivos[i];
    const dir = path.posix.dirname(remoto);
    garantirDir(sftp, dir, () => {
        sftp.fastPut(local, remoto, (errPut) => {
            if (errPut) console.error(`❌ ${path.relative(ORIGEM, local)}: ${errPut.message}`);
            else console.log(`✅ ${path.relative(ORIGEM, local)}`);
            uploadSequencial(sftp, i + 1, done);
        });
    });
}

function garantirDir(sftp, dir, done) {
    sftp.stat(dir, (errStat) => {
        if (!errStat) return done();
        garantirDir(sftp, path.posix.dirname(dir), () => {
            sftp.mkdir(dir, (errMk) => {
                // errMk.code 4 = diretório já existe (ok)
                if (errMk && errMk.code !== 4) console.error(`⚠️ mkdir ${dir}: ${errMk.message}`);
                done();
            });
        });
    });
}

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

console.log(`🔌 Conectando a ${USER}@${HOST}... (${arquivos.length} arquivos)`);
c.connect(opts);
