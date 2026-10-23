// public/js/senha-toggle.js
// Botão "olhinho" reutilizável: alterna campos de senha entre
// type="password" e type="text" com ícones SVG (olho aberto / olho riscado).
//
// Uso no HTML:
//   <div class="campo-senha">
//       <input id="senha" type="password" ...>
//       <button type="button" class="senha-toggle" data-toggle-senha="senha"
//               aria-label="Mostrar senha" aria-pressed="false"></button>
//   </div>
//
// O script injeta os ícones e registra o comportamento de forma delegada,
// funcionando tanto em páginas com CSS puro quanto nas que usam Tailwind.

(function () {
    'use strict';

    const ICONE_OLHO = [
        '<svg class="icone-olho" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
        '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/>',
        '<circle cx="12" cy="12" r="3"/>',
        '</svg>'
    ].join('');

    const ICONE_OLHO_RISCADO = [
        '<svg class="icone-olho-riscado" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
        ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
        '<path d="M9.88 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/>',
        '<path d="M6.61 6.61A18.4 18.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/>',
        '<path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
        '<line x1="2" y1="2" x2="22" y2="22"/>',
        '</svg>'
    ].join('');

    function prepararBotao(botao) {
        if (botao.dataset.togglePronto === '1') return;

        botao.dataset.togglePronto = '1';
        botao.setAttribute('type', 'button');
        botao.setAttribute('aria-label', botao.getAttribute('aria-label') || 'Mostrar senha');
        botao.setAttribute('aria-pressed', 'false');
        botao.innerHTML = ICONE_OLHO + ICONE_OLHO_RISCADO;
    }

    function prepararTodos(raiz) {
        const escopo = raiz && typeof raiz.querySelectorAll === 'function' ? raiz : document;
        escopo.querySelectorAll('[data-toggle-senha]').forEach(prepararBotao);
    }

    function alternar(botao) {
        const alvo = botao.getAttribute('data-toggle-senha');
        const input = alvo ? document.getElementById(alvo) : null;
        if (!input) return;

        const mostrar = input.type === 'password';
        input.type = mostrar ? 'text' : 'password';

        botao.classList.toggle('visivel', mostrar);
        botao.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
        botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');

        // Mantém o foco no campo para não interromper a digitação
        try {
            input.focus({ preventScroll: true });
        } catch (_) { /* navegadores antigos */ }
    }

    document.addEventListener('click', (ev) => {
        const botao = ev.target && ev.target.closest
            ? ev.target.closest('[data-toggle-senha]')
            : null;
        if (!botao) return;

        ev.preventDefault();
        alternar(botao);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => prepararTodos(document));
    } else {
        prepararTodos(document);
    }

    // Expõe utilidade para conteúdo injetado dinamicamente (ex.: modais)
    window.prepararTogglesSenha = prepararTodos;
})();
