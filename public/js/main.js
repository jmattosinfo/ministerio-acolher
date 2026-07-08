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

    const btnTexto = document.getElementById('btn-texto');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnSubmit = document.getElementById('btn-submit');

    btnTexto.innerText = I18N.t('form-btn-enviando', I18N.currentLang);
    btnSpinner.classList.remove('hidden');
    btnSubmit.disabled = true;

    try {
        const formData = new FormData(this);
        const response = await fetch('/api/cadastro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData.entries()))
        });

        if (response.ok) {
            const data = await response.json();
            const prof = data.profissional;

            this.style.display = 'none';

            const lang = I18N.currentLang;

            const mensagemPrevia = lang === 'en'
                ? "Hello, I came through the Acolher website and was directed to you. I would like to receive support. Could you help me?"
                : lang === 'es'
                ? "Hola, llegué a través del sitio web Acolher y fui dirigido(a) a usted. Me gustaría recibir acogida. ¿Podría ayudarme?"
                : "Olá, passei pelo site Acolher, e fui direcionado(a) para você. Gostaria de receber acolhimento. Poderia me ajudar?";
            const mensagemWhatsApp = encodeURIComponent(mensagemPrevia);

            const sucessoDiv = document.getElementById('sucesso');
            sucessoDiv.innerHTML = `
                <div class="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-3xl mx-auto mb-5">✅</div>
                <h3 class="font-serif text-2xl font-bold text-brand-dark mb-2">${I18N.t('sucesso-titulo', lang)}</h3>
                <p class="text-brand-soft text-sm leading-relaxed max-w-md mx-auto mb-6">
                    ${I18N.t('sucesso-desc', lang, { profissional: prof.nome })}
                </p>
                <a href="https://wa.me/${prof.whatsapp}?text=${mensagemWhatsApp}" target="_blank"
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

// ── Compartilhar ──────────────────────────────────────
function compartilhar() {
    const lang = I18N.currentLang;
    if (navigator.share) {
        navigator.share({
            title: 'Ministério Acolher',
            text: I18N.t('compartilhar-text', lang),
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            const btn = document.querySelector('[onclick="compartilhar()"]');
            const original = btn.innerText;
            btn.innerText = I18N.t('compartilhar-copiado', lang);
            setTimeout(() => btn.innerText = original, 2500);
        });
    }
}

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