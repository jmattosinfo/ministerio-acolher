// public/js/acolhedor.js
// Front-end do Painel do Acolhedor (exclusivo do perfil `acolhedor`).
// Consome a API JSON montada em server.js:
//   app.use('/acolhedor', acolhedorRoutes)
//
//   GET   /acolhedor/api/me                  -> usuário da sessão
//   PATCH /acolhedor/api/me                  -> atualização do próprio perfil
//   GET   /acolhedor/api/minhas-estatisticas -> indicadores do próprio profissional
//   GET   /acolhedor/atendimentos            -> lista (sempre do próprio nome)
//   PATCH /acolhedor/atendimentos/:id        -> atualização parcial do prontuário
//
// IMPORTANTE: a página HTML é servida por GET /acolhedor/painel.
// O backend bloqueia o perfil admin; este script não possui qualquer lógica
// de seleção de outros profissionais (Privacy by Design).

const API_BASE = '/acolhedor';

// Destino usado quando o servidor revoga a sessão (bloqueio administrativo,
// incremento de `sessao_versao` ou remoção da conta).
const LOGIN_BLOQUEADO = '/acolhedor/login?motivo=bloqueado';

/* ───────────── Interceptação global de sessão (401) ───────────── */

/**
 * Envolve `window.fetch` para que qualquer resposta 401 marcada com
 * `sessao_invalida: true` redirecione o navegador para o login na hora.
 * Isso garante a expulsão imediata mesmo em chamadas que não usam
 * `requisitarJson()` (ex.: logout, polling, futuras integrações).
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
                window.location.href = dados.redirecionarPara || LOGIN_BLOQUEADO;
                throw new Error(dados.mensagem || 'Sessão revogada ou conta inativa.');
            }
        }

        return resposta;
    };
}

instalarInterceptadorDeSessao();

const estado = {
    usuario: null,        // { id, nome, email, perfil } vindo de /api/me
    perfil: null,         // sempre 'acolhedor' nesta tela
    status: 'todos',
    busca: '',
    atendimentos: [],
    atual: null,          // registro aberto no drawer
    requisicaoAtual: null // AbortController para evitar respostas fora de ordem
};

/* ───────────────────────── Helpers de formatação ───────────────────────── */

// Entidades montadas com String.fromCharCode para evitar qualquer
// ambiguidade de escaping no código-fonte.
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

function formatarData(valor) {
    if (!valor) return '—';
    // MySQL pode devolver Date ISO ("2026-01-31T00:00:00.000Z") ou "2026-01-31"
    const iso = String(valor).slice(0, 10);
    const [ano, mes, dia] = iso.split('-');
    if (!ano || !mes || !dia) return '—';
    return `${dia}/${mes}/${ano}`;
}

function calcularIdade(dataNascimento) {
    if (!dataNascimento) return null;
    const nasc = new Date(dataNascimento);
    if (Number.isNaN(nasc.getTime())) return null;

    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mesAtual = hoje.getMonth() - nasc.getMonth();
    if (mesAtual < 0 || (mesAtual === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade >= 0 && idade < 130 ? idade : null;
}

function apenasDigitos(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function linkWhatsapp(numero) {
    const digitos = apenasDigitos(numero);
    return digitos ? `https://wa.me/${digitos}` : '#';
}

function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'A';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

const LABEL_PERFIL = {
    homem: 'Homem',
    mulher: 'Mulher',
    vitima_abuso: 'Vítima de abuso'
};

const LABEL_STATUS = {
    pendente: { texto: 'Pendente', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
    em_andamento: { texto: 'Em andamento', classe: 'bg-blue-50 text-blue-700 border-blue-200' },
    realizado: { texto: 'Realizado', classe: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    nao_realizado: { texto: 'Não realizado', classe: 'bg-rose-50 text-rose-700 border-rose-200' }
};

/**
 * Feedback visual discreto (substitui alert() e não polui a UI).
 * @param {string} mensagem
 * @param {'sucesso'|'erro'} tipo
 */
function notificar(mensagem, tipo = 'sucesso') {
    let toast = document.getElementById('toastAcolhedor');

    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toastAcolhedor';
        toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-opacity duration-300 opacity-0 pointer-events-none';
        document.body.appendChild(toast);
    }

    toast.textContent = mensagem;
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-lg text-sm font-semibold shadow-lg transition-opacity duration-300 ${
        tipo === 'erro' ? 'bg-rose-700 text-white' : 'bg-brand-dark text-white'
    } opacity-100`;

    clearTimeout(notificar._timer);
    notificar._timer = setTimeout(() => {
        toast.classList.remove('opacity-100');
        toast.classList.add('opacity-0');
    }, 2800);
}

function atualizarIcones() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

/* ───────────────────────── Sessão / identidade ───────────────────────── */

async function requisitarJson(url, opcoes = {}) {
    const resposta = await fetch(url, {
        credentials: 'same-origin',
        ...opcoes,
        headers: {
            Accept: 'application/json',
            ...(opcoes.headers || {})
        }
    });

    // Defesa em profundidade: mesmo que o interceptador global seja
    // sobrescrito, uma sessão revogada nunca fica na tela.
    if (resposta.status === 401) {
        const dados401 = await resposta.clone().json().catch(() => ({}));
        if (dados401 && dados401.sessao_invalida) {
            window.location.href = dados401.redirecionarPara || LOGIN_BLOQUEADO;
            throw new Error(dados401.mensagem || 'Sessão revogada ou conta inativa.');
        }
    }

    const json = await resposta.json().catch(() => ({}));
    return { resposta, json };
}

async function carregarUsuario() {
    const { resposta, json } = await requisitarJson(`${API_BASE}/api/me`);

    if (resposta.status === 401 || resposta.status === 403) {
        window.location.href = '/acolhedor/login';
        return null;
    }

    if (!resposta.ok || !json.ok || !json.usuario) {
        throw new Error(json.mensagem || `Falha ao identificar o usuário (HTTP ${resposta.status}).`);
    }

    // Defesa em profundidade: o admin não usa esta tela.
    if (json.usuario.perfil !== 'acolhedor') {
        window.location.href = '/admin';
        return null;
    }

    estado.usuario = json.usuario;
    estado.perfil = 'acolhedor';
    return estado.usuario;
}

function atualizarCabecalhoUsuario() {
    const usuario = estado.usuario;
    if (!usuario) return;

    const nomeEl = document.getElementById('nomeUsuarioHeader');
    const avatarEl = document.getElementById('avatarProfissional');
    const menuNome = document.getElementById('menuUsuarioNome');
    const menuEmail = document.getElementById('menuUsuarioEmail');

    if (nomeEl) nomeEl.textContent = usuario.nome || 'Acolhedor(a)';
    if (avatarEl) avatarEl.textContent = iniciais(usuario.nome);
    if (menuNome) menuNome.textContent = usuario.nome || 'Acolhedor(a)';
    if (menuEmail) menuEmail.textContent = usuario.email || '';
}

/**
 * Ajusta a UI do painel clínico. Não existe seletor de profissionais:
 * o escopo é sempre o próprio acolhedor (garantido pelo backend).
 */
function aplicarPerfilUI() {
    atualizarCabecalhoUsuario();

    // Remove qualquer resquício de seleção persistida por versões antigas.
    try {
        localStorage.removeItem('acolhedor.profissional');
    } catch (_) { /* ignora ambientes sem storage */ }
}

async function sair() {
    try {
        await fetch(`${API_BASE}/api/logout`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        });
    } catch (err) {
        console.warn('Falha ao encerrar sessão no servidor:', err);
    }
    window.location.href = '/acolhedor/login';
}

/* ───────────────────────── Comunicação com a API ───────────────────────── */

/**
 * Busca a lista de atendimentos do profissional logado.
 * O backend força o escopo ao próprio nome — não há filtro por profissional.
 */
async function carregarAtendimentos() {
    if (!estado.usuario) return;

    // Cancela a requisição anterior (evita "corrida" ao digitar rápido na busca)
    if (estado.requisicaoAtual) estado.requisicaoAtual.abort();
    estado.requisicaoAtual = new AbortController();

    const params = new URLSearchParams();

    if (estado.status && estado.status !== 'todos') params.set('status', estado.status);
    if (estado.busca) params.set('busca', estado.busca);

    const query = params.toString();
    const url = `${API_BASE}/atendimentos${query ? `?${query}` : ''}`;

    try {
        const { resposta, json } = await requisitarJson(url, {
            signal: estado.requisicaoAtual.signal
        });

        if (resposta.status === 401) {
            window.location.href = '/acolhedor/login';
            return;
        }

        if (!resposta.ok || !json.ok) {
            throw new Error(json.mensagem || `Falha ao carregar atendimentos (HTTP ${resposta.status}).`);
        }

        estado.atendimentos = Array.isArray(json.dados) ? json.dados : [];
        renderizarTabela();
        renderizarEstatisticas();
    } catch (err) {
        if (err.name === 'AbortError') return; // requisição substituída por outra mais recente
        console.error('Erro ao buscar atendimentos:', err);
        estado.atendimentos = [];
        renderizarTabela();
        renderizarEstatisticas();
        notificar(err.message || 'Não foi possível carregar os atendimentos.', 'erro');
    }
}

/**
 * Atualiza somente os campos alterados do prontuário.
 * O back-end aceita: status_acolhimento, notas_sessao_1..3,
 * tentativas_contato e proximo_lembrete (todos opcionais).
 */
async function salvarProntuario() {
    const registro = estado.atual;
    if (!registro) return;

    const statusSelect = document.getElementById('drawerStatusSelect');
    const notas1 = document.getElementById('notasSessao1');
    const notas2 = document.getElementById('notasSessao2');
    const notas3 = document.getElementById('notasSessao3');

    const payload = {};

    if (statusSelect && statusSelect.value !== registro.status_acolhimento) {
        payload.status_acolhimento = statusSelect.value;
    }
    if (notas1 && (notas1.value || '') !== (registro.notas_sessao_1 || '')) {
        payload.notas_sessao_1 = notas1.value;
    }
    if (notas2 && (notas2.value || '') !== (registro.notas_sessao_2 || '')) {
        payload.notas_sessao_2 = notas2.value;
    }
    if (notas3 && (notas3.value || '') !== (registro.notas_sessao_3 || '')) {
        payload.notas_sessao_3 = notas3.value;
    }

    if (Object.keys(payload).length === 0) {
        notificar('Nenhuma alteração para salvar.', 'sucesso');
        fecharDrawer();
        return;
    }

    const botao = document.getElementById('btnSalvarProntuario');
    const textoOriginal = botao ? botao.innerHTML : '';

    if (botao) {
        botao.disabled = true;
        botao.classList.add('opacity-60', 'cursor-not-allowed');
        botao.innerHTML = 'Salvando...';
    }

    try {
        const { resposta, json } = await requisitarJson(
            `${API_BASE}/atendimentos/${encodeURIComponent(registro.id)}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        if (resposta.status === 401) {
            window.location.href = '/acolhedor/login';
            return;
        }

        if (!resposta.ok || !json.ok) {
            throw new Error(json.mensagem || `Falha ao salvar (HTTP ${resposta.status}).`);
        }

        // Atualiza o estado local (sem refazer a busca inteira)
        Object.assign(registro, payload);
        renderizarTabela();
        renderizarEstatisticas();
        notificar('Prontuário salvo com sucesso.');
        fecharDrawer();
    } catch (err) {
        console.error('Erro ao salvar prontuário:', err);
        notificar(err.message || 'Não foi possível salvar o prontuário.', 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.classList.remove('opacity-60', 'cursor-not-allowed');
            botao.innerHTML = textoOriginal;
            atualizarIcones();
        }
    }
}

/* ───────────────────────── Renderização ───────────────────────── */

function renderizarEstatisticas() {
    const total = estado.atendimentos.length;
    const contagem = { pendente: 0, em_andamento: 0, realizado: 0, nao_realizado: 0 };

    estado.atendimentos.forEach((a) => {
        const chave = a.status_acolhimento || 'pendente';
        if (contagem[chave] === undefined) contagem[chave] = 0;
        contagem[chave]++;
    });

    const alvos = {
        statPendentes: contagem.pendente,
        statEmAndamento: contagem.em_andamento,
        statRealizados: contagem.realizado,
        statNaoRealizados: contagem.nao_realizado
    };

    Object.entries(alvos).forEach(([id, valor]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(valor);
    });

    // Mantém o total acessível para depuração
    document.body.dataset.totalAtendimentos = String(total);
}

function statusDe(registro) {
    return LABEL_STATUS[registro.status_acolhimento] || {
        texto: registro.status_acolhimento || '—',
        classe: 'bg-brand-cream text-brand-text border-brand-muted'
    };
}

function renderizarTabela() {
    const tbody = document.getElementById('tabelaCorpo');
    const cards = document.getElementById('cardsAtendimentos');
    const vazio = document.getElementById('estadoVazio');

    if (!tbody && !cards) return;

    if (estado.atendimentos.length === 0) {
        if (tbody) tbody.innerHTML = '';
        if (cards) cards.innerHTML = '';
        if (vazio) vazio.classList.remove('hidden');
        atualizarIcones();
        return;
    }

    if (vazio) vazio.classList.add('hidden');

    if (tbody) {
        tbody.innerHTML = estado.atendimentos.map((a) => {
            const status = statusDe(a);

            return `
                <tr class="hover:bg-brand-light transition-colors cursor-pointer" data-id="${escapeHtml(a.id)}">
                    <td class="px-6 py-3.5">
                        <p class="font-semibold text-brand-dark">${escapeHtml(a.nome || 'Sem nome')}</p>
                        <p class="text-xs text-brand-soft">${escapeHtml(a.localizacao || 'Localização não informada')}</p>
                    </td>
                    <td class="px-6 py-3.5 text-brand-soft text-xs">${escapeHtml(LABEL_PERFIL[a.perfil_triagem] || a.perfil_triagem || '—')}</td>
                    <td class="px-6 py-3.5 text-brand-soft text-xs">${escapeHtml(a.whatsapp || '—')}</td>
                    <td class="px-6 py-3.5 text-brand-soft text-xs">${escapeHtml(formatarData(a.criado_em))}</td>
                    <td class="px-6 py-3.5">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${status.classe}">
                            ${escapeHtml(status.texto)}
                        </span>
                    </td>
                    <td class="px-6 py-3.5 text-right">
                        <button type="button" class="js-abrir text-brand-dark hover:text-brand-accent font-semibold text-xs inline-flex items-center gap-1" data-id="${escapeHtml(a.id)}">
                            Abrir <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Versão mobile em cartões — evita qualquer conteúdo cortado
    if (cards) {
        cards.innerHTML = estado.atendimentos.map((a) => {
            const status = statusDe(a);

            return `
                <button type="button" class="js-abrir block w-full text-left p-4 hover:bg-brand-light transition-colors" data-id="${escapeHtml(a.id)}">
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                            <p class="font-semibold text-brand-dark truncate">${escapeHtml(a.nome || 'Sem nome')}</p>
                            <p class="text-xs text-brand-soft truncate">${escapeHtml(a.localizacao || 'Localização não informada')}</p>
                        </div>
                        <span class="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold ${status.classe}">
                            ${escapeHtml(status.texto)}
                        </span>
                    </div>
                    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-soft">
                        <span>Perfil: <strong class="text-brand-text">${escapeHtml(LABEL_PERFIL[a.perfil_triagem] || a.perfil_triagem || '—')}</strong></span>
                        <span>WhatsApp: <strong class="text-brand-text">${escapeHtml(a.whatsapp || '—')}</strong></span>
                        <span>Entrada: <strong class="text-brand-text">${escapeHtml(formatarData(a.criado_em))}</strong></span>
                    </div>
                    <span class="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-dark">
                        Abrir prontuário <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                    </span>
                </button>
            `;
        }).join('');
    }

    atualizarIcones();
}

/* ───────────────────────── Drawer (prontuário) ───────────────────────── */

// Endereço público usado quando o painel está em ambiente local (o link
// copiado é enviado ao utente e precisa apontar para o site real).
const URL_FEEDBACK_PADRAO = 'https://acolher.life/feedback';

/**
 * Codifica o id do cadastro em Base64 para ofuscar o identificador no link
 * público de feedback. É apenas ofuscação: o back-end decodifica o valor e
 * confirma que o prontuário existe antes de gravar o vínculo.
 * @param {number|string} id
 * @returns {string} referência Base64 ('' em caso de falha)
 */
function codificarRef(id) {
    if (id === null || id === undefined) return '';

    try {
        // btoa só aceita latin1: o id é sempre numérico, mas normalizamos.
        return window.btoa(String(id));
    } catch {
        return '';
    }
}

/**
 * Monta o link único de avaliação do prontuário.
 * @param {{id?: number|string}|null} registro
 * @returns {string}
 */
function gerarLinkFeedback(registro) {
    const ehLocal = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/i.test(window.location.hostname);
    const base = ehLocal ? URL_FEEDBACK_PADRAO : `${window.location.origin}/feedback`;
    const ref = codificarRef(registro?.id);

    return ref ? `${base}?ref=${encodeURIComponent(ref)}` : base;
}

/**
 * Texto copiado em "Copiar Mensagem para o WhatsApp".
 * @param {{id?: number|string}|null} registro
 * @returns {string}
 */
function montarMensagemFeedback(registro) {
    return '"Olá! Que alegria caminhar com você nestas semanas pelo Ministério Acolher. '
        + 'Para nos ajudar a melhorar o acolhimento a outros corações, poderia deixar sua '
        + `avaliação rápida aqui? ${gerarLinkFeedback(registro)}"`;
}

/**
 * Exibe (ou esconde) o card de feedback deixado pelo utente no prontuário.
 * @param {{feedback_nota?: number, feedback_mensagem?: string, feedback_criado_em?: string}} registro
 */
function renderizarFeedbackUtente(registro) {
    const bloco = document.getElementById('blocoFeedbackUtente');
    if (!bloco) return;

    const nota = Number(registro?.feedback_nota);

    if (!Number.isFinite(nota) || nota < 1) {
        bloco.classList.add('hidden');
        return;
    }

    const notaEl = document.getElementById('feedbackUtenteNota');
    if (notaEl) {
        notaEl.textContent = '♥'.repeat(Math.min(Math.round(nota), 5));
        notaEl.setAttribute('aria-label', `Nota ${nota} de 5`);
    }

    const dataEl = document.getElementById('feedbackUtenteData');
    if (dataEl) {
        dataEl.textContent = registro.feedback_criado_em
            ? `Recebido em ${formatarData(registro.feedback_criado_em)}`
            : '';
    }

    const mensagem = String(registro.feedback_mensagem || '').trim();
    const mensagemEl = document.getElementById('feedbackUtenteMensagem');
    const semMensagemEl = document.getElementById('feedbackUtenteSemMensagem');

    if (mensagemEl) {
        mensagemEl.textContent = mensagem;
        mensagemEl.classList.toggle('hidden', !mensagem);
    }
    if (semMensagemEl) semMensagemEl.classList.toggle('hidden', Boolean(mensagem));

    bloco.classList.remove('hidden');
}

function abrirDrawer(id) {
    const registro = estado.atendimentos.find((a) => String(a.id) === String(id));
    if (!registro) return;

    estado.atual = registro;

    const el = (idEl) => document.getElementById(idEl);

    const idade = calcularIdade(registro.data_nascimento);
    const infoPartes = [];
    if (idade !== null) infoPartes.push(`${idade} anos`);
    if (registro.localizacao) infoPartes.push(registro.localizacao);

    if (el('drawerNome')) el('drawerNome').textContent = registro.nome || 'Sem nome';
    if (el('drawerInfo')) el('drawerInfo').textContent = infoPartes.join(' • ') || 'Sem dados complementares';

    if (el('drawerWhatsapp')) el('drawerWhatsapp').textContent = registro.whatsapp || '—';
    if (el('drawerWhatsappLink')) el('drawerWhatsappLink').href = linkWhatsapp(registro.whatsapp);

    if (el('drawerMotivo')) el('drawerMotivo').textContent = registro.motivo_terapia || 'Não informado';
    if (el('drawerHorario')) el('drawerHorario').textContent = registro.preferencia_horario || 'Não informado';

    if (el('drawerStatusSelect')) el('drawerStatusSelect').value = registro.status_acolhimento || 'pendente';

    if (el('notasSessao1')) el('notasSessao1').value = registro.notas_sessao_1 || '';
    if (el('notasSessao2')) el('notasSessao2').value = registro.notas_sessao_2 || '';
    if (el('notasSessao3')) el('notasSessao3').value = registro.notas_sessao_3 || '';

    // Feedback vinculado ao prontuário (se o utente já avaliou) e link único
    // de avaliação, com o id do cadastro ofuscado em Base64.
    renderizarFeedbackUtente(registro);
    if (el('drawerFeedbackTexto')) el('drawerFeedbackTexto').textContent = montarMensagemFeedback(registro);

    el('drawerBackdrop')?.classList.remove('hidden');
    el('drawerProntuario')?.classList.remove('translate-x-full');
    atualizarIcones();
}

function fecharDrawer() {
    document.getElementById('drawerBackdrop')?.classList.add('hidden');
    document.getElementById('drawerProntuario')?.classList.add('translate-x-full');
    estado.atual = null;
}

function drawerAberto() {
    const drawer = document.getElementById('drawerProntuario');
    return Boolean(drawer) && !drawer.classList.contains('translate-x-full');
}

/* ───────────────────────── Minha Conta (perfil) ───────────────────────── */

function fecharMenuUsuario() {
    document.getElementById('menuUsuario')?.classList.add('hidden');
    document.getElementById('btnMenuUsuario')?.setAttribute('aria-expanded', 'false');
}

function alternarMenuUsuario() {
    const menu = document.getElementById('menuUsuario');
    const botao = document.getElementById('btnMenuUsuario');
    if (!menu) return;

    const vaiAbrir = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !vaiAbrir);
    botao?.setAttribute('aria-expanded', String(vaiAbrir));
}

function mostrarMensagemConta(texto, tipo = 'erro') {
    const el = document.getElementById('contaMensagem');
    if (!el) return;

    el.textContent = texto;
    el.className = tipo === 'sucesso'
        ? 'text-xs rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'text-xs rounded-lg px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200';
}

function esconderMensagemConta() {
    const el = document.getElementById('contaMensagem');
    if (!el) return;
    el.textContent = '';
    el.className = 'hidden';
}

function modalContaAberto() {
    const modal = document.getElementById('modalConta');
    return Boolean(modal) && !modal.classList.contains('hidden');
}

function abrirModalConta() {
    const usuario = estado.usuario;
    if (!usuario) return;

    const setValor = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = valor;
    };

    setValor('contaNome', usuario.nome || '');
    setValor('contaEmail', usuario.email || '');
    setValor('contaSenhaAtual', '');
    setValor('contaNovaSenha', '');
    setValor('contaConfirmarSenha', '');

    esconderMensagemConta();
    fecharMenuUsuario();

    document.getElementById('modalContaBackdrop')?.classList.remove('hidden');
    const modal = document.getElementById('modalConta');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    document.body.classList.add('overflow-hidden');

    document.getElementById('contaNome')?.focus();
    atualizarIcones();
}

function fecharModalConta() {
    document.getElementById('modalContaBackdrop')?.classList.add('hidden');
    const modal = document.getElementById('modalConta');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

async function salvarConta(ev) {
    ev.preventDefault();

    const usuario = estado.usuario;
    if (!usuario) return;

    const nome = (document.getElementById('contaNome')?.value || '').trim();
    const email = (document.getElementById('contaEmail')?.value || '').trim().toLowerCase();
    const senhaAtual = document.getElementById('contaSenhaAtual')?.value || '';
    const novaSenha = document.getElementById('contaNovaSenha')?.value || '';
    const confirmarNovaSenha = document.getElementById('contaConfirmarSenha')?.value || '';

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
        document.getElementById('contaSenhaAtual')?.focus();
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

    const botao = document.getElementById('btnSalvarConta');
    const htmlOriginal = botao ? botao.innerHTML : '';

    if (botao) {
        botao.disabled = true;
        botao.classList.add('opacity-60', 'cursor-not-allowed');
        botao.innerHTML = 'Salvando...';
    }

    try {
        const { resposta, json } = await requisitarJson(`${API_BASE}/api/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resposta.ok || !json.ok) {
            // 401 de sessão expirada -> volta ao login; 401 de senha -> mostra erro
            const senhaIncorreta = resposta.status === 401 && /palavra-passe/i.test(String(json.mensagem || ''));
            if (resposta.status === 401 && !senhaIncorreta) {
                window.location.href = '/acolhedor/login';
                return;
            }
            throw new Error(json.mensagem || `Falha ao salvar (HTTP ${resposta.status}).`);
        }

        estado.usuario = json.usuario || { ...usuario, nome, email };
        atualizarCabecalhoUsuario();

        notificar(json.mensagem || 'Dados atualizados com sucesso.');
        fecharModalConta();

        // Renomear um acolhedor migra os prontuários: recarrega a lista
        if (nomeMudou) {
            carregarAtendimentos();
        }
    } catch (err) {
        console.error('Erro ao salvar perfil:', err);
        mostrarMensagemConta(err.message || 'Não foi possível salvar seus dados.', 'erro');
    } finally {
        if (botao) {
            botao.disabled = false;
            botao.classList.remove('opacity-60', 'cursor-not-allowed');
            botao.innerHTML = htmlOriginal;
            atualizarIcones();
        }
    }
}

/* ───────────────────────── Meus Números (estatísticas) ───────────────────────── */

function modalEstatisticasAberto() {
    const modal = document.getElementById('modalEstatisticas');
    return Boolean(modal) && !modal.classList.contains('hidden');
}

function fecharModalEstatisticas() {
    document.getElementById('modalEstatisticasBackdrop')?.classList.add('hidden');
    const modal = document.getElementById('modalEstatisticas');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

function abrirModalEstatisticas() {
    const modal = document.getElementById('modalEstatisticas');
    if (!modal) return;

    document.getElementById('modalEstatisticasBackdrop')?.classList.remove('hidden');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');

    const carregando = document.getElementById('estatisticasCarregando');
    document.getElementById('estatisticasErro')?.classList.add('hidden');
    document.getElementById('estatisticasConteudo')?.classList.add('hidden');
    carregando?.classList.remove('hidden');
    carregando?.setAttribute('aria-busy', 'true');

    atualizarIcones();
    carregarMinhasEstatisticas();
}

function formatarDataHora(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

async function carregarMinhasEstatisticas() {
    const carregando = document.getElementById('estatisticasCarregando');
    const conteudo = document.getElementById('estatisticasConteudo');
    const erroEl = document.getElementById('estatisticasErro');

    try {
        const { resposta, json } = await requisitarJson(`${API_BASE}/api/minhas-estatisticas`);

        if (resposta.status === 401) {
            window.location.href = '/acolhedor/login';
            return;
        }
        if (resposta.status === 403) {
            window.location.href = '/admin';
            return;
        }
        if (!resposta.ok || !json.ok) {
            throw new Error(json.mensagem || `Falha ao carregar indicadores (HTTP ${resposta.status}).`);
        }

        // Blocos novos; os campos legados ficam como fallback (compatibilidade).
        const individuais = json.individuais || {};
        const equipe = json.equipe || {};
        const porStatus = json.porStatus || {};

        const totalAtendimentos = Number(
            individuais.total_atendimentos ?? json.totalAcolhidos ?? 0
        );
        const emAndamento = Number(
            individuais.em_andamento ?? porStatus.em_andamento ?? 0
        );
        const concluidos = Number(
            individuais.concluidos ?? porStatus.realizado ?? 0
        );
        const ultimos30 = Number(
            individuais.ultimos_30_dias ?? json.ultimos30Dias ?? 0
        );
        const taxaConclusao = Number(
            individuais.taxa_conclusao ?? json.taxaConclusao ?? 0
        );

        const definir = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.textContent = String(valor ?? 0);
        };

        // ── Meu Impacto ──────────────────────────────────────────────
        definir('estatTotalAcolhidos', totalAtendimentos);
        definir('estatEmAndamentoModal', emAndamento);
        definir('estatConcluidos', concluidos);
        definir('estatTaxaConclusao', `${taxaConclusao}%`);
        definir('estatUltimos30', ultimos30);

        // ── Impacto Geral da Equipe (apenas somas) ───────────────────
        definir('estatEquipeVidas', Number(equipe.total_vidas ?? 0));
        definir('estatEquipeConcluidos', Number(equipe.total_concluidos ?? 0));
        definir('estatEquipeMes', Number(equipe.atendimentos_mes ?? 0));

        // Barra de progresso individual
        const taxaBarra = Math.min(100, Math.max(0, taxaConclusao));
        definir('estatTaxaConclusaoBarra', `${taxaBarra}%`);
        const barra = document.getElementById('estatBarraConclusao');
        if (barra) barra.style.width = `${taxaBarra}%`;

        const atualizado = document.getElementById('estatAtualizadoEm');
        if (atualizado) {
            const quando = formatarDataHora(json.atualizadoEm);
            atualizado.textContent = quando ? `Atualizado em ${quando}` : '';
        }

        carregando?.classList.add('hidden');
        carregando?.setAttribute('aria-busy', 'false');
        erroEl?.classList.add('hidden');
        conteudo?.classList.remove('hidden');
        atualizarIcones();
    } catch (err) {
        console.error('Erro ao carregar estatísticas:', err);
        carregando?.classList.add('hidden');
        carregando?.setAttribute('aria-busy', 'false');
        conteudo?.classList.add('hidden');
        if (erroEl) {
            erroEl.textContent = err.message || 'Não foi possível carregar seus indicadores.';
            erroEl.classList.remove('hidden');
        }
    }
}

/* ───────────────────────── Filtros e eventos ───────────────────────── */

function configurarEventos() {
    // Menu do usuário
    document.getElementById('btnMenuUsuario')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        alternarMenuUsuario();
    });

    document.getElementById('btnMinhaConta')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        abrirModalConta();
    });

    document.getElementById('btnSairPainel')?.addEventListener('click', sair);

    document.addEventListener('click', (ev) => {
        if (!ev.target.closest('#menuUsuario') && !ev.target.closest('#btnMenuUsuario')) {
            fecharMenuUsuario();
        }
    });

    // Modal Minha Conta
    document.getElementById('btnFecharModalConta')?.addEventListener('click', fecharModalConta);
    document.getElementById('btnCancelarConta')?.addEventListener('click', fecharModalConta);
    document.getElementById('modalContaBackdrop')?.addEventListener('click', fecharModalConta);
    document.getElementById('formConta')?.addEventListener('submit', salvarConta);

    // Meus Números (fecha pelo X, pelo botão "Fechar", pelo backdrop ou Esc)
    document.getElementById('btnMinhasEstatisticas')?.addEventListener('click', abrirModalEstatisticas);
    document.getElementById('btnFecharEstatisticas')?.addEventListener('click', fecharModalEstatisticas);
    document.getElementById('btnFecharEstatisticasRodape')?.addEventListener('click', fecharModalEstatisticas);
    document.getElementById('modalEstatisticasBackdrop')?.addEventListener('click', fecharModalEstatisticas);

    // Busca com debounce
    let timerBusca = null;
    document.getElementById('inputBusca')?.addEventListener('input', (ev) => {
        clearTimeout(timerBusca);
        const valor = ev.target.value.trim();
        timerBusca = setTimeout(() => {
            estado.busca = valor;
            carregarAtendimentos();
        }, 350);
    });

    // Filtros de status
    document.getElementById('filtroStatusContainer')?.addEventListener('click', (ev) => {
        const botao = ev.target.closest('.btn-filtro');
        if (!botao) return;

        document.querySelectorAll('#filtroStatusContainer .btn-filtro').forEach((b) => {
            b.classList.remove('bg-brand-dark', 'text-white');
            b.classList.add('bg-brand-cream', 'text-brand-text', 'hover:bg-brand-muted');
        });
        botao.classList.remove('bg-brand-cream', 'text-brand-text', 'hover:bg-brand-muted');
        botao.classList.add('bg-brand-dark', 'text-white');

        estado.status = botao.dataset.status || 'todos';
        carregarAtendimentos();
    });

    // Abrir drawer (tabela desktop e cartões mobile)
    const abrirPorEvento = (ev) => {
        const alvo = ev.target.closest('tr[data-id], .js-abrir');
        if (!alvo) return;
        const id = alvo.dataset.id || alvo.closest('tr[data-id]')?.dataset.id;
        if (id) abrirDrawer(id);
    };

    document.getElementById('tabelaCorpo')?.addEventListener('click', abrirPorEvento);
    document.getElementById('cardsAtendimentos')?.addEventListener('click', abrirPorEvento);

    // Fechar drawer
    document.getElementById('btnFecharDrawer')?.addEventListener('click', fecharDrawer);
    document.getElementById('drawerBackdrop')?.addEventListener('click', fecharDrawer);

    // Esc fecha modal > drawer > menu (nessa ordem de prioridade)
    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        if (modalContaAberto()) {
            fecharModalConta();
            return;
        }
        if (modalEstatisticasAberto()) {
            fecharModalEstatisticas();
            return;
        }
        if (drawerAberto()) {
            fecharDrawer();
            return;
        }
        fecharMenuUsuario();
    });

    // Salvar prontuário
    document.getElementById('btnSalvarProntuario')?.addEventListener('click', salvarProntuario);

    // Copiar mensagem de feedback
    document.getElementById('btnCopiarFeedback')?.addEventListener('click', async (ev) => {
        const texto = ev.currentTarget.parentElement?.querySelector('p')?.textContent?.trim() || '';
        if (!texto) return;

        try {
            await navigator.clipboard.writeText(texto);
            notificar('Mensagem copiada para a área de transferência.');
        } catch {
            notificar('Não foi possível copiar automaticamente. Selecione o texto manualmente.', 'erro');
        }
    });
}

/* ───────────────────────── Inicialização ───────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
    configurarEventos();
    atualizarIcones();

    try {
        const usuario = await carregarUsuario();
        if (!usuario) return; // redirecionamento para o login já disparado

        await aplicarPerfilUI();

        // Aguarda a lista para que o tour encontre as âncoras já renderizadas.
        await carregarAtendimentos();

        // Tour guiado: dispara apenas no primeiro acesso (localStorage).
        // O botão "Rever Tutorial" (public/js/tour-acolhedor.js) reabre manualmente.
        if (window.TourAcolher && typeof window.TourAcolher.iniciarPrimeiroAcesso === 'function') {
            window.TourAcolher.iniciarPrimeiroAcesso();
        }
    } catch (err) {
        console.error('Falha na inicialização do painel:', err);
        notificar(err.message || 'Não foi possível carregar o painel.', 'erro');
    }
});
