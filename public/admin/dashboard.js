// public/admin/dashboard.js
// Roda no navegador: busca as estatísticas na API e desenha os gráficos.

const CORES = ['#7A1C1C', '#C08552', '#4A6C6F', '#D9A441', '#8E9775', '#B0413E', '#5A5A5A', '#3E5C76', '#A16E83', '#6B8F71', '#7A7A7A'];

let graficos = {};

document.addEventListener('DOMContentLoaded', () => {
    carregarDados('todos');

    document.querySelectorAll('.filtros button').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtros button').forEach((b) => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            carregarDados(btn.dataset.periodo);
        });
    });

    document.getElementById('btnSair').addEventListener('click', async () => {
        await fetch('/admin/logout', { method: 'POST' });
        window.location.href = '/admin/login';
    });
});

async function carregarDados(periodo) {
    try {
        const resp = await fetch(`/admin/api/stats?periodo=${periodo}`);

        if (resp.status === 401) {
            window.location.href = '/admin/login';
            return;
        }

        const data = await resp.json();
        if (!data.ok) return;

        document.getElementById('totalPessoas').textContent = data.total;

        desenharGrafico('graficoFaixaEtaria', 'bar', data.faixaEtaria);
        desenharGrafico('graficoSexo', 'doughnut', data.sexo);
        desenharGrafico('graficoEstadoCivil', 'doughnut', data.estadoCivil);
        desenharGrafico('graficoMotivo', 'bar', data.motivo, true);
        desenharGrafico('graficoLocalizacao', 'bar', data.localizacao, true);
        desenharGrafico('graficoOndeConheceu', 'doughnut', traduzirOndeConheceu(data.ondeConheceu));
        desenharGrafico('graficoRedeApoio', 'doughnut', traduzirRedeApoio(data.redeApoio));
        // Filtra países: exclui Brasil (código ISO 'BR' e nomes 'Brazil'/'Brasil') e 'Não informado'
        const paisesFiltrados = (data.paises || []).filter(p =>
            p.chave !== 'BR' && p.chave !== 'Brazil' && p.chave !== 'Brasil' && p.chave !== 'Não informado'
        );
        desenharGrafico('graficoPaises', 'bar', paisesFiltrados, true);
    } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
    }
}

function desenharGrafico(idCanvas, tipo, linhas, horizontal = false) {
    const ctx = document.getElementById(idCanvas);

    if (graficos[idCanvas]) {
        graficos[idCanvas].destroy();
    }

    const labels = linhas.map((l) => l.chave || 'Não informado');
    const valores = linhas.map((l) => l.total);

    graficos[idCanvas] = new Chart(ctx, {
        type: tipo,
        data: {
            labels,
            datasets: [{
                label: 'Total',
                data: valores,
                backgroundColor: CORES,
                borderWidth: 0
            }]
        },
        options: {
            indexAxis: horizontal ? 'y' : 'x',
            responsive: true,
            plugins: {
                legend: { display: tipo === 'doughnut' },
            },
            scales: tipo === 'bar' ? {
                x: { beginAtZero: true },
                y: { beginAtZero: true }
            } : {}
        }
    });
}


// ─── Tradutores para os gráficos ──────────────────────────────────────────

// Mapa de valores do banco → rótulos legíveis para "Onde conheceu o Acolher"
const MAPA_ONDE_CONHECEU = {
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'grupo_whatsapp': 'Grupo de Whatsapp',
    'amigo_familiar': 'Amigo/Familiar',
    'indicacao_igreja': 'Indicação de igreja',
    'google': 'Pesquisei no Google',
    'outros': 'Outros',
    'Não informado': 'Não informado'
};

function traduzirOndeConheceu(linhas) {
    return (linhas || []).map(l => ({
        chave: MAPA_ONDE_CONHECEU[l.chave] || l.chave,
        total: l.total
    }));
}

// Mapa de valores do banco → rótulos legíveis para "Rede de apoio"
const MAPA_REDE_APOIO = {
    'Sim (família, amigos, igreja...)': 'Sim',
    'Parcialmente': 'Parcialmente',
    'Não tenho rede de apoio': 'Não',
    'Não informado': 'Não informado'
};

// Valores que podem vir do banco caso o front armazene apenas o value do select
const MAPA_REDE_APOIO_FALLBACK = {
    'sim': 'Sim',
    'parcialmente': 'Parcialmente',
    'nao': 'Não'
};

function traduzirRedeApoio(linhas) {
    return (linhas || []).map(l => {
        const chave = MAPA_REDE_APOIO[l.chave]
            || MAPA_REDE_APOIO_FALLBACK[l.chave]
            || l.chave;
        return { chave, total: l.total };
    });
}

