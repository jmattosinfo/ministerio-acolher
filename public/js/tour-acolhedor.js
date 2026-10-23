/**
 * public/js/tour-acolhedor.js
 * ---------------------------------------------------------------------------
 * Tour guiado interativo do painel do acolhedor (Driver.js).
 *
 * Fluxo:
 *   1. Boas-vindas (balão centralizado, sem âncora)
 *   2. Lista de Acolhidos
 *   3. Ler Prontuário (botão "Abrir" do primeiro registro)
 *   4. Gerar Link de Feedback/Avaliação (card dentro do prontuário)
 *
 * O tour abre automaticamente apenas no primeiro acesso
 * (chave `tourAcolherVisto` no localStorage) e pode ser reaberto pelo botão
 * "Rever Tutorial" do cabeçalho.
 *
 * API pública:
 *   window.TourAcolher.iniciar()             -> força o tour agora
 *   window.TourAcolher.iniciarPrimeiroAcesso() -> dispara só se ainda não viu
 *   window.TourAcolher.jaViu()               -> boolean
 *   window.TourAcolher.esquecer()            -> limpa a marca (para testes)
 * ---------------------------------------------------------------------------
 */
(function () {
    'use strict';

    const CHAVE_STORAGE = 'tourAcolherVisto';
    const CLASSE_POPOVER = 'tour-acolher';

    // Tempo (ms) de espera da animação do drawer lateral antes de recalcular
    // a posição do balão. O drawer usa `duration-300`.
    const ESPERA_ANIMACAO_DRAWER = 380;

    let tour = null;
    let timerRefresh = null;
    let drawerAbertoPeloTour = false;

    /* ───────────────────────── localStorage (à prova de falhas) ───────────────────────── */

    function jaViuTour() {
        try {
            return window.localStorage.getItem(CHAVE_STORAGE) === '1';
        } catch (_) {
            return false;
        }
    }

    function marcarComoVisto() {
        try {
            window.localStorage.setItem(CHAVE_STORAGE, '1');
        } catch (_) {
            /* modo privado / storage bloqueado: apenas ignora */
        }
    }

    function esquecerTour() {
        try {
            window.localStorage.removeItem(CHAVE_STORAGE);
        } catch (_) {
            /* ignora */
        }
    }

    /* ───────────────────────── Driver.js ───────────────────────── */

    /**
     * A build IIFE do Driver.js expõe `window.driver.js.driver`.
     * @returns {Function|null}
     */
    function obterFabrica() {
        const fabrica = window.driver && window.driver.js && window.driver.js.driver;
        return typeof fabrica === 'function' ? fabrica : null;
    }

    function emTelaGrande() {
        return window.matchMedia('(min-width: 768px)').matches;
    }

    function existe(seletor) {
        return Boolean(seletor) && Boolean(document.querySelector(seletor));
    }

    /**
     * O botão "Abrir" da tabela (desktop) e o cartão clicável (mobile) usam a
     * mesma classe `.js-abrir`. Escolhe o que está realmente visível no
     * breakpoint atual para não destacar um elemento oculto.
     * @returns {string|null}
     */
    function seletorBotaoAbrirProntuario() {
        const candidatos = emTelaGrande()
            ? ['#tabelaCorpo .js-abrir', '#cardsAtendimentos .js-abrir']
            : ['#cardsAtendimentos .js-abrir', '#tabelaCorpo .js-abrir'];

        return candidatos.find(existe) || null;
    }

    /**
     * Linha/cartão do primeiro atendimento (fonte do `data-id`).
     * @returns {string|null}
     */
    function seletorPrimeiroRegistro() {
        const candidatos = emTelaGrande()
            ? ['#tabelaCorpo tr[data-id]', '#cardsAtendimentos [data-id]']
            : ['#cardsAtendimentos [data-id]', '#tabelaCorpo tr[data-id]'];

        return candidatos.find(existe) || null;
    }

    /* ───────────────────────── Prontuário (drawer) ───────────────────────── */

    function drawerAberto() {
        const drawer = document.getElementById('drawerProntuario');
        return Boolean(drawer) && !drawer.classList.contains('translate-x-full');
    }

    function fecharProntuario() {
        if (!drawerAberto()) return;

        if (typeof window.fecharDrawer === 'function') {
            window.fecharDrawer();
            return;
        }

        document.getElementById('btnFecharDrawer')?.click();
    }

    function fecharMenuUsuarioSeAberto() {
        const menu = document.getElementById('menuUsuario');
        if (!menu || menu.classList.contains('hidden')) return;

        if (typeof window.fecharMenuUsuario === 'function') {
            window.fecharMenuUsuario();
        } else {
            menu.classList.add('hidden');
            document.getElementById('btnMenuUsuario')?.setAttribute('aria-expanded', 'false');
        }
    }

    /**
     * Abre o prontuário do primeiro acolhido da lista.
     * @returns {boolean} true se um prontuário foi aberto agora
     */
    function abrirPrimeiroProntuario() {
        if (drawerAberto()) return false;

        const seletor = seletorPrimeiroRegistro();
        if (!seletor) return false;

        const registro = document.querySelector(seletor);
        const id = registro ? registro.getAttribute('data-id') : null;
        if (!id) return false;

        if (typeof window.abrirDrawer === 'function') {
            window.abrirDrawer(id);
            return true;
        }

        // Fallback: dispara o mesmo evento usado pela listagem
        registro.click();
        return drawerAberto();
    }

    /**
     * Garante o prontuário aberto para o passo do feedback e registra que a
     * abertura foi feita pelo tour (para fechar depois).
     * @returns {boolean} true se abrimos agora
     */
    function garantirProntuarioAberto() {
        if (drawerAberto()) return false;

        const abriu = abrirPrimeiroProntuario();
        if (abriu) drawerAbertoPeloTour = true;
        return abriu;
    }

    /* ───────────────────────── Passos do tour ───────────────────────── */

    /**
     * Monta a lista de passos de acordo com o DOM disponível.
     * Passos sem âncora são exibidos centralizados, então o tour nunca quebra
     * quando o acolhedor ainda não possui atendimentos.
     * @param {() => object|null} obterDriver
     * @returns {Array<object>}
     */
    function montarPassos(obterDriver) {
        const passos = [];

        /* Passo 1 — Boas-vindas (centralizado) */
        passos.push({
            popover: {
                title: '🌹 Boas-vindas ao Ministério Acolher',
                description:
                    'Este é o seu <strong>painel de acompanhamento humanizado</strong>. '
                    + 'Em poucos passos você vai conhecer os recursos essenciais para '
                    + 'cuidar de quem foi designado a você. Se esquecer algo depois, '
                    + 'use o botão <strong>Rever Tutorial</strong> no topo da tela.',
                side: 'center',
                align: 'center'
            }
        });

        /* Passo 2 — Lista de Acolhidos */
        if (existe('#listaAcolhidos')) {
            passos.push({
                element: '#listaAcolhidos',
                popover: {
                    title: '👥 Lista de Acolhidos',
                    description:
                        'Aqui ficam as pessoas <strong>designadas a você</strong>. '
                        + 'Use a busca e os filtros de status para encontrar rapidamente '
                        + 'quem precisa de atenção: <em>novos</em>, <em>em andamento</em>, '
                        + '<em>realizados</em> e <em>não realizados</em>.',
                    side: emTelaGrande() ? 'top' : 'bottom',
                    align: 'start'
                }
            });
        } else {
            passos.push({
                popover: {
                    title: '👥 Lista de Acolhidos',
                    description:
                        'Aqui ficam as pessoas <strong>designadas a você</strong>, '
                        + 'com filtros por status e busca por nome ou WhatsApp.'
                }
            });
        }

        /* Passo 3 — Ler Prontuário */
        const seletorAbrir = seletorBotaoAbrirProntuario();

        if (seletorAbrir) {
            passos.push({
                element: seletorAbrir,
                popover: {
                    title: '📖 Ler Prontuário',
                    description:
                        'Clique em <strong>Abrir</strong> (ou toque no cartão, no celular) '
                        + 'para acessar o prontuário: dados de contato, motivo do acolhimento, '
                        + 'status e as <strong>anotações sigilosas de cada sessão</strong>.',
                    side: emTelaGrande() ? 'left' : 'top',
                    align: 'center',
                    // Abre o prontuário antes de avançar, já com a animação concluída.
                    onNextClick: () => {
                        const driverObj = obterDriver();
                        const abriuAgora = garantirProntuarioAberto();
                        const atraso = abriuAgora ? ESPERA_ANIMACAO_DRAWER + 60 : 60;

                        window.setTimeout(() => {
                            if (driverObj) driverObj.moveNext();
                        }, atraso);
                    }
                }
            });
        } else {
            passos.push({
                popover: {
                    title: '📖 Ler Prontuário',
                    description:
                        'Quando houver um acolhido na sua lista, o botão '
                        + '<strong>Abrir</strong> exibirá o prontuário com o histórico '
                        + 'e as anotações privadas das sessões.'
                }
            });
        }

        /* Passo 4 — Gerar Link de Feedback/Avaliação */
        const temRegistro = Boolean(seletorPrimeiroRegistro());

        if (temRegistro && existe('#cardFeedbackWhatsapp')) {
            passos.push({
                element: '#cardFeedbackWhatsapp',
                popover: {
                    title: '💛 Gerar Link de Feedback/Avaliação',
                    description:
                        'Este é o card de avaliação. O link único já vem pronto para o '
                        + 'acolhido — basta clicar em <strong>Copiar Mensagem para o '
                        + 'WhatsApp</strong> e enviar. As respostas aparecem aqui no '
                        + 'prontuário, com nota e comentário.',
                    side: 'left',
                    align: 'center',
                    // Fecha o prontuário (se foi o tour que o abriu) antes de voltar.
                    onPrevClick: () => {
                        const driverObj = obterDriver();

                        if (drawerAbertoPeloTour) {
                            fecharProntuario();
                            drawerAbertoPeloTour = false;

                            window.setTimeout(() => {
                                if (driverObj) driverObj.movePrevious();
                            }, ESPERA_ANIMACAO_DRAWER);
                            return;
                        }

                        if (driverObj) driverObj.movePrevious();
                    }
                },
                onHighlightStarted: () => {
                    const driverObj = obterDriver();
                    const abriuAgora = garantirProntuarioAberto();

                    if (!abriuAgora) return;

                    // O drawer desliza por 300ms: reposiciona o balão ao final.
                    window.clearTimeout(timerRefresh);
                    timerRefresh = window.setTimeout(() => {
                        if (driverObj && drawerAberto()) driverObj.refresh();
                    }, ESPERA_ANIMACAO_DRAWER);
                }
            });
        } else {
            passos.push({
                popover: {
                    title: '💛 Gerar Link de Feedback/Avaliação',
                    description:
                        'Dentro do prontuário existe o card <strong>Mensagem Empática '
                        + 'de Feedback</strong>. Ele gera um link único de avaliação e '
                        + 'copia a mensagem pronta para enviar no WhatsApp.'
                }
            });
        }

        return passos;
    }

    /* ───────────────────────── Criação / disparo do tour ───────────────────────── */

    function construirTour() {
        const fabrica = obterFabrica();
        if (!fabrica) return null;

        let driverObj = null;

        const opcoes = {
            popoverClass: CLASSE_POPOVER,
            showProgress: true,
            progressText: '{{current}} de {{total}}',
            nextBtnText: 'Próximo →',
            prevBtnText: '← Voltar',
            doneBtnText: 'Concluir 🌹',
            closeBtnText: '✕',
            smoothScroll: true,
            stagePadding: 10,
            stageRadius: 14,
            overlayColor: 'rgba(44, 26, 26, 0.62)',
            allowClose: true,
            disableActiveInteraction: false,
            onDestroyed: () => {
                marcarComoVisto();
                limparEstado();
                tour = null;
            }
        };

        opcoes.steps = montarPassos(() => driverObj);
        driverObj = fabrica(opcoes);

        return driverObj;
    }

    function limparEstado() {
        window.clearTimeout(timerRefresh);
        timerRefresh = null;

        if (drawerAbertoPeloTour) {
            fecharProntuario();
            drawerAbertoPeloTour = false;
        }
    }

    /**
     * Inicia o tour imediatamente.
     * @returns {boolean} true se o tour foi iniciado ou já estava ativo
     */
    function iniciarTour() {
        if (!obterFabrica()) {
            console.warn('[TourAcolher] Driver.js não foi carregado; tour ignorado.');
            return false;
        }

        if (tour && typeof tour.isActive === 'function' && tour.isActive()) {
            return true;
        }

        // Deixa a tela em um estado previsível antes de destacar os elementos.
        fecharMenuUsuarioSeAberto();
        if (drawerAberto()) fecharProntuario();
        drawerAbertoPeloTour = false;

        try {
            tour = construirTour();
        } catch (err) {
            console.error('[TourAcolher] Falha ao montar o tour:', err);
            tour = null;
            return false;
        }

        if (!tour) return false;

        // Referência local: se o usuário clicar novamente em "Rever Tutorial"
        // durante o atraso, apenas a instância mais recente será iniciada.
        const tourCriado = tour;

        // Pequeno atraso para ícones/fontes e o layout assentarem.
        window.setTimeout(() => {
            if (!tour || tour !== tourCriado) return;
            try {
                tourCriado.drive();
            } catch (err) {
                console.error('[TourAcolher] Falha ao iniciar o tour:', err);
            }
        }, 150);

        return true;
    }

    /**
     * Dispara o tour apenas se o acolhedor ainda não o viu.
     * @returns {boolean} true se o tour foi agendado
     */
    function iniciarPrimeiroAcesso() {
        if (jaViuTour()) return false;
        if (!obterFabrica()) return false;

        window.setTimeout(() => {
            if (!jaViuTour()) iniciarTour();
        }, 550);

        return true;
    }

    /* ───────────────────────── Botão "Rever Tutorial" ───────────────────────── */

    function configurarBotaoReverTutorial() {
        const botao = document.getElementById('btnReverTutorial');
        if (!botao || botao.dataset.tourVinculado === '1') return;

        botao.dataset.tourVinculado = '1';
        botao.addEventListener('click', (ev) => {
            ev.preventDefault();
            iniciarTour();
        });
    }

    function inicializar() {
        configurarBotaoReverTutorial();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar, { once: true });
    } else {
        inicializar();
    }

    /* API pública */
    window.TourAcolher = {
        iniciar: iniciarTour,
        iniciarPrimeiroAcesso,
        jaViu: jaViuTour,
        esquecer: esquecerTour
    };
})();
