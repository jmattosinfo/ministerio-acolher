require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Configuração do transporte de e-mail (Brevo / SMTP) ────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true para porta 465, false para 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ─── Mapa de profissionais por perfil de triagem ────────────────────────────
const PROFISSIONAIS = {
    homem: {
        nome: 'Matheus',
        email: 'matheus@exemplo.com',
        whatsapp: '5548996685580',
        whatsappFormatado: '(48) 9 9668-5580'
    },
    vitima_abuso: {
        nome: 'Kelly',
        email: 'kelly@exemplo.com',
        whatsapp: '5551999336247',
        whatsappFormatado: '(51) 9 9933-6247'
    }
};

// Categoria "mulher" alterna entre Agda e Gabriela (round-robin)
const EQUIPE_MULHER = [
    {
        nome: 'Agda',
        email: 'agda@exemplo.com',
        whatsapp: '5561996266348',
        whatsappFormatado: '(61) 9 9626-6348'
    },
    {
        nome: 'Gabriela',
        email: 'gabriela@exemplo.com',
        whatsapp: '5585984355097',
        whatsappFormatado: '(85) 9 8435-5097'
    }
];

let indiceRoundRobin = 0;

function proximoProfissionalMulher() {
    const profissional = EQUIPE_MULHER[indiceRoundRobin];
    indiceRoundRobin = (indiceRoundRobin + 1) % EQUIPE_MULHER.length;
    return profissional;
}

function obterProfissional(perfil) {
    if (perfil === 'mulher') return proximoProfissionalMulher();
    return PROFISSIONAIS[perfil] || null;
}

// ─── Monta o corpo do e-mail com os dados do formulário ─────────────────────
function montarEmailHtml(d, objetivos) {
    return `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7A1C1C;">Novo acolhimento recebido</h2>
            <p style="color: #2C1A1A;">Um novo formulário foi preenchido e direcionado a você.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">

            <h3 style="color: #7A1C1C; font-size: 14px;">Identificação</h3>
            <p><strong>Nome:</strong> ${d.nome || '-'}</p>
            <p><strong>Data de nascimento:</strong> ${d.data_nascimento || '-'}</p>
            <p><strong>Localização:</strong> ${d.localizacao || '-'}</p>
            <p><strong>WhatsApp:</strong> ${d.whatsapp || '-'}</p>
            <p><strong>E-mail:</strong> ${d.email || '-'}</p>
            <p><strong>Contato de emergência:</strong> ${d.contato_emergencia || '-'}</p>

            <h3 style="color: #7A1C1C; font-size: 14px;">Contexto</h3>
            <p><strong>Estado civil:</strong> ${d.estado_civil || '-'}</p>
            <p><strong>Escolaridade:</strong> ${d.escolaridade || '-'}</p>
            <p><strong>Trabalho:</strong> ${d.trabalho || '-'}</p>
            <p><strong>Rede de apoio:</strong> ${d.rede_apoio || '-'}</p>

            <h3 style="color: #7A1C1C; font-size: 14px;">Histórico clínico</h3>
            <p><strong>Motivo da terapia:</strong> ${d.motivo_terapia || '-'}</p>
            <p><strong>Tempo do incômodo:</strong> ${d.tempo_incomodo || '-'}</p>
            <p><strong>Já fez terapia:</strong> ${d.ja_fez_terapia || '-'} (${d.detalhes_terapia_anterior || '-'})</p>
            <p><strong>Diagnóstico médico:</strong> ${d.diagnostico_medico || '-'}</p>
            <p><strong>Medicação:</strong> ${d.medicacao || '-'}</p>
            <p><strong>Sono (1-10):</strong> ${d.escala_sono || '-'} &nbsp;|&nbsp; <strong>Estresse (1-10):</strong> ${d.escala_estresse || '-'}</p>

            <h3 style="color: #7A1C1C; font-size: 14px;">Financeiro</h3>
            <p><strong>Renda:</strong> ${d.renda || '-'}</p>
            <p><strong>Condição de pagamento:</strong> ${d.condicao_pagamento || '-'}</p>
            <p><strong>Faixa confortável:</strong> ${d.faixa_confortavel || '-'}</p>
            <p><strong>Frequência:</strong> ${d.frequencia_pagamento || '-'}</p>
            <p><strong>Horário preferido:</strong> ${d.preferencia_horario || '-'}</p>
            <p><strong>Objetivos:</strong> ${objetivos || '-'}</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;">
            <p style="font-size: 12px; color: #888;">Ministério Acolher — informação confidencial, trate com sigilo.</p>
        </div>
    `;
}

// ─── POST /api/cadastro ──────────────────────────────────────────────────────
app.post('/api/cadastro', async (req, res) => {
    const d = req.body;
    const perfil = d.perfil_triagem;

    const profissional = obterProfissional(perfil);

    if (!profissional) {
        return res.status(400).json({
            ok: false,
            mensagem: 'Perfil de triagem inválido.'
        });
    }

    const objetivos = Array.isArray(d.objetivos) ? d.objetivos.join(', ') : (d.objetivos || '');

    try {
        await transporter.sendMail({
            from: `"Ministério Acolher" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: profissional.email,
            subject: `🌹 Novo acolhimento — ${d.nome || 'Pessoa em busca de apoio'}`,
            html: montarEmailHtml(d, objetivos)
        });

        // Retorna apenas o contato do profissional designado — front exibe isso na tela
        res.status(200).json({
            ok: true,
            mensagem: 'Formulário recebido com sucesso.',
            profissional: {
                nome: profissional.nome,
                whatsapp: profissional.whatsapp,
                whatsappFormatado: profissional.whatsappFormatado
            }
        });

    } catch (err) {
        console.error('❌ Erro ao enviar e-mail:', err.message);
        res.status(500).json({
            ok: false,
            mensagem: 'Erro ao processar o envio. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.'
        });
    }
});

// ─── Fallback: serve o index.html para qualquer rota não-API ────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌹 Servidor do Ministério Acolher rodando na porta ${PORT}`);
});