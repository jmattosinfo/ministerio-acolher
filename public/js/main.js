// ── Menu mobile ──────────────────────────────────────
const btnMenuMobile = document.getElementById('btn-menu-mobile');
const menuMobile = document.getElementById('menu-mobile');
const iconMenuAberto = document.getElementById('icon-menu-aberto');
const iconMenuFechado = document.getElementById('icon-menu-fechado');

if (btnMenuMobile) {
    btnMenuMobile.addEventListener('click', () => {
        const aberto = menuMobile.classList.toggle('hidden') === false;
        iconMenuAberto.classList.toggle('hidden');
        iconMenuFechado.classList.toggle('hidden');
        btnMenuMobile.setAttribute('aria-expanded', aberto ? 'true' : 'false');
        btnMenuMobile.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    });
    menuMobile.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuMobile.classList.add('hidden');
            iconMenuAberto.classList.remove('hidden');
            iconMenuFechado.classList.add('hidden');
            btnMenuMobile.setAttribute('aria-expanded', 'false');
            btnMenuMobile.setAttribute('aria-label', 'Abrir menu');
        });
    });
}

// ── Máscara WhatsApp (xx) xxxxx-xxxx ────────────────
const campoWhatsapp = document.getElementById('campo-whatsapp');
const whatsappAjuda = document.getElementById('whatsapp-ajuda');

if (campoWhatsapp) {
    campoWhatsapp.addEventListener('input', function () {
        // Remove tudo que não é dígito
        let digits = this.value.replace(/\D/g, '');

        // Limita a 11 dígitos (2 DDD + 9 número)
        if (digits.length > 11) digits = digits.slice(0, 11);

        // Aplica a máscara (xx) xxxxx-xxxx
        let formatted = '';
        if (digits.length > 0) {
            formatted = '(' + digits.slice(0, 2);
        }
        if (digits.length > 2) {
            formatted += ') ' + digits.slice(2, 7);
        }
        if (digits.length > 7) {
            formatted += '-' + digits.slice(7, 11);
        }

        this.value = formatted;

        // Mostra/esconde ajuda visual
        if (digits.length > 0 && digits.length < 11) {
            whatsappAjuda.classList.remove('hidden');
            whatsappAjuda.classList.add('text-amber-600');
        } else {
            whatsappAjuda.classList.add('hidden');
        }
    });

    // Validação no blur (perda de foco)
    campoWhatsapp.addEventListener('blur', function () {
        const digits = this.value.replace(/\D/g, '');
        if (digits.length > 0 && digits.length !== 11) {
            this.classList.add('border-red-400', 'bg-red-50/30');
            whatsappAjuda.classList.remove('hidden');
            whatsappAjuda.classList.add('text-red-500');
        } else if (digits.length === 11) {
            this.classList.remove('border-red-400', 'bg-red-50/30');
            whatsappAjuda.classList.add('hidden');
        }
    });

    // Remove estado de erro ao começar a digitar novamente
    campoWhatsapp.addEventListener('focus', function () {
        this.classList.remove('border-red-400', 'bg-red-50/30');
        const digits = this.value.replace(/\D/g, '');
        if (digits.length > 0 && digits.length < 11) {
            whatsappAjuda.classList.remove('hidden');
            whatsappAjuda.classList.add('text-amber-600');
        }
    });
}

// ── Campos dinâmicos: País, Estado, Cidade ──────────
const campoPais = document.getElementById('campo-pais');
const campoEstado = document.getElementById('campo-estado');
const campoCidade = document.getElementById('campo-cidade');
const divEstado = document.getElementById('div-estado');
const listaCidades = document.getElementById('lista-cidades');

// Cache para evitar múltiplas chamadas à API
const cacheCidades = {};

// Carrega lista de países ao iniciar
if (campoPais) {
    (async function carregarPaises() {
        try {
            const resp = await fetch('/api/location/countries');
            const data = await resp.json();
            if (!data.ok) throw new Error('Falha ao carregar países');

            // Ordena países alfabeticamente (Brasil primeiro)
            const brIndex = data.dados.findIndex(c => c.value === 'BR');
            const paises = [];
            if (brIndex >= 0) paises.push(data.dados[brIndex]);
            data.dados.forEach((c, i) => {
                if (i !== brIndex) paises.push(c);
            });

            // Preenche o select
            paises.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.value;
                opt.textContent = p.label;
                if (p.value === 'BR') opt.selected = true;
                campoPais.appendChild(opt);
            });

            // Se Brasil foi pré-selecionado, carrega estados
            if (brIndex >= 0) {
                await carregarEstados('BR');
            }
        } catch (err) {
            console.error('Erro ao carregar países:', err);
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = I18N.t('form-carregando-paises', I18N.currentLang);
            campoPais.appendChild(opt);
        }
    })();

    // Ao mudar de país, recarrega estados e limpa cidade
    campoPais.addEventListener('change', async function () {
        const codigo = this.value;
        campoCidade.value = '';
        listaCidades.innerHTML = '';
        if (codigo) {
            await carregarEstados(codigo);
        } else {
            campoEstado.innerHTML = '<option value="">' + I18N.t('form-placeholder-estado', I18N.currentLang) + '</option>';
            divEstado.classList.remove('hidden');
            campoEstado.disabled = false;
            campoEstado.removeAttribute('required');
        }
    });
}

async function carregarEstados(countryCode) {
    if (!campoEstado || !divEstado) return;

    campoEstado.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = I18N.t('form-carregando-estados', I18N.currentLang);
    campoEstado.appendChild(placeholder);
    campoEstado.disabled = true;
    divEstado.classList.remove('hidden');

    try {
        const resp = await fetch(`/api/location/states/${countryCode}`);
        const data = await resp.json();
        if (!data.ok) throw new Error('Falha ao carregar estados');

        campoEstado.innerHTML = '';

        if (data.dados && data.dados.length > 0) {
            // País tem estados/províncias → exibe dropdown
            const vazio = document.createElement('option');
            vazio.value = '';
            vazio.textContent = I18N.t('form-placeholder-estado', I18N.currentLang);
            campoEstado.appendChild(vazio);

            data.dados.forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.label;
                opt.textContent = e.label;
                campoEstado.appendChild(opt);
            });

            campoEstado.disabled = false;
            campoEstado.required = false; // estado é opcional
            divEstado.classList.remove('hidden');
        } else {
            // País sem estados → oculta campo e marca como "Não se aplica"
            campoEstado.innerHTML = '';
            const naoAplica = document.createElement('option');
            naoAplica.value = '';
            naoAplica.textContent = I18N.t('form-estado-nao-aplica', I18N.currentLang);
            campoEstado.appendChild(naoAplica);
            campoEstado.disabled = true;
            campoEstado.required = false;
            divEstado.classList.add('hidden');
        }
    } catch (err) {
        console.error('Erro ao carregar estados:', err);
        campoEstado.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = I18N.t('form-placeholder-estado', I18N.currentLang);
        campoEstado.appendChild(opt);
        campoEstado.disabled = false;
    }
}

// Ao mudar de estado, carrega cidades para o datalist
if (campoEstado) {
    campoEstado.addEventListener('change', async function () {
        const estado = this.value;
        const pais = campoPais ? campoPais.value : '';
        campoCidade.value = '';
        listaCidades.innerHTML = '';

        if (estado && pais) {
            const cacheKey = `${pais}-${estado}`;
            if (cacheCidades[cacheKey]) {
                preencherDatalist(cacheCidades[cacheKey]);
                return;
            }

            try {
                // Busca o código ISO do estado
                const respEstados = await fetch(`/api/location/states/${pais}`);
                const dataEstados = await respEstados.json();
                if (!dataEstados.ok) return;

                const estadoEncontrado = dataEstados.dados.find(e => e.label === estado);
                if (!estadoEncontrado) return;

                const respCidades = await fetch(`/api/location/cities/${pais}/${estadoEncontrado.value}`);
                const dataCidades = await respCidades.json();
                if (!dataCidades.ok) return;

                cacheCidades[cacheKey] = dataCidades.dados || [];
                preencherDatalist(cacheCidades[cacheKey]);
            } catch (err) {
                console.error('Erro ao carregar cidades:', err);
            }
        }
    });
}

function preencherDatalist(cidades) {
    listaCidades.innerHTML = '';
    (cidades || []).forEach(nome => {
        const opt = document.createElement('option');
        opt.value = nome;
        listaCidades.appendChild(opt);
    });
}

// ── Perfil → aviso sigilo ────────────────────────────
document.querySelectorAll('input[name="perfil_triagem"]').forEach(radio => {
    radio.addEventListener('change', function () {
        const aviso = document.getElementById('aviso-abuso');
        const labelNome = document.getElementById('label-nome');
        if (this.value === 'vitima_abuso') {
            aviso.classList.remove('hidden');
            labelNome.innerHTML = I18N.t('form-label-nome-codinome', I18N.currentLang);
        } else {
            aviso.classList.add('hidden');
            labelNome.innerHTML = I18N.t('form-label-nome', I18N.currentLang);
        }
    });
});

// ── Envio do formulário (AJAX) ──────────────────────
document.getElementById('acolherForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    // Valida radio de perfil
    const radios = this.querySelectorAll('input[name="perfil_triagem"]');
    const perfilSelecionado = Array.from(radios).some(r => r.checked);
    if (!perfilSelecionado) {
        radios.forEach(r => r.closest('label').querySelector('div').classList.add('border-red-400'));
        radios[0].closest('label').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Valida WhatsApp (deve ter 11 dígitos)
    const whatsDigits = campoWhatsapp.value.replace(/\D/g, '');
    if (whatsDigits.length > 0 && whatsDigits.length !== 11) {
        campoWhatsapp.classList.add('border-red-400', 'bg-red-50/30');
        campoWhatsapp.focus();
        campoWhatsapp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const errMsg = document.createElement('p');
        errMsg.className = 'text-xs text-red-500 mt-1';
        errMsg.innerText = I18N.t('form-whatsapp-invalido', I18N.currentLang);
        campoWhatsapp.parentElement.appendChild(errMsg);
        setTimeout(() => errMsg.remove(), 5000);
        return;
    }

    // Valida campo "Onde conheceu o Acolher"
    const ondeConheceu = document.getElementById('campo-onde-conheceu');
    if (!ondeConheceu.value) {
        ondeConheceu.classList.add('border-red-400', 'bg-red-50/30');
        ondeConheceu.focus();
        ondeConheceu.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Valida país (obrigatório)
    if (!campoPais || !campoPais.value) {
        if (campoPais) {
            campoPais.classList.add('border-red-400', 'bg-red-50/30');
            campoPais.focus();
            campoPais.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // Valida cidade (obrigatória)
    if (!campoCidade || !campoCidade.value.trim()) {
        if (campoCidade) {
            campoCidade.classList.add('border-red-400', 'bg-red-50/30');
            campoCidade.focus();
            campoCidade.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const btnTexto = document.getElementById('btn-texto');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnSubmit = document.getElementById('btn-submit');

    btnTexto.innerText = I18N.t('form-btn-enviando', I18N.currentLang);
    btnSpinner.classList.remove('hidden');
    btnSubmit.disabled = true;

    try {
        // Envia apenas dígitos do WhatsApp (sem máscara)
        const formData = new FormData(this);
        formData.set('whatsapp', whatsDigits);
        const response = await fetch('/api/cadastro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData.entries()))
        });

        if (response.ok) {
            const data = await response.json();
            const prof = data.profissional;

            // Proteção: sem profissional/WhatsApp válido, trata como erro
            if (!prof || !prof.whatsapp) throw new Error();

            this.style.display = 'none';

            const lang = I18N.currentLang;

            const mensagemPrevia = lang === 'en'
                ? "Hello, I came through the Acolher website and was directed to you. I would like to receive support. Could you help me?"
                : lang === 'es'
                ? "Hola, llegué a través del sitio web Acolher y fui dirigido(a) a usted. Me gustaría recibir acogida. ¿Podría ayudarme?"
                : "Olá, passei pelo site Acolher, e fui direcionado(a) para você. Gostaria de receber acolhimento. Poderia me ajudar?";
            const mensagemWhatsApp = encodeURIComponent(mensagemPrevia);

            // A acolhedora Shirley não consta na lista pública do site (por
            // questões jurídicas). Antes de abrir o WhatsApp dela, exibimos um
            // aviso informativo; ao fechar, o redirecionamento segue normalmente.
            if (prof.nome === 'Shirley') {
                abrirAvisoShirley(() => executarRedirecionamento(prof, mensagemWhatsApp, lang));
            } else {
                await executarRedirecionamento(prof, mensagemWhatsApp, lang);
            }
        } else {
            throw new Error();
        }
    } catch {
        btnTexto.innerText = I18N.t('form-btn-enviar', I18N.currentLang);
        btnSpinner.classList.add('hidden');
        btnSubmit.disabled = false;

        const errDiv = document.createElement('p');
        errDiv.className = 'text-xs text-red-600 text-center mt-3';
        errDiv.innerText = I18N.t('erro-msg', I18N.currentLang);
        btnSubmit.parentElement.after(errDiv);
        setTimeout(() => errDiv.remove(), 6000);
    }
});

// ════════════════════════════════════════════════════════
// ── PÓS-ENVIO: redirecionamento automático p/ WhatsApp ──
// ════════════════════════════════════════════════════════

// Monta o link wa.me com a mensagem pré-preenchida (já codificada)
function montarLinkWhatsApp(whatsapp, mensagemEncoded) {
    return `https://wa.me/${whatsapp}?text=${mensagemEncoded}`;
}

// Pré-checa se o wa.me responde (fetch no-cors: resolve em qualquer resposta HTTP,
// rejeita em falha de rede/offline/timeout). Decide entre redirecionar automaticamente
// ou cair no fallback.
function verificarDisponibilidadeWa(url, timeoutMs) {
    return new Promise((resolve) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs || 3000);
        fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal })
            .then(() => { clearTimeout(timer); resolve(true); })
            .catch(() => { clearTimeout(timer); resolve(false); });
    });
}

// Estado de espera (sem botão) enquanto a pré-checagem roda
function mostrarRedirecionando(lang) {
    const sucessoDiv = document.getElementById('sucesso');
    if (!sucessoDiv) return;
    sucessoDiv.innerHTML = `
        <p class="text-brand-soft text-sm leading-relaxed">${I18N.t('sucesso-redirecionando', lang)}</p>
    `;
    sucessoDiv.classList.remove('hidden');
    sucessoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Fallback: se o WhatsApp não responder, mostra a tela de sucesso com botão de contato
function mostrarSucessoFallback(prof, mensagemWhatsApp, lang) {
    const sucessoDiv = document.getElementById('sucesso');
    if (!sucessoDiv) return;
    sucessoDiv.innerHTML = `
        <div class="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-3xl mx-auto mb-5">✅</div>
        <h3 class="font-serif text-2xl font-bold text-brand-dark mb-2">${I18N.t('sucesso-titulo', lang)}</h3>
        <p class="text-brand-soft text-sm leading-relaxed max-w-md mx-auto mb-6">
            ${I18N.t('sucesso-desc', lang, { profissional: prof.nome })}
        </p>
        <a href="${montarLinkWhatsApp(prof.whatsapp, mensagemWhatsApp)}" target="_blank"
           aria-label="${I18N.t('sucesso-btn-whatsapp', lang, { profissional: prof.nome })}"
           class="inline-flex items-center gap-2 bg-[#25D366] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#20ba5a] transition text-sm shadow-lg">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.455L0 24zm6.59-4.846c1.66.986 3.296 1.48 4.805 1.481 5.356 0 9.707-4.333 9.71-9.66 0-2.58-1.01-5.006-2.844-6.834C16.517 2.313 14.166 1.31 11.69 1.31c-5.357 0-9.71 4.333-9.713 9.663-.001 1.748.484 3.454 1.405 4.954L2.38 21.65l6.267-1.642zM17.13 14.13c-.302-.15-1.79-.882-2.067-.983-.277-.1-.478-.15-.678.15-.2.3-.775.98-.95 1.18-.175.2-.35.225-.65.075-1.03-.513-1.74-1.026-2.422-2.188-.18-.3-.18-.56-.05-.71.117-.135.302-.35.45-.525.148-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.678-1.634-.93-2.245-.243-.585-.49-.504-.678-.514-.175-.007-.375-.01-.576-.01-.2 0-.527.075-.802.375-.276.3-1.053 1.03-1.053 2.515s1.08 2.916 1.23 3.116c.15.2 2.123 3.243 5.143 4.545.718.31 1.28.496 1.717.635.722.23 1.38.197 1.9.12.58-.087 1.79-.73 2.04-1.402.25-.673.25-1.25.175-1.373-.075-.123-.275-.2-.575-.35z"/>
            </svg>
            <span>${I18N.t('sucesso-btn-whatsapp', lang, { profissional: prof.nome })}</span>
        </a>
        <p class="text-xs text-brand-soft/50 mt-6">
            ${I18N.t('sucesso-rodape', lang)}
        </p>
    `;
    sucessoDiv.classList.remove('hidden');
    sucessoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Executa o redirecionamento para o WhatsApp do profissional já escolhido no
// servidor: mostra o estado de espera, pré-checa o wa.me e, dependendo do
// resultado, redireciona na mesma aba ou cai no fallback (tela com botão).
async function executarRedirecionamento(prof, mensagemWhatsApp, lang) {
    const waLink = montarLinkWhatsApp(prof.whatsapp, mensagemWhatsApp);

    // Estado leve de espera enquanto a pré-checagem do WhatsApp roda
    mostrarRedirecionando(lang);

    // Pré-checa se o wa.me responde: se sim, redireciona automaticamente na
    // mesma aba; se falhar/ficar sem resposta, cai no fallback (tela com botão).
    const disponivel = await verificarDisponibilidadeWa(waLink);
    if (disponivel) {
        window.location.href = waLink;
    } else {
        mostrarSucessoFallback(prof, mensagemWhatsApp, lang);
    }
}

// ════════════════════════════════════════════════════════
// ── MODAL DE COMPARTILHAMENTO ──────────────────────────
// ════════════════════════════════════════════════════════

// ── Monta o texto completo para compartilhar ──
function montarTextoCompartilhar() {
    const lang = I18N.currentLang;
    const url = window.location.href;
    const baseText = I18N.t('compartilhar-text', lang);
    return baseText + '\n\n🔗 Acesse: ' + url;
}

// ── Renderiza a lista de recursos no preview do modal ──
function renderizarListaPreview() {
    const lista = document.getElementById('share-preview-list');
    if (!lista) return;
    const lang = I18N.currentLang;
    const recursos = [
        I18N.t('modal-recurso-1', lang),
        I18N.t('modal-recurso-2', lang),
        I18N.t('modal-recurso-3', lang),
        I18N.t('modal-recurso-4', lang),
        I18N.t('modal-recurso-5', lang),
        I18N.t('modal-recurso-6', lang),
        I18N.t('modal-recurso-footer', lang),
    ];
    lista.innerHTML = recursos.map(r => `<li class="leading-relaxed">${r}</li>`).join('');
}

// ── Abrir modal ──
function abrirModalCompartilhar() {
    const overlay = document.getElementById('modal-compartilhar-overlay');
    const card = overlay.querySelector('.share-card');
    if (!overlay) return;

    // Renderiza preview da lista no idioma atual
    renderizarListaPreview();

    // Abre modal
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Animação scale
    requestAnimationFrame(() => {
        card.classList.remove('scale-95');
        card.classList.add('scale-100');
    });

    // Foco no botão fechar
    setTimeout(() => {
        document.getElementById('modal-compartilhar-fechar').focus();
    }, 100);
}

// ── Fechar modal ──
function fecharModalCompartilhar() {
    const overlay = document.getElementById('modal-compartilhar-overlay');
    const card = overlay.querySelector('.share-card');
    if (!overlay) return;

    card.classList.remove('scale-100');
    card.classList.add('scale-95');

    setTimeout(() => {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        // Restaura label do botão copiar
        const copyLabel = document.getElementById('copy-label');
        const copyIconNormal = document.getElementById('copy-icon-normal');
        const copyIconCheck = document.getElementById('copy-icon-check');
        if (copyLabel) {
            copyLabel.textContent = I18N.t('modal-btn-copiar', I18N.currentLang);
        }
        if (copyIconNormal) copyIconNormal.classList.remove('hidden');
        if (copyIconCheck) copyIconCheck.classList.add('hidden');
    }, 200);
}

// ── Compartilhar no WhatsApp ──
function compartilharWhatsApp() {
    const texto = montarTextoCompartilhar();
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto);
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Copiar texto para área de transferência ──
async function copiarTextoCompartilhar() {
    const texto = montarTextoCompartilhar();
    const copyLabel = document.getElementById('copy-label');
    const copyIconNormal = document.getElementById('copy-icon-normal');
    const copyIconCheck = document.getElementById('copy-icon-check');
    const btnCopy = document.getElementById('btn-share-copy');

    try {
        await navigator.clipboard.writeText(texto);
        // Feedback visual "Copiado!"
        if (copyIconNormal) copyIconNormal.classList.add('hidden');
        if (copyIconCheck) copyIconCheck.classList.remove('hidden');
        if (copyLabel) copyLabel.textContent = I18N.t('modal-btn-copiado', I18N.currentLang);

        // Transição suave no botão
        btnCopy.classList.add('bg-emerald-50', 'border-emerald-300', 'text-emerald-700');
        btnCopy.classList.remove('bg-brand-cream', 'hover:bg-brand-muted/70');

        // Restaura após 2.5s
        setTimeout(() => {
            if (copyIconNormal) copyIconNormal.classList.remove('hidden');
            if (copyIconCheck) copyIconCheck.classList.add('hidden');
            if (copyLabel) copyLabel.textContent = I18N.t('modal-btn-copiar', I18N.currentLang);
            btnCopy.classList.remove('bg-emerald-50', 'border-emerald-300', 'text-emerald-700');
            btnCopy.classList.add('bg-brand-cream', 'hover:bg-brand-muted/70');
        }, 2500);
    } catch (err) {
        console.warn('Falha ao copiar:', err);
        // Fallback: seleciona texto manualmente
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        if (copyLabel) copyLabel.textContent = I18N.t('modal-btn-copiado', I18N.currentLang);
        setTimeout(() => {
            if (copyLabel) copyLabel.textContent = I18N.t('modal-btn-copiar', I18N.currentLang);
        }, 2500);
    }
}

// ── Outras opções (navigator.share) ──
function compartilharOutros() {
    const lang = I18N.currentLang;
    const titulo = I18N.t('compartilhar-title', lang);
    const texto = montarTextoCompartilhar();

    if (navigator.share) {
        navigator.share({ title: titulo, text: texto })
            .catch(() => { /* usuário cancelou */ });
    } else {
        // Fallback: tenta copiar
        copiarTextoCompartilhar();
    }
}

// ── Legenda que acompanha a imagem ──
function montarLegendaImagem() {
    const lang = I18N.currentLang;
    const caption = lang === 'en'
        ? '💜 Ministério Acolher | Listening, care and respect'
        : lang === 'es'
        ? '💜 Ministerio Acolher | Escucha, cuidado y respeto'
        : '💜 Ministério Acolher | Escuta, cuidado e respeito';
    return caption + '\n🔗 https://acolher.life';
}

// ── Popula o card oculto com o texto completo (até 700 chars) ──
function popularCardImagem() {
    const container = document.getElementById('share-image-items');
    if (!container) return;
    const lang = I18N.currentLang;

    // Itens da lista — versão expandida para a imagem
    const recursos = [
        '💜 <b>Acolhimento emocional e espiritual</b> especializado',
        '✳️ <b>Atendimento 100% online</b>, gratuito e sigiloso',
        '✳️ <b>Profissionais qualificados</b> e humanizados',
        '✳️ <b>Direcionamento por perfil</b> (masculino, feminino, abuso)',
        '✳️ <b>Três sessões</b> de acolhimento sem custo',
        '✳️ <b>Ambiente seguro</b> e sem julgamentos',
    ];

    container.innerHTML = recursos.map((r, i) => {
        const border = i < recursos.length - 1 ? 'border-bottom:1px solid #F0E8DC;padding-bottom:8px;margin-bottom:8px;' : '';
        return '<div style="font-size:13px;color:#2C1A1A;line-height:1.5;' + border + '">' + r + '</div>';
    }).join('');
}

// ── Compartilhar como imagem (html2canvas) ──
async function compartilharComoImagem() {
    const card = document.getElementById('share-card-image');
    const btn = document.getElementById('btn-share-image');
    const btnText = btn ? btn.querySelector('span') : null;
    const originalText = btnText ? btnText.textContent : '';

    if (!card || typeof html2canvas === 'undefined') {
        console.warn('html2canvas não disponível');
        return;
    }

    // Feedback visual de carregamento
    if (btnText) btnText.textContent = '🔄 Gerando imagem...';
    if (btn) btn.disabled = true;

    try {
        // Popula o card com conteúdo
        popularCardImagem();

        // Mostra o card temporariamente para captura (fora da tela)
        card.classList.remove('hidden');
        card.style.position = 'fixed';
        card.style.left = '-9999px';
        card.style.top = '0';
        card.style.zIndex = '-1';

        // Aguarda renderização de imagens
        await new Promise(resolve => setTimeout(resolve, 300));

        // Captura com html2canvas
        const canvas = await html2canvas(card, {
            scale: 2.5,          // Alta resolução (Retina)
            useCORS: true,        // Para imagens externas
            allowTaint: false,
            backgroundColor: '#FFFDF9',
            logging: false,
            width: 420,
            height: card.scrollHeight,
            windowWidth: 420,
            windowHeight: card.scrollHeight,
        });

        // Esconde o card novamente
        card.classList.add('hidden');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';

        // Converte para blob PNG
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
        if (!blob) throw new Error('Falha ao gerar blob');

        const fileName = 'acolher-life-compartilhar.png';
        const legenda = montarLegendaImagem();

        // Tenta compartilhar via Web Share API (mobile)
        if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
                title: 'Ministério Acolher',
                text: legenda,
                files: [file],
            };
            if (navigator.canShare(shareData)) {
                await navigator.share(shareData);
                if (btnText) btnText.textContent = originalText;
                if (btn) btn.disabled = false;
                return;
            }
        }

        // Fallback: abre WhatsApp com a legenda + disponibiliza download da imagem
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();

        // Abre WhatsApp com a legenda
        const whatsappUrl = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(legenda);
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

        // Feedback
        if (btnText) btnText.textContent = '✅ Imagem gerada!';
        setTimeout(() => {
            if (btnText) btnText.textContent = originalText;
            if (btn) btn.disabled = false;
        }, 3000);

        // Limpa a URL do objeto
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);

    } catch (err) {
        console.error('Erro ao gerar imagem:', err);
        if (btnText) btnText.textContent = '❌ Erro';
        setTimeout(() => {
            if (btnText) btnText.textContent = originalText;
            if (btn) btn.disabled = false;
        }, 2000);

        // Garante que o card volte a ficar oculto
        card.classList.add('hidden');
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
    }
}

// ── Vincula eventos do modal ──
document.addEventListener('DOMContentLoaded', function () {
    const overlay = document.getElementById('modal-compartilhar-overlay');
    if (!overlay) return;

    // Fechar
    document.getElementById('modal-compartilhar-fechar').addEventListener('click', fecharModalCompartilhar);

    // Clique no backdrop
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) fecharModalCompartilhar();
    });

    // ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.getAttribute('aria-hidden') === 'false') {
            fecharModalCompartilhar();
        }
    });

    // WhatsApp
    document.getElementById('btn-share-whatsapp').addEventListener('click', function (e) {
        e.preventDefault();
        compartilharWhatsApp();
    });

    // Copiar
    document.getElementById('btn-share-copy').addEventListener('click', function (e) {
        e.preventDefault();
        copiarTextoCompartilhar();
    });

    // Outras opções
    document.getElementById('btn-share-other').addEventListener('click', function (e) {
        e.preventDefault();
        compartilharOutros();
    });

    // Compartilhar como imagem (html2canvas)
    const btnShareImage = document.getElementById('btn-share-image');
    if (btnShareImage) {
        btnShareImage.addEventListener('click', function (e) {
            e.preventDefault();
            compartilharComoImagem();
        });
    }

    // Trap focus dentro do modal
    overlay.addEventListener('keydown', function (e) {
        if (overlay.getAttribute('aria-hidden') !== 'false') return;
        const focaveis = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            } else {
                if (document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
            }
        }
    });

    // Re-renderiza preview ao mudar idioma (hook no I18N.applyTranslation)
    const applyOriginal = I18N.applyTranslation.bind(I18N);
    I18N.applyTranslation = function (lang) {
        applyOriginal(lang);
        // Se o modal estiver aberto, re-renderiza a lista
        if (overlay.getAttribute('aria-hidden') === 'false') {
            renderizarListaPreview();
        }
    };
});

// ════════════════════════════════════════════════════════
// ── MODAL DE AVISO — Direcionamento à Shirley ──────────
// ════════════════════════════════════════════════════════
// Exibido quando o servidor direciona o acolhimento à Shirley (round-robin de
// mulheres). Ela não aparece listada na página pública por questões jurídicas,
// então informamos a pessoa antes de abrir o WhatsApp — ao fechar, seguimos o
// redirecionamento normal (com fallback caso o wa.me não responda).

let acaoAposAvisoShirley = null;

// Abre o aviso e guarda a ação a executar quando o usuário fechar o modal
function abrirAvisoShirley(aoFechar) {
    const avisoOverlay = document.getElementById('modal-aviso-shirley-overlay');
    if (!avisoOverlay) return;

    acaoAposAvisoShirley = aoFechar || null;

    avisoOverlay.classList.remove('opacity-0', 'pointer-events-none');
    avisoOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Animação scale (mesmo padrão do modal de compartilhamento)
    const avisoCard = document.getElementById('modal-aviso-shirley-card');
    requestAnimationFrame(() => {
        avisoCard.classList.remove('scale-95');
        avisoCard.classList.add('scale-100');
    });

    // Foco no botão "Entendi" para navegação por teclado
    setTimeout(() => {
        const btnEntendi = document.getElementById('modal-aviso-shirley-entendi');
        if (btnEntendi) btnEntendi.focus();
    }, 100);
}

// Fecha o aviso e dispara o redirecionamento que estava aguardando
function fecharAvisoShirley() {
    const avisoOverlay = document.getElementById('modal-aviso-shirley-overlay');
    if (!avisoOverlay || avisoOverlay.getAttribute('aria-hidden') === 'true') return;

    const avisoCard = document.getElementById('modal-aviso-shirley-card');
    avisoCard.classList.remove('scale-100');
    avisoCard.classList.add('scale-95');

    setTimeout(() => {
        avisoOverlay.classList.add('opacity-0', 'pointer-events-none');
        avisoOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Executa a ação pendente (redirecionamento ao WhatsApp da Shirley)
        const acao = acaoAposAvisoShirley;
        acaoAposAvisoShirley = null;
        if (acao) acao();
    }, 200);
}

// Vincula eventos do modal de aviso
document.addEventListener('DOMContentLoaded', function () {
    const avisoOverlay = document.getElementById('modal-aviso-shirley-overlay');
    if (!avisoOverlay) return;

    // "Entendi" e botão fechar (X)
    document.getElementById('modal-aviso-shirley-entendi').addEventListener('click', fecharAvisoShirley);
    document.getElementById('modal-aviso-shirley-fechar').addEventListener('click', fecharAvisoShirley);

    // Clique no backdrop
    avisoOverlay.addEventListener('click', function (e) {
        if (e.target === avisoOverlay) fecharAvisoShirley();
    });

    // ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && avisoOverlay.getAttribute('aria-hidden') === 'false') {
            fecharAvisoShirley();
        }
    });

    // Trap focus dentro do modal
    avisoOverlay.addEventListener('keydown', function (e) {
        if (avisoOverlay.getAttribute('aria-hidden') !== 'false') return;
        const focaveis = avisoOverlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            } else {
                if (document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
            }
        }
    });
});

// ── Reveal ao rolar ──────────────────────────────────
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// ── Modal de profissional (acessível) ────────────────
const overlay = document.createElement('div');
overlay.className = 'modal-overlay';
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.setAttribute('aria-label', 'Perfil do profissional');
overlay.setAttribute('aria-hidden', 'true');
overlay.innerHTML = `
    <div class="modal-card" id="modal-card">
        <button class="modal-fechar" id="modal-fechar" aria-label="Fechar perfil">✕</button>
        <div id="modal-conteudo"></div>
    </div>
`;
document.body.appendChild(overlay);

document.querySelectorAll('.prof-card').forEach(card => {
    card.style.cursor = 'pointer';

    const abrirModal = () => {
        document.getElementById('modal-conteudo').innerHTML = card.innerHTML;
        overlay.classList.add('aberto');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        setTimeout(() => document.getElementById('modal-fechar').focus(), 50);
    };

    card.addEventListener('click', abrirModal);
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            abrirModal();
        }
    });
});

document.getElementById('modal-fechar').addEventListener('click', fecharModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

// Trap focus dentro do modal
overlay.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('aberto')) return;
    const focaveis = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.key === 'Tab') {
        if (e.shiftKey) {
            if (document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        } else {
            if (document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        }
    }
});

function fecharModal() {
    overlay.classList.remove('aberto');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}