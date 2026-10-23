// public/admin/dashboard.js
// Painel administrativo: estatísticas globais, gestão de usuários (acolhedores)
// e "Minha Conta". O admin NÃO acessa prontuários.
//
// Endpoints consumidos:
//   GET    /admin/api/stats
//   GET    /admin/api/equipe
//   POST   /admin/api/equipe
//   PATCH  /admin/api/equipe/:id/status
//   POST   /admin/api/equipe/:id/reenviar-link
//   DELETE /admin/api/equipe/:id (com ?confirmar=1 quando há vínculos)
//   GET    /acolhedor/api/me
//   PATCH  /acolhedor/api/me

const CORES = ['#7A1C1C', '#C08552', '#4A6C6F', '#D9A441', '#8E9775', '#B0413E', '#5A5A5A', '#3E5C76', '#A16E83', '#6B8F71', '#7A7A7A'];

// Destino usado quando a sessão é revogada no servidor (bloqueio/expiração).
const LOGIN_ADMIN_BLOQUEADO = '/admin/login?motivo=bloqueado';

const estado = {
    aba: 'geral',
    equipe: [],
    usuario: null,
    exclusao: null, // { id, nome, confirmado }
    carregandoEquipe: false,
    // Avaliações / feedback
    feedbacks: [],
    feedbackDistribuicao: [],
    feedbacksMedia: 0,
    feedbacksTotal: 0,
    carregandoFeedbacks: false
};

/* ───────────── Interceptação global de sessão (401) ───────────── */

/**
 * Envolve `window.fetch` para que qualquer resposta 401 marcada pelo
 * servidor com `sessao_invalida: true` (conta bloqueada, sessão revogada
 * por incremento de `sessao_versao` ou usuário removido) derrube a tela
 * imediatamente, mesmo em chamadas que não passam por `requisitar()`.
 */
function instalarInterceptadorDeSessao() {
    if (window.__acolherFetchInterceptado) return;
    window.__acolherFetchInterceptado = true;

    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async function fetchComGuardaDeSessao(...args) {
        const resposta = await fetchOriginal(...args);

        if (resposta && resposta.status === 401) {
            let dados = null;
            try {
                dados = await resposta.clone().json();
            } catch (_) {
                dados = null;
            }

            if (dados && dados.sessao_invalida) {
                window.location.href = dados.redirecionarPara || LOGIN_ADMIN_BLOQUEADO;
                throw new Error(dados.mensagem || 'Sessão revogada ou conta inativa.');
            }
        }

        return resposta;
    };
}

instalarInterceptadorDeSessao();

let graficos = {};

/* ───────────────────────── Helpers ───────────────────────── */

const AMP = String.fromCharCode(38); // "&"
const ENTIDADES_HTML = {
    '&': AMP + 'amp;',
    '<': AMP + 'lt;',
    '>': AMP + 'gt;',
    '"': AMP + 'quot;',
    "'": AMP + '#39;'
};

function escapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

function atualizarIcones() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function mostrarToast(mensagem, tipo = 'sucesso') {
    const toast = document.getElementById('toastAdmin');
    if (!toast) return;

    toast.textContent = mensagem;
    toast.classList.toggle('erro', tipo === 'erro');
    toast.classList.add('visivel');

    clearTimeout(mostrarToast._timer);
    mostrarToast._timer = setTimeout(() => {
        toast.classList.remove('visivel');
    }, 3200);
}

function mostrarMensagemEquipe(texto, tipo = 'erro', link = null) {
    const el = document.getElementById('mensagemEquipe');
    if (!el) return;

    el.className = `mensagem ${tipo}`;
    el.innerHTML = '';

    const p = document.createElement('div');
    p.textContent = texto;
    el.appendChild(p);

    if (link) {
        const a = document.createElement('a');
        a.href = link;
        a.textContent = link;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.cssText = 'display:inline-block;margin-top:6px;font-size:11.5px;word-break:break-all;color:#5C1414;';
        el.appendChild(a);
    }

    el.classList.remove('hidden');
}

function esconderMensagemEquipe() {
    document.getElementById('mensagemEquipe')?.classList.add('hidden');
}

/**
 * fetch JSON com tratamento de sessão expirada.
 * Lança erro com `mensagem` amigável quando a resposta não é ok.
 */
async function requisitar(url, opcoes = {}) {
    const resposta = await fetch(url, {
        credentials: 'same-origin',
        ...opcoes,
        headers: {
            Accept: 'application/json',
            ...(opcoes.headers || {})
        }
    });

    if (resposta.status === 401) {
        // Só derruba a sessão quando o servidor sinaliza revogação real.
        // Um 401 de regra de negócio (ex.: senha atual incorreta) deve
        // permanecer no modal, exibindo a mensagem ao usuário.
        const json401 = await resposta.clone().json().catch(() => ({}));
        if (json401 && json401.sessao_invalida) {
            window.location.href = json401.redirecionarPara || LOGIN_ADMIN_BLOQUEADO;
            throw new Error(json401.mensagem || 'Sessão revogada ou conta inativa.');
        }
    }

    const json = await resposta.json().catch(() => ({}));

    if (!resposta.ok || json.ok === false) {
        const erro = new Error(json.mensagem || `Falha na requisição (HTTP ${resposta.status}).`);
        erro.status = resposta.status;
        erro.dados = json;
        throw erro;
    }

    return json;
}

async function carregarUsuario() {
    try {
        const json = await requisitar('/acolhedor/api/me');
        estado.usuario = json.usuario || null;
    } catch (err) {
        console.warn('Não foi possível carregar o usuário:', err.message);
    }
    return estado.usuario;
}

/* ───────────────────────── Abas ───────────────────────── */

const ABAS_VALIDAS = ['geral', 'equipe', 'avaliacoes'];

function ativarAba(nome) {
    estado.aba = ABAS_VALIDAS.includes(nome) ? nome : 'geral';

    document.querySelectorAll('.aba').forEach((btn) => {
        btn.classList.toggle('ativo', btn.dataset.aba === estado.aba);
    });

    const secoes = {
        geral: document.getElementById('secaoGeral'),
        equipe: document.getElementById('secaoEquipe'),
        avaliacoes: document.getElementById('secaoAvaliacoes')
    };

    Object.entries(secoes).forEach(([chave, secao]) => {
        if (secao) secao.classList.toggle('hidden', estado.aba !== chave);
    });

    if (estado.aba === 'equipe') {
        carregarEquipe();
    }

    if (estado.aba === 'avaliacoes') {
        carregarFeedbacks();
    }

    atualizarIcones();
}

function exibirAvisoDaUrl() {
    const params = new URLSearchParams(window.location.search);
    const aviso = params.get('aviso');
    if (!aviso) return;

    const caixa = document.getElementById('avisoSistema');
    const texto = document.getElementById('avisoSistemaTexto');
    if (!caixa || !texto) return;

    texto.textContent = aviso;
    caixa.classList.remove('hidden');

    // Limpa o parâmetro para não repetir o aviso em recargas
    params.delete('aviso');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

/* ───────────────────────── Estatísticas ───────────────────────── */

async function carregarDados(periodo) {
    try {
        const data = await requisitar(`/admin/api/stats?periodo=${encodeURIComponent(periodo)}`);

        const totalEl = document.getElementById('totalPessoas');
        if (totalEl) totalEl.textContent = data.total ?? 0;

        desenharGrafico('graficoFaixaEtaria', 'bar', data.faixaEtaria);
        desenharGrafico('graficoSexo', 'doughnut', data.sexo);
        desenharGrafico('graficoEstadoCivil', 'doughnut', data.estadoCivil);
        desenharGrafico('graficoMotivo', 'bar', data.motivo, true);
        desenharGrafico('graficoLocalizacao', 'bar', data.localizacao, true);
        desenharGrafico('graficoOndeConheceu', 'doughnut', traduzirOndeConheceu(data.ondeConheceu));
        desenharGrafico('graficoRedeApoio', 'doughnut', traduzirRedeApoio(data.redeApoio));

        // Filtra países: exclui Brasil (código ISO 'BR' e nomes 'Brazil'/'Brasil') e 'Não informado'
        const paisesFiltrados = (data.paises || []).filter((p) =>
            p.chave !== 'BR' && p.chave !== 'Brazil' && p.chave !== 'Brasil' && p.chave !== 'Não informado'
        );
        desenharGrafico('graficoPaises', 'bar', paisesFiltrados, true);
    } catch (err) {
        console.error('Erro ao carregar dados do dashboard:', err);
        mostrarToast(err.message || 'Não foi possível carregar as estatísticas.', 'erro');
    }
}

function desenharGrafico(idCanvas, tipo, linhas, horizontal = false) {
    const ctx = document.getElementById(idCanvas);
    if (!ctx || typeof Chart === 'undefined') return;

    if (graficos[idCanvas]) {
        graficos[idCanvas].destroy();
    }

    const labels = (linhas || []).map((l) => l.chave || 'Não informado');
    const valores = (linhas || []).map((l) => l.total);

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
                legend: { display: tipo === 'doughnut' }
            },
            scales: tipo === 'bar' ? {
                x: { beginAtZero: true },
                y: { beginAtZero: true }
            } : {}
        }
    });
}

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
    return (linhas || []).map((l) => ({
        chave: MAPA_ONDE_CONHECEU[l.chave] || l.chave,
        total: l.total
    }));
}

const MAPA_REDE_APOIO = {
    'Sim (família, amigos, igreja...)': 'Sim',
    'Parcialmente': 'Parcialmente',
    'Não tenho rede de apoio': 'Não',
    'Não informado': 'Não informado'
};

const MAPA_REDE_APOIO_FALLBACK = {
    'sim': 'Sim',
    'parcialmente': 'Parcialmente',
    'nao': 'Não'
};

function traduzirRedeApoio(linhas) {
    return (linhas || []).map((l) => {
        const chave = MAPA_REDE_APOIO[l.chave]
            || MAPA_REDE_APOIO_FALLBACK[l.chave]
            || l.chave;
        return { chave, total: l.total };
    });
}

/* ───────────────────────── Avaliações / feedback ───────────────────────── */

function formatarDataFeedback(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderizarFeedbacks() {
    const mediaEl = document.getElementById('feedbackMedia');
    const totalEl = document.getElementById('feedbackTotal');
    const distribuicaoEl = document.getElementById('feedbackDistribuicao');
    const listaEl = document.getElementById('listaFeedbacks');

    const media = Number(estado.feedbacksMedia || 0);
    const total = Number(estado.feedbacksTotal || 0);

    if (mediaEl) {
        mediaEl.innerHTML = total > 0
            ? `${media.toFixed(1).replace('.', ',')} <small>/ 5</small>`
            : '—';
    }

    if (totalEl) {
        totalEl.textContent = String(total);
    }

    if (distribuicaoEl) {
        const distribuicao = estado.feedbackDistribuicao || [];
        // Escala visual: a nota mais votada ocupa 100% da barra.
        const maior = Math.max(1, ...distribuicao.map((d) => Number(d.total) || 0));

        distribuicaoEl.innerHTML = distribuicao.map((d) => {
            const votos = Number(d.total) || 0;
            const largura = Math.round((votos / maior) * 100);
            return `
                <div class="distribuicao-linha">
                    <span class="valor-nota">${escapeHtml(d.nota)} ♥</span>
                    <span class="barra"><span class="preenchimento" style="width:${largura}%"></span></span>
                    <span class="total-nota">${votos}</span>
                </div>
            `;
        }).join('');
    }

    if (!listaEl) return;

    if (!estado.feedbacks.length) {
        listaEl.innerHTML = '<p class="feedback-vazio">Nenhuma avaliação recebida ainda.</p>';
        return;
    }

    listaEl.innerHTML = estado.feedbacks.map((f) => {
        const nota = Math.min(Math.max(Number(f.nota) || 0, 1), 5);
        const cheios = '♥'.repeat(nota);
        const vazios = '♥'.repeat(5 - nota);
        const mensagem = f.mensagem
            ? `<p class="feedback-texto">${escapeHtml(f.mensagem)}</p>`
            : '<p class="feedback-texto" style="color:#A08B8B;font-style:italic;">Sem comentário.</p>';

        return `
            <article class="feedback-item">
                <div class="feedback-item-topo">
                    <span class="feedback-coroes" aria-label="Nota ${nota} de 5">${cheios}<span style="color:#D9C9B4;">${vazios}</span></span>
                    <span class="feedback-data">${escapeHtml(formatarDataFeedback(f.criado_em))}</span>
                </div>
                ${mensagem}
            </article>
        `;
    }).join('');
}

async function carregarFeedbacks() {
    if (estado.carregandoFeedbacks) return;
    estado.carregandoFeedbacks = true;

    const listaEl = document.getElementById('listaFeedbacks');
    if (listaEl) {
        listaEl.innerHTML = '<p class="feedback-vazio">Carregando avaliações...</p>';
    }

    try {
        const json = await requisitar('/admin/api/feedbacks?limite=50');

        estado.feedbacks = Array.isArray(json.feedbacks) ? json.feedbacks : [];
        estado.feedbackDistribuicao = Array.isArray(json.distribuicao) ? json.distribuicao : [];
        estado.feedbacksMedia = Number(json.media || 0);
        estado.feedbacksTotal = Number(json.total || 0);

        renderizarFeedbacks();
    } catch (err) {
        estado.feedbacks = [];
        estado.feedbackDistribuicao = [];
        estado.feedbacksMedia = 0;
        estado.feedbacksTotal = 0;

        renderizarFeedbacks();
        if (listaEl) {
            listaEl.innerHTML = `<p class="feedback-vazio">${escapeHtml(err.message || 'Erro ao carregar avaliações.')}</p>`;
        }
        mostrarToast(err.message || 'Erro ao carregar avaliações.', 'erro');
    } finally {
        estado.carregandoFeedbacks = false;
    }
}

/* ───────────────────────── Gestão de equipe ───────────────────────── */

async function carregarEquipe() {
    if (estado.carregandoEquipe) return;
    estado.carregandoEquipe = true;

    const corpo = document.getElementById('corpoEquipe');
    if (corpo) {
        corpo.innerHTML = '<tr><td colspan="4" class="vazio">Carregando equipe...</td></tr>';
    }

    try {
        const json = await requisitar('/admin/api/equipe');
        estado.equipe = Array.isArray(json.dados) ? json.dados : [];
        renderizarEquipe();
    } catch (err) {
        estado.equipe = [];
        if (corpo) {
            corpo.innerHTML = `<tr><td colspan="4" class="vazio">${escapeHtml(err.message || 'Erro ao carregar equipe.')}</td></tr>`;
        }
        mostrarToast(err.message || 'Erro ao carregar equipe.', 'erro');
    } finally {
        estado.carregandoEquipe = false;
    }
}

function renderizarEquipe() {
    const corpo = document.getElementById('corpoEquipe');
    if (!corpo) return;

    if (estado.equipe.length === 0) {
        corpo.innerHTML = '<tr><td colspan="4" class="vazio">Nenhum usuário cadastrado.</td></tr>';
        atualizarIcones();
        return;
    }

    corpo.innerHTML = estado.equipe.map((m) => {
        const ehAdmin = m.perfil === 'admin';
        const statusClasse = ehAdmin ? 'badge admin' : (m.ativo ? 'badge ativo' : 'badge bloqueado');
        const statusTexto = ehAdmin ? 'Administrador' : (m.ativo ? 'Ativo' : 'Bloqueado');

        const acoes = ehAdmin
            ? '<span style="font-size:11.5px;color:#7A5C5C;">—</span>'
            : `
                <button type="button" class="btn btn-secundario" data-acao="status" data-id="${escapeHtml(m.id)}" data-ativo="${m.ativo ? '1' : '0'}" data-nome="${escapeHtml(m.nome)}">
                    ${m.ativo ? 'Bloquear' : 'Ativar'}
                </button>
                <button type="button" class="btn btn-secundario" data-acao="reenviar" data-id="${escapeHtml(m.id)}" data-nome="${escapeHtml(m.nome)}" ${m.ativo ? '' : 'disabled title="Reative a conta antes de reenviar"'}>
                    Reenviar link
                </button>
                <button type="button" class="btn btn-perigo" data-acao="excluir" data-id="${escapeHtml(m.id)}" data-nome="${escapeHtml(m.nome)}">
                    Excluir
                </button>
            `;

        return `
            <tr>
                <td class="nome">${escapeHtml(m.nome)}</td>
                <td>${escapeHtml(m.email)}</td>
                <td><span class="${statusClasse}">${escapeHtml(statusTexto)}</span></td>
                <td>
                    <div class="acoes-linha">${acoes}</div>
                </td>
            </tr>
        `;
    }).join('');

    atualizarIcones();
}

async function cadastrarAcolhedor(ev) {
    ev.preventDefault();

    const nomeInput = document.getElementById('novoNome');
    const emailInput = document.getElementById('novoEmail');
    const botao = document.getElementById('btnCadastrarAcolhedor');

    const nome = (nomeInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();

    if (nome.length < 2) {
        mostrarMensagemEquipe('Informe um nome com pelo menos 2 caracteres.');
        nomeInput?.focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        mostrarMensagemEquipe('Informe um e-mail válido.');
        emailInput?.focus();
        return;
    }

    esconderMensagemEquipe();
    const htmlOriginal = botao ? botao.innerHTML : '';
    if (botao) {
        botao.disabled = true;
        botao.innerHTML = 'Cadastrando...';
    }

    try {
        const json = await requisitar('/admin/api/equipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email })
        });

        if (nomeInput) nomeInput.value = '';
        if (emailInput) emailInput.value = '';

        mostrarMensagemEquipe(
            json.mensagem || 'Acolhedor cadastrado com sucesso.',
            json.email_enviado ? 'sucesso' : 'erro',
            json.email_enviado ? null : json.link_convite
        );
        mostrarToast(json.email_enviado
            ? 'Convite enviado por e-mail.'
            : 'Cadastro criado. Envie o link manualmente.');

        await carregarEquipe();
    } catch (err) {
        mostrarMensagemEquipe(err.message || 'Não foi possível cadastrar o acolhedor.');
        mostrarToast(err.message || 'Erro ao cadastrar acolhedor.', 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = htmlOriginal;
            atualizarIcones();
        }
    }
}

/* ─────────── Modal de confirmação reutilizável (Promise) ─────────── */

const estadoConfirmacao = { resolver: null };

/**
 * Exibe o modal estilizado e resolve `true` (confirmado) ou `false`.
 * Substitui o `window.confirm()` nativo em ações críticas da equipe.
 * @param {{titulo:string, mensagem:string, textoBotao?:string, variante?:'perigo'|'primario', icone?:string}} opcoes
 * @returns {Promise<boolean>}
 */
function confirmarAcao(opcoes) {
    const {
        titulo = 'Confirmar ação',
        mensagem = '',
        textoBotao = 'Confirmar',
        variante = 'perigo',
        icone = 'alert-triangle'
    } = opcoes || {};

    const modal = document.getElementById('modalConfirmacao');
    const backdrop = document.getElementById('modalConfirmacaoBackdrop');
    const tituloEl = document.getElementById('modalConfirmacaoTitulo');
    const subEl = document.getElementById('modalConfirmacaoSub');
    const textoEl = document.getElementById('modalConfirmacaoTexto');
    const botao = document.getElementById('btnConfirmacaoAcao');
    const iconeEl = document.getElementById('modalConfirmacaoIcone');

    if (!modal || !backdrop || !botao) {
        // Sem markup disponível: não executa ação destrutiva por omissão.
        console.warn('Modal de confirmação não encontrado no DOM.');
        return Promise.resolve(false);
    }

    // Resolve pendência anterior (evita promessas órfãs)
    if (estadoConfirmacao.resolver) {
        estadoConfirmacao.resolver(false);
        estadoConfirmacao.resolver = null;
    }

    if (tituloEl) tituloEl.textContent = titulo;
    if (subEl) subEl.textContent = 'Revise os detalhes antes de continuar.';
    if (textoEl) textoEl.textContent = mensagem;
    if (iconeEl) iconeEl.setAttribute('data-lucide', icone);

    botao.textContent = textoBotao;
    botao.className = variante === 'perigo' ? 'btn btn-perigo-solido' : 'btn btn-primario';
    botao.dataset.variante = variante;

    backdrop.classList.remove('hidden');
    modal.classList.remove('hidden');
    atualizarIcones();
    botao.focus();

    return new Promise((resolve) => {
        estadoConfirmacao.resolver = resolve;
    });
}

function fecharConfirmacao(confirmado) {
    document.getElementById('modalConfirmacaoBackdrop')?.classList.add('hidden');
    document.getElementById('modalConfirmacao')?.classList.add('hidden');

    const resolver = estadoConfirmacao.resolver;
    estadoConfirmacao.resolver = null;
    if (resolver) resolver(Boolean(confirmado));
}

function confirmacaoAberta() {
    const modal = document.getElementById('modalConfirmacao');
    return Boolean(modal) && !modal.classList.contains('hidden');
}

async function alternarStatus(id, ativoAtual, nome) {
    const novoStatus = !ativoAtual;

    const confirmado = await confirmarAcao({
        titulo: novoStatus ? 'Confirmar Reativação' : 'Confirmar Bloqueio',
        mensagem: novoStatus
            ? `Reativar o acesso de ${nome}? O usuário poderá iniciar sessão novamente.`
            : `Bloquear o acesso de ${nome}? Todas as sessões ativas serão encerradas imediatamente.`,
        textoBotao: novoStatus ? 'Reativar acesso' : 'Bloquear acesso',
        variante: novoStatus ? 'primario' : 'perigo',
        icone: novoStatus ? 'shield-check' : 'shield-off'
    });

    if (!confirmado) return;

    try {
        const json = await requisitar(`/admin/api/equipe/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ativo: novoStatus })
        });

        mostrarToast(json.mensagem || 'Status atualizado.');
        await carregarEquipe();
    } catch (err) {
        mostrarToast(err.message || 'Erro ao alterar status.', 'erro');
    }
}

async function reenviarLink(id, nome) {
    const confirmado = await confirmarAcao({
        titulo: 'Reenviar Link de Acesso',
        mensagem: `Gerar um novo link de acesso para ${nome}? O link anterior será invalidado.`,
        textoBotao: 'Gerar novo link',
        variante: 'primario',
        icone: 'mail'
    });

    if (!confirmado) return;

    try {
        const json = await requisitar(`/admin/api/equipe/${encodeURIComponent(id)}/reenviar-link`, {
            method: 'POST'
        });

        mostrarMensagemEquipe(
            json.mensagem || 'Novo link gerado.',
            json.email_enviado ? 'sucesso' : 'erro',
            json.email_enviado ? null : json.link_convite
        );
        mostrarToast(json.email_enviado ? 'E-mail reenviado.' : 'Link gerado — envie manualmente.');
    } catch (err) {
        mostrarToast(err.message || 'Erro ao reenviar link.', 'erro');
    }
}

function abrirModalExclusao(membro, vinculados = null) {
    estado.exclusao = {
        id: membro.id,
        nome: membro.nome,
        confirmado: Boolean(vinculados)
    };

    const texto = document.getElementById('modalExclusaoTexto');
    if (texto) {
        texto.textContent = vinculados
            ? `${membro.nome} possui ${vinculados} prontuário(s) vinculado(s). A exclusão removerá o usuário, mas os registros clínicos serão preservados (sem acesso por acolhedor). Deseja continuar?`
            : `Remover ${membro.nome} da equipe? O usuário perderá o acesso imediatamente e convites pendentes serão invalidados.`;
    }

    document.getElementById('modalExclusaoBackdrop')?.classList.remove('hidden');
    document.getElementById('modalExclusao')?.classList.remove('hidden');
    atualizarIcones();
}

function fecharModalExclusao() {
    estado.exclusao = null;
    document.getElementById('modalExclusaoBackdrop')?.classList.add('hidden');
    document.getElementById('modalExclusao')?.classList.add('hidden');
}

async function confirmarExclusao() {
    const alvo = estado.exclusao;
    if (!alvo) return;

    const botao = document.getElementById('btnConfirmarExclusao');
    if (botao) botao.disabled = true;

    try {
        const sufixo = alvo.confirmado ? '?confirmar=1' : '';
        const json = await requisitar(`/admin/api/equipe/${encodeURIComponent(alvo.id)}${sufixo}`, {
            method: 'DELETE'
        });

        mostrarToast(json.mensagem || 'Usuário removido.');
        fecharModalExclusao();
        await carregarEquipe();
    } catch (err) {
        if (err.status === 409 && err.dados && err.dados.requer_confirmacao) {
            // Reabre com o aviso de vínculos e exige uma segunda confirmação.
            abrirModalExclusao({ id: alvo.id, nome: alvo.nome }, err.dados.vinculados || 0);
            return;
        }
        mostrarToast(err.message || 'Erro ao excluir usuário.', 'erro');
    } finally {
        if (botao) botao.disabled = false;
    }
}

/* ───────────────────────── Minha Conta ───────────────────────── */

function mostrarMensagemConta(texto, tipo = 'erro') {
    const el = document.getElementById('contaAdminMensagem');
    if (!el) return;

    el.textContent = texto;
    el.className = `mensagem ${tipo}`;
    el.classList.remove('hidden');
}

function esconderMensagemConta() {
    const el = document.getElementById('contaAdminMensagem');
    if (!el) return;
    el.textContent = '';
    el.className = 'mensagem hidden';
}

async function abrirModalConta() {
    await carregarUsuario();
    const usuario = estado.usuario;
    if (!usuario) {
        mostrarToast('Não foi possível carregar seus dados.', 'erro');
        return;
    }

    const setValor = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor;
    };

    setValor('contaAdminNome', usuario.nome || '');
    setValor('contaAdminEmail', usuario.email || '');
    setValor('contaAdminSenhaAtual', '');
    setValor('contaAdminNovaSenha', '');
    setValor('contaAdminConfirmar', '');

    esconderMensagemConta();

    document.getElementById('modalContaAdminBackdrop')?.classList.remove('hidden');
    document.getElementById('modalContaAdmin')?.classList.remove('hidden');

    document.getElementById('contaAdminNome')?.focus();
    atualizarIcones();
}

function fecharModalConta() {
    document.getElementById('modalContaAdminBackdrop')?.classList.add('hidden');
    document.getElementById('modalContaAdmin')?.classList.add('hidden');
}

async function salvarConta(ev) {
    ev.preventDefault();

    const usuario = estado.usuario;
    if (!usuario) return;

    const nome = (document.getElementById('contaAdminNome')?.value || '').trim();
    const email = (document.getElementById('contaAdminEmail')?.value || '').trim().toLowerCase();
    const senhaAtual = document.getElementById('contaAdminSenhaAtual')?.value || '';
    const novaSenha = document.getElementById('contaAdminNovaSenha')?.value || '';
    const confirmarNovaSenha = document.getElementById('contaAdminConfirmar')?.value || '';

    if (nome.length < 2) {
        mostrarMensagemConta('Informe um nome com pelo menos 2 caracteres.');
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        mostrarMensagemConta('Informe um e-mail válido.');
        return;
    }
    if (novaSenha && novaSenha.length < 6) {
        mostrarMensagemConta('A nova senha deve ter pelo menos 6 caracteres.');
        return;
    }
    if (novaSenha !== confirmarNovaSenha) {
        mostrarMensagemConta('A confirmação da nova senha não coincide.');
        return;
    }

    const emailMudou = email !== String(usuario.email || '').toLowerCase();
    const senhaMudou = Boolean(novaSenha);
    const nomeMudou = nome !== usuario.nome;

    if ((emailMudou || senhaMudou) && !senhaAtual) {
        mostrarMensagemConta('Informe a senha atual para alterar e-mail ou senha.');
        document.getElementById('contaAdminSenhaAtual')?.focus();
        return;
    }

    if (!nomeMudou && !emailMudou && !senhaMudou) {
        mostrarMensagemConta('Nenhuma alteração para salvar.');
        return;
    }

    const payload = { nome, email };
    if (emailMudou || senhaMudou) payload.senhaAtual = senhaAtual;
    if (senhaMudou) {
        payload.novaSenha = novaSenha;
        payload.confirmarNovaSenha = confirmarNovaSenha;
    }

    const botao = document.getElementById('btnSalvarContaAdmin');
    const htmlOriginal = botao ? botao.innerHTML : '';
    if (botao) {
        botao.disabled = true;
        botao.innerHTML = 'Salvando...';
    }

    try {
        const json = await requisitar('/acolhedor/api/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        estado.usuario = json.usuario || { ...usuario, nome, email };
        mostrarToast(json.mensagem || 'Dados atualizados com sucesso.');
        fecharModalConta();
    } catch (err) {
        mostrarMensagemConta(err.message || 'Não foi possível salvar seus dados.');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.innerHTML = htmlOriginal;
            atualizarIcones();
        }
    }
}

/* ───────────────────────── Eventos ───────────────────────── */

function configurarEventos() {
    // Filtros de período
    document.querySelectorAll('.filtros button').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filtros button').forEach((b) => b.classList.remove('ativo'));
            btn.classList.add('ativo');
            carregarDados(btn.dataset.periodo);
        });
    });

    // Abas
    document.querySelectorAll('.aba').forEach((btn) => {
        btn.addEventListener('click', () => ativarAba(btn.dataset.aba));
    });

    // Logout
    document.getElementById('btnSair')?.addEventListener('click', async () => {
        try {
            await fetch('/admin/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (_) { /* ignora */ }
        window.location.href = '/admin/login';
    });

    // Equipe
    document.getElementById('formNovoAcolhedor')?.addEventListener('submit', cadastrarAcolhedor);
    document.getElementById('btnAtualizarEquipe')?.addEventListener('click', carregarEquipe);

    // Avaliações / feedback
    document.getElementById('btnAtualizarFeedbacks')?.addEventListener('click', carregarFeedbacks);

    document.getElementById('corpoEquipe')?.addEventListener('click', (ev) => {
        const botao = ev.target.closest('button[data-acao]');
        if (!botao) return;

        const id = botao.dataset.id;
        const nome = botao.dataset.nome || '';
        const acao = botao.dataset.acao;

        if (acao === 'status') {
            alternarStatus(id, botao.dataset.ativo === '1', nome);
        } else if (acao === 'reenviar') {
            reenviarLink(id, nome);
        } else if (acao === 'excluir') {
            abrirModalExclusao({ id, nome });
        }
    });

    // Modal de exclusão
    document.getElementById('btnFecharExclusao')?.addEventListener('click', fecharModalExclusao);
    document.getElementById('btnCancelarExclusao')?.addEventListener('click', fecharModalExclusao);
    document.getElementById('modalExclusaoBackdrop')?.addEventListener('click', fecharModalExclusao);
    document.getElementById('btnConfirmarExclusao')?.addEventListener('click', confirmarExclusao);

    // Modal de confirmação genérico (Promise)
    document.getElementById('btnFecharConfirmacao')?.addEventListener('click', () => fecharConfirmacao(false));
    document.getElementById('btnCancelarConfirmacao')?.addEventListener('click', () => fecharConfirmacao(false));
    document.getElementById('modalConfirmacaoBackdrop')?.addEventListener('click', () => fecharConfirmacao(false));
    document.getElementById('btnConfirmacaoAcao')?.addEventListener('click', () => fecharConfirmacao(true));

    // Minha Conta
    document.getElementById('btnMinhaContaAdmin')?.addEventListener('click', abrirModalConta);
    document.getElementById('btnFecharContaAdmin')?.addEventListener('click', fecharModalConta);
    document.getElementById('btnCancelarContaAdmin')?.addEventListener('click', fecharModalConta);
    document.getElementById('modalContaAdminBackdrop')?.addEventListener('click', fecharModalConta);
    document.getElementById('formContaAdmin')?.addEventListener('submit', salvarConta);

    // Esc fecha os modais (confirmação tem prioridade)
    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        if (confirmacaoAberta()) {
            fecharConfirmacao(false);
            return;
        }
        if (!document.getElementById('modalExclusao')?.classList.contains('hidden')) {
            fecharModalExclusao();
            return;
        }
        if (!document.getElementById('modalContaAdmin')?.classList.contains('hidden')) {
            fecharModalConta();
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    configurarEventos();
    atualizarIcones();

    exibirAvisoDaUrl();
    carregarUsuario();

    // A aba de equipe também é carregada ao abrir, para o admin ver
    // imediatamente o estado da equipe ao trocar de aba.
    carregarDados('todos');
});
