// 🚨 NOVO: Funcionalidades para Pedidos Urgentes, Times Locais e Projetos de Time
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('jwtToken');
    const userId = localStorage.getItem('userId');
    const userType = localStorage.getItem('userType');

    // Função para abrir modal de imagem flutuante (tornada global)
    window.abrirModalImagem = function abrirModalImagem(fotoUrl) {
        // Verificar se a URL é válida e não é um avatar
        if (!fotoUrl || 
            typeof fotoUrl !== 'string' ||
            fotoUrl.includes('avatar') || 
            fotoUrl.includes('default-user') ||
            fotoUrl.includes('perfil') ||
            fotoUrl === '' ||
            fotoUrl === 'undefined' ||
            fotoUrl.trim() === '') {
            console.warn('⚠️ Tentativa de abrir modal com URL inválida ou avatar:', fotoUrl);
            return;
        }
        
        // Verificar se estamos na página de perfil - se sim, não abrir modal
        if (window.location.pathname.includes('/perfil') || window.location.pathname.includes('perfil.html')) {
            console.warn('⚠️ Tentativa de abrir modal na página de perfil - ignorando');
            return;
        }
        
        console.log('🖼️ Abrindo modal de imagem:', fotoUrl);
        const modalImagem = document.getElementById('image-modal-pedido');
        const imagemModal = document.getElementById('modal-image-pedido');
        const btnFecharModal = document.getElementById('close-image-modal-pedido');
        
        console.log('🔍 Elementos do modal:', {
            modalImagem: !!modalImagem,
            imagemModal: !!imagemModal,
            btnFecharModal: !!btnFecharModal
        });
        
        if (modalImagem && imagemModal && fotoUrl) {
            imagemModal.src = fotoUrl;
            
            // Remover classe hidden
            modalImagem.classList.remove('hidden');
            
            // Forçar display e visibilidade via style inline também
            modalImagem.style.display = 'flex';
            modalImagem.style.opacity = '1';
            modalImagem.style.visibility = 'visible';
            modalImagem.style.zIndex = '10001';
            
            document.body.style.overflow = 'hidden';
            
            console.log('✅ Modal aberto');
            console.log('🔍 Estado do modal:', {
                hasHidden: modalImagem.classList.contains('hidden'),
                display: window.getComputedStyle(modalImagem).display,
                opacity: window.getComputedStyle(modalImagem).opacity,
                visibility: window.getComputedStyle(modalImagem).visibility,
                zIndex: window.getComputedStyle(modalImagem).zIndex
            });
        } else {
            console.error('❌ Elementos do modal não encontrados ou URL inválida');
        }
    };

    // Fechar modal ao clicar no X ou fora da imagem
    const modalImagem = document.getElementById('image-modal-pedido');
    const btnFecharModal = document.getElementById('close-image-modal-pedido');
    
    function fecharModalImagem() {
        const modal = document.getElementById('image-modal-pedido');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            modal.style.opacity = '0';
            modal.style.visibility = 'hidden';
            document.body.style.overflow = '';
            console.log('✅ Modal de imagem fechado');
        }
    }
    
    window.fecharModalImagem = fecharModalImagem;
    
    if (btnFecharModal) {
        // Remover listeners anteriores se existirem
        const novoBtnFechar = btnFecharModal.cloneNode(true);
        btnFecharModal.parentNode.replaceChild(novoBtnFechar, btnFecharModal);
        
        novoBtnFechar.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('❌ Botão X clicado - fechando modal');
            fecharModalImagem();
        }, true); // Capture phase para executar primeiro
        
        // Também adicionar onclick direto como fallback
        novoBtnFechar.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            e.stopImmediatePropagation();
            console.log('❌ Botão X (onclick) clicado - fechando modal');
            fecharModalImagem();
            return false;
        };
    }
    
    if (modalImagem) {
        // Remover listener anterior se existir e adicionar novo
        const novoModal = modalImagem.cloneNode(true);
        modalImagem.parentNode.replaceChild(novoModal, modalImagem);
        
        novoModal.addEventListener('click', (e) => {
            // Fechar se clicar no overlay ou no próprio modal (não na imagem)
            if (e.target === novoModal || 
                e.target.classList.contains('image-modal-overlay') ||
                e.target.id === 'image-modal-pedido' ||
                e.target.classList.contains('close-btn-modal')) {
                e.stopPropagation();
                e.preventDefault();
                console.log('🖼️ Clicou no overlay - fechando modal');
                fecharModalImagem();
            }
        });
        
        // Reconfigurar o botão de fechar após clonar
        const novoBtnFechar = document.getElementById('close-image-modal-pedido');
        if (novoBtnFechar) {
            novoBtnFechar.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                console.log('❌ Botão X clicado (overlay) - fechando modal');
                fecharModalImagem();
            }, true);
        }
        
        // Garantir que o modal comece fechado quando a página carrega, especialmente na página de perfil
        setTimeout(() => {
            if (modalImagem && !modalImagem.classList.contains('hidden')) {
                const imagemModal = document.getElementById('modal-image-pedido');
                if (!imagemModal || !imagemModal.src || imagemModal.src === '' || 
                    imagemModal.src.includes('avatar') || 
                    window.location.pathname.includes('/perfil') ||
                    window.location.pathname.includes('perfil.html')) {
                    fecharModalImagem();
                }
            }
        }, 100);
    }

    // Usar delegação de eventos para garantir que funcione mesmo com elementos carregados dinamicamente
    // IMPORTANTE: Não capturar cliques em avatares de perfil ou nomes de clientes
    // Usar bubble phase (false) para que listeners específicos executem primeiro na fase de captura
    document.addEventListener('click', (e) => {
        // PRIMEIRA VERIFICAÇÃO: Se o clique foi em um avatar de perfil, nome de cliente ou qualquer elemento relacionado
        const avatarClickable = e.target.closest('.clickable-avatar, .avatar-pequeno-pedido, .nome-cliente-clickable');
        if (avatarClickable) {
            console.log('🚫 Clique em avatar/nome detectado - ignorando modal de foto');
            return; // Não fazer nada, deixa o listener do avatar/nome processar
        }
        
        // SEGUNDA VERIFICAÇÃO: Se o elemento clicado diretamente é um avatar ou nome
        if (e.target.classList.contains('clickable-avatar') || 
            e.target.classList.contains('avatar-pequeno-pedido') ||
            e.target.classList.contains('nome-cliente-clickable')) {
            console.log('🚫 Elemento é avatar/nome - ignorando modal de foto');
            return;
        }
        
        // TERCEIRA VERIFICAÇÃO: Verificar se o elemento clicado está dentro de um container de avatar/nome
        const parentAvatar = e.target.closest('.pedido-cliente-header');
        if (parentAvatar) {
            // Se está dentro do header do cliente, verificar se é um avatar ou nome
            const isAvatarOrName = e.target.closest('.clickable-avatar, .avatar-pequeno-pedido, .nome-cliente-clickable');
            if (isAvatarOrName) {
                console.log('🚫 Clique dentro do header do cliente (avatar/nome) - ignorando modal de foto');
                return;
            }
            // Se é uma imagem dentro do header, verificar se é avatar
            if (e.target.tagName === 'IMG' || e.target.closest('img')) {
                const img = e.target.tagName === 'IMG' ? e.target : e.target.closest('img');
                if (img && (img.classList.contains('clickable-avatar') || img.classList.contains('avatar-pequeno-pedido'))) {
                    console.log('🚫 Imagem dentro de header de cliente - ignorando modal de foto');
                    return;
                }
            }
        }
        
        // QUARTA VERIFICAÇÃO: Verificar se o clique foi em uma foto de serviço (apenas fotos de serviço, não avatares)
        const fotoClickable = e.target.closest('.foto-pedido-clickable');
        if (fotoClickable) {
            // Verificar se não é um avatar ou nome de cliente
            const isAvatar = fotoClickable.classList.contains('clickable-avatar') || 
                           fotoClickable.classList.contains('avatar-pequeno-pedido') ||
                           fotoClickable.classList.contains('nome-cliente-clickable') ||
                           fotoClickable.closest('.clickable-avatar') ||
                           fotoClickable.closest('.avatar-pequeno-pedido') ||
                           fotoClickable.closest('.nome-cliente-clickable') ||
                           fotoClickable.closest('.pedido-cliente-header');
            
            if (!isAvatar) {
                const fotoUrl = fotoClickable.dataset.fotoUrl || fotoClickable.src;
                // Validar URL antes de abrir modal
                if (fotoUrl && 
                    !fotoUrl.includes('avatar') && 
                    !fotoUrl.includes('default-user') &&
                    fotoUrl !== '' &&
                    fotoUrl !== 'undefined') {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🖼️ Clicou na foto (delegação):', fotoUrl);
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(fotoUrl);
                    } else {
                        console.error('❌ Função abrirModalImagem não encontrada');
                    }
                } else {
                    console.warn('⚠️ URL de foto inválida ou é avatar:', fotoUrl);
                }
            } else {
                console.log('🚫 Foto clicável é avatar - ignorando modal');
            }
        }
    }, false); // Bubble phase - executa DEPOIS dos listeners na fase de captura

    // Utilitário para cachear fotos de pedidos (para usar no lembrete de avaliação)
    function cacheFotoPedidoGenerico(src, pid) {
        if (!src) return;
        localStorage.setItem('ultimaFotoPedido', src);
        localStorage.setItem('fotoUltimoServicoConcluido', src);
        sessionStorage.setItem('ultimaFotoPedido', src);
        if (pid) {
            const pidClean = String(pid).match(/[a-fA-F0-9]{24}/)?.[0];
            if (pidClean) {
                localStorage.setItem(`fotoPedido:${pidClean}`, src);
                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                sessionStorage.setItem(`fotoPedido:${pidClean}`, src);
            }
        }
    }

    // Captura imagens de pedidos carregadas em qualquer modal/lista
    // (roda após o DOM pronto; também escuta carregamentos futuros de <img>)
    Array.from(document.querySelectorAll('img[src*="pedidos-urgentes"]')).forEach(img => {
        cacheFotoPedidoGenerico(img.src);
    });
    document.addEventListener('load', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.src && t.src.includes('pedidos-urgentes')) {
            cacheFotoPedidoGenerico(t.src);
        }
    }, true);

    // ============================================
    // PEDIDOS URGENTES ("Preciso Agora!")
    // ============================================
    
    const modalPedidoUrgente = document.getElementById('modal-pedido-urgente');
    const formPedidoUrgente = document.getElementById('form-pedido-urgente');
    const btnProcurarClientes = document.getElementById('btn-procurar-clientes');
    const modalPrecisoAgora = document.getElementById('modal-preciso-agora');
    const btnLocalizacaoTempoReal = document.getElementById('btn-localizacao-tempo-real');

    // Controles de tipo de atendimento (Urgente x Agendado)
    const radioTipoUrgente = document.getElementById('pedido-tipo-urgente');
    const radioTipoAgendado = document.getElementById('pedido-tipo-agendado');
    const grupoPrazoUrgente = document.getElementById('grupo-prazo-urgente');
    const grupoAgendamento = document.getElementById('grupo-agendamento');
    const inputDataAgendamento = document.getElementById('pedido-data'); // hidden
    const inputHoraAgendamento = document.getElementById('pedido-hora'); // hidden
    const inputDataDisplay = document.getElementById('pedido-data-display');
    const inputHoraDisplay = document.getElementById('pedido-hora-display');
    const popupCalendario = document.getElementById('popup-calendario-agendamento');
    const popupHorario = document.getElementById('popup-horario-agendamento');
    const calLabelMes = document.getElementById('cal-label-mes');
    const calDiasContainer = document.getElementById('cal-dias-container');
    const listaHorariosAgendamento = document.getElementById('lista-horarios-agendamento');
    const btnCalPrevMes = document.getElementById('cal-prev-mes');
    const btnCalNextMes = document.getElementById('cal-next-mes');

    let calDataAtual = new Date();
    let calDataSelecionada = null;
    let horarioSelecionado = null;

    function atualizarVisibilidadeTipoAtendimento() {
        const modoAgendado = !!(radioTipoAgendado && radioTipoAgendado.checked);
        if (grupoPrazoUrgente) {
            grupoPrazoUrgente.style.display = modoAgendado ? 'none' : 'block';
        }
        if (grupoAgendamento) {
            grupoAgendamento.style.display = modoAgendado ? 'block' : 'none';
        }
    }

    if (radioTipoUrgente && radioTipoAgendado) {
        radioTipoUrgente.addEventListener('change', atualizarVisibilidadeTipoAtendimento);
        radioTipoAgendado.addEventListener('change', atualizarVisibilidadeTipoAtendimento);
        atualizarVisibilidadeTipoAtendimento();
    }

    // ===== Calendário e horários customizados =====
    function formatarDataISO(date) {
        const ano = date.getFullYear();
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const dia = String(date.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    }

    function formatarDataBR(date) {
        return date.toLocaleDateString('pt-BR');
    }

    function renderizarCalendario() {
        if (!popupCalendario || !calDiasContainer || !calLabelMes) return;

        const ano = calDataAtual.getFullYear();
        const mes = calDataAtual.getMonth(); // 0-11

        calLabelMes.textContent = calDataAtual.toLocaleDateString('pt-BR', {
            month: 'long',
            year: 'numeric'
        });

        calDiasContainer.innerHTML = '';

        const primeiroDiaMes = new Date(ano, mes, 1);
        const diaSemanaPrimeiro = primeiroDiaMes.getDay(); // 0=Dom

        const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

        const hoje = new Date();
        const hojeISO = formatarDataISO(hoje);
        const selecionadaISO = calDataSelecionada ? formatarDataISO(calDataSelecionada) : null;

        // Preenche espaços vazios antes do dia 1
        for (let i = 0; i < diaSemanaPrimeiro; i++) {
            const span = document.createElement('div');
            span.className = 'agendamento-dia outro-mes';
            calDiasContainer.appendChild(span);
        }

        for (let dia = 1; dia <= ultimoDiaMes; dia++) {
            const dataDia = new Date(ano, mes, dia);
            const dataISO = formatarDataISO(dataDia);

            const span = document.createElement('div');
            span.className = 'agendamento-dia';
            span.textContent = String(dia);

            if (dataISO === hojeISO) {
                span.classList.add('hoje');
            }
            if (selecionadaISO && dataISO === selecionadaISO) {
                span.classList.add('selecionado');
            }

            span.addEventListener('click', () => {
                calDataSelecionada = dataDia;
                if (inputDataAgendamento) {
                    inputDataAgendamento.value = dataISO;
                }
                if (inputDataDisplay) {
                    inputDataDisplay.value = formatarDataBR(dataDia);
                }
                popupCalendario?.classList.add('hidden');
                renderizarCalendario();
            });

            calDiasContainer.appendChild(span);
        }
    }

    function gerarHorarios() {
        if (!listaHorariosAgendamento) return;
        listaHorariosAgendamento.innerHTML = '';

        const horarios = [];
        for (let hora = 6; hora <= 22; hora++) {
            ['00', '30'].forEach(min => {
                horarios.push(`${String(hora).padStart(2, '0')}:${min}`);
            });
        }

        horarios.forEach(horario => {
            const div = document.createElement('div');
            div.className = 'agendamento-horario-item';
            div.textContent = horario;

            if (horarioSelecionado === horario) {
                div.classList.add('selecionado');
            }

            div.addEventListener('click', () => {
                horarioSelecionado = horario;
                if (inputHoraAgendamento) {
                    inputHoraAgendamento.value = horario;
                }
                if (inputHoraDisplay) {
                    inputHoraDisplay.value = horario;
                }

                document
                    .querySelectorAll('.agendamento-horario-item.selecionado')
                    .forEach(el => el.classList.remove('selecionado'));
                div.classList.add('selecionado');

                popupHorario?.classList.add('hidden');
            });

            listaHorariosAgendamento.appendChild(div);
        });
    }

    // Navegação do calendário
    if (btnCalPrevMes) {
        btnCalPrevMes.addEventListener('click', () => {
            calDataAtual.setMonth(calDataAtual.getMonth() - 1);
            renderizarCalendario();
        });
    }
    if (btnCalNextMes) {
        btnCalNextMes.addEventListener('click', () => {
            calDataAtual.setMonth(calDataAtual.getMonth() + 1);
            renderizarCalendario();
        });
    }

    // Abertura dos popups ao clicar nos campos visíveis
    if (inputDataDisplay && popupCalendario) {
        inputDataDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = inputDataDisplay.getBoundingClientRect();
            popupCalendario.style.left = rect.left + 'px';
            popupCalendario.style.top = (rect.bottom + window.scrollY) + 'px';
            popupCalendario.classList.remove('hidden');
            renderizarCalendario();
            popupHorario?.classList.add('hidden');
        });
    }

    if (inputHoraDisplay && popupHorario) {
        inputHoraDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = inputHoraDisplay.getBoundingClientRect();
            popupHorario.style.left = rect.left + 'px';
            popupHorario.style.top = (rect.bottom + window.scrollY) + 'px';
            popupHorario.classList.remove('hidden');
            gerarHorarios();
            popupCalendario?.classList.add('hidden');
        });
    }

    // Fechar popups ao clicar fora
    document.addEventListener('click', (e) => {
        if (popupCalendario && !popupCalendario.contains(e.target) && e.target !== inputDataDisplay) {
            popupCalendario.classList.add('hidden');
        }
        if (popupHorario && !popupHorario.contains(e.target) && e.target !== inputHoraDisplay) {
            popupHorario.classList.add('hidden');
        }
    });

    // Botão "Procurar Clientes" dentro do modal de profissionais próximos
    // Disponível para todos os usuários (profissionais também podem precisar de outros profissionais)
    if (btnProcurarClientes) {
        btnProcurarClientes.addEventListener('click', () => {
            // Fecha o modal de profissionais próximos
            if (modalPrecisoAgora) {
                modalPrecisoAgora.classList.add('hidden');
            }
            // Abre o modal de pedido urgente
            if (modalPedidoUrgente) {
                modalPedidoUrgente.classList.remove('hidden');
                if (typeof atualizarVisibilidadeTipoAtendimento === 'function') {
                    atualizarVisibilidadeTipoAtendimento();
                }
            }
        });
    }

    // Preview de fotos do pedido urgente (múltiplas imagens)
    const inputFotoPedido = document.getElementById('pedido-foto');
    const btnAdicionarFotoPedido = document.getElementById('btn-adicionar-foto-pedido');
    const previewFotosContainer = document.getElementById('preview-fotos-pedido');
    const previewFotoPedido = document.getElementById('preview-foto-pedido'); // fallback legado
    const imgPreviewPedido = document.getElementById('img-preview-pedido');   // fallback legado
    const fotosSelecionadas = [];

    function atualizarVisibilidadeBotoesFoto() {
        const maxFotos = 4;
        const atingiuLimite = fotosSelecionadas.length >= maxFotos;

        // Só temos o botão "+" agora. Ele fica visível sempre, até atingir o limite.
        if (btnAdicionarFotoPedido) {
            btnAdicionarFotoPedido.style.display = (!atingiuLimite) ? 'inline-flex' : 'none';
        }
    }

    function limparFotosPedido() {
        fotosSelecionadas.length = 0;
        if (previewFotosContainer) {
            previewFotosContainer.innerHTML = '';
        }
        if (previewFotoPedido) previewFotoPedido.style.display = 'none';
        if (imgPreviewPedido) imgPreviewPedido.src = '';
        atualizarVisibilidadeBotoesFoto();
    }

    function criarThumbnailFoto(file, index) {
        if (!previewFotosContainer) return;

        const item = document.createElement('div');
        item.className = 'pedido-foto-item';
        item.dataset.index = String(index);

        const img = document.createElement('img');
        img.alt = 'Foto do serviço';

        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'pedido-foto-remove';
        btnRemover.innerHTML = '&times;';

        item.appendChild(img);
        item.appendChild(btnRemover);
        previewFotosContainer.appendChild(item);

                const reader = new FileReader();
                reader.onload = (event) => {
            img.src = event.target.result;
                };
                reader.readAsDataURL(file);

        btnRemover.addEventListener('click', () => {
            const fileIndex = fotosSelecionadas.indexOf(file);
            if (fileIndex !== -1) {
                fotosSelecionadas.splice(fileIndex, 1);
            }
            item.remove();
            atualizarVisibilidadeBotoesFoto();
            if (inputFotoPedido && fotosSelecionadas.length === 0) {
                inputFotoPedido.value = '';
            }
        });
    }

    if (btnAdicionarFotoPedido && inputFotoPedido) {
        const abrirSeletor = () => inputFotoPedido.click();

        btnAdicionarFotoPedido.addEventListener('click', abrirSeletor);

        inputFotoPedido.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            const maxFotos = 4;
            const fotosRestantes = maxFotos - fotosSelecionadas.length;

            files.forEach((file) => {
                // Limita a 4 imagens no total
                if (fotosSelecionadas.length >= maxFotos) {
                    return;
                }
                
                // Evita duplicar a mesma referência de arquivo
                if (!fotosSelecionadas.includes(file)) {
                    fotosSelecionadas.push(file);
                    criarThumbnailFoto(file, fotosSelecionadas.length - 1);
                }
            });

            atualizarVisibilidadeBotoesFoto();
            // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
            if (inputFotoPedido) {
                inputFotoPedido.value = '';
            }
        });
    }

    const inputServicoPedido = document.getElementById('pedido-servico');

    // Cacheia nome do serviço durante digitação
    if (inputServicoPedido) {
        inputServicoPedido.addEventListener('input', () => {
            const val = inputServicoPedido.value || '';
            try {
                localStorage.setItem('ultimoServicoNome', val);
                localStorage.setItem('ultimaDescricaoPedido', val);
                localStorage.setItem('ultimaDemanda', val);
            } catch (e) {
                console.warn('Falha ao cachear serviço (input)', e);
            }
        });
    }

    // Função para usar localização em tempo real
    async function usarLocalizacaoTempoReal() {
        if (!btnLocalizacaoTempoReal) return;
        
        const btn = btnLocalizacaoTempoReal;
        const estadoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Obtendo localização...';
        
        try {
            // Solicita permissão de geolocalização
            if (!navigator.geolocation) {
                throw new Error('Geolocalização não é suportada pelo seu navegador.');
            }
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude, accuracy } = position.coords;
            console.log('📍 Coordenadas obtidas:', latitude, longitude, '| accuracy(m):', accuracy);
            
            // Usa API de geocodificação reversa através do backend (proxy para evitar CORS)
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando endereço...';
            
            const response = await fetch(`/api/geocodificar-reversa?lat=${latitude}&lon=${longitude}&accuracy=${encodeURIComponent(accuracy)}&_=${Date.now()}`, {
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error('Erro ao buscar endereço.');
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erro ao buscar endereço.');
            }
            
            const data = result.data;
            const address = data.address || {};
            const displayName = data.display_name || '';
            
            console.log('📍 Endereço obtido:', address);
            console.log('📍 Display name:', displayName);
            console.log('📍 Dados completos da API:', JSON.stringify(data, null, 2));
            
            // Verifica se o Nominatim retornou apenas bairro/hamlet sem rua específica
            // Isso acontece quando a precisão do GPS não é suficiente ou o Nominatim não tem dados da rua
            const temRua = address.road || address.street || address.pedestrian || address.path || address.highway || address.residential;
            const temApenasBairro = address.hamlet || address.suburb || address.neighbourhood;
            
            if (!temRua && temApenasBairro) {
                console.warn('⚠️ Nominatim retornou apenas bairro, sem rua específica. A precisão pode ser limitada.');
            }
            
            // Preenche os campos automaticamente
            const campoEnderecoCompleto = document.getElementById('pedido-endereco-completo');
            const campoNumero = document.getElementById('pedido-numero');
            const campoBairro = document.getElementById('pedido-bairro');
            const campoCidade = document.getElementById('pedido-cidade');
            const campoEstado = document.getElementById('pedido-estado');
            
            console.log('🔍 Campos encontrados:', {
                campoEnderecoCompleto: !!campoEnderecoCompleto,
                campoNumero: !!campoNumero,
                campoBairro: !!campoBairro,
                campoCidade: !!campoCidade,
                campoEstado: !!campoEstado
            });
            
            // Normaliza número de endereço (evita tratar "12A" como inválido e cair em S/N)
            // Regras:
            // - Remove "nº", espaços
            // - Ignora CEP
            // - Aceita formatos comuns: 123, 123A, 123-1, 123/2, 123A-1B
            const normalizarNumeroEndereco = (valor) => {
                if (valor === null || valor === undefined) return '';
                let v = String(valor).trim();
                if (!v) return '';
                v = v.replace(/^n[º°]?\s*/i, ''); // remove "nº"
                v = v.replace(/\s+/g, ''); // remove espaços internos
                if (!v) return '';
                // trata S/N (sem número) como "não encontrado"
                if (/^s\/?n$/i.test(v) || /^sn$/i.test(v)) return '';
                // ignora CEP
                if (/^\d{5}-?\d{3}$/.test(v) || /^\d{8}$/.test(v)) return '';
                // aceita número com sufixo/letra e/ou complemento com - ou /
                if (/^\d{1,6}[A-Za-z]?(?:[-/]\d{1,6}[A-Za-z]?)?$/.test(v)) {
                    return v.toUpperCase();
                }
                // aceita prefixo "N" (ex: N88) usado em algumas localidades
                if (/^[Nn]\d{1,6}[A-Za-z]?(?:[-/]\d{1,6}[A-Za-z]?)?$/.test(v)) {
                    return v.toUpperCase();
                }
                // fallback: só dígitos até 6
                if (/^\d{1,6}$/.test(v)) return v;
                return '';
            };

            // Monta endereço completo - tenta várias propriedades possíveis do Nominatim
            // Nominatim retorna dados estruturados, mas com nomes diferentes do Google Maps
            // NOTA: Se não tiver rua (road), pode ter apenas bairro/hamlet - isso indica baixa precisão
            // Alguns lugares vêm como "residential" (condomínio/vila) quando não há "road"
            let rua = address.road || address.street || address.pedestrian || address.path || address.highway || address.residential || '';
            let numero = normalizarNumeroEndereco(address.house_number || address.house || address.housenumber || '');
            // Bairro pode vir de várias propriedades; em alguns locais o Nominatim retorna:
            // - suburb: região mais ampla (ex: "Jardim Esperança")
            // - hamlet/neighbourhood: área mais específica (ex: "Colônia Padre Damião")
            // Preferimos o mais específico quando existir.
            const hamlet = (address.hamlet || '').trim();
            const suburb = (address.suburb || '').trim();
            let bairro =
                (address.neighbourhood || '').trim() ||
                (address.quarter || '').trim() ||
                (address.city_district || '').trim() ||
                (address.district || '').trim() ||
                suburb ||
                hamlet ||
                '';

            if (hamlet && suburb && hamlet.length >= 4) {
                bairro = hamlet;
            }
            let cidade = address.city || address.town || address.village || address.municipality || address.county || '';
            let estado = address.state_code || address.state || '';
            
            // Se não tem rua mas tem hamlet, pode ser que o hamlet seja o nome da área/local
            // Mas não usamos hamlet como rua porque geralmente é muito genérico
            if (!rua && hamlet && !address.road) {
                console.warn('⚠️ Nominatim retornou apenas hamlet/bairro sem rua específica:', hamlet);
                // Não usa hamlet como rua, pois geralmente é muito genérico
            }
            
            console.log('📍 Dados extraídos do Nominatim:', { rua, numero, bairro, cidade, estado });
            
            // Se não conseguiu extrair dados individuais, tenta fazer parsing do display_name
            // Prioriza o display_name quando os dados estruturados estão incorretos
            if (displayName) {
                const partes = displayName.split(',').map(p => p.trim()).filter(p => p);
                console.log('🔍 Fazendo parsing do display_name:', partes);
                console.log('🔍 Dados atuais antes do parsing:', { rua, numero, bairro, cidade });
                
                // Se a rua extraída está claramente errada ou vazia, usa o display_name
                // Padrão comum: "Rua, Número - Bairro, Cidade - Estado, CEP"
                // Exemplo: "Dr. Joao Barletta, 43 - Ubá, MG, 36508-899"
                
                // Primeira parte geralmente contém rua e número
                // Exemplo: "Dr. Joao Barletta, 43" ou "Dr. Joao Barletta 43"
                // MAS pode ser apenas bairro se Nominatim não tiver dados da rua: "Padre Damião"
                if (partes.length > 0) {
                    let primeiraParte = partes[0];
                    // Remove CEP se estiver presente
                    primeiraParte = primeiraParte.replace(/\d{5}-?\d{3}/g, '').trim();
                    
                    // Verifica se a primeira parte parece ser apenas um bairro/hamlet (sem número)
                    // Se não tem número e parece ser nome de bairro, não usa como rua
                    // Importante: \b\d{1,6}\b NÃO detecta "12A" (digit+letra é tudo \w),
                    // então usamos um padrão que cobre número com letra/complemento.
                    const temNumeroNaPrimeiraParte = /\b(?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?\b/.test(primeiraParte);
                    
                    if (temNumeroNaPrimeiraParte) {
                        // Tenta padrões comuns: "Rua, 43" ou "Rua 43" ou "Rua - 43"
                        // Prioriza padrão com vírgula: "Dr. Joao Barletta, 43"
                        const patterns = [
                            /^(.+?),\s*((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)(?:\s|$|,|-)/,        // "Rua, 43" / "Rua, N88" / "Rua, 43A" / "Rua, 43-1"
                            /^(.+?)\s+((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)(?:\s|$|,|-)/,         // "Rua 43" / "Rua N88" / "Rua 43A"
                            /^(.+?)\s*-\s*((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)(?:\s|$|,)/,       // "Rua - 43"
                            /^(.+?)\s+n[º°]?\s*((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)(?:\s|$|,)/i, // "Rua nº 43" / "Rua nº N88"
                        ];
                        
                        let matched = false;
                        for (const pattern of patterns) {
                            const match = primeiraParte.match(pattern);
                            if (match && match[1] && match[2]) {
                                const numEncontrado = normalizarNumeroEndereco(match[2]);
                                if (numEncontrado) {
                                    // SEMPRE atualiza rua e número do display_name (mais confiável)
                                    rua = match[1].trim();
                                    numero = numEncontrado;
                                    matched = true;
                                    console.log('✅ Rua e número extraídos do display_name:', { rua, numero });
                                    break;
                                }
                            }
                        }
                        
                        // Se não encontrou padrão, tenta extrair número separadamente
                        if (!matched) {
                            const numMatch = primeiraParte.match(/\b((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)\b/);
                            if (numMatch && numMatch[1]) {
                                const numEncontrado = normalizarNumeroEndereco(numMatch[1]);
                                if (numEncontrado) {
                                    numero = numEncontrado;
                                    // Remove o número da rua (remove até o primeiro bloco numérico)
                                    rua = primeiraParte.replace(/\b(?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?\b.*$/, '').trim();
                                    rua = rua.replace(/,\s*$/, '').trim(); // Remove vírgula final
                                    console.log('✅ Número extraído separadamente:', numero, 'Rua:', rua);
                                }
                            }
                        }
                    } else {
                        // Se não tem número na primeira parte, pode ser apenas bairro/hamlet
                        // Nesse caso, não usa como rua, mas pode usar como bairro
                        console.warn('⚠️ Primeira parte não contém número, pode ser apenas bairro:', primeiraParte);
                        
                        // Se não tem rua ainda e não parece ser hamlet genérico, pode tentar usar
                        if (!rua) {
                            // Verifica se não é hamlet genérico conhecido
                            const nomesGenericos = ['Padre Damião', 'Padre', 'Santo', 'Santa', 'São'];
                            const isGenerico = nomesGenericos.some(nome => 
                                primeiraParte.toLowerCase().startsWith(nome.toLowerCase()) || 
                                primeiraParte.toLowerCase() === nome.toLowerCase()
                            );
                            
                            if (!isGenerico && primeiraParte.length > 10) {
                                rua = primeiraParte;
                                console.log('⚠️ Usando primeira parte como rua (pode ser impreciso):', rua);
                            } else if (isGenerico && !bairro) {
                                // Se é hamlet genérico e não tem bairro, usa como bairro
                                bairro = primeiraParte;
                                console.log('✅ Usando primeira parte como bairro:', bairro);
                            }
                        } else if (!bairro) {
                            // Se já tem rua mas não tem bairro, pode usar como bairro
                            bairro = primeiraParte;
                            console.log('✅ Usando primeira parte como bairro:', bairro);
                        }
                    }
                }
                
                // Se ainda não encontrou número, procura em outras partes
                if (!numero) {
                    for (let i = 0; i < partes.length; i++) {
                        const parte = partes[i].trim();
                        // Verifica se não é CEP (8 dígitos ou formato 00000-000)
                        const isCEP = /^\d{5}-?\d{3}$/.test(parte) || /^\d{8}$/.test(parte);
                        if (isCEP) {
                            console.log('⚠️ Ignorando CEP:', parte);
                            continue;
                        }
                        
                        // Procura padrões de número: "123", "nº 123", "número 123", etc.
                        // MAS NÃO CEP (CEP geralmente tem 8 dígitos ou formato 00000-000)
                        const numPatterns = [
                            /^((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)$/, // Apenas número / N88 (até 6 dígitos, com letra/complemento)
                            /n[º°]?\s*((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)/i, // "nº 123A" / "nº N88"
                            /número\s*((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)/i, // "número 123" / "número N88"
                            /\b((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)\b/         // bloco numérico com possíveis complementos
                        ];
                        
                        for (const pattern of numPatterns) {
                            const match = parte.match(pattern);
                            if (match && match[1]) {
                                const numEncontrado = normalizarNumeroEndereco(match[1]);
                                if (numEncontrado) {
                                    numero = numEncontrado;
                                    console.log('✅ Número encontrado em outra parte:', numero, 'da parte:', parte);
                                    break;
                                }
                            }
                        }
                        if (numero) break;
                    }
                }
                
                // Se ainda não encontrou número, procura na primeira parte novamente (pode ter sido perdido)
                if (!numero && partes.length > 0) {
                    const primeiraParte = partes[0];
                    // Procura qualquer número (inclui N88) que não seja CEP
                    const numMatch = primeiraParte.match(/\b((?:[Nn])?\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?)\b/);
                    if (numMatch && numMatch[1]) {
                        const numEncontrado = normalizarNumeroEndereco(numMatch[1]);
                        if (numEncontrado) {
                            numero = numEncontrado;
                            console.log('✅ Número encontrado na primeira parte:', numero);
                        }
                    }
                }
                
                // Se não encontrou número, coloca "S/N"
                if (!numero) {
                    numero = 'S/N';
                    console.log('⚠️ Número não encontrado, usando S/N');
                    // Se também não tem rua específica, mostra aviso ao usuário
                    if (!rua || rua.length < 5) {
                        console.warn('⚠️ ATENÇÃO: Nominatim não retornou rua específica. A precisão pode ser limitada.');
                        // Pode mostrar um aviso visual ao usuário se necessário
                    }
                } else {
                    console.log('✅ Número final:', numero);
                }
                
                // Procura cidade primeiro (geralmente segunda parte)
                if (!cidade) {
                    for (let i = 1; i < partes.length; i++) {
                        const parte = partes[i];
                        // Cidade geralmente não tem números, não é muito longa e não contém "Região"
                        if (!/\d/.test(parte) && 
                            parte.length < 50 && 
                            parte.length > 2 &&
                            !parte.includes('Região') && 
                            !parte.includes('Geográfica') &&
                            !parte.includes('Brasil') &&
                            !parte.includes('Estado') &&
                            !parte.match(/^[A-Z]{2}$/i)) { // Não é código de estado
                            cidade = parte;
                            break;
                        }
                    }
                }
                
                // Procura bairro (geralmente entre rua e cidade, ou após cidade mas antes de "Região")
                // NÃO usa "Minas Gerais" ou nomes de estado como bairro
                if (!bairro && partes.length > 1) {
                    // Lista de cidades conhecidas para evitar confusão
                    const cidadesConhecidas = ['Ubá', 'Belo Horizonte', 'São Paulo', 'Rio de Janeiro', 
                                               'Curitiba', 'Porto Alegre', 'Salvador', 'Recife',
                                               'Fortaleza', 'Belém', 'Florianópolis', 'Goiânia',
                                               'Brasília', 'Manaus', 'Vitória', 'Aracaju', 'Maceió',
                                               'João Pessoa', 'Natal', 'Teresina', 'São Luís', 'Campo Grande',
                                               'Cuiabá', 'Macapá', 'Boa Vista', 'Rio Branco', 'Palmas'];
                    
                    // Lista de estados para NÃO usar como bairro
                    const estadosBrasil = ['Minas Gerais', 'São Paulo', 'Rio de Janeiro', 'Bahia', 'Paraná',
                                          'Rio Grande do Sul', 'Pernambuco', 'Ceará', 'Pará', 'Santa Catarina',
                                          'Goiás', 'Maranhão', 'Paraíba', 'Espírito Santo', 'Piauí', 'Alagoas',
                                          'Rio Grande do Norte', 'Mato Grosso', 'Mato Grosso do Sul', 'Sergipe',
                                          'Rondônia', 'Tocantins', 'Acre', 'Amapá', 'Amazonas', 'Roraima',
                                          'Distrito Federal'];
                    
                    for (let i = 1; i < partes.length; i++) {
                        const parte = partes[i].trim();
                        
                        // Ignora se for cidade já identificada
                        if (parte === cidade) continue;
                        
                        // Ignora se for cidade conhecida
                        if (cidadesConhecidas.some(c => parte.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(parte.toLowerCase()))) {
                            continue;
                        }
                        
                        // Ignora se for estado
                        if (estadosBrasil.some(e => parte.toLowerCase() === e.toLowerCase())) {
                            console.log('⚠️ Ignorando estado como bairro:', parte);
                            continue;
                        }
                        
                        // Ignora se contém "Região" ou termos geográficos
                        if (parte.includes('Região') || 
                            parte.includes('Geográfica') || 
                            parte.includes('Intermediária') || 
                            parte.includes('Imediata') ||
                            parte.includes('Sudeste') ||
                            parte.includes('Norte') ||
                            parte.includes('Sul') ||
                            parte.includes('Nordeste') ||
                            parte.includes('Centro-Oeste')) {
                            continue;
                        }
                        
                        // Bairro não pode ter números (exceto se for parte do nome), não pode ser muito longo
                        // e não pode conter palavras específicas
                        if (!/\d{5,}/.test(parte) && // Não pode ter sequência de 5+ dígitos (pode ser CEP)
                            parte.length < 40 && 
                            parte.length > 2 &&
                            !parte.includes('Brasil') &&
                            !parte.includes('Estado') &&
                            !parte.match(/^[A-Z]{2}$/i)) { // Não é código de estado
                            bairro = parte;
                            console.log('✅ Bairro identificado:', bairro);
                            break;
                        }
                    }
                }
                
                // Procura estado (geralmente código de 2 letras ou nome completo)
                if (!estado) {
                    const estadoMap = {
                        'Minas Gerais': 'MG', 'São Paulo': 'SP', 'Rio de Janeiro': 'RJ',
                        'Bahia': 'BA', 'Paraná': 'PR', 'Rio Grande do Sul': 'RS',
                        'Pernambuco': 'PE', 'Ceará': 'CE', 'Pará': 'PA', 'Santa Catarina': 'SC',
                        'Goiás': 'GO', 'Maranhão': 'MA', 'Paraíba': 'PB', 'Espírito Santo': 'ES',
                        'Piauí': 'PI', 'Alagoas': 'AL', 'Rio Grande do Norte': 'RN', 'Mato Grosso': 'MT',
                        'Mato Grosso do Sul': 'MS', 'Sergipe': 'SE', 'Rondônia': 'RO', 'Tocantins': 'TO',
                        'Acre': 'AC', 'Amapá': 'AP', 'Amazonas': 'AM', 'Roraima': 'RR', 'Distrito Federal': 'DF'
                    };
                    
                    // Tenta encontrar estado nas partes
                    for (let i = partes.length - 1; i >= 0; i--) {
                        const parte = partes[i];
                        // Estado pode ser código (2 letras)
                        if (parte.length === 2 && /^[A-Z]{2}$/i.test(parte)) {
                            estado = parte.toUpperCase();
                            break;
                        } else if (estadoMap[parte]) {
                            // Nome completo do estado
                            estado = estadoMap[parte];
                            break;
                        }
                    }
                    
                    // Se ainda não encontrou, tenta identificar pela cidade conhecida
                    if (!estado && cidade) {
                        // Mapeamento de cidades conhecidas para estados (exemplos comuns)
                        const cidadeEstadoMap = {
                            'Ubá': 'MG', 'Belo Horizonte': 'MG', 'São Paulo': 'SP', 'Rio de Janeiro': 'RJ',
                            'Curitiba': 'PR', 'Porto Alegre': 'RS', 'Salvador': 'BA', 'Recife': 'PE',
                            'Fortaleza': 'CE', 'Belém': 'PA', 'Florianópolis': 'SC', 'Goiânia': 'GO'
                        };
                        if (cidadeEstadoMap[cidade]) {
                            estado = cidadeEstadoMap[cidade];
                        }
                    }
                }
            }
            
            console.log('📍 Dados extraídos:', { numero, bairro, cidade, estado });
            
            // Preenche endereço completo
            // Aqui o campo "Endereço" deve receber apenas a rua/logradouro.
            // Número e bairro possuem campos próprios.
            if (campoEnderecoCompleto) {
                let endereco = (rua || '').trim();

                if (!endereco && displayName) {
                    const partes = displayName.split(',').map(p => p.trim()).filter(p => p);
                    if (partes.length > 0) {
                        // Remove um possível número da primeira parte, para manter apenas o logradouro.
                        endereco = partes[0]
                            .replace(/\b\d{1,6}\s*[A-Za-z]?(?:[-/]\d{1,6}\s*[A-Za-z]?)?\b/g, '')
                            .replace(/\d{5}-?\d{3}/g, '')
                            .replace(/\bS\/?N\b/gi, '')
                            .replace(/\s+/g, ' ')
                            .replace(/,\s*$/, '')
                            .trim();
                    }
                }

                if (endereco) {
                    campoEnderecoCompleto.value = endereco;
                    console.log('✅ Endereço preenchido (logradouro):', campoEnderecoCompleto.value);
                } else {
                    campoEnderecoCompleto.value = '';
                    console.warn('⚠️ Não foi possível preencher o logradouro, campo deixado vazio');
                }
            } else {
                console.error('❌ Campo endereço não encontrado!');
            }
            
            // Preenche campos individuais
            // Variáveis para rastrear quais campos estão faltando
            let faltaNumero = false;
            let faltaBairro = false;
            
            if (campoNumero) {
                // Garante que número não seja CEP
                let numeroValido = normalizarNumeroEndereco(numero);
                console.log('🔍 Validando número antes de preencher:', numeroValido);
                
                if (!numeroValido) {
                    numeroValido = 'S/N';
                    faltaNumero = true;
                    console.warn('⚠️ Número não encontrado, usando S/N');
                }
                
                campoNumero.value = numeroValido;
                console.log('✅ Número preenchido:', numeroValido);
            } else {
                console.warn('⚠️ Campo número não encontrado');
            }
            
            if (campoBairro) {
                // Garante que bairro não seja estado ou cidade
                let bairroValido = bairro;
                
                // Não usa hamlet como bairro se for muito genérico
                if (bairroValido && bairroValido.match(/^(Padre|Santo|Santa|São)\s+/i)) {
                    // Pode ser hamlet genérico, mas se não tiver outro bairro, pode usar
                    console.log('⚠️ Bairro parece ser hamlet genérico:', bairroValido);
                }
                
                if (bairroValido && estado && bairroValido === estado) {
                    bairroValido = '';
                    console.warn('⚠️ Bairro era igual ao estado, removido');
                }
                if (bairroValido && cidade && bairroValido === cidade) {
                    bairroValido = '';
                    console.warn('⚠️ Bairro era igual à cidade, removido');
                }
                // Remove códigos de estado (2 letras)
                if (bairroValido && /^[A-Z]{2}$/i.test(bairroValido)) {
                    bairroValido = '';
                    console.warn('⚠️ Bairro era código de estado, removido');
                }
                
                if (bairroValido) {
                    campoBairro.value = bairroValido;
                    console.log('✅ Bairro preenchido:', bairroValido);
                } else {
                    // Se não tem bairro válido, deixa vazio (não é obrigatório)
                    campoBairro.value = '';
                    faltaBairro = true;
                    console.warn('⚠️ Bairro inválido ou não encontrado, campo deixado vazio');
                }
            } else {
                console.warn('⚠️ Campo bairro não encontrado');
            }
            
            // Mostra/oculta mensagem de aviso sobre campos faltantes
            const avisoLocalizacao = document.getElementById('aviso-localizacao-incompleta');
            const camposFaltantes = document.getElementById('campos-faltantes');
            
            if (avisoLocalizacao && camposFaltantes) {
                if (faltaNumero || faltaBairro) {
                    const campos = [];
                    if (faltaNumero) campos.push('Número');
                    if (faltaBairro) campos.push('Bairro');
                    
                    camposFaltantes.textContent = `Campos faltantes: ${campos.join(', ')}`;
                    avisoLocalizacao.style.display = 'block';
                    console.log('⚠️ Mostrando aviso de localização incompleta:', campos);
                } else {
                    avisoLocalizacao.style.display = 'none';
                }
            }
            
            if (campoCidade && cidade) {
                campoCidade.value = cidade;
                console.log('✅ Cidade preenchida:', cidade);
            } else if (!campoCidade) {
                console.warn('⚠️ Campo cidade não encontrado');
            }
            
            if (campoEstado) {
                // Tenta obter o estado (código de 2 letras)
                // Se vier o nome completo, tenta converter para código
                const estadoMap = {
                    'Minas Gerais': 'MG', 'São Paulo': 'SP', 'Rio de Janeiro': 'RJ',
                    'Bahia': 'BA', 'Paraná': 'PR', 'Rio Grande do Sul': 'RS',
                    'Pernambuco': 'PE', 'Ceará': 'CE', 'Pará': 'PA', 'Santa Catarina': 'SC',
                    'Goiás': 'GO', 'Maranhão': 'MA', 'Paraíba': 'PB', 'Espírito Santo': 'ES',
                    'Piauí': 'PI', 'Alagoas': 'AL', 'Rio Grande do Norte': 'RN', 'Mato Grosso': 'MT',
                    'Mato Grosso do Sul': 'MS', 'Sergipe': 'SE', 'Rondônia': 'RO', 'Tocantins': 'TO',
                    'Acre': 'AC', 'Amapá': 'AP', 'Amazonas': 'AM', 'Roraima': 'RR', 'Distrito Federal': 'DF'
                };
                
                let estadoCodigo = estado;
                if (estado && estado.length > 2) {
                    estadoCodigo = estadoMap[estado] || estado.substring(0, 2).toUpperCase();
                } else if (!estado && address.state) {
                    // Se não tem state_code, tenta converter state
                    estadoCodigo = estadoMap[address.state] || '';
                }
                
                if (estadoCodigo) {
                    campoEstado.value = estadoCodigo.toUpperCase();
                    console.log('✅ Estado preenchido:', estadoCodigo.toUpperCase());
                } else {
                    console.warn('⚠️ Estado não encontrado na resposta da API');
                }
            } else {
                console.warn('⚠️ Campo estado não encontrado');
            }
            
            btn.innerHTML = '<i class="fas fa-check"></i> Localização obtida!';
            btn.style.background = 'rgba(40, 167, 69, 0.2)';
            
            setTimeout(() => {
                btn.innerHTML = estadoOriginal;
                btn.style.background = '';
                btn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Erro ao obter localização:', error);
            btn.innerHTML = estadoOriginal;
            btn.disabled = false;
            
            let mensagem = 'Erro ao obter localização.';
            if (error.code === 1) {
                mensagem = 'Permissão de localização negada. Por favor, permita o acesso à localização nas configurações do navegador.';
            } else if (error.code === 2) {
                mensagem = 'Localização indisponível. Verifique se o GPS está ativado.';
            } else if (error.code === 3) {
                mensagem = 'Tempo esgotado ao obter localização. Tente novamente.';
            } else if (error.message) {
                mensagem = error.message;
            }
            
            alert(mensagem);
        }
    }
    
    // Adiciona event listener ao botão de localização em tempo real
    if (btnLocalizacaoTempoReal) {
        btnLocalizacaoTempoReal.addEventListener('click', usarLocalizacaoTempoReal);
        
        // Função para verificar e ocultar aviso quando campos forem preenchidos
        function verificarECondarAviso() {
            const avisoLocalizacao = document.getElementById('aviso-localizacao-incompleta');
            if (!avisoLocalizacao) return;
            
            const campoNumero = document.getElementById('pedido-numero');
            const campoBairro = document.getElementById('pedido-bairro');
            
            const campoEnderecoCompleto = document.getElementById('pedido-endereco-completo');
            const enderecoCompletoPreenchido = campoEnderecoCompleto && campoEnderecoCompleto.value.trim() !== '';
            const numeroPreenchido = campoNumero && campoNumero.value.trim() !== '' && campoNumero.value.trim() !== 'S/N';
            const bairroPreenchido = campoBairro && campoBairro.value.trim() !== '';
            
            // Se todos os campos obrigatórios estiverem preenchidos, oculta o aviso
            if (enderecoCompletoPreenchido && numeroPreenchido && bairroPreenchido) {
                avisoLocalizacao.style.display = 'none';
            }
        }
        
        // Adiciona listeners para ocultar aviso quando campos forem preenchidos
        const campoNumero = document.getElementById('pedido-numero');
        const campoBairro = document.getElementById('pedido-bairro');
        if (campoNumero) campoNumero.addEventListener('input', verificarECondarAviso);
        if (campoBairro) campoBairro.addEventListener('input', verificarECondarAviso);
    }

    if (formPedidoUrgente) {
        formPedidoUrgente.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const servico = inputServicoPedido ? inputServicoPedido.value : '';
            const descricao = document.getElementById('pedido-descricao').value;
            // cache nome do serviço para usar no lembrete/avaliação
            try {
                localStorage.setItem('ultimoServicoNome', servico || '');
                localStorage.setItem('ultimaDescricaoPedido', descricao || servico || '');
                localStorage.setItem('ultimaDemanda', servico || descricao || '');
            } catch (e) {
                console.warn('Não foi possível cachear o nome do serviço', e);
            }
            // Categoria foi removida da interface; usamos um valor padrão para manter compatibilidade com o backend
            const categoria = 'outros';
            const enderecoCompleto = document.getElementById('pedido-endereco-completo')?.value || '';
            const numero = document.getElementById('pedido-numero').value;
            const bairro = document.getElementById('pedido-bairro').value;
            const referencia = document.getElementById('pedido-referencia').value;
            const cidade = document.getElementById('pedido-cidade').value;
            const estado = document.getElementById('pedido-estado').value;
            const prazoHoras = document.getElementById('pedido-prazo')?.value || '1';
            // Prepara todas as fotos selecionadas para envio
            const fotosParaEnviar = fotosSelecionadas.length > 0 ? fotosSelecionadas : (inputFotoPedido?.files ? Array.from(inputFotoPedido.files) : []);

            const tipoAtendimento = (radioTipoAgendado && radioTipoAgendado.checked) ? 'agendado' : 'urgente';
            let dataAgendadaIso = '';
            if (tipoAtendimento === 'agendado') {
                const data = inputDataAgendamento?.value;
                const hora = inputHoraAgendamento?.value;

                if (!data || !hora) {
                    alert('Por favor, selecione a data e o horário em que você precisa do serviço.');
                    return;
                }

                const combinado = new Date(`${data}T${hora}:00`);
                if (isNaN(combinado.getTime())) {
                    alert('Data ou horário inválidos. Tente novamente.');
                    return;
                }

                dataAgendadaIso = combinado.toISOString();
            }

            try {
                // Usa FormData para enviar arquivo
                const formData = new FormData();
                formData.append('servico', servico);
                formData.append('categoria', categoria);
                formData.append('descricao', descricao);
                formData.append('prazoHoras', prazoHoras);
                formData.append('tipoAtendimento', tipoAtendimento);
                if (dataAgendadaIso) {
                    formData.append('dataAgendada', dataAgendadaIso);
                }
                // Monta endereço formatado para exibição: logradouro + número + bairro
                // Nota: o campo "pedido-endereco-completo" armazena apenas o logradouro.
                const partsEndereco = [];
                if (enderecoCompleto && String(enderecoCompleto).trim()) {
                    partsEndereco.push(String(enderecoCompleto).trim());
                }
                if (numero && String(numero).trim()) {
                    const num = String(numero).trim();
                    if (partsEndereco.length > 0) {
                        partsEndereco[0] = `${partsEndereco[0]}, ${num}`;
                    } else {
                        partsEndereco.push(num);
                    }
                }
                if (bairro && String(bairro).trim()) {
                    partsEndereco.push(String(bairro).trim());
                }
                const enderecoFormatado = partsEndereco.join(' - ');
                formData.append('localizacao', JSON.stringify({
                    endereco: enderecoFormatado,
                    enderecoCompleto: enderecoCompleto,
                    numero,
                    bairro,
                    pontoReferencia: referencia,
                    cidade,
                    estado
                }));
                // Adiciona todas as fotos ao FormData
                console.log(`📤 Enviando ${fotosParaEnviar.length} foto(s) para o servidor`);
                fotosParaEnviar.forEach((foto, index) => {
                    formData.append('fotos', foto);
                    console.log(`  Foto ${index + 1}: ${foto.name || 'sem nome'} (${foto.size || 0} bytes)`);
                });

                const response = await fetch('/api/pedidos-urgentes', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // Não definir Content-Type, o browser define automaticamente com boundary para FormData
                    },
                    body: formData
                });

                let data = null;
                try {
                    const responseText = await response.text();
                    console.log('Resposta do servidor (texto):', responseText);
                    try {
                        data = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('Erro ao fazer parse do JSON:', parseError);
                        console.error('Resposta recebida:', responseText);
                        throw new Error(`Resposta inválida do servidor: ${responseText.substring(0, 200)}`);
                    }
                } catch (parseError) {
                    console.error('Erro ao interpretar resposta do pedido urgente:', parseError);
                    alert(`Erro ao processar resposta do servidor: ${parseError.message}`);
                    return;
                }
                
                const successFlag = data && data.success === true;

                if (successFlag) {
                    // Feedback visual com check animado
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = `<span class="check-animado">✔</span> Pedido criado! ${data.profissionaisNotificados || 0} profissionais foram notificados.`;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);

                    formPedidoUrgente.reset();
                    if (typeof atualizarVisibilidadeTipoAtendimento === 'function') {
                        atualizarVisibilidadeTipoAtendimento();
                    }
                    limparFotosPedido();
                    modalPedidoUrgente?.classList.add('hidden');
                } else {
                    console.error('Erro ao criar pedido urgente:', {
                        status: response.status,
                        ok: response.ok,
                        data
                    });
                    const errorMsg = (data && data.message) 
                        ? data.message 
                        : (data && data.error) 
                            ? data.error 
                            : `Erro ao criar pedido urgente. (status ${response.status || 'desconhecido'})`;
                    alert(errorMsg);
                    return;
                }
            } catch (error) {
                console.error('Erro ao criar pedido urgente:', error);
                alert('Erro ao criar pedido urgente.');
            }
        });
    }

    // Carregar propostas de um pedido (tornada global para uso em header-notificacoes.js)
    window.carregarPropostas = async function carregarPropostas(pedidoId) {
        const modalPropostas = document.getElementById('modal-propostas');
        const listaPropostas = document.getElementById('lista-propostas');
        
        if (!modalPropostas || !listaPropostas) return;

        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/propostas`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                modalPropostas.classList.remove('hidden');
                
                const pedido = data.pedido;
                // Filtrar apenas propostas pendentes ou aceitas (não recusadas/rejeitadas)
                const propostas = (data.propostas || []).filter(prop => 
                    prop.status !== 'rejeitada' && prop.status !== 'rejeitado' && prop.status !== 'recusada' && prop.status !== 'recusado'
                );
                
                // Verificar se o pedido foi concluído mas não foi avaliado
                let pedidoFoiAvaliado = false;
                if (pedido && pedido.status === 'concluido') {
                    try {
                        const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedidoId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (avaliacaoResponse.ok) {
                            const avaliacaoData = await avaliacaoResponse.json();
                            pedidoFoiAvaliado = avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => 
                                av.clienteId && (av.clienteId._id || av.clienteId) === loggedInUserId
                            );
                        }
                    } catch (error) {
                        console.error('Erro ao verificar avaliação:', error);
                    }
                }

                if (propostas.length === 0) {
                    listaPropostas.innerHTML = '<p>Ainda não há propostas. Profissionais serão notificados!</p>';
                    return;
                }

                let headerHtml = '';
                if (pedido) {
                    // Monta endereço completo com todos os dados
                    const localizacao = pedido.localizacao || {};
                    const enderecoParts = [];
                    
                    // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                    const enderecoBase = localizacao.enderecoCompleto || localizacao.endereco || '';
                    const numero = localizacao.numero || '';
                    const bairro = localizacao.bairro || '';
                    
                    if (enderecoBase) {
                        // Se tem endereço base, adiciona ele primeiro
                        if (numero && !enderecoBase.includes(numero)) {
                            // Se o número não está no endereço base, adiciona
                            enderecoParts.push(`${enderecoBase}, ${numero}`);
                        } else {
                            enderecoParts.push(enderecoBase);
                        }
                    } else {
                        // Se não tem endereço base, monta a partir dos campos individuais
                        const rua = localizacao.rua || '';
                        if (rua) {
                            if (numero) {
                                enderecoParts.push(`${rua}, ${numero}`);
                            } else {
                                enderecoParts.push(rua);
                            }
                        } else if (numero) {
                            // Se não tem rua mas tem número, adiciona apenas o número
                            enderecoParts.push(numero);
                        }
                    }
                    
                    // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                    if (bairro) {
                        // Verifica se o bairro já não está no endereço base
                        if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                            enderecoParts.push(bairro);
                        }
                    }
                    
                    const cidade = localizacao.cidade || '';
                    const estado = localizacao.estado || '';
                    if (cidade) enderecoParts.push(cidade);
                    if (estado) enderecoParts.push(estado);
                    
                    const pontoReferencia = localizacao.pontoReferencia || '';
                    const enderecoFormatado = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                    const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                    
                    headerHtml = `
                        <div class="pedido-propostas-header">
                            <div class="pedido-propostas-info">
                                <strong>${pedido.servico || ''}</strong>
                                ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                                ${enderecoFormatado ? `
                                    <p class="pedido-endereco" style="margin-top: 8px; color: var(--text-secondary); font-size: 14px;">
                                        <i class="fas fa-map-marker-alt"></i> 
                                        <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                                           target="_blank" 
                                           rel="noopener noreferrer"
                                           style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                                           onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                                           onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                            ${enderecoFormatado}
                                        </a>
                                    </p>
                                    ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                                ` : ''}
                                ${pedido.status === 'concluido' && !pedidoFoiAvaliado ? 
                                    '<p style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px;"><i class="fas fa-exclamation-triangle"></i> Serviço concluído! Falta avaliar o profissional.</p>' : 
                                    ''
                                }
                            </div>
                            ${pedido.foto ? `
                                <div class="pedido-propostas-foto">
                                    <img src="${pedido.foto}" alt="Foto do serviço" class="pedido-foto-miniatura" id="pedido-foto-miniatura">
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                const propostasHtml = propostas.map(proposta => {
                    const prof = proposta.profissionalId;
                    const nivel = prof.gamificacao?.nivel || 1;
                    const mediaAvaliacao = prof.mediaAvaliacao || 0;
                    const profId = prof._id || prof.id || prof.userId;
                    const perfilUrl = profId ? `/perfil.html?id=${profId}` : '#';
                    
                    return `
                        <div class="proposta-card">
                            <div class="proposta-header">
                                <a class="proposta-avatar-link" href="${perfilUrl}">
                                <img src="${prof.avatarUrl || prof.foto || 'imagens/default-user.png'}" 
                                     alt="${prof.nome}" class="proposta-avatar">
                                </a>
                                <div class="proposta-info-profissional">
                                    <strong><a class="link-perfil-proposta" href="${perfilUrl}">${prof.nome}</a></strong>
                                    <div class="proposta-meta">
                                        <span>Nível ${nivel}</span>
                                        ${mediaAvaliacao > 0 ? `<span>⭐ ${mediaAvaliacao.toFixed(1)}</span>` : ''}
                                        <span>${prof.cidade || ''} - ${prof.estado || ''}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="proposta-detalhes">
                                <div class="proposta-valor">
                                    <strong>R$ ${parseFloat(proposta.valor).toFixed(2)}</strong>
                                </div>
                                <div class="proposta-tempo">
                                    <i class="fas fa-clock"></i> ${proposta.tempoChegada}
                                </div>
                                ${proposta.observacoes ? `<p class="proposta-observacoes">${proposta.observacoes}</p>` : ''}
                            </div>
                            <div style="display: flex; gap: 10px; margin-top: 10px; align-items: center; position: relative;">
                            <button class="btn-aceitar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}" style="flex: 1;">
                                Aceitar Proposta
                            </button>
                                <div style="position: relative; flex-shrink: 0;">
                                    <button class="btn-recusar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}" style="background: #dc3545; color: #fff; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; white-space: nowrap;">
                                    Recusar
                            </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                listaPropostas.innerHTML = headerHtml + propostasHtml;

                // Clique na miniatura para ampliar a imagem do serviço
                const miniatura = document.getElementById('pedido-foto-miniatura');
                if (miniatura) {
                    miniatura.addEventListener('click', () => {
                        const overlay = document.createElement('div');
                        overlay.className = 'imagem-overlay';
                        overlay.innerHTML = `
                            <div class="imagem-overlay-content">
                                <img src="${pedido.foto}" alt="Foto do serviço ampliada">
                            </div>
                        `;
                        overlay.addEventListener('click', () => overlay.remove());
                        document.body.appendChild(overlay);
                    });
                }

                // Adicionar listeners para aceitar propostas
                document.querySelectorAll('.btn-aceitar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoId = btn.dataset.pedidoId;
                        
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/aceitar-proposta`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ propostaId })
                            });

                            const data = await response.json();
                            
                            if (data.success) {
                                        // Feedback visual de sucesso
                                        const toast = document.createElement('div');
                                        toast.className = 'toast-sucesso';
                                        toast.innerHTML = '<span class="check-animado">✔</span> Proposta aceita! Agora é só aguardar o profissional.';
                                        document.body.appendChild(toast);
                                        setTimeout(() => toast.classList.add('show'), 10);
                                        setTimeout(() => toast.remove(), 2500);

                                // ✅ Some instantaneamente de "Procurar pedidos" (não ocupa espaço)
                                if (typeof window.removerPedidoUrgenteDaLista === 'function') {
                                    window.removerPedidoUrgenteDaLista(pedidoId);
                                }

                                modalPropostas.classList.add('hidden');
                                
                                // NÃO abre "Meus serviços ativos" para o cliente que aceitou a proposta
                                // O pedido aceito aparece em "Meus serviços ativos" apenas para o PROFISSIONAL
                                // O profissional receberá uma notificação e poderá ver o pedido quando clicar nela
                            } else {
                                alert(data.message || 'Erro ao aceitar proposta.');
                            }
                        } catch (error) {
                            console.error('Erro ao aceitar proposta:', error);
                            alert('Erro ao aceitar proposta.');
                        }
                });
                });

                // Adicionar listeners para recusar propostas
                document.querySelectorAll('.btn-recusar-proposta').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const propostaId = btn.dataset.propostaId;
                        const pedidoId = btn.dataset.pedidoId;
                        const container = btn.parentElement;
                        
                        // Remove modal anterior se existir
                        const modalAnterior = container.querySelector('.modal-recusar-inline');
                        if (modalAnterior) {
                            modalAnterior.remove();
                        }
                        
                        // Cria modal inline ao lado do botão
                        const modalInline = document.createElement('div');
                        modalInline.className = 'modal-recusar-inline';
                        modalInline.style.cssText = `
                            position: absolute;
                            right: 0;
                            bottom: 100%;
                            margin-bottom: 5px;
                            background: var(--bg-primary, #fff);
                            border: 1px solid var(--border-color, #ddd);
                            border-radius: 8px;
                            padding: 12px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            z-index: 1000;
                            min-width: 200px;
                            max-width: 250px;
                        `;
                        modalInline.innerHTML = `
                            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; margin-top: 0;">
                                Tem certeza?
                            </p>
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button class="btn-confirmar-recusar" data-proposta-id="${propostaId}" data-pedido-id="${pedidoId}" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                                    Sim
                                </button>
                                <button class="btn-cancelar-recusar" style="padding: 6px 12px; background: var(--bg-secondary, #f0f0f0); color: var(--text-primary); border: 1px solid var(--border-color, #ddd); border-radius: 4px; cursor: pointer; font-size: 13px;">
                                    Não
                                </button>
                            </div>
                        `;
                        
                        // Adiciona o modal ao container do botão
                        container.appendChild(modalInline);
                        
                        // Fecha ao clicar em cancelar
                        modalInline.querySelector('.btn-cancelar-recusar').addEventListener('click', () => {
                            modalInline.remove();
                        });
                        
                        // Confirma ao clicar em sim
                        modalInline.querySelector('.btn-confirmar-recusar').addEventListener('click', async () => {
            try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/recusar-proposta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                                body: JSON.stringify({ propostaId })
                });

                const data = await response.json();
                
                if (data.success) {
                                    modalInline.remove();
                                    const toast = document.createElement('div');
                                    toast.className = 'toast-sucesso';
                                    toast.innerHTML = '<span class="check-animado">✔</span> Proposta recusada com sucesso.';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.classList.add('show'), 10);
                                    setTimeout(() => toast.remove(), 2500);
                                await carregarPropostas(pedidoId);
                } else {
                                alert(data.message || 'Erro ao recusar proposta.');
                                    modalInline.remove();
                }
            } catch (error) {
                            console.error('Erro ao recusar proposta:', error);
                            alert('Erro ao recusar proposta.');
                                modalInline.remove();
                            }
                        });
                        
                        // Fecha ao clicar fora
                        setTimeout(() => {
                            const fecharAoClicarFora = (e) => {
                                if (!modalInline.contains(e.target) && !btn.contains(e.target)) {
                                    modalInline.remove();
                                    document.removeEventListener('click', fecharAoClicarFora);
                                }
                            };
                            document.addEventListener('click', fecharAoClicarFora);
                        }, 10);
                    });
        });
            }
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            listaPropostas.innerHTML = '<p>Erro ao carregar propostas.</p>';
        }
    }

    // ============================================
    // TIMES LOCAIS (somente listagem na lateral)
    // A criação de times de projeto é feita pelo modal "Montar Time" (script.js)
    // ============================================

    // Carregar times locais
    async function carregarTimesLocais() {
        const timesContainer = document.getElementById('times-container');
        if (!timesContainer) return;

        try {
            const response = await fetch('/api/times-locais');
            const data = await response.json();
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.slice(0, 5).map(time => `
                    <div class="time-card-lateral">
                        <strong>${time.nome}</strong>
                        <small>Nível ${time.nivelMedio} • ${time.categoria}</small>
                    </div>
                `).join('');
            } else {
                timesContainer.innerHTML = '<p style="font-size: 12px; color: var(--text-secondary);">Nenhum time disponível</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar times locais:', error);
        }
    }

    // Qualquer usuário pode ver times locais
    if (userType === 'usuario' || userType === 'empresa') {
        carregarTimesLocais();
    }

    // ============================================
    // PROJETOS DE TIME / MUTIRÃO
    // ============================================
    
    const btnCriarProjetoTime = document.getElementById('btn-criar-projeto-time');
    const modalProjetoTime = document.getElementById('modal-projeto-time');
    const formProjetoTime = document.getElementById('form-projeto-time');
    const profissionaisListaProjeto = document.getElementById('profissionais-lista-projeto');
    const btnAdicionarProfissionalProjeto = document.getElementById('btn-adicionar-profissional-projeto');

    if (btnAdicionarProfissionalProjeto) {
        btnAdicionarProfissionalProjeto.addEventListener('click', () => {
            const novoItem = document.createElement('div');
            novoItem.className = 'profissional-item-projeto';
            novoItem.innerHTML = `
                <input type="text" placeholder="Tipo (ex: pintor)" class="tipo-profissional-projeto" required>
                <input type="number" placeholder="Qtd" class="qtd-profissional-projeto" min="1" value="1" required>
                <input type="number" placeholder="R$ por pessoa" class="valor-profissional-projeto" min="0" step="0.01" required>
                <button type="button" class="btn-remover-profissional-projeto">&times;</button>
            `;
            profissionaisListaProjeto.appendChild(novoItem);
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remover-profissional-projeto')) {
            if (profissionaisListaProjeto.children.length > 1) {
                e.target.closest('.profissional-item-projeto').remove();
            } else {
                alert('Você precisa de pelo menos um profissional.');
            }
        }
    });

    // ============================================
    // PEDIDOS URGENTES PARA PROFISSIONAIS
    // ============================================
    
    const btnVerPedidosUrgentes = document.getElementById('btn-ver-pedidos-urgentes');
    const btnServicosAtivos = document.getElementById('btn-servicos-ativos');
    const modalPedidosUrgentesProfissional = document.getElementById('modal-pedidos-urgentes-profissional');
    const listaPedidosUrgentes = document.getElementById('lista-pedidos-urgentes');
    const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
    const listaServicosAtivos = document.getElementById('lista-servicos-ativos');
    const modalEnviarProposta = document.getElementById('modal-enviar-proposta');
    const formEnviarProposta = document.getElementById('form-enviar-proposta');

    // Remove instantaneamente um pedido da lista "Procurar pedidos" (sem precisar recarregar)
    window.removerPedidoUrgenteDaLista = function removerPedidoUrgenteDaLista(pedidoId) {
        try {
            if (!listaPedidosUrgentes || !pedidoId) return;

            // Dentro do card sempre existe algum elemento com data-pedido-id (ex: botões).
            // Removemos o card inteiro pelo closest.
            // Primeiro tenta pelo próprio card (agora ele tem data-pedido-id)
            const cardDireto = listaPedidosUrgentes.querySelector(`.pedido-urgente-card[data-pedido-id="${pedidoId}"]`);
            if (cardDireto) {
                cardDireto.remove();
            } else {
                // fallback: algum botão interno com data-pedido-id
                const alvo = listaPedidosUrgentes.querySelector(`[data-pedido-id="${pedidoId}"]`);
                const card = alvo ? alvo.closest('.pedido-urgente-card') : null;
                if (card) card.remove();
            }

            // Se a lista ficou vazia, mostra mensagem
            const aindaTemCard = listaPedidosUrgentes.querySelector('.pedido-urgente-card');
            if (!aindaTemCard) {
                listaPedidosUrgentes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhum pedido disponível no momento.</p>';
            }
        } catch (e) {
            console.warn('Falha ao remover pedido da lista:', e);
        }
    };

    async function carregarPedidosUrgentes(filtros = null) {
        if (!listaPedidosUrgentes) return;

        try {
            const currentUserType = localStorage.getItem('userType');
            const userId = localStorage.getItem('userId');
            
            // Qualquer usuário pode ver pedidos disponíveis e os que criou
            let url = '/api/pedidos-urgentes';
            let urlMeus = '/api/pedidos-urgentes/meus'; // URL para buscar os próprios pedidos

            // Compatibilidade: antes era categoria (select). Agora é busca por texto.
            // Aceita:
            // - carregarPedidosUrgentes() -> sem filtro
            // - carregarPedidosUrgentes({ q: 'baba' })
            // - carregarPedidosUrgentes('baba') (string)
            let q = '';
            let categoria = null;
            if (typeof filtros === 'string') {
                q = filtros;
            } else if (filtros && typeof filtros === 'object') {
                q = filtros.q || '';
                categoria = filtros.categoria || null;
            }

            const params = new URLSearchParams();
            if (categoria) params.set('categoria', categoria);
            if (q && String(q).trim()) params.set('q', String(q).trim());
            const qs = params.toString();
            if (qs) url += `?${qs}`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    // Se for 403, tenta buscar os pedidos do próprio usuário
                        const responseMeus = await fetch('/api/pedidos-urgentes/meus', {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (responseMeus.ok) {
                            const dataMeus = await responseMeus.json();
                            if (dataMeus.success) {
                                // Usa pedidosAtivos (já filtrados pela API)
                            let pedidosAbertos = dataMeus.pedidosAtivos || dataMeus.pedidos || [];
                            // Filtra pedidos cancelados
                            pedidosAbertos = pedidosAbertos.filter(p => p.status !== 'cancelado');
                                if (pedidosAbertos.length === 0) {
                                    listaPedidosUrgentes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem pedidos urgentes abertos.</p>';
                                    return;
                                }
                                // Renderiza os pedidos abertos
                                renderizarPedidos(pedidosAbertos);
                                return;
                        }
                    }
                    throw new Error('Acesso negado. Verifique se você está logado.');
                } else if (response.status === 401) {
                    throw new Error('Sessão expirada. Por favor, faça login novamente.');
                } else {
                    throw new Error(`Erro ao carregar pedidos: ${response.status}`);
                }
            }

            const data = await response.json();
            
            console.log('📦 Dados recebidos da API:', {
                success: data.success,
                pedidos: data.pedidos?.length || 0,
                pedidosAtivos: data.pedidosAtivos?.length || 0,
                pedidosExpirados: data.pedidosExpirados?.length || 0,
                currentUserType
            });
            
            if (data.success) {
                // Se for cliente, usa pedidosAtivos (já filtrados pela API)
                // Se for trabalhador, usa pedidos (já filtrados pela API)
                // Qualquer usuário pode ver pedidos
                let pedidos = (data.pedidosAtivos || data.pedidos || []);
                
                // Busca e combina com os próprios pedidos
                if (urlMeus) {
                    try {
                        const responseMeus = await fetch(urlMeus, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        if (responseMeus.ok) {
                            const dataMeus = await responseMeus.json();
                            if (dataMeus.success) {
                                let meusPedidos = dataMeus.pedidosAtivos || dataMeus.pedidos || [];
                                // Filtra pedidos cancelados
                                meusPedidos = meusPedidos.filter(p => p.status !== 'cancelado');
                                console.log('📦 Pedidos próprios encontrados (após filtrar cancelados):', meusPedidos.length);
                                // Combina os pedidos, removendo duplicatas por _id
                                const todosIds = new Set(pedidos.map(p => p._id.toString()));
                                meusPedidos.forEach(p => {
                                    if (!todosIds.has(p._id.toString())) {
                                        pedidos.push(p);
                                        todosIds.add(p._id.toString());
                                    }
                                });
                            }
                        }
                    } catch (err) {
                        console.warn('⚠️ Erro ao buscar próprios pedidos:', err);
                    }
                }
                
                console.log('📋 Pedidos para mostrar (antes do filtro):', pedidos.length);
                
                // Filtrar pedidos cancelados, concluídos e avaliados - não devem aparecer em "procurar pedidos"
                const pedidosComVerificacao = await Promise.all(
                    pedidos.map(async (p) => {
                        // Remove cancelados
                        if (p.status === 'cancelado') return null;

                        // ✅ Remove pedidos que já tiveram proposta aceita / em andamento
                        // (isso garante que o pedido saia do "Procurar pedidos" para TODOS, inclusive quem criou)
                        const temPropostaAceitaOuAndamento = Array.isArray(p.propostas) && p.propostas.some(prop =>
                            prop && (prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento')
                        );
                        if (temPropostaAceitaOuAndamento) return null;

                        // Se o status já virou em andamento, também não deve aparecer no "Procurar pedidos"
                        if (p.status === 'em_andamento') return null;
                        
                        // Remove concluídos que já foram avaliados
                        if (p.status === 'concluido') {
                            try {
                                const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${p._id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                if (avaliacaoResponse.ok) {
                                    const avaliacaoData = await avaliacaoResponse.json();
                                    const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && 
                                        Array.isArray(avaliacaoData.avaliacoes) && avaliacaoData.avaliacoes.length > 0;
                                    
                                    // Se foi avaliado, não mostra
                                    if (temAvaliacao) return null;
                                }
                            } catch (error) {
                                console.error('Erro ao verificar avaliação do pedido:', error);
                                // Em caso de erro, não mostra pedidos concluídos
                                return null;
                            }
                        }
                        
                        return p;
                    })
                );
                
                const pedidosFiltrados = pedidosComVerificacao.filter(p => p !== null);
                console.log('📋 Pedidos para mostrar (após filtrar cancelados, concluídos e avaliados):', pedidosFiltrados.length);
                
                if (pedidosFiltrados.length === 0) {
                    const mensagem = 'Nenhum pedido urgente disponível no momento.';
                    listaPedidosUrgentes.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--text-secondary);">${mensagem}</p>`;
                    return;
                }

                renderizarPedidos(pedidosFiltrados);
            } else {
                console.error('❌ API retornou success: false:', data);
                listaPedidosUrgentes.innerHTML = `<p style="color: var(--error-color); text-align: center; padding: 20px;">${data.message || 'Erro ao carregar pedidos.'}</p>`;
            }
        } catch (error) {
            console.error('Erro ao carregar pedidos urgentes:', error);
            listaPedidosUrgentes.innerHTML = `<p style="color: var(--error-color); text-align: center; padding: 20px;">${error.message || 'Erro ao carregar pedidos. Tente novamente.'}</p>`;
        }
    }
    
    // Torna a função acessível globalmente
    window.carregarPedidosUrgentes = carregarPedidosUrgentes;
    
    // Função auxiliar para renderizar pedidos
    function renderizarPedidos(pedidos) {
        if (!listaPedidosUrgentes) return;
        
        const userId = localStorage.getItem('userId');
        const userIdStr = userId ? String(userId) : '';
        
        listaPedidosUrgentes.innerHTML = pedidos.map(pedido => {
            const cliente = pedido.clienteId;
            // Pega o ID do cliente (pode ser objeto populado ou string)
            let clienteId = typeof cliente === 'object' && cliente !== null 
                ? (cliente._id || cliente.id) 
                : cliente;
            // Converte para string se necessário
            clienteId = clienteId ? String(clienteId) : '';
            const ehMeuPedido = clienteId === userIdStr;
            const tempoRestante = Math.max(0, Math.ceil((new Date(pedido.dataExpiracao) - new Date()) / 60000));
            const tipoAtendimento = pedido.tipoAtendimento || 'urgente';

            let infoAtendimentoHtml = '';
            if (tipoAtendimento === 'agendado' && pedido.dataAgendada) {
                const dataAgendada = new Date(pedido.dataAgendada);
                if (!isNaN(dataAgendada.getTime())) {
                    const dataBR = dataAgendada.toLocaleDateString('pt-BR');
                    const horaBR = dataAgendada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                    infoAtendimentoHtml = `
                        <div class="pedido-info-atendimento">
                            <i class="fas fa-calendar-alt"></i>
                            <span>Atendimento agendado para ${dataBR} às ${horaBR}</span>
                        </div>
                    `;
                }
            } else {
                infoAtendimentoHtml = `
                    <div class="pedido-info-atendimento">
                        <i class="fas fa-bolt"></i>
                        <span>Atendimento urgente</span>
                    </div>
                `;
            }
            
            return `
                <div class="pedido-urgente-card" data-pedido-id="${pedido._id}" style="overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                    <div class="pedido-cliente-header">
                        <img src="${cliente?.avatarUrl || cliente?.foto || 'imagens/default-user.png'}" 
                             alt="${cliente?.nome || 'Cliente'}" 
                             class="avatar-pequeno-pedido clickable-avatar"
                             data-cliente-id="${clienteId}"
                             style="cursor: pointer;">
                        <div style="flex: 1;">
                            <div class="nome-cliente-clickable" 
                                 data-cliente-id="${clienteId}"
                                 style="font-weight: 600; color: var(--primary-color); cursor: pointer; transition: color 0.2s;">
                                ${cliente?.nome || 'Cliente'}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; position: relative;">
                        <span class="tempo-restante">
                            ${tipoAtendimento === 'agendado' ? '<i class="fas fa-calendar-alt"></i> Agendado' : `⏱️ ${tempoRestante} min`}
                        </span>
                            ${ehMeuPedido ? `
                                <button class="btn-apagar-pedido-procurar" data-pedido-id="${pedido._id}" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px; padding: 4px; display: flex; align-items: center; justify-content: center;" title="Apagar pedido">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${pedido.foto || (pedido.fotos && pedido.fotos.length > 0) ? `
                        <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                            ${pedido.fotos && pedido.fotos.length > 0 ? 
                                pedido.fotos.map((foto, idx) => `
                                    <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                `).join('') :
                                `<img src="${pedido.foto}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${pedido.foto}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                            }
                        </div>
                    ` : ''}
                    
                    <div class="pedido-header">
                        <div>
                            <strong>${pedido.servico}</strong>
                        </div>
                    </div>
                    
                    ${infoAtendimentoHtml}
                    
                    ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                    
                    ${pedido.localizacao ? `
                        <div class="pedido-localizacao">
                            <i class="fas fa-map-marker-alt"></i> 
                            ${(() => {
                                // Monta endereço completo com todos os dados
                                const enderecoParts = [];
                                
                                // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                                const enderecoBase = pedido.localizacao.enderecoCompleto || pedido.localizacao.endereco || '';
                                const numero = pedido.localizacao.numero || '';
                                const bairro = pedido.localizacao.bairro || '';
                                
                                if (enderecoBase) {
                                    // Se tem endereço base, adiciona ele primeiro
                                    if (numero && !enderecoBase.includes(numero)) {
                                        // Se o número não está no endereço base, adiciona
                                        enderecoParts.push(`${enderecoBase}, ${numero}`);
                                    } else {
                                        enderecoParts.push(enderecoBase);
                                    }
                                } else {
                                    // Se não tem endereço base, monta a partir dos campos individuais
                                    const rua = pedido.localizacao.rua || '';
                                    if (rua) {
                                        if (numero) {
                                            enderecoParts.push(`${rua}, ${numero}`);
                                        } else {
                                            enderecoParts.push(rua);
                                        }
                                    } else if (numero) {
                                        // Se não tem rua mas tem número, adiciona apenas o número
                                        enderecoParts.push(numero);
                                    }
                                }
                                
                                // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                                if (bairro) {
                                    // Verifica se o bairro já não está no endereço base
                                    if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                                        enderecoParts.push(bairro);
                                    }
                                }
                                
                                const cidade = pedido.localizacao.cidade || '';
                                const estado = pedido.localizacao.estado || '';
                                if (cidade) enderecoParts.push(cidade);
                                if (estado) enderecoParts.push(estado);
                                
                                const pontoReferencia = pedido.localizacao.pontoReferencia || '';
                                
                                const enderecoTexto = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                                const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                                
                                return `
                                    <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                                       onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                                       onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                        ${enderecoTexto}
                                    </a>
                                    ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                                `;
                            })()}
                        </div>
                    ` : ''}
                    
                    ${!ehMeuPedido ? (() => {
                        const statusProposta = localStorage.getItem(`propostaStatus:${pedido._id}`) || '';
                        if (statusProposta === 'aguardando') {
                            return `
                                <button class="btn-enviar-proposta btn-proposta-aguardando" data-pedido-id="${pedido._id}" style="background: #6c757d;">
                                    <i class="fas fa-hourglass-half"></i> Aguardando
                                </button>
                            `;
                        }
                        return `
                            <button class="btn-enviar-proposta" data-pedido-id="${pedido._id}">
                                <i class="fas fa-paper-plane"></i> Enviar Proposta
                            </button>
                        `;
                    })() : ''}
                </div>
            `;
        }).join('');

        function setBotaoAguardando(pedidoId) {
            try { localStorage.setItem(`propostaStatus:${pedidoId}`, 'aguardando'); } catch (_) {}
            const btn = document.querySelector(`.btn-enviar-proposta[data-pedido-id="${pedidoId}"]`);
            if (!btn) return;
            btn.classList.add('btn-proposta-aguardando');
            btn.style.background = '#6c757d';
            btn.innerHTML = `<i class="fas fa-hourglass-half"></i> Aguardando`;
        }

        function setBotaoEnviarProposta(pedidoId) {
            try { localStorage.removeItem(`propostaStatus:${pedidoId}`); } catch (_) {}
            const btn = document.querySelector(`.btn-enviar-proposta[data-pedido-id="${pedidoId}"]`);
            if (!btn) return;
            btn.classList.remove('btn-proposta-aguardando');
            btn.style.background = '';
            btn.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Proposta`;
        }

        function fecharModalCancelarInline(container) {
            // Remove qualquer modal de cancelamento aberto (evita duplicidade)
            document.querySelectorAll('.modal-cancelar-proposta-inline').forEach((m) => m.remove());
        }

        function mostrarModalCancelarPropostaInline(btn, pedidoId) {
            const card = btn.closest('.pedido-urgente-card') || btn.parentElement;
            if (!card) return;

            // Remove modal anterior se existir
            fecharModalCancelarInline(card);

            // Cria modal (em body) para não ser cortado por overflow do card
            const modalInline = document.createElement('div');
            modalInline.className = 'modal-cancelar-proposta-inline';
            modalInline.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                background: var(--bg-primary, #fff);
                border: 1px solid var(--border-color, #ddd);
                border-radius: 8px;
                padding: 10px 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 99999;
                min-width: 160px;
                max-width: 200px;
                visibility: hidden;
            `;
            modalInline.innerHTML = `
                <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 10px 0; text-align: center;">
                    Deseja cancelar?
                </p>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button class="btn-confirmar-cancelar-proposta" style="padding:6px 10px; background:#dc3545; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
                        Sim
                    </button>
                    <button class="btn-fechar-cancelar-proposta" style="padding:6px 10px; background: var(--bg-secondary, #f0f0f0); color: var(--text-primary); border: 1px solid var(--border-color, #ddd); border-radius:6px; cursor:pointer; font-size:13px;">
                        Não
                    </button>
                </div>
            `;

            document.body.appendChild(modalInline);

            // Posiciona acima do botão (dentro da viewport)
            const rect = btn.getBoundingClientRect();
            const modalRect = modalInline.getBoundingClientRect();
            const gap = 8;
            let top = rect.top - modalRect.height - gap;
            // Se não couber acima, coloca abaixo (fallback)
            if (top < 8) {
                top = rect.bottom + gap;
            }
            let left = rect.right - modalRect.width;
            left = Math.max(8, Math.min(left, window.innerWidth - modalRect.width - 8));
            modalInline.style.left = `${left}px`;
            modalInline.style.top = `${top}px`;
            modalInline.style.visibility = 'visible';

            // Fecha ao clicar fora
            const outsideHandler = (ev) => {
                if (!modalInline.contains(ev.target) && ev.target !== btn) {
                    modalInline.remove();
                    document.removeEventListener('click', outsideHandler, true);
                }
            };
            document.addEventListener('click', outsideHandler, true);

            modalInline.querySelector('.btn-fechar-cancelar-proposta').addEventListener('click', (e) => {
                e.stopPropagation();
                modalInline.remove();
                document.removeEventListener('click', outsideHandler, true);
            });

            modalInline.querySelector('.btn-confirmar-cancelar-proposta').addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar-proposta`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data.success) {
                        throw new Error(data.message || `HTTP ${resp.status}`);
                    }

                    // Feedback leve
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = '<span class="check-animado">✔</span> Proposta cancelada.';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2000);

                    setBotaoEnviarProposta(pedidoId);
                    modalInline.remove();
                    document.removeEventListener('click', outsideHandler, true);
                } catch (err) {
                    console.error('Erro ao cancelar proposta:', err);
                    alert(err.message || 'Erro ao cancelar proposta.');
                }
            });
        }

        // Adicionar listeners para enviar/cancelar propostas
        document.querySelectorAll('.btn-enviar-proposta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const pedidoId = btn.dataset.pedidoId;
                if (!pedidoId) return;

                const isAguardando = btn.classList.contains('btn-proposta-aguardando') ||
                    (localStorage.getItem(`propostaStatus:${pedidoId}`) === 'aguardando');

                if (isAguardando) {
                    mostrarModalCancelarPropostaInline(btn, pedidoId);
                    return;
                }

                document.getElementById('proposta-pedido-id').value = pedidoId;
                modalEnviarProposta?.classList.remove('hidden');
                modalPedidosUrgentesProfissional?.classList.add('hidden');
            });
        });
        
        // Adicionar listeners para apagar pedidos (quando é do próprio usuário)
        document.querySelectorAll('.btn-apagar-pedido-procurar').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pedidoId = btn.dataset.pedidoId;
                const card = btn.closest('.pedido-urgente-card');
                const header = btn.closest('.pedido-cliente-header');
                
                // Remove modal anterior se existir
                const modalAnterior = card.querySelector('.modal-apagar-inline');
                if (modalAnterior) {
                    modalAnterior.remove();
                }
                
                // Cria modal inline abaixo do botão
                const modalInline = document.createElement('div');
                modalInline.className = 'modal-apagar-inline';
                modalInline.style.cssText = `
                    position: absolute;
                    right: 0;
                    top: 100%;
                    margin-top: 5px;
                    background: var(--bg-primary, #fff);
                    border: 1px solid var(--border-color, #ddd);
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    min-width: 200px;
                    max-width: 250px;
                `;
                modalInline.innerHTML = `
                    <p style="font-size: 13px; color: var(--text-secondary);text-align: center;">
                        Tem certeza?
                    </p>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px; text-align: center;">
                    Você cancelará o pedido!
                    </p>

                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-confirmar-apagar" data-pedido-id="${pedidoId}" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Apagar
                        </button>
                        <button class="btn-cancelar-apagar" style="padding: 6px 12px; background: var(--bg-secondary, #f0f0f0); color: var(--text-primary); border: 1px solid var(--border-color, #ddd); border-radius: 4px; cursor: pointer; font-size: 13px;">
                            Cancelar
                        </button>
                    </div>
                `;
                
                // Adiciona o modal ao header (já tem position: relative)
                header.style.position = 'relative';
                header.appendChild(modalInline);
                
                // Fecha ao clicar em cancelar
                modalInline.querySelector('.btn-cancelar-apagar').addEventListener('click', () => {
                    modalInline.remove();
                });
                
                // Confirma ao clicar em apagar
                modalInline.querySelector('.btn-confirmar-apagar').addEventListener('click', async () => {
                    try {
                        // Primeiro tenta cancelar normalmente
                        let resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        let data = await resp.json();
                        
                        // Se retornar erro porque tem proposta aceita, cancela o serviço automaticamente
                        if (!data.success && data.message && data.message.includes('proposta aceita')) {
                            resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar-servico`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ motivo: 'Pedido cancelado pelo criador' })
                            });
                            data = await resp.json();
                        }
                        
                        if (data.success) {
                            modalInline.remove();
                            const toast = document.createElement('div');
                            toast.className = 'toast-sucesso';
                            toast.innerHTML = '<span class="check-animado">✔</span> Pedido cancelado com sucesso.';
                            document.body.appendChild(toast);
                            setTimeout(() => toast.classList.add('show'), 10);
                            setTimeout(() => toast.remove(), 2500);
                            // Recarrega a lista de pedidos
                            await carregarPedidosUrgentes();
                        } else {
                            // Se o pedido já foi cancelado, não mostra erro, apenas recarrega
                            if (data.message && (data.message.includes('cancelado') || data.message.includes('já foi'))) {
                                modalInline.remove();
                                await carregarPedidosUrgentes();
                            } else {
                                alert(data.message || 'Erro ao cancelar pedido.');
                                modalInline.remove();
                            }
                        }
                    } catch (error) {
                        console.error('Erro ao cancelar pedido:', error);
                        alert('Erro ao cancelar pedido.');
                        modalInline.remove();
                    }
                });
                
                // Fecha ao clicar fora
                setTimeout(() => {
                    const fecharAoClicarFora = (e) => {
                        if (!modalInline.contains(e.target) && !btn.contains(e.target)) {
                            modalInline.remove();
                            document.removeEventListener('click', fecharAoClicarFora);
                        }
                    };
                    document.addEventListener('click', fecharAoClicarFora);
                }, 10);
            });
        });

        // Adicionar listeners para nome e avatar clicáveis (abrir perfil)
        // IMPORTANTE: Usar capture phase para executar ANTES do listener de delegação
        document.querySelectorAll('.nome-cliente-clickable, .clickable-avatar, .avatar-pequeno-pedido').forEach(element => {
            // Remover listeners anteriores clonando o elemento
            const novoElement = element.cloneNode(true);
            element.parentNode.replaceChild(novoElement, element);
            
            const novoListener = (e) => {
                e.stopPropagation(); // Evita que o clique se propague
                e.preventDefault(); // Previne comportamento padrão
                e.stopImmediatePropagation(); // Impede que outros listeners sejam executados
                
                // Fechar modal de imagem se estiver aberto antes de navegar
                if (typeof window.fecharModalImagem === 'function') {
                    window.fecharModalImagem();
                }
                
                const clienteId = novoElement.dataset.clienteId;
                if (clienteId) {
                    console.log('👤 Abrindo perfil do cliente:', clienteId);
                    // Navegar imediatamente, sem delay
                    window.location.href = `/perfil?id=${clienteId}`;
                }
            };
            novoElement.addEventListener('click', novoListener, true); // Capture phase - executa ANTES
        });

        // Adicionar listeners para fotos clicáveis (abrir modal)
        document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const fotoUrl = img.dataset.fotoUrl || img.src;
                console.log('🖼️ Clicou na foto:', fotoUrl);
                if (typeof window.abrirModalImagem === 'function') {
                    window.abrirModalImagem(fotoUrl);
                } else {
                    console.error('❌ Função abrirModalImagem não encontrada');
                }
            });
        });
    }

    const filtroBuscaPedidos = document.getElementById('filtro-busca-pedidos');
    const btnLimparBuscaPedidos = document.getElementById('btn-limpar-busca-pedidos');

    // Busca ao digitar (typeahead) com debounce
    let debounceBuscaPedidosTimer = null;
    const debounceBuscaPedidosMs = 250;

    function syncBtnLimparBuscaPedidos() {
        if (!btnLimparBuscaPedidos) return;
        const v = filtroBuscaPedidos ? (filtroBuscaPedidos.value || '').trim() : '';
        btnLimparBuscaPedidos.style.display = v ? 'inline-flex' : 'none';
    }

    if (filtroBuscaPedidos) {
        filtroBuscaPedidos.addEventListener('input', () => {
            const q = filtroBuscaPedidos.value || '';
            syncBtnLimparBuscaPedidos();

            if (debounceBuscaPedidosTimer) clearTimeout(debounceBuscaPedidosTimer);
            debounceBuscaPedidosTimer = setTimeout(async () => {
                await carregarPedidosUrgentes({ q });
            }, debounceBuscaPedidosMs);
        });
        // Estado inicial do botão
        syncBtnLimparBuscaPedidos();
    }

    if (btnLimparBuscaPedidos) {
        btnLimparBuscaPedidos.addEventListener('click', async () => {
            if (filtroBuscaPedidos) filtroBuscaPedidos.value = '';
            syncBtnLimparBuscaPedidos();
            await carregarPedidosUrgentes({ q: '' });
            if (filtroBuscaPedidos) filtroBuscaPedidos.focus();
        });
    }

    // Adicionar botão "Procurar pedidos" para TODAS as contas (trabalhador e cliente)
    function adicionarBotoesAcaoRapida() {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (!acoesRapidas) {
            console.warn('⚠️ Seção .filtro-acoes-rapidas não encontrada, tentando novamente...');
            return false;
        }
        
        console.log('✅ Seção .filtro-acoes-rapidas encontrada:', acoesRapidas);
        
        let currentUserType = localStorage.getItem('userType');
        console.log('🔍 Verificando userType (localStorage):', currentUserType);
        
        // Cria o botão imediatamente (não depende do userType)
        const botaoCriado = criarBotaoProcurarPedidos(acoesRapidas);
        
        // Se não encontrou no localStorage, tenta buscar do servidor (para uso futuro)
        if (!currentUserType) {
            console.warn('⚠️ userType não encontrado no localStorage, tentando buscar do servidor...');
            fetch('/api/user/me', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
                }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.user && data.user.tipo) {
                    currentUserType = data.user.tipo;
                    localStorage.setItem('userType', currentUserType);
                    console.log('✅ userType atualizado do servidor:', currentUserType);
                }
            })
            .catch(err => {
                console.error('❌ Erro ao buscar userType do servidor:', err);
            });
        }
        
        return botaoCriado;
    }
    
    // Função auxiliar para criar o botão "Procurar pedidos"
    function criarBotaoProcurarPedidos(acoesRapidas) {
        if (!acoesRapidas) {
            console.error('❌ acoesRapidas não fornecido para criarBotaoProcurarPedidos');
            return false;
        }
        
        // Verificar se o botão já existe antes de criar
        let btnVerPedidos = document.getElementById('btn-ver-pedidos-urgentes');
        if (!btnVerPedidos) {
            console.log('✅ Criando botão "Procurar pedidos" (disponível para todas as contas)');
            btnVerPedidos = document.createElement('button');
            btnVerPedidos.id = 'btn-ver-pedidos-urgentes';
            btnVerPedidos.className = 'btn-acao-lateral';
            btnVerPedidos.innerHTML = '<i class="fas fa-bolt"></i> Procurar pedidos';
            btnVerPedidos.style.marginTop = '10px';
            btnVerPedidos.style.width = '100%';
            btnVerPedidos.style.display = 'block';
            
            // Adicionar event listener antes de adicionar ao DOM
            btnVerPedidos.addEventListener('click', async () => {
                // Sempre abre no estado “sem busca”
                const filtroBuscaPedidos = document.getElementById('filtro-busca-pedidos');
                const btnLimparBuscaPedidos = document.getElementById('btn-limpar-busca-pedidos');
                if (filtroBuscaPedidos) filtroBuscaPedidos.value = '';
                if (btnLimparBuscaPedidos) btnLimparBuscaPedidos.style.display = 'none';
                await carregarPedidosUrgentes({ q: '' });
                const modal = document.getElementById('modal-pedidos-urgentes-profissional');
                if (modal) modal.classList.remove('hidden');
            });
            
            // Adicionar ao DOM
            acoesRapidas.appendChild(btnVerPedidos);
            
            // Verificar se foi adicionado corretamente
            const verificarBotao = document.getElementById('btn-ver-pedidos-urgentes');
            if (verificarBotao && verificarBotao.parentElement === acoesRapidas) {
                console.log('✅ Botão "Procurar pedidos" criado e adicionado com sucesso');
                return true;
            } else {
                console.error('❌ Botão "Procurar pedidos" não foi adicionado corretamente ao DOM');
                return false;
            }
        } else {
            console.log('⚠️ Botão "Procurar pedidos" já existe');
            // Verificar se está no lugar correto
            if (btnVerPedidos.parentElement !== acoesRapidas) {
                console.warn('⚠️ Botão existe mas não está em .filtro-acoes-rapidas, movendo...');
                acoesRapidas.appendChild(btnVerPedidos);
            }
            return true;
        }
    }
    
    // Executar após o DOM estar completamente carregado
    // Múltiplos delays para garantir que o DOM esteja pronto
    let botaoAdicionadoComSucesso = false;
    
    function tentarAdicionarBotao() {
        // Se já foi adicionado com sucesso, não tenta novamente
        if (botaoAdicionadoComSucesso) {
            const botao = document.getElementById('btn-ver-pedidos-urgentes');
            if (botao && botao.parentElement) {
                return true;
            } else {
                // Botão foi removido, precisa recriar
                botaoAdicionadoComSucesso = false;
            }
        }
        
        const sucesso = adicionarBotoesAcaoRapida();
        if (sucesso) {
            botaoAdicionadoComSucesso = true;
        } else {
            console.warn('⚠️ Falha ao adicionar botão, tentando novamente...');
        }
        return sucesso;
    }
    
    // Tentar imediatamente se DOM já está pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            tentarAdicionarBotao();
        });
    } else {
        tentarAdicionarBotao();
    }
    
    // Múltiplos delays para garantir que o DOM esteja pronto
    setTimeout(() => {
        if (!botaoAdicionadoComSucesso) tentarAdicionarBotao();
    }, 100);
    setTimeout(() => {
        if (!botaoAdicionadoComSucesso) tentarAdicionarBotao();
    }, 500);
    setTimeout(() => {
        if (!botaoAdicionadoComSucesso) tentarAdicionarBotao();
    }, 1000);
    setTimeout(() => {
        if (!botaoAdicionadoComSucesso) tentarAdicionarBotao();
    }, 2000);
    
    // Observer para detectar quando o elemento .filtro-acoes-rapidas é adicionado ao DOM
    // E também detectar se o botão foi removido
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Verifica se algum nó foi adicionado
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    if (node.classList && node.classList.contains('filtro-acoes-rapidas')) {
                        console.log('✅ Elemento .filtro-acoes-rapidas detectado no DOM');
                        if (!botaoAdicionadoComSucesso) {
                            tentarAdicionarBotao();
                        }
                    }
                    // Verificar se o elemento foi adicionado dentro de outro elemento
                    const acoesRapidas = node.querySelector && node.querySelector('.filtro-acoes-rapidas');
                    if (acoesRapidas && !botaoAdicionadoComSucesso) {
                        console.log('✅ Elemento .filtro-acoes-rapidas encontrado dentro de elemento adicionado');
                        tentarAdicionarBotao();
                    }
                }
            });
            
            // Verifica se algum nó foi removido (pode ser o botão)
            mutation.removedNodes.forEach((node) => {
                if (node.nodeType === 1) {
                    // Se o botão foi removido, marca como não adicionado para recriar
                    if (node.id === 'btn-ver-pedidos-urgentes' || node.querySelector && node.querySelector('#btn-ver-pedidos-urgentes')) {
                        console.warn('⚠️ Botão "Procurar pedidos" foi removido, será recriado');
                        botaoAdicionadoComSucesso = false;
                        // Tenta recriar após um pequeno delay
                        setTimeout(() => {
                            tentarAdicionarBotao();
                        }, 100);
                    }
                }
            });
        });
        
        // Verifica periodicamente se o botão ainda existe
        const btnVerPedidos = document.getElementById('btn-ver-pedidos-urgentes');
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        if (acoesRapidas && !btnVerPedidos && botaoAdicionadoComSucesso) {
            console.warn('⚠️ Botão "Procurar pedidos" não encontrado, recriando...');
            botaoAdicionadoComSucesso = false;
            tentarAdicionarBotao();
        }
    });
    
    // Observar mudanças no body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Verificação periódica adicional para garantir que o botão existe
    setInterval(() => {
        const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
        const btnVerPedidos = document.getElementById('btn-ver-pedidos-urgentes');
        if (acoesRapidas && !btnVerPedidos) {
            console.warn('⚠️ Botão "Procurar pedidos" não encontrado, recriando...');
            botaoAdicionadoComSucesso = false;
            tentarAdicionarBotao();
        }
    }, 3000); // Verifica a cada 3 segundos
    // Clique no botão de serviços ativos dentro do modal de pedidos urgentes
    if (btnServicosAtivos) {
        btnServicosAtivos.addEventListener('click', async () => {
            window.mostrandoCanceladosServicosAtivos = false;
            const btnVerCancelados = document.getElementById('btn-ver-cancelados');
            if (btnVerCancelados) {
                btnVerCancelados.innerHTML = '<i class="fas fa-archive"></i> Arquivados';
            }
            await carregarServicosAtivos(null, false);
            modalServicosAtivos?.classList.remove('hidden');
        });
    }
    
    // Clique no botão de ver cancelados
    const btnVerCancelados = document.getElementById('btn-ver-cancelados');
    window.mostrandoCanceladosServicosAtivos = false;
    if (btnVerCancelados) {
        btnVerCancelados.addEventListener('click', async () => {
            window.mostrandoCanceladosServicosAtivos = !window.mostrandoCanceladosServicosAtivos;
            await carregarServicosAtivos(null, window.mostrandoCanceladosServicosAtivos);
            // Atualiza o texto do botão
            if (window.mostrandoCanceladosServicosAtivos) {
                btnVerCancelados.innerHTML = '<i class="fas fa-arrow-left"></i> Voltar';
            } else {
                btnVerCancelados.innerHTML = '<i class="fas fa-archive"></i> Arquivados';
            }
        });
    }

    // Função para carregar meus serviços ativos (pedidos que EU criei)
    // Tornada global para uso em header-notificacoes.js
    async function carregarServicosAtivos(pedidoIdDestacado = null, mostrarCancelados = false) {
        if (!listaServicosAtivos) return;

        try {
            const userId = localStorage.getItem('userId');
            const userType = localStorage.getItem('userType');
            const userIdStr = userId ? String(userId) : '';
            
            // Busca os pedidos que EU criei (independente do tipo de conta)
            const response = await fetch('/api/pedidos-urgentes/meus', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            let data = await response.json();
            
            // Qualquer usuário pode ter pedidos onde teve proposta aceita
            // Busca pedidos onde o profissional atual tem proposta aceita
            try {
                // Busca pedidos ativos (não cancelados/concluídos)
                const responseAtivos = await fetch('/api/pedidos-urgentes/ativos', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log(`🔍 Buscando pedidos ativos para profissional ${userIdStr}, resposta status: ${responseAtivos.status}`);
                
                if (responseAtivos.ok) {
                    const dataAtivos = await responseAtivos.json();
                    console.log(`📦 Resposta da API /api/pedidos-urgentes/ativos:`, {
                        success: dataAtivos.success,
                        numPedidos: dataAtivos.pedidos?.length || 0
                    });
                    
                    if (dataAtivos.success && dataAtivos.pedidos && dataAtivos.pedidos.length > 0) {
                        // Combina os pedidos, removendo duplicatas
                        const meusPedidosIds = new Set((data.pedidos || []).map(p => p._id.toString()));
                        const pedidosComPropostaAceita = (dataAtivos.pedidos || []).filter(p => {
                            const pedidoId = p._id.toString();
                            // Verifica se o profissional tem proposta aceita neste pedido
                            const temPropostaAceita = (p.propostas || []).some(prop => {
                                // Tenta diferentes formas de acessar o profissionalId
                                let propProfId = null;
                                if (prop.profissionalId) {
                                    if (typeof prop.profissionalId === 'object') {
                                        propProfId = prop.profissionalId._id?.toString() || prop.profissionalId.id?.toString() || prop.profissionalId.toString();
                                    } else {
                                        propProfId = String(prop.profissionalId);
                                    }
                                }
                                const statusAceito = prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento';
                                const ehMeuProfissional = propProfId && String(propProfId) === userIdStr;
                                return ehMeuProfissional && statusAceito;
                            });
                            const naoEhMeuPedido = !meusPedidosIds.has(pedidoId);
                            if (temPropostaAceita && naoEhMeuPedido) {
                                console.log(`✅ Pedido ${pedidoId} tem proposta aceita do profissional ${userIdStr} - será adicionado`);
                            }
                            return temPropostaAceita && naoEhMeuPedido;
                        });
                        
                        // Adiciona os pedidos onde o profissional tem proposta aceita
                        if (pedidosComPropostaAceita.length > 0) {
                            data.pedidos = [...(data.pedidos || []), ...pedidosComPropostaAceita];
                            console.log(`✅ Adicionados ${pedidosComPropostaAceita.length} pedidos onde o profissional tem proposta aceita`);
                        }
                    } else {
                        console.log(`⚠️ API retornou sucesso mas sem pedidos ou array vazio`);
                    }
                } else {
                    console.log(`⚠️ Resposta da API não foi OK: ${responseAtivos.status}`);
                    const errorText = await responseAtivos.text();
                    console.log(`⚠️ Erro da API:`, errorText);
                }
            } catch (fetchError) {
                console.error('❌ Erro ao buscar pedidos ativos:', fetchError);
            }
            
            // Busca pedidos cancelados/concluídos onde o profissional teve proposta aceita
            // Isso garante que pedidos concluídos apareçam em arquivados mesmo que não estejam na lista inicial
            try {
                const responseCancelados = await fetch('/api/pedidos-urgentes/arquivados-profissional', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (responseCancelados.ok) {
                    const dataCancelados = await responseCancelados.json();
                    if (dataCancelados.success && dataCancelados.pedidos && dataCancelados.pedidos.length > 0) {
                        const meusPedidosIds = new Set((data.pedidos || []).map(p => p._id.toString()));
                        const pedidosCanceladosProf = (dataCancelados.pedidos || []).filter(p => {
                            const pedidoId = p._id.toString();
                            return !meusPedidosIds.has(pedidoId);
                        });
                        
                        // Adiciona os pedidos cancelados/concluídos onde o profissional tem proposta aceita
                        if (pedidosCanceladosProf.length > 0) {
                            data.pedidos = [...(data.pedidos || []), ...pedidosCanceladosProf];
                            console.log(`✅ Adicionados ${pedidosCanceladosProf.length} pedidos cancelados/concluídos onde o profissional tem proposta aceita`);
                        }
                    }
                }
            } catch (fetchError) {
                console.error('❌ Erro ao buscar pedidos cancelados:', fetchError);
            }
            
            // Garantir que pedidos concluídos da API também sejam incluídos em pedidosCancelados
            // Isso é importante para quando mostrar arquivados
            const pedidosConcluidosDaAPI = (data.pedidos || []).filter(p => p.status === 'concluido');
            if (pedidosConcluidosDaAPI.length > 0) {
                console.log(`📋 Encontrados ${pedidosConcluidosDaAPI.length} pedidos concluídos da API que serão processados`);
            }

            console.log('📦 Dados recebidos da API (serviços ativos):', {
                success: data.success,
                pedidos: data.pedidos?.length || 0,
                pedidosAtivos: data.pedidosAtivos?.length || 0,
                pedidosExpirados: data.pedidosExpirados?.length || 0
            });

            if (!data.success) {
                listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar meus serviços ativos.</p>';
                return;
            }

            const agora = new Date();
            const todosPedidos = data.pedidos || [];
            const pedidosAtivosAPI = data.pedidosAtivos || [];
            const pedidosExpiradosAPI = data.pedidosExpirados || [];
            
            // Separar pedidos em ativos e cancelados/expirados
            let pedidosAtivos = [];
            let pedidosCancelados = [];
            
            // Função auxiliar para extrair profissionalId de uma proposta (definida fora do loop para reutilização)
            const extrairProfissionalId = (prop) => {
                if (!prop.profissionalId) return null;
                if (typeof prop.profissionalId === 'object') {
                    return prop.profissionalId._id?.toString() || prop.profissionalId.id?.toString() || prop.profissionalId.toString();
                }
                return String(prop.profissionalId);
            };
            
            todosPedidos.forEach(p => {
                const dataExpiracao = p.dataExpiracao ? new Date(p.dataExpiracao) : null;
                const expirado = dataExpiracao && dataExpiracao <= agora;
                const cancelado = p.status === 'cancelado';
                const concluido = p.status === 'concluido';
                
                // Verifica se o usuário é cliente ou profissional
                const clienteId = p.clienteId?._id?.toString() || p.clienteId?.toString() || p.clienteId;
                const clienteIdStr = clienteId ? String(clienteId) : '';
                const ehCliente = clienteIdStr === userIdStr;
                
                // Contar propostas ativas (não canceladas, não rejeitadas)
                const propostasAtivas = (p.propostas || []).filter(prop =>
                    prop.status !== 'cancelada' && prop.status !== 'cancelado' &&
                    prop.status !== 'rejeitada' && prop.status !== 'rejeitado' &&
                    prop.status !== 'recusada' && prop.status !== 'recusado'
                );
                const temPropostasAtivas = propostasAtivas.length > 0;
                
                // Verifica se o profissional atual tem proposta aceita neste pedido
                const temPropostaAceitaProf = propostasAtivas.some(prop => {
                    const propProfId = extrairProfissionalId(prop);
                    const statusAceito = prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento';
                    const ehMinhaProposta = propProfId && String(propProfId) === userIdStr;
                    return ehMinhaProposta && statusAceito;
                });
                
                // Determina se é profissional (não é cliente E tem proposta aceita)
                const ehProfissional = !ehCliente && temPropostaAceitaProf;
                
                // Verifica se tem proposta aceita (qualquer uma para cliente, ou do profissional atual para profissional)
                let temPropostaAceita = false;
                if (ehCliente) {
                    // Cliente vê qualquer proposta aceita
                    temPropostaAceita = propostasAtivas.some(prop =>
                        prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                    );
                } else if (ehProfissional) {
                    // Profissional vê apenas sua própria proposta aceita
                    temPropostaAceita = temPropostaAceitaProf;
                }
                
                // Debug: verificar propostas do pedido
                if (p.propostas && p.propostas.length > 0) {
                    const propostasDebug = p.propostas.map(prop => {
                        const propProfId = extrairProfissionalId(prop);
                        return {
                            status: prop.status,
                            profissionalId: propProfId,
                            ehMeuProfissional: propProfId === userIdStr
                        };
                    });
                    console.log(`🔍 Pedido ${p._id} (${p.servico}):`, {
                    status: p.status,
                        numPropostas: p.propostas.length,
                        propostas: propostasDebug,
                        userIdStr,
                        ehCliente,
                        ehProfissional,
                        temPropostaAceitaProf,
                        temPropostaAceita
                    });
                }
                
                // Debug: verificar se tem proposta aceita
                if (temPropostaAceita) {
                    console.log(`✅ Pedido ${p._id} tem proposta aceita - ehCliente: ${ehCliente}, ehProfissional: ${ehProfissional}, temPropostaAceitaProf: ${temPropostaAceitaProf}`);
                }
                
                // PRIORIDADE 1: Cancelados sempre vão para cancelados
                // Concluídos vão para ativos se não foram avaliados, ou para cancelados se já foram avaliados
                if (cancelado) {
                    // Adiciona aos cancelados se for o cliente OU se for o profissional com proposta aceita
                    if (ehCliente || (ehProfissional && temPropostaAceita)) {
                        const motivo = p.motivoCancelamento || 'CANCELADO';
                        pedidosCancelados.push({...p, motivoCancelamento: motivo});
                    }
                } else if (concluido) {
                    // Pedidos concluídos: verificar se foram avaliados
                    // Se não foram avaliados, vão para ativos (será verificado depois)
                    // Se foram avaliados, vão para cancelados
                    if (ehCliente || (ehProfissional && temPropostaAceita)) {
                        // Marca para verificar avaliação depois
                        pedidosAtivos.push({...p, status: 'concluido', precisaVerificarAvaliacao: true});
                    }
                } else if (expirado && !temPropostasAtivas) {
                    // Expirado sem propostas vai para cancelados com EXPIRADA
                    if (ehCliente || (ehProfissional && temPropostaAceita)) {
                        pedidosCancelados.push({...p, motivoCancelamento: 'EXPIRADA'});
                    }
                } else if (ehProfissional && temPropostaAceita) {
                    // Profissional vê pedidos onde tem proposta aceita (e não está cancelado/concluído)
                    console.log(`✅ Adicionando pedido ${p._id} aos ativos para o profissional (ehProfissional: ${ehProfissional}, temPropostaAceita: ${temPropostaAceita})`);
                    pedidosAtivos.push(p);
                } else if (ehCliente && temPropostaAceita) {
                    // Cliente vê pedidos onde tem proposta aceita (e não está cancelado/concluído)
                    pedidosAtivos.push(p);
                } else if (ehCliente && temPropostasAtivas) {
                    // Cliente vê pedidos com propostas ativas
                    pedidosAtivos.push(p);
                } else if (ehCliente && !expirado) {
                    // Cliente vê pedidos não expirados sem propostas
                    pedidosAtivos.push(p);
                }
                
                // FALLBACK: Se é profissional com proposta aceita mas não foi adicionado ainda, adiciona
                if (!ehCliente && temPropostaAceitaProf && !cancelado && !concluido) {
                    const jaAdicionado = pedidosAtivos.some(pa => pa._id.toString() === p._id.toString());
                    if (!jaAdicionado) {
                        console.log(`⚠️ FALLBACK: Pedido ${p._id} não foi adicionado anteriormente, adicionando agora para o profissional`);
                        pedidosAtivos.push(p);
                    }
                }
            });
            
            console.log('📊 Resultado do filtro de serviços ativos:', {
                totalPedidos: todosPedidos.length,
                pedidosAtivos: pedidosAtivos.length,
                pedidosCancelados: pedidosCancelados.length
            });
            
            // Se está mostrando arquivados, garantir que pedidos concluídos da API também estejam incluídos
            if (mostrarCancelados) {
                // Buscar pedidos concluídos da API que podem não estar em pedidosCancelados ainda
                const pedidosConcluidosDaAPI = todosPedidos.filter(p => {
                    const concluido = p.status === 'concluido';
                    if (!concluido) return false;
                    
                    // Verificar se já está em pedidosCancelados
                    const jaEstaEmCancelados = pedidosCancelados.some(pc => pc._id.toString() === p._id.toString());
                    if (jaEstaEmCancelados) return false;
                    
                    // Verificar se o usuário tem acesso (cliente ou profissional com proposta aceita)
                    const clienteId = p.clienteId?._id?.toString() || p.clienteId?.toString() || p.clienteId;
                    const clienteIdStr = clienteId ? String(clienteId) : '';
                    const ehCliente = clienteIdStr === userIdStr;
                    
                    const propostasAtivas = (p.propostas || []).filter(prop =>
                        prop.status !== 'cancelada' && prop.status !== 'cancelado' &&
                        prop.status !== 'rejeitada' && prop.status !== 'rejeitado' &&
                        prop.status !== 'rejeitada' && prop.status !== 'rejeitado' &&
                        prop.status !== 'recusada' && prop.status !== 'recusado'
                    );
                    
                    const temPropostaAceitaProf = propostasAtivas.some(prop => {
                        const propProfId = extrairProfissionalId(prop);
                        return propProfId === userIdStr && (prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento');
                    });
                    
                    return ehCliente || temPropostaAceitaProf;
                });
                
                // Adicionar pedidos concluídos da API aos cancelados se ainda não estiverem lá
                if (pedidosConcluidosDaAPI.length > 0) {
                    pedidosConcluidosDaAPI.forEach(p => {
                        const jaEsta = pedidosCancelados.some(pc => pc._id.toString() === p._id.toString());
                        if (!jaEsta) {
                            pedidosCancelados.push({...p, motivoCancelamento: 'CONCLUIDO'});
                        }
                    });
                    console.log(`✅ Adicionados ${pedidosConcluidosDaAPI.length} pedidos concluídos da API aos arquivados`);
                }
                
                if (pedidosCancelados.length === 0) {
                    listaServicosAtivos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você não tem pedidos arquivados.</p>';
                    if (modalServicosAtivos) {
                        modalServicosAtivos.classList.remove('hidden');
                    }
                    return;
                }
                
                listaServicosAtivos.innerHTML = pedidosCancelados.map(pedido => {
                    // Verifica se o usuário atual é o cliente (criador) ou o profissional
                    const clienteId = pedido.clienteId?._id?.toString() || pedido.clienteId?.toString() || pedido.clienteId;
                    const clienteIdStr = clienteId ? String(clienteId) : '';
                    const ehCliente = clienteIdStr === userIdStr;
                    
                    // Encontra a proposta aceita para mostrar o profissional
                    const propostaAceita = pedido.propostas?.find(prop => 
                        prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                    );
                    const profissional = propostaAceita?.profissionalId || null;
                    // Tenta diferentes formas de acessar o profissionalId
                    let profissionalId = null;
                    if (profissional) {
                        if (typeof profissional === 'object') {
                            profissionalId = profissional._id?.toString() || profissional.id?.toString() || profissional.toString();
                        } else {
                            profissionalId = String(profissional);
                        }
                    }
                    const profissionalIdStr = profissionalId ? String(profissionalId) : '';
                    const ehProfissional = profissionalIdStr === userIdStr;
                    
                    const endereco = pedido.localizacao || {};
                    // Monta endereço completo com todos os dados
                    const enderecoParts = [];
                    
                    // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                    const enderecoBase = endereco.enderecoCompleto || endereco.endereco || '';
                    const numero = endereco.numero || '';
                    const bairro = endereco.bairro || '';
                    
                    if (enderecoBase) {
                        // Se tem endereço base, adiciona ele primeiro
                        if (numero && !enderecoBase.includes(numero)) {
                            // Se o número não está no endereço base, adiciona
                            enderecoParts.push(`${enderecoBase}, ${numero}`);
                        } else {
                            enderecoParts.push(enderecoBase);
                        }
                    } else {
                        // Se não tem endereço base, monta a partir dos campos individuais
                        const rua = endereco.rua || '';
                        if (rua) {
                            if (numero) {
                                enderecoParts.push(`${rua}, ${numero}`);
                            } else {
                                enderecoParts.push(rua);
                            }
                        } else if (numero) {
                            // Se não tem rua mas tem número, adiciona apenas o número
                            enderecoParts.push(numero);
                        }
                    }
                    
                    // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                    if (bairro) {
                        // Verifica se o bairro já não está no endereço base
                        if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                            enderecoParts.push(bairro);
                        }
                    }
                    
                    const cidade = endereco.cidade || '';
                    const estado = endereco.estado || '';
                    if (cidade) enderecoParts.push(cidade);
                    if (estado) enderecoParts.push(estado);
                    
                    const pontoReferencia = endereco.pontoReferencia || '';
                    const enderecoFormatado = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                    // Para o mapa, não inclui ponto de referência
                    const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                    const fotoServico = pedido.foto || '';
                    const motivoStatus = pedido.motivoCancelamento || 'Cancelado';
                    const motivoTexto = pedido.motivoCancelamento && pedido.motivoCancelamento !== 'CANCELADO' && 
                                        pedido.motivoCancelamento !== 'CONCLUIDO' && 
                                        pedido.motivoCancelamento !== 'EXPIRADA' 
                                        ? pedido.motivoCancelamento : null;
                    const statusTexto = motivoStatus === 'EXPIRADA' ? 'EXPIRADA' : 
                                       motivoStatus === 'CONCLUIDO' ? 'CONCLUIDO' : 
                                       'CANCELADO';
                    const badgeClass = motivoStatus === 'CONCLUIDO' ? 'badge-concluido' : 
                                      motivoStatus === 'EXPIRADA' ? 'badge-cancelado' : 
                                      'badge-cancelado';
                    const badgeStyle = motivoStatus === 'CONCLUIDO' ? 'background: #28a745; color: #fff;' : '';
                    
                    return `
                        <div class="pedido-urgente-card" data-pedido-id="${pedido._id}" style="opacity: 0.7;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <div>
                                    <strong style="font-size:16px;">${pedido.servico}</strong>
                                </div>
                                <span class="badge-status ${badgeClass}" style="${badgeStyle}">${statusTexto}</span>
                            </div>
                            ${motivoTexto ? `
                                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px; color: #856404;">
                                    <strong>Motivo:</strong> ${motivoTexto}
                                </div>
                            ` : ''}
                            ${ehCliente && profissional ? `
                                <p style="margin:4px 0; color: var(--text-secondary);">
                                    <i class="fas fa-user-tie"></i> Profissional: 
                                    <a href="/perfil?id=${profissionalIdStr || profissional._id || profissional.id || ''}" 
                                       style="color: inherit; text-decoration: none; font-weight: 600; cursor: pointer;">
                                        ${profissional.nome || 'Profissional'}
                                    </a>
                                </p>
                            ` : ''}
                            ${ehProfissional ? `
                                <p style="margin:4px 0; color: var(--text-secondary);">
                                    <i class="fas fa-user"></i> Cliente: ${pedido.clienteId?.nome || 'Cliente'}
                                </p>
                            ` : ''}
                            <p style="margin:4px 0;">
                                <i class="fas fa-map-marker-alt"></i> 
                                <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                                   target="_blank" 
                                   rel="noopener noreferrer"
                                   style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                                   onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                                   onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                    ${enderecoFormatado}
                                </a>
                            </p>
                            ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                            ${fotoServico || (pedido.fotos && pedido.fotos.length > 0) ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0;">
                                    ${pedido.fotos && pedido.fotos.length > 0 ? 
                                        pedido.fotos.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px;" loading="lazy">
                                        `).join('') :
                                        `<img src="${fotoServico}" alt="Foto do serviço" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px;" loading="lazy">`
                                    }
                                </div>
                            ` : ''}
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                        </div>
                    `;
                }).join('');
                
                if (modalServicosAtivos) {
                    modalServicosAtivos.classList.remove('hidden');
                }
                return;
            }
            
            // Verificar avaliação para pedidos concluídos que precisam ser verificados
            const pedidosParaVerificarAvaliacao = pedidosAtivos.filter(p => p.precisaVerificarAvaliacao);
            if (pedidosParaVerificarAvaliacao.length > 0) {
                console.log(`🔍 Verificando avaliação para ${pedidosParaVerificarAvaliacao.length} pedidos concluídos...`);
                
                const pedidosComAvaliacaoVerificada = await Promise.all(
                    pedidosParaVerificarAvaliacao.map(async (pedido) => {
                        try {
                            const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            if (avaliacaoResponse.ok) {
                                const avaliacaoData = await avaliacaoResponse.json();
                                
                                // Verificar se há avaliação para este pedido (independente de quem fez)
                                // Se houver qualquer avaliação, o pedido foi concluído e avaliado
                                const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && Array.isArray(avaliacaoData.avaliacoes) && avaliacaoData.avaliacoes.length > 0;
                                
                                // Verificar se o usuário atual é quem precisa avaliar (cliente)
                                const clienteId = pedido.clienteId?._id?.toString() || pedido.clienteId?.toString() || pedido.clienteId;
                                const clienteIdStr = clienteId ? String(clienteId) : '';
                                const userIdStr = userId ? String(userId) : '';
                                const ehCliente = clienteIdStr === userIdStr;
                                
                                if (!temAvaliacao && ehCliente) {
                                    // Não foi avaliado e o usuário é o cliente - mantém em ativos com flag
                                    pedido.faltaAvaliar = true;
                                    delete pedido.precisaVerificarAvaliacao;
                                    console.log(`✅ Pedido ${pedido._id} concluído não avaliado (cliente) - mantendo em ativos`);
                                    return pedido;
                                } else if (temAvaliacao) {
                                    // Foi avaliado - move para arquivados (tanto cliente quanto profissional)
                                    console.log(`✅ Pedido ${pedido._id} já foi avaliado - movendo para arquivados`);
                                    pedidosCancelados.push({...pedido, motivoCancelamento: 'CONCLUIDO'});
                                    return null; // Remove dos ativos
                                } else {
                                    // Não foi avaliado mas não é o cliente (é profissional) - também move para arquivados
                                    // porque o profissional não precisa avaliar, apenas o cliente
                                    console.log(`✅ Pedido ${pedido._id} concluído (profissional) - movendo para arquivados`);
                                    pedidosCancelados.push({...pedido, motivoCancelamento: 'CONCLUIDO'});
                                    return null; // Remove dos ativos
                                }
                            } else {
                                // Erro ao verificar - assume que não foi avaliado (para segurança)
                                pedido.faltaAvaliar = true;
                                delete pedido.precisaVerificarAvaliacao;
                                console.warn(`⚠️ Erro ao verificar avaliação do pedido ${pedido._id}, assumindo não avaliado`);
                                return pedido;
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao verificar avaliação do pedido ${pedido._id}:`, error);
                            // Em caso de erro, assume que não foi avaliado
                            pedido.faltaAvaliar = true;
                            delete pedido.precisaVerificarAvaliacao;
                            return pedido;
                        }
                    })
                );
                
                // Remove pedidos que foram movidos para cancelados (nulls) e atualiza pedidosAtivos
                const pedidosVerificadosValidos = pedidosComAvaliacaoVerificada.filter(p => p !== null);
                pedidosAtivos = pedidosAtivos.map(p => {
                    if (p.precisaVerificarAvaliacao) {
                        const verificado = pedidosVerificadosValidos.find(pv => pv && pv._id.toString() === p._id.toString());
                        return verificado || null;
                    }
                    return p;
                }).filter(p => p !== null);
            }
            
            // Ordenar ativos: pedidos concluídos não avaliados primeiro, depois pedidos com propostas
            pedidosAtivos.sort((a, b) => {
                // Pedidos concluídos não avaliados primeiro
                const aConcluidoNaoAvaliado = a.status === 'concluido' && a.faltaAvaliar;
                const bConcluidoNaoAvaliado = b.status === 'concluido' && b.faltaAvaliar;
                if (aConcluidoNaoAvaliado && !bConcluidoNaoAvaliado) return -1;
                if (!aConcluidoNaoAvaliado && bConcluidoNaoAvaliado) return 1;
                
                // Depois pedidos com propostas
                const aTemPropostas = (a.propostas || []).filter(p => 
                    p.status !== 'cancelada' && p.status !== 'cancelado' &&
                    p.status !== 'rejeitada' && p.status !== 'rejeitado' &&
                    p.status !== 'recusada' && p.status !== 'recusado'
                ).length > 0;
                const bTemPropostas = (b.propostas || []).filter(p => 
                    p.status !== 'cancelada' && p.status !== 'cancelado' &&
                    p.status !== 'rejeitada' && p.status !== 'rejeitado' &&
                    p.status !== 'recusada' && p.status !== 'recusado'
                ).length > 0;
                if (aTemPropostas && !bTemPropostas) return -1;
                if (!aTemPropostas && bTemPropostas) return 1;
                return 0;
            });

            if (pedidosAtivos.length === 0) {
                listaServicosAtivos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem serviços ativos de pedidos urgentes.</p>';
                if (modalServicosAtivos) {
                    modalServicosAtivos.classList.remove('hidden');
                    console.log('✅ Modal de serviços ativos aberto (sem pedidos)');
                }
                return;
            }
            
            const pedidos = pedidosAtivos;

            // Guarda fotos e nomes em cache local para uso na avaliação
            pedidos.forEach(p => {
                if (p._id) {
                    const pidClean = String(p._id).match(/[a-fA-F0-9]{24}/)?.[0];
                    const fotoSrc = p.foto;
                    if (pidClean) {
                        if (fotoSrc) {
                            localStorage.setItem(`fotoPedido:${pidClean}`, fotoSrc);
                            localStorage.setItem('fotoUltimoServicoConcluido', fotoSrc);
                            localStorage.setItem('ultimaFotoPedido', fotoSrc);
                        }
                        localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        if (p.servico) {
                            localStorage.setItem(`nomeServico:${pidClean}`, p.servico);
                            localStorage.setItem('ultimoServicoNome', p.servico);
                            localStorage.setItem('nomeServicoConcluido', p.servico);
                        }
                    }
                }
            });

            listaServicosAtivos.innerHTML = pedidos.map(pedido => {
                // Verifica se o usuário atual é o cliente (criador) ou o profissional
                const clienteId = pedido.clienteId?._id?.toString() || pedido.clienteId?.toString() || pedido.clienteId;
                const clienteIdStr = clienteId ? String(clienteId) : '';
                const ehCliente = clienteIdStr === userIdStr;
                
                // Encontra a proposta aceita para mostrar o profissional
                const propostaAceita = pedido.propostas?.find(prop => 
                    prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                );
                const profissional = propostaAceita?.profissionalId || null;
                // Tenta diferentes formas de acessar o profissionalId
                let profissionalId = null;
                if (profissional) {
                    if (typeof profissional === 'object') {
                        profissionalId = profissional._id?.toString() || profissional.id?.toString() || profissional.toString();
                    } else {
                        profissionalId = String(profissional);
                    }
                }
                const profissionalIdStr = profissionalId ? String(profissionalId) : '';
                const ehProfissional = profissionalIdStr === userIdStr;
                
                const temPropostaAceita = !!propostaAceita;
                const pedidoEmAndamento = pedido.status === 'em_andamento';
                
                // Contar propostas ativas (não canceladas, não rejeitadas)
                const propostasAtivas = (pedido.propostas || []).filter(prop =>
                    prop.status !== 'cancelada' && prop.status !== 'cancelado' &&
                    prop.status !== 'rejeitada' && prop.status !== 'rejeitado' &&
                    prop.status !== 'recusada' && prop.status !== 'recusado'
                );
                const temPropostasAtivas = propostasAtivas.length > 0 && !temPropostaAceita;
                
                const endereco = pedido.localizacao || {};
                // Monta endereço completo com todos os dados
                const enderecoParts = [];
                
                // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                const enderecoBase = endereco.enderecoCompleto || endereco.endereco || '';
                const numero = endereco.numero || '';
                const bairro = endereco.bairro || '';
                
                if (enderecoBase) {
                    // Se tem endereço base, adiciona ele primeiro
                    if (numero && !enderecoBase.includes(numero)) {
                        // Se o número não está no endereço base, adiciona
                        enderecoParts.push(`${enderecoBase}, ${numero}`);
                    } else {
                        enderecoParts.push(enderecoBase);
                    }
                } else {
                    // Se não tem endereço base, monta a partir dos campos individuais
                    const rua = endereco.rua || '';
                    if (rua) {
                        if (numero) {
                            enderecoParts.push(`${rua}, ${numero}`);
                        } else {
                            enderecoParts.push(rua);
                        }
                    } else if (numero) {
                        // Se não tem rua mas tem número, adiciona apenas o número
                        enderecoParts.push(numero);
                    }
                }
                
                // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                if (bairro) {
                    // Verifica se o bairro já não está no endereço base
                    if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                        enderecoParts.push(bairro);
                    }
                }
                
                const cidade = endereco.cidade || '';
                const estado = endereco.estado || '';
                if (cidade) enderecoParts.push(cidade);
                if (estado) enderecoParts.push(estado);
                
                const pontoReferencia = endereco.pontoReferencia || '';
                const enderecoFormatado = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                // Para o mapa, não inclui ponto de referência
                const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                const destaqueClass = pedidoIdDestacado && pedido._id === pedidoIdDestacado ? 'servico-ativo-destacado' : '';
                const fotoServico = pedido.foto || '';
                // Nome do serviço para cache/localStorage
                const nomeServico = pedido.servico || '';
                const pidCleanCard = String(pedido._id || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';
                if (pidCleanCard && nomeServico) {
                    try {
                        localStorage.setItem(`nomeServico:${pidCleanCard}`, nomeServico);
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        localStorage.setItem('nomeServicoConcluido', nomeServico);
                    } catch (e) {
                        console.warn('Falha ao cachear nomeServico do card ativo', e);
                    }
                }

                return `
                    <div class="pedido-urgente-card ${destaqueClass}" data-pedido-id="${pedido._id}">
                        ${temPropostasAtivas ? `
                            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 8px 12px; margin-bottom: 10px; border-radius: 4px;">
                                <strong style="color: #856404; font-size: 14px;"><i class="fas fa-bell"></i> Proposta recebida</strong>
                            </div>
                        ` : ''}
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <div>
                                <strong style="font-size:16px;">${pedido.servico}</strong>
                            </div>
                            ${pedido.status === 'concluido' ?
                                `<span class="badge-status badge-concluido" style="background: #28a745; color: #fff;">Concluído</span>` :
                                `<span class="badge-status badge-aceito">Ativo</span>`
                            }
                        </div>
                        ${ehCliente && profissional ? `
                            <p style="margin:4px 0; color: var(--text-secondary);">
                                <i class="fas fa-user-tie"></i> Profissional: 
                                <a href="/perfil?id=${profissionalIdStr || profissional._id || profissional.id || ''}" 
                                   style="color: inherit; text-decoration: none; font-weight: 600; cursor: pointer;">
                                    ${profissional.nome || 'Profissional'}
                                </a>
                            </p>
                        ` : ''}
                        ${ehProfissional ? `
                            <p style="margin:4px 0; color: var(--text-secondary);">
                                <i class="fas fa-user"></i> Cliente: ${pedido.clienteId?.nome || 'Cliente'}
                            </p>
                        ` : ''}
                        <p style="margin:4px 0;">
                            <i class="fas fa-map-marker-alt"></i> 
                            <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                               target="_blank" 
                               rel="noopener noreferrer"
                               style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                               onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                               onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                ${enderecoFormatado}
                            </a>
                        </p>
                        ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                        ${fotoServico || (pedido.fotos && pedido.fotos.length > 0) ? `
                            <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                ${pedido.fotos && pedido.fotos.length > 0 ? 
                                    pedido.fotos.map((foto, idx) => `
                                        <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;" loading="lazy">
                                    `).join('') :
                                    `<img src="${fotoServico}" alt="Foto do serviço" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px;" loading="lazy">`
                                }
                            </div>
                        ` : ''}
                        ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                        ${pedido.status === 'concluido' && pedido.faltaAvaliar && ehCliente && profissional ? `
                            <div class="mensagem-falta-avaliar" 
                                 data-profissional-id="${profissionalIdStr}"
                                 data-pedido-id="${pedido._id}"
                                 data-servico="${nomeServico}"
                                 style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px; cursor: pointer; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; transition: background 0.2s; border-left: 4px solid #dc3545;"
                                 onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'"
                                 onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                                <i class="fas fa-exclamation-triangle"></i> Serviço concluído! Clique aqui para avaliar o profissional.
                            </div>
                        ` : ''}
                        <div style="margin-top:10px; display:flex; justify-content:space-between; gap: 10px; flex-wrap: wrap; align-items: center;">
                            <div style="display:flex; gap:8px; align-items: center;">
                                ${temPropostasAtivas ? `
                                    <button class="btn-ver-proposta-servicos-ativos" data-pedido-id="${pedido._id}" style="padding:6px 10px; border-radius:6px; border:none; background:var(--primary-color, #007bff); color:#fff; cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:5px;">
                                        <i class="fas fa-eye"></i> Proposta
                                    </button>
                                ` : ''}
                            </div>
                            ${ehCliente ? `
                                <div style="display:flex; gap:8px; position: relative; margin-top: 10px;">
                                ${temPropostaAceita && pedidoEmAndamento ? `
                                        <button class="btn-servico-concluido" data-pedido-id="${pedido._id}" data-servico="${pedido.servico || ''}" data-foto-servico="${fotoServico}" data-profissional-id="${profissionalIdStr}" style="padding:6px 10px; border-radius:6px; border:none; background:#28a745; color:#fff; cursor:pointer; font-size:13px;">
                                        <i class="fas fa-check"></i> Marcar serviço feito
                                    </button>
                                ` : ''}
                                <button class="${temPropostaAceita ? 'btn-servico-cancelar' : 'btn-servico-apagar'}" data-pedido-id="${pedido._id}" data-tem-proposta="${temPropostaAceita}" style="padding:6px 10px; border-radius:6px; border:none; background:#dc3545; color:#fff; cursor:pointer; font-size:13px;">
                                    <i class="fas fa-${temPropostaAceita ? 'times' : 'trash'}"></i> ${temPropostaAceita ? 'Cancelar serviço' : 'Apagar serviço'}
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            // Guarda a primeira foto renderizada (fallback) após montar o DOM
            const primeiraFoto = listaServicosAtivos.querySelector('.pedido-foto-servico img');
            if (primeiraFoto?.src) {
                const src = primeiraFoto.src;
                localStorage.setItem('ultimaFotoPedido', src);
                localStorage.setItem('fotoUltimoServicoConcluido', src);
            }

            // Listeners: ver proposta
            document.querySelectorAll('.btn-ver-proposta-servicos-ativos').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoId = btn.dataset.pedidoId;
                    modalServicosAtivos?.classList.add('hidden');
                    await carregarPropostas(pedidoId);
                });
            });

            // Listeners: marcar serviço feito
            document.querySelectorAll('.btn-servico-concluido').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Evita propagação do evento
                    
                    const pedidoId = btn.dataset.pedidoId;
                    const nomeServico = btn.dataset.servico || '';
                    let fotoServico = btn.dataset.fotoServico || '';
                    if (!fotoServico) {
                        const card = btn.closest('.pedido-urgente-card');
                        const imgEl = card?.querySelector('.pedido-foto-servico img');
                        if (imgEl?.src) fotoServico = imgEl.src;
                    }
                    if (nomeServico) {
                        try {
                            localStorage.setItem('nomeServicoConcluido', nomeServico);
                            localStorage.setItem('ultimoServicoNome', nomeServico);
                            localStorage.setItem('ultimaDescricaoPedido', nomeServico);
                            const pidClean = String(pedidoId || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';
                            if (pidClean) localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                        } catch (e) {
                            console.warn('Falha ao cachear nome do serviço concluído', e);
                        }
                    }
                    if (fotoServico) {
                        // guarda para usar no lembrete de avaliação
                        localStorage.setItem('fotoUltimoServicoConcluido', fotoServico);
                        const pidClean = String(pedidoId || '').match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            localStorage.setItem(`fotoPedido:${pidClean}`, fotoServico);
                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        localStorage.setItem('ultimaFotoPedido', fotoServico);
                        }
                    }
                    
                    // Remove modal anterior se existir
                    const modalAnterior = btn.parentElement.querySelector('.confirmacao-inline-concluir');
                    if (modalAnterior) {
                        modalAnterior.remove();
                    }
                    
                    // Cria modal pequeno inline perto do botão
                    const confirmacaoInline = document.createElement('div');
                    confirmacaoInline.className = 'confirmacao-inline-concluir';
                    confirmacaoInline.style.cssText = `
                        position: absolute;
                        bottom: 100%;
                        left: 0;
                        margin-bottom: 8px;
                        background: white;
                        border: 1px solid #ddd;
                        border-radius: 8px;
                        padding: 12px 16px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        min-width: 200px;
                        max-width: 280px;
                        animation: slideDown 0.2s ease-out;
                    `;
                    
                    // Adiciona animação CSS
                    if (!document.getElementById('confirmacao-inline-styles')) {
                        const style = document.createElement('style');
                        style.id = 'confirmacao-inline-styles';
                        style.textContent = `
                            @keyframes slideDown {
                                from {
                                    opacity: 0;
                                    transform: translateY(-10px);
                                }
                                to {
                                    opacity: 1;
                                    transform: translateY(0);
                                }
                            }
                            .confirmacao-inline-concluir {
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                    
                    confirmacaoInline.innerHTML = `
                        <div style="margin-bottom: 10px; font-weight: 600; color: #333; font-size: 14px;">
                            Confirmar conclusão?
                        </div>
                        <div style="margin-bottom: 12px; color: #666; font-size: 12px; line-height: 1.4;">
                            O serviço foi realmente finalizado?
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button class="btn-confirmar-inline" style="
                                padding: 6px 14px;
                                border: none;
                                border-radius: 6px;
                                background: #28a745;
                                color: white;
                                cursor: pointer;
                                font-size: 12px;
                                font-weight: 500;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='#218838'" onmouseout="this.style.background='#28a745'">
                                <i class="fas fa-check"></i> Confirmar
                            </button>
                            <button class="btn-cancelar-inline" style="
                                padding: 6px 14px;
                                border: 1px solid #ddd;
                                border-radius: 6px;
                                background: white;
                                color: #666;
                                cursor: pointer;
                                font-size: 12px;
                                font-weight: 500;
                                transition: all 0.2s;
                            " onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='white'">
                                Cancelar
                            </button>
                        </div>
                    `;
                    
                    // Posiciona o modal acima do botão
                    btn.parentElement.style.position = 'relative';
                    btn.parentElement.appendChild(confirmacaoInline);
                    
                    // Ajusta posição se necessário (para não sair da tela)
                    setTimeout(() => {
                        const rect = confirmacaoInline.getBoundingClientRect();
                        if (rect.left < 0) {
                            confirmacaoInline.style.left = '0';
                        }
                        if (rect.right > window.innerWidth) {
                            confirmacaoInline.style.left = 'auto';
                            confirmacaoInline.style.right = '0';
                        }
                    }, 10);
                    
                    // Handler de confirmação
                    const handleConfirmar = async () => {
                        // Remove o modal inline primeiro
                        confirmacaoInline.remove();
                        
                        // Fecha o modal de serviços ativos imediatamente (antes de qualquer operação)
                        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                        if (modalServicosAtivos) {
                            modalServicosAtivos.classList.add('hidden');
                        }
                        
                        // IMPORTANTE: Tenta extrair profissionalId do botão ou do card ANTES de fazer a requisição
                        // Isso acelera o redirecionamento
                        let profissionalIdDoCard = btn.dataset.profissionalId || null;
                        
                        if (!profissionalIdDoCard) {
                            const card = btn.closest('.pedido-urgente-card');
                            if (card) {
                                const mensagemFaltaAvaliar = card.querySelector('.mensagem-falta-avaliar');
                                if (mensagemFaltaAvaliar && mensagemFaltaAvaliar.dataset.profissionalId) {
                                    profissionalIdDoCard = mensagemFaltaAvaliar.dataset.profissionalId;
                                    console.log('✅ ProfissionalId encontrado na mensagem "falta avaliar" (antes da requisição):', profissionalIdDoCard);
                                }
                            }
                        } else {
                            console.log('✅ ProfissionalId encontrado no botão (antes da requisição):', profissionalIdDoCard);
                        }
                        
                        try {
                            // Fecha o modal de confirmação imediatamente para melhor UX
                            const modalConfirmacao = document.getElementById('modal-confirmacao-acao');
                            if (modalConfirmacao) {
                                modalConfirmacao.classList.add('hidden');
                            }
                            
                            // Fecha o modal de serviços ativos imediatamente
                            const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                            if (modalServicosAtivos) {
                                modalServicosAtivos.classList.add('hidden');
                            }
                            
                            // Prepara dados para redirecionamento (antes mesmo de concluir)
                            const pid = (pedidoId && typeof pedidoId === 'string') ? pedidoId.trim() : '';
                            const pidClean = pid.match(/[a-fA-F0-9]{24}/)?.[0] || '';
                            
                            // Salva dados no localStorage imediatamente
                            if (pidClean) {
                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                            }
                            if (fotoServico) {
                                localStorage.setItem('fotoUltimoServicoConcluido', fotoServico);
                                localStorage.setItem('ultimaFotoPedido', fotoServico);
                            }
                            if (nomeServico) {
                                localStorage.setItem('ultimoServicoNome', nomeServico);
                                localStorage.setItem('nomeServicoConcluido', nomeServico);
                                if (pidClean) {
                                    localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                                }
                            }
                            
                            // Faz a requisição para concluir o serviço
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/concluir-servico`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                const data = await resp.json();
                            
                                if (data.success) {
                                // IMPORTANTE: Se já tem profissionalId do card, usa ele imediatamente (mais rápido)
                                let profissionalId = profissionalIdDoCard;
                                
                                // Se não tem do card, busca da API
                                if (!profissionalId) {
                                    try {
                                        const pedidoResponse = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                                            headers: {
                                                'Authorization': `Bearer ${token}`
                                            }
                                        });
                                        
                                        if (pedidoResponse.ok) {
                                            const pedidoData = await pedidoResponse.json();
                                            const pedido = pedidoData.pedido || pedidoData;
                                            
                                            // Encontra a proposta aceita
                                            const propostaAceita = pedido.propostas?.find(prop => 
                                                prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                                            );
                                            
                                            if (propostaAceita && propostaAceita.profissionalId) {
                                                profissionalId = propostaAceita.profissionalId._id || propostaAceita.profissionalId.id || propostaAceita.profissionalId;
                                                profissionalId = String(profissionalId); // Garante que é string
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Erro ao buscar dados do pedido para avaliação:', error);
                                    }
                                }
                                
                                // Se encontrou o profissionalId (do card ou da API), redireciona IMEDIATAMENTE
                                if (profissionalId) {
                                    // Fecha o modal ANTES de redirecionar
                                    if (modalServicosAtivos) {
                                        modalServicosAtivos.classList.add('hidden');
                                    }
                                    
                                    const params = new URLSearchParams({
                                        id: profissionalId,
                                        pedidoId: pidClean,
                                        servico: nomeServico || '',
                                        origem: 'servico_concluido'
                                    });
                                    if (fotoServico) {
                                        params.set('foto', fotoServico);
                                    }
                                    
                                    console.log('🚀 Redirecionando IMEDIATAMENTE para avaliação:', `/perfil?${params.toString()}#secao-avaliacao`);
                                    
                                    // Redireciona IMEDIATAMENTE - não espera nada
                                    window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                    return; // Para aqui, não continua
                                } else {
                                    // Se não encontrou profissionalId, tenta usar dados do card/pedido
                                    console.warn('⚠️ ProfissionalId não encontrado na resposta, tentando extrair do card...');
                                    
                                    // Tenta extrair do card atual
                                    const card = btn.closest('.pedido-urgente-card');
                                    let profissionalIdDoCard = null;
                                    
                                    if (card) {
                                        // Procura pela mensagem "falta avaliar" que tem data-profissional-id
                                        const mensagemFaltaAvaliar = card.querySelector('.mensagem-falta-avaliar');
                                        if (mensagemFaltaAvaliar && mensagemFaltaAvaliar.dataset.profissionalId) {
                                            profissionalIdDoCard = mensagemFaltaAvaliar.dataset.profissionalId;
                                            console.log('✅ ProfissionalId encontrado na mensagem "falta avaliar":', profissionalIdDoCard);
                                        } else {
                                            // Tenta do card diretamente
                                            profissionalIdDoCard = card.dataset.profissionalId || 
                                                                   card.querySelector('[data-profissional-id]')?.dataset.profissionalId;
                                            if (profissionalIdDoCard) {
                                                console.log('✅ ProfissionalId encontrado no card:', profissionalIdDoCard);
                                            }
                                        }
                                        
                                        if (profissionalIdDoCard) {
                                            const params = new URLSearchParams({
                                                id: profissionalIdDoCard,
                                                pedidoId: pidClean,
                                                servico: nomeServico || '',
                                                origem: 'servico_concluido'
                                            });
                                            if (fotoServico) {
                                                params.set('foto', fotoServico);
                                            }
                                            
                                            console.log('🚀 Redirecionando para avaliação (fallback do card):', `/perfil?${params.toString()}#secao-avaliacao`);
                                            window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                            return;
                                        }
                                    }
                                    
                                    // Se ainda não encontrou, mostra erro
                                    console.error('❌ ProfissionalId não encontrado após concluir serviço');
                                    if (modalServicosAtivos) {
                                        modalServicosAtivos.classList.add('hidden');
                                    }
                                    alert('Erro: Não foi possível identificar o profissional. Por favor, acesse o perfil do profissional manualmente para avaliar.');
                                }
                                } else {
                                    alert(data.message || 'Erro ao marcar serviço como concluído.');
                                // Reabre o modal se deu erro
                                if (modalServicosAtivos) {
                                    modalServicosAtivos.classList.remove('hidden');
                                }
                                }
                            } catch (error) {
                                console.error('Erro ao concluir serviço:', error);
                                alert('Erro ao concluir serviço.');
                            // Reabre o modal se deu erro
                            const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                            if (modalServicosAtivos) {
                                modalServicosAtivos.classList.remove('hidden');
                            }
                        }
                    };
                    
                    // Handler de cancelar
                    const handleCancelar = () => {
                        confirmacaoInline.remove();
                    };
                    
                    // Adiciona listeners
                    const btnConfirmar = confirmacaoInline.querySelector('.btn-confirmar-inline');
                    const btnCancelar = confirmacaoInline.querySelector('.btn-cancelar-inline');
                    
                    btnConfirmar.addEventListener('click', handleConfirmar);
                    btnCancelar.addEventListener('click', handleCancelar);
                    
                    // Fecha ao clicar fora
                    const fecharAoClicarFora = (event) => {
                        if (!confirmacaoInline.contains(event.target) && !btn.contains(event.target)) {
                            confirmacaoInline.remove();
                            document.removeEventListener('click', fecharAoClicarFora);
                        }
                    };
                    
                    // Aguarda um frame para evitar fechar imediatamente
                    setTimeout(() => {
                        document.addEventListener('click', fecharAoClicarFora);
                    }, 0);
                    });
                });

            // Listeners: mensagem "falta avaliar" (pedidos concluídos não avaliados)
            document.querySelectorAll('.mensagem-falta-avaliar').forEach(msg => {
                msg.addEventListener('click', () => {
                    const profissionalId = msg.dataset.profissionalId;
                    const pedidoId = msg.dataset.pedidoId;
                    const servico = msg.dataset.servico || '';
                    
                    // Função para redirecionar para avaliação
                    const redirecionarParaAvaliacao = (profId, pedId, serv) => {
                        // Salva informações no localStorage
                        if (pedId) {
                            const pidClean = String(pedId).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                            }
                        }
                        if (serv) {
                            localStorage.setItem('ultimoServicoNome', serv);
                            localStorage.setItem('nomeServicoConcluido', serv);
                            if (pedId) {
                                const pidClean = String(pedId).match(/[a-fA-F0-9]{24}/)?.[0];
                                if (pidClean) {
                                    localStorage.setItem(`nomeServico:${pidClean}`, serv);
                                }
                            }
                        }
                        
                        // Busca foto do serviço
                        const fotoServico = localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido') || '';
                        
                        // Redireciona para a página de perfil com os parâmetros necessários
                        const params = new URLSearchParams({
                            id: profId,
                            pedidoId: pedId,
                            servico: serv,
                            origem: 'servico_concluido'
                        });
                        if (fotoServico) {
                            params.set('foto', fotoServico);
                        }
                        
                        // Fecha o modal antes de redirecionar
                        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                        if (modalServicosAtivos) {
                            modalServicosAtivos.classList.add('hidden');
                        }
                        
                        window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                    };
                    
                    redirecionarParaAvaliacao(profissionalId, pedidoId, servico);
                });
            });

            // Listeners: cancelar serviço (quando tem proposta aceita)
            document.querySelectorAll('.btn-servico-cancelar').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoId = btn.dataset.pedidoId;
                    abrirConfirmacaoAcao({
                        titulo: 'Cancelar serviço',
                        texto: 'Informe o motivo do cancelamento. Isso ajuda a manter a segurança na plataforma.',
                        exigeMotivo: true,
                        onConfirm: async (motivo) => {
                            try {
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar-servico`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ motivo })
                                });
                                const data = await resp.json();
                                if (data.success) {
                                    const toast = document.createElement('div');
                                    toast.className = 'toast-sucesso';
                                    toast.innerHTML = '<span class="check-animado">✔</span> Serviço cancelado com sucesso. O outro usuário recebeu o motivo do cancelamento.';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.classList.add('show'), 10);
                                    setTimeout(() => toast.remove(), 2500);
                                    await carregarServicosAtivos();
                                } else {
                                    alert(data.message || 'Erro ao cancelar serviço.');
                                }
                            } catch (error) {
                                console.error('Erro ao cancelar serviço:', error);
                                alert('Erro ao cancelar serviço.');
                            }
                        }
                    });
                });
            });

            // Listeners: apagar serviço (quando NÃO tem proposta aceita)
            document.querySelectorAll('.btn-servico-apagar').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const pedidoId = btn.dataset.pedidoId;
                    const card = btn.closest('.pedido-urgente-card');
                    
                    // Remove modal anterior se existir
                    const modalAnterior = card.querySelector('.modal-apagar-inline');
                    if (modalAnterior) {
                        modalAnterior.remove();
                    }
                    
                    // Cria modal inline ao lado do botão
                    const modalInline = document.createElement('div');
                    modalInline.className = 'modal-apagar-inline';
                    modalInline.style.cssText = `
                        position: absolute;
                        right: 0;
                        bottom: 100%;
                        margin-bottom: 5px;
                        background: var(--bg-primary, #fff);
                        border: 1px solid var(--border-color, #ddd);
                        border-radius: 8px;
                        padding: 15px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 1000;
                        min-width: 250px;
                        max-width: 300px;
                    `;
                    modalInline.innerHTML = `
                        <div style="margin-bottom: 10px;">
                            <strong style="font-size: 14px; color: var(--text-primary);">Apagar serviço</strong>
                        </div>
                        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 15px;">
                            Tem certeza? Não será desfeita!
                        </p>
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button class="btn-confirmar-apagar" data-pedido-id="${pedidoId}" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                                Apagar
                            </button>
                            <button class="btn-cancelar-apagar" style="padding: 6px 12px; background: var(--bg-secondary, #f0f0f0); color: var(--text-primary); border: 1px solid var(--border-color, #ddd); border-radius: 4px; cursor: pointer; font-size: 13px;">
                                Cancelar
                            </button>
                        </div>
                    `;
                    
                    // Adiciona o modal ao container do botão (já tem position: relative)
                    const btnContainer = btn.parentElement;
                    btnContainer.appendChild(modalInline);
                    
                    // Fecha ao clicar em cancelar
                    modalInline.querySelector('.btn-cancelar-apagar').addEventListener('click', () => {
                        modalInline.remove();
                    });
                    
                    // Confirma ao clicar em apagar
                    modalInline.querySelector('.btn-confirmar-apagar').addEventListener('click', async () => {
                        try {
                            const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await resp.json();
                            if (data.success) {
                                modalInline.remove();
                                const toast = document.createElement('div');
                                toast.className = 'toast-sucesso';
                                toast.innerHTML = '<span class="check-animado">✔</span> Pedido apagado com sucesso.';
                                document.body.appendChild(toast);
                                setTimeout(() => toast.classList.add('show'), 10);
                                setTimeout(() => toast.remove(), 2500);
                                await carregarServicosAtivos();
                            } else {
                                // Se o pedido já foi cancelado, não mostra erro, apenas recarrega
                                if (data.message && data.message.includes('cancelado')) {
                                    modalInline.remove();
                                await carregarServicosAtivos();
                            } else {
                                alert(data.message || 'Erro ao apagar pedido.');
                                modalInline.remove();
                                }
                            }
                        } catch (error) {
                            console.error('Erro ao apagar pedido:', error);
                            alert('Erro ao apagar pedido.');
                            modalInline.remove();
                        }
                    });
                    
                    // Fecha ao clicar fora
                    setTimeout(() => {
                        const fecharAoClicarFora = (e) => {
                            if (!modalInline.contains(e.target) && !btn.contains(e.target)) {
                                modalInline.remove();
                                document.removeEventListener('click', fecharAoClicarFora);
                            }
                        };
                        document.addEventListener('click', fecharAoClicarFora);
                    }, 10);
                });
            });
            
            // Abre o modal se ele existir (para quando é chamado de notificações)
            if (modalServicosAtivos) {
                modalServicosAtivos.classList.remove('hidden');
                console.log('✅ Modal de serviços ativos aberto');
            }
        } catch (error) {
            console.error('Erro ao carregar serviços ativos:', error);
            listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar serviços ativos. Tente novamente.</p>';
            // Tenta abrir o modal mesmo em caso de erro (pode ter dados parciais)
            if (modalServicosAtivos) {
                modalServicosAtivos.classList.remove('hidden');
            }
        }
    }

    // Torna a função acessível globalmente
    window.carregarServicosAtivos = carregarServicosAtivos;

    // ============================================
    // MEUS PEDIDOS URGENTES (para clientes)
    // ============================================
    const btnMeusPedidosUrgentes = document.getElementById('btn-meus-pedidos-urgentes');
    const modalMeusPedidosUrgentes = document.getElementById('modal-meus-pedidos-urgentes');
    const listaMeusPedidosUrgentes = document.getElementById('lista-meus-pedidos-urgentes');
    const btnPedidosConcluidos = document.getElementById('btn-pedidos-concluidos');
    const modalPedidosConcluidos = document.getElementById('modal-pedidos-concluidos');
    const listaPedidosConcluidos = document.getElementById('lista-pedidos-concluidos');
    
    let modoVisualizacaoMeusPedidos = 'abertos'; // 'abertos' ou 'concluidos'

    // Tornar função global para ser chamada após avaliação
    window.carregarMeusPedidosUrgentes = async function carregarMeusPedidosUrgentes(modo = 'abertos') {
        if (!listaMeusPedidosUrgentes) return;

        try {
            modoVisualizacaoMeusPedidos = modo;
            
            let pedidosParaMostrar = [];
            
            if (modo === 'abertos') {
                // Buscar TODOS os pedidos (sem filtro de status) para incluir concluídos não avaliados
                const response = await fetch('/api/pedidos-urgentes/meus', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    // Pegar todos os pedidos da resposta (pedidos inclui todos, independente de status)
                    const todosPedidos = data.pedidos || [];
                    
                    // Se não tiver em pedidos, usar pedidosAtivos e pedidosExpirados
                    if (todosPedidos.length === 0) {
                        todosPedidos.push(...(data.pedidosAtivos || []), ...(data.pedidosExpirados || []));
                    }
                    
                    console.log('📦 Total de pedidos retornados pela API:', todosPedidos.length);
                    console.log('📦 Pedidos por status:', {
                        abertos: todosPedidos.filter(p => p.status === 'aberto').length,
                        em_andamento: todosPedidos.filter(p => p.status === 'em_andamento').length,
                        concluidos: todosPedidos.filter(p => p.status === 'concluido').length,
                        cancelados: todosPedidos.filter(p => p.status === 'cancelado').length
                    });
                    
                    // Separar pedidos por status
                    const pedidosAbertosOuEmAndamento = todosPedidos.filter(p => 
                        p.status === 'aberto' || p.status === 'em_andamento'
                    );
                    
                    // Buscar pedidos concluídos que TIVERAM PROPOSTA ACEITA e verificar se foram avaliados
                    const pedidosConcluidos = todosPedidos.filter(p => {
                        // Deve estar concluído E ter pelo menos uma proposta aceita
                        const temPropostaAceita = p.propostas && Array.isArray(p.propostas) && p.propostas.some(prop => prop.status === 'aceita');
                        return p.status === 'concluido' && temPropostaAceita;
                    });
                    
                    console.log('🔍 Pedidos concluídos com proposta aceita encontrados:', pedidosConcluidos.length);
                    
                    // Verificar quais pedidos concluídos não foram avaliados
                    const pedidosConcluidosNaoAvaliados = await Promise.all(
                        pedidosConcluidos.map(async (pedido) => {
                            try {
                                const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                if (avaliacaoResponse.ok) {
                                    const avaliacaoData = await avaliacaoResponse.json();
                                    console.log('🔍 Verificando avaliações para pedido:', pedido._id, 'userId:', userId);
                                    console.log('🔍 Dados recebidos:', JSON.stringify(avaliacaoData, null, 2));
                                    
                                    // Verificar se há avaliação deste cliente para este pedido
                                    const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && Array.isArray(avaliacaoData.avaliacoes) && avaliacaoData.avaliacoes.some(av => {
                                        // clienteId pode vir populado (objeto) ou como string/ObjectId
                                        const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                        const clienteIdStr = clienteId ? String(clienteId) : null;
                                        const userIdStr = userId ? String(userId) : null;
                                        const match = clienteIdStr && userIdStr && clienteIdStr === userIdStr;
                                        if (match) {
                                            console.log('✅ Avaliação encontrada para este pedido:', pedido._id, 'clienteId:', clienteIdStr, 'userId:', userIdStr);
                                        }
                                        return match;
                                    });
                                    
                                    // Se não tem avaliação, incluir nos pedidos abertos
                                    if (!temAvaliacao) {
                                        pedido.faltaAvaliar = true;
                                        console.log('✅ Pedido concluído não avaliado encontrado:', pedido._id, pedido.servico);
                                        return pedido;
                                    }
                                    console.log('❌ Pedido já avaliado - removendo da lista:', pedido._id);
                                    return null;
                                } else if (avaliacaoResponse.status === 401 || avaliacaoResponse.status === 403) {
                                    // Token inválido ou sem permissão - não incluir o pedido (já foi avaliado ou erro de autenticação)
                                    console.warn('⚠️ Erro de autenticação ao verificar avaliação do pedido:', pedido._id, 'Status:', avaliacaoResponse.status);
                                    // Não incluir o pedido se houver erro de autenticação (provavelmente já foi avaliado)
                                    return null;
                                } else {
                                    // Outro erro - assumir que não foi avaliado (para segurança)
                                    pedido.faltaAvaliar = true;
                                    console.log('⚠️ Não foi possível verificar avaliação (status:', avaliacaoResponse.status, '), incluindo pedido:', pedido._id);
                                    return pedido;
                                }
                            } catch (error) {
                                console.error('❌ Erro ao verificar avaliação do pedido:', pedido._id, error);
                                // Em caso de erro de rede/conexão, não incluir o pedido (para evitar duplicatas)
                                // Se o servidor estiver offline, melhor não mostrar do que mostrar incorretamente
                                return null;
                            }
                        })
                    );
                    
                    const concluidosNaoAvaliadosFiltrados = pedidosConcluidosNaoAvaliados.filter(p => p !== null);
                    console.log('📋 Pedidos concluídos não avaliados:', concluidosNaoAvaliadosFiltrados.length);
                    
                    // Combinar pedidos abertos/em_andamento com concluídos não avaliados
                    pedidosParaMostrar = [
                        ...pedidosAbertosOuEmAndamento,
                        ...concluidosNaoAvaliadosFiltrados
                    ];
                    
                    console.log('📊 Total de pedidos para mostrar:', pedidosParaMostrar.length);
                }
            } else if (modo === 'concluidos') {
                // Buscar pedidos concluídos que foram avaliados
                const response = await fetch('/api/pedidos-urgentes/meus?status=concluido', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();
                
                if (data.success) {
                    const pedidosConcluidos = data.pedidosAtivos || data.pedidos || [];
                    
                    // Verificar quais pedidos foram avaliados
                    const pedidosComAvaliacao = await Promise.all(
                        pedidosConcluidos.map(async (pedido) => {
                            try {
                                const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                    headers: {
                                        'Authorization': `Bearer ${token}`
                                    }
                                });
                                
                                if (avaliacaoResponse.ok) {
                                    const avaliacaoData = await avaliacaoResponse.json();
                                    // Verificar se há avaliação deste cliente para este pedido
                                    const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => {
                                        const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                        return clienteId && String(clienteId) === String(userId);
                                    });
                                    if (temAvaliacao) {
                                        pedido.avaliado = true;
                                        return pedido;
                                    }
                                    return null;
                                }
                                return null;
                            } catch (error) {
                                console.error('Erro ao verificar avaliação do pedido:', error);
                                return null;
                            }
                        })
                    );
                    
                    pedidosParaMostrar = pedidosComAvaliacao.filter(p => p !== null);
                }
            }

            if (pedidosParaMostrar.length === 0) {
                const mensagem = modo === 'abertos' 
                    ? 'Você ainda não criou nenhum pedido urgente aberto.'
                    : 'Você ainda não tem pedidos concluídos avaliados.';
                listaMeusPedidosUrgentes.innerHTML = `<p style="text-align: center; padding: 20px; color: var(--text-secondary);">${mensagem}</p>`;
                return;
            }

                // Log para debug
                console.log('📋 Pedidos carregados:', pedidosParaMostrar.map(p => ({
                    id: p._id,
                    servico: p.servico,
                    status: p.status,
                    temFoto: !!p.foto,
                    temFotos: p.fotos && p.fotos.length > 0,
                    numFotos: p.fotos ? p.fotos.length : 0
                })));

                function renderPedidoCard(pedido, expirado = false) {
                    const tempoRestante = Math.max(0, Math.ceil((new Date(pedido.dataExpiracao) - new Date()) / 60000));
                    const numPropostas = pedido.propostas?.length || 0;
                    const statusBadge = {
                        'aberto': '<span class="badge-status badge-aberto">Aberto</span>',
                        'em_andamento': '<span class="badge-status badge-aceito">Em andamento</span>',
                        'concluido': '<span class="badge-status badge-concluido">Concluído</span>',
                        'cancelado': '<span class="badge-status badge-cancelado">Cancelado</span>'
                    }[pedido.status] || '';

                    // Verifica se tem múltiplas fotos ou apenas uma
                    const temFotos = pedido.fotos && Array.isArray(pedido.fotos) && pedido.fotos.length > 0;
                    const temFotoUnica = pedido.foto && !temFotos;
                    const fotosParaMostrar = temFotos ? pedido.fotos : (temFotoUnica ? [pedido.foto] : []);

                    return `
                        <div class="pedido-urgente-card" style="margin-bottom: 20px; overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong style="font-size: 18px;">${pedido.servico}</strong>
                                    ${statusBadge}
                                </div>
                                ${pedido.status === 'aberto' && !expirado ? `<span class="tempo-restante">⏱️ ${tempoRestante} min</span>` : ''}
                            </div>
                            
                            ${fotosParaMostrar.length > 0 ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                    ${fotosParaMostrar.length > 1 ? 
                                        fotosParaMostrar.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                        `).join('') :
                                        `<img src="${fotosParaMostrar[0]}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${fotosParaMostrar[0]}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                    }
                                </div>
                            ` : ''}
                            
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            
                            ${pedido.localizacao ? `
                                <div class="pedido-localizacao">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${(() => {
                                        // Monta endereço completo com todos os dados
                                        const enderecoParts = [];
                                        
                                        // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                                        const enderecoBase = pedido.localizacao.enderecoCompleto || pedido.localizacao.endereco || '';
                                        const numero = pedido.localizacao.numero || '';
                                        const bairro = pedido.localizacao.bairro || '';
                                        
                                        if (enderecoBase) {
                                            // Se tem endereço base, adiciona ele primeiro
                                            if (numero && !enderecoBase.includes(numero)) {
                                                // Se o número não está no endereço base, adiciona
                                                enderecoParts.push(`${enderecoBase}, ${numero}`);
                                            } else {
                                                enderecoParts.push(enderecoBase);
                                            }
                                        } else {
                                            // Se não tem endereço base, monta a partir dos campos individuais
                                            const rua = pedido.localizacao.rua || '';
                                            if (rua) {
                                                if (numero) {
                                                    enderecoParts.push(`${rua}, ${numero}`);
                                                } else {
                                                    enderecoParts.push(rua);
                                                }
                                            } else if (numero) {
                                                // Se não tem rua mas tem número, adiciona apenas o número
                                                enderecoParts.push(numero);
                                            }
                                        }
                                        
                                        // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                                        if (bairro) {
                                            // Verifica se o bairro já não está no endereço base
                                            if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                                                enderecoParts.push(bairro);
                                            }
                                        }
                                        
                                        const cidade = pedido.localizacao.cidade || '';
                                        const estado = pedido.localizacao.estado || '';
                                        if (cidade) enderecoParts.push(cidade);
                                        if (estado) enderecoParts.push(estado);
                                        
                                        const pontoReferencia = pedido.localizacao.pontoReferencia || '';
                                        
                                        const enderecoTexto = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                                        const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                                        
                                        return `
                                            <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                                               target="_blank" 
                                               rel="noopener noreferrer"
                                               style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                                               onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                                               onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                                ${enderecoTexto}
                                            </a>
                                            ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                                        `;
                                    })()}
                                </div>
                            ` : ''}

                            ${(() => {
                                // Encontrar proposta aceita
                                const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                                const profissionalAceito = propostaAceita?.profissionalId;
                                const valorAceito = propostaAceita?.valor;
                                
                                if (propostaAceita && profissionalAceito) {
                                    // Se tem proposta aceita, mostrar a caixa clicável
                                    return `
                                        <div class="proposta-aceita-clickable" 
                                             data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                             data-pedido-id="${pedido._id}"
                                             data-servico="${pedido.servico || ''}"
                                             style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
                                             onmouseover="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.1) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.5)';"
                                             onmouseout="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.3)';">
                                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                                <div style="flex: 1;">
                                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                                        <i class="fas fa-check-circle" style="color: #28a745; font-size: 16px;"></i>
                                                        <strong style="color: #28a745; font-size: 14px;">Proposta Aceita</strong>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                        ${profissionalAceito.foto || profissionalAceito.avatarUrl ? `
                                                            <a href="/perfil?id=${profissionalAceito._id || profissionalAceito.id || ''}" style="text-decoration: none; display: inline-flex; pointer-events: auto;">
                                                                <img src="${profissionalAceito.foto || profissionalAceito.avatarUrl}" 
                                                                     alt="${profissionalAceito.nome}" 
                                                                     style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(40, 167, 69, 0.3);">
                                                            </a>
                                                        ` : ''}
                                                        <a href="/perfil?id=${profissionalAceito._id || profissionalAceito.id || ''}" style="flex: 1; min-width: 150px; text-decoration: none; color: inherit; pointer-events: auto;">
                                                            <div style="font-weight: 600; color: var(--text-primary); font-size: 15px;">
                                                                ${profissionalAceito.nome || 'Profissional'}
                                                            </div>
                                                            ${profissionalAceito.cidade && profissionalAceito.estado ? `
                                                                <div style="font-size: 12px; color: var(--text-secondary);">
                                                                    <i class="fas fa-map-marker-alt"></i> ${profissionalAceito.cidade} - ${profissionalAceito.estado}
                                                                </div>
                                                            ` : ''}
                                                        </a>
                                                        ${valorAceito ? `
                                                            <div style="text-align: right; pointer-events: none;">
                                                                <div style="font-size: 18px; font-weight: 700; color: #28a745;">
                                                                    R$ ${parseFloat(valorAceito).toFixed(2)}
                                                                </div>
                                                                <div style="font-size: 11px; color: var(--text-secondary);">
                                                                    Valor aceito
                                                                </div>
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                    ${pedido.status === 'concluido' && pedido.faltaAvaliar ? 
                                                        `<p class="mensagem-falta-avaliar" 
                                                             data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                                             data-pedido-id="${pedido._id}"
                                                             data-servico="${pedido.servico || ''}"
                                                             style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px; cursor: pointer; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; transition: background 0.2s;"
                                                             onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'"
                                                             onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                                                            <i class="fas fa-exclamation-triangle"></i> Serviço concluído! Clique aqui para avaliar o profissional.
                                                        </p>` : 
                                                        ''
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    // Se não tem proposta aceita, mostrar a seção normal de propostas
                                    return `
                                        <div style="margin-top: 15px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                                <strong><i class="fas fa-hand-holding-usd"></i> Propostas Recebidas: ${numPropostas}</strong>
                                                ${numPropostas > 0 ? `
                                                    <button class="btn-ver-propostas" data-pedido-id="${pedido._id}" style="padding: 8px 15px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                                        <i class="fas fa-eye"></i> Ver Propostas
                                                    </button>
                                                ` : ''}
                                            </div>
                                            ${pedido.status === 'concluido' && pedido.faltaAvaliar ? 
                                                (() => {
                                                    const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                                                    const profissionalId = propostaAceita?.profissionalId?._id || propostaAceita?.profissionalId?.id;
                                                    return profissionalId ? 
                                                        `<p class="mensagem-falta-avaliar" 
                                                             data-profissional-id="${profissionalId}" 
                                                             data-pedido-id="${pedido._id}"
                                                             data-servico="${pedido.servico || ''}"
                                                             style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px; cursor: pointer; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 4px; transition: background 0.2s;"
                                                             onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'"
                                                             onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                                                            <i class="fas fa-exclamation-triangle"></i> Serviço concluído! Clique aqui para avaliar o profissional.
                                                        </p>` :
                                                        '<p style="color: #dc3545; font-size: 14px; font-weight: 600; margin-top: 10px;"><i class="fas fa-exclamation-triangle"></i> Serviço concluído! Falta avaliar o profissional.</p>';
                                                })() : 
                                                ''
                                            }
                                            ${numPropostas === 0 && pedido.status === 'aberto' ? 
                                                (!expirado ? '<p style="color: var(--text-secondary); font-size: 14px;">Aguardando propostas de profissionais...</p>' : '') : 
                                                ''
                                            }
                                        </div>
                                    `;
                                }
                            })()}
                            ${pedido.status === 'aberto' && !expirado ? `
                                <div style="margin-top: 10px; text-align: right;">
                                    <button class="btn-cancelar-pedido" data-pedido-id="${pedido._id}" style="padding: 8px 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                        <i class="fas fa-times"></i> Apagar Pedido
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                let html = '';
                
                if (modo === 'abertos') {
                    // Separar por status
                    const pedidosAbertos = pedidosParaMostrar.filter(p => p.status === 'aberto');
                    const pedidosEmAndamento = pedidosParaMostrar.filter(p => p.status === 'em_andamento');
                    const pedidosConcluidosNaoAvaliados = pedidosParaMostrar.filter(p => p.status === 'concluido' && p.faltaAvaliar);
                    
                    console.log('📊 Renderização:', {
                        abertos: pedidosAbertos.length,
                        emAndamento: pedidosEmAndamento.length,
                        concluidosNaoAvaliados: pedidosConcluidosNaoAvaliados.length
                    });
                    
                    if (pedidosAbertos.length > 0) {
                        html += '<h4 style="margin-bottom: 10px;">Pedidos Abertos</h4>';
                        html += pedidosAbertos.map(p => renderPedidoCard(p, false)).join('');
                    }
                    
                    if (pedidosEmAndamento.length > 0) {
                        html += '<h4 style="margin: 20px 0 10px;">Pedidos em Andamento</h4>';
                        html += pedidosEmAndamento.map(p => renderPedidoCard(p, false)).join('');
                    }
                    
                    if (pedidosConcluidosNaoAvaliados.length > 0) {
                        html += '<h4 style="margin: 20px 0 10px;">Aguardando Avaliação</h4>';
                        html += pedidosConcluidosNaoAvaliados.map(p => renderPedidoCard(p, false)).join('');
                    }
                } else {
                    // Modo concluídos
                    html += '<h4 style="margin-bottom: 10px;">Pedidos Concluídos e Avaliados</h4>';
                    html += pedidosParaMostrar.map(p => renderPedidoCard(p, false)).join('');
                }

                listaMeusPedidosUrgentes.innerHTML = html;

                // Adicionar listeners para ver propostas
                document.querySelectorAll('.btn-ver-propostas').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const pedidoId = btn.dataset.pedidoId;
                        modalMeusPedidosUrgentes?.classList.add('hidden');
                        await carregarPropostas(pedidoId);
                    });
                });

                // Função auxiliar para redirecionar para avaliação
                const redirecionarParaAvaliacao = (profissionalId, pedidoId, servico) => {
                    // Salva informações no localStorage para usar na avaliação
                    if (pedidoId) {
                        const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                        }
                    }
                    if (servico) {
                        localStorage.setItem('ultimoServicoNome', servico);
                        localStorage.setItem('nomeServicoConcluido', servico);
                        if (pedidoId) {
                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                localStorage.setItem(`nomeServico:${pidClean}`, servico);
                            }
                        }
                    }
                    
                    // Redireciona para a página de perfil com os parâmetros necessários
                    const params = new URLSearchParams({
                        id: profissionalId,
                        pedidoId: pedidoId,
                        servico: servico
                    });
                    window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                };
                
                // Adicionar listeners para avaliar pedidos concluídos não avaliados (card clicável)
                document.querySelectorAll('.proposta-aceita-clickable').forEach(card => {
                    card.addEventListener('click', async () => {
                        const profissionalId = card.dataset.profissionalId;
                        const pedidoId = card.dataset.pedidoId;
                        const servico = card.dataset.servico || '';
                        
                        // Verifica se o pedido está concluído e falta avaliar
                        const pedido = pedidosParaMostrar.find(p => p._id === pedidoId);
                        if (pedido && pedido.status === 'concluido' && pedido.faltaAvaliar) {
                            redirecionarParaAvaliacao(profissionalId, pedidoId, servico);
                        }
                    });
                });
                
                // Adicionar listeners para mensagem "falta avaliar" (quando não está dentro do card clicável)
                document.querySelectorAll('.mensagem-falta-avaliar').forEach(msg => {
                    msg.addEventListener('click', () => {
                        const profissionalId = msg.dataset.profissionalId;
                        const pedidoId = msg.dataset.pedidoId;
                        const servico = msg.dataset.servico || '';
                        redirecionarParaAvaliacao(profissionalId, pedidoId, servico);
                    });
                });
                
                // Adicionar listeners para cancelar pedidos
                document.querySelectorAll('.btn-cancelar-pedido').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const pedidoId = btn.dataset.pedidoId;
                        
                        // Usar modal de confirmação estilizado
                        abrirConfirmacaoAcao({
                            titulo: 'Cancelar pedido',
                            texto: 'Tem certeza? Não será desfeita!',
                            exigeMotivo: false,
                            onConfirm: async () => {
                                try {
                                    const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/cancelar`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                        }
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                        // Mostrar mensagem discreta em vermelho claro
                                        const mensagemDiscreta = document.createElement('div');
                                        mensagemDiscreta.style.cssText = 'position: fixed; top: 100px; right: 20px; background: rgba(239, 83, 80, 0.95); color: white; padding: 8px 16px; border-radius: 4px; font-size: 14px; z-index: 10000; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-weight: 500;';
                                        mensagemDiscreta.textContent = 'Cancelado';
                                        document.body.appendChild(mensagemDiscreta);
                                        
                                        setTimeout(() => {
                                            mensagemDiscreta.style.opacity = '0';
                                            mensagemDiscreta.style.transition = 'opacity 0.3s ease';
                                            setTimeout(() => mensagemDiscreta.remove(), 300);
                                        }, 1500);
                                        
                                        // Recarrega serviços ativos após cancelar pedido
                                        if (typeof window.carregarServicosAtivos === 'function') {
                                            await window.carregarServicosAtivos();
                                        }
                                    } else {
                                        alert(data.message || 'Erro ao cancelar pedido.');
                                    }
                                } catch (error) {
                                    console.error('Erro ao cancelar pedido urgente:', error);
                                    alert('Erro ao cancelar pedido.');
                                }
                            }
                        });
                    });
                });

                // Adicionar listeners para fotos clicáveis (abrir modal)
                document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const fotoUrl = img.dataset.fotoUrl || img.src;
                        if (typeof window.abrirModalImagem === 'function') {
                            window.abrirModalImagem(fotoUrl);
                        }
                    });
                });

                // Adicionar listener para caixa de proposta aceita (navegar para avaliação)
                document.querySelectorAll('.proposta-aceita-clickable').forEach(caixa => {
                    caixa.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const profissionalId = caixa.dataset.profissionalId;
                        const pedidoId = caixa.dataset.pedidoId;
                        const servico = caixa.dataset.servico || '';
                        
                        if (!profissionalId || !pedidoId) {
                            console.error('❌ Dados insuficientes para navegar para avaliação');
                            return;
                        }

                        // Buscar informações do pedido para obter agendamentoId se existir
                        try {
                            const token = localStorage.getItem('token');
                            const pedidoResponse = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            let agendamentoId = null;
                            if (pedidoResponse.ok) {
                                const pedidoData = await pedidoResponse.json();
                                // Tentar encontrar agendamentoId na proposta aceita
                                const propostaAceita = pedidoData.pedido?.propostas?.find(p => p.status === 'aceita');
                                agendamentoId = propostaAceita?.agendamentoId || pedidoData.pedido?.agendamentoId || null;
                            }

                            // Preparar parâmetros para navegação
                            const params = new URLSearchParams({
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId
                            });

                            if (agendamentoId) {
                                params.set('agendamentoId', agendamentoId);
                            }

                            if (servico) {
                                params.set('servico', servico);
                            }

                            // Buscar foto do pedido do localStorage se disponível
                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                            if (pidClean) {
                                const fotoCache = localStorage.getItem(`fotoPedido:${pidClean}`) 
                                    || localStorage.getItem('fotoUltimoServicoConcluido')
                                    || localStorage.getItem('ultimaFotoPedido');
                                if (fotoCache) {
                                    params.set('foto', fotoCache);
                                }
                            }

                            // Navegar para o perfil com a seção de avaliação
                            console.log('🔗 Navegando para avaliação:', `/perfil?${params.toString()}#secao-avaliacao`);
                            console.log('🔗 Parâmetros sendo passados:', {
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId,
                                agendamentoId: agendamentoId || 'não fornecido',
                                servico: servico || 'não fornecido'
                            });
                            window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                        } catch (error) {
                            console.error('❌ Erro ao buscar dados do pedido:', error);
                            // Mesmo assim, tentar navegar sem agendamentoId
                            const params = new URLSearchParams({
                                id: profissionalId,
                                origem: 'pedido_urgente',
                                pedidoId: pedidoId
                            });
                            if (servico) {
                                params.set('servico', servico);
                            }
                            window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                        }
                    });
                });
        } catch (error) {
            console.error('Erro ao carregar meus pedidos urgentes:', error);
            listaMeusPedidosUrgentes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar seus pedidos. Tente novamente.</p>';
        }
    }


    // A função adicionarBotoesAcaoRapida já foi definida acima e cuida tanto de trabalhador quanto cliente

    // Listener para o botão "Concluídos"
    // Função para carregar pedidos concluídos em modal separado
    async function carregarPedidosConcluidos() {
        if (!listaPedidosConcluidos) return;

        try {
            listaPedidosConcluidos.innerHTML = '<p>Carregando pedidos concluídos...</p>';
            
            // Buscar pedidos concluídos que foram avaliados
            const response = await fetch('/api/pedidos-urgentes/meus?status=concluido', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const pedidosConcluidos = data.pedidosAtivos || data.pedidos || [];
                
                // Verificar quais pedidos foram avaliados
                const pedidosComAvaliacao = await Promise.all(
                    pedidosConcluidos.map(async (pedido) => {
                        try {
                            const avaliacaoResponse = await fetch(`/api/avaliacoes-verificadas/pedido/${pedido._id}`, {
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            
                            if (avaliacaoResponse.ok) {
                                const avaliacaoData = await avaliacaoResponse.json();
                                // Verificar se há avaliação deste cliente para este pedido
                                const temAvaliacao = avaliacaoData.success && avaliacaoData.avaliacoes && avaliacaoData.avaliacoes.some(av => {
                                    const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                                    return clienteId && String(clienteId) === String(userId);
                                });
                                if (temAvaliacao) {
                                    pedido.avaliado = true;
                                    return pedido;
                                }
                                return null;
                            }
                            return null;
                        } catch (error) {
                            console.error('Erro ao verificar avaliação do pedido:', error);
                            return null;
                        }
                    })
                );
                
                const pedidosParaMostrar = pedidosComAvaliacao.filter(p => p !== null);

                if (pedidosParaMostrar.length === 0) {
                    listaPedidosConcluidos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem pedidos concluídos avaliados.</p>';
                    return;
                }

                // Usar a mesma função de renderização
                function renderPedidoCard(pedido) {
                    const numPropostas = pedido.propostas?.length || 0;
                    const statusBadge = '<span class="badge-status badge-concluido">Concluído</span>';

                    // Encontrar proposta aceita
                    const propostaAceita = pedido.propostas?.find(p => p.status === 'aceita');
                    const profissionalAceito = propostaAceita?.profissionalId;
                    const valorAceito = propostaAceita?.valor;

                    // Verifica se tem múltiplas fotos ou apenas uma
                    const temFotos = pedido.fotos && Array.isArray(pedido.fotos) && pedido.fotos.length > 0;
                    const temFotoUnica = pedido.foto && !temFotos;
                    const fotosParaMostrar = temFotos ? pedido.fotos : (temFotoUnica ? [pedido.foto] : []);

                    return `
                        <div class="pedido-urgente-card" style="margin-bottom: 20px; overflow: visible !important; overflow-x: visible !important; overflow-y: visible !important; max-height: none !important; height: auto !important;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong style="font-size: 18px;">${pedido.servico}</strong>
                                    ${statusBadge}
                                </div>
                            </div>
                            
                            ${fotosParaMostrar.length > 0 ? `
                                <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                    ${fotosParaMostrar.length > 1 ? 
                                        fotosParaMostrar.map((foto, idx) => `
                                            <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                        `).join('') :
                                        `<img src="${fotosParaMostrar[0]}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${fotosParaMostrar[0]}" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                    }
                                </div>
                            ` : ''}
                            
                            ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            
                            ${pedido.localizacao ? `
                                <div class="pedido-localizacao">
                                    <i class="fas fa-map-marker-alt"></i> 
                                    ${(() => {
                                        // Monta endereço completo com todos os dados
                                        const enderecoParts = [];
                                        
                                        // Prioriza enderecoCompleto ou endereco, mas sempre adiciona bairro separadamente se disponível
                                        const enderecoBase = pedido.localizacao.enderecoCompleto || pedido.localizacao.endereco || '';
                                        const numero = pedido.localizacao.numero || '';
                                        const bairro = pedido.localizacao.bairro || '';
                                        
                                        if (enderecoBase) {
                                            // Se tem endereço base, adiciona ele primeiro
                                            if (numero && !enderecoBase.includes(numero)) {
                                                // Se o número não está no endereço base, adiciona
                                                enderecoParts.push(`${enderecoBase}, ${numero}`);
                                            } else {
                                                enderecoParts.push(enderecoBase);
                                            }
                                        } else {
                                            // Se não tem endereço base, monta a partir dos campos individuais
                                            const rua = pedido.localizacao.rua || '';
                                            if (rua) {
                                                if (numero) {
                                                    enderecoParts.push(`${rua}, ${numero}`);
                                                } else {
                                                    enderecoParts.push(rua);
                                                }
                                            } else if (numero) {
                                                // Se não tem rua mas tem número, adiciona apenas o número
                                                enderecoParts.push(numero);
                                            }
                                        }
                                        
                                        // SEMPRE adiciona bairro se disponível (mesmo que já tenha enderecoCompleto)
                                        if (bairro) {
                                            // Verifica se o bairro já não está no endereço base
                                            if (!enderecoBase.toLowerCase().includes(bairro.toLowerCase())) {
                                                enderecoParts.push(bairro);
                                            }
                                        }
                                        
                                        const cidade = pedido.localizacao.cidade || '';
                                        const estado = pedido.localizacao.estado || '';
                                        if (cidade) enderecoParts.push(cidade);
                                        if (estado) enderecoParts.push(estado);
                                        
                                        const pontoReferencia = pedido.localizacao.pontoReferencia || '';
                                        
                                        const enderecoTexto = enderecoParts.length > 0 ? enderecoParts.join(' - ') : 'Endereço não informado';
                                        const enderecoMapa = encodeURIComponent(enderecoParts.join(' - '));
                                        
                                        return `
                                            <a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" 
                                               target="_blank" 
                                               rel="noopener noreferrer"
                                               style="color: var(--primary-color, #007bff); text-decoration: none; cursor: pointer; transition: color 0.2s;"
                                               onmouseover="this.style.color='var(--primary-hover, #0056b3)'"
                                               onmouseout="this.style.color='var(--primary-color, #007bff)'">
                                                ${enderecoTexto}
                                            </a>
                                            ${pontoReferencia ? `<p style="margin: 8px 0 0 0; color: var(--text-secondary, #666); font-size: 0.9em;"><strong>Ponto de referência:</strong> ${pontoReferencia}</p>` : ''}
                                        `;
                                    })()}
                                </div>
                            ` : ''}

                            ${propostaAceita && profissionalAceito ? `
                                <div class="proposta-aceita-clickable" 
                                     data-profissional-id="${profissionalAceito._id || profissionalAceito.id}" 
                                     data-pedido-id="${pedido._id}"
                                     data-servico="${pedido.servico || ''}"
                                     style="margin-top: 15px; padding: 15px; background: linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%); border: 1px solid rgba(40, 167, 69, 0.3); border-radius: 8px; cursor: pointer; transition: all 0.2s ease;"
                                     onmouseover="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.15) 0%, rgba(40, 167, 69, 0.1) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.5)';"
                                     onmouseout="this.style.background='linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%)'; this.style.borderColor='rgba(40, 167, 69, 0.3)';">
                                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                                        <div style="flex: 1;">
                                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                                                <i class="fas fa-check-circle" style="color: #28a745; font-size: 16px;"></i>
                                                <strong style="color: #28a745; font-size: 14px;">Proposta Aceita</strong>
                                            </div>
                                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                                ${profissionalAceito.foto || profissionalAceito.avatarUrl ? `
                                                    <a href="/perfil?id=${profissionalAceito._id || profissionalAceito.id || ''}" style="text-decoration: none; display: inline-flex; pointer-events: auto;">
                                                        <img src="${profissionalAceito.foto || profissionalAceito.avatarUrl}" 
                                                             alt="${profissionalAceito.nome}" 
                                                             style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(40, 167, 69, 0.3);">
                                                    </a>
                                                ` : ''}
                                                <a href="/perfil?id=${profissionalAceito._id || profissionalAceito.id || ''}" style="flex: 1; min-width: 150px; text-decoration: none; color: inherit; pointer-events: auto;">
                                                    <div style="font-weight: 600; color: var(--text-primary); font-size: 15px;">
                                                        ${profissionalAceito.nome || 'Profissional'}
                                                    </div>
                                                    ${profissionalAceito.cidade && profissionalAceito.estado ? `
                                                        <div style="font-size: 12px; color: var(--text-secondary);">
                                                            <i class="fas fa-map-marker-alt"></i> ${profissionalAceito.cidade} - ${profissionalAceito.estado}
                                                        </div>
                                                    ` : ''}
                                                </a>
                                                ${valorAceito ? `
                                                    <div style="text-align: right; pointer-events: none;">
                                                        <div style="font-size: 18px; font-weight: 700; color: #28a745;">
                                                            R$ ${parseFloat(valorAceito).toFixed(2)}
                                                        </div>
                                                        <div style="font-size: 11px; color: var(--text-secondary);">
                                                            Valor aceito
                                                        </div>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ` : `
                                <div style="margin-top: 15px; padding: 15px; background: var(--bg-secondary); border-radius: 8px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <strong><i class="fas fa-hand-holding-usd"></i> Propostas Recebidas: ${numPropostas}</strong>
                                    </div>
                                </div>
                            `}
                        </div>
                    `;
                }

                let html = '<h4 style="margin-bottom: 10px;">Pedidos Concluídos e Avaliados</h4>';
                html += pedidosParaMostrar.map(p => renderPedidoCard(p)).join('');

                listaPedidosConcluidos.innerHTML = html;

                // Adicionar listeners para fotos clicáveis (abrir modal)
                document.querySelectorAll('#lista-pedidos-concluidos .foto-pedido-clickable').forEach(img => {
                    img.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const fotoUrl = img.dataset.fotoUrl || img.src;
                        if (typeof window.abrirModalImagem === 'function') {
                            window.abrirModalImagem(fotoUrl);
                        }
                    });
                });
            } else {
                listaPedidosConcluidos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos concluídos.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar pedidos concluídos:', error);
            listaPedidosConcluidos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar pedidos concluídos. Tente novamente.</p>';
        }
    }

    // Listener para o botão "Concluídos"
    if (btnPedidosConcluidos) {
        btnPedidosConcluidos.addEventListener('click', async () => {
            // Fechar modal de pedidos abertos
            if (modalMeusPedidosUrgentes) {
                modalMeusPedidosUrgentes.classList.add('hidden');
            }
            // Abrir modal de pedidos concluídos
            if (modalPedidosConcluidos) {
                await carregarPedidosConcluidos();
                modalPedidosConcluidos.classList.remove('hidden');
            }
        });
    }

    // Observer removido - funcionalidade integrada no modal "Procurar Pedidos" via botão "Meus serviços ativos"
    // O modal "Meus Pedidos Urgentes" ainda existe no HTML para compatibilidade, mas não é mais usado como botão lateral

    if (formEnviarProposta) {
        formEnviarProposta.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pedidoId = document.getElementById('proposta-pedido-id').value;
            const valor = parseFloat(document.getElementById('proposta-valor').value);
            const tempoChegada = document.getElementById('proposta-tempo-chegada').value;
            const observacoes = document.getElementById('proposta-observacoes').value;

            try {
                const response = await fetch(`/api/pedidos-urgentes/${pedidoId}/proposta`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        valor,
                        tempoChegada,
                        observacoes
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    // Feedback visual com check animado
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = '<span class="check-animado">✔</span> Proposta enviada com sucesso! O cliente será notificado.';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);

                    formEnviarProposta.reset();
                    modalEnviarProposta?.classList.add('hidden');

                    // Atualiza o botão do card para "Aguardando" (sem precisar recarregar)
                    try { localStorage.setItem(`propostaStatus:${pedidoId}`, 'aguardando'); } catch (_) {}
                    const btnCard = document.querySelector(`.btn-enviar-proposta[data-pedido-id="${pedidoId}"]`);
                    if (btnCard) {
                        btnCard.classList.add('btn-proposta-aguardando');
                        btnCard.style.background = '#6c757d';
                        btnCard.innerHTML = `<i class="fas fa-hourglass-half"></i> Aguardando`;
                    }
                } else {
                    alert(data.message || 'Erro ao enviar proposta.');
                }
            } catch (error) {
                console.error('Erro ao enviar proposta:', error);
                alert('Erro ao enviar proposta.');
            }
        });
    }

    // (Botão de criar projeto de time removido da área de ações rápidas para evitar duplicidade com a seção de times)

    if (formProjetoTime) {
        formProjetoTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const titulo = document.getElementById('projeto-titulo').value;
            const descricao = document.getElementById('projeto-descricao').value;
            const categoria = document.getElementById('projeto-categoria').value;
            const dataServico = document.getElementById('projeto-data').value;
            const horaInicio = document.getElementById('projeto-hora-inicio').value;
            const horaFim = document.getElementById('projeto-hora-fim').value;
            const endereco = document.getElementById('projeto-endereco').value;
            const cidade = document.getElementById('projeto-cidade').value;
            const estado = document.getElementById('projeto-estado').value;
            const valorTotal = parseFloat(document.getElementById('projeto-valor-total').value);

            const profissionaisNecessarios = Array.from(profissionaisListaProjeto.children).map(item => ({
                tipo: item.querySelector('.tipo-profissional-projeto').value,
                quantidade: parseInt(item.querySelector('.qtd-profissional-projeto').value),
                valorPorPessoa: parseFloat(item.querySelector('.valor-profissional-projeto').value)
            }));

            try {
                const response = await fetch('/api/projetos-time', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        categoria,
                        localizacao: {
                            endereco,
                            cidade,
                            estado
                        },
                        dataServico,
                        horaInicio,
                        horaFim,
                        profissionaisNecessarios,
                        valorTotal
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Projeto de time criado com sucesso!');
                    formProjetoTime.reset();
                    modalProjetoTime?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao criar projeto.');
                }
            } catch (error) {
                console.error('Erro ao criar projeto de time:', error);
                alert('Erro ao criar projeto de time.');
            }
        });
    }

    // ============================================
    // VAGAS-RELÂMPAGO REMOVIDAS - funcionalidade descontinuada
    // ============================================
    
    // Funções de vagas-relâmpago REMOVIDAS - funcionalidade descontinuada

    // ============================================
    // SISTEMA DE PAGAMENTO SEGURO REMOVIDO - funcionalidade descontinuada
    // ============================================
    
    // Funções de pagamentos garantidos REMOVIDAS - funcionalidade descontinuada

    // Botões de pagamentos garantidos REMOVIDOS - funcionalidade descontinuada

    // ============================================
    // SISTEMA DE NOTIFICAÇÕES
    // ============================================
    
    const btnNotificacoes = document.getElementById('btn-notificacoes');
    const badgeNotificacoes = document.getElementById('badge-notificacoes');
    const modalNotificacoes = document.getElementById('modal-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');

    // Modal genérico de confirmação (para concluir/cancelar serviço, aceitar proposta, etc.)
    const modalConfirmacao = document.getElementById('modal-confirmacao-acao');
    const confirmacaoTitulo = document.getElementById('confirmacao-titulo');
    const confirmacaoTexto = document.getElementById('confirmacao-texto');
    const confirmacaoMotivoGroup = document.getElementById('confirmacao-motivo-group');
    const confirmacaoMotivoInput = document.getElementById('confirmacao-motivo');
    const confirmacaoMotivoErro = document.getElementById('confirmacao-motivo-erro');
    const btnConfirmacaoOk = document.getElementById('confirmacao-ok');
    const btnConfirmacaoCancelar = document.getElementById('confirmacao-cancelar');

    let confirmacaoHandler = null;
    let confirmacaoExigeMotivo = false;

    function abrirConfirmacaoAcao({ titulo, texto, exigeMotivo = false, onConfirm }) {
        if (!modalConfirmacao) return;
        confirmacaoTitulo.textContent = titulo || 'Confirmar ação';
        confirmacaoTexto.textContent = texto || 'Tem certeza que deseja continuar?';
        confirmacaoMotivoGroup.style.display = exigeMotivo ? 'block' : 'none';
        confirmacaoMotivoInput.value = '';
        if (confirmacaoMotivoErro) {
            confirmacaoMotivoErro.style.display = 'none';
            confirmacaoMotivoErro.textContent = '';
        }
        confirmacaoExigeMotivo = exigeMotivo;
        confirmacaoHandler = onConfirm || null;
        modalConfirmacao.classList.remove('hidden');
    }

    function fecharConfirmacaoAcao() {
        if (!modalConfirmacao) return;
        modalConfirmacao.classList.add('hidden');
        confirmacaoHandler = null;
        confirmacaoMotivoInput.value = '';
    }

    if (btnConfirmacaoOk) {
        btnConfirmacaoOk.addEventListener('click', async () => {
            if (!confirmacaoHandler) {
                fecharConfirmacaoAcao();
                return;
            }
            const motivo = confirmacaoMotivoInput.value.trim();
            if (confirmacaoExigeMotivo && !motivo) {
                // Mostra mensagem inline acima do campo, sem fundo
                if (confirmacaoMotivoErro) {
                    confirmacaoMotivoErro.textContent = 'Por favor, informe o motivo';
                    confirmacaoMotivoErro.style.display = 'block';
                    // Remove a mensagem após 3 segundos
                    setTimeout(() => {
                        if (confirmacaoMotivoErro) {
                            confirmacaoMotivoErro.style.display = 'none';
                            confirmacaoMotivoErro.textContent = '';
                        }
                    }, 3000);
                }
                return;
            }
            // Limpa mensagem de erro se houver
            if (confirmacaoMotivoErro) {
                confirmacaoMotivoErro.style.display = 'none';
                confirmacaoMotivoErro.textContent = '';
            }
            const handler = confirmacaoHandler;
            fecharConfirmacaoAcao();
            await handler(motivo);
        });
    }

    if (btnConfirmacaoCancelar) {
        btnConfirmacaoCancelar.addEventListener('click', () => {
            fecharConfirmacaoAcao();
        });
    }

    // Limpa mensagem de erro quando o usuário começa a digitar
    if (confirmacaoMotivoInput) {
        confirmacaoMotivoInput.addEventListener('input', () => {
            if (confirmacaoMotivoErro && confirmacaoMotivoErro.style.display !== 'none') {
                confirmacaoMotivoErro.style.display = 'none';
                confirmacaoMotivoErro.textContent = '';
            }
        });
    }

    // ✅ Se o header-notificacoes.js estiver ativo, ele é o "dono" do badge/modal/polling.
    // Aqui a gente evita duplicar requests e evitar o bug do número não sumir ao abrir.
    function notificacoesGerenciadasPeloHeader() {
        return typeof window.carregarNotificacoes === 'function';
    }

    // Carregar notificações periodicamente
    async function carregarNotificacoes() {
        if (notificacoesGerenciadasPeloHeader()) {
            // Delegar para o gerenciador central
            return await window.carregarNotificacoes();
        }
        if (!badgeNotificacoes && !listaNotificacoes) return;
        // Se não estiver logado, não tenta carregar notificações
        if (!token || !localStorage.getItem('userId')) {
            if (badgeNotificacoes) {
                badgeNotificacoes.style.display = 'none';
            }
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Faça login para ver suas notificações.</p>';
            }
            return;
        }
        
        try {
            const response = await fetch('/api/notificacoes?limit=50', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Atualiza badge
                if (badgeNotificacoes) {
                    if (data.totalNaoLidas > 0) {
                        badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                        badgeNotificacoes.style.display = 'flex';
                    } else {
                        badgeNotificacoes.style.display = 'none';
                    }
                }

                // Se modal está aberto, atualiza lista
                if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                    const notificacoes = data.notificacoes || [];
                    if (notificacoes.length === 0) {
                        listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhuma notificação.</p>';
                    } else {
                        listaNotificacoes.innerHTML = notificacoes.map(notif => {
                            const dataFormatada = new Date(notif.createdAt).toLocaleString('pt-BR');
                            const iconMap = {
                                'pagamento_garantido': '💰',
                                'pagamento_liberado': '✅',
                                'pagamento_reembolsado': '💸',
                                'disputa_aberta': '⚖️',
                                'disputa_resolvida': '⚖️',
                                'proposta_aceita': '🎉',
                                'proposta_pedido_urgente': '💼',
                                'pedido_urgente': '⚡',
                                'servico_concluido': '✨',
                                'avaliacao_recebida': '⭐'
                            };
                            
                            return `
                                <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'}" data-notif-id="${notif._id}">
                                    <div style="display: flex; gap: 15px; align-items: flex-start;">
                                        <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                        <div style="flex: 1;">
                                            <strong>${notif.titulo || 'Notificação'}</strong>
                                            <p style="margin: 5px 0; color: var(--text-secondary);">${notif.mensagem || ''}</p>
                                            <small style="color: var(--text-secondary);">${dataFormatada}</small>
                                        </div>
                                        ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');

                        // Adiciona listeners para marcar como lida ao clicar e abrir ações relacionadas
                        document.querySelectorAll('.notificacao-card').forEach(card => {
                            card.addEventListener('click', async () => {
                                const notifId = card.dataset.notifId;
                                if (notifId) {
                                    await marcarNotificacaoLida(notifId);
                                    
                                    // Localiza a notificação completa
                                    const notif = notificacoes.find(n => n._id === notifId);
                                    
                                    // Se for notificação de proposta de pedido urgente, abre o modal de propostas
                                    if (notif && notif.tipo === 'proposta_pedido_urgente' && notif.dadosAdicionais?.pedidoId) {
                                        modalNotificacoes?.classList.add('hidden');
                                        await carregarPropostas(notif.dadosAdicionais.pedidoId);
                                    }

                                    // Se for notificação de proposta aceita, abre Serviços Ativos e destaca o pedido
                                    if (notif && notif.tipo === 'proposta_aceita' && (notif.dadosAdicionais?.pedidoId || notif.dadosAdicionais?.agendamentoId)) {
                                        modalNotificacoes?.classList.add('hidden');
                                        const pedidoId = notif.dadosAdicionais?.pedidoId || notif.dadosAdicionais?.agendamentoId;
                                        if (typeof window.carregarServicosAtivos === 'function') {
                                            await window.carregarServicosAtivos(pedidoId);
                                        modalServicosAtivos?.classList.remove('hidden');
                                        }
                                    }

                                    // Se for notificação de serviço concluído, abre página de avaliação do profissional
                                    if (notif && notif.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                        modalNotificacoes?.classList.add('hidden');
                                        const profissionalId = notif.dadosAdicionais.profissionalId;
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId || '';
                                        const fotoServico = notif.dadosAdicionais.foto || '';
                                        const pedidoId = notif.dadosAdicionais.pedidoId || '';
                                        let pidClean = '';
                                        if (pedidoId) {
                                            pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                        }
                                        // Tenta descobrir o nome do serviço
                                        let nomeServico = notif.dadosAdicionais?.servico || '';
                                        if (!nomeServico && pidClean) {
                                            try {
                                                const respPedido = await fetch(`/api/pedidos-urgentes/${pidClean}`, { headers: { 'Authorization': `Bearer ${token}` } });
                                                if (respPedido.ok) {
                                                    const pedido = await respPedido.json();
                                                    nomeServico =
                                                        pedido?.servico ||
                                                        pedido?.titulo ||
                                                        pedido?.descricao ||
                                                        pedido?.categoria ||
                                                        pedido?.nome ||
                                                        '';
                                                }
                                            } catch (e) {
                                                console.warn('Falha ao buscar nome do serviço do pedido', e);
                                            }
                                        }
                                        if (nomeServico) {
                                            try {
                                                localStorage.setItem('ultimoServicoNome', nomeServico);
                                                localStorage.setItem('ultimaDescricaoPedido', nomeServico);
                                                localStorage.setItem('nomeServicoConcluido', nomeServico);
                                            } catch (e) {
                                                console.warn('Falha ao cachear nome do serviço', e);
                                            }
                                        }
                                        if (fotoServico) {
                                            localStorage.setItem('fotoUltimoServicoConcluido', fotoServico);
                                            localStorage.setItem('ultimaFotoPedido', fotoServico);
                                            if (pidClean) {
                                                localStorage.setItem(`fotoPedido:${pidClean}`, fotoServico);
                                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            }
                                        } else if (pidClean) {
                                            // tenta reaproveitar cache se a notificação não trouxe foto
                                            const fotoCache = localStorage.getItem(`fotoPedido:${pidClean}`) || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                            if (fotoCache) {
                                                localStorage.setItem('fotoUltimoServicoConcluido', fotoCache);
                                                localStorage.setItem('ultimaFotoPedido', fotoCache);
                                                localStorage.setItem(`fotoPedido:${pidClean}`, fotoCache);
                                                localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            }
                                        }
                                        // Abre o perfil do profissional já focado na seção de avaliação,
                                        // passando o agendamento para criar avaliação verificada
                                        const params = new URLSearchParams({
                                            id: profissionalId,
                                            origem: 'servico_concluido',
                                            agendamentoId
                                        });
                                        const fotoParam = fotoServico 
                                            || (pedidoId ? localStorage.getItem(`fotoPedido:${String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || ''}`) : null) 
                                            || localStorage.getItem('fotoUltimoServicoConcluido') 
                                            || localStorage.getItem('ultimaFotoPedido');
                                        if (fotoParam) params.set('foto', fotoParam);
                                        if (pedidoId) {
                                            const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                            if (pidClean) params.set('pedidoId', pidClean);
                                        }
                                        if (nomeServico) params.set('servico', nomeServico);
                                        window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                    }
                                }
                            });
                        });
                    }
                }
            } else {
                console.error('Erro na resposta de notificações:', data.message);
                if (listaNotificacoes) {
                    listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
            if (listaNotificacoes) {
                listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações. Tente novamente.</p>';
            }
            if (badgeNotificacoes) {
                badgeNotificacoes.style.display = 'none';
            }
        }
    }

    async function marcarNotificacaoLida(notifId) {
        try {
            await fetch(`/api/notificacoes/${notifId}/lida`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            await carregarNotificacoes();
        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    }

    if (btnNotificacoes) {
        if (notificacoesGerenciadasPeloHeader()) {
            // O header-notificacoes.js já gerencia abrir/fechar e marcar como lidas
        } else {
        // Abre/fecha o dropdown de notificações embaixo do botão
        btnNotificacoes.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!modalNotificacoes) return;

            const estaOculto = modalNotificacoes.classList.contains('hidden');

            // Se já está aberto, fecha
            if (!estaOculto) {
                modalNotificacoes.classList.add('hidden');
                return;
            }

            // Abrindo: mostra o dropdown e carrega as notificações
            if (listaNotificacoes) {
                listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
            }
            modalNotificacoes.classList.remove('hidden');

            await carregarNotificacoes();

            // Ao abrir o dropdown, marca automaticamente TODAS como lidas
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                // Atualiza badge e lista após marcar como lidas
                await carregarNotificacoes();
            } catch (error) {
                console.error('Erro ao marcar todas notificações como lidas ao abrir:', error);
            }
        });

        // Fecha o dropdown ao clicar fora da caixinha de notificações
        document.addEventListener('click', (e) => {
            if (!modalNotificacoes || modalNotificacoes.classList.contains('hidden')) return;
            const cliqueDentroDropdown = modalNotificacoes.contains(e.target);
            const cliqueNoBotao = btnNotificacoes.contains(e.target);
            if (!cliqueDentroDropdown && !cliqueNoBotao) {
                modalNotificacoes.classList.add('hidden');
            }
        });
        }
    }

    if (btnMarcarTodasLidas) {
        if (notificacoesGerenciadasPeloHeader()) {
            // O header-notificacoes.js já gerencia este botão
        } else {
        btnMarcarTodasLidas.addEventListener('click', async () => {
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                await carregarNotificacoes();
            } catch (error) {
                console.error('Erro ao marcar todas como lidas:', error);
            }
        });
        }
    }

    // Carrega notificações a cada 30 segundos
    if (!notificacoesGerenciadasPeloHeader()) {
        setInterval(carregarNotificacoes, 30000);
        carregarNotificacoes(); // Carrega imediatamente
    }

    // ============================================
    // SISTEMA DE DISPUTAS
    // ============================================
    
    const modalCriarDisputa = document.getElementById('modal-criar-disputa');
    const formCriarDisputa = document.getElementById('form-criar-disputa');
    const modalMinhasDisputas = document.getElementById('modal-minhas-disputas');

    // Função para abrir modal de criar disputa
    window.abrirCriarDisputa = function(pagamentoId) {
        if (!modalCriarDisputa) return;
        document.getElementById('disputa-pagamento-id').value = pagamentoId;
        modalCriarDisputa.classList.remove('hidden');
    };

    if (formCriarDisputa) {
        formCriarDisputa.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const pagamentoId = document.getElementById('disputa-pagamento-id').value;
            const tipo = document.getElementById('disputa-tipo').value;
            const motivo = document.getElementById('disputa-motivo').value;
            const evidencias = [
                document.getElementById('disputa-evidencia-1').value,
                document.getElementById('disputa-evidencia-2').value,
                document.getElementById('disputa-evidencia-3').value
            ].filter(e => e.trim() !== '');

            try {
                const response = await fetch('/api/disputas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        pagamentoId,
                        tipo,
                        motivo,
                        evidencias
                    })
                });

                const data = await response.json();
                
                if (data.success) {
                    alert('Disputa criada com sucesso! Nossa equipe analisará o caso em até 48 horas.');
                    formCriarDisputa.reset();
                    modalCriarDisputa.classList.add('hidden');
                    await carregarDisputas();
                } else {
                    alert(data.message || 'Erro ao criar disputa.');
                }
            } catch (error) {
                console.error('Erro ao criar disputa:', error);
                alert('Erro ao criar disputa.');
            }
        });
    }

    async function carregarDisputas() {
        const listaDisputas = document.getElementById('lista-disputas');
        if (!listaDisputas) return;

        try {
            const response = await fetch('/api/disputas', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                if (data.disputas.length === 0) {
                    listaDisputas.innerHTML = '<p>Você não tem disputas.</p>';
                    return;
                }

                listaDisputas.innerHTML = data.disputas.map(disputa => {
                    const pagamento = disputa.pagamentoId;
                    const statusBadge = {
                        'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                        'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                        'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Cliente)</span>',
                        'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida (Favorável ao Profissional)</span>',
                        'cancelada': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Cancelada</span>'
                    }[disputa.status] || '';

                    return `
                        <div class="disputa-card">
                            <div class="disputa-header">
                                <div>
                                    <strong>Disputa #${disputa._id.toString().substring(0, 8)}</strong>
                                    <p style="margin: 5px 0; color: var(--text-secondary);">Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}</p>
                                </div>
                                ${statusBadge}
                            </div>
                            <div class="disputa-info">
                                <p><strong>Tipo:</strong> ${disputa.tipo.replace(/_/g, ' ')}</p>
                                <p><strong>Motivo:</strong> ${disputa.motivo}</p>
                                ${disputa.resolucao ? `<p><strong>Resolução:</strong> ${disputa.resolucao}</p>` : ''}
                                <small style="color: var(--text-secondary);">Criada em: ${new Date(disputa.createdAt).toLocaleString('pt-BR')}</small>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Erro ao carregar disputas:', error);
            listaDisputas.innerHTML = '<p>Erro ao carregar disputas.</p>';
        }
    }

    // (Botão lateral de "Minhas Disputas" removido para simplificar a navegação)

    // Adicionar botão "Abrir Disputa" nos cards de pagamento quando status é "pago"
    // Isso será feito dinamicamente quando os pagamentos forem renderizados

    // ============================================
    // DASHBOARD ADMINISTRATIVO
    // ============================================
    
    const modalDashboardAdmin = document.getElementById('modal-dashboard-admin');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminTabContents = document.querySelectorAll('.admin-tab-content');

    // Sistema de abas
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Remove active de todos
            adminTabBtns.forEach(b => b.classList.remove('active'));
            adminTabContents.forEach(c => c.classList.remove('active'));
            
            // Adiciona active no selecionado
            btn.classList.add('active');
            document.getElementById(`admin-tab-${tab}`).classList.add('active');
            
            // Carrega conteúdo da aba
            if (tab === 'pagamentos') {
                carregarAdminPagamentos();
            } else if (tab === 'disputas') {
                carregarAdminDisputas();
            } else if (tab === 'financeiro') {
                carregarAdminFinanceiro();
            }
        });
    });

    async function carregarDashboardAdmin() {
        if (!modalDashboardAdmin) return;

        try {
            const response = await fetch('/api/admin/dashboard', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                const stats = data.dashboard.estatisticas;
                
                // Preenche cards de estatísticas
                const adminEstatisticas = document.getElementById('admin-estatisticas');
                if (adminEstatisticas) {
                    adminEstatisticas.innerHTML = `
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Total de Pagamentos</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.totalPagamentos}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Este Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosMes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Mês</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Disputas Abertas</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.disputasAbertas}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Pagamentos Pendentes</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">${stats.pagamentosPendentes}</div>
                        </div>
                        <div class="admin-stat-card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%); color: white; padding: 20px; border-radius: 8px;">
                            <div style="font-size: 14px; opacity: 0.9;">Receita do Ano</div>
                            <div style="font-size: 32px; font-weight: bold; margin-top: 10px;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</div>
                        </div>
                    `;
                }

                // Preenche lista de pagamentos
                carregarAdminPagamentos(data.dashboard.pagamentosRecentes);
                
                // Preenche lista de disputas
                carregarAdminDisputas(data.dashboard.disputasRecentes);
                
                // Preenche resumo financeiro
                carregarAdminFinanceiro(stats);
            }
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            if (error.message.includes('403')) {
                alert('Acesso negado. Apenas administradores podem acessar o dashboard.');
            }
        }
    }

    async function carregarAdminPagamentos(pagamentos = null) {
        const lista = document.getElementById('admin-lista-pagamentos');
        if (!lista) return;

        if (!pagamentos) {
            // Se não foram passados, busca do dashboard
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                pagamentos = data.dashboard.pagamentosRecentes;
            }
        }

        if (!pagamentos || pagamentos.length === 0) {
            lista.innerHTML = '<p>Nenhum pagamento recente.</p>';
            return;
        }

        lista.innerHTML = pagamentos.map(p => {
            const cliente = p.clienteId;
            const profissional = p.profissionalId;
            const valorLiquido = p.valorLiquido || (p.valor - p.taxaPlataforma);
            const statusBadge = {
                'pendente': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pendente</span>',
                'pago': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Pago</span>',
                'liberado': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Liberado</span>',
                'reembolsado': '<span style="background: #6c757d; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Reembolsado</span>'
            }[p.status] || '';

            return `
                <div class="admin-pagamento-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${cliente?.nome || 'Cliente'} → ${profissional?.nome || 'Profissional'}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                ${p.tipoServico === 'agendamento' ? 'Agendamento' : 'Pedido Urgente'} • 
                                R$ ${p.valor.toFixed(2)} • 
                                Taxa: R$ ${p.taxaPlataforma.toFixed(2)}
                            </p>
                            <small style="color: var(--text-secondary);">${new Date(p.createdAt).toLocaleString('pt-BR')}</small>
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function carregarAdminDisputas(disputas = null) {
        const lista = document.getElementById('admin-lista-disputas');
        if (!lista) return;

        if (!disputas) {
            const response = await fetch('/api/admin/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                disputas = data.dashboard.disputasRecentes;
            }
        }

        if (!disputas || disputas.length === 0) {
            lista.innerHTML = '<p>Nenhuma disputa recente.</p>';
            return;
        }

        lista.innerHTML = disputas.map(d => {
            const pagamento = d.pagamentoId;
            const criador = d.criadorId;
            const statusBadge = {
                'aberta': '<span style="background: #ffc107; color: #333; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Aberta</span>',
                'em_analise': '<span style="background: #007bff; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Em Análise</span>',
                'resolvida_cliente': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>',
                'resolvida_profissional': '<span style="background: #28a745; color: white; padding: 4px 10px; border-radius: 12px; font-size: 12px;">Resolvida</span>'
            }[d.status] || '';

            return `
                <div class="admin-disputa-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <strong>Disputa #${d._id.toString().substring(0, 8)}</strong>
                            <p style="margin: 5px 0; color: var(--text-secondary);">
                                Criada por: ${criador?.nome || 'Usuário'} • 
                                Pagamento: R$ ${pagamento?.valor?.toFixed(2) || '0.00'}
                            </p>
                            <p style="margin: 5px 0;"><strong>Tipo:</strong> ${d.tipo.replace(/_/g, ' ')}</p>
                            <p style="margin: 5px 0;"><strong>Motivo:</strong> ${d.motivo.substring(0, 100)}${d.motivo.length > 100 ? '...' : ''}</p>
                            ${d.status === 'aberta' || d.status === 'em_analise' ? `
                                <button class="btn-resolver-disputa" data-disputa-id="${d._id}" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                                    <i class="fas fa-gavel"></i> Resolver Disputa
                                </button>
                            ` : ''}
                        </div>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');

        // Adiciona listeners para resolver disputas
        document.querySelectorAll('.btn-resolver-disputa').forEach(btn => {
            btn.addEventListener('click', () => {
                const disputaId = btn.dataset.disputaId;
                abrirModalResolverDisputa(disputaId);
            });
        });
    }

    function carregarAdminFinanceiro(stats) {
        const resumo = document.getElementById('admin-resumo-financeiro');
        if (!resumo || !stats) return;

        resumo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Mês</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">R$ ${parseFloat(stats.receitaMes).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Receita Total do Ano</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #007bff; margin: 0;">R$ ${parseFloat(stats.receitaAno).toFixed(2)}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Pagamentos Liberados</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #28a745; margin: 0;">${stats.pagamentosLiberados}</p>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: var(--text-secondary);">Taxa Média</h4>
                    <p style="font-size: 28px; font-weight: bold; color: #ffc107; margin: 0;">5%</p>
                </div>
            </div>
        `;
    }

    async function abrirModalResolverDisputa(disputaId) {
        const resolucao = prompt('Digite a resolução da disputa:');
        if (!resolucao) return;

        const favoravelA = confirm('A resolução é favorável ao CLIENTE? (OK = Cliente, Cancelar = Profissional)') ? 'cliente' : 'profissional';

        try {
            const response = await fetch(`/api/disputas/${disputaId}/resolver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resolucao, favoravelA })
            });

            const data = await response.json();
            
            if (data.success) {
                alert('Disputa resolvida com sucesso!');
                await carregarDashboardAdmin();
            } else {
                alert(data.message || 'Erro ao resolver disputa.');
            }
        } catch (error) {
            console.error('Erro ao resolver disputa:', error);
            alert('Erro ao resolver disputa.');
        }
    }

    // Adicionar botão de dashboard admin (apenas para admins)
    // Nota: Em produção, você deve verificar se o usuário é admin no backend
    // Por enquanto, vamos adicionar um botão que só aparece se o usuário tiver permissão
    const acoesRapidas = document.querySelector('.filtro-acoes-rapidas');
    // Só tenta carregar /api/usuario/me se houver token (usuário logado)
    if (acoesRapidas && !document.getElementById('btn-dashboard-admin') && token) {
        // Verifica se é admin (em produção, isso viria do backend)
        fetch('/api/usuario/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(userData => {
            if (userData.isAdmin) {
                const btnAdmin = document.createElement('button');
                btnAdmin.id = 'btn-dashboard-admin';
                btnAdmin.className = 'btn-acao-lateral';
                btnAdmin.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btnAdmin.style.color = 'white';
                btnAdmin.innerHTML = '<i class="fas fa-chart-line"></i> Dashboard Admin';
                acoesRapidas.appendChild(btnAdmin);
                
                btnAdmin.addEventListener('click', async () => {
                    await carregarDashboardAdmin();
                    modalDashboardAdmin?.classList.remove('hidden');
                });
            }
        }).catch(() => {
            // Se não conseguir verificar, não adiciona o botão
        });
    }
});

