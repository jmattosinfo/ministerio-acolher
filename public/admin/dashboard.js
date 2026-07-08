// public/admin/dashboard.js
// Roda no navegador: busca as estatísticas na API e desenha os gráficos + mapa.

const CORES = ['#7A1C1C', '#C08552', '#4A6C6F', '#D9A441', '#8E9775', '#B0413E', '#5A5A5A', '#3E5C76', '#A16E83', '#6B8F71', '#7A7A7A'];

// Mapa de siglas → nomes completos dos estados (para legenda)
const ESTADOS_BR = {
    AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
    BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
    GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
    PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
    SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins'
};

let graficos = {};
let mapaLeaflet = null;
let camadaEstados = null;

// Mapa de cores para o choropleth (do mais claro ao mais escuro)
function getCorPorContagem(contagem, max) {
    if (max === 0) return '#F4EFE6';
    const intensidade = contagem / max;
    if (intensidade === 0) return '#F4EFE6';
    if (intensidade <= 0.2) return '#E8D5D5';
    if (intensidade <= 0.4) return '#D1A8A8';
    if (intensidade <= 0.6) return '#B87A7A';
    if (intensidade <= 0.8) return '#9E4D4D';
    return '#7A1C1C'; // brand-dark
}

function getCorTexto(contagem, max) {
    if (max === 0) return '#2C1A1A';
    const intensidade = contagem / max;
    return intensidade > 0.4 ? '#FFFFFF' : '#2C1A1A';
}

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
        desenharMapa(data.localizacao);
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

// ─── Mapa Leaflet ──────────────────────────────────────────────────────────

function desenharMapa(dadosEstado) {
    const container = document.getElementById('mapaLocalizacao');
    if (!container) return;

    // Força o container a ter tamanho antes de iniciar o Leaflet
    if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        container.style.width = '100%';
        container.style.height = '380px';
    }

    // Cria mapa se não existir
    if (!mapaLeaflet) {
        try {
            mapaLeaflet = L.map('mapaLocalizacao', {
                center: [-15.5, -52],
                zoom: 4,
                minZoom: 3,
                maxZoom: 7,
                zoomControl: false,
                attributionControl: false
            });

            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
            }).addTo(mapaLeaflet);

            // Invalida o tamanho após inicialização para evitar erro offsetWidth
            setTimeout(() => {
                if (mapaLeaflet) mapaLeaflet.invalidateSize();
            }, 100);
        } catch (e) {
            console.error('Erro ao inicializar mapa Leaflet:', e);
            container.innerHTML = '<p class="text-sm text-red-600 p-4">Erro ao carregar o mapa.</p>';
            return;
        }
    }

    // Converte dados para lookup
    const dadosLookup = {};
    let maxValor = 0;
    (dadosEstado || []).forEach(({ chave, total }) => {
        dadosLookup[chave.toUpperCase()] = total;
        if (total > maxValor) maxValor = total;
    });

    // Carrega o GeoJSON dos estados brasileiros (fonte confiável)
    const geojsonUrl = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';

    fetch(geojsonUrl)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return res.text();
        })
        .then(text => {
            // Remove possíveis BOM (Byte Order Mark) no início do arquivo
            const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
            return JSON.parse(cleanText);
        })
        .then(geojson => {
            if (camadaEstados) {
                mapaLeaflet.removeLayer(camadaEstados);
            }

            camadaEstados = L.geoJSON(geojson, {
                style: function (feature) {
                    // Tenta diferentes nomes de propriedade para sigla/UF
                    const props = feature.properties || {};
                    const sigla = (props.sigla || props.uf || props.SIGLA || props.UF || props.iso || props.id || '').toUpperCase();
                    const valor = dadosLookup[sigla] || 0;
                    return {
                        fillColor: getCorPorContagem(valor, maxValor),
                        weight: 1.2,
                        opacity: 0.8,
                        color: '#7A5C5C',
                        fillOpacity: 0.85
                    };
                },
                onEachFeature: function (feature, layer) {
                    const props = feature.properties || {};
                    const sigla = (props.sigla || props.uf || props.SIGLA || props.UF || props.iso || props.id || '').toUpperCase();
                    const nome = props.name || props.nome || props.NAME || props.NOME || sigla;
                    const valor = dadosLookup[sigla] || 0;

                    layer.bindTooltip(`<strong>${nome}</strong><br>${valor} pessoa(s) acolhida(s)`, {
                        sticky: true,
                        direction: 'top',
                        offset: [0, -4]
                    });

                    layer.on('mouseover', function () {
                        this.setStyle({
                            weight: 2.5,
                            color: '#5C1414',
                            fillOpacity: 1
                        });
                    });

                    layer.on('mouseout', function () {
                        this.setStyle({
                            weight: 1.2,
                            color: '#7A5C5C',
                            fillOpacity: 0.85
                        });
                    });
                }
            }).addTo(mapaLeaflet);

            // Ajusta o zoom para cobrir o Brasil
            try {
                mapaLeaflet.fitBounds(camadaEstados.getBounds(), { padding: [20, 20] });
            } catch (e) {
                console.warn('Erro ao ajustar bounds do mapa:', e);
            }

            // Invalida tamanho novamente após carregar os dados
            setTimeout(() => {
                if (mapaLeaflet) mapaLeaflet.invalidateSize();
            }, 200);

            // Atualiza legenda
            atualizarLegenda(dadosLookup, maxValor);
        })
        .catch(err => {
            console.error('Erro ao carregar GeoJSON dos estados:', err);
            container.innerHTML = '<p class="text-sm text-red-600 p-4">Erro ao carregar mapa dos estados. Tente novamente.</p>';
        });
}

function atualizarLegenda(dadosLookup, maxValor) {
    const legenda = document.getElementById('mapaLegenda');
    if (!legenda) return;

    const ordenados = Object.entries(dadosLookup)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

    if (ordenados.length === 0) {
        legenda.innerHTML = '<div class="sem-dados">Nenhum dado de localização registrado.</div>';
        return;
    }

    const totalPessoas = ordenados.reduce((s, [_, v]) => s + v, 0);
    const totalUFs = ordenados.filter(([k]) => /^[A-Z]{2}$/.test(k)).length;
    const totalOutros = ordenados.filter(([k]) => !/^[A-Z]{2}$/.test(k)).length;

    // Cabeçalho da legenda
    let html = `
        <div class="legenda-cabecalho">
            <span>${totalUFs} estado(s) ${totalOutros > 0 ? `+ ${totalOutros} localidade(s)` : ''}</span>
            <span class="legenda-total"><strong>${totalPessoas}</strong> pessoa(s) no total</span>
        </div>
    `;

    // Só mostra escala se houver pelo menos uma UF
    if (totalUFs > 0) {
        html += `<div class="legenda-escala">
            <span class="legenda-escala-label">Menos</span>
            <div class="legenda-escala-barra">
                <span class="legenda-escala-item" style="background:#F4EFE6;"></span>
                <span class="legenda-escala-item" style="background:#E8D5D5;"></span>
                <span class="legenda-escala-item" style="background:#D1A8A8;"></span>
                <span class="legenda-escala-item" style="background:#B87A7A;"></span>
                <span class="legenda-escala-item" style="background:#9E4D4D;"></span>
                <span class="legenda-escala-item" style="background:#7A1C1C;"></span>
            </div>
            <span class="legenda-escala-label">Mais</span>
        </div>`;
    }

    // Itens da legenda
    ordenados.forEach(([chave, total]) => {
        const cor = getCorPorContagem(total, maxValor);
        const pct = maxValor > 0 ? (total / maxValor * 100) : 0;

        // Verifica se é UF (2 letras) ou texto livre
        const ehUF = /^[A-Z]{2}$/.test(chave);
        const nomeEstado = ehUF ? (ESTADOS_BR[chave] || '') : '';

        html += `
            <div class="legenda-item" data-chave="${chave}">
                <span class="legenda-cor" style="background:${cor};"></span>
                <div class="legenda-info">
                    <span>
                        <span class="legenda-sigla">${ehUF ? chave : '📍'}</span>
                        <span class="legenda-nome">${nomeEstado || chave}</span>
                    </span>
                    <span class="legenda-barra">
                        <span class="legenda-barra-preenchimento" style="width:${pct}%;background:${cor};"></span>
                    </span>
                    <span class="legenda-numero">${total} ${total === 1 ? 'pessoa' : 'pessoas'}</span>
                </div>
            </div>`;
    });

    legenda.innerHTML = html;
}
