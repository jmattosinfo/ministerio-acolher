// ─── i18n — Sistema de Internacionalização ─────────────────────────────────
// Suporte: pt-BR (português), en (English), es (Español)

const I18N = {
    currentLang: 'pt-BR',
    availableLangs: ['pt-BR', 'en', 'es'],

    labels: {
        'pt-BR': { name: 'Português', flag: '🇧🇷', short: 'PT' },
        'en':     { name: 'English',    flag: '🇺🇸', short: 'EN' },
        'es':     { name: 'Español',    flag: '🇪🇸', short: 'ES' },
    },

    // ── Dicionário ──────────────────────────────────────────────────────────
    translations: {
        // ── Acessibilidade ──
        'skip-link': {
            'pt-BR': 'Pular para o formulário de acolhimento',
            'en': 'Skip to the support form',
            'es': 'Saltar al formulario de acogida',
        },
        'nav-label': {
            'pt-BR': 'Navegação principal',
            'en': 'Main navigation',
            'es': 'Navegación principal',
        },
        'nav-home': {
            'pt-BR': 'Ir para a home',
            'en': 'Go to home',
            'es': 'Ir a inicio',
        },

        // ── Navegação ──
        'nav-sobre': {
            'pt-BR': 'Sobre',
            'en': 'About',
            'es': 'Acerca de',
        },
        'nav-equipe': {
            'pt-BR': 'Equipe',
            'en': 'Team',
            'es': 'Equipo',
        },
        'nav-acolhimento': {
            'pt-BR': 'Acolhimento',
            'en': 'Support',
            'es': 'Acogida',
        },
        'nav-cta': {
            'pt-BR': 'Quero ser acolhido',
            'en': 'I want to be supported',
            'es': 'Quiero ser acogido',
        },
        'nav-acolhimento-mobile': {
            'pt-BR': 'Acolhimento',
            'en': 'Support',
            'es': 'Acogida',
        },
        'btn-menu-abrir': {
            'pt-BR': 'Abrir menu',
            'en': 'Open menu',
            'es': 'Abrir menú',
        },
        'btn-menu-fechar': {
            'pt-BR': 'Fechar menu',
            'en': 'Close menu',
            'es': 'Cerrar menú',
        },

        // ── Hero ──
        'hero-badge': {
            'pt-BR': 'Atendimento 100% Gratuito e Sigiloso',
            'en': '100% Free and Confidential Care',
            'es': 'Atención 100% Gratuita y Confidencial',
        },
        'hero-title': {
            'pt-BR': 'Ministério Acolher',
            'en': 'Ministério Acolher',
            'es': 'Ministério Acolher',
        },
        'hero-subtitle': {
            'pt-BR': '"Um espaço de escuta, cuidado e respeito."',
            'en': '"A space for listening, care and respect."',
            'es': '"Un espacio de escucha, cuidado y respeto."',
        },
        'hero-description': {
            'pt-BR': 'Oferecemos acolhimento emocional e espiritual especializado para homens e mulheres maiores de 18 anos que vivenciam ou vivenciaram violência doméstica no relacionamento conjugal, divórcio, ou abuso sexual fora do casamento.',
            'en': 'We offer specialized emotional and spiritual support for men and women over 18 who are experiencing or have experienced domestic violence in marital relationships, divorce, or sexual abuse outside of marriage.',
            'es': 'Ofrecemos acogida emocional y espiritual especializada para hombres y mujeres mayores de 18 años que viven o han vivido violencia doméstica en la relación conyugal, divorcio, o abuso sexual fuera del matrimonio.',
        },
        'hero-btn-form': {
            'pt-BR': 'Preencher formulário de acolhimento',
            'en': 'Fill out the support form',
            'es': 'Llenar el formulario de acogida',
        },
        'hero-btn-more': {
            'pt-BR': 'Saiba mais',
            'en': 'Learn more',
            'es': 'Saber más',
        },

        // ── Sobre ──
        'sobre-titulo': {
            'pt-BR': 'Sobre o Projeto',
            'en': 'About the Project',
            'es': 'Sobre el Proyecto',
        },
        'card1-titulo': {
            'pt-BR': 'Respeito à Fé',
            'en': 'Respect for Faith',
            'es': 'Respeto a la Fe',
        },
        'card1-texto': {
            'pt-BR': 'O acolhimento <b>não substitui</b> o atendimento psicológico, psiquiátrico ou jurídico, mas atua como um <b>importante suporte</b> complementar. <b>Respeitamos</b> a dimensão espiritual e as convicções individuais de cada pessoa, sem qualquer imposição religiosa. Nosso objetivo é <b>fortalecer a esperança</b>, promover o <b>equilíbrio emocional</b> e <b>apoiar o desenvolvimento pessoal</b> e a recuperação de acordo com a fé ou visão de mundo de cada um.',
            'en': 'The support <b>does not replace</b> psychological, psychiatric or legal care, but acts as an <b>important complementary support</b>. We <b>respect</b> the spiritual dimension and individual convictions of each person, without any religious imposition. Our goal is to <b>strengthen hope</b>, promote <b>emotional balance</b> and <b>support personal development</b> and recovery according to each person\'s faith or worldview.',
            'es': 'La acogida <b>no sustituye</b> la atención psicológica, psiquiátrica o jurídica, sino que actúa como un <b>importante apoyo complementario</b>. <b>Respetamos</b> la dimensión espiritual y las convicciones individuales de cada persona, sin imposición religiosa alguna. Nuestro objetivo es <b>fortalecer la esperanza</b>, promover el <b>equilibrio emocional</b> y <b>apoyar el desarrollo personal</b> y la recuperación según la fe o visión del mundo de cada uno.',
        },
        'card2-titulo': {
            'pt-BR': 'Gratuito e Sigiloso',
            'en': 'Free and Confidential',
            'es': 'Gratuito y Confidencial',
        },
        'card2-texto': {
            'pt-BR': 'Nosso atendimento é 100% online, totalmente gratuito e estritamente sigiloso. Você tem direito a três sessões de acolhimento. Suas informações nunca serão compartilhadas.',
            'en': 'Our service is 100% online, completely free and strictly confidential. You are entitled to three support sessions. Your information will never be shared.',
            'es': 'Nuestra atención es 100% online, totalmente gratuita y estrictamente confidencial. Tiene derecho a tres sesiones de acogida. Su información nunca será compartida.',
        },
        'card3-titulo': {
            'pt-BR': 'Equipe Qualificada',
            'en': 'Qualified Team',
            'es': 'Equipo Calificado',
        },
        'card3-texto': {
            'pt-BR': 'Profissionais e estudiosos da saúde mental preparados para oferecer uma escuta ética, empática e cuidadosa — respeitando o ritmo e a história de cada pessoa.',
            'en': 'Mental health professionals and scholars prepared to offer ethical, empathetic and careful listening — respecting each person\'s pace and history.',
            'es': 'Profesionales y estudiosos de la salud mental preparados para ofrecer una escucha ética, empática y cuidadosa — respetando el ritmo y la historia de cada persona.',
        },
        'sobre-frase': {
            'pt-BR': '"Um gesto simples pode abrir caminhos de cuidado,<br>e novas histórias podem começar a ser escritas."',
            'en': '"A simple gesture can open paths of care,<br>and new stories can begin to be written."',
            'es': '"Un gesto simple puede abrir caminos de cuidado,<br>y nuevas historias pueden comenzar a escribirse."',
        },

        // ── Equipe ──
        'equipe-titulo': {
            'pt-BR': 'Nossos Profissionais',
            'en': 'Our Professionals',
            'es': 'Nuestros Profesionales',
        },
        'equipe-subtitulo': {
            'pt-BR': 'Cada profissional é direcionado de acordo com o seu perfil e necessidade.',
            'en': 'Each professional is assigned according to your profile and needs.',
            'es': 'Cada profesional es asignado según su perfil y necesidad.',
        },

        // Matheus
        'matheus-desc': {
            'pt-BR': '<b>Acolhimento para homens</b> que vivenciam ou vivenciaram violência doméstica no casamento, que estão divorciados ou em processo de separação, e também para aqueles que sofreram abuso sexual em qualquer fase da vida, fora do contexto conjugal.',
            'en': '<b>Support for men</b> who are experiencing or have experienced domestic violence in marriage, who are divorced or in the process of separation, and also for those who have suffered sexual abuse at any stage of life, outside the marital context.',
            'es': '<b>Acogida para hombres</b> que viven o han vivido violencia doméstica en el matrimonio, que están divorciados o en proceso de separación, y también para aquellos que han sufrido abuso sexual en cualquier etapa de la vida, fuera del contexto conyugal.',
        },
        'matheus-tag': {
            'pt-BR': 'Homens',
            'en': 'Men',
            'es': 'Hombres',
        },

        // Agda & Gabriela
        'agda-gabriela-desc': {
            'pt-BR': '<b>Acolhimento, apoio emocional e escuta segura</b> para mulheres que vivenciam — ou já vivenciaram — violência doméstica, crises no relacionamento conjugal, divórcio ou que estão em processo de separação.',
            'en': '<b>Support, emotional care and safe listening</b> for women who are experiencing — or have experienced — domestic violence, marital relationship crises, divorce or who are in the process of separation.',
            'es': '<b>Acogida, apoyo emocional y escucha segura</b> para mujeres que viven — o han vivido — violencia doméstica, crisis en la relación conyugal, divorcio o que están en proceso de separación.',
        },
        'agda-gabriela-tag': {
            'pt-BR': 'Mulheres',
            'en': 'Women',
            'es': 'Mujeres',
        },

        // Kelly
        'kelly-desc': {
            'pt-BR': 'Acolhimento para mulheres que já sofreram <b>abuso sexual</b> em alguma fase da vida fora do contexto do casamento.',
            'en': 'Support for women who have suffered <b>sexual abuse</b> at some stage of life outside the context of marriage.',
            'es': 'Acogida para mujeres que han sufrido <b>abuso sexual</b> en alguna etapa de la vida fuera del contexto del matrimonio.',
        },
        'kelly-tag': {
            'pt-BR': 'Especialista em atendimento a vítimas de Abuso',
            'en': 'Specialist in care for victims of abuse',
            'es': 'Especialista en atención a víctimas de abuso',
        },

        'equipe-aviso': {
            'pt-BR': 'O contato com os profissionais será feito logo após o preenchimento do formulário de triagem abaixo, garantindo que você seja direcionado à pessoa mais indicada para o seu momento.',
            'en': 'Contact with the professionals will be made right after filling out the screening form below, ensuring you are directed to the most suitable person for your situation.',
            'es': 'El contacto con los profesionales se realizará inmediatamente después de llenar el formulario de selección a continuación, garantizando que sea dirigido a la persona más indicada para su momento.',
        },

        // ── Formulário ──
        'form-titulo': {
            'pt-BR': 'Formulário de Acolhimento',
            'en': 'Support Form',
            'es': 'Formulario de Acogida',
        },
        'form-desc': {
            'pt-BR': 'Preencha em um ambiente privado, seguro e tranquilo. Todas as informações são sigilosas e o atendimento é <strong class="text-brand-dark">totalmente gratuito</strong>.',
            'en': 'Fill it out in a private, safe and calm environment. All information is confidential and the service is <strong class="text-brand-dark">completely free</strong>.',
            'es': 'Llénalo en un ambiente privado, seguro y tranquilo. Toda la información es confidencial y la atención es <strong class="text-brand-dark">totalmente gratuita</strong>.',
        },
        'form-legend': {
            'pt-BR': 'Escolha seu Perfil de atendimento *',
            'en': 'Choose your Support Profile *',
            'es': 'Elija su Perfil de atención *',
        },
        'form-perfil-masculino-titulo': {
            'pt-BR': 'Acolhimento masculino',
            'en': 'Men\'s support',
            'es': 'Acogida masculina',
        },
        'form-perfil-masculino-item1': {
            'pt-BR': 'Violência doméstica',
            'en': 'Domestic violence',
            'es': 'Violencia doméstica',
        },
        'form-perfil-masculino-item2': {
            'pt-BR': 'Divórcio',
            'en': 'Divorce',
            'es': 'Divorcio',
        },
        'form-perfil-masculino-item3': {
            'pt-BR': 'Vítima de abuso sexual',
            'en': 'Victim of sexual abuse',
            'es': 'Víctima de abuso sexual',
        },
        'form-perfil-feminino-titulo': {
            'pt-BR': 'Acolhimento feminino',
            'en': 'Women\'s support',
            'es': 'Acogida femenina',
        },
        'form-perfil-feminino-item1': {
            'pt-BR': 'Violência doméstica',
            'en': 'Domestic violence',
            'es': 'Violencia doméstica',
        },
        'form-perfil-feminino-item2': {
            'pt-BR': 'Divórcio',
            'en': 'Divorce',
            'es': 'Divorcio',
        },
        'form-perfil-abuso-titulo': {
            'pt-BR': 'Mulher',
            'en': 'Woman',
            'es': 'Mujer',
        },
        'form-perfil-abuso-desc': {
            'pt-BR': 'Vítima de abuso sexual fora do casamento',
            'en': 'Victim of sexual abuse outside of marriage',
            'es': 'Víctima de abuso sexual fuera del matrimonio',
        },
        'form-aviso-abuso': {
            'pt-BR': '🛡️ <strong>Você pode usar um codinome ou pseudônimo</strong> no campo de nome abaixo — sua identidade real não é obrigatória. Seu sigilo e segurança são nossa prioridade absoluta.',
            'en': '🛡️ <strong>You may use a codename or pseudonym</strong> in the name field below — your real identity is not required. Your confidentiality and safety are our absolute priority.',
            'es': '🛡️ <strong>Puede usar un apodo o seudónimo</strong> en el campo de nombre a continuación — su identidad real no es obligatoria. Su confidencialidad y seguridad son nuestra prioridad absoluta.',
        },
        'form-label-nome': {
            'pt-BR': 'Nome completo *',
            'en': 'Full name *',
            'es': 'Nombre completo *',
        },
        'form-label-nome-codinome': {
            'pt-BR': 'Nome ou codinome <span class="font-normal text-brand-soft/70">(pseudônimo permitido)</span> *',
            'en': 'Name or codename <span class="font-normal text-brand-soft/70">(pseudonym allowed)</span> *',
            'es': 'Nombre o apodo <span class="font-normal text-brand-soft/70">(seudónimo permitido)</span> *',
        },
        'form-placeholder-nome': {
            'pt-BR': 'Como gostaria de ser chamado(a)',
            'en': 'What would you like to be called?',
            'es': '¿Cómo le gustaría ser llamado(a)?',
        },
        'form-nascimento': {
            'pt-BR': 'Data de nascimento *',
            'en': 'Date of birth *',
            'es': 'Fecha de nacimiento *',
        },
        'form-cidade': {
            'pt-BR': 'Cidade *',
            'en': 'City *',
            'es': 'Ciudad *',
        },
        'form-placeholder-cidade': {
            'pt-BR': 'Ex: Porto Alegre',
            'en': 'E.g.: São Paulo',
            'es': 'Ej.: Porto Alegre',
        },
        'form-estado': {
            'pt-BR': 'Estado *',
            'en': 'State *',
            'es': 'Estado *',
        },
        'form-placeholder-estado': {
            'pt-BR': 'Selecione o estado...',
            'en': 'Select the state...',
            'es': 'Seleccione el estado...',
        },
        'form-whatsapp': {
            'pt-BR': 'WhatsApp *',
            'en': 'WhatsApp *',
            'es': 'WhatsApp *',
        },
        'form-placeholder-whatsapp': {
            'pt-BR': '(00) 9 0000-0000',
            'en': '+55 (00) 9 0000-0000',
            'es': '(00) 9 0000-0000',
        },
        'form-estado-civil': {
            'pt-BR': 'Estado civil *',
            'en': 'Marital status *',
            'es': 'Estado civil *',
        },
        'form-placeholder-estado-civil': {
            'pt-BR': 'Selecione...',
            'en': 'Select...',
            'es': 'Seleccione...',
        },
        'form-rede-apoio': {
            'pt-BR': 'Tem rede de apoio? *',
            'en': 'Do you have a support network? *',
            'es': '¿Tiene red de apoyo? *',
        },
        'form-placeholder-rede-apoio': {
            'pt-BR': 'Selecione...',
            'en': 'Select...',
            'es': 'Seleccione...',
        },
        'form-horario': {
            'pt-BR': 'Preferência de horário * (Atendimento 100% online)',
            'en': 'Preferred time * (100% online service)',
            'es': 'Preferencia de horario * (Atención 100% online)',
        },
        'form-placeholder-horario': {
            'pt-BR': 'Selecione...',
            'en': 'Select...',
            'es': 'Seleccione...',
        },
        'form-motivo': {
            'pt-BR': 'O que te traz para o acolhimento nesse momento? *',
            'en': 'What brings you to seek support at this time? *',
            'es': '¿Qué te trae a la acogida en este momento? *',
        },
        'form-placeholder-motivo': {
            'pt-BR': 'Escreva com suas próprias palavras, sem pressa. Não há resposta certa ou errada.',
            'en': 'Write in your own words, take your time. There is no right or wrong answer.',
            'es': 'Escribe con tus propias palabras, sin prisa. No hay respuesta correcta o incorrecta.',
        },
        'form-termos-titulo': {
            'pt-BR': 'Termos de consentimento',
            'en': 'Terms of consent',
            'es': 'Términos de consentimiento',
        },
        'form-termo-sigilo': {
            'pt-BR': 'Compreendo que o acolhimento não substitui tratamento psicológico contínuo, e que todas as informações serão mantidas em <strong class="text-brand-dark">sigilo profissional absoluto</strong>. *',
            'en': 'I understand that the support does not replace continuous psychological treatment, and that all information will be kept in <strong class="text-brand-dark">absolute professional confidentiality</strong>. *',
            'es': 'Comprendo que la acogida no sustituye el tratamiento psicológico continuo, y que toda la información se mantendrá en <strong class="text-brand-dark">absoluto sigilo profesional</strong>. *',
        },
        'form-termo-sessoes': {
            'pt-BR': 'Estou ciente de que o acolhimento oferecido pelo Ministério Acolher compreende <strong class="text-brand-dark">três sessões de aproximadamente 50 minutos</strong> cada. Caso deseje continuar o processo terapêutico após esse período, poderei fazê-lo mediante acordo direto com o profissional que me atenderá. *',
            'en': 'I am aware that the support offered by Ministério Acolher comprises <strong class="text-brand-dark">three sessions of approximately 50 minutes</strong> each. If I wish to continue the therapeutic process after this period, I may do so by direct agreement with the professional who will assist me. *',
            'es': 'Soy consciente de que la acogida ofrecida por Ministério Acolher comprende <strong class="text-brand-dark">tres sesiones de aproximadamente 50 minutos</strong> cada una. Si deseo continuar el proceso terapéutico después de este período, podré hacerlo mediante acuerdo directo con el profesional que me atenderá. *',
        },
        'form-termo-gratuidade': {
            'pt-BR': 'Compreendo que o atendimento do Ministério Acolher é <strong class="text-brand-dark">totalmente gratuito</strong> e que tenho direito a três sessões de acolhimento.*',
            'en': 'I understand that the service of Ministério Acolher is <strong class="text-brand-dark">completely free</strong> and that I am entitled to three support sessions.*',
            'es': 'Comprendo que la atención de Ministério Acolher es <strong class="text-brand-dark">totalmente gratuita</strong> y que tengo derecho a tres sesiones de acogida.*',
        },
        'form-btn-enviar': {
            'pt-BR': 'Enviar formulário de acolhimento',
            'en': 'Submit support form',
            'es': 'Enviar formulario de acogida',
        },
        'form-btn-enviando': {
            'pt-BR': 'Enviando...',
            'en': 'Sending...',
            'es': 'Enviando...',
        },

        // ── Sucesso (pós-envio) ──
        'sucesso-titulo': {
            'pt-BR': 'Formulário recebido',
            'en': 'Form received',
            'es': 'Formulario recibido',
        },
        'sucesso-desc': {
            'pt-BR': 'Suas informações foram encaminhadas com sigilo para <strong class="text-brand-dark">{profissional}</strong>, o(a) profissional mais indicado(a) para te acolher. Você será contactado(a) em breve pelo WhatsApp.',
            'en': 'Your information has been confidentially forwarded to <strong class="text-brand-dark">{profissional}</strong>, the most suitable professional to support you. You will be contacted soon via WhatsApp.',
            'es': 'Su información ha sido enviada de forma confidencial a <strong class="text-brand-dark">{profissional}</strong>, el/la profesional más indicado(a) para acogerle. Será contactado(a) pronto por WhatsApp.',
        },
        'sucesso-btn-whatsapp': {
            'pt-BR': 'Falar com {profissional}',
            'en': 'Talk to {profissional}',
            'es': 'Hablar con {profissional}',
        },
        'sucesso-rodape': {
            'pt-BR': 'O atendimento é 100% gratuito e você tem direito a três sessões de aproximadamente 40 minutos.',
            'en': 'The service is 100% free and you are entitled to three sessions of approximately 40 minutes.',
            'es': 'La atención es 100% gratuita y tiene derecho a tres sesiones de aproximadamente 40 minutos.',
        },

        // ── Erro ──
        'erro-msg': {
            'pt-BR': 'Ocorreu um erro ao enviar. Por favor, tente novamente.',
            'en': 'An error occurred while sending. Please try again.',
            'es': 'Ocurrió un error al enviar. Por favor, intente de nuevo.',
        },

        // ── Footer ──
        'footer-desc': {
            'pt-BR': 'Um espaço seguro de escuta, cuidado e respeito para quem precisa ser acolhido. Atendimento 100% online, gratuito e sigiloso.',
            'en': 'A safe space for listening, care and respect for those who need to be supported. 100% online, free and confidential service.',
            'es': 'Un espacio seguro de escucha, cuidado y respeto para quien necesita ser acogido. Atención 100% online, gratuita y confidencial.',
        },
        'footer-redes': {
            'pt-BR': 'Redes Sociais',
            'en': 'Social Media',
            'es': 'Redes Sociales',
        },
        'footer-contato-titulo': {
            'pt-BR': 'Contato Direto',
            'en': 'Direct Contact',
            'es': 'Contacto Directo',
        },
        'footer-contato-desc': {
            'pt-BR': 'Os contatos dos profissionais são disponibilizados após o preenchimento do formulário de acolhimento acima.',
            'en': 'Professional contacts are made available after filling out the support form above.',
            'es': 'Los contactos de los profesionales están disponibles después de llenar el formulario de acogida anterior.',
        },
        'footer-compartilhe-titulo': {
            'pt-BR': 'Compartilhe',
            'en': 'Share',
            'es': 'Compartir',
        },
        'footer-compartilhe-desc': {
            'pt-BR': 'Conhece alguém que poderia precisar de acolhimento? Compartilhe esse espaço.',
            'en': 'Do you know someone who could need support? Share this space.',
            'es': '¿Conoces a alguien que podría necesitar acogida? Comparte este espacio.',
        },
        'footer-btn-compartilhar': {
            'pt-BR': '📤 Compartilhar página',
            'en': '📤 Share page',
            'es': '📤 Compartir página',
        },
        'footer-link-estatisticas': {
            'pt-BR': 'Estatísticas de acesso',
            'en': 'Access statistics',
            'es': 'Estadísticas de acceso',
        },
        'footer-copyright': {
            'pt-BR': '© 2025 Ministério Acolher · Todos os direitos reservados · Atendimento sigiloso e ético',
            'en': '© 2025 Ministério Acolher · All rights reserved · Confidential and ethical service',
            'es': '© 2025 Ministério Acolher · Todos los derechos reservados · Atención confidencial y ética',
        },
        'footer-acessibilidade': {
            'pt-BR': '♿ Acessibilidade',
            'en': '♿ Accessibility',
            'es': '♿ Accesibilidad',
        },
        'footer-idioma': {
            'pt-BR': 'Idioma',
            'en': 'Language',
            'es': 'Idioma',
        },

        // ── Compartilhar ──
        'compartilhar-text': {
            'pt-BR': 'Um espaço de escuta, cuidado e respeito — atendimento gratuito e sigiloso.',
            'en': 'A space for listening, care and respect — free and confidential support.',
            'es': 'Un espacio de escucha, cuidado y respeto — atención gratuita y confidencial.',
        },
        'compartilhar-copiado': {
            'pt-BR': '✅ Link copiado!',
            'en': '✅ Link copied!',
            'es': '✅ ¡Enlace copiado!',
        },

        // ── Select de estado civil ──
        'civil-solteiro': { 'pt-BR': 'Solteira(o)', 'en': 'Single', 'es': 'Soltera(o)' },
        'civil-casado': { 'pt-BR': 'Casada(o)', 'en': 'Married', 'es': 'Casada(o)' },
        'civil-divorciado': { 'pt-BR': 'Divorciada(o)', 'en': 'Divorced', 'es': 'Divorciada(o)' },
        'civil-viuvo': { 'pt-BR': 'Viúva(o)', 'en': 'Widowed', 'es': 'Viuda(o)' },
        'civil-uniao': { 'pt-BR': 'União Estável', 'en': 'Stable Union', 'es': 'Unión Estable' },

        // ── Select rede de apoio ──
        'apoio-sim': { 'pt-BR': 'Sim (família, amigos, igreja...)', 'en': 'Yes (family, friends, church...)', 'es': 'Sí (familia, amigos, iglesia...)' },
        'apoio-parcial': { 'pt-BR': 'Parcialmente', 'en': 'Partially', 'es': 'Parcialmente' },
        'apoio-nao': { 'pt-BR': 'Não tenho rede de apoio', 'en': 'I don\'t have a support network', 'es': 'No tengo red de apoyo' },

        // ── Select horário ──
        'horario-manha': { 'pt-BR': 'Manhã', 'en': 'Morning', 'es': 'Mañana' },
        'horario-tarde': { 'pt-BR': 'Tarde', 'en': 'Afternoon', 'es': 'Tarde' },
        'horario-noite': { 'pt-BR': 'Noite', 'en': 'Evening', 'es': 'Noche' },
        'horario-domingos': { 'pt-BR': 'Domingos', 'en': 'Sundays', 'es': 'Domingos' },
    },

    // ── Obter tradução ──
    t(key, lang, replacements = {}) {
        const l = lang || this.currentLang;
        const entry = this.translations[key];
        if (!entry) return key;
        let text = entry[l] || entry['pt-BR'] || key;
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    },

    // ── Aplicar tradução na página ──
    applyTranslation(lang) {
        this.currentLang = lang;
        document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : lang;

        // Traduzir elementos com data-i18n (texto interno)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key, lang);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else if (el.tagName === 'OPTION') {
                el.textContent = text;
            } else if (el.tagName === 'META') {
                el.setAttribute('content', text);
            } else {
                el.innerHTML = text;
            }
        });

        // Traduzir placeholders com data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key, lang);
        });

        // Traduzir aria-labels
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria-label');
            el.setAttribute('aria-label', this.t(key, lang));
        });

        // Traduzir OG meta tags
        document.querySelectorAll('meta[data-i18n-content]').forEach(el => {
            const key = el.getAttribute('data-i18n-content');
            el.setAttribute('content', this.t(key, lang));
        });

        // Atualizar texto do botão de idioma ativo
        document.querySelectorAll('[data-lang-btn]').forEach(btn => {
            const btnLang = btn.getAttribute('data-lang-btn');
            btn.classList.toggle('active-lang', btnLang === lang);
            btn.setAttribute('aria-pressed', btnLang === lang ? 'true' : 'false');
        });

        // Salvar preferência
        localStorage.setItem('acolher-lang', lang);
    },

    // ── Inicializar ──
    init() {
        // Detectar idioma salvo ou preferência do navegador
        const saved = localStorage.getItem('acolher-lang');
        if (saved && this.availableLangs.includes(saved)) {
            this.currentLang = saved;
        } else {
            const browserLang = navigator.language || navigator.userLanguage || '';
            if (browserLang.startsWith('en')) {
                this.currentLang = 'en';
            } else if (browserLang.startsWith('es')) {
                this.currentLang = 'es';
            } else {
                this.currentLang = 'pt-BR';
            }
        }

        this.applyTranslation(this.currentLang);
    }
};

// ─── Inicializar quando o DOM estiver pronto ──
document.addEventListener('DOMContentLoaded', () => I18N.init());
