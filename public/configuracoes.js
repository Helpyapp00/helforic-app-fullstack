// Este script é uma versão simplificada do perfil.js
// Ele cuida apenas do cabeçalho das páginas de configurações.

document.addEventListener('DOMContentLoaded', () => {
    const loggedInUserId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');

    // Checagem de segurança
    if (!loggedInUserId || !token) {
        alert('Você precisa estar logado para acessar esta página.');
        window.location.href = 'login.html';
        return;
    }

    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    const searchInput = document.querySelector('.search');
    const searchToggleBtn = document.getElementById('search-toggle');
    // Mobile: bloco usuário + sair (abaixo do título)
    const configUserAvatar = document.getElementById('config-user-avatar');
    const configUserName = document.getElementById('config-user-name');
    const logoutButtonMobile = document.getElementById('logout-button-mobile');
    const logoutInlineConfirm = document.getElementById('logout-inline-confirm');
    const logoutInlineYes = document.getElementById('logout-inline-yes');
    const logoutInlineNo = document.getElementById('logout-inline-no');
    const logoBox = document.querySelector('.logo-box');
    const btnVoltarFeed = document.getElementById('btn-voltar-feed');
    
    // --- Barra inferior (mobile) ---
    const bottomNavHomeBtn = document.getElementById('bottom-nav-home');
    const bottomNavQuickBtn = document.getElementById('bottom-nav-quick');
    const bottomNavSearchBtn = document.getElementById('bottom-nav-search');
    const bottomNavNotificationsBtn = document.getElementById('bottom-nav-notifications');
    const bottomNavSettingsBtn = document.getElementById('bottom-nav-settings');
    const headerEl = document.querySelector('header');
    let searchResultsContainer = null;
    let searchResultsBackdrop = null;
    let buscaTimeout = null;

    // Mantém uma variável CSS com a altura real do header (pra posicionar resultados de busca abaixo dele)
    function atualizarAlturaHeaderCssVar() {
        if (!headerEl) return;
        const h = Math.ceil(headerEl.getBoundingClientRect().height || 70);
        document.documentElement.style.setProperty('--header-height', `${h}px`);
    }

    atualizarAlturaHeaderCssVar();
    window.addEventListener('resize', atualizarAlturaHeaderCssVar);

    if (headerEl && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => atualizarAlturaHeaderCssVar());
        ro.observe(headerEl);
    }

    function fecharBuscaUI() {
        if (!headerEl) return;
        headerEl.classList.remove('search-open');
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
    }

    // Fecha a busca ao clicar fora do header (inclui barra inferior e conteúdo)
    if (headerEl) {
        document.addEventListener('click', (e) => {
            if (!headerEl.classList.contains('search-open')) return;
            if (headerEl.contains(e.target)) return;
            if (bottomNavSearchBtn && bottomNavSearchBtn.contains(e.target)) return;
            fecharBuscaUI();
        }, true);
    }

    function getAuthHeaders() {
        const t = localStorage.getItem('jwtToken');
        if (!t || t === 'null' || t === 'undefined') return {};
        return { 'Authorization': `Bearer ${t}` };
    }

    async function carregarMeusAnuncios() {
        const container = document.getElementById('lista-meus-anuncios');
        if (!container) return;
        container.innerHTML = 'Carregando...';
        try {
            const resp = await fetch('/api/anuncios?limit=50', { headers: getAuthHeaders() });
            const data = await resp.json();
            const anuncios = Array.isArray(data?.anuncios) ? data.anuncios : [];
            if (!resp.ok) {
                container.innerHTML = 'Não foi possível carregar seus anúncios.';
                return;
            }
            if (anuncios.length === 0) {
                container.innerHTML = 'Você ainda não criou nenhum anúncio.';
                return;
            }

            container.innerHTML = anuncios.map((a) => {
                const titulo = a?.titulo ? String(a.titulo) : 'Anúncio';
                const cidadeEstado = [a?.cidade, a?.estado].filter(Boolean).join(' - ');
                const status = a?.ativo ? 'Ativo' : 'Inativo';
                const plano = a?.plano ? String(a.plano) : 'basico';
                return `
                    <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="font-weight: 700;">${titulo}</div>
                        <div style="opacity: 0.85;">${cidadeEstado || 'Geral'} • ${status} • ${plano}</div>
                        <button class="salvar-btn btn-ghost" data-pay-anuncio="${a?._id}" style="margin-top: 8px; padding: 8px 12px;">Pagar / Impulsionar</button>
                    </div>
                `;
            }).join('');
        } catch (e) {
            console.error('Erro ao carregar anúncios:', e);
            container.innerHTML = 'Erro ao carregar seus anúncios.';
        }
    }

    const menuDisponibilidade = document.getElementById('menu-disponibilidade');
    const toggleDisponibilidade = document.getElementById('toggle-disponibilidade');

    async function initDisponibilidadeMenu() {
        if (!menuDisponibilidade || !toggleDisponibilidade) return;
        if (!token) {
            menuDisponibilidade.style.display = 'none';
            return;
        }

        if (toggleDisponibilidade.dataset.bound === '1') return;
        toggleDisponibilidade.dataset.bound = '1';

        try {
            const resp = await fetch('/api/user/me', { headers: getAuthHeaders() });
            const data = await resp.json();
            const user = data?.user || data;

            const userType = localStorage.getItem('userType');
            const isProfissional =
                user?.tipo === 'trabalhador' ||
                user?.tipo === 'profissional' ||
                !!user?.atuacao ||
                userType === 'trabalhador' ||
                userType === 'profissional';

            if (!isProfissional) {
                menuDisponibilidade.style.display = 'none';
                return;
            }

            menuDisponibilidade.style.display = 'block';
            toggleDisponibilidade.checked = !!user?.disponivelAgora;

            toggleDisponibilidade.addEventListener('change', async () => {
                const disponivelAgora = !!toggleDisponibilidade.checked;
                try {
                    await fetch('/api/user/disponibilidade', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({ disponivelAgora })
                    });
                } catch (e) {
                    console.error('Erro ao atualizar disponibilidade:', e);
                }
            });
        } catch (e) {
            console.error('Erro ao inicializar disponibilidade:', e);
            menuDisponibilidade.style.display = 'none';
        }
    }

    initDisponibilidadeMenu();

    const formCriarAnuncio = document.getElementById('form-criar-anuncio');
    const btnAbrirCriarAnuncio = document.getElementById('btn-abrir-criar-anuncio');
    const modalCriarAnuncio = document.getElementById('modal-criar-anuncio');
    const btnFecharModalAnuncio = document.getElementById('btn-fechar-modal-anuncio');
    const msgAnuncio = document.getElementById('msg-anuncio');
    const adFileInput = document.getElementById('anuncio-imagem-arquivo');
    const adPickBtn = document.getElementById('btn-anuncio-escolher-imagem');
    const adPreviewImg = document.getElementById('anuncio-imagem-preview');
    const adRemoveBtn = document.getElementById('btn-anuncio-remover-imagem');
    const adImagePicker = document.getElementById('anuncio-imagem-picker');
    const enderecoOutroBox = document.getElementById('anuncio-endereco-outro');
    const enderecoOpcaoInputs = document.querySelectorAll('input[name="anuncio-endereco-opcao"]');
    let adPreviewObjectUrl = null;

    function clearAdPreview() {
        if (adPreviewObjectUrl) {
            try { URL.revokeObjectURL(adPreviewObjectUrl); } catch (_) {}
        }
        adPreviewObjectUrl = null;
        if (adPreviewImg) {
            adPreviewImg.src = '';
            adPreviewImg.removeAttribute('src');
        }
        if (adImagePicker) adImagePicker.classList.remove('has-image');
    }

    function openAdFilePicker() {
        if (adFileInput) adFileInput.click();
    }

    function abrirModalCriarAnuncio() {
        if (!modalCriarAnuncio) return;
        modalCriarAnuncio.classList.remove('hidden');
        if (window.syncModalScrollLock) window.syncModalScrollLock();
    }

    function syncEnderecoOpcao() {
        if (!enderecoOutroBox) return;
        const selected = document.querySelector('input[name="anuncio-endereco-opcao"]:checked')?.value || 'perfil';
        enderecoOutroBox.classList.toggle('hidden', selected !== 'outro');
        if (selected === 'perfil') {
            const cidadeInput = document.getElementById('anuncio-cidade');
            const estadoInput = document.getElementById('anuncio-estado');
            if (cidadeInput) cidadeInput.value = '';
            if (estadoInput) estadoInput.value = '';
        }
    }

    function fecharModalCriarAnuncio() {
        if (!modalCriarAnuncio) return;
        modalCriarAnuncio.classList.add('hidden');
        if (window.syncModalScrollLock) window.syncModalScrollLock();
    }

    if (btnAbrirCriarAnuncio) {
        btnAbrirCriarAnuncio.addEventListener('click', abrirModalCriarAnuncio);
    }
    if (btnFecharModalAnuncio) {
        btnFecharModalAnuncio.addEventListener('click', fecharModalCriarAnuncio);
    }
    if (modalCriarAnuncio) {
        modalCriarAnuncio.addEventListener('click', (e) => {
            if (e.target === modalCriarAnuncio) fecharModalCriarAnuncio();
        });
    }

    if (enderecoOpcaoInputs && enderecoOpcaoInputs.length) {
        enderecoOpcaoInputs.forEach((input) => {
            input.addEventListener('change', syncEnderecoOpcao);
        });
        syncEnderecoOpcao();
    }

    if (adPickBtn) {
        adPickBtn.addEventListener('click', openAdFilePicker);
    }
    if (adPreviewImg) {
        adPreviewImg.addEventListener('click', openAdFilePicker);
    }
    if (adFileInput) {
        adFileInput.addEventListener('change', () => {
            if (msgAnuncio) msgAnuncio.textContent = '';
            const file = adFileInput.files ? adFileInput.files[0] : null;
            if (!file) {
                clearAdPreview();
                return;
            }

            const maxBytes = 5 * 1024 * 1024;
            if (file.size > maxBytes) {
                if (msgAnuncio) msgAnuncio.textContent = 'Imagem muito grande. O limite é 5MB.';
                adFileInput.value = '';
                clearAdPreview();
                return;
            }

            if (!String(file.type || '').startsWith('image/')) {
                if (msgAnuncio) msgAnuncio.textContent = 'Selecione apenas imagem.';
                adFileInput.value = '';
                clearAdPreview();
                return;
            }

            clearAdPreview();
            adPreviewObjectUrl = URL.createObjectURL(file);
            if (adPreviewImg) {
                adPreviewImg.src = adPreviewObjectUrl;
            }
            if (adImagePicker) adImagePicker.classList.add('has-image');
        });
    }

    if (adRemoveBtn) {
        adRemoveBtn.addEventListener('click', () => {
            if (adFileInput) adFileInput.value = '';
            clearAdPreview();
        });
    }

    if (formCriarAnuncio) {
        formCriarAnuncio.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (msgAnuncio) msgAnuncio.textContent = '';

            const titulo = document.getElementById('anuncio-titulo')?.value;
            const descricao = document.getElementById('anuncio-descricao')?.value;
            const linkUrl = document.getElementById('anuncio-link')?.value;
            const enderecoOpcao = document.querySelector('input[name="anuncio-endereco-opcao"]:checked')?.value || 'perfil';
            const endereco = document.getElementById('anuncio-endereco')?.value;
            const numero = document.getElementById('anuncio-numero')?.value;
            const cidade = enderecoOpcao === 'outro' ? document.getElementById('anuncio-cidade')?.value : undefined;
            const estado = enderecoOpcao === 'outro' ? document.getElementById('anuncio-estado')?.value : undefined;
            const plano = document.querySelector('input[name="anuncio-plano-radio"]:checked')?.value || 'basico';
            const fileInput = document.getElementById('anuncio-imagem-arquivo');
            const file = fileInput && fileInput.files ? fileInput.files[0] : null;

            try {
                if (!file) {
                    if (msgAnuncio) msgAnuncio.textContent = 'Selecione uma imagem para o anúncio.';
                    return;
                }

                const maxBytes = 5 * 1024 * 1024;
                if (file.size > maxBytes) {
                    if (msgAnuncio) msgAnuncio.textContent = 'Imagem muito grande. O limite é 5MB.';
                    return;
                }

                const fd = new FormData();
                fd.append('imagem', file);
                const up = await fetch('/api/anuncios/upload-imagem', {
                    method: 'POST',
                    headers: {
                        ...getAuthHeaders()
                    },
                    body: fd
                });
                const upJson = await up.json().catch(() => ({}));
                if (!up.ok) {
                    if (msgAnuncio) msgAnuncio.textContent = upJson?.message || 'Não foi possível enviar a imagem.';
                    return;
                }
                const imagemUrl = upJson?.imagemUrl;
                if (!imagemUrl) {
                    if (msgAnuncio) msgAnuncio.textContent = 'Upload concluído, mas não retornou URL da imagem.';
                    return;
                }

                const resp = await fetch('/api/anuncios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                        titulo,
                        descricao,
                        imagemUrl,
                        linkUrl,
                        endereco,
                        numero,
                        cidade,
                        estado,
                        plano,
                        ativo: true
                    })
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok) {
                    if (msgAnuncio) msgAnuncio.textContent = data?.message || 'Não foi possível criar o anúncio.';
                    return;
                }
                if (msgAnuncio) msgAnuncio.textContent = 'Anúncio criado! Agora ele já pode aparecer no feed.';
                formCriarAnuncio.reset();
                clearAdPreview();
                await carregarMeusAnuncios();
            } catch (err) {
                console.error('Erro ao criar anúncio:', err);
                if (msgAnuncio) msgAnuncio.textContent = 'Erro ao criar anúncio.';
            }
        });
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pay-anuncio]');
        if (!btn) return;
        const id = btn.getAttribute('data-pay-anuncio');
        if (!id) return;
        alert('Pagamento/impulsionamento ainda não foi implementado. Por enquanto, o anúncio é criado manualmente e pode aparecer no feed.');
    });

    carregarMeusAnuncios();

    // --- Modais de Logout ---
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

    // Botão "Voltar" (somente telas médias+ via CSS)
    if (btnVoltarFeed) {
        btnVoltarFeed.addEventListener('click', () => {
            window.location.href = '/index.html';
        });
    }

    // --- Função para carregar o Header ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || 'Usuário';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');

        if (userNameHeader) {
            userNameHeader.textContent = storedName.split(' ')[0];
        }
        if (configUserName) {
            configUserName.textContent = String(storedName || 'Usuário').trim();
        }

        if (userAvatarHeader) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay') && !storedPhotoUrl.includes('placehold.co/50?text=User')) {
                // Técnica similar ao Facebook: carrega a imagem com cache busting para forçar alta qualidade
                userAvatarHeader.src = '';
                
                // Adiciona timestamp para evitar cache e garantir carregamento fresco
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                const freshUrl = storedPhotoUrl + separator + '_t=' + Date.now();
                
                // Cria uma nova imagem para pré-carregar com alta qualidade
                const preloadImg = new Image();
                // Só define crossOrigin se a URL for de outro domínio
                if (freshUrl.startsWith('http') && !freshUrl.includes(window.location.hostname)) {
                    preloadImg.crossOrigin = 'anonymous';
                }
                
                preloadImg.onload = function() {
                    // Quando a imagem pré-carregada estiver pronta, aplica ao elemento
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync'; // Síncrono para melhor qualidade
                    
                    // Força repaint para melhor renderização
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        // Força reflow para garantir renderização de alta qualidade
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function() {
                    // Fallback se pré-carregamento falhar
                    userAvatarHeader.src = storedPhotoUrl;
                    userAvatarHeader.loading = 'eager';
                };
                
                // Inicia o pré-carregamento
                preloadImg.src = freshUrl;
            } else {
                userAvatarHeader.src = 'imagens/default-user.png';
            }
        }

        // Avatar no bloco mobile (mais simples, sem pré-carregamento pesado)
        if (configUserAvatar) {
            if (storedPhotoUrl && storedPhotoUrl !== 'undefined' && !storedPhotoUrl.includes('pixabay') && !storedPhotoUrl.includes('placehold.co/50?text=User')) {
                const separator = storedPhotoUrl.includes('?') ? '&' : '?';
                configUserAvatar.src = storedPhotoUrl + separator + '_t=' + Date.now();
            } else {
                configUserAvatar.src = 'imagens/default-user.png';
            }
        }
    }

    // --- Listeners de Navegação do Header ---
    if (profileButton) {
        profileButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `perfil.html?id=${loggedInUserId}`;
        });
    }

    // Avatar + nome no header levam SEMPRE para o próprio perfil
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            if (loggedInUserId) {
                window.location.href = `perfil.html?id=${loggedInUserId}`;
            }
        });
    }

    // --- Barra inferior: volta ao feed pela "casinha" ---
    function irParaFeedComAcao(opcional) {
        if (opcional) {
            try { localStorage.setItem('feed-open-panel', opcional); } catch {}
        }
        window.location.href = '/index.html';
    }

    if (bottomNavHomeBtn) bottomNavHomeBtn.addEventListener('click', () => irParaFeedComAcao());

    // --- Barra inferior: abrir o mesmo menu lateral do feed/perfil (aside.categorias) ---
    const categorias = document.querySelector('.categorias');
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    let mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');
    if (mobileSidebarBackdrop) {
        mobileSidebarBackdrop.remove();
        mobileSidebarBackdrop = null;
    }

    // Ações rápidas do menu lateral
    const btnPrecisoAgora = document.getElementById('btn-preciso-agora');
    const btnVerPedidosUrgentes = document.getElementById('btn-ver-pedidos-urgentes');

    function garantirBackdropSidebar() {
        return null;
    }

    function toggleSidebarConfiguracoes() {
        if (!categorias) return;
        const isOpen = categorias.classList.contains('aberta');
        if (isOpen) {
            categorias.classList.remove('aberta');
            const bd = garantirBackdropSidebar();
            if (bd) {
                bd.classList.remove('visible');
            }
            document.body.style.overflow = '';
        } else {
            categorias.classList.add('aberta');
            const bd = garantirBackdropSidebar();
            if (bd) {
                bd.classList.add('visible');
            }
            document.body.style.overflow = 'hidden';
        }
    }

    if (mobileSidebarClose) {
        mobileSidebarClose.addEventListener('click', () => {
            if (categorias) categorias.classList.remove('aberta');
            const bd = garantirBackdropSidebar();
            if (bd) {
                bd.classList.remove('visible');
            }
            document.body.style.overflow = '';
        });
    }

    // Em Configurações não existem os modais do feed no DOM.
    // Então, ao clicar nas ações rápidas, navegamos para o feed e pedimos para ele abrir o modal.
    if (btnPrecisoAgora) {
        btnPrecisoAgora.addEventListener('click', () => {
            irParaFeedComAcao('preciso-agora');
        });
    }
    if (btnVerPedidosUrgentes) {
        btnVerPedidosUrgentes.addEventListener('click', () => {
            irParaFeedComAcao('pedidos-urgentes');
        });
    }

    if (bottomNavQuickBtn) bottomNavQuickBtn.addEventListener('click', () => toggleSidebarConfiguracoes());
    // ----------------------------------------------------------------------
    // BUSCA NO HEADER (também em Configurações)
    // ----------------------------------------------------------------------
    function fecharBuscaUI() {
        headerEl && headerEl.classList.remove('search-open');
        if (searchResultsContainer) searchResultsContainer.innerHTML = '';
        if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
    }

    function garantirElementosBusca() {
        if (!searchInput) return false;

        if (!document.getElementById('search-results')) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'search-results';
            searchResultsContainer.innerHTML = '';
            if (headerEl) headerEl.appendChild(searchResultsContainer);
        } else {
            searchResultsContainer = document.getElementById('search-results');
        }

        if (!document.getElementById('search-results-backdrop')) {
            searchResultsBackdrop = document.createElement('div');
            searchResultsBackdrop.id = 'search-results-backdrop';
            document.body.appendChild(searchResultsBackdrop);
            searchResultsBackdrop.addEventListener('click', () => fecharBuscaUI());
        } else {
            searchResultsBackdrop = document.getElementById('search-results-backdrop');
        }

        return true;
    }

    const SEARCH_HISTORY_KEY = 'searchHistoryUsers';
    function getSearchHistoryUsers() {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    function setSearchHistoryUsers(items) {
        try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items)); } catch {}
    }
    function pushUserToHistory(user) {
        if (!user || !user.id) return;
        const history = getSearchHistoryUsers();
        const next = [user, ...history.filter((h) => h && h.id && h.id !== user.id)].slice(0, 10);
        setSearchHistoryUsers(next);
    }

    function renderSearchHistoryUsers() {
        if (!searchResultsContainer) return;
        const history = getSearchHistoryUsers();
        if (!history.length) {
            searchResultsContainer.innerHTML = `<div class="search-results-empty">Nenhuma pesquisa recente.</div>`;
            if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');
            return;
        }

        let html = '<div class="search-results-box">';
        html += '<div class="search-section"><h4>Pesquisas recentes</h4>';
        history.forEach((u) => {
            const foto = u.foto || 'imagens/default-user.png';
            html += `
                <div class="search-item search-user" data-user-id="${u.id}">
                    <img src="${foto}" alt="${u.nome || 'Usuário'}" class="search-avatar">
                    <div>
                        <div class="search-title">${u.nome || 'Usuário'}</div>
                        <div class="search-subtitle">${u.subtitulo || ''}</div>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
        searchResultsContainer.innerHTML = html;
        if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');

        searchResultsContainer.querySelectorAll('.search-user').forEach(item => {
            item.addEventListener('click', () => {
                const targetUserId = item.dataset.userId;
                if (targetUserId) window.location.href = `/perfil.html?id=${targetUserId}`;
            });
        });
    }

    function renderSearchResultsUsuarios(data) {
        if (!searchResultsContainer) return;
        const { usuarios = [] } = data || {};
        if (!usuarios.length) {
            searchResultsContainer.innerHTML = `<div class="search-results-empty">Nenhuma pessoa encontrada.</div>`;
            if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');
            return;
        }

        let html = '<div class="search-results-box">';
        html += '<div class="search-section"><h4>Usuários</h4>';
        usuarios.forEach(u => {
            const foto = u.avatarUrl || u.foto || 'imagens/default-user.png';
            const cidadeEstado = [u.cidade, u.estado].filter(Boolean).join(' - ');
            const subtitulo = `${u.atuacao || ''} ${cidadeEstado ? '• ' + cidadeEstado : ''}`.trim();
            html += `
                <div class="search-item search-user" data-user-id="${u._id}">
                    <img src="${foto}" alt="${u.nome}" class="search-avatar">
                    <div>
                        <div class="search-title">${u.nome}</div>
                        <div class="search-subtitle">${subtitulo}</div>
                    </div>
                </div>
            `;
        });
        html += '</div></div>';
        searchResultsContainer.innerHTML = html;
        if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');

        searchResultsContainer.querySelectorAll('.search-user').forEach(item => {
            item.addEventListener('click', () => {
                const targetUserId = item.dataset.userId;
                if (targetUserId) {
                    const nome = item.querySelector('.search-title')?.textContent?.trim() || '';
                    const subtitulo = item.querySelector('.search-subtitle')?.textContent?.trim() || '';
                    const foto = item.querySelector('img')?.getAttribute('src') || '';
                    pushUserToHistory({ id: targetUserId, nome, subtitulo, foto });
                    window.location.href = `/perfil.html?id=${targetUserId}`;
                }
            });
        });
    }

    async function buscarUsuariosNoServidor(termo) {
        const q = (termo || '').trim();
        if (!q) {
            if (headerEl?.classList?.contains('search-open') && window.innerWidth <= 768) {
                renderSearchHistoryUsers();
            } else {
                if (searchResultsContainer) searchResultsContainer.innerHTML = '';
                if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
            }
            return;
        }

        try {
            const response = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, { headers: getAuthHeaders() });
            const data = await response.json();
            if (!response.ok || !data.success) return;
            renderSearchResultsUsuarios(data);
        } catch (err) {
            console.error('Erro ao chamar /api/busca:', err);
        }
    }

    function abrirBuscaNaPagina() {
        if (!garantirElementosBusca()) return;
        headerEl && headerEl.classList.add('search-open');
        try { searchInput && searchInput.focus(); } catch {}
        const q = (searchInput?.value || '').trim();
        if (!q) renderSearchHistoryUsers();
    }

    if (searchToggleBtn) {
        searchToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            abrirBuscaNaPagina();
        });
    }

    if (searchInput) {
        garantirElementosBusca();
        searchInput.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            const valor = searchInput.value;
            buscaTimeout = setTimeout(() => buscarUsuariosNoServidor(valor), 200);
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarUsuariosNoServidor(searchInput.value);
            } else if (e.key === 'Escape') {
                fecharBuscaUI();
            }
        });
    }

    if (bottomNavSearchBtn) bottomNavSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        abrirBuscaNaPagina();
    });
    if (bottomNavNotificationsBtn) bottomNavNotificationsBtn.addEventListener('click', () => {
        const btnNotificacoes = document.getElementById('btn-notificacoes');
        if (btnNotificacoes) {
            btnNotificacoes.click();
        }
    });
    if (bottomNavSettingsBtn) bottomNavSettingsBtn.addEventListener('click', () => {
        // já está em configurações
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- Listeners de Logout ---
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); 
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }
    function doLogout() {
        // Mesma lógica do confirmLogoutYesBtn
            const modalPropostas = document.getElementById('modal-propostas');
        if (modalPropostas) modalPropostas.classList.add('hidden');
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear();
        if (jaLogou) localStorage.setItem('helpy-ja-logou', jaLogou);
            window.location.href = 'login.html';
    }

    function hideInlineLogoutConfirm() {
        if (logoutInlineConfirm) logoutInlineConfirm.classList.remove('visible');
    }

    // Mobile: confirmação inline perto do botão "Sair"
    if (logoutButtonMobile) {
        logoutButtonMobile.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.innerWidth <= 768 && logoutInlineConfirm) {
                logoutInlineConfirm.classList.toggle('visible');
                return;
            }
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }

    if (logoutInlineYes) {
        logoutInlineYes.addEventListener('click', (e) => {
            e.preventDefault();
            doLogout();
        });
    }
    if (logoutInlineNo) {
        logoutInlineNo.addEventListener('click', (e) => {
            e.preventDefault();
            hideInlineLogoutConfirm();
        });
    }

    // Fecha confirmação inline ao clicar fora (só mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;
        const t = e.target;
        if (!logoutInlineConfirm || !logoutButtonMobile) return;
        if (logoutInlineConfirm.contains(t) || logoutButtonMobile.contains(t)) return;
        hideInlineLogoutConfirm();
    });
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => doLogout());
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden'); 
        });
    }

    // --- Inicialização do Header ---
    loadHeaderInfo();

    // ============================================
    // Navegação lateral das configurações
    // ============================================
    const menuItems = document.querySelectorAll('.config-menu-item');
    const sections = document.querySelectorAll('.config-section');

    function ativarSecao(sectionId) {
        sections.forEach(sec => {
            sec.classList.toggle('active', sec.id === sectionId);
        });
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const alvo = item.getAttribute('data-section');
            if (alvo) {
                ativarSecao(alvo);
                // Em telas pequenas, rola suavemente até a seção escolhida
                if (window.innerWidth <= 900) {
                    const alvoEl = document.getElementById(alvo);
                    if (alvoEl) {
                        const headerOffset = 80; // altura aproximada do header fixo
                        const y = alvoEl.getBoundingClientRect().top + window.scrollY - headerOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }
            }
        });
    });

    // Mantém "Dados pessoais" como padrão se nada estiver selecionado
    if (!document.querySelector('.config-menu-item.active') && menuItems[0]) {
        menuItems[0].classList.add('active');
        const alvo = menuItems[0].getAttribute('data-section');
        if (alvo) ativarSecao(alvo);
    }

    // ============================================
    // Personalização - Tema (Modo Escuro)
    // ============================================
    const darkModeToggleConfig = document.getElementById('dark-mode-toggle-config');
    const htmlElement = document.documentElement;

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
            if (darkModeToggleConfig) darkModeToggleConfig.checked = true;
        } else {
            htmlElement.classList.remove('dark-mode');
            if (darkModeToggleConfig) darkModeToggleConfig.checked = false;
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (darkModeToggleConfig) {
        darkModeToggleConfig.addEventListener('change', async () => {
            const theme = darkModeToggleConfig.checked ? 'dark' : 'light';
            applyTheme(theme);
            localStorage.setItem('theme', theme);

            // Atualiza preferência no servidor (mesma lógica do feed)
            if (loggedInUserId && token) {
                try {
                    const response = await fetch('/api/user/theme', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ tema: theme })
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.message || 'Erro ao atualizar o tema');
                    }
                } catch (error) {
                    console.error('Erro ao atualizar preferência de tema:', error);
                    const revertedTheme = theme === 'dark' ? 'light' : 'dark';
                    applyTheme(revertedTheme);
                    localStorage.setItem('theme', revertedTheme);
                    darkModeToggleConfig.checked = revertedTheme === 'dark';
                    alert('Não foi possível salvar sua preferência de tema. Tente novamente.');
                }
            }
        });
    }

    // ============================================
    // Dados Pessoais - carregar e salvar
    // ============================================
    const formDadosPessoais = document.getElementById('form-dados-pessoais');
    const inputNomeCfg = document.getElementById('cfg-nome');
    const inputSobrenomeCfg = document.getElementById('cfg-sobrenome');
    const inputEmailCfg = document.getElementById('cfg-email');
    const inputIdadeCfg = document.getElementById('cfg-idade');
    const inputTelefoneCfg = document.getElementById('cfg-telefone');
    const inputCidadeCfg = document.getElementById('cfg-cidade');
    const inputEstadoCfg = document.getElementById('cfg-estado');
    const inputAtuacaoCfg = document.getElementById('cfg-atuacao');
    const atuacaoGroupCfg = document.getElementById('cfg-atuacao-group');
    const msgDadosPessoais = document.getElementById('msg-dados-pessoais');

    async function carregarDadosPessoais() {
        if (!formDadosPessoais || !token) return;

        try {
            const resp = await fetch('/api/usuario/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) {
                throw new Error('Não foi possível carregar seus dados.');
            }
            const payload = await resp.json();
            const user = payload?.usuario || payload?.user || payload;

            const userTipo = String(user?.tipo || localStorage.getItem('userType') || '').toLowerCase();
            const isEmpresa = userTipo === 'empresa';
            if (atuacaoGroupCfg) {
                atuacaoGroupCfg.style.display = isEmpresa ? 'none' : '';
            }

            const nomeCompleto = String(user?.nome || '').trim();
            const partesNome = nomeCompleto.split(/\s+/).filter(Boolean);
            const nome = partesNome.length ? partesNome[0] : '';
            const sobrenome = partesNome.length > 1 ? partesNome.slice(1).join(' ') : '';
            if (inputNomeCfg) inputNomeCfg.value = nome;
            if (inputSobrenomeCfg) inputSobrenomeCfg.value = sobrenome;
            if (inputEmailCfg) inputEmailCfg.value = user.email || '';
            if (inputIdadeCfg) inputIdadeCfg.value = user.idade || '';
            if (inputTelefoneCfg) inputTelefoneCfg.value = user.telefone || '';
            if (inputCidadeCfg) inputCidadeCfg.value = user.cidade || '';
            if (inputEstadoCfg) inputEstadoCfg.value = user.estado || '';
            if (inputAtuacaoCfg && !isEmpresa) inputAtuacaoCfg.value = user.atuacao || '';
        } catch (error) {
            console.error('Erro ao carregar dados pessoais:', error);
            if (msgDadosPessoais) {
                msgDadosPessoais.textContent = 'Erro ao carregar seus dados. Tente novamente mais tarde.';
            }
        }
    }

    if (formDadosPessoais) {
        formDadosPessoais.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!loggedInUserId || !token) return;

            const salvarBtn = formDadosPessoais.querySelector('.salvar-btn');
            if (salvarBtn) {
                salvarBtn.disabled = true;
                salvarBtn.classList.add('saving');
            }
            if (msgDadosPessoais) msgDadosPessoais.textContent = '';

            try {
                const formData = new FormData();
                const firstName = String(inputNomeCfg && inputNomeCfg.value ? inputNomeCfg.value : '').trim();
                const lastName = String(inputSobrenomeCfg && inputSobrenomeCfg.value ? inputSobrenomeCfg.value : '').trim();
                const nomeCompleto = `${firstName} ${lastName}`.trim();
                formData.append('nome', nomeCompleto);
                if (inputIdadeCfg) formData.append('idade', inputIdadeCfg.value || '');
                if (inputTelefoneCfg) formData.append('telefone', inputTelefoneCfg.value.trim());
                if (inputCidadeCfg) formData.append('cidade', inputCidadeCfg.value.trim());
                if (inputEstadoCfg) formData.append('estado', inputEstadoCfg.value.trim());
                if (inputAtuacaoCfg && (!atuacaoGroupCfg || atuacaoGroupCfg.style.display !== 'none')) {
                    formData.append('atuacao', inputAtuacaoCfg.value.trim());
                }

                const resp = await fetch(`/api/editar-perfil/${loggedInUserId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                const data = await resp.json();
                if (!resp.ok || !data.success) {
                    throw new Error(data.message || 'Erro ao salvar dados.');
                }

                const user = data.user;
                if (user.nome) {
                    localStorage.setItem('userName', user.nome);
                }
                if (user.avatarUrl || user.foto) {
                    localStorage.setItem('userPhotoUrl', user.avatarUrl || user.foto);
                }
                loadHeaderInfo();

                if (msgDadosPessoais) {
                    msgDadosPessoais.textContent = 'Dados atualizados com sucesso.';
                }
            } catch (error) {
                console.error('Erro ao salvar dados pessoais:', error);
                if (msgDadosPessoais) {
                    msgDadosPessoais.textContent = 'Erro ao salvar seus dados. ' + (error.message || '');
                }
            } finally {
                if (salvarBtn) {
                    salvarBtn.disabled = false;
                    salvarBtn.classList.remove('saving');
                }
            }
        });
    }

    // Carrega os dados assim que a página de configurações estiver pronta
    carregarDadosPessoais();

    // ============================================
    // Melhorar clique dos toggles (linha inteira clicável)
    // ============================================
    const toggleRows = document.querySelectorAll('.config-item-toggle');
    toggleRows.forEach(row => {
        row.addEventListener('click', (e) => {
            // Se o clique foi diretamente no input ou no próprio switch,
            // deixa o comportamento padrão do navegador (para não dar toggle duplo)
            if (e.target && e.target.tagName === 'INPUT') return;
            if (e.target && e.target.closest && e.target.closest('label.switch')) return;

            const checkbox = row.querySelector('input[type="checkbox"]');
            if (!checkbox) return;

            checkbox.checked = !checkbox.checked;
            // Dispara evento change para qualquer lógica extra (ex: tema)
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
});

