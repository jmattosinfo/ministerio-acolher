// ── Menu mobile ──────────────────────────────────────
const btnMenuMobile = document.getElementById('btn-menu-mobile');
const menuMobile = document.getElementById('menu-mobile');
const iconMenuAberto = document.getElementById('icon-menu-aberto');
const iconMenuFechado = document.getElementById('icon-menu-fechado');

if (btnMenuMobile) {
    btnMenuMobile.addEventListener('click', () => {
        menuMobile.classList.toggle('hidden');
        iconMenuAberto.classList.toggle('hidden');
        iconMenuFechado.classList.toggle('hidden');
    });

    // Fecha o menu ao clicar em qualquer link dentro dele
    menuMobile.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuMobile.classList.add('hidden');
            iconMenuAberto.classList.remove('hidden');
            iconMenuFechado.classList.add('hidden');
        });
    });
}

// ── Stepper ──────────────────────────────────────────
let etapaAtual = 1;

function irParaEtapa(n) {
    if (n > etapaAtual && !validarEtapa(etapaAtual)) return;

    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('step-' + n).classList.add('active');
    etapaAtual = n;

    atualizarStepper();
    document.getElementById('formulario').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validarEtapa(n) {
    const panel = document.getElementById('step-' + n);
    const required = panel.querySelectorAll('[required]');
    let ok = true;
    required.forEach(el => {
        if (!el.value) {
            el.classList.add('border-red-400');
            el.addEventListener('input', () => el.classList.remove('border-red-400'), { once: true });
            ok = false;
        }
    });

    // Validação de radio group na etapa 1
    if (n === 1) {
        const radios = panel.querySelectorAll('input[name="perfil_triagem"]');
        const checked = Array.from(radios).some(r => r.checked);
        if (!checked) {
            radios.forEach(r => r.closest('label').querySelector('div').classList.add('border-red-400'));
            ok = false;
        }
    }

    if (!ok) {
        const primeiro = panel.querySelector('.border-red-400');
        if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return ok;
}

function atualizarStepper() {
    document.querySelectorAll('.step-indicator').forEach(ind => {
        const n = parseInt(ind.dataset.step);
        const circle = ind.querySelector('.step-circle');
        const label = ind.querySelector('span');

        if (n < etapaAtual) {
            circle.className = 'w-8 h-8 rounded-full border-2 border-emerald-500 bg-emerald-500 text-white text-xs font-bold flex items-center justify-center step-circle';
            circle.innerText = '✓';
            if (label) label.className = 'text-xs text-emerald-600 font-semibold hidden sm:block';
        } else if (n === etapaAtual) {
            circle.className = 'w-8 h-8 rounded-full border-2 border-brand-dark bg-brand-dark text-white text-xs font-bold flex items-center justify-center step-circle';
            circle.innerText = n;
            if (label) label.className = 'text-xs text-brand-dark font-semibold hidden sm:block';
        } else {
            circle.className = 'w-8 h-8 rounded-full border-2 border-brand-muted text-brand-muted text-xs font-bold flex items-center justify-center step-circle';
            circle.innerText = n;
            if (label) label.className = 'text-xs text-brand-muted hidden sm:block';
        }
    });

    // Linha entre etapas
    const l1 = document.getElementById('line-1-2');
    const l2 = document.getElementById('line-2-3');
    if (l1) l1.className = `flex-1 h-px mx-2 step-line ${etapaAtual > 1 ? 'bg-emerald-400' : 'bg-brand-muted'}`;
    if (l2) l2.className = `flex-1 h-px mx-2 step-line ${etapaAtual > 2 ? 'bg-emerald-400' : 'bg-brand-muted'}`;
}

// ── Perfil → aviso e rótulo de nome ───────────────────
document.querySelectorAll('input[name="perfil_triagem"]').forEach(radio => {
    radio.addEventListener('change', function () {
        const aviso = document.getElementById('aviso-abuso');
        const labelNome = document.getElementById('label-nome');

        if (this.value === 'vitima_abuso') {
            aviso.classList.remove('hidden');
            labelNome.innerHTML = 'Nome ou codinome <span class="font-normal text-brand-soft/70">(pseudônimo permitido)</span> *';
        } else {
            aviso.classList.add('hidden');
            labelNome.innerHTML = 'Nome completo *';
        }
    });
});

// ── Envio do formulário (AJAX) ──────────────────────
document.getElementById('acolherForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!validarEtapa(3)) return;

    const btnTexto = document.getElementById('btn-texto');
    const btnSpinner = document.getElementById('btn-spinner');
    const btnSubmit = document.getElementById('btn-submit');

    btnTexto.innerText = 'Enviando...';
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

            this.closest('.bg-brand-light').querySelector('form').style.display = 'none';

            const sucessoDiv = document.getElementById('sucesso');
            sucessoDiv.innerHTML = `
                <div class="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-3xl mx-auto mb-5">✅</div>
                <h3 class="font-serif text-2xl font-bold text-brand-dark mb-2">Formulário recebido</h3>
                <p class="text-brand-soft text-sm leading-relaxed max-w-md mx-auto mb-6">
                    Suas informações foram encaminhadas com sigilo para <strong class="text-brand-dark">${prof.nome}</strong>,
                    o(a) profissional mais indicado(a) para te acolher.
                </p>
                <a href="https://wa.me/${prof.whatsapp}" target="_blank"
                   class="inline-flex items-center gap-2 bg-brand-dark text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-deep transition text-sm shadow-lg">
                    📞 Falar com ${prof.nome} agora — ${prof.whatsappFormatado}
                </a>
            `;
            sucessoDiv.classList.remove('hidden');
            sucessoDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            throw new Error();
        }
    } catch {
        btnTexto.innerText = 'Enviar formulário';
        btnSpinner.classList.add('hidden');
        btnSubmit.disabled = false;

        const errDiv = document.createElement('p');
        errDiv.className = 'text-xs text-red-600 text-center mt-3';
        errDiv.innerText = 'Ocorreu um erro ao enviar. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.';
        btnSubmit.parentElement.after(errDiv);
        setTimeout(() => errDiv.remove(), 6000);
    }
});

// ── Compartilhar ──────────────────────────────────────
function compartilhar() {
    if (navigator.share) {
        navigator.share({
            title: 'Ministério Acolher',
            text: 'Um espaço de escuta, cuidado e respeito — atendimento gratuito e sigiloso.',
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link copiado para a área de transferência!');
        });
    }
}

// ── Reveal ao rolar ──────────────────────────────────
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));