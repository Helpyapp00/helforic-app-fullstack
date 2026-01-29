document.addEventListener('DOMContentLoaded', () => {
    // Declara variáveis globais do escopo primeiro
    let avaliacoesCarregadas = false;
    
    // Configurar modal de imagem se não estiver configurado (caso novas-funcionalidades.js não esteja carregado)
    if (typeof window.abrirModalImagem !== 'function') {
        window.abrirModalImagem = function abrirModalImagem(fotoUrl) {
            // Verificar se a URL é válida e não é um avatar
            if (!fotoUrl || 
                typeof fotoUrl !== 'string' ||
                fotoUrl.includes('avatar') || 
                fotoUrl.includes('default-user') ||
                fotoUrl.includes('perfil') ||
                fotoUrl === '' ||
                fotoUrl === 'undefined') {
                console.warn('⚠️ Tentativa de abrir modal com URL inválida ou avatar - ignorando:', fotoUrl);
                return;
            }
            
            const modalImagem = document.getElementById('image-modal-pedido');
            const imagemModal = document.getElementById('modal-image-pedido');
            const btnFecharModal = document.getElementById('close-image-modal-pedido');
            
            if (modalImagem && imagemModal) {
                imagemModal.src = fotoUrl;
                modalImagem.classList.remove('hidden');
                modalImagem.style.display = 'flex';
                modalImagem.style.opacity = '1';
                modalImagem.style.visibility = 'visible';
                modalImagem.style.zIndex = '10001';
                document.body.style.overflow = 'hidden';
                console.log('✅ Modal de imagem aberto');
            } else {
                console.error('❌ Elementos do modal não encontrados');
            }
        };
        
        window.fecharModalImagem = function fecharModalImagem() {
            const modal = document.getElementById('image-modal-pedido');
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                document.body.style.overflow = '';
                console.log('✅ Modal de imagem fechado');
            }
        };
        
        // Configurar botão de fechar
        const btnFecharModal = document.getElementById('close-image-modal-pedido');
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                if (typeof window.fecharModalImagem === 'function') {
                    window.fecharModalImagem();
                }
            }, true);
        }
        
        // Fechar ao clicar no overlay
        const modalImagem = document.getElementById('image-modal-pedido');
        if (modalImagem) {
            modalImagem.addEventListener('click', (e) => {
                if (e.target === modalImagem || e.target.id === 'image-modal-pedido') {
                    if (typeof window.fecharModalImagem === 'function') {
                        window.fecharModalImagem();
                    }
                }
            });
        }
    }
    
    // Fechar apenas o modal de imagem de pedidos ao carregar a página
    setTimeout(() => {
        // Fechar modal de imagem de pedidos (sempre fechar, não é relacionado a avaliação)
        const modalImagemPedido = document.getElementById('image-modal-pedido');
        if (modalImagemPedido && !modalImagemPedido.classList.contains('hidden')) {
            console.log('🔒 Fechando modal de imagem de pedidos ao carregar página de perfil');
            modalImagemPedido.classList.add('hidden');
            modalImagemPedido.style.display = 'none';
            modalImagemPedido.style.opacity = '0';
            modalImagemPedido.style.visibility = 'hidden';
            document.body.style.overflow = '';
            
            // Também tentar usar a função global se existir
            if (typeof window.fecharModalImagem === 'function') {
                window.fecharModalImagem();
            }
        }
        
        // Fechar qualquer outro modal de imagem que possa estar aberto
        const modalImagem = document.getElementById('image-modal');
        if (modalImagem && !modalImagem.classList.contains('hidden')) {
            console.log('🔒 Fechando modal de imagem genérico ao carregar página de perfil');
            modalImagem.classList.add('hidden');
            modalImagem.style.display = 'none';
            document.body.style.overflow = '';
        }
    }, 50);
    
    // --- Identificação do Usuário ---
    const urlParams = new URLSearchParams(window.location.search);
    let agendamentoIdAvaliacao = urlParams.get('agendamentoId') || urlParams.get('agendamento');
    let pedidoIdAvaliacao = urlParams.get('pedidoId') || urlParams.get('pedido');
    const origemAvaliacao = urlParams.get('origem') || '';
    const hashSecaoAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
    const pedidoIdUltimoServicoConcluido = localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
    const agendamentoIdUltimoServico = localStorage.getItem('agendamentoIdUltimoServico') || '';
    
    // IMPORTANTE: Quando vem de notificação, prioriza URL, mas se não tiver, usa localStorage
    // Quando vem de "Meus Pedidos Urgentes", pode não ter na URL mas ter no localStorage
    // IMPORTANTE: Se há hash #secao-avaliacao, SEMPRE tenta usar localStorage como fallback
    if (!pedidoIdAvaliacao && !agendamentoIdAvaliacao) {
        if (hashSecaoAvaliacao || pedidoIdUltimoServicoConcluido) {
            // Usa localStorage se não tem na URL (pode vir de "Meus Pedidos Urgentes" ou após avaliação)
            pedidoIdAvaliacao = pedidoIdUltimoServicoConcluido || '';
            agendamentoIdAvaliacao = agendamentoIdUltimoServico || '';
            console.log('🔍 Usando pedidoId/agendamentoId do localStorage (não estava na URL):', { pedidoIdAvaliacao, agendamentoIdAvaliacao });
        }
    }
    
    // Verifica se veio de uma notificação de serviço concluído
    // Se tem hash de avaliação, considera como vindo de notificação (mesmo sem origem explícita)
    const veioDeNotificacao = origemAvaliacao === 'servico_concluido' || 
                               (hashSecaoAvaliacao && (agendamentoIdAvaliacao || pedidoIdAvaliacao)) ||
                               hashSecaoAvaliacao; // Se tem hash, provavelmente veio de notificação
    
    // Fechar modal de lembrete de avaliação APENAS se NÃO veio de notificação
    if (!veioDeNotificacao) {
        setTimeout(() => {
            const modalLembreteAvaliacao = document.getElementById('modal-lembrete-avaliacao');
            if (modalLembreteAvaliacao && !modalLembreteAvaliacao.classList.contains('hidden')) {
                console.log('🔒 Fechando modal de lembrete de avaliação (não veio de notificação)');
                modalLembreteAvaliacao.classList.add('hidden');
                modalLembreteAvaliacao.style.display = 'none';
                modalLembreteAvaliacao.style.opacity = '0';
                modalLembreteAvaliacao.style.visibility = 'hidden';
                document.body.style.overflow = '';
            }
        }, 100);
    }
    
    console.log('🔍 Debug notificação:', {
        pedidoIdDaURL: urlParams.get('pedidoId'),
        agendamentoIdDaURL: urlParams.get('agendamentoId'),
        origemAvaliacao,
        hashSecaoAvaliacao,
        agendamentoIdAvaliacao,
        pedidoIdAvaliacao,
        veioDeNotificacao,
        windowLocationHash: window.location.hash,
        windowLocationSearch: window.location.search,
        pedidoIdUltimoServicoConcluido,
        agendamentoIdUltimoServico,
        observacao: 'Cada serviço tem seu próprio pedidoId único - não pode usar localStorage'
    });
    
    // Só considera fluxo de serviço se houver parâmetros EXPLÍCITOS na URL OU veio de notificação
    const temParametrosExplicitos = !!(agendamentoIdAvaliacao || pedidoIdAvaliacao || origemAvaliacao === 'servico_concluido');
    let serviceScopeId = agendamentoIdAvaliacao || pedidoIdAvaliacao || '';
    
    // Se veio de notificação mas não tem serviceScopeId na URL, tenta usar do localStorage
    if (!serviceScopeId && veioDeNotificacao) {
        serviceScopeId = agendamentoIdUltimoServico || pedidoIdUltimoServicoConcluido || '';
    }
    
    // isFluxoServico é verdadeiro se:
    // 1. Tem origem explícita de serviço concluído OU pedido urgente OU
    // 2. Tem hash de avaliação E parâmetros explícitos (pedidoId/agendamentoId) OU
    // 3. Tem hash de avaliação E veio de notificação (mesmo sem pedidoId/agendamentoId explícito)
    const isFluxoServico = !!(origemAvaliacao === 'servico_concluido' || 
                              origemAvaliacao === 'pedido_urgente' ||
                              (hashSecaoAvaliacao && temParametrosExplicitos) ||
                              (hashSecaoAvaliacao && veioDeNotificacao));
    
    console.log('🔍 Debug fluxo:', {
        isFluxoServico,
        veioDeNotificacao,
        temParametrosExplicitos,
        serviceScopeId
    });

    // Captura o nome do serviço vindo via URL para uso posterior nos cards de avaliação
    const servicoParamUrl = urlParams.get('servico') || urlParams.get('titulo') || '';
    if (servicoParamUrl) {
        try {
            localStorage.setItem('ultimoServicoNome', servicoParamUrl);
            localStorage.setItem('ultimaDescricaoPedido', servicoParamUrl);
        } catch (e) {
            console.warn('Falha ao cachear servicoParamUrl', e);
        }
    }
    const loggedInUserId = localStorage.getItem('userId');
    // Suporte a slug em /perfil/:slug e também query ?id=...
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const slugFromPath = (pathParts.length >= 2 && pathParts[0] === 'perfil') ? pathParts[1] : null;
    const profileIdFromUrl = urlParams.get('id');
    // Se não tem ID na URL, usa o ID do usuário logado (próprio perfil)
    let profileId = profileIdFromUrl || loggedInUserId || null;
    let isOwnProfile = false;

    // Não limpar mais a URL para evitar confusão de identidade no cabeçalho
    
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType'); 

    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = '/login';
        return;
    }

    // Função helper para obter headers com token validado
    function getAuthHeaders() {
        const currentToken = localStorage.getItem('jwtToken');
        if (!currentToken || currentToken === 'null' || currentToken === 'undefined') {
            console.warn('⚠️ Token inválido ou não encontrado');
            return {};
        }
        return { 'Authorization': `Bearer ${currentToken}` };
    }

    // --- Elementos do DOM (Header) ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const feedButton = document.getElementById('feed-button');
    const logoutButton = document.getElementById('logout-button');
    const logoBox = document.querySelector('.logo-box');
    const btnNotificacoes = document.getElementById('btn-notificacoes');
    const badgeNotificacoes = document.getElementById('badge-notificacoes');
    const modalNotificacoes = document.getElementById('modal-notificacoes');
    const listaNotificacoes = document.getElementById('lista-notificacoes');
    const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');
    const btnLimparNotificacoes = document.getElementById('btn-limpar-notificacoes');
    // Notificações agora são gerenciadas pelo header-notificacoes.js
    const profileButton = document.getElementById('profile-button'); // pode não existir; evita ReferenceError
    const btnAdicionarHorario = document.getElementById('btn-adicionar-horario');
    const formHorarios = document.getElementById('form-horarios');

    // --- Elementos do DOM (Card Principal) ---
    const fotoPerfil = document.getElementById('fotoPerfil');
    const nomePerfil = document.getElementById('nomePerfil');
    const mediaAvaliacaoContainer = document.getElementById('media-avaliacao-container');
    const mediaEstrelas = document.getElementById('mediaEstrelas');
    const totalAvaliacoes = document.getElementById('totalAvaliacoes');
    
    // Infos (Spans e Links)
    const emailPerfil = document.getElementById('emailPerfil'); 
    const telefonePerfil = document.getElementById('telefonePerfil');
    const idadePerfil = document.getElementById('idadePerfil');
    const atuacaoPerfil = document.getElementById('atuacaoPerfil');
    const atuacaoItem = document.getElementById('atuacao-item');
    const descricaoPerfil = document.getElementById('descricaoPerfil');
    
    // 🛑 ATUALIZAÇÃO: Seletores de Localização (agora juntos)
    const localizacaoPerfil = document.getElementById('localizacaoPerfil');
    const localizacaoItem = document.getElementById('localizacao-item');
    // Mantém compatibilidade com elementos antigos se existirem
    const cidadePerfil = document.getElementById('cidadePerfil');
    const estadoPerfil = document.getElementById('estadoPerfil');
    const cidadeItem = document.getElementById('cidade-item');
    const estadoItem = document.getElementById('estado-item');

    // Inputs de Edição (Ocultos)
    const labelInputFotoPerfil = document.getElementById('labelInputFotoPerfil');
    const inputFotoPerfil = document.getElementById('inputFotoPerfil');
    const inputNome = document.getElementById('inputNome');
    const inputEmail = document.getElementById('inputEmail');
    const inputIdade = document.getElementById('inputIdade');
    const inputWhatsapp = document.getElementById('inputWhatsapp');
    const inputAtuacao = document.getElementById('inputAtuacao');
    const inputDescricao = document.getElementById('inputDescricao');
    const inputCidade = document.getElementById('inputCidade');
    const inputEstado = document.getElementById('inputEstado');

    // Novos elementos para modal de foto
    const modalFotoOpcoes = document.getElementById('modalFotoOpcoes');
    const btnVerFoto = document.getElementById('btnVerFoto');
    const btnAlterarFoto = document.getElementById('btnAlterarFoto');
    const modalFotoExpandida = document.getElementById('modalFotoExpandida');
    const fotoExpandida = document.getElementById('fotoExpandida');
    const btnFecharFotoExpandida = document.getElementById('btnFecharFotoExpandida');
    const modalFotoBackdrop = document.querySelector('.modal-foto-backdrop');

    // Botões de Ação
    const btnEditarPerfil = document.getElementById('editarPerfilBtn'); 
    const btnCriarPostagemPerfil = document.getElementById('btnCriarPostagemPerfil');
    const inputPostagemPerfilMidia = document.getElementById('inputPostagemPerfilMidia');
    const modalCriarPostagemPerfil = document.getElementById('modal-criar-postagem-perfil');
    const previewPostagemPerfil = document.getElementById('preview-postagem-perfil');
    const inputPostagemPerfilTexto = document.getElementById('inputPostagemPerfilTexto');
    const btnEnviarPostagemPerfil = document.getElementById('btnEnviarPostagemPerfil');
    const btnCancelarPostagemPerfil = document.getElementById('btnCancelarPostagemPerfil');
    const btnAdicionarFotoPostagemPerfil = document.getElementById('btnAdicionarFotoPostagemPerfil');
    const botoesEdicao = document.querySelector('.botoes-edicao');
    const btnSalvarPerfil = document.getElementById('btnSalvarPerfil');
    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');

    // --- Elementos do DOM (Abas e Seções) ---
    const secaoServicos = document.getElementById('secao-servicos');
    const secaoPostagens = document.getElementById('secao-postagens');
    const mostrarServicosBtn = document.getElementById('mostrarServicosBtn');
    const mostrarPostagensBtn = document.getElementById('mostrarPostagensBtn');
    const galeriaServicos = document.getElementById('galeriaServicos');
    const addServicoBtn = document.getElementById('addServicoBtn');
    const inputFotoServico = document.getElementById('inputFotoServico'); 
    const minhasPostagensContainer = document.getElementById('minhasPostagens');
    
    // --- Elementos do DOM (Modais) ---
    const imageModal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    const closeImageModalBtn = document.getElementById('close-image-modal');
    
    // --- Elementos do DOM (Avaliação) ---
    const secaoAvaliacao = document.getElementById('secao-avaliacao');
    const formAvaliacao = document.getElementById('formAvaliacao');
    const estrelasAvaliacao = document.querySelectorAll('#estrelas-avaliacao-input span');
    const notaSelecionada = document.getElementById('notaSelecionada');
    const comentarioAvaliacaoInput = document.getElementById('comentarioAvaliacaoInput');
    const btnEnviarAvaliacao = document.getElementById('btnEnviarAvaliacao');

    // --- Elementos do Modal de Pré-visualização de Avatar ---
    const modalPreviewAvatar = document.getElementById('modal-preview-avatar');
    const avatarPreviewArea = document.getElementById('avatar-preview-area');
    const avatarPreviewImg = document.getElementById('avatar-preview-img');
    const avatarPreviewCancelBtn = document.getElementById('avatar-preview-cancel');
    const avatarPreviewSaveBtn = document.getElementById('avatar-preview-save');
    
    // --- Elementos do DOM (Logout Modal) ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Clique no logo/nome "Helpy" vai para o feed (e recarrega se já estiver no feed) ---
    function irParaFeedOuRecarregar() {
        const currentPath = window.location.pathname;
        if (currentPath === '/' || currentPath === '/index.html') {
            window.location.reload();
        } else {
            window.location.href = '/';
        }
    }

    if (logoBox) {
        logoBox.addEventListener('click', irParaFeedOuRecarregar);
    }

    // --- Função para garantir que o logo seja carregado corretamente ---
    function loadLogo() {
        const logoImg = document.querySelector('.logo-box img');
        if (logoImg) {
            // Garante que o caminho está correto (tenta relativo e absoluto)
            const logoPaths = [
                'imagens/logohelpy.png',
                '/imagens/logohelpy.png',
                './imagens/logohelpy.png'
            ];
            
            let currentPathIndex = 0;
            
            // Se a imagem não carregou ou deu erro, tenta outros caminhos
            logoImg.onerror = function() {
                currentPathIndex++;
                if (currentPathIndex < logoPaths.length) {
                    console.log(`🔄 Tentando carregar logo do caminho: ${logoPaths[currentPathIndex]}`);
                    logoImg.src = logoPaths[currentPathIndex] + '?t=' + Date.now();
                } else {
                    console.error('❌ Não foi possível carregar o logo de nenhum caminho disponível');
                }
            };
            
            // Verifica se a imagem já foi carregada corretamente
            if (!logoImg.complete || logoImg.naturalHeight === 0) {
                // Se não carregou, força reload com o primeiro caminho
                logoImg.src = logoPaths[0] + '?t=' + Date.now();
            }
            
            // Garante que a imagem está visível
            logoImg.style.display = '';
            logoImg.style.visibility = 'visible';
        }
    }
    
    // Carrega o logo quando a página estiver pronta
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadLogo);
    } else {
        loadLogo();
    }

    // ===== Notificações removidas - agora gerenciadas pelo header-notificacoes.js =====
    // Todo o código de notificações foi movido para header-notificacoes.js para evitar conflitos
    // Removido: carregarNotificacoesPerfil, handleClickLixeira, configurarBotaoLixeira, toggleModoSelecao, etc.
    
    /*
    async function carregarNotificacoesPerfil() {
        if ((!badgeNotificacoes && !listaNotificacoes) || !token || !loggedInUserId) return;
        try {
            const resp = await fetch('/api/notificacoes?limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data.success) throw new Error(data.message || 'Erro ao carregar');

            // Badge
            if (badgeNotificacoes) {
                if (data.totalNaoLidas > 0) {
                    badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                    badgeNotificacoes.style.display = 'flex';
                } else {
                    badgeNotificacoes.style.display = 'none';
                }
            }

            // Lista, se modal aberto
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                const notificacoes = data.notificacoes || [];
                if (notificacoes.length === 0) {
                    listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Nenhuma notificação.</p>';
                } else {
                    const iconMap = {
                        pagamento_garantido: '💰',
                        pagamento_liberado: '✅',
                        pagamento_reembolsado: '💸',
                        disputa_aberta: '⚖️',
                        disputa_resolvida: '⚖️',
                        proposta_aceita: '🎉',
                        proposta_pedido_urgente: '💼',
                        pedido_urgente: '⚡',
                        servico_concluido: '✨',
                        avaliacao_recebida: '⭐'
                    };
                    listaNotificacoes.innerHTML = notificacoes.map(notif => {
                        const dataFmt = new Date(notif.createdAt).toLocaleString('pt-BR');
                        const isSelecionada = notificacoesSelecionadas.has(notif._id);
                        const modoSelecaoClass = modoSelecao ? 'modo-selecao' : '';
                        const selecionadaClass = isSelecionada ? 'selecionada' : '';
                        const paddingLeft = modoSelecao ? '35px' : '15px';
                        return `
                            <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'} ${modoSelecaoClass} ${selecionadaClass}" data-notif-id="${notif._id}">
                                <div style="display: flex; gap: 15px; align-items: flex-start; padding-left: ${paddingLeft};">
                                    <div style="font-size: 24px;">${iconMap[notif.tipo] || '🔔'}</div>
                                    <div style="flex: 1;">
                                        <strong>${notif.titulo || 'Notificação'}</strong>
                                        <p style="margin: 5px 0; color: var(--text-secondary);">${notif.mensagem || ''}</p>
                                        <small style="color: var(--text-secondary);">${dataFmt}</small>
                                    </div>
                                    ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                </div>
                            </div>
                        `;
                    }).join('');

                    // Clique em cada notificação
                    document.querySelectorAll('.notificacao-card').forEach(card => {
                        card.addEventListener('click', async (e) => {
                            const notifId = card.dataset.notifId;
                            if (!notifId) return;
                            
                            // Se estiver em modo de seleção, apenas seleciona/desseleciona
                            if (modoSelecao) {
                                e.stopPropagation();
                                if (notificacoesSelecionadas.has(notifId)) {
                                    notificacoesSelecionadas.delete(notifId);
                                    card.classList.remove('selecionada');
                                } else {
                                    notificacoesSelecionadas.add(notifId);
                                    card.classList.add('selecionada');
                                }
                                atualizarBotaoSelecionarTudo();
                                return;
                            }
                            
                            // Comportamento normal quando não está em modo de seleção
                            try {
                                await fetch(`/api/notificacoes/${notifId}/lida`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                            } catch (err) {
                                console.error('Erro ao marcar notificação como lida', err);
                            }
                            // Redireciona se for serviço concluído (abre avaliação) ou proposta aceita
                            const notif = (data.notificacoes || []).find(n => n._id === notifId);
                            if (notif?.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                const params = new URLSearchParams({
                                    id: notif.dadosAdicionais.profissionalId,
                                    origem: 'servico_concluido'
                                });
                                
                                // Prioriza pedidoId (pedido urgente) sobre agendamentoId
                                // Cada notificação tem seu próprio pedidoId/agendamentoId
                                
                                // Tenta extrair o nome do serviço da mensagem da notificação
                                let nomeServicoDaMensagem = '';
                                if (notif.mensagem) {
                                    const match = notif.mensagem.match(/serviço:\s*([^.]+)/i);
                                    if (match && match[1]) {
                                        nomeServicoDaMensagem = match[1].trim();
                                        console.log('✅ Nome do serviço extraído da mensagem:', nomeServicoDaMensagem);
                                    }
                                }
                                
                                const pedidoId = notif.dadosAdicionais.pedidoId || '';
                                if (pedidoId) {
                                    const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                    if (pidClean) {
                                        params.set('pedidoId', pidClean);
                                        // Busca o nome do serviço do pedido e adiciona aos parâmetros
                                        try {
                                            const pedidoResp = await fetch(`/api/pedidos-urgentes/${pidClean}`, {
                                                headers: { 'Authorization': `Bearer ${token}` }
                                            });
                                            if (pedidoResp.ok) {
                                                const pedido = await pedidoResp.json();
                                                const nomeServico = pedido?.servico || pedido?.titulo || pedido?.descricao || nomeServicoDaMensagem || '';
                                                if (nomeServico) {
                                                    params.set('servico', nomeServico);
                                                    localStorage.setItem('ultimoServicoNome', nomeServico);
                                                    localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                                                    console.log('✅ Nome do serviço salvo do pedido:', nomeServico);
                                                }
                                            }
                                        } catch (e) {
                                            console.warn('Erro ao buscar nome do serviço do pedido:', e);
                                            // Se falhar, usa o nome da mensagem
                                            if (nomeServicoDaMensagem) {
                                                params.set('servico', nomeServicoDaMensagem);
                                                localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                            }
                                        }
                                    }
                                } else if (notif.dadosAdicionais.agendamentoId) {
                                    // Se não tem pedidoId, tenta buscar do agendamento através da lista de agendamentos do cliente
                                    try {
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId;
                                        const agendamentosResp = await fetch(`/api/agenda/cliente`, {
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        if (agendamentosResp.ok) {
                                            const data = await agendamentosResp.json();
                                            const agendamento = data?.agendamentos?.find(a => a._id === agendamentoId || String(a._id) === String(agendamentoId));
                                            const nomeServico = agendamento?.servico || nomeServicoDaMensagem || '';
                                            if (nomeServico) {
                                                params.set('servico', nomeServico);
                                                localStorage.setItem('ultimoServicoNome', nomeServico);
                                                console.log('✅ Nome do serviço salvo do agendamento:', nomeServico);
                                            }
                                        }
                                    } catch (e) {
                                        console.warn('Erro ao buscar nome do serviço do agendamento:', e);
                                        // Se falhar, usa o nome da mensagem
                                        if (nomeServicoDaMensagem) {
                                            params.set('servico', nomeServicoDaMensagem);
                                            localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                        }
                                    }
                                } else if (nomeServicoDaMensagem) {
                                    // Se não tem nem pedidoId nem agendamentoId, usa o nome extraído da mensagem
                                    params.set('servico', nomeServicoDaMensagem);
                                    localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                    console.log('✅ Nome do serviço usado da mensagem:', nomeServicoDaMensagem);
                                }
                                const fotoServico = notif.dadosAdicionais.foto || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                if (fotoServico) params.set('foto', fotoServico);
                                window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                return;
                            }
                            if (notif?.tipo === 'proposta_aceita' && notif.dadosAdicionais?.agendamentoId) {
                                modalNotificacoes?.classList.add('hidden');
                                // Aproveita modal de serviços ativos já existente em feed? aqui apenas recarrega.
                                window.location.reload();
                                return;
                            }
                            
                            // Trata notificação de candidatura em time
                            if (notif?.tipo === 'candidatura_time' && notif.dadosAdicionais?.timeId) {
                                modalNotificacoes?.classList.add('hidden');
                                
                                // Se estiver no feed (index.html), chama a função diretamente
                                if (window.abrirCandidatosPorNotificacao) {
                                    await window.abrirCandidatosPorNotificacao(notif.dadosAdicionais.timeId);
                                } else {
                                    // Se não estiver no feed, redireciona para o feed com parâmetro
                                    window.location.href = `/index.html?abrirCandidatos=${notif.dadosAdicionais.timeId}`;
                                }
                                return;
                            }
                        });
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao carregar notificações (perfil):', error);
            if (badgeNotificacoes) badgeNotificacoes.style.display = 'none';
            if (listaNotificacoes && modalNotificacoes && !modalNotificacoes.classList.contains('hidden')) {
                listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
            }
        }
    }

    if (btnNotificacoes) {
        btnNotificacoes.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!modalNotificacoes) return;
            const estavaOculto = modalNotificacoes.classList.contains('hidden');
            if (!estavaOculto) {
                modalNotificacoes.classList.add('hidden');
                return;
            }
            if (listaNotificacoes) listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
            modalNotificacoes.classList.remove('hidden');
            await carregarNotificacoesPerfil();
            // Configura o botão lixeira quando o modal é aberto (depois de carregar notificações)
            setTimeout(() => {
                console.log('⏰ Configurando botão lixeira após abrir modal...');
                const configurado = configurarBotaoLixeira();
                if (!configurado) {
                    console.error('❌ Falha ao configurar botão lixeira');
                } else {
                    // Testa se o botão está clicável
                    const btnTeste = document.getElementById('btn-limpar-notificacoes');
                    if (btnTeste) {
                        console.log('✅ Botão encontrado após configuração:', btnTeste);
                        console.log('✅ Botão tem onclick?', btnTeste.onclick !== null);
                        console.log('✅ Botão está visível?', btnTeste.offsetParent !== null);
                        console.log('✅ Botão tem atributo onclick?', btnTeste.getAttribute('onclick') !== null);
                    }
                }
            }, 300);
            // marca todas como lidas ao abrir
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await carregarNotificacoesPerfil();
            } catch (err) {
                console.error('Erro ao marcar todas como lidas:', err);
            }
        });

        document.addEventListener('click', (ev) => {
            if (!modalNotificacoes || modalNotificacoes.classList.contains('hidden')) return;
            const cliqueDentro = modalNotificacoes.contains(ev.target);
            const cliqueNoBotao = btnNotificacoes.contains(ev.target);
            if (!cliqueDentro && !cliqueNoBotao) {
                modalNotificacoes.classList.add('hidden');
                // Sai do modo de seleção ao fechar o modal
                if (modoSelecao) {
                    toggleModoSelecao();
                }
            }
        });
    }

    if (btnMarcarTodasLidas) {
        btnMarcarTodasLidas.addEventListener('click', async () => {
            try {
                await fetch('/api/notificacoes/marcar-todas-lidas', {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                await carregarNotificacoesPerfil();
            } catch (err) {
                console.error('Erro ao marcar todas notificações como lidas:', err);
            }
        });
    }

    // Função para lidar com o clique no botão lixeira (tornada global para acesso via onclick)
    window.handleClickLixeira = async function handleClickLixeira(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        console.log('🔴🔴🔴 BOTÃO LIXEIRA CLICADO! Modo seleção atual:', modoSelecao);
        console.log('🔴 Estado:', { modoSelecao, selecionadas: notificacoesSelecionadas.size });
        
        // Se não está em modo de seleção, entra no modo
        if (!modoSelecao) {
            console.log('✅ Entrando no modo de seleção...');
            toggleModoSelecao();
            return;
        }
        
        // Se está em modo de seleção e tem notificações selecionadas, deleta
        if (notificacoesSelecionadas.size === 0) {
            alert('Selecione pelo menos uma notificação para deletar.');
            return;
        }
        
        if (!confirm(`Tem certeza que deseja deletar ${notificacoesSelecionadas.size} notificação(ões)? Esta ação não pode ser desfeita.`)) {
            return;
        }
        
        try {
            const response = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: Array.from(notificacoesSelecionadas) })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                notificacoesSelecionadas.clear();
                toggleModoSelecao(); // Sai do modo de seleção
                await carregarNotificacoesPerfil();
            } else {
                throw new Error(data.message || 'Erro ao deletar notificações');
            }
        } catch (err) {
            console.error('Erro ao deletar notificações:', err);
            alert('Erro ao deletar notificações. Tente novamente.');
        }
    };
    
    // Mantém referência local também
    const handleClickLixeira = window.handleClickLixeira;

    // Função para configurar o botão lixeira (chamada quando necessário)
    function configurarBotaoLixeira() {
        const btnLixeira = document.getElementById('btn-limpar-notificacoes');
        if (!btnLixeira) {
            console.warn('⚠️ Botão lixeira não encontrado no DOM');
            return false;
        }
        
        console.log('🔍 Botão lixeira encontrado:', btnLixeira);
        
        // Remove todos os listeners antigos clonando o elemento
        const novoBtn = btnLixeira.cloneNode(true);
        btnLixeira.parentNode.replaceChild(novoBtn, btnLixeira);
        
        // Função wrapper para garantir que funcione
        const clickHandler = function(e) {
            console.log('🟢 CLIQUE CAPTURADO NO BOTÃO LIXEIRA!');
            e.stopPropagation();
            e.preventDefault();
            handleClickLixeira(e);
            return false;
        };
        
        // Adiciona múltiplos listeners para garantir que funcione
        novoBtn.addEventListener('click', clickHandler, true); // Capture phase
        novoBtn.addEventListener('click', clickHandler, false); // Bubble phase
        novoBtn.onclick = clickHandler;
        
        // Adiciona também onclick inline como último recurso
        novoBtn.setAttribute('onclick', 'console.log("🟢 onclick inline executado"); event.stopPropagation(); event.preventDefault(); if (window.handleClickLixeira) { window.handleClickLixeira(event); } return false;');
        
        // Adiciona também no ícone dentro do botão
        const icon = novoBtn.querySelector('.fa-trash');
        if (icon) {
            icon.style.pointerEvents = 'none'; // Deixa o clique passar para o botão
        }
        
        // Teste: adiciona um listener de mousedown também
        novoBtn.addEventListener('mousedown', function(e) {
            console.log('🟡 Mouse down no botão lixeira!');
        });
        
        console.log('✅ Listener do botão lixeira configurado (múltiplos métodos)');
        return true;
    }

    // Função para atualizar o botão "Selecionar tudo"
    function atualizarBotaoSelecionarTudo() {
        if (!btnSelecionarTudo) return;
        const todasCards = document.querySelectorAll('.notificacao-card');
        const todasSelecionadas = todasCards.length > 0 && notificacoesSelecionadas.size === todasCards.length;
        btnSelecionarTudo.innerHTML = todasSelecionadas 
            ? '<i class="fas fa-square"></i> Desselecionar tudo'
            : '<i class="fas fa-check-square"></i> Selecionar tudo';
    }

    // Função para entrar/sair do modo de seleção
    function toggleModoSelecao() {
        modoSelecao = !modoSelecao;
        notificacoesSelecionadas.clear();
        console.log('🔄 Modo de seleção alterado para:', modoSelecao);
        
        // Busca o botão novamente (pode ter sido clonado)
        const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
        
        if (modoSelecao) {
            if (btnLixeiraAtual) {
                btnLixeiraAtual.classList.add('modo-selecao');
                console.log('✅ Classe modo-selecao adicionada ao botão');
            }
            if (selecionarTudoContainer) {
                selecionarTudoContainer.style.display = 'block';
                console.log('✅ Container selecionar tudo exibido');
            }
        } else {
            if (btnLixeiraAtual) {
                btnLixeiraAtual.classList.remove('modo-selecao');
            }
            if (selecionarTudoContainer) {
                selecionarTudoContainer.style.display = 'none';
            }
        }
        
        // Recarrega as notificações para atualizar o visual
    carregarNotificacoesPerfil();
    }

    // Usa delegação de eventos no modal para garantir que funcione (capture phase)
    if (modalNotificacoes) {
        modalNotificacoes.addEventListener('click', (e) => {
            // Verifica se o clique foi no botão lixeira ou no ícone dentro dele
            const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
            const iconLixeira = e.target.closest('.fa-trash');
            const isLixeira = btnLixeira || (iconLixeira && iconLixeira.closest('#btn-limpar-notificacoes'));
            
            if (isLixeira) {
                e.stopPropagation();
                e.preventDefault();
                console.log('🔴 Clique detectado via delegação no modal!');
                handleClickLixeira(e);
                return false;
            }
        }, true); // Capture phase - captura antes de outros eventos
        console.log('✅ Delegação de eventos configurada no modal (capture phase)');
    }
    
    // Tenta configurar o botão lixeira imediatamente (caso já esteja no DOM)
    setTimeout(() => {
        const configurado = configurarBotaoLixeira();
        if (configurado) {
            console.log('✅ Botão lixeira configurado no carregamento inicial');
        }
    }, 500);

    if (btnSelecionarTudo) {
        btnSelecionarTudo.addEventListener('click', () => {
            const todasCards = document.querySelectorAll('.notificacao-card');
            const todasSelecionadas = notificacoesSelecionadas.size === todasCards.length;
            
            if (todasSelecionadas) {
                // Desseleciona todas
                notificacoesSelecionadas.clear();
                todasCards.forEach(card => card.classList.remove('selecionada'));
            } else {
                // Seleciona todas
                todasCards.forEach(card => {
                    const notifId = card.dataset.notifId;
                    if (notifId) {
                        notificacoesSelecionadas.add(notifId);
                        card.classList.add('selecionada');
                    }
                });
            }
            atualizarBotaoSelecionarTudo();
        });
    }

    */
    // setInterval e carregarNotificacoesPerfil removidos - agora gerenciados por header-notificacoes.js

    // --- Avatar + nome no header levam SEMPRE para o próprio perfil ---
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `/perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `/perfil.html?id=${loggedInUserId}`;
            }
        });
    }


    // --- Buscar dados do usuário quando acessado por slug ---
    async function fetchUsuarioPorSlug(slug) {
        try {
            const resp = await fetch(`/api/usuarios/slug/${encodeURIComponent(slug)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!data.success) return null;
            return data.usuario;
        } catch (error) {
            console.error('Erro ao buscar usuário por slug:', error);
            return null;
        }
    }

    // Controle de avaliações (1 por serviço concluído ou, sem serviço, 1 por visita)
    let avaliacaoSessionKeyBase = '';
    let avaliacaoSessionKey = '';
    let chaveStars = '';

    function atualizarChavesAvaliacao() {
        const pid = profileId || profileIdFromUrl || slugFromPath || 'desconhecido';
        avaliacaoSessionKeyBase = `avaliacaoPerfil:${loggedInUserId}-${pid}`;
        const servicoScope = serviceScopeId;
        avaliacaoSessionKey = servicoScope
            ? `${avaliacaoSessionKeyBase}:servico:${servicoScope}`
            : `${avaliacaoSessionKeyBase}:sessao`;
        chaveStars = `${avaliacaoSessionKey}:stars`;
    }
    // Inicializa as chaves imediatamente (usa slug/id da URL se ainda não resolveu o _id)
    atualizarChavesAvaliacao();

    // Variável para armazenar se já avaliou (verificado via API)
    let avaliacaoJaFeitaCache = null;
    
    // Função assíncrona para verificar se já avaliou via API
    // Função para verificar se já avaliou este serviço específico (pedidoId ou agendamentoId)
    async function verificarAvaliacaoServicoEspecifico(pedidoId, agendamentoId) {
        if (!pedidoId && !agendamentoId) {
            return false; // Sem serviço específico, não pode verificar
        }
        
        if (!profileId || !loggedInUserId) {
            return false;
        }
        
        try {
            const response = await fetch(`/api/avaliacoes-verificadas/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                return false;
            }
            
            const data = await response.json();
            const avaliacoes = data.avaliacoes || [];
            
            console.log('🔍 Verificando avaliação específica do serviço:', {
                pedidoId,
                agendamentoId,
                totalAvaliacoes: avaliacoes.length
            });
            
            // Verifica se alguma avaliação é do usuário logado E deste serviço específico
            const jaAvaliouServico = avaliacoes.some(av => {
                const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                
                const clienteIdStr = clienteId ? String(clienteId) : null;
                const usuarioIdStr = usuarioId ? String(usuarioId) : null;
                const loggedInUserIdStr = String(loggedInUserId);
                
                const usuarioMatch = clienteIdStr === loggedInUserIdStr || usuarioIdStr === loggedInUserIdStr;
                
                if (!usuarioMatch) return false;
                
                // Verifica se é deste serviço específico
                const avPedidoId = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                const avAgendamentoId = av.agendamentoId?._id || av.agendamentoId;
                
                const pedidoMatch = pedidoId && avPedidoId && String(avPedidoId) === String(pedidoId);
                const agendamentoMatch = agendamentoId && avAgendamentoId && String(avAgendamentoId) === String(agendamentoId);
                
                console.log('🔍 Comparando serviço específico:', {
                    pedidoId,
                    avPedidoId,
                    pedidoMatch,
                    agendamentoId,
                    avAgendamentoId,
                    agendamentoMatch,
                    match: pedidoMatch || agendamentoMatch
                });
                
                return pedidoMatch || agendamentoMatch;
            });
            
            console.log('🔍 verificarAvaliacaoServicoEspecifico - resultado:', jaAvaliouServico);
            return jaAvaliouServico;
        } catch (error) {
            console.warn('Erro ao verificar avaliação específica do serviço:', error);
            return false;
        }
    }
    
    async function verificarAvaliacaoJaFeitaAPI() {
        if (avaliacaoJaFeitaCache !== null) {
            return avaliacaoJaFeitaCache;
        }
        
        // Se não tem profileId ou loggedInUserId, não pode verificar
        if (!profileId || !loggedInUserId) {
            avaliacaoJaFeitaCache = false;
            return false;
        }
        
        try {
            const response = await fetch(`/api/avaliacoes-verificadas/${profileId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                avaliacaoJaFeitaCache = false;
                return false;
            }
            
            const data = await response.json();
            const avaliacoes = data.avaliacoes || [];
            
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - avaliacoes recebidas:', avaliacoes.length);
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - loggedInUserId:', loggedInUserId);
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - profileId:', profileId);
            
            // Verifica se alguma avaliação é do usuário logado
            const jaAvaliou = avaliacoes.some(av => {
                // Extrai o clienteId de diferentes formatos (objeto populado ou string/ObjectId)
                const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                
                // Normaliza para strings para comparação
                const clienteIdStr = clienteId ? String(clienteId).trim() : null;
                const usuarioIdStr = usuarioId ? String(usuarioId).trim() : null;
                const loggedInUserIdStr = String(loggedInUserId).trim();
                
                const clienteMatch = clienteIdStr && clienteIdStr === loggedInUserIdStr;
                const usuarioMatch = usuarioIdStr && usuarioIdStr === loggedInUserIdStr;
                const match = clienteMatch || usuarioMatch;
                
                console.log('🔍 Comparando avaliação:', {
                    avaliacaoId: av._id,
                    clienteId: clienteId,
                    clienteIdStr: clienteIdStr,
                    usuarioId: usuarioId,
                    usuarioIdStr: usuarioIdStr,
                    loggedInUserId: loggedInUserId,
                    loggedInUserIdStr: loggedInUserIdStr,
                    clienteMatch: clienteMatch,
                    usuarioMatch: usuarioMatch,
                    match: match,
                    servico: av.servico,
                    clienteIdRaw: JSON.stringify(av.clienteId),
                    clienteIdType: typeof av.clienteId,
                    clienteIdIsObject: typeof av.clienteId === 'object' && av.clienteId !== null
                });
                
                return match;
            });
            
            console.log('🔍 verificarAvaliacaoJaFeitaAPI - resultado:', jaAvaliou);
            
            avaliacaoJaFeitaCache = jaAvaliou;
            
            // Se já avaliou, marca como permanente no localStorage
            if (jaAvaliou) {
                const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profileId}:permanente`;
                localStorage.setItem(chavePermanente, '1');
                console.log('✅ Avaliação encontrada na API, marcando como permanente:', chavePermanente);
            } else {
                console.log('❌ Nenhuma avaliação do usuário logado encontrada');
            }
            
            return jaAvaliou;
        } catch (error) {
            console.warn('Erro ao verificar avaliação via API:', error);
            avaliacaoJaFeitaCache = false;
            return false;
        }
    }
    
    const avaliacaoJaFeita = async () => {
        // Se veio de notificação, SEMPRE verifica apenas o serviço específico, não a avaliação geral
        if (veioDeNotificacao || hashSecaoAvaliacao) {
            // IMPORTANTE: Quando vem de notificação, SEMPRE usa apenas pedidoId da URL (não do localStorage)
            // Cada serviço tem seu próprio pedidoId único - não pode usar o do localStorage
            const pedidoIdParaVerificar = pedidoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            const agendamentoIdParaVerificar = agendamentoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            
            console.log('🔍 Verificando avaliação - pedidoId da URL:', pedidoIdAvaliacao);
            console.log('🔍 Verificando avaliação - pedidoId do localStorage:', pedidoIdUltimoServicoConcluido);
            console.log('🔍 Verificando avaliação - usando pedidoIdParaVerificar:', pedidoIdParaVerificar);
            
            // Se não tem pedidoId nem agendamentoId na URL quando vem de notificação, PERMITE avaliar
            // Não bloqueia por avaliação geral quando vem de notificação sem ID específico
            if (!pedidoIdParaVerificar && !agendamentoIdParaVerificar) {
                console.log('⚠️ Veio de notificação mas não tem pedidoId/agendamentoId na URL, PERMITINDO avaliação (não bloqueia)');
                return false; // Permite avaliar - não bloqueia
            }
            
            console.log('🔍 Verificando avaliação específica do serviço (vindo de notificação):', {
                pedidoIdAvaliacao,
                pedidoIdParaVerificar,
                agendamentoIdAvaliacao,
                agendamentoIdParaVerificar,
                chaveEsperada: pedidoIdParaVerificar 
                    ? `avaliacaoServico:${loggedInUserId}-${pedidoIdParaVerificar}`
                    : `avaliacaoServico:${loggedInUserId}-${agendamentoIdParaVerificar}`
            });
            
            // Verifica storage específico do serviço
            const chaveServico = pedidoIdParaVerificar 
                ? `avaliacaoServico:${loggedInUserId}-${pedidoIdParaVerificar}`
                : `avaliacaoServico:${loggedInUserId}-${agendamentoIdParaVerificar}`;
            
            const temNoStorageServico = !!localStorage.getItem(chaveServico) || !!sessionStorage.getItem(chaveServico);
            if (temNoStorageServico) {
                console.log('✅ avaliacaoJaFeita: encontrado no storage do serviço específico:', chaveServico);
                return true;
            }
            
            // Verifica via API se já avaliou este serviço específico
            const jaAvaliouServico = await verificarAvaliacaoServicoEspecifico(pedidoIdParaVerificar, agendamentoIdParaVerificar);
            if (jaAvaliouServico) {
                console.log('✅ avaliacaoJaFeita: encontrado via API para serviço específico');
                // Marca no storage para próximas verificações
                localStorage.setItem(chaveServico, '1');
                return true;
            }
            
            console.log('❌ avaliacaoJaFeita: serviço específico não avaliado ainda - PERMITINDO avaliação');
            return false; // Não avaliou este serviço específico - permite avaliar
        }
        
        // Se não veio de notificação, verifica avaliação geral do perfil
        // Primeiro verifica localStorage/sessionStorage (rápido)
        const temNoStorage = !!sessionStorage.getItem(avaliacaoSessionKey) || !!localStorage.getItem(avaliacaoSessionKey);
        if (temNoStorage) {
            console.log('✅ avaliacaoJaFeita: encontrado no storage');
            return true;
        }
        
        // Verifica chave permanente no localStorage (para visitas normais)
        const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profileId || profileIdFromUrl || slugFromPath || 'desconhecido'}:permanente`;
        const temPermanente = !!localStorage.getItem(chavePermanente);
        if (temPermanente) {
            console.log('✅ avaliacaoJaFeita: encontrado na chave permanente:', chavePermanente);
            return true;
        }
        
        // Se não tem no storage, retorna o cache da API (pode ser null na primeira chamada)
        if (avaliacaoJaFeitaCache === true) {
            console.log('✅ avaliacaoJaFeita: encontrado no cache da API');
            return true;
        }
        
        console.log('❌ avaliacaoJaFeita: não encontrado, retornando false');
        return false;
    };

    const estrelasAvaliacaoSalvas = () =>
        sessionStorage.getItem(chaveStars) || localStorage.getItem(chaveStars) || '';

    const marcarAvaliacaoFeita = (estrelas, pedidoIdForcado = null, agendamentoIdForcado = null) => {
        if (!avaliacaoSessionKey) atualizarChavesAvaliacao();
        sessionStorage.setItem(avaliacaoSessionKey, '1');
        localStorage.setItem(avaliacaoSessionKey, '1');
        
        // Usa os valores forçados, depois da URL, depois do localStorage
        const pedidoIdFinal = pedidoIdForcado || pedidoIdAvaliacao || pedidoIdUltimoServicoConcluido;
        const agendamentoIdFinal = agendamentoIdForcado || agendamentoIdAvaliacao || agendamentoIdUltimoServico;
        
        // Se tem pedidoId ou agendamentoId, marca também como avaliado este serviço específico
        if (pedidoIdFinal || agendamentoIdFinal) {
            const chaveServico = pedidoIdFinal 
                ? `avaliacaoServico:${loggedInUserId}-${pedidoIdFinal}`
                : `avaliacaoServico:${loggedInUserId}-${agendamentoIdFinal}`;
            localStorage.setItem(chaveServico, '1');
            sessionStorage.setItem(chaveServico, '1');
            console.log('✅ Marcado como avaliado o serviço específico:', chaveServico, {
                pedidoIdFinal,
                agendamentoIdFinal,
                pedidoIdForcado,
                agendamentoIdForcado
            });
        } else {
            console.log('⚠️ Não foi possível identificar pedidoId/agendamentoId para marcar como avaliado');
        }
        
        // Marca também como permanente para visitas normais
        const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profileId || profileIdFromUrl || slugFromPath || 'desconhecido'}:permanente`;
        localStorage.setItem(chavePermanente, '1');
        
        // Atualiza o cache
        avaliacaoJaFeitaCache = true;
        
        if (estrelas) {
            sessionStorage.setItem(chaveStars, String(estrelas));
            localStorage.setItem(chaveStars, String(estrelas));
        }
    };

    const avaliacaoLiberadaGeral = async () => isFluxoServico || !(await avaliacaoJaFeita());

    async function bloquearAvaliacaoGeral() {
        if (!secaoAvaliacao) return;
        // Se já avaliou (storage), esconde completamente a seção
        if (await avaliacaoJaFeita()) {
            secaoAvaliacao.style.display = 'none';
            return;
        }
        // Verifica via API também antes de mostrar
        const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
        if (jaAvaliouAPI) {
            secaoAvaliacao.style.display = 'none';
            return;
        }
        // Se chegou aqui, não avaliou ainda, mas NÃO deve mostrar a seção em visitas normais
        // A função bloquearAvaliacaoGeral só deve esconder, não mostrar
        // A lógica de mostrar está em outro lugar (visita normal)
        secaoAvaliacao.style.display = 'none';
    }

    // Função de inicialização da página (chamada depois de resolver slug/ID)
    function inicializarPagina() {
        loadHeaderInfo();
        fetchUserProfile();
        // (Removido) Abas Projetos/Postagens — Postagens é a única seção
    }

    // Se veio por slug (/perfil/:slug), resolve o _id antes de continuar
    (async () => {
        console.log('🔍 Iniciando resolução do profileId...', {
            profileId,
            profileIdFromUrl,
            slugFromPath,
            loggedInUserId,
            hashSecaoAvaliacao: hashSecaoAvaliacao,
            urlParamsId: urlParams.get('id'),
            urlCompleta: window.location.href,
            search: window.location.search,
            hash: window.location.hash
        });
        
        // IMPORTANTE: Se há hash #secao-avaliacao, PRIORIZA o id da URL sobre o slug
        // Porque quando vem de avaliação, o id do profissional avaliado vem na URL
        if (hashSecaoAvaliacao && urlParams.get('id')) {
            profileId = urlParams.get('id');
            console.log('✅ [SECAO-AVALIACAO] ProfileId priorizado da URL (hash detectado):', profileId);
        } else if (!profileId && slugFromPath) {
            console.log('🔍 Buscando usuário por slug:', slugFromPath);
            const usuario = await fetchUsuarioPorSlug(slugFromPath);
            if (!usuario) {
                console.warn('⚠️ Slug não encontrado, voltando para perfil pelo ID.');
                if (profileIdFromUrl || loggedInUserId) {
                    profileId = profileIdFromUrl || loggedInUserId;
                    console.log('✅ Usando profileId:', profileId);
                    // volta para a URL com id para não quebrar próximos acessos
                    window.history.replaceState({}, '', `/perfil.html?id=${profileId}`);
                } else {
                    alert('Perfil não encontrado.');
                    window.location.href = '/';
                    return;
                }
            } else {
            profileId = usuario?._id || profileId;
                console.log('✅ ProfileId resolvido do slug:', profileId);
            }
        }

        // Se ainda não há profileId, cai para o logado
        if (!profileId) {
            console.log('⚠️ ProfileId ainda não definido, usando loggedInUserId:', loggedInUserId);
            profileId = loggedInUserId;
        }

        console.log('✅ ProfileId final:', profileId);
        isOwnProfile = (profileId === loggedInUserId);
        console.log('✅ É próprio perfil?', isOwnProfile);
        atualizarChavesAvaliacao();

        inicializarPagina();
    })();

    // A partir daqui, funções normais da página (usadas após resolver profileId)

    // --- FUNÇÃO PARA CARREGAR O HEADER ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || 'Usuário';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');
        if (userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay')) {
                // Técnica similar ao Facebook: carrega a imagem com cache busting para forçar alta qualidade
                userAvatarHeader.src = '';
                
                // Adiciona timestamp para evitar cache e garantir carregamento fresco
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                const freshUrl = storedPhotoUrl + separator + '_t=' + Date.now();
                
                // Cria uma nova imagem para pré-carregar, sem crossOrigin (evita erros de CORS com S3)
                const preloadImg = new Image();
                
                preloadImg.onload = function() {
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync';
                    
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function() {
                    // Se a foto do usuário falhar, usa a imagem padrão
                    userAvatarHeader.src = '/imagens/default-user.png';
                    userAvatarHeader.loading = 'eager';
                };
                
                preloadImg.src = freshUrl;
            } else {
                // Sem foto do usuário, usa a imagem padrão
                userAvatarHeader.src = '/imagens/default-user.png';
            }
        }
    }

    // --- FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO ---

    // Bloqueia se já existe avaliação (não vinda de serviço concluído) do visitante
    async function aplicarBloqueioHistorico(user) {
        // Não aplica bloqueio se veio de notificação (permite avaliar novo serviço)
        if (!user || origemAvaliacao === 'servico_concluido' || veioDeNotificacao || hashSecaoAvaliacao) {
            console.log('⚠️ Não aplicando bloqueio histórico - veio de notificação ou serviço concluído');
            return;
        }
        const avaliacoes = user.avaliacoes || [];
        const minhas = avaliacoes.filter(a => {
            const uid = a.usuarioId?._id || a.usuarioId || a.usuario;
            return uid && String(uid) === String(loggedInUserId);
        });
        if (minhas.length > 0) {
            const ultima = minhas[ minhas.length - 1 ];
            const estrelas = ultima?.estrelas || ultima?.nota || '';
            // Não passa pedidoId/agendamentoId para não marcar serviço específico como avaliado
            marcarAvaliacaoFeita(estrelas, null, null);
            await bloquearAvaliacaoGeral();
        }
    }
    // Atualiza a URL do navegador para usar o slug, sem recarregar a página
    function atualizarUrlPerfil(user) {
        try {
            if (!user || !user.slugPerfil) return; // só troca se tiver slug salvo
            const slug = user.slugPerfil;
            const cleanPath = `/perfil/${slug}`;
            const currentPath = window.location.pathname;

            // Só troca se for diferente para evitar loop
            // IMPORTANTE: Se há hash #secao-avaliacao, preserva os parâmetros da URL (incluindo id)
            if (currentPath !== cleanPath) {
                const temHashSecaoAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
                if (temHashSecaoAvaliacao) {
                    // Preserva todos os parâmetros quando há #secao-avaliacao
                    const newUrl = cleanPath + window.location.search + window.location.hash;
                    window.history.replaceState({}, '', newUrl);
                } else {
                    // Remove id apenas quando não há #secao-avaliacao
                    const newUrl = cleanPath + window.location.search.replace(/(\?|&)id=[^&]*/g, '');
                    window.history.replaceState({}, '', newUrl);
                }
            }
        } catch (e) {
            console.error('Erro ao atualizar URL do perfil:', e);
        }
    }

    async function fetchUserProfile() {
        console.log('🔍 fetchUserProfile chamado, profileId:', profileId);
        if (!profileId) {
            console.error("❌ Nenhum ID de perfil para buscar. profileId:", profileId);
            if (nomePerfil) nomePerfil.textContent = "Erro: ID de perfil não encontrado.";
            return;
        }
        
        // Reseta o flag de avaliações carregadas para forçar reload
        avaliacoesCarregadas = false;
        
        try {
            console.log('📡 Fazendo fetch para /api/usuario/' + profileId);
            const authHeaders = getAuthHeaders();
            const response = await fetch(`/api/usuario/${profileId}`, {
                headers: authHeaders
            });
            console.log('📡 Resposta recebida, status:', response.status);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
                console.error('❌ Erro na resposta:', errorData);
                throw new Error(errorData.message || 'Falha ao buscar dados do perfil.');
            }
            const payload = await response.json();
            const user = payload?.usuario || payload;
            console.log('✅ Dados do usuário recebidos:', user);
            
            if (isOwnProfile) {
                localStorage.setItem('userName', user.nome);
                localStorage.setItem('userPhotoUrl', user.avatarUrl || user.foto);
                // Aplicar o tema do usuário ao carregar o perfil
                if (user.tema) {
                    localStorage.setItem('theme', user.tema);
                    document.documentElement.classList.toggle('dark-mode', user.tema === 'dark');
                }
            }

        // Deixa a URL bonita: /perfil/slug-do-usuario, somente se for o próprio perfil
        if (isOwnProfile) {
            atualizarUrlPerfil(user);
        }
            
            loadHeaderInfo();
            await renderUserProfile(user);

            // Se já existe avaliação deste visitante (qualquer origem) e NÃO é link de serviço concluído,
            // bloqueia o formulário e grava as estrelas mais recentes.
            await aplicarBloqueioHistorico(user);
            
            // Carrega somente postagens
            fetchPostagens(user._id);
            
            // (Removido) Abas
            
            // Verifica se já avaliou após carregar o perfil e esconde a seção se necessário
            // IMPORTANTE: Não executa se veio de notificação (já foi processado acima)
            setTimeout(async () => {
                if (!secaoAvaliacao) return;
                
                // Se veio de notificação ou tem hash de avaliação, não processa aqui (já foi processado acima)
                const temHashAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
                const temOrigemServico = origemAvaliacao === 'servico_concluido';
                if (temHashAvaliacao || temOrigemServico || veioDeNotificacao) {
                    console.log('🔍 Veio de notificação ou tem hash, não processando verificação assíncrona aqui');
                    return;
                }
                
                // Primeiro verifica storage (rápido)
                const jaAvaliouStorage = avaliacaoJaFeita && avaliacaoJaFeita();
                
                if (jaAvaliouStorage) {
                    console.log('✅ Perfil carregado - já avaliou (storage), mantendo seção oculta');
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                    return;
                }
                
                // Se não tem no storage, verifica via API ANTES de mostrar
                console.log('🔍 Verificando via API após carregar perfil...');
                const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
                
                if (jaAvaliouAPI) {
                    console.log('✅ Perfil carregado - já avaliou (API), mantendo seção oculta');
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                } else {
                    // Só mostra se realmente não avaliou E não for o próprio perfil
                    if (!isOwnProfile) {
                        console.log('✅ Perfil carregado - primeira visita, verificando se deve mostrar seção...');
                        // A lógica de mostrar está no bloco else if (secaoAvaliacao) abaixo
                        // Não mostra aqui para evitar duplicação
                    } else {
                        secaoAvaliacao.style.display = 'none';
                    }
                }
            }, 1000); // Aguarda 1 segundo para garantir que tudo foi carregado
            
        } catch (error) {
            console.error('Erro ao buscar perfil:', error); 
            if (nomePerfil) nomePerfil.textContent = "Erro ao carregar perfil.";
        }
    }

    async function renderUserProfile(user) {
        if (!user) return;
        
        // Armazena dados brutos no dataset
        if(fotoPerfil) {
            fotoPerfil.dataset.cidade = user.cidade || '';
            fotoPerfil.dataset.estado = user.estado || '';
        }

        const fotoFinal = (user.avatarUrl && !user.avatarUrl.includes('pixabay')) 
                          ? user.avatarUrl 
                          : (user.foto && !user.foto.includes('pixabay') 
                             ? user.foto 
                             : '/imagens/default-user.png');
        
        if (fotoPerfil) fotoPerfil.src = fotoFinal;
        if (nomePerfil) nomePerfil.textContent = user.nome || 'Nome não informado';
        if (idadePerfil) idadePerfil.textContent = user.idade ? `${user.idade} anos` : 'Não informado';
        if (descricaoPerfil) descricaoPerfil.textContent = user.descricao || 'Nenhuma descrição disponível.';
        
        if (emailPerfil) {
            emailPerfil.textContent = user.email || 'Não informado';
            emailPerfil.href = `mailto:${user.email}`;
        }
        
        if (telefonePerfil) { 
            if (user.telefone) {
                telefonePerfil.href = `https://wa.me/55${user.telefone.replace(/\D/g, '')}`;
                telefonePerfil.textContent = user.telefone;
                telefonePerfil.target = '_blank';
                const phoneIcon = telefonePerfil.previousElementSibling; 
                if (phoneIcon) {
                    phoneIcon.className = 'fab fa-whatsapp';
                    phoneIcon.style.color = '#25d366';
                }
            } else {
                telefonePerfil.textContent = 'Não informado';
                telefonePerfil.href = '#';
                telefonePerfil.target = '';
                const phoneIcon = telefonePerfil.previousElementSibling; 
                if (phoneIcon) {
                    phoneIcon.className = 'fas fa-phone';
                    phoneIcon.style.color = 'var(--text-link)'; 
                }
            }
        }
        
        // 🛑 ATUALIZAÇÃO: Renderização de Localização (Cidade - Estado juntos)
        const localizacaoPerfil = document.getElementById('localizacaoPerfil');
        if (localizacaoPerfil) {
            const cidade = user.cidade || 'Não informado';
            const estado = user.estado ? user.estado.toUpperCase() : '';
            if (estado) {
                localizacaoPerfil.textContent = `${cidade} - ${estado}`;
            } else {
                localizacaoPerfil.textContent = cidade;
            }
        }
        
        // Mantém compatibilidade com elementos antigos se existirem
        const cidadePerfil = document.getElementById('cidadePerfil');
        const estadoPerfil = document.getElementById('estadoPerfil');
        if (cidadePerfil) cidadePerfil.textContent = user.cidade || 'Não informado';
        if (estadoPerfil) estadoPerfil.textContent = user.estado ? user.estado.toUpperCase() : 'Não informado';

        // Carrega avaliações verificadas para qualquer perfil acessado
        // Sempre carrega as avaliações do perfil visualizado (user._id)
        // IMPORTANTE: Se há hash #secao-avaliacao, não carrega aqui (já será carregado pela função específica)
        if (!hashSecaoAvaliacao) {
            console.log('📋 Carregando avaliações verificadas para o perfil:', user._id);
            // Força o reload das avaliações para garantir que as novas apareçam
            avaliacoesCarregadas = false;
            // Chama da mesma forma que quando vem de #secao-avaliacao
            await loadAvaliacoesVerificadas(user._id, true); // Força recarregar
            avaliacoesCarregadas = true;
        } else {
            console.log('📋 Hash #secao-avaliacao detectado, avaliações serão carregadas pela função específica');
        }

        if (user.tipo === 'trabalhador') {
            if (atuacaoPerfil) atuacaoPerfil.textContent = user.atuacao || 'Não informado';
            if (atuacaoItem) atuacaoItem.style.display = 'flex'; 
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'block';
            // (Removido) Projetos/Serviços no perfil
            
            // 🆕 ATUALIZADO: Exibir nível (todos) e XP (só dono)
            const nivelContainer = document.getElementById('nivel-container');
            const gamificacaoContainer = document.getElementById('gamificacao-container');
            
            if (user.gamificacao) {
                // Nível sempre visível para trabalhadores
                if (nivelContainer) {
                    nivelContainer.style.display = 'block';
                    const nivelUsuario = document.getElementById('nivelUsuario');
                    if (nivelUsuario) nivelUsuario.textContent = user.gamificacao.nivel || 1;
                }
                
                // XP só para o dono do perfil
                if (isOwnProfile && gamificacaoContainer) {
                    gamificacaoContainer.style.display = 'block';
                    const xpAtual = document.getElementById('xpAtual');
                    const xpProximo = document.getElementById('xpProximo');
                    const xpBarFill = document.getElementById('xp-bar-fill');
                    
                    if (xpAtual) xpAtual.textContent = user.gamificacao.xp || 0;
                    if (xpProximo) xpProximo.textContent = user.gamificacao.xpProximoNivel || 100;
                    
                    if (xpBarFill && user.gamificacao.xpProximoNivel) {
                        const porcentagem = ((user.gamificacao.xp || 0) / user.gamificacao.xpProximoNivel) * 100;
                        xpBarFill.style.width = `${Math.min(porcentagem, 100)}%`;
                    }
                } else if (gamificacaoContainer) {
                    gamificacaoContainer.style.display = 'none';
                }
            }
            
            if (user.totalAvaliacoes > 0) {
                renderMediaAvaliacao(user.mediaAvaliacao);
                if (totalAvaliacoes) totalAvaliacoes.textContent = `${user.totalAvaliacoes} avaliações`;
            } else {
                if (mediaEstrelas) mediaEstrelas.innerHTML = '<span class="no-rating">Nenhuma avaliação</span>';
                if (totalAvaliacoes) totalAvaliacoes.textContent = '';
            }
            // 🆕 NOVO: Botão de disponibilidade
            const disponibilidadeContainer = document.getElementById('disponibilidade-container');
            const toggleDisponibilidade = document.getElementById('toggle-disponibilidade');
            const disponibilidadeTexto = document.getElementById('disponibilidade-texto');
            
            if (isOwnProfile && disponibilidadeContainer && toggleDisponibilidade) {
                disponibilidadeContainer.style.display = 'flex';
                toggleDisponibilidade.checked = user.disponivelAgora || false;
                
                if (disponibilidadeTexto) {
                    disponibilidadeTexto.textContent = user.disponivelAgora ? 'Disponível agora' : 'Indisponível';
                }
                
                toggleDisponibilidade.addEventListener('change', async () => {
                    const disponivel = toggleDisponibilidade.checked;
                    try {
                        const response = await fetch('/api/user/disponibilidade', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ disponivelAgora: disponivel })
                        });
                        
                        const data = await response.json();
                        if (data.success && disponibilidadeTexto) {
                            disponibilidadeTexto.textContent = disponivel ? 'Disponível agora' : 'Indisponível';
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar disponibilidade:', error);
                        toggleDisponibilidade.checked = !disponivel; // Reverte
                    }
                });
            }
            
            if (isOwnProfile && addServicoBtn) {
                addServicoBtn.style.display = 'block';
            }
            // Não mostra a seção de avaliação aqui - será controlada pela lógica abaixo
            // que verifica se já avaliou antes de mostrar
        } else { 
            if (atuacaoItem) atuacaoItem.style.display = 'none';
            if (mediaAvaliacaoContainer) mediaAvaliacaoContainer.style.display = 'none';
            // Postagens é sempre a seção principal
        }

        if (isOwnProfile) {
            if (btnEditarPerfil) btnEditarPerfil.style.display = 'inline-flex';
            if (btnCriarPostagemPerfil) btnCriarPostagemPerfil.style.display = 'inline-flex';
        } else {
            if (btnEditarPerfil) btnEditarPerfil.style.display = 'none';
            if (btnCriarPostagemPerfil) btnCriarPostagemPerfil.style.display = 'none';
        }

        // Configurar event listener da foto após isOwnProfile ser definido
        configurarEventListenerFoto();
    }

    // Função para configurar event listeners da foto (chamada após isOwnProfile ser definido)
    function configurarEventListenerFoto() {
        const fotoAtual = document.getElementById('fotoPerfil');
        if (fotoAtual) {
            // Remover listener anterior se existir criando um clone
            const novaFoto = fotoAtual.cloneNode(true);
            fotoAtual.parentNode.replaceChild(novaFoto, fotoAtual);
            
            novaFoto.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Foto clicada! isOwnProfile:', isOwnProfile);
                
                // Se for o dono do perfil, mostra o modal de opções
                if (isOwnProfile) {
                    console.log('Abrindo modal de opções');
                    if (modalFotoOpcoes) {
                        modalFotoOpcoes.classList.toggle('oculto');
                    }
                } else {
                    // Se for visitante, apenas expande a foto
                    console.log('Expandindo foto (visitante)');
                    expandirFoto();
                }
            });
        } else {
            console.error('fotoPerfil não encontrado!');
        }
    }

    // Função para expandir a foto
    function expandirFoto() {
        const fotoAtual = document.getElementById('fotoPerfil');
        if (fotoExpandida && fotoAtual) {
            fotoExpandida.src = fotoAtual.src;
            if (modalFotoExpandida) {
                modalFotoExpandida.classList.remove('oculto');
                document.body.style.overflow = 'hidden';
            }
        }
    }

    // Criar postagem diretamente no perfil (sem ir pro feed)
    let midiasSelecionadasPerfil = [];
    function travarScrollFundo(travar) {
        try {
            document.body.style.overflow = travar ? 'hidden' : '';
            document.documentElement.style.overflow = travar ? 'hidden' : '';
        } catch {}
    }
    function renderPreviewMidiasPerfil() {
        if (!previewPostagemPerfil) return;
        if (!midiasSelecionadasPerfil.length) {
            previewPostagemPerfil.innerHTML = '';
            previewPostagemPerfil.classList.add('oculto');
            return;
        }
        previewPostagemPerfil.classList.remove('oculto');
        previewPostagemPerfil.innerHTML = midiasSelecionadasPerfil.map((file, idx) => {
            const url = URL.createObjectURL(file);
            return `
                <div class="postagem-perfil-thumb" data-idx="${idx}">
                    <img src="${url}" alt="Pré-visualização ${idx + 1}">
                    <button type="button" class="btn-remover-foto-postagem-perfil" aria-label="Remover foto" title="Remover">&times;</button>
                </div>
            `;
        }).join('');
    }

    function aplicarFitaNivelTemaNoPerfil() {
        const img = document.querySelector('.fita-nivel-img');
        if (!img) return;
        const isDark = document.documentElement.classList.contains('dark-mode');
        const light = img.getAttribute('data-src-light') || img.getAttribute('src');
        const dark = img.getAttribute('data-src-dark') || img.getAttribute('src');
        img.src = isDark ? dark : light;
    }

    // Reage quando o tema muda (classe dark-mode adicionada/removida no <html>)
    aplicarFitaNivelTemaNoPerfil();
    try {
        const themeObserver = new MutationObserver(() => {
            aplicarFitaNivelTemaNoPerfil();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } catch {}

    function aplicarIconeEnviarTemaNoPerfil() {
        const isDark = document.documentElement.classList.contains('dark-mode');
        document.querySelectorAll('.publish-icon').forEach((img) => {
            const light = img.getAttribute('data-src-light') || img.getAttribute('src');
            const dark = img.getAttribute('data-src-dark') || img.getAttribute('src');
            if (light && dark) img.src = isDark ? dark : light;
        });
    }
    function abrirModalCriarPostagemPerfil() {
        if (!modalCriarPostagemPerfil) return;
        aplicarIconeEnviarTemaNoPerfil();
        travarScrollFundo(true);
        modalCriarPostagemPerfil.classList.remove('hidden');
    }
    function fecharModalCriarPostagemPerfil() {
        if (!modalCriarPostagemPerfil) return;
        modalCriarPostagemPerfil.classList.add('hidden');
        travarScrollFundo(false);
        midiasSelecionadasPerfil = [];
        renderPreviewMidiasPerfil();
        if (inputPostagemPerfilTexto) inputPostagemPerfilTexto.value = '';
        if (inputPostagemPerfilMidia) inputPostagemPerfilMidia.value = '';
    }

    if (btnCriarPostagemPerfil && inputPostagemPerfilMidia) {
        btnCriarPostagemPerfil.addEventListener('click', () => inputPostagemPerfilMidia.click());
    }
    if (btnAdicionarFotoPostagemPerfil && inputPostagemPerfilMidia) {
        btnAdicionarFotoPostagemPerfil.addEventListener('click', () => inputPostagemPerfilMidia.click());
    }

    if (inputPostagemPerfilMidia) {
        inputPostagemPerfilMidia.addEventListener('change', () => {
            const files = Array.from(inputPostagemPerfilMidia.files || []);
            if (!files.length) return;
            // adiciona novas fotos à lista
            midiasSelecionadasPerfil = [...midiasSelecionadasPerfil, ...files];
            renderPreviewMidiasPerfil();
            abrirModalCriarPostagemPerfil();
            setTimeout(() => inputPostagemPerfilTexto && inputPostagemPerfilTexto.focus(), 50);
        });
    }

    if (previewPostagemPerfil) {
        previewPostagemPerfil.addEventListener('click', (e) => {
            const btn = e.target && e.target.closest ? e.target.closest('.btn-remover-foto-postagem-perfil') : null;
            if (!btn) return;
            const thumb = btn.closest('.postagem-perfil-thumb');
            const idx = thumb ? Number(thumb.getAttribute('data-idx')) : -1;
            if (Number.isNaN(idx) || idx < 0) return;
            midiasSelecionadasPerfil.splice(idx, 1);
            renderPreviewMidiasPerfil();
        });
    }

    // Fechar modal por botões
    if (btnCancelarPostagemPerfil) btnCancelarPostagemPerfil.addEventListener('click', fecharModalCriarPostagemPerfil);

    if (btnEnviarPostagemPerfil) {
        btnEnviarPostagemPerfil.addEventListener('click', async () => {
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                alert('Você precisa estar logado para postar.');
                return;
            }
            const content = (inputPostagemPerfilTexto?.value || '').trim();
            if (!content && !midiasSelecionadasPerfil.length) {
                alert('Adicione um texto ou uma foto.');
                return;
            }

            btnEnviarPostagemPerfil.disabled = true;
            try {
                const formData = new FormData();
                formData.append('content', content);
                // Backend atual aceita apenas 1 mídia (mesma regra do feed)
                if (midiasSelecionadasPerfil[0]) formData.append('media', midiasSelecionadasPerfil[0]);

                const resp = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || data.success === false) {
                    throw new Error(data.message || 'Erro ao publicar.');
                }

                fecharModalCriarPostagemPerfil();
                // Recarrega as postagens para aparecer na grade
                if (profileId) fetchPostagens(profileId);
            } catch (e) {
                alert(e.message || 'Erro ao publicar.');
            } finally {
                btnEnviarPostagemPerfil.disabled = false;
            }
        });
    }

    async function fetchServicos(id) { /* ... (sem alteração) ... */ }
    function renderServicos(servicos) { /* ... (sem alteração) ... */ }
    async function fetchPostagens(id) { /* ... (sem alteração) ... */ }
    function renderPostagens(posts) { /* ... (sem alteração) ... */ }
    function renderMediaAvaliacao(media) { /* ... (sem alteração) ... */ }
    
    // Busca nome do serviço (pedido/agendamento) para fallback do título
    async function obterNomeServicoFallback() {
        const pidLocal = localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
        const scopeId = serviceScopeId || pidLocal;
        let nome =
            urlParams.get('servico') ||
            urlParams.get('titulo') ||
            localStorage.getItem('ultimoServicoNome') ||
            localStorage.getItem('ultimaDescricaoPedido') ||
            localStorage.getItem('ultimaCategoriaPedido') ||
            localStorage.getItem('ultimaDemanda') ||
            '';
        if (nome) return nome;
        if (!scopeId) return '';
        try {
            const resp = await fetch(`/api/pedidos-urgentes/${scopeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (resp.ok) {
                const pedido = await resp.json();
                nome =
                    pedido?.servico ||
                    pedido?.titulo ||
                    pedido?.nome ||
                    pedido?.categoria ||
                    pedido?.descricao ||
                    pedido?.tipoServico ||
                    pedido?.categoriaServico ||
                    pedido?.nomeServico ||
                    pedido?.tipo ||
                    '';
                if (nome) {
                    localStorage.setItem('ultimoServicoNome', nome);
                    localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || nome);
                    localStorage.setItem('ultimaCategoriaPedido', pedido?.categoria || '');
                }
            }
        } catch (e) {
            console.warn('Falha ao buscar nome do serviço:', e);
        }
        // Não use string fixa; se não achar, devolve vazio para não exibir "Serviço concluído"
        return nome || '';
    }

    // 🌟 NOVO: Carregar Avaliações Verificadas
    // Flag para evitar múltiplos carregamentos simultâneos
    let carregandoAvaliacoes = false;
    
    async function loadAvaliacoesVerificadas(profissionalId, forcarRecarregar = false) {
        // Verifica diretamente o hash para evitar problemas de escopo
        const temHashSecaoAvaliacao = window.location.hash && window.location.hash.includes('secao-avaliacao');
        const origem = temHashSecaoAvaliacao ? 'SECAO-AVALIACAO' : 'PERFIL-NORMAL';
        
        // Evita múltiplos carregamentos simultâneos
        if (carregandoAvaliacoes) {
            console.log(`⏸️ [${origem}] Carregamento já em andamento, ignorando chamada duplicada`);
            return;
        }
        
        carregandoAvaliacoes = true;
        
        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
        const listaAvaliacoes = document.getElementById('lista-avaliacoes-verificadas');
        if (!secaoAvaliacoesVerificadas || !listaAvaliacoes) {
            console.warn(`⚠️ [${origem}] Elementos da seção de avaliações verificadas não encontrados`);
            carregandoAvaliacoes = false;
            return;
        }
        
        // SEMPRE exibe a seção antes de carregar
        secaoAvaliacoesVerificadas.style.display = 'block';
        
        // Limpa o conteúdo ANTES de carregar para evitar mostrar dados antigos durante o "piscar"
        // IMPORTANTE: Só limpa se forçar recarregar OU se já tiver conteúdo (evita limpar se já está mostrando "Carregando...")
        if (forcarRecarregar) {
            listaAvaliacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Carregando avaliações...</p>';
        } else if (listaAvaliacoes.innerHTML.trim() !== '' && !listaAvaliacoes.innerHTML.includes('Carregando avaliações')) {
            listaAvaliacoes.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Carregando avaliações...</p>';
        }

        try {
            const authHeaders = getAuthHeaders();
            // Adiciona timestamp para evitar cache e garantir que sempre busca as avaliações mais recentes
            // IMPORTANTE: Quando forcarRecarregar é true, adiciona um timestamp ainda mais único
            // para garantir que o navegador não usa cache mesmo que tenha dados antigos
            const timestamp = new Date().getTime();
            const random = Math.random().toString(36).substring(7);
            const extraBuster = forcarRecarregar ? `&force=${timestamp}` : '';
            const cacheBuster = `t=${timestamp}&_=${Date.now()}&r=${random}${extraBuster}`;
            const url = `/api/avaliacoes-verificadas/${profissionalId}?${cacheBuster}`;
            
            const response = await fetch(url, {
                headers: {
                    ...authHeaders,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                cache: 'no-store', // Força o navegador a não usar cache (mais agressivo que 'no-cache')
                method: 'GET'
            });
            
            console.log(`📡 [${origem}] Resposta da API:`, {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });
            
            if (!response.ok) throw new Error('Falha ao buscar avaliações verificadas.');

            const data = await response.json();
            let avaliacoes = data.avaliacoes || [];
            console.log(`✅ [${origem}] Avaliações recebidas da API:`, avaliacoes.length);
            console.log(`📋 [${origem}] IDs das avaliações recebidas:`, avaliacoes.map(av => ({
                _id: av._id,
                servico: av.servico,
                servicoType: typeof av.servico,
                clienteId: String(av.clienteId?._id || av.clienteId),
                createdAt: av.createdAt,
                profissionalId: String(av.profissionalId?._id || av.profissionalId),
                pedidoUrgenteId: av.pedidoUrgenteId?._id || av.pedidoUrgenteId || null
            })));
            
            // Verifica se o usuário logado já avaliou este perfil
            if (loggedInUserId && profissionalId) {
                console.log('🔍 loadAvaliacoesVerificadas - Verificando se usuário já avaliou:', {
                    loggedInUserId: loggedInUserId,
                    profissionalId: profissionalId,
                    totalAvaliacoes: avaliacoes.length
                });
                
                const jaAvaliou = avaliacoes.some(av => {
                    // Extrai o clienteId de diferentes formatos (objeto populado ou string/ObjectId)
                    const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                    const usuarioId = av.usuarioId?._id || av.usuarioId?.id || av.usuarioId;
                    
                    // Normaliza para strings para comparação
                    const clienteIdStr = clienteId ? String(clienteId).trim() : null;
                    const usuarioIdStr = usuarioId ? String(usuarioId).trim() : null;
                    const loggedInUserIdStr = String(loggedInUserId).trim();
                    
                    const clienteMatch = clienteIdStr && clienteIdStr === loggedInUserIdStr;
                    const usuarioMatch = usuarioIdStr && usuarioIdStr === loggedInUserIdStr;
                    const match = clienteMatch || usuarioMatch;
                    
                    console.log('🔍 loadAvaliacoesVerificadas - Comparando:', {
                        avaliacaoId: av._id,
                        clienteId: clienteId,
                        clienteIdStr: clienteIdStr,
                        usuarioId: usuarioId,
                        usuarioIdStr: usuarioIdStr,
                        loggedInUserId: loggedInUserId,
                        loggedInUserIdStr: loggedInUserIdStr,
                        clienteMatch: clienteMatch,
                        usuarioMatch: usuarioMatch,
                        match: match,
                        servico: av.servico,
                        clienteIdRaw: JSON.stringify(av.clienteId),
                        clienteIdType: typeof av.clienteId,
                        clienteIdIsObject: typeof av.clienteId === 'object' && av.clienteId !== null
                    });
                    
                    if (match) {
                        console.log('✅ Avaliação do usuário logado encontrada em loadAvaliacoesVerificadas');
                    }
                    return match;
                });
                
                if (jaAvaliou) {
                    // Atualiza o cache
                    avaliacaoJaFeitaCache = true;
                    // Marca como permanente no localStorage
                    const chavePermanente = `avaliacaoPerfil:${loggedInUserId}-${profissionalId}:permanente`;
                    localStorage.setItem(chavePermanente, '1');
                    console.log('✅ Avaliação encontrada, cache atualizado e chave permanente criada:', chavePermanente);
                } else {
                    console.log('❌ Nenhuma avaliação do usuário logado encontrada em loadAvaliacoesVerificadas');
                }
            }
            
            console.log('📥 Avaliações verificadas recebidas da API:', JSON.stringify(avaliacoes, null, 2));
            console.log('🔍 DEBUG - Comparação de IDs:', {
                loggedInUserId: loggedInUserId,
                loggedInUserIdStr: String(loggedInUserId).trim(),
                profissionalId: profissionalId,
                profissionalIdStr: String(profissionalId).trim(),
                avaliacoesCount: avaliacoes.length,
                avaliacoesClienteIds: avaliacoes.map(av => {
                    const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                    const clienteIdStr = clienteId ? String(clienteId).trim() : '';
                    const loggedInUserIdStr = String(loggedInUserId).trim();
                    const match = clienteIdStr && loggedInUserIdStr && clienteIdStr === loggedInUserIdStr;
                    const avProfId = av.profissionalId?._id || av.profissionalId?.id || av.profissionalId;
                    const avProfIdStr = avProfId ? String(avProfId).trim() : '';
                    
                    return {
                        _id: av._id,
                        clienteId: clienteId,
                        clienteIdString: clienteIdStr,
                        clienteIdNome: av.clienteId?.nome || 'sem nome',
                        profissionalId: avProfId,
                        profissionalIdString: avProfIdStr,
                        match: match,
                        servico: av.servico,
                        createdAt: av.createdAt,
                        profissionalIdMatch: avProfIdStr === String(profissionalId).trim()
                    };
                })
            });
            avaliacoes.forEach((av, idx) => {
                console.log(`📥 Avaliação ${idx}:`, {
                    _id: av._id,
                    servico: av.servico,
                    agendamentoId: av.agendamentoId,
                    agendamentoIdServico: av.agendamentoId?.servico,
                    clienteId: av.clienteId?.nome,
                    clienteIdRaw: av.clienteId?._id || av.clienteId?.id || av.clienteId
                });
            });
            
            if (avaliacoes.length === 0) {
                // fallback: tenta usar última avaliação local (geral) do usuário atual neste perfil
                try {
                    const cacheKey = `ultimaAvaliacaoGeral:${profissionalId}:${loggedInUserId || ''}`;
                    const cacheStr = localStorage.getItem(cacheKey);
                    if (cacheStr) {
                        const cacheObj = JSON.parse(cacheStr);
                        if (cacheObj && cacheObj.clienteId) {
                            avaliacoes = [cacheObj];
                        }
                    }
                } catch (e) {
                    console.warn('Falha ao ler cache da avaliação local:', e);
                }
            }

            if (avaliacoes.length === 0) {
                secaoAvaliacoesVerificadas.style.display = 'block';
                listaAvaliacoes.innerHTML = '<p style="padding:16px; color: var(--text-secondary);">Nenhuma avaliação verificada.</p>';
                
                // Se já avaliou E veio de notificação, mostra mensagem pequena no título
                if (avaliacaoJaFeita && avaliacaoJaFeita() && veioDeNotificacao) {
                    const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                    if (h3Titulo) {
                        // Remove mensagem antiga se existir
                        const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                        if (mensagemAntiga) {
                            mensagemAntiga.remove();
                        }
                        
                        // Cria mensagem pequena no h3
                        const mensagemEl = document.createElement('span');
                        mensagemEl.className = 'mensagem-avaliado-pequena';
                        mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                        mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                        h3Titulo.appendChild(mensagemEl);
                    }
                }
                return;
            }

            let servicoNomeFallbackGlobal = await obterNomeServicoFallback();
            const pidLocalGlobal = serviceScopeId || localStorage.getItem('pedidoIdUltimoServicoConcluido') || '';
            const pidLocalClean = String(pidLocalGlobal || '').match(/[a-fA-F0-9]{24}/)?.[0] || '';

            // Prefetch do nome do serviço, se ainda não existir em cache
            if (pidLocalClean) {
                const hasNomeCache =
                    localStorage.getItem(`nomeServico:${pidLocalClean}`) ||
                    localStorage.getItem('nomeServicoConcluido') ||
                    localStorage.getItem('ultimoServicoNome') ||
                    localStorage.getItem('ultimaDescricaoPedido');

                if (!hasNomeCache) {
                    try {
                        const resp = await fetch(`/api/pedidos-urgentes/${pidLocalClean}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            const pedido = await resp.json();
                            const nomePedido =
                                pedido?.servico ||
                                pedido?.titulo ||
                                pedido?.descricao ||
                                pedido?.nome ||
                                pedido?.categoria ||
                                pedido?.tipoServico ||
                                pedido?.nomeServico ||
                                '';
                            if (nomePedido) {
                                localStorage.setItem(`nomeServico:${pidLocalClean}`, nomePedido);
                                localStorage.setItem('nomeServicoConcluido', nomePedido);
                                localStorage.setItem('ultimoServicoNome', nomePedido);
                                localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || nomePedido);
                                servicoNomeFallbackGlobal = servicoNomeFallbackGlobal || nomePedido;
                            }
                        }
                    } catch (e) {
                        console.warn('Falha ao prefetch do nome do serviço', e);
                    }
                }
            }
            // Se ainda não achou e temos um ID de serviço/pedido, tenta buscar direto na API
            if (!servicoNomeFallbackGlobal) {
                if (pidLocalGlobal) {
                    const pidClean = String(pidLocalGlobal).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                    try {
                        const resp = await fetch(`/api/pedidos-urgentes/${pidClean}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            const pedido = await resp.json();
                            servicoNomeFallbackGlobal =
                                pedido?.servico ||
                                pedido?.titulo ||
                                pedido?.descricao ||
                                pedido?.nome ||
                                pedido?.categoria ||
                                pedido?.tipoServico ||
                                pedido?.nomeServico ||
                                '';
                            if (servicoNomeFallbackGlobal) {
                                localStorage.setItem('ultimoServicoNome', servicoNomeFallbackGlobal);
                                localStorage.setItem('ultimaDescricaoPedido', pedido?.descricao || servicoNomeFallbackGlobal);
                                localStorage.setItem('nomeServicoConcluido', servicoNomeFallbackGlobal);
                                if (pidClean) localStorage.setItem(`nomeServico:${pidClean}`, servicoNomeFallbackGlobal);
                            }
                        } else {
                            console.warn('Fetch pedido fallback falhou', resp.status);
                        }
                    } catch (e) {
                        console.warn('Falha ao buscar nome do pedido (fallback global)', e);
                    }
                }
            }

            const viewerId = loggedInUserId || '';
            const viewerName = (localStorage.getItem('userName') || '').trim().toLowerCase();
            const sameId = (a, b) => a && b && String(a).trim() === String(b).trim();
            const sameName = (nome) => nome && viewerName && nome.trim().toLowerCase() === viewerName;
            
            console.log('🔍 loadAvaliacoesVerificadas - Preparando renderização:', {
                viewerId: viewerId,
                viewerIdString: String(viewerId),
                viewerName: viewerName,
                avaliacoesCount: avaliacoes.length,
                profissionalId: profissionalId
            });

            const ehMinha = (av) => {
                // Normaliza o viewerId para comparação
                const viewerIdNormalizado = viewerId ? String(viewerId).trim() : '';
                
                // Extrai o clienteId de diferentes formatos (objeto populado ou string/ObjectId)
                const clienteId = av.clienteId?._id || av.clienteId?.id || av.clienteId;
                const clienteIdStr = clienteId ? String(clienteId).trim() : '';
                
                // Compara IDs normalizados
                if (viewerIdNormalizado && clienteIdStr && clienteIdStr === viewerIdNormalizado) {
                    console.log('✅ ehMinha: Match encontrado por ID:', {
                        avaliacaoId: av._id,
                        clienteId: clienteIdStr,
                        viewerId: viewerIdNormalizado,
                        match: true
                    });
                    return true;
                }
                
                // Fallback: compara por nome (menos confiável)
                const nome = av.clienteId?.nome || av.usuarioId?.nome || av.nome || '';
                if (sameName(nome)) {
                    console.log('✅ ehMinha: Match encontrado por nome:', {
                        avaliacaoId: av._id,
                        nome: nome,
                        viewerName: viewerName,
                        match: true
                    });
                    return true;
                }
                
                console.log('❌ ehMinha: Nenhum match encontrado:', {
                    avaliacaoId: av._id,
                    clienteId: clienteIdStr,
                    clienteIdRaw: clienteId,
                    clienteIdType: typeof clienteId,
                    viewerId: viewerIdNormalizado,
                    viewerIdRaw: viewerId,
                    nome: nome,
                    viewerName: viewerName,
                    match: false,
                    servico: av.servico,
                    profissionalId: av.profissionalId?._id || av.profissionalId
                });
                return false;
            };

            let ordenadas = avaliacoes;
            let encontrouMinha = false;
            if (viewerId) {
                console.log('🔍 Ordenando avaliações - viewerId:', viewerId);
                const minhas = avaliacoes.filter(av => {
                    const m = ehMinha(av);
                    if (m) {
                        encontrouMinha = true;
                        console.log('✅ Avaliação identificada como MINHA:', {
                            avaliacaoId: av._id,
                            servico: av.servico,
                            clienteId: av.clienteId?._id || av.clienteId
                        });
                    }
                    return m;
                });
                const outras = avaliacoes.filter(av => !ehMinha(av));
                console.log('📊 Ordenação:', {
                    total: avaliacoes.length,
                    minhas: minhas.length,
                    outras: outras.length,
                    encontrouMinha: encontrouMinha
                });
                ordenadas = [...minhas, ...outras];
            } else {
                console.log('⚠️ viewerId não encontrado, não ordenando avaliações');
            }

            // Fallback: se ainda não achou a minha, mas há flag local da última avaliação enviada
            if (!encontrouMinha) {
                const ultimaId = localStorage.getItem('ultimaAvaliacaoClienteId');
                if (ultimaId && viewerId && String(ultimaId) === String(viewerId) && ordenadas.length > 0) {
                    ordenadas = [ordenadas[0], ...ordenadas.slice(1)];
                    encontrouMinha = true;
                }
            }

            // Garante que a seção está visível
            secaoAvaliacoesVerificadas.style.display = 'block';
            // Reutiliza a variável origem já declarada no início da função
            // (não redeclara para evitar erro de temporal dead zone)
            console.log(`✅ [${origem}] Seção de avaliações verificadas exibida, total de avaliações:`, ordenadas.length);
            console.log(`📊 [${origem}] Avaliações ordenadas:`, ordenadas.map(av => ({
                _id: av._id,
                servico: av.servico,
                servicoType: typeof av.servico,
                clienteId: av.clienteId?._id || av.clienteId,
                clienteIdNome: av.clienteId?.nome,
                ehMinha: ehMinha(av),
                createdAt: av.createdAt,
                pedidoUrgenteId: av.pedidoUrgenteId?._id || av.pedidoUrgenteId || null
            })));
            
            // Se já avaliou E veio de notificação, adiciona mensagem pequena no título
            if (avaliacaoJaFeita && avaliacaoJaFeita() && veioDeNotificacao) {
                const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                if (h3Titulo) {
                    // Remove mensagem antiga se existir
                    const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                    if (mensagemAntiga) {
                        mensagemAntiga.remove();
                    }
                    
                    // Cria mensagem pequena no h3, ao lado do badge "Cliente Verificado"
                    const mensagemEl = document.createElement('span');
                    mensagemEl.className = 'mensagem-avaliado-pequena';
                    mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                    mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                    h3Titulo.appendChild(mensagemEl);
                }
                // Esconde a seção de avaliação se ainda estiver visível
                if (secaoAvaliacao) {
                    secaoAvaliacao.style.display = 'none';
                }
            }
            
            // Separa avaliações: mostra 1 inicialmente, depois expande para 4 com scrollbar
            const avaliacoesIniciais = ordenadas.slice(0, 1); // Apenas 1 inicialmente
            const avaliacoesExpandidas = ordenadas.slice(1, 4); // Mais 3 quando expandir (totalizando 4)
            const avaliacoesRestantes = ordenadas.slice(4); // Restantes (se houver mais de 4)
            
            let html = '';
            
            // Função auxiliar para renderizar uma avaliação (será usada abaixo)
            const renderizarAvaliacaoCompleta = (av, index) => {
                const isMinha = ehMinha(av);
                const nomeBase = av.clienteId?.nome || 'Cliente';
                const nomeExibicao = isMinha ? `${nomeBase} · VOCÊ` : nomeBase;
                const avatar = av.clienteId?.avatarUrl || av.clienteId?.foto || '/imagens/default-user.png';
                const estrelas = '★'.repeat(av.estrelas) + '☆'.repeat(5 - av.estrelas);
                const dataServico = av.dataServico ? new Date(av.dataServico).toLocaleDateString('pt-BR') : '';
                
                // Prioriza o campo servico que vem da API (já enriquecido pelo backend)
                let servicoTxt = '';
                
                // 1. Primeiro tenta pegar diretamente do campo servico da avaliação (vindo da API)
                console.log('🔍 Avaliação verificada recebida:', {
                    _id: av._id,
                    servico: av.servico,
                    servicoType: typeof av.servico,
                    servicoLength: av.servico ? av.servico.length : 0,
                    agendamentoId: av.agendamentoId,
                    agendamentoIdServico: av.agendamentoId?.servico,
                    pedidoUrgenteId: av.pedidoUrgenteId,
                    pedidoUrgenteIdServico: av.pedidoUrgenteId?.servico,
                    pedidoUrgenteIdId: av.pedidoUrgenteId?._id || av.pedidoUrgenteId,
                    serviceScopeId: serviceScopeId
                });
                
                // Verifica se é placeholder (valores genéricos que não devem ser usados)
                const isPlaceholderValue = (valor) => {
                    if (!valor || !valor.trim()) return true;
                    const valLower = valor.trim().toLowerCase();
                    // Lista de placeholders genéricos que não devem ser exibidos
                    const placeholders = [
                        'serviço concluído',
                        'serviço prestado',
                        'serviço realizado',
                        'programador', // Valor genérico antigo
                        'serviço',
                        'trabalho',
                        'serviço feito'
                    ];
                    return placeholders.includes(valLower);
                };
                
                // 1. PRIORIDADE MÁXIMA: Tenta do campo servico direto da avaliação (é o que foi salvo quando avaliou)
                // Este é o valor mais confiável porque foi salvo no momento da avaliação
                if (av.servico && av.servico.trim() && !isPlaceholderValue(av.servico)) {
                    servicoTxt = av.servico.trim();
                    console.log('✅✅✅ Nome do serviço encontrado em av.servico (campo salvo - PRIORIDADE MÁXIMA):', servicoTxt);
                } 
                // 2. PRIORIDADE: Tenta do pedidoUrgenteId populado (pedidos urgentes) - antes do agendamento
                else if (av.pedidoUrgenteId) {
                    const pedidoServico = typeof av.pedidoUrgenteId === 'object' 
                        ? av.pedidoUrgenteId.servico 
                        : null;
                    if (pedidoServico && pedidoServico.trim() && !isPlaceholderValue(pedidoServico)) {
                        servicoTxt = pedidoServico.trim();
                        console.log('✅ Nome do serviço encontrado em pedidoUrgenteId.servico:', servicoTxt);
                    } else {
                        // Se pedidoUrgenteId não tem servico populado, tenta buscar do cache usando o ID
                        const pedidoIdValue = av.pedidoUrgenteId._id || av.pedidoUrgenteId;
                        if (pedidoIdValue) {
                            const pidClean = String(pedidoIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                // Primeiro tenta do cache específico deste pedido
                                const nomeCache = localStorage.getItem(`nomeServico:${pidClean}`);
                                if (nomeCache && !isPlaceholderValue(nomeCache)) {
                                    servicoTxt = nomeCache;
                                    console.log('✅ Nome do serviço encontrado no cache do pedidoUrgenteId:', servicoTxt, 'pedidoId:', pidClean);
                                } else {
                                    // Se não tem no cache, busca da API de forma síncrona usando await
                                    // Isso garante que cada avaliação busque seu próprio nome
                                    console.log('🔍 Nome do serviço não encontrado no cache, buscando da API para pedidoId:', pidClean);
                                    // Busca de forma assíncrona mas atualiza quando encontrar
                                    fetch(`/api/pedidos-urgentes/${pidClean}`, {
                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
                                    }).then(resp => resp.json()).then(data => {
                                        const pedido = data?.pedido || data;
                                        const nomeServico = pedido?.servico || pedido?.titulo || '';
                                        if (nomeServico && !isPlaceholderValue(nomeServico)) {
                                            // Atualiza o cache específico deste pedido
                                            localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                                            // Atualiza o elemento na página se ainda estiver visível
                                            const avaliacaoItem = document.querySelector(`[data-avaliacao-id="${av._id}"]`);
                                            if (avaliacaoItem) {
                                                const servicoMetaEl = avaliacaoItem.querySelector('.avaliacao-meta');
                                                if (servicoMetaEl) {
                                                    // Procura pelo span do serviço ou cria um novo
                                                    let servicoSpan = servicoMetaEl.querySelector('span[data-servico]');
                                                    if (!servicoSpan) {
                                                        servicoSpan = servicoMetaEl.querySelector('span:last-child');
                                                    }
                                                    if (servicoSpan) {
                                                        servicoSpan.innerHTML = `<i class="fas fa-briefcase"></i> ${nomeServico}`;
                                                        servicoSpan.setAttribute('data-servico', nomeServico);
                                                        console.log('✅ Nome do serviço atualizado no DOM:', nomeServico, 'para avaliação:', av._id);
                                                    } else {
                                                        // Se não tem span, adiciona um novo
                                                        const novoSpan = document.createElement('span');
                                                        novoSpan.style.marginLeft = '10px';
                                                        novoSpan.setAttribute('data-servico', nomeServico);
                                                        novoSpan.innerHTML = `<i class="fas fa-briefcase"></i> ${nomeServico}`;
                                                        servicoMetaEl.appendChild(novoSpan);
                                                        console.log('✅ Nome do serviço adicionado ao DOM:', nomeServico, 'para avaliação:', av._id);
                                                    }
                                                }
                                            }
                                            console.log('✅ Nome do serviço atualizado da API:', nomeServico, 'pedidoId:', pidClean);
                                        }
                                    }).catch(err => {
                                        console.warn('⚠️ Erro ao buscar nome do serviço da API para pedidoId:', pidClean, err);
                                    });
                                }
                            }
                        }
                    }
                }
                // 3. Se não tem pedidoUrgenteId, tenta do agendamento populado (serviços agendados) - só se não for placeholder
                if (!servicoTxt && av.agendamentoId) {
                    const agendamentoServico = typeof av.agendamentoId === 'object' 
                        ? av.agendamentoId.servico 
                        : null;
                    if (agendamentoServico && agendamentoServico.trim() && !isPlaceholderValue(agendamentoServico)) {
                        servicoTxt = agendamentoServico.trim();
                        console.log('✅ Nome do serviço encontrado em agendamentoId.servico:', servicoTxt);
                    } else {
                        console.warn('⚠️ agendamentoId.servico é placeholder ou inválido:', agendamentoServico);
                    }
                }
                
                // 4. Fallbacks: SEMPRE tenta buscar dos fallbacks se não encontrou um nome válido
                if (!servicoTxt || isPlaceholderValue(servicoTxt)) {
                    console.log('🔍 Buscando nome do serviço nos fallbacks...');
                    
                    // Primeiro tenta buscar do pedidoUrgenteId se disponível (mesmo que não populado)
                    // IMPORTANTE: Usa apenas o pedidoUrgenteId específico desta avaliação
                    const pedidoUrgenteIdValue = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                    if (pedidoUrgenteIdValue) {
                        const pidClean = String(pedidoUrgenteIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            // Tenta do cache específico deste pedido
                            const nomeCacheId = localStorage.getItem(`nomeServico:${pidClean}`) || '';
                            if (nomeCacheId && !isPlaceholderValue(nomeCacheId)) {
                                servicoTxt = nomeCacheId;
                                console.log('✅ Nome do serviço encontrado no cache do pedidoUrgenteId:', servicoTxt, 'pedidoId:', pidClean, 'avaliacaoId:', av._id);
                            } else {
                                // Se não tem no cache, busca da API de forma assíncrona
                                console.log('🔍 Buscando nome do serviço da API para pedidoId:', pidClean, 'avaliacaoId:', av._id);
                                fetch(`/api/pedidos-urgentes/${pidClean}`, {
                                    headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
                                }).then(resp => resp.json()).then(data => {
                                    const pedido = data?.pedido || data;
                                    const nomeServico = pedido?.servico || pedido?.titulo || '';
                                    if (nomeServico && !isPlaceholderValue(nomeServico)) {
                                        // Atualiza o cache específico deste pedido
                                        localStorage.setItem(`nomeServico:${pidClean}`, nomeServico);
                                        // Atualiza o elemento na página se ainda estiver visível
                                        const avaliacaoItem = document.querySelector(`[data-avaliacao-id="${av._id}"]`);
                                        if (avaliacaoItem) {
                                            const servicoMetaEl = avaliacaoItem.querySelector('.avaliacao-meta');
                                            if (servicoMetaEl) {
                                                let servicoSpan = servicoMetaEl.querySelector('span[data-servico]');
                                                if (!servicoSpan) {
                                                    servicoSpan = servicoMetaEl.querySelector('span:last-child');
                                                }
                                                if (servicoSpan) {
                                                    servicoSpan.innerHTML = `<i class="fas fa-briefcase"></i> ${nomeServico}`;
                                                    servicoSpan.setAttribute('data-servico', nomeServico);
                                                    console.log('✅ Nome do serviço atualizado no DOM:', nomeServico, 'pedidoId:', pidClean, 'avaliacaoId:', av._id);
                                                }
                                            }
                                        }
                                    }
                                }).catch(err => {
                                    console.warn('⚠️ Erro ao buscar nome do serviço da API para pedidoId:', pidClean, err);
                                });
                            }
                        }
                    }
                    
                    // Se ainda não encontrou, tenta outros fallbacks
                    // IMPORTANTE: NÃO usa valores globais do localStorage que são compartilhados entre todas as avaliações
                    // Cada avaliação deve usar seu próprio pedidoUrgenteId para buscar o nome correto
                    if (!servicoTxt) {
                        // Tenta apenas campos específicos da avaliação, não valores globais
                        servicoTxt =
                    av.servicoNome ||
                    av.titulo ||
                    av.nome ||
                    av.categoria ||
                    av.descricao ||
                    av.tipoServico ||
                    av.categoriaServico ||
                    av.pedido?.servico ||
                    av.pedido?.titulo ||
                    av.pedido?.descricao ||
                    av.pedido?.nome ||
                    av.detalhes?.servico ||
                    av.dadosAdicionais?.servico ||
                    av.servicoConcluido ||
                    av.servicoAvaliado ||
                    '';

                        // Remove placeholders indesejados
                        if (isPlaceholderValue(servicoTxt)) {
                            servicoTxt = '';
                        }
                    }
                    
                    // Se ainda não encontrou e tem pedidoUrgenteId, busca da API de forma síncrona
                    if (!servicoTxt) {
                        const pedidoUrgenteIdValue = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                        if (pedidoUrgenteIdValue) {
                            const pidClean = String(pedidoUrgenteIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                            if (pidClean) {
                                // Tenta do cache específico deste pedido
                                const nomeCacheEspecifico = localStorage.getItem(`nomeServico:${pidClean}`);
                                if (nomeCacheEspecifico && !isPlaceholderValue(nomeCacheEspecifico)) {
                                    servicoTxt = nomeCacheEspecifico;
                                    console.log('✅ Nome do serviço encontrado no cache específico do pedido:', servicoTxt);
                                }
                            }
                        }
                    }
                    
                    // Se ainda não encontrou, NÃO usa fallback genérico - deixa vazio
                    // Isso evita que todas as avaliações mostrem o mesmo nome
                    if (!servicoTxt || isPlaceholderValue(servicoTxt)) {
                        servicoTxt = '';
                        console.warn('⚠️ Nome do serviço não encontrado ou é placeholder, deixando vazio para avaliação:', av._id);
                    } else {
                        console.log('✅ Nome do serviço encontrado nos fallbacks:', servicoTxt, 'para avaliação:', av._id);
                    }
                }
                const temServico = servicoTxt && servicoTxt.trim().length > 0;
                
                console.log('📋 Valor final de servicoTxt para renderização:', servicoTxt);
                console.log('📋 temServico:', temServico);

                // Se for a minha e achamos o serviço, cacheia para uso futuro
                if (isMinha && temServico && servicoTxt !== 'Serviço prestado' && servicoTxt !== 'Serviço concluído') {
                    try {
                        localStorage.setItem('ultimoServicoNome', servicoTxt);
                        localStorage.setItem('ultimaDescricaoPedido', servicoTxt);
                    } catch (e) {
                        console.warn('Falha ao cachear servicoTxt da minha avaliação', e);
                    }
                }
                const comentarioHtml = av.comentario ? `<p class="avaliacao-comentario">${av.comentario}</p>` : '';
                
                // Só exibe o serviço se não for placeholder
                const isPlaceholderFinal = servicoTxt && (
                    servicoTxt.trim().toLowerCase() === 'serviço concluído' ||
                    servicoTxt.trim().toLowerCase() === 'serviço prestado' ||
                    servicoTxt.trim().toLowerCase() === 'serviço realizado'
                );
                
                const servicoMeta = (servicoTxt && servicoTxt.trim().length > 0 && !isPlaceholderFinal)
                    ? `<span style="margin-left: 10px;">
                            <i class="fas fa-briefcase"></i> ${servicoTxt}
                       </span>`
                    : '';
                
                console.log('📋 servicoMeta gerado:', servicoMeta);

                // Busca fotos do pedido (será preenchido assincronamente)
                // Backend pode preencher pedidoUrgenteId via agendamentoId; fallback para pedidoId se existir
                const pedidoIdValue = av.pedidoUrgenteId?._id || av.pedidoUrgenteId || av.pedidoId;
                const fotosContainerId = `fotos-avaliacao-${av._id}`;

                return (
`<div class="avaliacao-verificada-item ${index >= 1 ? 'avaliacao-oculta' : ''}" data-index="${index}" data-avaliacao-id="${av._id}" data-pedido-id="${pedidoIdValue || ''}">
    <div class="avaliacao-header">
        <div class="avaliacao-cliente">
            <img src="${avatar}" alt="${nomeBase}" class="avatar-pequeno">
            <div>
                <strong>${nomeExibicao}</strong>
                <span class="badge-verificado-item">
                    <i class="fas fa-check-circle"></i> Cliente Verificado
                </span>
            </div>
        </div>
        <div class="avaliacao-estrelas">
            ${estrelas}
        </div>
    </div>
            ${comentarioHtml}
    <div class="avaliacao-meta">
        <small>
            <i class="fas fa-calendar"></i> ${dataServico}
            ${servicoMeta}
        </small>
    </div>
    <div id="${fotosContainerId}" class="avaliacao-fotos-container" style="display: none;">
        <!-- Fotos serão carregadas aqui -->
    </div>
</div>`
                );
            };
            
            // Renderiza a primeira avaliação (sempre visível)
            avaliacoesIniciais.forEach((av, idx) => {
                html += renderizarAvaliacaoCompleta(av, idx);
            });
            
            // Adiciona botão para expandir se houver mais avaliações (mais de 1)
            if (ordenadas.length > 1) {
                console.log('🔍 Total de avaliações:', ordenadas.length, '- Mostrando botão de expandir');
                html += `
                    <div class="avaliacoes-expandir-container">
                        <button class="btn-expandir-avaliacoes" id="btn-expandir-avaliacoes" aria-label="Ver mais avaliações">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                `;
                
                // Renderiza avaliações expandidas (inicialmente ocultas) - mais 3 para totalizar 4
                avaliacoesExpandidas.forEach((av, idx) => {
                    html += renderizarAvaliacaoCompleta(av, idx + 1);
                });
                
                // Renderiza avaliações restantes (inicialmente ocultas, aparecerão com scroll)
                avaliacoesRestantes.forEach((av, idx) => {
                    html += renderizarAvaliacaoCompleta(av, idx + 4);
                });
            }

            listaAvaliacoes.innerHTML = html;
            
            // Garante que a seção está visível após renderizar
            secaoAvaliacoesVerificadas.style.display = 'block';
            console.log('✅ Avaliações renderizadas na lista');
            
            // Carrega fotos de cada avaliação de forma assíncrona
            // Preferência: usar fotos já populadas em pedidoUrgenteId (não depende de token)
            ordenadas.forEach((av) => {
                const pedidoPopulado = (av && typeof av.pedidoUrgenteId === 'object') ? av.pedidoUrgenteId : null;
                const fotosPrefetch = pedidoPopulado?.fotos || (pedidoPopulado?.foto ? [pedidoPopulado.foto] : []);

                const pedidoIdValue = av.pedidoUrgenteId?._id || av.pedidoUrgenteId;
                if (pedidoIdValue) {
                    const pidClean = String(pedidoIdValue).match(/[a-fA-F0-9]{24}/)?.[0];
                    if (pidClean) {
                        carregarFotosAvaliacao(av._id, pidClean, fotosPrefetch);
                    } else if (Array.isArray(fotosPrefetch) && fotosPrefetch.length > 0) {
                        // Se não conseguiu extrair ObjectId mas tem fotos, ainda assim renderiza
                        carregarFotosAvaliacao(av._id, null, fotosPrefetch);
                    }
                } else if (Array.isArray(fotosPrefetch) && fotosPrefetch.length > 0) {
                    carregarFotosAvaliacao(av._id, null, fotosPrefetch);
                }
            });
            
            // Configura o botão de expandir/colapsar
            const btnExpandir = document.getElementById('btn-expandir-avaliacoes');
            if (btnExpandir) {
                let expandido = false;
                const avaliacoesOcultas = listaAvaliacoes.querySelectorAll('.avaliacao-oculta');
                
                // Inicialmente oculta avaliações expandidas e restantes
                avaliacoesOcultas.forEach(av => {
                    av.style.display = 'none';
                });
                
                // Adiciona classe para scrollbar customizada quando expandido
                btnExpandir.addEventListener('click', () => {
                    expandido = !expandido;
                    const icon = btnExpandir.querySelector('i');
                    
                    if (expandido) {
                        // Mostra avaliações expandidas (mais 3 para totalizar 4)
                        avaliacoesOcultas.forEach(av => {
                            av.style.display = 'block';
                        });
                        
                        // Adiciona classe para ativar scrollbar customizada quando expandido
                        // A scrollbar aparecerá automaticamente se o conteúdo exceder a altura máxima
                        listaAvaliacoes.classList.add('lista-avaliacoes-com-scroll');
                        console.log('✅ Scrollbar ativada - conteúdo expandido, total de avaliações:', ordenadas.length);
                        
                        if (icon) {
                            icon.classList.remove('fa-chevron-down');
                            icon.classList.add('fa-chevron-up');
                        }
                        btnExpandir.setAttribute('aria-label', 'Ocultar avaliações');
                    } else {
                        // Oculta avaliações expandidas
                        avaliacoesOcultas.forEach(av => {
                            av.style.display = 'none';
                        });
                        
                        // Remove classe de scrollbar
                        listaAvaliacoes.classList.remove('lista-avaliacoes-com-scroll');
                        
                        // Scroll para o topo da lista
                        listaAvaliacoes.scrollTop = 0;
                        
                        if (icon) {
                            icon.classList.remove('fa-chevron-up');
                            icon.classList.add('fa-chevron-down');
                        }
                        btnExpandir.setAttribute('aria-label', 'Ver mais avaliações');
                    }
                });
            }
        } catch (error) {
            console.error('❌ Erro ao carregar avaliações verificadas:', error);
            // Garante que a seção está visível mesmo em caso de erro
            if (secaoAvaliacoesVerificadas) {
                secaoAvaliacoesVerificadas.style.display = 'block';
            }
            if (listaAvaliacoes) {
                listaAvaliacoes.innerHTML = '<p style="padding:16px; color: var(--error-color);">Erro ao carregar avaliações.</p>';
            }
        } finally {
            // Sempre reseta a flag, mesmo em caso de erro
            carregandoAvaliacoes = false;
        }
    }

    // Função para carregar fotos do pedido e exibir na avaliação
    async function carregarFotosAvaliacao(avaliacaoId, pedidoId, fotosPrefetch) {
        try {
            // 1) Se as fotos já vieram na avaliação (pedidoUrgenteId populado), usa direto
            const fotosJaDisponiveis = Array.isArray(fotosPrefetch) ? fotosPrefetch.filter(Boolean) : [];
            if (fotosJaDisponiveis.length > 0) {
                const fotosContainer = document.getElementById(`fotos-avaliacao-${avaliacaoId}`);
                if (!fotosContainer) return;

                fotosContainer.innerHTML = fotosJaDisponiveis.map((fotoUrl, idx) => `
                    <img 
                        src="${fotoUrl}" 
                        alt="Foto do serviço ${idx + 1}" 
                        class="avaliacao-foto-miniatura"
                        data-foto-index="${idx}"
                        data-avaliacao-id="${avaliacaoId}"
                        style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid var(--border-color, #e5e7eb);"
                    >
                `).join('');

                fotosContainer.querySelectorAll('.avaliacao-foto-miniatura').forEach((img, idx) => {
                    img.addEventListener('click', () => {
                        abrirModalImagem(fotosJaDisponiveis, idx, avaliacaoId);
                    });
                });

                fotosContainer.style.display = 'flex';
                return;
            }

            const token = localStorage.getItem('jwtToken');
            // 2) Sem token e sem fotos pré-carregadas → não dá pra buscar o pedido protegido
            if (!token) return;
            if (!pedidoId) return;

            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                console.warn('⚠️ Erro ao buscar pedido para fotos:', response.status);
                return;
            }

            const data = await response.json();
            const pedido = data?.pedido || data;
            
            // Busca fotos do pedido (fotos array ou foto única)
            const fotos = pedido?.fotos || (pedido?.foto ? [pedido.foto] : []);
            
            if (fotos.length === 0) {
                return; // Sem fotos para exibir
            }

            const fotosContainer = document.getElementById(`fotos-avaliacao-${avaliacaoId}`);
            if (!fotosContainer) {
                console.warn('⚠️ Container de fotos não encontrado para avaliação:', avaliacaoId);
                return;
            }

            // Renderiza miniaturas das fotos
            fotosContainer.innerHTML = fotos.map((fotoUrl, idx) => `
                <img 
                    src="${fotoUrl}" 
                    alt="Foto do serviço ${idx + 1}" 
                    class="avaliacao-foto-miniatura"
                    data-foto-index="${idx}"
                    data-avaliacao-id="${avaliacaoId}"
                    style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid var(--border-color, #e5e7eb);"
                >
            `).join('');

            // Adiciona event listeners para expandir imagens
            fotosContainer.querySelectorAll('.avaliacao-foto-miniatura').forEach((img, idx) => {
                img.addEventListener('click', () => {
                    abrirModalImagem(fotos, idx, avaliacaoId);
                });
            });

            // Mostra o container de fotos
            fotosContainer.style.display = 'flex';
            
        } catch (error) {
            console.error('❌ Erro ao carregar fotos da avaliação:', error);
        }
    }

    // Função para abrir modal de imagem expandida
    function abrirModalImagem(fotos, indiceInicial, avaliacaoId) {
        // Remove modal existente se houver
        const modalExistente = document.getElementById('modal-imagem-avaliacao');
        if (modalExistente) {
            modalExistente.remove();
        }

        // Cria modal
        const modal = document.createElement('div');
        modal.id = 'modal-imagem-avaliacao';
        modal.className = 'modal-imagem-avaliacao';
        modal.innerHTML = `
            <div class="modal-imagem-avaliacao-overlay"></div>
            <div class="modal-imagem-avaliacao-content">
                <button class="modal-imagem-avaliacao-fechar" aria-label="Fechar">
                    <i class="fas fa-times"></i>
                </button>
                <div class="modal-imagem-avaliacao-container">
                    <img 
                        src="${fotos[indiceInicial]}" 
                        alt="Imagem expandida" 
                        class="modal-imagem-avaliacao-img"
                        id="modal-imagem-avaliacao-img"
                    >
                    ${fotos.length > 1 ? `
                        <button class="modal-imagem-avaliacao-prev" aria-label="Imagem anterior">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <button class="modal-imagem-avaliacao-next" aria-label="Próxima imagem">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                        <div class="modal-imagem-avaliacao-indicador">
                            ${indiceInicial + 1} / ${fotos.length}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden'; // Previne scroll do body

        let indiceAtual = indiceInicial;
        const imgElement = modal.querySelector('#modal-imagem-avaliacao-img');
        const indicador = modal.querySelector('.modal-imagem-avaliacao-indicador');

        // Função para atualizar imagem
        const atualizarImagem = (novoIndice) => {
            if (novoIndice < 0) novoIndice = fotos.length - 1;
            if (novoIndice >= fotos.length) novoIndice = 0;
            indiceAtual = novoIndice;
            imgElement.src = fotos[indiceAtual];
            if (indicador) {
                indicador.textContent = `${indiceAtual + 1} / ${fotos.length}`;
            }
        };

        // Event listeners
        const btnFechar = modal.querySelector('.modal-imagem-avaliacao-fechar');
        const btnPrev = modal.querySelector('.modal-imagem-avaliacao-prev');
        const btnNext = modal.querySelector('.modal-imagem-avaliacao-next');
        const overlay = modal.querySelector('.modal-imagem-avaliacao-overlay');

        const fecharModal = () => {
            modal.remove();
            document.body.style.overflow = '';
        };

        btnFechar.addEventListener('click', fecharModal);
        overlay.addEventListener('click', fecharModal);
        
        if (btnPrev) btnPrev.addEventListener('click', () => atualizarImagem(indiceAtual - 1));
        if (btnNext) btnNext.addEventListener('click', () => atualizarImagem(indiceAtual + 1));

        // Navegação com teclado
        const handleKeydown = (e) => {
            if (e.key === 'Escape') fecharModal();
            if (e.key === 'ArrowLeft' && btnPrev) atualizarImagem(indiceAtual - 1);
            if (e.key === 'ArrowRight' && btnNext) atualizarImagem(indiceAtual + 1);
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Remove listener quando modal fechar
        modal.addEventListener('remove', () => {
            document.removeEventListener('keydown', handleKeydown);
        });
    }

    // (Funções de renderização de serviços, postagens, etc.)
    async function fetchServicos(id) { if (!galeriaServicos) return; try { const response = await fetch(`/api/servicos/${id}`, { headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error('Falha ao buscar serviços.'); const servicos = await response.json(); renderServicos(servicos); } catch (error) { console.error('Erro ao buscar serviços:', error); galeriaServicos.innerHTML = '<p class="mensagem-vazia">Erro ao carregar serviços.</p>'; } }
    // 🆕 ATUALIZADO: Renderiza projetos com validações por pares
    function renderServicos(servicos) {
        if (!galeriaServicos) return;
        galeriaServicos.innerHTML = '';
        if (!servicos || servicos.length === 0) {
            galeriaServicos.innerHTML = '<p class="mensagem-vazia">Nenhum projeto cadastrado ainda.</p>';
            return;
        }
        
        servicos.forEach(servico => {
            const imageUrl = servico.images && servico.images.length > 0 ? servico.images[0] : 'https://placehold.co/200?text=Projeto';
            const servicoElement = document.createElement('div');
            servicoElement.className = 'servico-item-container';
            
            let deleteBtn = '';
            if (isOwnProfile) {
                deleteBtn = `<button class="btn-remover-foto" data-id="${servico._id}">&times;</button>`;
            }
            
            const totalValidacoes = servico.totalValidacoes || 0;
            const validacoesHTML = totalValidacoes > 0 
                ? `<span class="validacoes-badge" title="Validado por ${totalValidacoes} profissional(is)">🛡️ ${totalValidacoes}</span>`
                : '';
            
            const tecnologiasHTML = servico.tecnologias && servico.tecnologias.length > 0
                ? `<div class="tecnologias-tags">${servico.tecnologias.map(t => `<span class="tag-tecnologia">${t}</span>`).join('')}</div>`
                : '';
            
            const desafioHelpyBadge = servico.isDesafioHelpy 
                ? `<span class="badge-desafio">#DesafioHelpy</span>`
                : '';
            
            // 🆕 Verifica se o usuário já validou este projeto
            const jaValidou = servico.validacoesPares && servico.validacoesPares.some(
                v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === loggedInUserId
            );
            
            const validacaoAnterior = jaValidou && servico.validacoesPares.find(
                v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === loggedInUserId
            );
            
            let botaoValidar = '';
            if (!isOwnProfile && (userType === 'usuario' || userType === 'empresa')) {
                if (jaValidou) {
                    botaoValidar = `<button class="btn-validar-projeto ja-validado" data-id="${servico._id}" title="Você já validou este projeto">🛡️ Validado</button>`;
                } else {
                    botaoValidar = `<button class="btn-validar-projeto" data-id="${servico._id}">🛡️ Validar Projeto</button>`;
                }
            }
            
            servicoElement.innerHTML = `
                <div class="servico-item" data-id="${servico._id}">
                    <img src="${imageUrl}" alt="${servico.title || 'Projeto'}" class="foto-servico">
                    ${deleteBtn}
                    <div class="servico-info">
                        <p class="servico-titulo">${servico.title || 'Projeto'}</p>
                        ${validacoesHTML}
                        ${desafioHelpyBadge}
                        ${tecnologiasHTML}
                        ${botaoValidar}
                    </div>
                </div>
            `;
            galeriaServicos.appendChild(servicoElement);
        });
        
        // Adiciona listeners
        document.querySelectorAll('.btn-remover-foto').forEach(btn => {
            btn.addEventListener('click', handleDeleteServico);
        });
        
        document.querySelectorAll('.foto-servico').forEach(img => {
            img.addEventListener('click', handleShowServicoDetails);
        });
        
        // 🆕 ATUALIZADO: Listener para validar projeto (com modal melhorado)
        document.querySelectorAll('.btn-validar-projeto:not(.ja-validado)').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const servicoId = btn.dataset.id;
                
                // Abre modal de validação
                const modalValidacao = document.getElementById('modal-validar-projeto');
                if (modalValidacao) {
                    modalValidacao.dataset.servicoId = servicoId;
                    modalValidacao.classList.remove('hidden');
                } else {
                    // Fallback para prompt se modal não existir
                    const comentario = prompt('Deixe um comentário sobre a validação (opcional):');
                    await enviarValidacao(servicoId, comentario);
                }
            });
        });
        
        // Listener para botões já validados (mostra validação anterior)
        document.querySelectorAll('.btn-validar-projeto.ja-validado').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const servicoId = btn.dataset.id;
                // Busca e mostra validação anterior
                try {
                    const response = await fetch(`/api/servico/${servicoId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const servico = await response.json();
                    const minhaValidacao = servico.validacoesPares?.find(
                        v => v.profissionalId && (v.profissionalId._id || v.profissionalId).toString() === loggedInUserId
                    );
                    if (minhaValidacao) {
                        alert(`Você validou este projeto em ${new Date(minhaValidacao.dataValidacao).toLocaleDateString('pt-BR')}.\n${minhaValidacao.comentario ? `Comentário: ${minhaValidacao.comentario}` : 'Sem comentário.'}`);
                    }
                } catch (error) {
                    console.error('Erro ao buscar validação:', error);
                }
            });
        });
        
        async function enviarValidacao(servicoId, comentario) {
            try {
                const response = await fetch(`/api/servico/${servicoId}/validar`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ comentario: comentario || null })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Projeto validado com sucesso!');
                    // Recarrega os serviços
                    fetchServicos(loggedInUserId);
                } else {
                    alert(data.message || 'Erro ao validar projeto.');
                }
            } catch (error) {
                console.error('Erro ao validar projeto:', error);
                alert('Erro ao validar projeto.');
            }
        }
    }
    async function fetchPostagens(id) { 
        if (!minhasPostagensContainer) return; 
        try { 
            const response = await fetch(`/api/user-posts/${id}`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            }); 
            if (!response.ok) throw new Error('Falha ao buscar postagens.'); 
            const posts = await response.json(); 
            
            // Processa as postagens para garantir que tenham likesCount e commentsCount
            const postsComContadores = posts.map((post) => {
                // Calcula likesCount
                let likesCount = 0;
                if (post.likesCount !== undefined) {
                    likesCount = post.likesCount;
                } else if (post.likes && Array.isArray(post.likes)) {
                    likesCount = post.likes.length;
                }
                
                // Calcula commentsCount
                let commentsCount = 0;
                if (post.commentsCount !== undefined) {
                    commentsCount = post.commentsCount;
                } else if (post.comments && Array.isArray(post.comments)) {
                    // No perfil, pode existir comentário com user apagado (sem userId). Esses não devem contar.
                    commentsCount = post.comments.filter(c => c && c.userId).length;
                }
                
                // Verifica se o usuário já curtiu
                const isLiked = post.likes && Array.isArray(post.likes) && post.likes.includes(loggedInUserId);
                
                return {
                    ...post,
                    likesCount: likesCount,
                    commentsCount: commentsCount,
                    isLiked: isLiked,
                    likes: post.likes || [],
                    // Mantém comments filtrado para evitar inconsistências entre contagem e renderização
                    comments: (post.comments && Array.isArray(post.comments)) ? post.comments.filter(c => c && c.userId) : []
                };
            });
            
            renderPostagens(postsComContadores); 
        } catch (error) { 
            console.error('Erro ao buscar postagens:', error); 
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar postagens.</p>'; 
        } 
    }
    
    function renderPostagens(posts) { 
        if (!minhasPostagensContainer) return; 
        minhasPostagensContainer.innerHTML = ''; 
        if (!posts || posts.length === 0) { 
            minhasPostagensContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>'; 
            return; 
        } 
        
        // Cria grid de miniaturas
        posts.forEach(post => { 
            if (!post.userId) return; 
            
            const thumbnail = document.createElement('div');
            thumbnail.className = 'post-thumbnail';
            thumbnail.dataset.postId = post._id;
            
            // Verifica se já curtiu
            const isLiked = post.isLiked || (post.likes && Array.isArray(post.likes) && post.likes.includes(loggedInUserId));
            
            // Imagem de preview (ou ícone se não tiver imagem)
            if (post.mediaUrl && post.mediaType === 'image') {
                thumbnail.innerHTML = `
                    <img src="${post.mediaUrl}" alt="Postagem" class="thumbnail-image">
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            } else if (post.mediaUrl && post.mediaType === 'video') {
                thumbnail.innerHTML = `
                    <div class="thumbnail-video-wrapper">
                        <video src="${post.mediaUrl}" class="thumbnail-video"></video>
                        <i class="fas fa-play-circle thumbnail-play-icon"></i>
                    </div>
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            } else {
                // Sem mídia - mostra ícone de texto
                thumbnail.innerHTML = `
                    <div class="thumbnail-text-icon">
                        <i class="fas fa-file-alt"></i>
                        <p class="thumbnail-text-preview">${post.content ? (post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '')) : ''}</p>
                    </div>
                    <div class="thumbnail-overlay">
                        <div class="thumbnail-info">
                            <i class="fas fa-thumbs-up ${isLiked ? 'liked' : ''}"></i> <span class="like-count">${post.likesCount || 0}</span>
                            <i class="fas fa-comment"></i> <span class="comment-count">${post.commentsCount || 0}</span>
                        </div>
                    </div>
                `;
            }
            
            // Armazena dados da postagem para o modal
            thumbnail.dataset.postData = JSON.stringify({
                _id: post._id,
                content: post.content,
                mediaUrl: post.mediaUrl,
                mediaType: post.mediaType,
                userId: post.userId,
                createdAt: post.createdAt,
                likesCount: post.likesCount || 0,
                commentsCount: post.commentsCount || 0
            });
            
            // Event listener para abrir modal
            thumbnail.addEventListener('click', () => {
                abrirModalPostagem(post);
            });
            
            minhasPostagensContainer.appendChild(thumbnail);
        }); 
    }
    
    // Função para abrir modal com postagem completa
    async function abrirModalPostagem(post) {
        const modalPostagem = document.getElementById('modal-postagem-completa');
        const modalContent = document.getElementById('modal-postagem-content');
        
        if (!modalPostagem || !modalContent) {
            console.error('Modal de postagem não encontrado');
            return;
        }
        
        // Busca o post completo com comentários e likes
        let postCompleto = post;
        // No perfil, os posts já vêm do endpoint /api/user-posts/:userId com comments/likes populados.
        // Evita chamar /api/posts/:id (pode não existir no backend e gerar 404).
        if (!postCompleto.comments) postCompleto.comments = [];
        if (!postCompleto.likes) postCompleto.likes = [];
        
        // Debug: verificar dados do post
        console.log('📋 Dados do post para renderização:', {
            id: postCompleto._id,
            temComentarios: !!postCompleto.comments,
            qtdComentarios: postCompleto.comments?.length || 0,
            primeiroComentario: postCompleto.comments?.[0]
        });
        
        const postAuthorPhoto = (postCompleto.userId.foto && !postCompleto.userId.foto.includes('pixabay')) 
            ? postCompleto.userId.foto 
            : (postCompleto.userId.avatarUrl && !postCompleto.userId.avatarUrl.includes('pixabay') 
                ? postCompleto.userId.avatarUrl 
                : 'imagens/default-user.png');
        const postAuthorName = postCompleto.userId.nome || 'Usuário Anônimo';
        const postDate = new Date(postCompleto.createdAt).toLocaleString('pt-BR');
        
        // Verifica se já curtiu
        const isLiked = postCompleto.likes && Array.isArray(postCompleto.likes) && postCompleto.likes.includes(loggedInUserId);
        const likesCount = postCompleto.likes?.length || postCompleto.likesCount || 0;
        
        let mediaHTML = '';
        if (postCompleto.mediaUrl) {
            if (postCompleto.mediaType === 'video') {
                mediaHTML = `<video src="${postCompleto.mediaUrl}" class="post-video" controls></video>`;
            } else if (postCompleto.mediaType === 'image') {
                mediaHTML = `<img src="${postCompleto.mediaUrl}" alt="Imagem da postagem" class="post-image">`;
            }
        }
        
        let deleteButton = '';
        if (isOwnProfile) {
            deleteButton = `<button class="delete-post-btn" data-id="${postCompleto._id}"><i class="fas fa-trash"></i></button>`;
        }
        
        // Renderiza comentários
        const isPostOwner = postCompleto.userId._id === loggedInUserId;
        const rawCommentsArray = postCompleto.comments || [];
        // No perfil, pode existir comentário com user apagado (sem userId). Esses não devem contar/nem renderizar.
        const commentsArray = rawCommentsArray.filter(c => c && c.userId);
        const commentsCount = commentsArray.length;
        console.log('📝 Renderizando comentários válidos:', commentsArray.length, '| totais brutos:', rawCommentsArray.length);
        
        // Em telas menores, mostrar apenas 2 comentários inicialmente
        // Em telas maiores, mostrar apenas 3 comentários inicialmente
        const isMobile = window.innerWidth <= 767;
        const isDesktop = window.innerWidth >= 1024;
        const initialCommentsCount = isMobile ? 2 : (isDesktop ? 3 : commentsArray.length);
        const commentsToShow = commentsArray.slice(0, initialCommentsCount);
        const hasMoreComments = commentsArray.length > initialCommentsCount;
        
        const commentsHTML = renderComments(commentsToShow, isPostOwner);
        const allCommentsHTML = renderComments(commentsArray, isPostOwner);
        // No modal de postagem completa, manter a seção de comentários sempre aberta
        // para o usuário sempre ver "Escreva um comentário..." mesmo quando não há comentários.
        const comentariosVisiveis = 'visible';
        console.log('📝 HTML dos comentários gerado:', commentsHTML.length > 0 ? 'Sim' : 'Não');
        console.log('📝 Total de comentários:', commentsArray.length, '| Mostrando:', commentsToShow.length, '| Tem mais?', hasMoreComments);
        
        // HTML do "Carregar Mais" - mostrar sempre que houver mais comentários
        const loadMoreHTML = hasMoreComments ? 
            `<div class="load-more-comments-text" data-post-id="${postCompleto._id}" data-all-comments='${JSON.stringify(commentsArray)}' style="cursor: pointer; color: var(--text-link); text-align: center; font-size: 14px;">Carregar Mais</div>` : '';
        
        modalContent.innerHTML = `
            <article class="post" data-post-id="${postCompleto._id}">
                <div class="post-header">
                    <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${postCompleto.userId._id}">
                    <div class="post-meta">
                        <span class="user-name" data-userid="${postCompleto.userId._id}">${postAuthorName}</span>
                        <div>
                            <span class="post-date-display">${postDate}</span>
                        </div>
                    </div>
                    ${deleteButton}
                </div>
                <div class="post-content">
                    <p>${postCompleto.content || ''}</p>
                    ${mediaHTML}
                </div>
                <div class="post-actions">
                    <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${postCompleto._id}">
                        <i class="fas fa-thumbs-up"></i> 
                        <span class="like-count">${likesCount}</span> Curtir
                    </button>
                    <button class="action-btn btn-comment ${comentariosVisiveis ? 'active' : ''}" data-post-id="${postCompleto._id}">
                        <i class="fas fa-comment"></i> ${commentsCount} Comentários
                    </button>
                </div>
                <div class="post-comments ${comentariosVisiveis}" id="comments-${postCompleto._id}">
                    <div class="comment-list" data-all-comments='${JSON.stringify(commentsArray)}' data-initial-count="${initialCommentsCount}" data-post-id="${postCompleto._id}">
                        ${commentsHTML}
                        ${loadMoreHTML}
                    </div>
                    <div class="comment-form">
                        <input type="text" class="comment-input" placeholder="Escreva um comentário...">
                        <button class="btn-send-comment" data-post-id="${postCompleto._id}" title="Enviar">
                            <img
                                class="publish-icon"
                                alt=""
                                src="${document.documentElement.classList.contains('dark-mode') ? '/imagens/enviar.tema.escuro.png' : '/imagens/enviar.tema.claro.png'}"
                                data-src-light="/imagens/enviar.tema.claro.png"
                                data-src-dark="/imagens/enviar.tema.escuro.png"
                            >
                        </button>
                    </div>
                </div>
            </article>
        `;
        
        // Configurar botão de fechar
        const btnFechar = modalPostagem.querySelector('.btn-close-modal');
        if (btnFechar) {
            btnFechar.onclick = () => {
                modalPostagem.classList.add('hidden');
                document.body.style.overflow = '';
            };
        }
        
        // Fechar ao clicar no overlay
        modalPostagem.onclick = (e) => {
            if (e.target === modalPostagem) {
                modalPostagem.classList.add('hidden');
                document.body.style.overflow = '';
            }
        };
        
        // Abrir modal
        modalPostagem.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Ajusta ícones por tema (inclui botões gerados no modal)
        aplicarIconeEnviarTemaNoPerfil();

        // Configurar listeners de interação imediatamente
        setupPostModalListeners(postCompleto._id);
        
        // Função para lidar com o clique em "Carregar Mais"
        const handleLoadMoreClick = (e) => {
            const loadMoreText = e.target.closest('.load-more-comments-text');
            if (!loadMoreText) return;
            
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Clicou em "Carregar Mais"');
            
            const commentList = modalContent.querySelector('.comment-list');
            let allCommentsData;
            
            try {
                allCommentsData = JSON.parse(loadMoreText.dataset.allComments || '[]');
            } catch (err) {
                console.error('❌ Erro ao fazer parse dos comentários:', err);
                return;
            }
            
            const isPostOwner = postCompleto.userId._id === loggedInUserId;
            
            console.log('📝 Comentários totais:', allCommentsData.length);
            console.log('📝 Lista de comentários encontrada:', commentList ? 'Sim' : 'Não');
            
            if (commentList && allCommentsData.length > 0) {
                // Renderizar todos os comentários
                const allCommentsHTML = renderComments(allCommentsData, isPostOwner);
                console.log('📝 Renderizando', allCommentsData.length, 'comentários');
                console.log('📝 HTML gerado tem', (allCommentsHTML.match(/class="comment"/g) || []).length, 'comentários no HTML');
                console.log('📝 Tamanho do HTML:', allCommentsHTML.length, 'caracteres');
                
                // Limpar e inserir todos os comentários
                commentList.innerHTML = '';
                commentList.innerHTML = allCommentsHTML;
                
                // Verificar quantos comentários foram realmente inseridos
                const insertedComments = commentList.querySelectorAll('.comment');
                console.log('📝 Comentários inseridos no DOM:', insertedComments.length);
                
                // Garantir layout vertical; rolagem/altura ficam por conta do CSS do modal
                commentList.classList.remove('comments-expanded');
                commentList.style.display = 'flex';
                commentList.style.flexDirection = 'column';
                
                // Remover completamente o texto "Carregar Mais"
                loadMoreText.remove();
                console.log('📝 Botão "Carregar Mais" removido');
                
                // Configurar listeners dos novos comentários com todas as funções
                setTimeout(() => {
                    const newComments = commentList.querySelectorAll('.comment');
                    console.log('📝 Configurando listeners para', newComments.length, 'comentários');
                    console.log('📝 IDs dos comentários:', Array.from(newComments).map(c => c.dataset.commentId));
                    newComments.forEach(comment => {
                        setupCommentListeners(comment, postCompleto._id);
                    });
                    
                    // Configurar listeners de resposta, curtir, deletar, etc.
                    setupPostModalListeners(postCompleto._id);
                    
                    // Verificar novamente após configurar listeners
                    const finalComments = commentList.querySelectorAll('.comment');
                    console.log('📝 Comentários finais visíveis:', finalComments.length);
                }, 100);
            } else {
                console.error('❌ Erro: commentList ou allCommentsData vazio');
                console.error('commentList:', commentList);
                console.error('allCommentsData:', allCommentsData);
            }
        };
        
        // Usar delegação de eventos para garantir que funcione mesmo após mudanças no DOM
        // Remover listener anterior se existir
        if (modalContent._loadMoreHandler) {
            modalContent.removeEventListener('click', modalContent._loadMoreHandler);
        }
        modalContent._loadMoreHandler = handleLoadMoreClick;
        modalContent.addEventListener('click', handleLoadMoreClick, true); // Use capture phase
        
        // Também adicionar listener direto no botão se ele existir
        setTimeout(() => {
            const loadMoreText = modalContent.querySelector('.load-more-comments-text');
            if (loadMoreText) {
                console.log('📝 Botão "Carregar Mais" encontrado, adicionando listener direto');
                loadMoreText.addEventListener('click', handleLoadMoreClick, true);
            }
        }, 100);
    }
    
    // Função para renderizar comentários
    function renderComments(comments, isPostOwner) {
        if (!comments || comments.length === 0) {
            console.log('⚠️ renderComments: Nenhum comentário fornecido');
            return '';
        }
        
        console.log('📝 renderComments: Renderizando', comments.length, 'comentários');
        
        const htmlArray = comments.map((comment, index) => {
            if (!comment.userId) {
                console.warn('⚠️ renderComments: Comentário', index, 'sem userId');
                return '';
            }
            
            // Verifica se o usuário pode deletar este comentário
            const isCommentOwner = comment.userId._id === loggedInUserId;
            const canDeleteComment = isPostOwner || isCommentOwner;
            const canEditComment = isCommentOwner;
            
            const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
            const isCommentLiked = comment.likes && Array.isArray(comment.likes) && comment.likes.includes(loggedInUserId);
            const replyCount = comment.replies?.length || 0;
            
            // Renderiza respostas
            const repliesHTML = (comment.replies || []).map(reply => {
                const isReplyOwner = reply.userId && reply.userId._id === loggedInUserId;
                const canDeleteReply = isPostOwner || isReplyOwner;
                return renderReply(reply, comment._id, canDeleteReply);
            }).join('');
            
            const commentHTML = `
                <div class="comment" data-comment-id="${comment._id}">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar">
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <strong>${comment.userId.nome}</strong>
                            <p>${comment.content}</p>
                            ${(canEditComment || canDeleteComment) ? `
                                <button class="btn-comment-options" data-comment-id="${comment._id}" title="Opções">⋯</button>
                                <div class="comment-options-menu oculto" data-comment-id="${comment._id}">
                                    ${canEditComment ? `<button class="btn-edit-comment" data-comment-id="${comment._id}" title="Editar">✏️</button>` : ''}
                                    ${canDeleteComment ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar">🗑️</button>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn btn-like-comment ${isCommentLiked ? 'liked' : ''}" data-comment-id="${comment._id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span class="like-count">${comment.likes?.length || 0}</span>
                            </button>
                            <button class="comment-action-btn btn-show-reply-form" data-comment-id="${comment._id}">Responder</button>
                            ${replyCount > 0 ? `<button class="comment-action-btn btn-toggle-replies" data-comment-id="${comment._id}">Ver ${replyCount} Respostas</button>` : ''}
                        </div>
                        <div class="reply-list oculto">${repliesHTML}</div>
                        <div class="reply-form oculto">
                            <input type="text" class="reply-input" placeholder="Responda a ${comment.userId.nome}...">
                            <button class="btn-send-reply" data-comment-id="${comment._id}" title="Enviar">
                                <img
                                    class="publish-icon"
                                    alt=""
                                    src="${document.documentElement.classList.contains('dark-mode') ? '/imagens/enviar.tema.escuro.png' : '/imagens/enviar.tema.claro.png'}"
                                    data-src-light="/imagens/enviar.tema.claro.png"
                                    data-src-dark="/imagens/enviar.tema.escuro.png"
                                >
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            return commentHTML;
        });
        
        const result = htmlArray.join('');
        const validComments = htmlArray.filter(h => h !== '').length;
        console.log('📝 renderComments: HTML gerado com', validComments, 'comentários válidos de', comments.length, 'total');
        console.log('📝 renderComments: Tamanho do HTML resultante:', result.length, 'caracteres');
        
        return result;
    }
    
    // Função para renderizar resposta
    function renderReply(reply, commentId, canDeleteReply) {
        if (!reply.userId) return '';
        const replyPhoto = reply.userId.foto || reply.userId.avatarUrl || 'imagens/default-user.png';
        const isReplyLiked = reply.likes && Array.isArray(reply.likes) && reply.likes.includes(loggedInUserId);
        const isReplyOwner = reply.userId && reply.userId._id === loggedInUserId;
        const canEditReply = isReplyOwner;
        
        return `
            <div class="reply" data-reply-id="${reply._id}">
                <img src="${replyPhoto.includes('pixabay') ? 'imagens/default-user.png' : replyPhoto}" alt="Avatar" class="reply-avatar">
                <div class="reply-body-container">
                    <div class="reply-body">
                        <strong>${reply.userId.nome}</strong>
                        <p>${reply.content}</p>
                        ${(canEditReply || canDeleteReply) ? `
                            <button class="btn-reply-options" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Opções">⋯</button>
                            <div class="reply-options-menu oculto" data-comment-id="${commentId}" data-reply-id="${reply._id}">
                                ${canEditReply ? `<button class="btn-edit-reply" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Editar">✏️</button>` : ''}
                                ${canDeleteReply ? `<button class="btn-delete-reply" data-comment-id="${commentId}" data-reply-id="${reply._id}" title="Apagar">🗑️</button>` : ''}
                            </div>
                        ` : ''}
                    </div>
                    <div class="reply-actions">
                        <button class="reply-action-btn btn-like-reply ${isReplyLiked ? 'liked' : ''}" data-comment-id="${commentId}" data-reply-id="${reply._id}">
                            <i class="fas fa-thumbs-up"></i>
                            <span class="like-count">${reply.likes?.length || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Configurar listeners de interação do modal
    function setupPostModalListeners(postId) {
        // Buscar o elemento dentro do modal, não a miniatura
        const modalPostagem = document.getElementById('modal-postagem-completa');
        if (!modalPostagem) {
            console.error('❌ Modal não encontrado');
            return;
        }
        const postElement = modalPostagem.querySelector(`.post[data-post-id="${postId}"]`);
        if (!postElement) {
            console.error('❌ Post element não encontrado no modal');
            return;
        }
        
        // Curtir postagem
        const btnLike = postElement.querySelector('.btn-like');
        if (btnLike) {
            btnLike.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLike.classList.toggle('liked');
                        btnLike.querySelector('.like-count').textContent = data.likes.length;
                        // Atualiza contador e status na miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const likeCountEl = thumbnail.querySelector('.like-count');
                            if (likeCountEl) likeCountEl.textContent = data.likes.length;
                            const likeIcon = thumbnail.querySelector('.fa-thumbs-up');
                            if (likeIcon) {
                                if (data.likes.includes(loggedInUserId)) {
                                    likeIcon.classList.add('liked');
                                } else {
                                    likeIcon.classList.remove('liked');
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Erro ao curtir:', error);
                }
            });
        }
        
        // Toggle comentários
        const btnComment = postElement.querySelector('.btn-comment');
        if (btnComment) {
            btnComment.addEventListener('click', (e) => {
                e.stopPropagation();
                const commentsSection = postElement.querySelector('.post-comments');
                if (commentsSection) {
                    commentsSection.classList.toggle('visible');
                    btnComment.classList.toggle('active');
                    if (commentsSection.classList.contains('visible')) {
                        const input = commentsSection.querySelector('.comment-input');
                        if (input) input.focus();
                    }
                }
            });
        }
        
        // Enviar comentário
        const btnSendComment = postElement.querySelector('.btn-send-comment');
        if (btnSendComment) {
            btnSendComment.addEventListener('click', async (e) => {
                e.stopPropagation();
                const input = postElement.querySelector('.comment-input');
                const content = input?.value.trim();
                if (!content) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comment`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await response.json();
                    if (data.success && data.comment) {
                        const commentList = postElement.querySelector('.comment-list');
                        // Verifica se é dono da postagem através do data-userid do avatar
                        const postAuthorId = postElement.querySelector('.post-avatar')?.dataset.userid;
                        const isPostOwner = postAuthorId === loggedInUserId;
                        const newCommentHTML = renderComments([data.comment], isPostOwner);
                        commentList.innerHTML += newCommentHTML;
                        
                        // Reconfigurar listeners do novo comentário
                        const newComment = commentList.lastElementChild;
                        setupCommentListeners(newComment, postId);
                        
                        // Verifica se o novo comentário é longo
                        setTimeout(() => {
                            if (newComment.offsetParent !== null) {
                                checkLongComment(newComment);
                            }
                        }, 300);
                        
                        // Atualizar contador (conta apenas comentários reais)
                        const commentCount = commentList.querySelectorAll('.comment').length;
                        btnComment.innerHTML = `<i class="fas fa-comment"></i> ${commentCount} Comentários`;

                        // Mantém data-all-comments consistente (para "Carregar Mais")
                        try {
                            const existingAll = JSON.parse(commentList.dataset.allComments || '[]');
                            if (data.comment && data.comment.userId) {
                                existingAll.push(data.comment);
                                commentList.dataset.allComments = JSON.stringify(existingAll);
                            }
                        } catch (_) {
                            // ignora
                        }
                        
                        // Atualiza contador na miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const commentCountEl = thumbnail.querySelector('.comment-count');
                            if (commentCountEl) commentCountEl.textContent = commentCount;
                        }
                        
                        input.value = '';
                        postElement.querySelector('.post-comments').classList.add('visible');
                        btnComment.classList.add('active');
                    }
                } catch (error) {
                    console.error('Erro ao comentar:', error);
                    alert('Não foi possível enviar o comentário.');
                }
            });
        }
        
        // Deletar postagem
        const btnDeletePost = postElement.querySelector('.delete-post-btn');
        if (btnDeletePost) {
            btnDeletePost.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Tem certeza que deseja excluir esta postagem?')) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (response.ok && data.success) {
                        // Remove a miniatura
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) thumbnail.remove();
                        // Fecha o modal
                        const modalPostagem = document.getElementById('modal-postagem-completa');
                        if (modalPostagem) {
                            modalPostagem.classList.add('hidden');
                            document.body.style.overflow = '';
                        }
                    } else {
                        throw new Error(data.message || 'Erro ao deletar postagem.');
                    }
                } catch (error) {
                    console.error('Erro ao deletar postagem:', error);
                    alert(error.message || 'Erro ao deletar postagem.');
                }
            });
        }
        
        // Aguardar um pouco para garantir que o DOM foi atualizado antes de configurar listeners
        setTimeout(() => {
            // Buscar o elemento dentro do modal novamente
            const modalPostagemCheck = document.getElementById('modal-postagem-completa');
            if (!modalPostagemCheck) {
                console.error('❌ Modal não encontrado no setTimeout');
                return;
            }
            const postElementCheck = modalPostagemCheck.querySelector(`.post[data-post-id="${postId}"]`);
            if (!postElementCheck) {
                console.error('❌ Post element não encontrado no modal no setTimeout');
                return;
            }
            
            // Configurar listeners dos comentários existentes
            const comments = postElementCheck.querySelectorAll('.comment');
            console.log('🔍 Buscando comentários no elemento:', postElementCheck);
            console.log('🔍 Comentários encontrados:', comments.length);
            
            comments.forEach((comment, index) => {
                console.log(`📝 Configurando listeners para comentário ${index + 1}:`, comment);
                setupCommentListeners(comment, postId);
                
                // Verifica se o comentário é longo após renderizar
                setTimeout(() => {
                    if (comment.offsetParent !== null) {
                        checkLongComment(comment);
                    }
                }, 300);
            });
            
            // Debug: verificar se os listeners foram configurados
            const toggleButtons = postElementCheck.querySelectorAll('.btn-toggle-replies');
            console.log('📝 Comentários configurados:', comments.length);
            console.log('📝 Botões toggle encontrados:', toggleButtons.length);
            
            // Se não encontrou comentários, pode ser que ainda não foram renderizados
            if (comments.length === 0) {
                console.warn('⚠️ Nenhum comentário encontrado no DOM');
                // Tentar novamente após mais tempo
                setTimeout(() => {
                    const modalRetry = document.getElementById('modal-postagem-completa');
                    if (modalRetry) {
                        const postRetry = modalRetry.querySelector(`.post[data-post-id="${postId}"]`);
                        if (postRetry) {
                            const retryComments = postRetry.querySelectorAll('.comment');
                            console.log('🔄 Retry - Comentários encontrados:', retryComments.length);
                            if (retryComments.length > 0) {
                                retryComments.forEach(comment => {
                                    setupCommentListeners(comment, postId);
                                });
                            }
                        }
                    }
                }, 200);
            }
        }, 300);
    }
    
    // Configurar listeners de um comentário específico
    // Função para verificar se um comentário é longo e precisa de "Carregar comentário"
    function checkLongComment(commentElement) {
        if (window.innerWidth > 767) {
            // Em telas maiores, remove qualquer limite que possa ter sido aplicado
            const commentText = commentElement.querySelector('.comment-body p');
            if (commentText) {
                commentText.classList.remove('comment-long', 'expanded');
                const loadBtn = commentText.querySelector('.load-comment-text');
                if (loadBtn) loadBtn.remove();
            }
            return;
        }
        
        const commentText = commentElement.querySelector('.comment-body p');
        if (!commentText) return;
        
        // Remove classes anteriores para medir corretamente
        commentText.classList.remove('comment-long', 'expanded');
        const existingLoadBtn = commentText.querySelector('.load-comment-text');
        if (existingLoadBtn) existingLoadBtn.remove();
        
        // Força remoção de qualquer estilo inline que possa interferir
        commentText.style.maxHeight = '';
        commentText.style.height = '';
        commentText.style.overflow = '';
        commentText.style.overflowY = '';
        commentText.style.overflowX = '';
        
        // Aguarda um frame para garantir que o navegador renderizou
        requestAnimationFrame(() => {
            // Mede a altura real do texto sem limite
            const computedStyle = window.getComputedStyle(commentText);
            const lineHeight = parseFloat(computedStyle.lineHeight) || 22;
            const maxLines = 5;
            const maxHeight = lineHeight * maxLines;
            
            // Altura real do conteúdo
            const actualHeight = commentText.scrollHeight;
            
            if (actualHeight > maxHeight) {
                // Comentário é longo, aplica limite e adiciona botão "Carregar comentário"
                commentText.classList.add('comment-long');
                
                // Encontra o container do comentário para adicionar o botão após o parágrafo
                const commentBody = commentText.closest('.comment-body');
                if (commentBody) {
                    // Garante que o botão não existe antes de adicionar
                    const existingBtn = commentBody.querySelector('.load-comment-text');
                    if (existingBtn) existingBtn.remove();
                    
                    const loadBtn = document.createElement('span');
                    loadBtn.className = 'load-comment-text';
                    loadBtn.textContent = 'Carregar comentário';
                    loadBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        commentText.classList.add('expanded');
                        commentText.style.maxHeight = 'none';
                        commentText.style.overflow = 'visible';
                        commentText.style.display = 'block';
                        commentText.style.webkitLineClamp = 'unset';
                        commentText.style.webkitBoxOrient = 'unset';
                        this.remove();
                    });
                    // Adiciona o botão após o parágrafo, dentro do comment-body
                    commentBody.insertBefore(loadBtn, commentText.nextSibling);
                }
            } else {
                // Garante que comentários curtos não tenham limite
                commentText.classList.remove('comment-long', 'expanded');
                commentText.style.maxHeight = '';
                commentText.style.overflow = '';
                commentText.style.overflowY = '';
                commentText.style.overflowX = '';
                commentText.style.height = '';
            }
        });
    }

    function setupCommentListeners(commentElement, postId) {
        const commentId = commentElement.dataset.commentId;
        if (!commentId) return;
        
        // Verifica se o comentário é longo após configurar listeners
        setTimeout(() => {
            if (commentElement.offsetParent !== null) {
                checkLongComment(commentElement);
            }
        }, 300);
        
        // Curtir comentário
        const btnLikeComment = commentElement.querySelector('.btn-like-comment');
        if (btnLikeComment) {
            btnLikeComment.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLikeComment.classList.toggle('liked');
                        btnLikeComment.querySelector('.like-count').textContent = data.likes.length;
                    }
                } catch (error) {
                    console.error('Erro ao curtir comentário:', error);
                }
            });
        }
        
        // Mostrar/ocultar formulário de resposta
        const btnShowReply = commentElement.querySelector('.btn-show-reply-form');
        if (btnShowReply) {
            btnShowReply.addEventListener('click', (e) => {
                e.stopPropagation();
                const replyForm = commentElement.querySelector('.reply-form');
                if (replyForm) {
                    replyForm.classList.toggle('oculto');
                    if (!replyForm.classList.contains('oculto')) {
                        replyForm.querySelector('.reply-input').focus();
                    }
                }
            });
        }
        
        // Toggle respostas
        const btnToggleReplies = commentElement.querySelector('.btn-toggle-replies');
        if (btnToggleReplies) {
            console.log('🔘 Botão toggle encontrado para comentário:', commentElement.dataset.commentId);
            btnToggleReplies.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('🔘 Clique no botão toggle detectado');
                const replyList = commentElement.querySelector('.reply-list');
                console.log('🔘 Reply list encontrado:', !!replyList);
                if (replyList) {
                    const isHidden = replyList.classList.contains('oculto');
                    console.log('🔘 Reply list está oculto?', isHidden);
                    console.log('🔘 Reply list children:', replyList.children.length);
                    
                    if (isHidden) {
                        // Remove a classe oculto e força display block com !important
                        replyList.classList.remove('oculto');
                        replyList.style.setProperty('display', 'block', 'important');
                        console.log('✅ Respostas mostradas');
                    } else {
                        // Adiciona a classe oculto
                        replyList.classList.add('oculto');
                        replyList.style.removeProperty('display');
                        console.log('✅ Respostas ocultadas');
                    }
                    
                    const replyCount = replyList.children.length;
                    btnToggleReplies.textContent = replyList.classList.contains('oculto') 
                        ? `Ver ${replyCount} Respostas` 
                        : 'Ocultar Respostas';
                } else {
                    console.error('❌ Reply list não encontrado');
                }
            });
        } else {
            console.warn('⚠️ Botão toggle não encontrado para comentário:', commentElement.dataset.commentId);
        }
        
        // Enviar resposta
        const btnSendReply = commentElement.querySelector('.btn-send-reply');
        if (btnSendReply) {
            btnSendReply.addEventListener('click', async (e) => {
                e.stopPropagation();
                const replyForm = btnSendReply.closest('.reply-form');
                const input = replyForm.querySelector('.reply-input');
                const content = input?.value.trim();
                if (!content) return;
                
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content })
                    });
                    const data = await response.json();
                    if (data.success && data.reply) {
                        const replyList = commentElement.querySelector('.reply-list');
                        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
                        // Verifica se é dono da postagem através do data-userid do avatar
                        const postAuthorId = postElement?.querySelector('.post-avatar')?.dataset.userid;
                        const isPostOwner = postAuthorId === loggedInUserId;
                        // O usuário que acabou de criar a resposta sempre é o dono dela
                        const isReplyOwner = data.reply.userId && data.reply.userId._id === loggedInUserId;
                        const canDeleteReply = isPostOwner || isReplyOwner;
                        const newReplyHTML = renderReply(data.reply, commentId, canDeleteReply);
                        replyList.innerHTML += newReplyHTML;
                        
                        // Reconfigurar listeners da nova resposta
                        const newReply = replyList.lastElementChild;
                        setupReplyListeners(newReply, postId, commentId);
                        
                        replyList.classList.remove('oculto');
                        input.value = '';
                        replyForm.classList.add('oculto');
                        
                        // Atualizar botão de toggle
                        const replyCount = replyList.children.length;
                        if (btnToggleReplies) {
                            btnToggleReplies.textContent = `Ver ${replyCount} Respostas`;
                            btnToggleReplies.style.display = 'inline-block';
                        }
                    }
                } catch (error) {
                    console.error('Erro ao responder:', error);
                    alert('Não foi possível enviar a resposta.');
                }
            });
        }
        
        const btnCommentOptions = commentElement.querySelector('.btn-comment-options');
        const commentOptionsMenu = commentElement.querySelector('.comment-options-menu');
        if (btnCommentOptions && commentOptionsMenu) {
            btnCommentOptions.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.comment-options-menu').forEach(m => m.classList.add('oculto'));
                document.querySelectorAll('.reply-options-menu').forEach(m => m.classList.add('oculto'));
                commentOptionsMenu.classList.toggle('oculto');
            });
        }

        const btnDeleteComment = commentElement.querySelector('.btn-delete-comment');
        if (btnDeleteComment) {
            btnDeleteComment.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteConfirmPopup(btnDeleteComment, async () => {
                    try {
                        const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        let data = null;
                        try {
                            data = await response.json();
                        } catch (_) {
                            data = null;
                        }

                        const ok = response.ok && (!data || data.success !== false);
                        if (!ok) {
                            throw new Error(data?.message || 'Erro ao deletar comentário.');
                        }

                        commentElement.remove();
                        const commentList = document.querySelector(`[data-post-id="${postId}"] .comment-list`);
                        const commentCount = commentList?.querySelectorAll('.comment').length || 0;
                        const btnComment = document.querySelector(`[data-post-id="${postId}"] .btn-comment`);
                        if (btnComment) {
                            btnComment.innerHTML = `<i class="fas fa-comment"></i> ${commentCount} Comentários`;
                        }
                        const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                        if (thumbnail) {
                            const commentCountEl = thumbnail.querySelector('.comment-count');
                            if (commentCountEl) commentCountEl.textContent = commentCount;
                        }
                    } catch (error) {
                        console.error('Erro ao deletar comentário:', error);
                        alert(error.message || 'Erro ao deletar comentário.');
                    }
                }, e);
            });
        }

        const btnEditComment = commentElement.querySelector('.btn-edit-comment');
        if (btnEditComment) {
            btnEditComment.addEventListener('click', (e) => {
                e.stopPropagation();
                if (commentOptionsMenu) commentOptionsMenu.classList.add('oculto');
                startInlineEditComment(commentElement, postId, commentId);
            });
        }
        
        // Configurar listeners das respostas existentes
        commentElement.querySelectorAll('.reply').forEach(reply => {
            setupReplyListeners(reply, postId, commentId);
        });
    }
    
    // Configurar listeners de uma resposta específica
    function setupReplyListeners(replyElement, postId, commentId) {
        const replyId = replyElement.dataset.replyId;
        if (!replyId) return;
        
        // Curtir resposta
        const btnLikeReply = replyElement.querySelector('.btn-like-reply');
        if (btnLikeReply) {
            btnLikeReply.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}/like`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await response.json();
                    if (data.success) {
                        btnLikeReply.classList.toggle('liked');
                        btnLikeReply.querySelector('.like-count').textContent = data.likes.length;
                    }
                } catch (error) {
                    console.error('Erro ao curtir resposta:', error);
                }
            });
        }
        
        const btnReplyOptions = replyElement.querySelector('.btn-reply-options');
        const replyOptionsMenu = replyElement.querySelector('.reply-options-menu');
        if (btnReplyOptions && replyOptionsMenu) {
            btnReplyOptions.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.comment-options-menu').forEach(m => m.classList.add('oculto'));
                document.querySelectorAll('.reply-options-menu').forEach(m => m.classList.add('oculto'));
                replyOptionsMenu.classList.toggle('oculto');
            });
        }

        const btnDeleteReply = replyElement.querySelector('.btn-delete-reply');
        if (btnDeleteReply) {
            btnDeleteReply.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteConfirmPopup(btnDeleteReply, async () => {
                    try {
                        const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        let data = null;
                        try {
                            data = await response.json();
                        } catch (_) {
                            data = null;
                        }

                        const ok = response.ok && (!data || data.success !== false);
                        if (!ok) {
                            throw new Error(data?.message || 'Erro ao deletar resposta.');
                        }

                        replyElement.remove();

                        const commentEl = replyElement.closest('.comment') || document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                        const replyList = commentEl ? commentEl.querySelector('.reply-list') : null;
                        const btnToggleReplies = commentEl ? commentEl.querySelector('.btn-toggle-replies') : null;

                        if (replyList && btnToggleReplies) {
                            const replyCount = replyList.querySelectorAll('.reply').length;
                            if (replyCount <= 0) {
                                btnToggleReplies.remove();
                                replyList.classList.add('oculto');
                            } else {
                                btnToggleReplies.textContent = `Ver ${replyCount} Respostas`;
                            }
                        }
                    } catch (error) {
                        console.error('Erro ao deletar resposta:', error);
                        alert(error.message || 'Erro ao deletar resposta.');
                    }
                }, e);
            });
        }

        const btnEditReply = replyElement.querySelector('.btn-edit-reply');
        if (btnEditReply) {
            btnEditReply.addEventListener('click', (e) => {
                e.stopPropagation();
                if (replyOptionsMenu) replyOptionsMenu.classList.add('oculto');
                startInlineEditReply(replyElement, postId, commentId, replyId);
            });
        }
    }

    function startInlineEditComment(commentElement, postId, commentId) {
        const body = commentElement.querySelector('.comment-body');
        if (!body) return;

        const p = body.querySelector('p');
        if (!p) return;

        if (body.querySelector('.comment-edit-input')) {
            const existing = body.querySelector('.comment-edit-input');
            existing.focus();
            existing.select();
            return;
        }

        const originalText = p.textContent;

        const input = document.createElement('textarea');
        input.className = 'comment-edit-input';
        input.value = originalText;

        const optionsBtn = commentElement.querySelector('.btn-comment-options');
        const originalOptionsText = optionsBtn ? optionsBtn.textContent : null;

        const actions = document.createElement('div');
        actions.className = 'comment-edit-actions';
        actions.innerHTML = `
            <button class="btn-confirm-edit" type="button" title="Enviar">
                <img
                    class="publish-icon"
                    alt=""
                    src="${document.documentElement.classList.contains('dark-mode') ? '/imagens/enviar.tema.escuro.png' : '/imagens/enviar.tema.claro.png'}"
                    data-src-light="/imagens/enviar.tema.claro.png"
                    data-src-dark="/imagens/enviar.tema.escuro.png"
                >
            </button>
        `;

        const editRow = document.createElement('div');
        editRow.className = 'inline-edit-row';
        editRow.appendChild(input);
        editRow.appendChild(actions);

        p.style.display = 'none';
        body.insertBefore(editRow, p);
        input.focus();
        input.select();

        commentElement.dataset.editing = '1';
        const cancelEditViaOutside = () => {
            commentElement.dataset.editing = '';
            p.style.display = '';
            editRow.remove();
            if (optionsBtn) {
                optionsBtn.textContent = originalOptionsText || '⋯';
                optionsBtn.style.display = '';
            }
            document.removeEventListener('mousedown', outsideCancelHandler, true);
        };
        const outsideCancelHandler = (ev) => {
            if (commentElement.dataset.editing !== '1') return;
            if (editRow.contains(ev.target)) return;
            cancelEditViaOutside();
        };
        if (optionsBtn) {
            optionsBtn.textContent = originalOptionsText || '⋯';
            optionsBtn.style.display = 'none';
        }
        document.addEventListener('mousedown', outsideCancelHandler, true);
        aplicarIconeEnviarTemaNoPerfil();

        const autoGrow = () => {
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
        };
        autoGrow();
        input.addEventListener('input', autoGrow);

        actions.querySelector('.btn-confirm-edit')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            document.removeEventListener('mousedown', outsideCancelHandler, true);
            const newContent = input.value.trim();
            if (!newContent) {
                alert('O comentário não pode estar vazio.');
                return;
            }
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: newContent })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Erro ao editar comentário');
                }
                p.textContent = newContent;
                cancelEditViaOutside();
            } catch (err) {
                console.error('Erro ao editar comentário:', err);
                alert(err.message || 'Erro ao editar comentário');
                document.addEventListener('mousedown', outsideCancelHandler, true);
            }
        });

        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                actions.querySelector('.btn-confirm-edit')?.click();
            }
        });
    }

    function startInlineEditReply(replyElement, postId, commentId, replyId) {
        const body = replyElement.querySelector('.reply-body');
        if (!body) return;

        const p = body.querySelector('p');
        if (!p) return;

        if (body.querySelector('.reply-edit-input')) {
            const existing = body.querySelector('.reply-edit-input');
            existing.focus();
            existing.select();
            return;
        }

        const originalText = p.textContent;

        const input = document.createElement('textarea');
        input.className = 'reply-edit-input';
        input.value = originalText;

        const optionsBtn = replyElement.querySelector('.btn-reply-options');
        const originalOptionsText = optionsBtn ? optionsBtn.textContent : null;

        const actions = document.createElement('div');
        actions.className = 'reply-edit-actions';
        actions.innerHTML = `
            <button class="btn-confirm-edit-reply" type="button" title="Enviar">
                <img
                    class="publish-icon"
                    alt=""
                    src="${document.documentElement.classList.contains('dark-mode') ? '/imagens/enviar.tema.escuro.png' : '/imagens/enviar.tema.claro.png'}"
                    data-src-light="/imagens/enviar.tema.claro.png"
                    data-src-dark="/imagens/enviar.tema.escuro.png"
                >
            </button>
        `;

        const editRow = document.createElement('div');
        editRow.className = 'inline-edit-row';
        editRow.appendChild(input);
        editRow.appendChild(actions);

        p.style.display = 'none';
        body.insertBefore(editRow, p);
        input.focus();
        input.select();

        replyElement.dataset.editing = '1';
        const cancelEditViaOutside = () => {
            replyElement.dataset.editing = '';
            p.style.display = '';
            editRow.remove();
            if (optionsBtn) {
                optionsBtn.textContent = originalOptionsText || '⋯';
                optionsBtn.style.display = '';
            }
            document.removeEventListener('mousedown', outsideCancelHandler, true);
        };
        const outsideCancelHandler = (ev) => {
            if (replyElement.dataset.editing !== '1') return;
            if (editRow.contains(ev.target)) return;
            cancelEditViaOutside();
        };
        if (optionsBtn) {
            optionsBtn.textContent = originalOptionsText || '⋯';
            optionsBtn.style.display = 'none';
        }
        document.addEventListener('mousedown', outsideCancelHandler, true);
        aplicarIconeEnviarTemaNoPerfil();

        const autoGrow = () => {
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
        };
        autoGrow();
        input.addEventListener('input', autoGrow);

        actions.querySelector('.btn-confirm-edit-reply')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            document.removeEventListener('mousedown', outsideCancelHandler, true);
            const newContent = input.value.trim();
            if (!newContent) {
                alert('A resposta não pode estar vazia.');
                return;
            }
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: newContent })
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Erro ao editar resposta');
                }
                p.textContent = newContent;
                cancelEditViaOutside();
            } catch (err) {
                console.error('Erro ao editar resposta:', err);
                alert(err.message || 'Erro ao editar resposta');
                document.addEventListener('mousedown', outsideCancelHandler, true);
            }
        });

        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                actions.querySelector('.btn-confirm-edit-reply')?.click();
            }
        });
    }

    function showDeleteConfirmPopup(btn, onConfirm, clickEvent) {
        const existing = document.querySelector('.delete-confirm-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'delete-confirm-popup';
        popup.innerHTML = `
            <div class="delete-confirm-content">
                <button class="btn-confirm-yes" type="button">Sim</button>
                <button class="btn-confirm-no" type="button">Não</button>
            </div>
        `;
        document.body.appendChild(popup);

        const rect = btn.getBoundingClientRect();
        const viewportW = window.innerWidth;
        const viewportH = window.innerHeight;
        const padding = 8;

        // Usa coordenadas da viewport (fixed) para sempre ficar acima do modal
        let top = (clickEvent?.clientY ?? rect.top);
        let left = (clickEvent?.clientX ?? rect.left);

        popup.style.position = 'fixed';
        popup.style.zIndex = '10050';

        // Mede para evitar sair da tela
        popup.style.top = '0px';
        popup.style.left = '0px';
        void popup.offsetHeight;
        const popupRect = popup.getBoundingClientRect();

        // Preferência: um pouco abaixo e à direita do clique
        top = top + 6;
        left = left + 6;

        if (left + popupRect.width > viewportW - padding) {
            left = Math.max(padding, viewportW - popupRect.width - padding);
        }
        if (top + popupRect.height > viewportH - padding) {
            top = Math.max(padding, (clickEvent?.clientY ?? rect.top) - popupRect.height - 6);
        }

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;

        const btnYes = popup.querySelector('.btn-confirm-yes');
        const btnNo = popup.querySelector('.btn-confirm-no');

        btnYes.addEventListener('click', () => {
            popup.remove();
            onConfirm();
        });

        btnNo.addEventListener('click', () => {
            popup.remove();
        });

        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target) && e.target !== btn) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 10);
    }

    async function handleDelegatedDeleteComment(deleteBtn, clickEvent) {
        const commentId = deleteBtn?.dataset?.commentId;
        const commentElement = commentId ? document.querySelector(`.comment[data-comment-id="${commentId}"]`) : null;
        const postContainer = commentElement?.closest('[data-post-id]');
        const postId = postContainer?.dataset?.postId;

        if (!commentId || !postId || !commentElement) {
            console.error('❌ Delete comentário: não foi possível resolver IDs.', { postId, commentId });
            alert('Erro ao apagar comentário.');
            return;
        }

        showDeleteConfirmPopup(deleteBtn, async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                let data = null;
                try {
                    data = await response.json();
                } catch (_) {
                    data = null;
                }

                const ok = response.ok && (!data || data.success !== false);
                if (!ok) throw new Error(data?.message || 'Erro ao deletar comentário.');

                commentElement.remove();
                const commentList = postContainer.querySelector('.comment-list');
                const commentCount = commentList?.querySelectorAll('.comment').length || 0;

                const btnComment = postContainer.querySelector('.btn-comment');
                if (btnComment) btnComment.innerHTML = `<i class="fas fa-comment"></i> ${commentCount} Comentários`;

                const thumbnail = document.querySelector(`.post-thumbnail[data-post-id="${postId}"]`);
                if (thumbnail) {
                    const commentCountEl = thumbnail.querySelector('.comment-count');
                    if (commentCountEl) commentCountEl.textContent = commentCount;
                }
            } catch (error) {
                console.error('Erro ao deletar comentário:', error);
                alert(error.message || 'Erro ao deletar comentário.');
            }
        }, clickEvent);
    }

    async function handleDelegatedDeleteReply(deleteBtn, clickEvent) {
        const commentId = deleteBtn?.dataset?.commentId;
        const replyId = deleteBtn?.dataset?.replyId;
        const replyElement = replyId ? document.querySelector(`.reply[data-reply-id="${replyId}"]`) : null;
        const postContainer = replyElement?.closest('[data-post-id]');
        const postId = postContainer?.dataset?.postId;

        if (!commentId || !replyId || !postId || !replyElement) {
            console.error('❌ Delete resposta: não foi possível resolver IDs.', { postId, commentId, replyId });
            alert('Erro ao apagar resposta.');
            return;
        }

        showDeleteConfirmPopup(deleteBtn, async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                let data = null;
                try {
                    data = await response.json();
                } catch (_) {
                    data = null;
                }

                const ok = response.ok && (!data || data.success !== false);
                if (!ok) throw new Error(data?.message || 'Erro ao deletar resposta.');

                replyElement.remove();

                const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                const replyList = commentEl ? commentEl.querySelector('.reply-list') : null;
                const btnToggleReplies = commentEl ? commentEl.querySelector('.btn-toggle-replies') : null;

                if (replyList && btnToggleReplies) {
                    const replyCount = replyList.querySelectorAll('.reply').length;
                    if (replyCount <= 0) {
                        btnToggleReplies.remove();
                        replyList.classList.add('oculto');
                    } else {
                        btnToggleReplies.textContent = `Ver ${replyCount} Respostas`;
                    }
                }
            } catch (error) {
                console.error('Erro ao deletar resposta:', error);
                alert(error.message || 'Erro ao deletar resposta.');
            }
        }, clickEvent);
    }

    // Event delegation: garante que a lixeira funcione mesmo com DOM dinâmico/menus
    document.addEventListener('click', (ev) => {
        const deleteCommentBtn = ev.target && ev.target.closest ? ev.target.closest('.btn-delete-comment') : null;
        if (deleteCommentBtn) {
            ev.stopPropagation();
            handleDelegatedDeleteComment(deleteCommentBtn, ev);
            return;
        }

        const deleteReplyBtn = ev.target && ev.target.closest ? ev.target.closest('.btn-delete-reply') : null;
        if (deleteReplyBtn) {
            ev.stopPropagation();
            handleDelegatedDeleteReply(deleteReplyBtn, ev);
        }
    }, true);
    function renderMediaAvaliacao(media) { if (!mediaEstrelas) return; mediaEstrelas.innerHTML = ''; const estrelasCheias = Math.floor(media); const temMeiaEstrela = media % 1 !== 0; for (let i = 0; i < estrelasCheias; i++) mediaEstrelas.innerHTML += '<i class="fas fa-star"></i>'; if (temMeiaEstrela) mediaEstrelas.innerHTML += '<i class="fas fa-star-half-alt"></i>'; const estrelasVazias = 5 - estrelasCheias - (temMeiaEstrela ? 1 : 0); for (let i = 0; i < estrelasVazias; i++) mediaEstrelas.innerHTML += '<i class="far fa-star"></i>'; }

    // ----------------------------------------------------------------------
    // LÓGICA DE EDIÇÃO DE PERFIL
    // ----------------------------------------------------------------------

    function toggleEditMode(isEditing) {
        
        // 🛑 ATUALIZAÇÃO: Lista de elementos de visualização
        const viewElements = [
            nomePerfil, idadePerfil, telefonePerfil, atuacaoPerfil, 
            descricaoPerfil, emailPerfil, btnEditarPerfil,
            localizacaoPerfil // Span de Localização (Cidade - Estado)
        ];
        
        // 🛑 ATUALIZAÇÃO: Lista de elementos de edição
        const editElements = [
            inputNome, inputIdade, inputWhatsapp, inputAtuacao, 
            inputDescricao, inputEmail, botoesEdicao
        ];
        
        // Elementos de localização (inputs dentro de um div)
        const localizacaoInputs = localizacaoItem ? localizacaoItem.querySelector('.input-edicao') : null;
        
        viewElements.forEach(el => el && el.classList.toggle('oculto', isEditing));
        editElements.forEach(el => el && el.classList.toggle('oculto', !isEditing));
        
        // Mostra/esconde inputs de localização
        if (localizacaoInputs) {
            localizacaoInputs.classList.toggle('oculto', !isEditing);
        }
        
        // Esconde itens antigos de cidade/estado se existirem
        if (cidadeItem) cidadeItem.style.display = 'none';
        if (estadoItem) estadoItem.style.display = 'none';

        const userTipo = (atuacaoItem.style.display === 'flex') ? 'trabalhador' : 'cliente';
        if(isEditing && userTipo === 'trabalhador') {
            atuacaoItem.style.display = 'flex'; 
            inputAtuacao.classList.remove('oculto'); 
            atuacaoPerfil.classList.add('oculto'); 
        } else if (isEditing) {
            atuacaoItem.style.display = 'none'; 
        } else {
             if(userTipo === 'trabalhador') {
                 atuacaoItem.style.display = 'flex';
             } else {
                 atuacaoItem.style.display = 'none';
             }
        }
        
        if (inputEmail) {
            inputEmail.disabled = true; 
        }
    }

    function fillEditInputs() {
        if (!inputNome) return; 
        
        inputNome.value = nomePerfil.textContent;
        inputIdade.value = idadePerfil.textContent.replace(' anos', '').replace('Não informado', '');
        inputWhatsapp.value = telefonePerfil.textContent.replace('Não informado', '');
        inputAtuacao.value = atuacaoPerfil.textContent.replace('Não informado', '');
        inputDescricao.value = descricaoPerfil.textContent.replace('Nenhuma descrição disponível.', '');
        inputEmail.value = emailPerfil.textContent.trim();
        
        // 🛑 ATUALIZAÇÃO: Lê os dados do dataset ou do texto de localização
        if (localizacaoPerfil) {
            const localizacaoTexto = localizacaoPerfil.textContent || '';
            const partes = localizacaoTexto.split(' - ');
            inputCidade.value = partes[0] || fotoPerfil.dataset.cidade || '';
            inputEstado.value = partes[1] || fotoPerfil.dataset.estado || '';
        } else {
            inputCidade.value = fotoPerfil.dataset.cidade || '';
            inputEstado.value = fotoPerfil.dataset.estado || '';
        }
    }

    if (btnEditarPerfil) {
        btnEditarPerfil.addEventListener('click', () => {
            fillEditInputs();
            toggleEditMode(true);
        });
    }

    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', () => {
            toggleEditMode(false);
        });
    }

    if (btnSalvarPerfil) {
        btnSalvarPerfil.addEventListener('click', async () => {
            
            // 🛑 ATUALIZAÇÃO: Lógica do Spinner
            btnSalvarPerfil.disabled = true;
            btnSalvarPerfil.classList.add('saving');

            const formData = new FormData();
            formData.append('nome', inputNome.value);
            formData.append('idade', inputIdade.value);
            formData.append('telefone', inputWhatsapp.value);
            formData.append('descricao', inputDescricao.value);
            
            // 🛑 ATUALIZAÇÃO: Envia cidade e estado
            formData.append('cidade', inputCidade.value);
            formData.append('estado', inputEstado.value);
            
            if (atuacaoItem.style.display === 'flex') {
                formData.append('atuacao', inputAtuacao.value);
            }
            
            try {
                const response = await fetch(`/api/editar-perfil/${loggedInUserId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || 'Falha ao salvar.');
                }
                
                localStorage.setItem('userName', data.user.nome);
                
                // Atualiza foto no cabeçalho se foi alterada
                if (data.user.avatarUrl || data.user.foto) {
                    localStorage.setItem('userPhotoUrl', data.user.avatarUrl || data.user.foto);
                    loadHeaderInfo();
                }
                
                toggleEditMode(false);
                fetchUserProfile(); // Recarrega o perfil com os novos dados
                
                // Dispara evento para recarregar times locais se a cidade foi alterada
                if (data.user.cidade) {
                    localStorage.setItem('cidadeAtualizada', Date.now().toString());
                    // Dispara evento customizado para outras abas/janelas
                    window.dispatchEvent(new Event('cidadeAtualizada'));
                }
                
            } catch (error) {
                console.error('Erro ao salvar perfil:', error);
                alert('Erro ao salvar: ' + error.message);
            } finally {
                // 🛑 ATUALIZAÇÃO: Esconde o spinner
                btnSalvarPerfil.disabled = false;
                btnSalvarPerfil.classList.remove('saving');
            }
        });
    }
    
    // ----------------------------------------------------------------------
    // PRÉ-VISUALIZAÇÃO E EDIÇÃO DA FOTO DE PERFIL
    // ----------------------------------------------------------------------
    const AVATAR_FRAME_SIZE = 220; // mesmo tamanho visual do círculo de preview
    let avatarPreviewImage = null;
    let avatarPreviewScale = 1;
    let avatarPreviewOffsetX = 0;
    let avatarPreviewOffsetY = 0;
    let avatarIsDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    function atualizarTransformPreviewAvatar() {
        if (!avatarPreviewImg) return;
        avatarPreviewImg.style.transform =
            `translate(calc(-50% + ${avatarPreviewOffsetX}px), calc(-50% + ${avatarPreviewOffsetY}px)) scale(${avatarPreviewScale})`;
    }

    function abrirModalPreviewAvatar(file) {
        if (!file || !modalPreviewAvatar || !avatarPreviewImg) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            avatarPreviewImage = new Image();
            avatarPreviewImage.onload = () => {
                const w = avatarPreviewImage.width;
                const h = avatarPreviewImage.height;
                const frame = AVATAR_FRAME_SIZE;
                // Escala para cobrir todo o círculo
                avatarPreviewScale = Math.max(frame / w, frame / h);
                avatarPreviewOffsetX = 0;
                avatarPreviewOffsetY = 0;
                atualizarTransformPreviewAvatar();
                modalPreviewAvatar.classList.remove('hidden');
            };
            avatarPreviewImage.src = e.target.result;
            avatarPreviewImg.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function fecharModalPreviewAvatar() {
        if (modalPreviewAvatar) {
            modalPreviewAvatar.classList.add('hidden');
        }
        if (inputFotoPerfil) {
            inputFotoPerfil.value = '';
        }
        avatarPreviewImage = null;
        avatarIsDragging = false;
    }

    // Arrastar para mover a imagem dentro do círculo
    if (avatarPreviewArea && avatarPreviewImg) {
        const iniciarDrag = (clientX, clientY) => {
            avatarIsDragging = true;
            dragStartX = clientX;
            dragStartY = clientY;
            avatarPreviewImg.classList.add('dragging');
        };

        const moverDrag = (clientX, clientY) => {
            if (!avatarIsDragging) return;
            const dx = clientX - dragStartX;
            const dy = clientY - dragStartY;
            dragStartX = clientX;
            dragStartY = clientY;
            avatarPreviewOffsetX += dx;
            avatarPreviewOffsetY += dy;
            atualizarTransformPreviewAvatar();
        };

        const finalizarDrag = () => {
            avatarIsDragging = false;
            avatarPreviewImg.classList.remove('dragging');
        };

        avatarPreviewArea.addEventListener('mousedown', (e) => {
            e.preventDefault();
            iniciarDrag(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => moverDrag(e.clientX, e.clientY));
        window.addEventListener('mouseup', finalizarDrag);

        avatarPreviewArea.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            iniciarDrag(touch.clientX, touch.clientY);
        }, { passive: true });
        window.addEventListener('touchmove', (e) => {
            if (!avatarIsDragging) return;
            const touch = e.touches[0];
            moverDrag(touch.clientX, touch.clientY);
        }, { passive: true });
        window.addEventListener('touchend', finalizarDrag);
        window.addEventListener('touchcancel', finalizarDrag);
    }

    // Salvar foto recortada (usando canvas)
    async function salvarPreviewAvatar() {
        if (!avatarPreviewImage || !isOwnProfile) return;

        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_FRAME_SIZE;
        canvas.height = AVATAR_FRAME_SIZE;
        const ctx = canvas.getContext('2d');

        // Fundo preto para evitar áreas vazias
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, AVATAR_FRAME_SIZE, AVATAR_FRAME_SIZE);

        const w = avatarPreviewImage.width;
        const h = avatarPreviewImage.height;

        ctx.save();
        ctx.translate(AVATAR_FRAME_SIZE / 2 + avatarPreviewOffsetX, AVATAR_FRAME_SIZE / 2 + avatarPreviewOffsetY);
        ctx.scale(avatarPreviewScale, avatarPreviewScale);
        ctx.drawImage(avatarPreviewImage, -w / 2, -h / 2);
        ctx.restore();

        return new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    resolve(false);
                    return;
                }
                const formData = new FormData();
                formData.append('avatar', blob, 'avatar.jpg');

        try {
            const response = await fetch(`/api/editar-perfil/${loggedInUserId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            const novaFoto = data.user.avatarUrl || data.user.foto;
            localStorage.setItem('userPhotoUrl', novaFoto);
            loadHeaderInfo();
            fetchUserProfile(); 
                    resolve(true);
        } catch (error) {
            console.error('Erro ao salvar foto:', error);
            alert('Erro ao salvar foto: ' + error.message);
                    resolve(false);
        } finally {
                    fecharModalPreviewAvatar();
        }
            }, 'image/jpeg', 0.9);
        });
    }
    
    if (inputFotoPerfil) {
        inputFotoPerfil.addEventListener('change', () => {
            const file = inputFotoPerfil.files[0];
            if (file) {
                abrirModalPreviewAvatar(file);
            }
        });
    }

    // Fechar modal de opções ao clicar fora
    document.addEventListener('click', (e) => {
        if (modalFotoOpcoes && !modalFotoOpcoes.classList.contains('oculto')) {
            const fotoEl = document.getElementById('fotoPerfil');
            if (!modalFotoOpcoes.contains(e.target) && (!fotoEl || !fotoEl.contains(e.target))) {
                modalFotoOpcoes.classList.add('oculto');
            }
        }
    });

    // Botão Ver Foto
    if (btnVerFoto) {
        btnVerFoto.addEventListener('click', () => {
            if (modalFotoOpcoes) modalFotoOpcoes.classList.add('oculto');
            expandirFoto();
        });
    }

    // Botão Alterar Foto
    if (btnAlterarFoto) {
        btnAlterarFoto.addEventListener('click', () => {
            if (modalFotoOpcoes) modalFotoOpcoes.classList.add('oculto');
            if (inputFotoPerfil) inputFotoPerfil.click();
        });
    }

    // Fechar modal de foto expandida
    if (btnFecharFotoExpandida) {
        btnFecharFotoExpandida.addEventListener('click', () => {
            if (modalFotoExpandida) modalFotoExpandida.classList.add('oculto');
            document.body.style.overflow = '';
        });
    }

    // Fechar ao clicar no backdrop
    if (modalFotoBackdrop) {
        modalFotoBackdrop.addEventListener('click', () => {
            if (modalFotoExpandida) modalFotoExpandida.classList.add('oculto');
            document.body.style.overflow = '';
        });
    }

    if (avatarPreviewCancelBtn) {
        avatarPreviewCancelBtn.addEventListener('click', () => {
            fecharModalPreviewAvatar();
        });
    }

    if (avatarPreviewSaveBtn) {
        avatarPreviewSaveBtn.addEventListener('click', () => {
            salvarPreviewAvatar();
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DE AVALIAÇÃO, SERVIÇOS, MODAIS, LOGOUT, ETC.
    // ----------------------------------------------------------------------
    if (estrelasAvaliacao.length > 0) {
        estrelasAvaliacao.forEach(star => {
            star.addEventListener('click', () => {
                const value = star.dataset.value;
                if (formAvaliacao) formAvaliacao.dataset.value = value;
                estrelasAvaliacao.forEach(s => {
                    const sValue = s.dataset.value;
                    if (sValue <= value) s.innerHTML = '<i class="fas fa-star"></i>';
                    else s.innerHTML = '<i class="far fa-star"></i>';
                });
                if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${value} estrela(s).`;
            });
        });
    }

    // Se veio de uma notificação de serviço concluído, mostra a seção de avaliação e abre lembrete
    // (movidos para o topo para evitar hoist issues)
    const sanitizePedidoId = (id) => {
        if (!id) return null;
        const match = String(id).match(/[a-fA-F0-9]{24}/);
        return match ? match[0] : null;
    };

    const fotoServicoAvaliacaoUrlRaw = urlParams.get('foto') || urlParams.get('img') || sessionStorage.getItem('ultimaFotoPedido');
    const fotoUltimoLocal = localStorage.getItem('fotoUltimoServicoConcluido') || sessionStorage.getItem('fotoUltimoServicoConcluido');
    const ultimaFotoPedido = localStorage.getItem('ultimaFotoPedido') || sessionStorage.getItem('ultimaFotoPedido');
    // Busca qualquer fotoPedido:* caso outros fallbacks falhem
    function pegarPrimeiraFotoPedido() {
        let found = null;
        Object.keys(localStorage).some(k => {
            if (k.startsWith('fotoPedido:')) {
                found = localStorage.getItem(k);
                return true;
            }
            return false;
        });
        return found;
    }
    const pedidoIdAvaliacaoRaw = urlParams.get('pedidoId') || localStorage.getItem('pedidoIdUltimoServicoConcluido');
    const pedidoIdAvaliacaoLimpo = sanitizePedidoId(pedidoIdAvaliacaoRaw);
    
    // Tenta recuperar uma foto válida
    const fotoPedidoPorId = pedidoIdAvaliacaoLimpo ? (localStorage.getItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`) || sessionStorage.getItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`)) : null;
    const fotoServicoAvaliacaoUrl = (fotoServicoAvaliacaoUrlRaw && fotoServicoAvaliacaoUrlRaw.trim() !== '') ? fotoServicoAvaliacaoUrlRaw : null;
    let fotoServicoAvaliacao = fotoServicoAvaliacaoUrl || fotoUltimoLocal || fotoPedidoPorId || ultimaFotoPedido || pegarPrimeiraFotoPedido();
    const logSemFoto = () => {
        console.warn('Sem foto nos caches; exibindo fallback.', {
            fotoURL: fotoServicoAvaliacaoUrl,
            fotoUltimoLocal,
            fotoPedidoPorId,
            ultimaFotoPedido,
            pedidoIdAvaliacaoRaw,
            pedidoIdAvaliacaoLimpo
        });
    };

    // Captura de foto já renderizada na página (qualquer <img> com "pedidos-urgentes" no src)
    const tentarCapturarFotoDaPagina = () => {
        const img = document.querySelector('img[src*="pedidos-urgentes"]');
        if (img?.src) {
            localStorage.setItem('ultimaFotoPedido', img.src);
            localStorage.setItem('fotoUltimoServicoConcluido', img.src);
            if (pedidoIdAvaliacaoLimpo) {
                localStorage.setItem(`fotoPedido:${pedidoIdAvaliacaoLimpo}`, img.src);
            }
            return img.src;
        }
        return null;
    };

    // Função para buscar todas as fotos do pedido via API
    async function buscarFotosPedido(pedidoId) {
        if (!pedidoId) return null;
        try {
            const response = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.success && data.pedido) {
                // Retorna o array de fotos se existir, senão retorna a foto única
                if (data.pedido.fotos && Array.isArray(data.pedido.fotos) && data.pedido.fotos.length > 0) {
                    return data.pedido.fotos;
                } else if (data.pedido.foto) {
                    return [data.pedido.foto];
                }
            }
            return null;
        } catch (error) {
            console.error('Erro ao buscar fotos do pedido:', error);
            return null;
        }
    }

    // Função para renderizar fotos na seção de avaliação
    async function renderizarFotosSecaoAvaliacao() {
        if (!secaoAvaliacao) return;
        
        // Remove fotos anteriores se existirem
        const fotosContainerAnterior = secaoAvaliacao.querySelector('.fotos-pedido-container');
        if (fotosContainerAnterior) {
            fotosContainerAnterior.remove();
        }

        // Busca fotos do pedido
        let fotosPedido = null;
        if (pedidoIdAvaliacaoLimpo) {
            fotosPedido = await buscarFotosPedido(pedidoIdAvaliacaoLimpo);
        }

        // Se não encontrou via API, tenta usar a foto do cache
        if (!fotosPedido || fotosPedido.length === 0) {
            if (fotoServicoAvaliacao) {
                fotosPedido = [fotoServicoAvaliacao];
            }
        }

        // Se tem fotos, cria o container e renderiza
        if (fotosPedido && fotosPedido.length > 0) {
            const fotosContainer = document.createElement('div');
            fotosContainer.className = 'fotos-pedido-container';
            fotosContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; margin: 15px 0; padding: 10px; background: var(--bg-secondary, #111827); border-radius: 8px; border: 1px solid var(--border-color, #1f2937);';
            
            fotosPedido.forEach((foto, idx) => {
                const img = document.createElement('img');
                if (fotosPedido.length > 1) {
                    // Múltiplas fotos: mostra em miniatura
                    img.style.cssText = 'width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer;';
                } else {
                    // Uma foto: mostra grande
                    img.style.cssText = 'width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; cursor: pointer;';
                }
                img.alt = `Foto do serviço ${idx + 1}`;
                img.src = foto;
                img.style.cursor = 'pointer';
                img.className = 'foto-pedido-clickable';
                img.dataset.fotoUrl = foto;
                img.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(foto);
                    } else {
                        console.error('❌ Função abrirModalImagem não encontrada');
                    }
                };
                fotosContainer.appendChild(img);
            });

            // Insere antes do formulário de avaliação
            if (formAvaliacao) {
                secaoAvaliacao.insertBefore(fotosContainer, formAvaliacao);
            } else {
                secaoAvaliacao.appendChild(fotosContainer);
            }
        }
    }
    // Busca o nome do serviço de várias fontes
    async function obterNomeServicoParaAvaliacao() {
        console.log('🔍 Buscando nome do serviço para avaliação...');
        
        // 1. Tenta da URL primeiro
        let nomeServico = urlParams.get('servico') || urlParams.get('titulo') || '';
        if (nomeServico && nomeServico !== 'Serviço concluído') {
            console.log('✅ Nome do serviço encontrado na URL:', nomeServico);
            return nomeServico;
        }
        
        // 2. Tenta do localStorage (mas ignora placeholders)
        const ultimoServicoNome = localStorage.getItem('ultimoServicoNome');
        const ultimaDescricaoPedido = localStorage.getItem('ultimaDescricaoPedido');
        const ultimaCategoriaPedido = localStorage.getItem('ultimaCategoriaPedido');
        
        // Limpa valores inválidos do localStorage
        if (ultimoServicoNome === 'Serviço concluído' || ultimoServicoNome === 'Serviço prestado') {
            localStorage.removeItem('ultimoServicoNome');
        }
        if (ultimaDescricaoPedido === 'Serviço concluído' || ultimaDescricaoPedido === 'Serviço prestado') {
            localStorage.removeItem('ultimaDescricaoPedido');
        }
        
        nomeServico = '';
        if (ultimoServicoNome && ultimoServicoNome !== 'Serviço concluído' && ultimoServicoNome !== 'Serviço prestado' && ultimoServicoNome.trim()) {
            nomeServico = ultimoServicoNome;
        } else if (ultimaDescricaoPedido && ultimaDescricaoPedido !== 'Serviço concluído' && ultimaDescricaoPedido !== 'Serviço prestado' && ultimaDescricaoPedido.trim()) {
            nomeServico = ultimaDescricaoPedido;
        } else if (ultimaCategoriaPedido && ultimaCategoriaPedido !== 'Serviço concluído' && ultimaCategoriaPedido !== 'Serviço prestado' && ultimaCategoriaPedido.trim()) {
            nomeServico = ultimaCategoriaPedido;
        }
        
        if (nomeServico) {
            console.log('✅ Nome do serviço encontrado no localStorage:', nomeServico);
            return nomeServico;
        }
        
        // 3. Busca do pedido se tiver pedidoId ou serviceScopeId
        const pedidoIdRaw = urlParams.get('pedidoId') || localStorage.getItem('pedidoIdUltimoServicoConcluido');
        const pedidoIdFromUrl = pedidoIdRaw ? String(pedidoIdRaw).match(/[a-fA-F0-9]{24}/)?.[0] : null;
        // Usa serviceScopeId como fallback se não tiver pedidoId na URL
        const pedidoId = pedidoIdFromUrl || (serviceScopeId ? String(serviceScopeId).match(/[a-fA-F0-9]{24}/)?.[0] : null);
        console.log('🔍 PedidoId encontrado:', pedidoId);
        console.log('🔍 serviceScopeId:', serviceScopeId);
        
        if (pedidoId) {
            try {
                const nomeCache = localStorage.getItem(`nomeServico:${pedidoId}`);
                if (nomeCache) {
                    console.log('✅ Nome do serviço encontrado no cache do pedido:', nomeCache);
                    return nomeCache;
                }
                
                console.log('🌐 Buscando nome do serviço da API do pedido:', pedidoId);
                const resp = await fetch(`/api/pedidos-urgentes/${pedidoId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    // A resposta pode vir como { pedido: {...} } ou diretamente como pedido
                    const pedido = data?.pedido || data;
                    console.log('📦 Resposta completa da API:', JSON.stringify(data, null, 2));
                    console.log('📦 Pedido extraído:', JSON.stringify(pedido, null, 2));
                    console.log('📦 Campos disponíveis:', Object.keys(pedido || {}));
                    console.log('📦 pedido.servico:', pedido?.servico);
                    console.log('📦 pedido.titulo:', pedido?.titulo);
                    console.log('📦 pedido.descricao:', pedido?.descricao);
                    
                    nomeServico = pedido?.servico || 
                                 pedido?.titulo || 
                                 pedido?.descricao || 
                                 pedido?.nome ||
                                 pedido?.categoria ||
                                 '';
                    console.log('📦 Nome do serviço extraído:', nomeServico);
                    
                    if (nomeServico && nomeServico.trim()) {
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        localStorage.setItem(`nomeServico:${pedidoId}`, nomeServico);
                        console.log('✅ Nome do serviço salvo:', nomeServico);
                        return nomeServico;
                    } else {
                        console.warn('⚠️ Nome do serviço está vazio ou inválido');
                    }
                } else {
                    console.warn('⚠️ Erro ao buscar pedido:', resp.status, resp.statusText);
                    const errorText = await resp.text();
                    console.warn('⚠️ Resposta de erro:', errorText);
                }
            } catch (e) {
                console.error('❌ Erro ao buscar nome do serviço do pedido:', e);
            }
        }
        
        // 4. Busca do agendamento se tiver agendamentoId
        const agendamentoId = agendamentoIdAvaliacao || urlParams.get('agendamentoId') || urlParams.get('agendamento');
        console.log('🔍 AgendamentoId encontrado:', agendamentoId);
        
        if (agendamentoId) {
            try {
                console.log('🌐 Buscando nome do serviço da API do agendamento');
                // Busca da lista de agendamentos do cliente e filtra pelo ID
                const resp = await fetch(`/api/agenda/cliente`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const agendamento = data?.agendamentos?.find(a => 
                        a._id === agendamentoId || 
                        String(a._id) === String(agendamentoId)
                    );
                    console.log('📅 Agendamento encontrado:', agendamento);
                    nomeServico = agendamento?.servico || '';
                    if (nomeServico) {
                        localStorage.setItem('ultimoServicoNome', nomeServico);
                        console.log('✅ Nome do serviço do agendamento salvo:', nomeServico);
                        return nomeServico;
                    }
                } else {
                    console.warn('⚠️ Erro ao buscar agendamentos:', resp.status, resp.statusText);
                }
            } catch (e) {
                console.error('❌ Erro ao buscar nome do serviço do agendamento:', e);
            }
        }
        
        console.warn('⚠️ Nome do serviço não encontrado em nenhuma fonte');
        return '';
    }
    
    // Variável que será atualizada quando o nome do serviço for obtido
    let servicoNomeAvaliacao = 'Serviço concluído';
    
    // Flag para evitar criar múltiplos lembretes
    let lembreteCriado = false;

    async function abrirLembreteAvaliacao() {
        console.log('📝 abrirLembreteAvaliacao chamado, lembreteCriado:', lembreteCriado);
        
        // Busca o modal flutuante
        const modalLembrete = document.getElementById('modal-lembrete-avaliacao');
        const conteudoLembrete = document.getElementById('conteudo-lembrete-avaliacao');
        
        if (!modalLembrete || !conteudoLembrete) {
            console.error('❌ Modal de lembrete não encontrado no DOM');
            return;
        }
        
        // Verifica se o modal já está aberto
        if (!modalLembrete.classList.contains('hidden')) {
            console.log('⚠️ Modal de lembrete já está aberto, não criando novo');
            return;
        }
        
        // Limpa o conteúdo anterior
        conteudoLembrete.innerHTML = '';
        
        // IMPORTANTE: Remove mensagem "perfil já avaliado" se existir quando abre lembrete
        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
        if (secaoAvaliacoesVerificadas) {
            const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
            if (h3Titulo) {
                const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                if (mensagemAntiga) {
                    mensagemAntiga.remove();
                    console.log('✅ Mensagem "perfil já avaliado" removida ao abrir lembrete');
                }
            }
        }
        
        // Busca o nome do serviço antes de criar o lembrete
        console.log('📝 Abrindo lembrete de avaliação, buscando nome do serviço...');
        lembreteCriado = true;
        const nomeServico = await obterNomeServicoParaAvaliacao();
        servicoNomeAvaliacao = nomeServico || 'Serviço concluído';
        console.log('📝 Nome do serviço para exibição:', servicoNomeAvaliacao);
        
        // Busca todas as fotos do pedido via API
        let fotosPedido = null;
        if (pedidoIdAvaliacaoLimpo) {
            fotosPedido = await buscarFotosPedido(pedidoIdAvaliacaoLimpo);
        }

        // Se não encontrou via API, tenta usar a foto do cache
        if (!fotosPedido || fotosPedido.length === 0) {
        if (!fotoServicoAvaliacao) {
            // Tenta capturar alguma foto já renderizada na página (pedidos/propostas)
            const fotoPage = tentarCapturarFotoDaPagina();
            if (fotoPage) {
                fotoServicoAvaliacao = fotoPage;
                    fotosPedido = [fotoPage];
                }
            } else {
                fotosPedido = [fotoServicoAvaliacao];
            }
        }

        if (!fotosPedido || fotosPedido.length === 0) {
            logSemFoto();
        }

        // Limpa qualquer lembrete anterior
        const lembreteExistente = secaoAvaliacao?.querySelector('.lembrete-avaliacao');
        if (lembreteExistente) {
            lembreteExistente.remove();
        }

        // Cria o card do lembrete dentro da seção de avaliação
        const card = document.createElement('div');
        card.className = 'lembrete-avaliacao';
        card.style.background = 'var(--bg-secondary, #111827)';
        card.style.border = '1px solid var(--border-color, #1f2937)';
        card.style.borderRadius = '12px';
        card.style.padding = '20px';
        card.style.width = '100%';
        card.style.marginBottom = '20px';
        card.style.color = 'var(--text-primary, #e5e7eb)';
        card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '15px';

        const title = document.createElement('h3');
        title.textContent = 'Avalie o serviço concluído';
        title.style.margin = '0';
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.gap = '8px';
        title.innerHTML = '📷 Avalie o serviço concluído';

        const desc = document.createElement('p');
        desc.style.margin = '0';
        desc.style.color = 'var(--text-secondary, #9ca3af)';
        desc.textContent = servicoNomeAvaliacao;

        const imgWrapper = document.createElement('div');
        imgWrapper.style.width = '100%';
        imgWrapper.style.borderRadius = '10px';
        imgWrapper.style.border = '1px solid var(--border-color, #1f2937)';
        imgWrapper.style.overflow = 'hidden';
        imgWrapper.style.background = 'rgba(255,255,255,0.03)';
        imgWrapper.style.display = 'flex';
        imgWrapper.style.flexWrap = 'wrap';
        imgWrapper.style.gap = '5px';
        imgWrapper.style.padding = '5px';
        imgWrapper.style.marginTop = '6px';

        const imgFallback = document.createElement('div');
        imgFallback.style.width = '100%';
        imgFallback.style.height = '180px';
        imgFallback.style.display = 'flex';
        imgFallback.style.alignItems = 'center';
        imgFallback.style.justifyContent = 'center';
        imgFallback.style.color = 'var(--text-secondary, #9ca3af)';
        imgFallback.style.fontSize = '13px';
        imgFallback.textContent = 'Foto do serviço não disponível';

        if (fotosPedido && fotosPedido.length > 0) {
            imgFallback.style.display = 'none';
            fotosPedido.forEach((foto, idx) => {
                const img = document.createElement('img');
                if (fotosPedido.length > 1) {
                    // Múltiplas fotos: mostra em miniatura
                    img.style.width = 'calc(50% - 2.5px)';
                    img.style.maxWidth = '150px';
                    img.style.height = '100px';
                } else {
                    // Uma foto: mostra grande
                    img.style.width = '100%';
                    img.style.maxHeight = '260px';
                }
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                img.style.cursor = 'pointer';
                img.alt = `Foto do serviço ${idx + 1}`;
                img.src = foto;
                img.className = 'foto-pedido-clickable';
                img.dataset.fotoUrl = foto;
            img.onerror = () => {
                img.style.display = 'none';
            };
                img.onclick = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(foto);
        } else {
                        console.error('❌ Função abrirModalImagem não encontrada');
                    }
                };
                imgWrapper.appendChild(img);
            });
        } else {
            imgFallback.style.display = 'flex';
        }

        // Mini form de avaliação direto no lembrete
        const starsWrap = document.createElement('div');
        starsWrap.style.display = 'flex';
        starsWrap.style.gap = '8px';
        starsWrap.style.fontSize = '26px';
        starsWrap.style.cursor = 'pointer';
        starsWrap.style.userSelect = 'none';
        let selectedStar = 0;

        function renderStars(value) {
            Array.from(starsWrap.children).forEach((el) => {
                const val = Number(el.dataset.value);
                el.textContent = val <= value ? '★' : '☆';
                el.style.color = val <= value ? '#fbbf24' : 'var(--text-secondary, #9ca3af)';
            });
        }

        for (let i = 1; i <= 5; i++) {
            const s = document.createElement('span');
            s.dataset.value = String(i);
            s.textContent = '☆';
            s.addEventListener('click', () => {
                selectedStar = i;
                renderStars(selectedStar);
                if (formAvaliacao) formAvaliacao.dataset.value = String(selectedStar);
                if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${selectedStar} estrela(s).`;
            });
            starsWrap.appendChild(s);
        }

        const textarea = document.createElement('textarea');
        textarea.style.width = '100%';
        textarea.style.minHeight = '80px';
        textarea.style.resize = 'vertical';
        textarea.style.background = 'var(--bg-secondary, #111827)';
        textarea.style.color = 'var(--text-primary, #e5e7eb)';
        textarea.style.border = '1px solid var(--border-color, #1f2937)';
        textarea.style.borderRadius = '8px';
        textarea.style.padding = '10px';
        textarea.placeholder = 'Descreva como foi o serviço...';

        const hint = document.createElement('div');
        hint.style.fontSize = '13px';
        hint.style.color = 'var(--text-secondary, #9ca3af)';
        hint.textContent = 'Selecione as estrelas e envie sua avaliação aqui mesmo.';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '10px';

        const btnFechar = document.createElement('button');
        btnFechar.textContent = 'Fechar';
        btnFechar.style.padding = '10px 14px';
        btnFechar.style.background = 'var(--bg-secondary, #111827)';
        btnFechar.style.color = 'var(--text-primary, #e5e7eb)';
        btnFechar.style.border = '1px solid var(--border-color, #1f2937)';
        btnFechar.style.borderRadius = '8px';
        btnFechar.style.cursor = 'pointer';

        const btnIr = document.createElement('button');
        btnIr.textContent = 'Enviar avaliação';
        btnIr.style.padding = '10px 14px';
        btnIr.style.background = '#22c55e';
        btnIr.style.color = '#0b121f';
        btnIr.style.border = 'none';
        btnIr.style.borderRadius = '8px';
        btnIr.style.cursor = 'pointer';
        btnIr.style.fontWeight = '700';
        btnIr.addEventListener('click', () => {
            if (!selectedStar) {
                alert('Selecione a nota (estrelas) antes de enviar.');
                return;
            }
            if (formAvaliacao) formAvaliacao.dataset.value = String(selectedStar);
            if (notaSelecionada) notaSelecionada.textContent = `Você selecionou ${selectedStar} estrela(s).`;
            if (comentarioAvaliacaoInput) comentarioAvaliacaoInput.value = textarea.value;
            // dispara o mesmo fluxo do botão original
            if (btnEnviarAvaliacao) {
                btnEnviarAvaliacao.click();
            }
            // Após enviar via lembrete, evita reabrir
            // Usa os IDs da URL (não do localStorage) quando vem de notificação
            const pedidoIdParaMarcar = pedidoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            const agendamentoIdParaMarcar = agendamentoIdAvaliacao; // SEMPRE da URL quando vem de notificação
            marcarAvaliacaoFeita(selectedStar, pedidoIdParaMarcar || null, agendamentoIdParaMarcar || null);
            
            // Fecha o modal flutuante
            const modalLembrete = document.getElementById('modal-lembrete-avaliacao');
            if (modalLembrete) {
                modalLembrete.classList.add('hidden');
                document.body.style.overflow = '';
            }
        });

        // Função para fechar o modal (declarada antes de ser usada)
        const fecharModalLembrete = () => {
            modalLembrete.classList.add('hidden');
            modalLembrete.style.display = 'none';
            modalLembrete.style.opacity = '0';
            modalLembrete.style.visibility = 'hidden';
            document.body.style.overflow = '';
            console.log('✅ Modal de lembrete fechado');
        };
        
        // Adiciona listener ao botão Fechar do card
        btnFechar.addEventListener('click', fecharModalLembrete);

        actions.appendChild(btnFechar);
        actions.appendChild(btnIr);

        card.appendChild(title);
        card.appendChild(desc);
        imgWrapper.appendChild(imgFallback);
        card.appendChild(imgWrapper);
        card.appendChild(starsWrap);
        card.appendChild(textarea);
        card.appendChild(hint);
        card.appendChild(actions);

        // Insere o card dentro do modal flutuante
        conteudoLembrete.appendChild(card);
        
        // Adiciona listener ao botão X do modal se existir
        const btnFecharLembrete = document.getElementById('btn-fechar-lembrete-avaliacao');
        if (btnFecharLembrete) {
            btnFecharLembrete.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation();
                fecharModalLembrete();
            };
        }
        
        // Fecha modal ao clicar no overlay (fora do conteúdo)
        const fecharModalOverlay = (e) => {
            if (e.target === modalLembrete || e.target.id === 'modal-lembrete-avaliacao') {
                fecharModalLembrete();
            }
        };
        
        // Remove listener anterior se existir e adiciona novo
        modalLembrete.removeEventListener('click', fecharModalOverlay);
        modalLembrete.addEventListener('click', fecharModalOverlay);
        
        // Abre o modal flutuante
        modalLembrete.classList.remove('hidden');
        modalLembrete.style.display = 'flex';
        modalLembrete.style.opacity = '1';
        modalLembrete.style.visibility = 'visible';
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal flutuante de lembrete aberto');
    }

    // Função para mostrar mensagem quando já avaliou (na seção de avaliações verificadas)
    // Só mostra se veio de notificação de serviço concluído E realmente já avaliou
    async function mostrarMensagemAvaliado() {
        // Só mostra se veio de notificação de serviço concluído
        if (!veioDeNotificacao) {
            console.log('📝 Não veio de notificação, não mostra mensagem');
            // Apenas esconde a seção de avaliação
            if (secaoAvaliacao) {
                secaoAvaliacao.style.display = 'none';
            }
            return;
        }
        
        // Verifica se realmente já avaliou este serviço específico antes de mostrar a mensagem
        const jaAvaliou = await avaliacaoJaFeita();
        if (!jaAvaliou) {
            console.log('⚠️ Veio de notificação mas NÃO avaliou ainda - não mostra mensagem "perfil já avaliado"');
            return; // Não mostra a mensagem se não avaliou
        }
        
        console.log('📝 Mostrando mensagem de perfil já avaliado (veio de notificação e realmente avaliou)...');
        
        // IMPORTANTE: Remove qualquer lembrete existente quando já avaliou
        if (secaoAvaliacao) {
            const lembreteExistente = secaoAvaliacao.querySelector('.lembrete-avaliacao');
            if (lembreteExistente) {
                lembreteExistente.remove();
                console.log('✅ Lembrete removido - já avaliou');
            }
            
            // Mantém a seção visível, apenas esconde o formulário se existir
            if (formAvaliacao) {
                formAvaliacao.style.display = 'none';
            }
            console.log('✅ Formulário escondido, mas seção mantida visível');
        }
        
        // REMOVIDO: Não carrega mais as avaliações aqui
        // Isso estava causando carregamento duplo após enviar avaliação verificada
        // Apenas mostra a mensagem sem recarregar
        if (profileId) {
            // Mostra a mensagem pequena no título h3 sem recarregar avaliações
            const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
            const h3Titulo = secaoAvaliacoesVerificadas?.querySelector('h3');
            
            if (secaoAvaliacoesVerificadas && h3Titulo) {
                // Remove mensagem antiga se existir
                const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                if (mensagemAntiga) {
                    mensagemAntiga.remove();
                }
                
                // Cria mensagem pequena no h3, ao lado do badge "Cliente Verificado"
                const mensagemEl = document.createElement('span');
                mensagemEl.className = 'mensagem-avaliado-pequena';
                mensagemEl.style.cssText = 'color: #ffc107; font-size: 12px; font-weight: 600; margin-left: 10px; display: inline-flex; align-items: center; gap: 4px;';
                mensagemEl.innerHTML = '<span style="color: #28a745;">✓</span> Perfil já avaliado';
                h3Titulo.appendChild(mensagemEl);
            }
        }
    }

    // Flag para garantir que o modal só seja aberto uma vez
    let modalAvaliacaoAberto = false;
    
    // Garante que a seção comece oculta por padrão
    if (secaoAvaliacao) {
        secaoAvaliacao.style.display = 'none';
    }
    
    // Se tem hash de avaliação OU veio de notificação, sempre processa como fluxo de serviço
    if ((hashSecaoAvaliacao || veioDeNotificacao || isFluxoServico) && secaoAvaliacao) {
        console.log('🔍 Processando como fluxo de serviço/notificação:', {
            hashSecaoAvaliacao,
            veioDeNotificacao,
            isFluxoServico,
            origemAvaliacao
        });
        
        // Função auxiliar para carregar avaliações quando há hash #secao-avaliacao
        // Torna acessível globalmente para ser reutilizada após enviar avaliação
        window.carregarAvaliacoesComHash = async () => {
            const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
            if (!secaoAvaliacoesVerificadas) {
                console.error('❌ [SECAO-AVALIACAO] Elemento secao-avaliacoes-verificadas não encontrado');
                return;
            }
            
            secaoAvaliacoesVerificadas.style.display = 'block';
            
            // IMPORTANTE: Carrega as avaliações quando há hash #secao-avaliacao
            // SEMPRE força recarregar para garantir que mostra as avaliações mais recentes
            // PRIORIDADE: Quando vem de #secao-avaliacao, o ID do profissional avaliado vem na URL
            // Por isso, prioriza urlParams.get('id') sobre profileId (que pode ser o próprio perfil)
            // Se não tem id na URL, tenta extrair do pedido
            let idParaCarregar = urlParams.get('id') || profileId || loggedInUserId;
            
            // Se não encontrou id na URL e há pedidoId, busca o profissionalId do pedido
            // IMPORTANTE: Usa pedidoId da URL, localStorage ou variável pedidoIdAvaliacao
            const pedidoIdParaBuscar = urlParams.get('pedidoId') || 
                                      pedidoIdAvaliacao || 
                                      localStorage.getItem('pedidoIdUltimoServicoConcluido') || 
                                      null;
            
            if (!urlParams.get('id') && pedidoIdParaBuscar) {
                console.log('🔍 [SECAO-AVALIACAO] ID não encontrado na URL, buscando do pedido:', pedidoIdParaBuscar);
                try {
                    const response = await fetch(`/api/pedidos-urgentes/${pedidoIdParaBuscar}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const pedido = data?.pedido || data;
                        
                        // Busca a proposta aceita no array de propostas
                        let propostaAceita = null;
                        if (pedido?.propostas && Array.isArray(pedido.propostas)) {
                            // Primeiro tenta pela propostaSelecionada
                            if (pedido.propostaSelecionada) {
                                propostaAceita = pedido.propostas.find(prop => 
                                    String(prop._id) === String(pedido.propostaSelecionada)
                                );
                            }
                            // Se não encontrou, busca por status
                            if (!propostaAceita) {
                                propostaAceita = pedido.propostas.find(prop =>
                                    prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                                );
                            }
                        }
                        
                        if (propostaAceita) {
                            // Extrai o profissionalId da proposta aceita
                            let profissionalIdExtraido = propostaAceita.usuarioId || 
                                                         propostaAceita.profissionalId ||
                                                         null;
                            
                            // Se for objeto (populado), extrai o _id
                            if (profissionalIdExtraido && typeof profissionalIdExtraido === 'object' && profissionalIdExtraido._id) {
                                profissionalIdExtraido = profissionalIdExtraido._id;
                            }
                            
                            if (profissionalIdExtraido) {
                                idParaCarregar = String(profissionalIdExtraido);
                                console.log('✅ [SECAO-AVALIACAO] ProfissionalId extraído do pedido:', idParaCarregar);
                            } else {
                                console.warn('⚠️ [SECAO-AVALIACAO] Proposta aceita encontrada mas sem profissionalId/usuarioId válido');
                            }
                        } else {
                            console.warn('⚠️ [SECAO-AVALIACAO] Pedido não tem proposta aceita, usando profileId atual');
                        }
                    } else {
                        console.warn('⚠️ [SECAO-AVALIACAO] Erro ao buscar pedido, status:', response.status);
                    }
                } catch (error) {
                    console.error('❌ [SECAO-AVALIACAO] Erro ao buscar pedido:', error);
                }
            }
            
            console.log('🔵 [SECAO-AVALIACAO] IDs disponíveis:', {
                profileId: profileId,
                urlParamsId: urlParams.get('id'),
                loggedInUserId: loggedInUserId,
                idParaCarregar: idParaCarregar,
                pedidoIdAvaliacao: pedidoIdAvaliacao,
                prioridade: 'urlParams.get("id") > pedido.propostaAceita > profileId > loggedInUserId'
            });
            
            if (idParaCarregar) {
                try {
                    // Força recarregar sempre, mesmo se já foi carregado antes
                    // Passa true para forcarRecarregar para garantir que sempre busca as mais recentes
                    // IMPORTANTE: Isso garante que busca as avaliações mais recentes do servidor
                    await loadAvaliacoesVerificadas(idParaCarregar, true);
                    avaliacoesCarregadas = true;
                    
                    // Faz scroll até a seção após carregar
                    setTimeout(() => {
                        secaoAvaliacoesVerificadas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 300);
                } catch (error) {
                    console.error('❌ [SECAO-AVALIACAO] Erro ao carregar avaliações:', error);
                }
            } else {
                console.warn('⚠️ [SECAO-AVALIACAO] Não foi possível determinar o ID para carregar avaliações');
            }
        };
        
        // IMPORTANTE: Quando há hash #secao-avaliacao, garante que a seção de avaliações verificadas está visível
        if (hashSecaoAvaliacao) {
            // Aguarda um pouco para garantir que profileId está disponível
            setTimeout(() => {
                if (typeof window.carregarAvaliacoesComHash === 'function') {
                    window.carregarAvaliacoesComHash();
                }
            }, 200);
        }
        
        // IMPORTANTE: Listener para recarregar quando o hash mudar para #secao-avaliacao
        window.addEventListener('hashchange', () => {
            const novoHash = window.location.hash && window.location.hash.includes('secao-avaliacao');
            if (novoHash) {
                if (typeof window.carregarAvaliacoesComHash === 'function') {
                    window.carregarAvaliacoesComHash();
                }
            }
        });
        
        // Se veio de notificação OU tem hash de avaliação, SEMPRE esconde a seção (lembrete é flutuante)
        if (veioDeNotificacao || hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
            console.log('✅ Veio de notificação ou tem hash - escondendo seção (lembrete será flutuante)');
            // Esconde a seção quando vem de notificação - o lembrete será um modal flutuante
            secaoAvaliacao.style.display = 'none';
            
            // IMPORTANTE: Quando vem de notificação, SEMPRE esconde o formulário de avaliação geral
            // Apenas o lembrete flutuante deve aparecer
            if (formAvaliacao) {
                formAvaliacao.style.display = 'none';
                console.log('✅ Formulário de avaliação geral escondido (veio de notificação)');
            }
            
            // Verifica se já avaliou este serviço específico (assíncrono)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                console.log('🔍 Resultado da verificação de avaliação:', {
                    jaAvaliou,
                    pedidoIdAvaliacao,
                    agendamentoIdAvaliacao,
                    pedidoIdUltimoServicoConcluido,
                    agendamentoIdUltimoServico,
                    origemAvaliacao
                });
                
                if (jaAvaliou) {
                    console.log('✅ Já avaliou este serviço específico, mostrando mensagem mas mantendo seção visível');
                    // Já avaliou: mostra mensagem mas mantém seção visível
                    // IMPORTANTE: Remove qualquer lembrete existente quando já avaliou
                    if (secaoAvaliacao) {
                        const lembreteExistente = secaoAvaliacao.querySelector('.lembrete-avaliacao');
                        if (lembreteExistente) {
                            lembreteExistente.remove();
                            console.log('✅ Lembrete removido - já avaliou');
                        }
                    }
                    await mostrarMensagemAvaliado();
                    // Garante que o formulário está escondido
                    if (formAvaliacao) formAvaliacao.style.display = 'none';
                    // Garante que não há lembrete visível
                    modalAvaliacaoAberto = false; // Permite criar novo lembrete se necessário
                    
                    // IMPORTANTE: Quando há hash #secao-avaliacao, garante que a seção de avaliações verificadas está visível
                    if (hashSecaoAvaliacao) {
                        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                        if (secaoAvaliacoesVerificadas) {
                            secaoAvaliacoesVerificadas.style.display = 'block';
                            console.log('✅ Seção de avaliações verificadas exibida (hash #secao-avaliacao)');
                            
                            // IMPORTANTE: Carrega as avaliações quando há hash #secao-avaliacao
                            const idParaCarregar = profileId || urlParams.get('id') || loggedInUserId;
                            if (idParaCarregar) {
                                console.log('📋 Carregando avaliações verificadas para #secao-avaliacao (já avaliou), id:', idParaCarregar);
                                avaliacoesCarregadas = false; // Força recarregar
                                // Limpa o conteúdo anterior
                                const listaAvaliacoes = document.getElementById('lista-avaliacoes-verificadas');
                                if (listaAvaliacoes) {
                                    listaAvaliacoes.innerHTML = '';
                                }
                                // Passa true para forcarRecarregar
                                loadAvaliacoesVerificadas(idParaCarregar, true).then(() => {
                                    avaliacoesCarregadas = true;
                                    console.log('✅ Avaliações carregadas para #secao-avaliacao (já avaliou)');
                                }).catch((error) => {
                                    console.error('❌ Erro ao carregar avaliações para #secao-avaliacao (já avaliou):', error);
                                });
                            }

                            // Faz scroll até a seção após um pequeno delay para garantir que está renderizada
                            setTimeout(() => {
                                secaoAvaliacoesVerificadas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                console.log('✅ Scroll até seção de avaliações verificadas');
                            }, 300);
                        }
                    }
                } else {
                    console.log('✅ NÃO avaliou este serviço ainda - DEVE mostrar lembrete');
                    // IMPORTANTE: Só mostra lembrete se REALMENTE veio de notificação de serviço concluído
                    // Não mostra se foi uma visita normal (clicou no perfil pelo feed)
                    if (veioDeNotificacao && (hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido')) {
                        // Não avaliou: mostra lembrete (formulário já está escondido acima)
                        // IMPORTANTE: Remove mensagem "perfil já avaliado" se existir
                        const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                        if (secaoAvaliacoesVerificadas) {
                            const h3Titulo = secaoAvaliacoesVerificadas.querySelector('h3');
                            if (h3Titulo) {
                                const mensagemAntiga = h3Titulo.querySelector('.mensagem-avaliado-pequena');
                                if (mensagemAntiga) {
                                    mensagemAntiga.remove();
                                    console.log('✅ Mensagem "perfil já avaliado" removida - não avaliou ainda');
                                }
                            }
                        }
                        if (!modalAvaliacaoAberto) {
                            console.log('🚀 Chamando abrirLembreteAvaliacao()...');
                            modalAvaliacaoAberto = true;
                            // Garante que a seção está oculta (lembrete será flutuante)
                            if (secaoAvaliacao) {
                                secaoAvaliacao.style.display = 'none';
                                console.log('✅ Seção mantida oculta (lembrete será flutuante)');
                            }
                            
                            // IMPORTANTE: Quando há hash #secao-avaliacao, garante que a seção de avaliações verificadas está visível
                            if (hashSecaoAvaliacao) {
                                const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                                if (secaoAvaliacoesVerificadas) {
                                    secaoAvaliacoesVerificadas.style.display = 'block';
                                    console.log('✅ Seção de avaliações verificadas exibida (hash #secao-avaliacao)');
                                    
                                    // IMPORTANTE: Carrega as avaliações quando há hash #secao-avaliacao
                                    const idParaCarregar = profileId || urlParams.get('id') || loggedInUserId;
                                    if (idParaCarregar) {
                                        console.log('📋 Carregando avaliações verificadas para #secao-avaliacao (no lembrete), id:', idParaCarregar);
                                        avaliacoesCarregadas = false; // Força recarregar
                                        // Limpa o conteúdo anterior
                                        const listaAvaliacoes = document.getElementById('lista-avaliacoes-verificadas');
                                        if (listaAvaliacoes) {
                                            listaAvaliacoes.innerHTML = '';
                                        }
                                        // Passa true para forcarRecarregar
                                        loadAvaliacoesVerificadas(idParaCarregar, true).then(() => {
                                            avaliacoesCarregadas = true;
                                            console.log('✅ Avaliações carregadas para #secao-avaliacao (no lembrete)');
                                        }).catch((error) => {
                                            console.error('❌ Erro ao carregar avaliações para #secao-avaliacao (no lembrete):', error);
                                        });
                                    }

                                    // Faz scroll até a seção após um pequeno delay para garantir que está renderizada
                                    setTimeout(() => {
                                        secaoAvaliacoesVerificadas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        console.log('✅ Scroll até seção de avaliações verificadas');
                                    }, 300);
                                }
                            }

                            await abrirLembreteAvaliacao();
                            console.log('✅ abrirLembreteAvaliacao() concluído');
                        } else {
                            console.log('⚠️ modalAvaliacaoAberto já é true, não abrindo lembrete');
                            
                            // Mesmo se não abrir lembrete, garante que a seção está visível se há hash
                            if (hashSecaoAvaliacao) {
                                const secaoAvaliacoesVerificadas = document.getElementById('secao-avaliacoes-verificadas');
                                if (secaoAvaliacoesVerificadas) {
                                    secaoAvaliacoesVerificadas.style.display = 'block';
                                    setTimeout(() => {
                                        secaoAvaliacoesVerificadas.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 300);
                                }
                            }
                        }
                    } else {
                        console.log('⚠️ Não veio de notificação - não abrindo lembrete flutuante');
                        // Se não veio de notificação, apenas mostra a seção de avaliação normalmente
                        if (secaoAvaliacao) {
        secaoAvaliacao.style.display = 'block';
                        }
                    }
                }
            })();
        } else if (temParametrosExplicitos && veioDeNotificacao) {
            // Tem parâmetros explícitos E veio de notificação (caso raro mas válido)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                if (!jaAvaliou && !modalAvaliacaoAberto) {
                    secaoAvaliacao.style.display = 'block';
                    await renderizarFotosSecaoAvaliacao();
        if (formAvaliacao) formAvaliacao.style.display = 'none';
                    modalAvaliacaoAberto = true;
                    abrirLembreteAvaliacao();
                } else if (jaAvaliou) {
                    // Já avaliou: esconde seção de avaliação
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                }
            })();
        } else {
            // Verifica se já avaliou (assíncrono)
            (async () => {
                const jaAvaliou = await avaliacaoJaFeita();
                if (jaAvaliou) {
                    // Já avaliou: esconde seção de avaliação
                    secaoAvaliacao.style.display = 'none';
                    await mostrarMensagemAvaliado();
                }
            })();
        }
    } else if (secaoAvaliacao) {
        // Se tem hash de avaliação, não é visita normal - já foi processado acima
        if (hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
            console.log('🔍 Tem hash ou origem, não processando como visita normal');
            return;
        }
        
        // Visita normal: começa oculta e verifica se já avaliou (assíncrono)
        // IMPORTANTE: Só esconde se NÃO veio de notificação (para não esconder quando o lembrete está sendo mostrado)
        if (!veioDeNotificacao && !hashSecaoAvaliacao && origemAvaliacao !== 'servico_concluido') {
            secaoAvaliacao.style.display = 'none'; // Começa oculta apenas em visita normal
            console.log('✅ Visita normal - seção escondida');
        } else {
            console.log('⚠️ Veio de notificação - mantendo seção visível para mostrar lembrete');
        }
        
        (async () => {
            // IMPORTANTE: A seção já está oculta, só mostra se realmente não avaliou
            console.log('🔍 Iniciando verificação assíncrona para visita normal...');
            
            // Primeiro verifica storage (assíncrono)
            const jaAvaliouStorage = await avaliacaoJaFeita();
            
            if (jaAvaliouStorage) {
                console.log('✅ Visita normal - já avaliou (storage), mantendo seção OCULTA');
                secaoAvaliacao.style.display = 'none';
                await mostrarMensagemAvaliado();
                return;
            }
            
            // Se não tem no storage, verifica via API ANTES de mostrar
            console.log('🔍 Verificando via API se já avaliou este perfil...');
            const jaAvaliouAPI = await verificarAvaliacaoJaFeitaAPI();
            
            if (jaAvaliouAPI) {
                console.log('✅ Visita normal - já avaliou (API), mantendo seção OCULTA');
                secaoAvaliacao.style.display = 'none';
                await mostrarMensagemAvaliado();
            } else {
                // Só mostra se REALMENTE não avaliou E não for o próprio perfil E não veio de notificação
                if (!isOwnProfile && !veioDeNotificacao && !hashSecaoAvaliacao && origemAvaliacao !== 'servico_concluido') {
                    console.log('✅ Visita normal - PRIMEIRA VISITA confirmada, mostrando seção de avaliação');
        secaoAvaliacao.style.display = 'block';
                    // Renderiza as fotos do pedido
                    await renderizarFotosSecaoAvaliacao();
                    // Mostra o formulário também na primeira visita
                    if (formAvaliacao) formAvaliacao.style.display = 'block';
                } else if (veioDeNotificacao || hashSecaoAvaliacao || origemAvaliacao === 'servico_concluido') {
                    console.log('⚠️ Veio de notificação, não mostrando formulário de primeira visita');
                } else {
                    console.log('✅ Visita normal - próprio perfil, mantendo seção OCULTA');
                    secaoAvaliacao.style.display = 'none';
                }
            }
        })();
    }

    // REMOVIDO: Código duplicado - já está sendo processado acima no bloco principal
    // Isso estava causando duplicação de processamento e problemas na exibição

    // Bloqueia avaliação geral se já feita nesta sessão (exceto fluxo de serviço concluído)
    (async () => {
        if (!(await avaliacaoLiberadaGeral())) {
            await bloquearAvaliacaoGeral();
    }
    })();

    if (btnEnviarAvaliacao) {
        btnEnviarAvaliacao.addEventListener('click', async (e) => {
            console.log('🔴🔴🔴 BOTÃO DE ENVIAR AVALIAÇÃO CLICADO!');
            e.preventDefault();
            const estrelas = formAvaliacao.dataset.value;
            const comentario = comentarioAvaliacaoInput.value;

            console.log('🔴 Dados do formulário:', {
                estrelas,
                comentario: comentario?.substring(0, 50),
                formAvaliacao: formAvaliacao ? 'existe' : 'NÃO EXISTE',
                comentarioAvaliacaoInput: comentarioAvaliacaoInput ? 'existe' : 'NÃO EXISTE'
            });

            if (!estrelas || estrelas == 0) {
                console.warn('⚠️ Nenhuma estrela selecionada');
                alert('Por favor, selecione pelo menos uma estrela.');
                return;
            }

            // Verifica se já avaliou ANTES de enviar
            // IMPORTANTE: Quando vem de notificação, SEMPRE prioriza valores da URL
            const pedidoIdDaUrl = urlParams.get('pedidoId');
            const agendamentoIdDaUrl = urlParams.get('agendamentoId');
            const pedidoIdParaVerificar = pedidoIdDaUrl || pedidoIdAvaliacao || '';
            const agendamentoIdParaVerificar = agendamentoIdDaUrl || agendamentoIdAvaliacao || '';
            
            console.log('🔍 Verificação antes de enviar:', {
                isFluxoServico,
                veioDeNotificacao,
                origemAvaliacao,
                hashSecaoAvaliacao,
                pedidoIdDaUrl,
                agendamentoIdDaUrl,
                pedidoIdParaVerificar,
                agendamentoIdParaVerificar,
                pedidoIdAvaliacao,
                agendamentoIdAvaliacao
            });
            
            // Se é fluxo de serviço (vem de notificação ou tem hash)
            if (isFluxoServico) {
                // Se tem ID do serviço, verifica se já avaliou este serviço específico
                if (pedidoIdParaVerificar || agendamentoIdParaVerificar) {
                    console.log('🔍 Verificando avaliação específica do serviço antes de enviar...');
                    const jaAvaliouServico = await verificarAvaliacaoServicoEspecifico(pedidoIdParaVerificar, agendamentoIdParaVerificar);
                    console.log('🔍 Resultado da verificação:', jaAvaliouServico);
                    if (jaAvaliouServico) {
                        alert('Você já avaliou este serviço. Cada serviço só pode ser avaliado uma vez.');
                        return;
                    }
                    console.log('✅ Serviço ainda não avaliado - permitindo avaliação');
                } else {
                    // Se é fluxo de serviço mas não tem ID, não permite avaliar
                    console.error('❌ Erro: Fluxo de serviço sem ID do serviço');
                    console.error('❌ Detalhes:', {
                        isFluxoServico,
                        veioDeNotificacao,
                        origemAvaliacao,
                        pedidoIdDaUrl,
                        agendamentoIdDaUrl,
                        pedidoIdAvaliacao,
                        agendamentoIdAvaliacao
                    });
                    alert('Erro: Não foi possível identificar o serviço a ser avaliado. Por favor, use o link da notificação.');
                    return;
                }
            } else {
                // Se não é fluxo de serviço (visita normal), verifica avaliação geral
                const jaAvaliouGeral = await avaliacaoJaFeita();
                if (jaAvaliouGeral) {
                    alert('Você já avaliou este perfil. Para avaliar novamente, use o link enviado após concluir um serviço.');
                    return;
                }
            }

            try {
                let response;
                let data;

                // payload comum (inclui nome do serviço se disponível)
                // Busca o nome do serviço de várias fontes, incluindo a função assíncrona
                console.log('📤 Enviando avaliação, buscando nome do serviço...');
                console.log('📤 servicoNomeAvaliacao atual:', servicoNomeAvaliacao);
                console.log('📤 serviceScopeId:', serviceScopeId);
                console.log('📤 agendamentoIdAvaliacao:', agendamentoIdAvaliacao);
                console.log('📤 pedidoId da URL:', urlParams.get('pedidoId'));
                
                // IMPORTANTE: Declara pedidoUrgenteIdFinal ANTES de usar
                // Prioriza pedidoId da URL (vem diretamente da notificação)
                let pedidoUrgenteIdFinal = null;
                const pedidoIdDaUrl = urlParams.get('pedidoId');
                if (pedidoIdDaUrl) {
                    const pidClean = String(pedidoIdDaUrl).match(/[a-fA-F0-9]{24}/)?.[0];
                    if (pidClean) {
                        pedidoUrgenteIdFinal = pidClean;
                        console.log('📦 Usando pedidoUrgenteId da URL:', pedidoUrgenteIdFinal);
                    }
                }
                // Se não tem na URL mas tem na variável pedidoIdAvaliacao (vem de "Meus Pedidos Urgentes" ou localStorage)
                else if (pedidoIdAvaliacao) {
                    const pidClean = String(pedidoIdAvaliacao).match(/[a-fA-F0-9]{24}/)?.[0];
                    if (pidClean) {
                        pedidoUrgenteIdFinal = pidClean;
                        console.log('📦 Usando pedidoUrgenteId da variável (localStorage):', pedidoUrgenteIdFinal);
                    }
                }
                // Se não tem pedidoId, tenta do localStorage
                else {
                    const pedidoIdLocalStorage = localStorage.getItem('pedidoIdUltimoServicoConcluido');
                    if (pedidoIdLocalStorage) {
                        const pidClean = String(pedidoIdLocalStorage).match(/[a-fA-F0-9]{24}/)?.[0];
                        if (pidClean) {
                            pedidoUrgenteIdFinal = pidClean;
                            console.log('📦 Usando pedidoUrgenteId do localStorage:', pedidoUrgenteIdFinal);
                        }
                    }
                }
                
                let agendamentoIdFinal = agendamentoIdAvaliacao || '';
                
                let nomeServicoPayload = '';
                
                // IMPORTANTE: Prioriza buscar o nome do serviço do pedido específico (pedidoUrgenteIdFinal)
                // Isso garante que cada avaliação use o nome correto do seu próprio pedido
                if (pedidoUrgenteIdFinal) {
                    const pedidoIdClean = String(pedidoUrgenteIdFinal).match(/[a-fA-F0-9]{24}/)?.[0];
                    if (pedidoIdClean) {
                        try {
                            // Primeiro tenta do cache específico deste pedido
                            const nomeCache = localStorage.getItem(`nomeServico:${pedidoIdClean}`);
                            if (nomeCache && nomeCache.trim() && nomeCache !== 'Serviço concluído') {
                                nomeServicoPayload = nomeCache;
                                console.log('✅ Nome do serviço encontrado no cache do pedido:', nomeServicoPayload, 'pedidoId:', pedidoIdClean);
                            } else {
                                // Busca da API usando o pedidoUrgenteIdFinal
                                const resp = await fetch(`/api/pedidos-urgentes/${pedidoIdClean}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (resp.ok) {
                                    const data = await resp.json();
                                    const pedido = data?.pedido || data;
                                    nomeServicoPayload = pedido?.servico || 
                                                         pedido?.titulo || 
                                                         pedido?.descricao || 
                                                         pedido?.nome ||
                                                         pedido?.categoria ||
                                                         '';
                                    if (nomeServicoPayload && nomeServicoPayload.trim()) {
                                        // Salva no cache específico deste pedido
                                        localStorage.setItem(`nomeServico:${pedidoIdClean}`, nomeServicoPayload);
                                        console.log('✅ Nome do serviço encontrado da API do pedido:', nomeServicoPayload, 'pedidoId:', pedidoIdClean);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error('❌ Erro ao buscar nome do serviço do pedido:', e);
                        }
                    }
                }
                
                // Se ainda não encontrou e tem agendamentoId, tenta buscar do agendamento
                if (!nomeServicoPayload && agendamentoIdFinal) {
                    try {
                        const resp = await fetch(`/api/agenda/cliente`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            const agendamento = data?.agendamentos?.find(a => 
                                String(a._id) === String(agendamentoIdFinal)
                            );
                            if (agendamento?.servico) {
                                nomeServicoPayload = agendamento.servico;
                                console.log('✅ Nome do serviço encontrado do agendamento:', nomeServicoPayload);
                            }
                        }
                    } catch (e) {
                        console.error('❌ Erro ao buscar nome do serviço do agendamento:', e);
                    }
                }
                
                // Fallback apenas se não encontrou do pedido/agendamento específico
                if (!nomeServicoPayload || nomeServicoPayload.trim() === '') {
                    const nomeAsync = await obterNomeServicoParaAvaliacao();
                    if (nomeAsync && nomeAsync !== 'Serviço concluído') {
                        nomeServicoPayload = nomeAsync;
                        console.log('✅ Nome do serviço encontrado via busca assíncrona:', nomeServicoPayload);
                    } else {
                        // Último fallback: tenta da URL ou variáveis locais (não usa valores globais compartilhados)
                        nomeServicoPayload = servicoNomeAvaliacao && servicoNomeAvaliacao !== 'Serviço concluído' 
                            ? servicoNomeAvaliacao 
                            : urlParams.get('servico') || 
                              urlParams.get('titulo') ||
                              (serviceScopeId ? localStorage.getItem(`nomeServico:${serviceScopeId}`) : '') ||
                              '';
                        console.log('📤 Nome do serviço do fallback:', nomeServicoPayload);
                    }
                }
                
                console.log('📤 Nome do serviço final para envio:', nomeServicoPayload);
                console.log('📤 IDs finais:', {
                    pedidoUrgenteIdFinal,
                    agendamentoIdFinal,
                    pedidoIdDaUrl: urlParams.get('pedidoId'),
                    pedidoIdAvaliacao
                });
                console.log('📤 Payload completo que será enviado:', {
                    profissionalId: profileId,
                    agendamentoId: agendamentoIdFinal,
                    pedidoUrgenteId: pedidoUrgenteIdFinal,
                    estrelas: parseInt(estrelas, 10),
                    servico: nomeServicoPayload
                });

                // Avaliação verificada (veio de serviço concluído)
                // IMPORTANTE: pedidoUrgenteIdFinal e agendamentoIdFinal já foram declarados acima
                
                // Se não tem pedidoId mas tem agendamentoId, usa ele (serviço agendado)
                if (!pedidoUrgenteIdFinal && agendamentoIdFinal) {
                    console.log('📦 Usando agendamentoId:', agendamentoIdFinal);
                }
                
                console.log('📦 IDs finais para avaliação verificada:', {
                    pedidoUrgenteIdFinal,
                    agendamentoIdFinal,
                    pedidoIdDaUrl,
                    pedidoIdAvaliacao,
                    agendamentoIdAvaliacao
                });
                
                // Cria avaliação verificada se tem agendamentoId OU pedidoUrgenteId
                console.log('🔍 Verificando se deve criar avaliação verificada:', {
                    isFluxoServico,
                    veioDeNotificacao,
                    agendamentoIdFinal,
                    pedidoUrgenteIdFinal,
                    pedidoIdDaUrl,
                    origemAvaliacao,
                    hashSecaoAvaliacao,
                    token: token ? token.substring(0, 20) + '...' : 'NENHUM TOKEN',
                    profileId
                });
                
                // Validação do token
                if (!token) {
                    console.error('❌ Token não encontrado no localStorage!');
                    alert('Erro: Você precisa estar logado para avaliar. Por favor, faça login novamente.');
                    window.location.href = '/login';
                    return;
                }
                
                // Se é fluxo de serviço, DEVE ter pedidoId ou agendamentoId
                // Verifica novamente após processar os IDs (pode ter vindo do localStorage)
                if (isFluxoServico) {
                    if (!agendamentoIdFinal && !pedidoUrgenteIdFinal) {
                        console.error('❌ Erro: Fluxo de serviço sem ID do serviço');
                        console.error('❌ Detalhes:', {
                            isFluxoServico,
                            veioDeNotificacao,
                            origemAvaliacao,
                            pedidoIdDaUrl: urlParams.get('pedidoId'),
                            agendamentoIdDaUrl: urlParams.get('agendamentoId'),
                            pedidoIdAvaliacao,
                            agendamentoIdAvaliacao,
                            agendamentoIdFinal,
                            pedidoUrgenteIdFinal
                        });
                        alert('Erro: Não foi possível identificar o serviço a ser avaliado. Por favor, use o link da notificação.');
                        return;
                    }
                }
                
                if (isFluxoServico && (agendamentoIdFinal || pedidoUrgenteIdFinal)) {
                    const payload = {
                        profissionalId: profileId,
                        estrelas: parseInt(estrelas, 10),
                        comentario: comentario,
                        dataServico: new Date().toISOString(),
                        servico: nomeServicoPayload
                    };
                    
                    // Adiciona agendamentoId ou pedidoUrgenteId conforme disponível
                    if (agendamentoIdFinal) {
                        payload.agendamentoId = agendamentoIdFinal;
                        console.log('✅ Adicionando agendamentoId ao payload:', agendamentoIdFinal);
                    }
                    if (pedidoUrgenteIdFinal) {
                        payload.pedidoUrgenteId = pedidoUrgenteIdFinal;
                        console.log('✅ Adicionando pedidoUrgenteId ao payload:', pedidoUrgenteIdFinal);
                    }
                    console.log('📤 Enviando avaliação verificada com payload:', JSON.stringify(payload, null, 2));
                    console.log('📤 Nome do serviço no payload:', payload.servico);
                    console.log('📤 pedidoUrgenteId no payload:', payload.pedidoUrgenteId);
                    console.log('🔑 Token sendo usado:', token ? token.substring(0, 20) + '...' : 'NENHUM TOKEN');
                    
                    response = await fetch('/api/avaliacao-verificada', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    console.log('📥 Resposta do servidor:', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok
                    });
                    
                    const responseText = await response.text();
                    console.log('📥 Resposta (texto):', responseText);
                    
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        console.error('❌ Erro ao parsear resposta JSON:', e);
                        throw new Error('Resposta inválida do servidor');
                    }
                    
                    console.log('📥 Resposta (JSON):', data);
                    
                    if (!response.ok) {
                        console.error('❌ Erro na resposta:', {
                            status: response.status,
                            data: data
                        });
                        throw new Error(data.message || 'Erro ao enviar avaliação verificada.');
                    }
                    
                    console.log('✅ Avaliação enviada com sucesso!', data);
                    localStorage.setItem('ultimaAvaliacaoClienteId', loggedInUserId || '');
                    if (nomeServicoPayload) {
                        localStorage.setItem('ultimaAvaliacaoServico', nomeServicoPayload);
                        // Cacheia também com o ID do pedido/agendamento para uso futuro
                        if (pedidoUrgenteIdFinal) {
                            localStorage.setItem(`nomeServico:${pedidoUrgenteIdFinal}`, nomeServicoPayload);
                        }
                        if (agendamentoIdFinal) {
                            localStorage.setItem(`nomeServico:${agendamentoIdFinal}`, nomeServicoPayload);
                        }
                    }
                    
                    // Mostra toast de sucesso
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = '<span class="check-animado">✔</span> Perfil Avaliado';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);
                    
                    // Marca como avaliado - passa os IDs do serviço que foi avaliado
                    marcarAvaliacaoFeita(estrelas, pedidoUrgenteIdFinal || null, agendamentoIdFinal || null);
                    
                    // Esconde a seção de avaliação e mostra mensagem nas avaliações verificadas
                    await mostrarMensagemAvaliado();
                    
                    // REMOVIDO: Não recarrega mais as avaliações após enviar
                    // Apenas redireciona para o feed após avaliar
                    
                    // Se veio de pedido urgente, redireciona para o feed
                    if (pedidoUrgenteIdFinal) {
                        // Redireciona imediatamente para o feed sem recarregar nada
                        setTimeout(() => {
                            window.location.href = '/index.html';
                        }, 500);
                    }
                } else {
                    console.warn('⚠️ NÃO está criando avaliação verificada porque:', {
                        isFluxoServico,
                        agendamentoIdFinal,
                        pedidoUrgenteIdFinal,
                        motivo: !isFluxoServico ? 'isFluxoServico é false' : (!agendamentoIdFinal && !pedidoUrgenteIdFinal ? 'Não tem agendamentoId nem pedidoUrgenteId' : 'Desconhecido')
                    });
                    
                    // Se é fluxo de serviço mas não tem ID, não permite avaliar
                    if (isFluxoServico && !agendamentoIdFinal && !pedidoUrgenteIdFinal) {
                        alert('Erro: Não foi possível identificar o serviço a ser avaliado. Por favor, use o link da notificação.');
                        return;
                    }
                    
                    // Bloqueio: só 1 avaliação geral por visita/sessão (apenas para visitas normais, não fluxo de serviço)
                    if (!isFluxoServico) {
                        const jaAvaliouGeral = await avaliacaoJaFeita();
                        if (jaAvaliouGeral) {
                            alert('Você já avaliou este perfil. Para avaliar novamente, use o link enviado após concluir um serviço.');
                            return;
                        }
                    } else {
                        // Se é fluxo de serviço mas não tem ID, não permite
                        alert('Erro: Não foi possível identificar o serviço a ser avaliado. Por favor, use o link da notificação.');
                        return;
                    }

                    // Avaliação geral do trabalhador (só para visitas normais, não fluxo de serviço)
                    response = await fetch('/api/avaliar-trabalhador', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            trabalhadorId: profileId,
                            estrelas: parseInt(estrelas, 10),
                            comentario: comentario,
                            servico: nomeServicoPayload
                        })
                    });
                    data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro ao enviar avaliação.');
                    
                    // Mostra toast de sucesso
                    const toast = document.createElement('div');
                    toast.className = 'toast-sucesso';
                    toast.innerHTML = '<span class="check-animado">✔</span> Perfil Avaliado';
                    document.body.appendChild(toast);
                    setTimeout(() => toast.classList.add('show'), 10);
                    setTimeout(() => toast.remove(), 2500);
                    
                    // Marca bloqueio na sessão/localStorage - usa IDs do localStorage se não estiverem na URL
                    const pedidoIdParaMarcar = pedidoIdAvaliacao || pedidoIdUltimoServicoConcluido;
                    const agendamentoIdParaMarcar = agendamentoIdAvaliacao || agendamentoIdUltimoServico;
                    marcarAvaliacaoFeita(estrelas, pedidoIdParaMarcar || null, agendamentoIdParaMarcar || null);
                    localStorage.setItem('ultimaAvaliacaoClienteId', loggedInUserId || '');
                    if (nomeServicoPayload) localStorage.setItem('ultimaAvaliacaoServico', nomeServicoPayload);
                    
                    // Esconde a seção de avaliação e mostra mensagem nas avaliações verificadas
                    await mostrarMensagemAvaliado();
                    
                    // Recarrega as avaliações verificadas para mostrar a nova avaliação
                    if (profileId) {
                        loadAvaliacoesVerificadas(profileId);
                    }
                    // Guarda a última avaliação geral para exibir no quadro de verificadas quando não houver outras
                    try {
                    const cacheKey = `ultimaAvaliacaoGeral:${profileId}:${loggedInUserId || ''}`;
                    const nomeViewer = (localStorage.getItem('userName') || 'Você').trim();
                    const fotoViewer = localStorage.getItem('userPhotoUrl') || 'imagens/default-user.png';
                    const servicoNomeLink =
                        urlParams.get('servico') ||
                        urlParams.get('titulo') ||
                        localStorage.getItem('ultimoServicoNome') ||
                        localStorage.getItem('ultimaDescricaoPedido') ||
                        localStorage.getItem('ultimaCategoriaPedido') ||
                        localStorage.getItem('ultimaDemanda') ||
                        'Serviço concluído';
                        const cacheObj = {
                            clienteId: { _id: loggedInUserId || '', nome: nomeViewer, avatarUrl: fotoViewer },
                            estrelas: parseInt(estrelas, 10),
                            comentario,
                            dataServico: new Date().toISOString(),
                            agendamentoId: { servico: servicoNomeLink },
                            servico: servicoNomeLink,
                            servicoNome: servicoNomeLink,
                            origemLocal: true
                        };
                        localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
                    } catch (e) {
                        console.warn('Falha ao salvar cache da avaliação local:', e);
                    }
                    await bloquearAvaliacaoGeral();
                }

                // Limpa formulário
                formAvaliacao.reset();
                estrelasAvaliacao.forEach(s => s.innerHTML = '<i class="far fa-star"></i>');
                if (notaSelecionada) notaSelecionada.textContent = '';

                // Recarrega perfil para atualizar métricas
                fetchUserProfile();
            } catch (error) {
                console.error('Erro ao enviar avaliação:', error);
                alert(error.message);
            }
        });
    }
    // 🆕 ATUALIZADO: Usa modal para adicionar projeto
    const modalAdicionarProjeto = document.getElementById('modal-adicionar-projeto');
    const formAdicionarProjeto = document.getElementById('form-adicionar-projeto');
    const projetoTagDesafioInput = document.getElementById('projeto-tag-desafio');
    const projetoUploadBtn = document.getElementById('projeto-upload-btn');
    const projetoImagensInput = document.getElementById('projeto-imagens');
    const projetoPreviewContainer = document.getElementById('projeto-preview-container');
    const projetoContadorMidia = document.getElementById('projeto-contador-midia');
    const PROJETO_MAX_MIDIAS = 5;
    let projetoArquivosSelecionados = [];
    let isAddingMoreMidia = false;

    function resetAdicionarProjetoPreview() {
        if (projetoPreviewContainer) {
            projetoPreviewContainer.innerHTML = '';
        }
        if (projetoUploadBtn) {
            projetoUploadBtn.style.display = 'inline-flex';
        }
        if (projetoImagensInput) {
            projetoImagensInput.value = '';
        }
        if (projetoContadorMidia) {
            projetoContadorMidia.classList.add('oculto');
            projetoContadorMidia.textContent = `0/${PROJETO_MAX_MIDIAS}`;
        }
        projetoArquivosSelecionados = [];
        isAddingMoreMidia = false;
    }

    if (projetoUploadBtn && projetoImagensInput) {
        projetoUploadBtn.addEventListener('click', () => {
            projetoImagensInput.click();
        });
    }

    function renderProjetoPreview(files) {
        if (!projetoPreviewContainer || !projetoImagensInput || !projetoUploadBtn) return;

        projetoPreviewContainer.innerHTML = '';

        if (!files || files.length === 0) {
            projetoUploadBtn.style.display = 'inline-flex';
            if (projetoContadorMidia) {
                projetoContadorMidia.classList.add('oculto');
                projetoContadorMidia.textContent = `0/${PROJETO_MAX_MIDIAS}`;
            }
            return;
        }

        if (projetoContadorMidia) {
            projetoContadorMidia.classList.remove('oculto');
            projetoContadorMidia.textContent = `${files.length}/${PROJETO_MAX_MIDIAS}`;
        }

        // Esconde o botão grande e passa a usar o "quadradinho +" dentro das miniaturas
        projetoUploadBtn.style.display = 'none';

        Array.from(files).forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'projeto-preview-item';

            let mediaElement;
            if (file.type.startsWith('image/')) {
                mediaElement = document.createElement('img');
            } else if (file.type.startsWith('video/')) {
                mediaElement = document.createElement('video');
                mediaElement.muted = true;
                mediaElement.playsInline = true;
            } else {
                mediaElement = document.createElement('div');
                mediaElement.textContent = file.name;
                mediaElement.style.fontSize = '10px';
                mediaElement.style.textAlign = 'center';
            }

            if (mediaElement instanceof HTMLImageElement || mediaElement instanceof HTMLVideoElement) {
                mediaElement.src = URL.createObjectURL(file);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'projeto-preview-remove';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', () => {
                // Remove o arquivo correspondente da lista em memória
                projetoArquivosSelecionados = projetoArquivosSelecionados.filter((_, i) => i !== index);

                // Atualiza o FileList do input com os arquivos restantes
                const dt = new DataTransfer();
                projetoArquivosSelecionados.forEach(f => dt.items.add(f));
                projetoImagensInput.files = dt.files;

                renderProjetoPreview(projetoImagensInput.files);
            });

            item.appendChild(mediaElement);
            item.appendChild(removeBtn);
            projetoPreviewContainer.appendChild(item);
        });

        // Botão "+" para adicionar mais mídias (apenas se ainda não chegou no limite)
        if (files.length < PROJETO_MAX_MIDIAS) {
            const addItem = document.createElement('button');
            addItem.type = 'button';
            addItem.className = 'projeto-preview-item projeto-preview-add';
            addItem.innerHTML = '<span>+</span>';
            addItem.addEventListener('click', () => {
                isAddingMoreMidia = true;
                projetoImagensInput.click();
            });
            projetoPreviewContainer.appendChild(addItem);
        }
    }

    if (projetoImagensInput && projetoPreviewContainer) {
        projetoImagensInput.addEventListener('change', (e) => {
            const novosArquivos = Array.from(e.target.files || []);

            let arquivosCombinados;
            if (isAddingMoreMidia && projetoArquivosSelecionados.length) {
                arquivosCombinados = projetoArquivosSelecionados.concat(novosArquivos);
            } else {
                arquivosCombinados = novosArquivos;
            }

            if (arquivosCombinados.length > PROJETO_MAX_MIDIAS) {
                const excedente = arquivosCombinados.length - PROJETO_MAX_MIDIAS;
                alert(`Você pode adicionar no máximo ${PROJETO_MAX_MIDIAS} fotos/vídeos por projeto. ${excedente} arquivo(s) extra(s) foram ignorado(s).`);
                arquivosCombinados = arquivosCombinados.slice(0, PROJETO_MAX_MIDIAS);
            }

            projetoArquivosSelecionados = arquivosCombinados;

            isAddingMoreMidia = false;

            // Recria o FileList real do input a partir do array acumulado
            const dt = new DataTransfer();
            projetoArquivosSelecionados.forEach(f => dt.items.add(f));
            projetoImagensInput.files = dt.files;

            renderProjetoPreview(projetoImagensInput.files);
        });
    }

    if (addServicoBtn && modalAdicionarProjeto) {
        addServicoBtn.addEventListener('click', () => {
            modalAdicionarProjeto.classList.remove('hidden');
            resetAdicionarProjetoPreview();
        });
    }
    
    // 🆕 NOVO: Listener para formulário de validação
    const formValidarProjeto = document.getElementById('form-validar-projeto');
    if (formValidarProjeto) {
        formValidarProjeto.addEventListener('submit', async (e) => {
            e.preventDefault();
            const modalValidacao = document.getElementById('modal-validar-projeto');
            const servicoId = modalValidacao?.dataset.servicoId;
            const comentario = document.getElementById('comentario-validacao').value;
            
            if (servicoId) {
                await enviarValidacao(servicoId, comentario);
                modalValidacao?.classList.add('hidden');
                formValidarProjeto.reset();
            }
        });
    }
    
    if (formAdicionarProjeto) {
        formAdicionarProjeto.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData();
            formData.append('title', document.getElementById('projeto-titulo').value);
            formData.append('description', document.getElementById('projeto-descricao').value);
            formData.append('desafio', document.getElementById('projeto-desafio').value || '');
            formData.append('tecnologias', document.getElementById('projeto-tecnologias').value || '');

            const tagDesafioTexto = (projetoTagDesafioInput?.value || '').trim();
            formData.append('isDesafioHelpy', !!tagDesafioTexto);
            formData.append('tagDesafio', tagDesafioTexto);
            
            const files = document.getElementById('projeto-imagens').files;
            for (const file of files) {
                formData.append('images', file);
            }
            
            try {
                const response = await fetch('/api/servico', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao criar projeto.');
                
                alert('Projeto adicionado ao portfólio com sucesso!');
                formAdicionarProjeto.reset();
                resetAdicionarProjetoPreview();
                modalAdicionarProjeto?.classList.add('hidden');
                fetchUserProfile();
            } catch (error) {
                console.error('Erro ao criar projeto:', error);
                alert(error.message);
            }
        });
    }
    async function handleDeleteServico(event) { event.stopPropagation(); const button = event.currentTarget; const servicoId = button.dataset.id; const servicoElement = button.closest('.servico-item-container'); if (!confirm('Tem certeza que deseja remover este serviço? Isso removerá as imagens associadas.')) return; try { const response = await fetch(`/api/user/${loggedInUserId}/servicos/${servicoId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); const data = await response.json(); if (response.ok && data.success) { alert('Serviço removido com sucesso!'); servicoElement.remove(); } else { throw new Error(data.message || 'Erro ao remover serviço.'); } } catch (error) { console.error('Erro ao remover serviço:', error); alert(error.message); } }
    // 🆕 ATUALIZADO: Mostra detalhes do projeto com comentários de validação
    async function handleShowServicoDetails(event) {
        const servicoId = event.currentTarget.closest('.servico-item').dataset.id;
        if (!servicoId) return;
        
        try {
            const response = await fetch(`/api/servico/${servicoId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Projeto não encontrado');
            
            const servico = await response.json();
            
            // Cria modal de detalhes do projeto
            const modalDetalhes = document.getElementById('modal-detalhes-projeto') || criarModalDetalhesProjeto();
            
            // Preenche informações
            document.getElementById('projeto-detalhes-titulo').textContent = servico.title || 'Projeto';
            document.getElementById('projeto-detalhes-descricao').textContent = servico.description || 'Sem descrição';
            document.getElementById('projeto-detalhes-desafio').textContent = servico.desafio || 'Não informado';
            
            // Tecnologias
            const tecnologiasContainer = document.getElementById('projeto-detalhes-tecnologias');
            if (tecnologiasContainer) {
                if (servico.tecnologias && servico.tecnologias.length > 0) {
                    tecnologiasContainer.innerHTML = servico.tecnologias.map(t => `<span class="tag-tecnologia">${t}</span>`).join('');
                } else {
                    tecnologiasContainer.innerHTML = '<span>Nenhuma tecnologia informada</span>';
                }
            }
            
            // Validações por pares
            const validacoesContainer = document.getElementById('projeto-detalhes-validacoes');
            if (validacoesContainer && servico.validacoesPares && servico.validacoesPares.length > 0) {
                validacoesContainer.innerHTML = servico.validacoesPares.map(v => {
                    const prof = v.profissionalId;
                    return `
                        <div class="validacao-item">
                            <img src="${prof.foto || prof.avatarUrl || 'imagens/default-user.png'}" alt="${prof.nome}" class="validacao-avatar">
                            <div class="validacao-info">
                                <strong>${prof.nome}</strong>
                                <p>${v.comentario || 'Validou este projeto'}</p>
                                <small>${new Date(v.dataValidacao).toLocaleDateString('pt-BR')}</small>
                            </div>
                            <span class="validacao-badge">🛡️</span>
                        </div>
                    `;
                }).join('');
            } else if (validacoesContainer) {
                validacoesContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma validação ainda.</p>';
            }
            
            // Imagens
            const imagensContainer = document.getElementById('projeto-detalhes-imagens');
            if (imagensContainer && servico.images && servico.images.length > 0) {
                imagensContainer.innerHTML = servico.images.map(img => 
                    `<img src="${img}" alt="Projeto" class="projeto-imagem-detalhe">`
                ).join('');
            }
            
            modalDetalhes.classList.remove('hidden');
            
            // 🆕 NOVO: Adiciona listener para fechar modal
            const btnClose = modalDetalhes.querySelector('.btn-close-modal');
            if (btnClose) {
                btnClose.onclick = () => modalDetalhes.classList.add('hidden');
            }
            
            // Fecha ao clicar fora
            modalDetalhes.onclick = (e) => {
                if (e.target === modalDetalhes) {
                    modalDetalhes.classList.add('hidden');
                }
            };
        } catch (error) {
            console.error("Erro ao buscar detalhes do projeto:", error);
            alert('Não foi possível carregar os detalhes deste projeto.');
        }
    }
    
    function criarModalDetalhesProjeto() {
        const modal = document.createElement('div');
        modal.id = 'modal-detalhes-projeto';
        modal.className = 'modal-overlay hidden';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3>Detalhes do Projeto</h3>
                    <button class="btn-close-modal" data-modal="modal-detalhes-projeto">&times;</button>
                </div>
                <div class="modal-body">
                    <h4 id="projeto-detalhes-titulo"></h4>
                    <p id="projeto-detalhes-descricao"></p>
                    <div><strong>Desafio:</strong> <span id="projeto-detalhes-desafio"></span></div>
                    <div><strong>Tecnologias:</strong> <div id="projeto-detalhes-tecnologias" class="tecnologias-tags"></div></div>
                    <div id="projeto-detalhes-imagens" class="projeto-imagens-detalhes"></div>
                    <h5>Validações por Pares 🛡️</h5>
                    <div id="projeto-detalhes-validacoes" class="validacoes-lista"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    // 🆕 ATUALIZADO: Sistema de abas corrigido
    function setupSectionSwitching() {
        if (!mostrarServicosBtn || !mostrarPostagensBtn || !secaoServicos || !secaoPostagens) return;
        
        // Função para alternar entre seções
        function mostrarSecao(secaoAtiva) {
            // Esconde todas
            secaoServicos.style.display = 'none';
            secaoPostagens.style.display = 'none';
            
            // Mostra a ativa
            secaoAtiva.style.display = 'block';
            
            // Atualiza botões
            mostrarServicosBtn.classList.toggle('ativo', secaoAtiva === secaoServicos);
            mostrarPostagensBtn.classList.toggle('ativo', secaoAtiva === secaoPostagens);
            
            // Carrega dados se necessário - usa profileId (perfil visualizado) em vez de loggedInUserId
            if (secaoAtiva === secaoServicos && galeriaServicos && galeriaServicos.children.length === 0) {
                fetchServicos(profileId || loggedInUserId);
            }
            if (secaoAtiva === secaoPostagens && minhasPostagensContainer && minhasPostagensContainer.children.length === 0) {
                fetchPostagens(profileId || loggedInUserId);
            }
        }
        
        mostrarServicosBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarSecao(secaoServicos);
        });

        mostrarPostagensBtn.addEventListener('click', (e) => {
            e.preventDefault();
            mostrarSecao(secaoPostagens);
        });
        
        // Mostra a seção padrão (Projetos para trabalhadores, Postagens para outros)
        if ((userType === 'usuario' || userType === 'empresa') && mostrarServicosBtn.style.display !== 'none') {
            mostrarSecao(secaoServicos);
        } else {
            mostrarSecao(secaoPostagens);
        }
    }
    if (fotoPerfil) { fotoPerfil.style.cursor = 'pointer'; fotoPerfil.addEventListener('click', () => { if (fotoPerfil.src && imageModal && modalImage) { modalImage.src = fotoPerfil.src; imageModal.classList.add('visible'); } }); }
    if (closeImageModalBtn) { closeImageModalBtn.addEventListener('click', () => { imageModal.classList.remove('visible'); }); }
    if (imageModal) { imageModal.addEventListener('click', (e) => { if (e.target.id === 'image-modal' || e.target.classList.contains('image-modal-overlay')) { imageModal.classList.remove('visible'); } }); }
    if (feedButton) { 
        feedButton.addEventListener('click', (e) => { 
            e.preventDefault(); 
            window.location.href = '/'; 
        }); 
    }
    if (profileButton) { 
        profileButton.addEventListener('click', (e) => { 
            e.preventDefault(); 
            // Abre diretamente perfil.html com o ID; perfil.js limpará a URL com o slug
            window.location.href = `/perfil.html?id=${loggedInUserId}`; 
        }); 
    }
    if (logoutButton) { logoutButton.addEventListener('click', (e) => { e.preventDefault(); logoutConfirmModal && logoutConfirmModal.classList.remove('hidden'); }); }
    if (confirmLogoutYesBtn) { 
        confirmLogoutYesBtn.addEventListener('click', () => { 
            // Fecha todos os modais antes de fazer logout
            const modalPropostas = document.getElementById('modal-propostas');
            if (modalPropostas) {
                modalPropostas.classList.add('hidden');
            }
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear(); 
            if (jaLogou) {
                localStorage.setItem('helpy-ja-logou', jaLogou);
            }
            window.location.href = '/login'; 
        });
    }
    if (confirmLogoutNoBtn) { confirmLogoutNoBtn.addEventListener('click', () => { logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); }); }
    
    // 🆕 NOVO: Fechar modais ao clicar no X ou fora
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.dataset.modal;
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    modal.classList.add('hidden');
                    if (modal.id === 'modal-adicionar-projeto') {
                        resetAdicionarProjetoPreview();
                        formAdicionarProjeto && formAdicionarProjeto.reset();
                    }
                }
            }
        });
    });
    
    // Fecha modais ao clicar fora
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                if (modal.id === 'modal-adicionar-projeto') {
                    resetAdicionarProjetoPreview();
                    formAdicionarProjeto && formAdicionarProjeto.reset();
                }
            }
        });
    });
    
    if (btnAdicionarHorario && typeof adicionarCampoHorario === 'function') {
        btnAdicionarHorario.addEventListener('click', () => {
            adicionarCampoHorario();
        });
    }
    
    if (formHorarios && typeof adicionarCampoHorario === 'function') {
        formHorarios.addEventListener('submit', async (e) => {
            e.preventDefault();
            const horarios = [];
            document.querySelectorAll('.horario-item').forEach(item => {
                const diaSemana = item.querySelector('.dia-semana').value;
                const horaInicio = item.querySelector('.hora-inicio').value;
                const horaFim = item.querySelector('.hora-fim').value;
                if (diaSemana && horaInicio && horaFim) {
                    horarios.push({ diaSemana: parseInt(diaSemana), horaInicio, horaFim });
                }
            });
            
            try {
                const response = await fetch('/api/agenda/horarios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ horarios })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Horários salvos com sucesso!');
                    modalConfigurarHorarios?.classList.add('hidden');
                } else {
                    alert(data.message || 'Erro ao salvar horários.');
                }
            } catch (error) {
                console.error('Erro ao salvar horários:', error);
                alert('Erro ao salvar horários.');
            }
        });
    }
    
    async function carregarAgendamentos() {
        const agendamentosLista = document.getElementById('agendamentos-lista');
        if (!agendamentosLista) return;
        
        try {
            const response = await fetch('/api/agenda/profissional', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success && data.agendamentos.length > 0) {
                agendamentosLista.innerHTML = data.agendamentos.map(ag => {
                    const cliente = ag.clienteId;
                    const dataHora = new Date(ag.dataHora);
                    const statusClass = {
                        'pendente': 'status-pendente',
                        'confirmado': 'status-confirmado',
                        'cancelado': 'status-cancelado',
                        'concluido': 'status-concluido'
                    }[ag.status] || '';
                    
                    return `
                        <div class="agendamento-card ${statusClass}">
                            <div class="agendamento-header">
                                <img src="${cliente.foto || cliente.avatarUrl || 'imagens/default-user.png'}" alt="${cliente.nome}" class="agendamento-avatar">
                                <div>
                                    <strong>${cliente.nome}</strong>
                                    <p>${ag.servico}</p>
                                </div>
                            </div>
                            <div class="agendamento-info">
                                <p><i class="fas fa-calendar"></i> ${dataHora.toLocaleDateString('pt-BR')}</p>
                                <p><i class="fas fa-clock"></i> ${dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                ${ag.endereco ? `<p><i class="fas fa-map-marker-alt"></i> ${ag.endereco.cidade}, ${ag.endereco.estado}</p>` : ''}
                                <p class="status-agendamento">Status: ${ag.status}</p>
                            </div>
                            ${ag.status === 'pendente' ? `
                                <div class="agendamento-acoes">
                                    <button class="btn-confirmar" onclick="atualizarStatusAgendamento('${ag._id}', 'confirmado')">Confirmar</button>
                                    <button class="btn-cancelar" onclick="atualizarStatusAgendamento('${ag._id}', 'cancelado')">Cancelar</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            } else {
                agendamentosLista.innerHTML = '<p class="mensagem-vazia">Nenhum agendamento ainda.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar agendamentos:', error);
            agendamentosLista.innerHTML = '<p class="mensagem-vazia">Erro ao carregar agendamentos.</p>';
        }
    }
    
    async function carregarHorariosExistentes() {
        if (!horariosContainer) return;
        
        try {
            const response = await fetch(`/api/agenda/${loggedInUserId}/horarios`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            horariosContainer.innerHTML = '';
            
            if (data.success && data.horarios.length > 0) {
                data.horarios.forEach(h => adicionarCampoHorario(h.diaSemana, h.horaInicio, h.horaFim));
            } else {
                adicionarCampoHorario();
            }
        } catch (error) {
            console.error('Erro ao carregar horários:', error);
            adicionarCampoHorario();
        }
    }
    
    function adicionarCampoHorario(diaSemana = '', horaInicio = '', horaFim = '') {
        if (!horariosContainer) return;
        
        const horarioItem = document.createElement('div');
        horarioItem.className = 'horario-item';
        horarioItem.innerHTML = `
            <select class="dia-semana">
                <option value="0" ${diaSemana === 0 ? 'selected' : ''}>Domingo</option>
                <option value="1" ${diaSemana === 1 ? 'selected' : ''}>Segunda</option>
                <option value="2" ${diaSemana === 2 ? 'selected' : ''}>Terça</option>
                <option value="3" ${diaSemana === 3 ? 'selected' : ''}>Quarta</option>
                <option value="4" ${diaSemana === 4 ? 'selected' : ''}>Quinta</option>
                <option value="5" ${diaSemana === 5 ? 'selected' : ''}>Sexta</option>
                <option value="6" ${diaSemana === 6 ? 'selected' : ''}>Sábado</option>
            </select>
            <input type="time" class="hora-inicio" value="${horaInicio}">
            <input type="time" class="hora-fim" value="${horaFim}">
            <button type="button" class="btn-remover-horario">&times;</button>
        `;
        
        horarioItem.querySelector('.btn-remover-horario').addEventListener('click', () => {
            horarioItem.remove();
        });
        
        horariosContainer.appendChild(horarioItem);
    }
    
    window.atualizarStatusAgendamento = async function(agendamentoId, status) {
        try {
            const response = await fetch(`/api/agenda/${agendamentoId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            });
            
            const data = await response.json();
            if (data.success) {
                await carregarAgendamentos();
            } else {
                alert(data.message || 'Erro ao atualizar agendamento.');
            }
        } catch (error) {
            console.error('Erro ao atualizar agendamento:', error);
            alert('Erro ao atualizar agendamento.');
        }
    };
    
    // 🆕 NOVO: Funções para visitante ver agenda
    function criarModalAgendaVisitante(profissionalId) {
        const modal = document.createElement('div');
        modal.id = 'modal-agenda-visitante';
        modal.className = 'modal-overlay hidden';
        modal.dataset.profissionalId = profissionalId;
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3><i class="fas fa-calendar-alt"></i> Agenda do Profissional</h3>
                    <button class="btn-close-modal" data-modal="modal-agenda-visitante">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="agendamentos-lista-visitante"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    
    async function carregarAgendamentosVisitante(profissionalId) {
        const agendamentosLista = document.getElementById('agendamentos-lista-visitante');
        if (!agendamentosLista) return;
        
        try {
            const response = await fetch(`/api/agenda/${profissionalId}/horarios`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success && data.horarios.length > 0) {
                const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                agendamentosLista.innerHTML = `
                    <h4>Horários Disponíveis</h4>
                    ${data.horarios.map(h => `
                        <div class="horario-disponivel-card">
                            <strong>${diasSemana[h.diaSemana]}</strong>
                            <p>${h.horaInicio} - ${h.horaFim}</p>
                        </div>
                    `).join('')}
                `;
            } else {
                agendamentosLista.innerHTML = '<p class="mensagem-vazia">Nenhum horário disponível configurado.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar horários:', error);
            agendamentosLista.innerHTML = '<p class="mensagem-vazia">Erro ao carregar horários.</p>';
        }
    }

    // --- Barra inferior (mobile) ---
    const bottomNavHomeBtn = document.getElementById('bottom-nav-home');
    const bottomNavQuickBtn = document.getElementById('bottom-nav-quick');
    const bottomNavSearchBtn = document.getElementById('bottom-nav-search');
    const bottomNavNotificationsBtn = document.getElementById('bottom-nav-notifications');
    const bottomNavSettingsBtn = document.getElementById('bottom-nav-settings');

    // Menu lateral (mobile)
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    const categorias = document.querySelector('.categorias');
    const conteudo = document.querySelector('.conteudo');

    // Busca no header
    const searchToggle = document.getElementById('search-toggle');
    const searchInput = document.querySelector('.search');
    const headerEl = document.querySelector('header');

    const shouldInitSharedUI = !window.__helpyMainScriptInitialized;

    // Abrir/fechar menu lateral
    if (shouldInitSharedUI && mobileSidebarToggle && categorias) {
        mobileSidebarToggle.addEventListener('click', () => {
            // Usa a mesma classe que o CSS do app espera (.categorias.aberta)
            categorias.classList.add('aberta');
        });
    }

    if (shouldInitSharedUI && mobileSidebarClose && categorias) {
        mobileSidebarClose.addEventListener('click', () => {
            categorias.classList.remove('aberta');
        });
    }

    // Fechar menu ao clicar fora
    if (shouldInitSharedUI && conteudo && categorias) {
        conteudo.addEventListener('click', (e) => {
            if (categorias.classList.contains('aberta') &&
                !categorias.contains(e.target) &&
                (!mobileSidebarToggle || !mobileSidebarToggle.contains(e.target))) {
                categorias.classList.remove('aberta');
            }
        });
    }

    // Toggle busca no mobile
    if (shouldInitSharedUI && searchToggle && headerEl && searchInput) {
        searchToggle.addEventListener('click', () => {
            headerEl.classList.toggle('search-open');
            if (headerEl.classList.contains('search-open')) {
                searchInput.focus();
            }
        });
    }

    function fecharBuscaHeader() {
        if (!headerEl) return;
        headerEl.classList.remove('search-open');
    }

    // Fecha a busca ao clicar fora do header (inclui barra inferior e conteúdo)
    if (shouldInitSharedUI && headerEl) {
        document.addEventListener('click', (e) => {
            if (!headerEl.classList.contains('search-open')) return;
            if (headerEl.contains(e.target)) return;
            if (bottomNavSearchBtn && bottomNavSearchBtn.contains(e.target)) return;
            fecharBuscaHeader();
        }, true);
    }

    if (shouldInitSharedUI && bottomNavHomeBtn) {
        bottomNavHomeBtn.addEventListener('click', () => {
            fecharBuscaHeader();
            window.location.href = '/';
        });
    }

    if (shouldInitSharedUI && bottomNavQuickBtn) {
        bottomNavQuickBtn.addEventListener('click', () => {
            fecharBuscaHeader();
            // Abrir menu lateral
            if (mobileSidebarToggle) {
                mobileSidebarToggle.click();
            }
        });
    }

    if (shouldInitSharedUI && bottomNavSearchBtn) {
        bottomNavSearchBtn.addEventListener('click', () => {
            // Abrir busca no header
            if (searchToggle) {
                searchToggle.click();
            }
        });
    }

    if (shouldInitSharedUI && bottomNavNotificationsBtn) {
        bottomNavNotificationsBtn.addEventListener('click', () => {
            fecharBuscaHeader();
            // Abrir notificações
            const btnNotificacoes = document.getElementById('btn-notificacoes');
            if (btnNotificacoes) {
                btnNotificacoes.click();
            }
        });
    }

    if (shouldInitSharedUI && bottomNavSettingsBtn) {
        bottomNavSettingsBtn.addEventListener('click', () => {
            fecharBuscaHeader();
            window.location.href = '/configuracoes-conta.html';
        });
    }
});

