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

    let loggedUserEmail = null;
    let loggedUserCpf = null;

    let countdownInterval = null;

    function startCountdown() {
        if (countdownInterval) clearInterval(countdownInterval);
        
        function update() {
            const timers = document.querySelectorAll('.countdown-timer');
            timers.forEach(el => {
                const createdAtStr = el.dataset.createdAt;
                if (!createdAtStr) return;
                
                const created = new Date(createdAtStr);
                const now = new Date();
                const expire = new Date(created.getTime() + 24 * 60 * 60 * 1000);
                const diff = expire - now;
                
                if (diff <= 0) {
                    el.textContent = 'Expirado';
                    el.style.background = '#ef4444';
                } else {
                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    el.textContent = `${h}h ${m}m ${s}s`;
                }
            });
        }
        
        update();
        countdownInterval = setInterval(update, 1000);
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

            // Filtra anúncios expirados (inativos > 24h)
            const anunciosVisiveis = anuncios.filter(a => {
                const ativo = !!a?.ativo;
                if (ativo) return true;
                const createdAt = a?.createdAt ? new Date(a.createdAt) : new Date();
                const now = new Date();
                const expireTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
                return now < expireTime; 
            });

            if (anunciosVisiveis.length === 0) {
                container.innerHTML = 'Você ainda não criou nenhum anúncio ou seus anúncios expiraram.';
                return;
            }

            container.innerHTML = anunciosVisiveis.map((a) => {
                const titulo = a?.titulo ? String(a.titulo) : 'Anúncio';
                const descricao = a?.descricao ? String(a.descricao) : '';
                const plano = a?.plano ? String(a.plano) : 'basico';
                const ativo = !!a?.ativo;
                const imagemUrl = a?.imagemUrl ? String(a.imagemUrl) : '';
                const preco = plano === 'premium' ? 'R$ 39,90' : 'R$ 1,00';
                const planoBadge = plano === 'premium' ? 'PREMIUM' : 'BÁSICO';
                const fim = a?.fimEm ? new Date(a.fimEm) : null;
                const createdAt = a?.createdAt ? new Date(a.createdAt) : new Date();
                
                // Lógica de expiração e status
                let leftPill = '';
                let btnLabel = '';
                let btnClass = 'salvar-btn btn-ghost'; // default
                let targetPlano = plano; // Default to current plan (for first payment)

                if (ativo) {
                    // Ativo
                    const expiraTxt = fim ? `Expira em: ${('0'+fim.getDate()).slice(-2)}/${('0'+(fim.getMonth()+1)).slice(-2)}/${fim.getFullYear()}` : '';
                    leftPill = `<span style="background: rgba(0,0,0,0.6); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 999px;">${expiraTxt}</span>`;
                    
                    if (plano === 'basico') {
                        btnLabel = 'Impulsionar'; // Upgrade
                        targetPlano = 'premium';
                    } else {
                        btnLabel = 'Renovar';
                        targetPlano = 'premium';
                    }
                } else {
                    // Inativo (Aguardando pagamento ou expirado)
                    // Verifica se está dentro das 24h
                    const now = new Date();
                    const expireTime = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
                    const isRecent = now < expireTime;
                    
                    if (isRecent) {
                        // Mostra countdown
                        leftPill = `<span class="countdown-timer" data-created-at="${createdAt.toISOString()}" style="background: #eab308; color: #000; font-weight: bold; font-size: 11px; padding: 3px 8px; border-radius: 999px;">Calculando...</span>`;
                        btnLabel = 'Pagar';
                        targetPlano = plano; // Pay for what was selected
                    } else {
                        // Expirado
                        leftPill = `<span style="background: #ef4444; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 999px;">Expirado</span>`;
                        btnLabel = 'Pagar'; 
                        targetPlano = plano;
                    }
                }

                const payPlano = targetPlano;
                const bgStyle = imagemUrl
                    ? `background-image: url('${imagemUrl.replace(/'/g, '%27')}'); background-size: cover; background-position: center;`
                    : `background: linear-gradient(135deg, #111 0%, #1f2937 100%);`;
                const safeTitle = titulo.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                const safeDesc = descricao.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

                return `
                    <div style="padding: 12px 0; border-bottom: 1px solid rgba(148,163,184,0.18);">
                        <div class="anuncio-card-preview" style="position: relative; height: 150px; border-radius: 12px; overflow: hidden; ${bgStyle}">
                            <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.75) 100%);"></div>
                            <div style="position: absolute; top: 8px; left: 8px; display: flex; gap: 6px;">
                                ${leftPill}
                            </div>
                            <div style="position: absolute; top: 8px; right: 8px;">
                                <span style="background: ${plano === 'premium' ? 'rgba(245,158,11,0.95)' : 'rgba(100,116,139,0.95)'}; color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 999px;">${planoBadge}</span>
                            </div>
                            <div style="position: absolute; left: 12px; right: 12px; bottom: 10px; color: #fff;">
                                <div style="font-weight: 700; font-size: 16px; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${safeTitle}</div>

                            </div>
                            <button class="${btnClass}" data-pay-anuncio="${a?._id}" data-pay-plano="${payPlano}" data-current-plano="${plano}" data-ativo="${ativo}" data-title="${safeTitle}" data-imagem="${encodeURIComponent(imagemUrl)}" data-descricao="${safeDesc}" style="position: absolute; right: 14px; bottom: 8px; padding: 5px 12px; font-size: 12px; line-height: 1.1; min-width: auto; width: auto; border-width: 1px;">${btnLabel}</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Adiciona listeners aos botões
            const payBtns = container.querySelectorAll('[data-pay-anuncio]');
            payBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const anuncioId = btn.dataset.payAnuncio;
                    const plano = btn.dataset.payPlano;
                    const currentPlano = btn.dataset.currentPlano;
                    const ativo = btn.dataset.ativo === 'true'; // Capture ativo status
                    const titulo = btn.dataset.title;
                    const imagemUrl = decodeURIComponent(btn.dataset.imagem || '');
                    const descricao = btn.dataset.descricao;

                    const payload = {
                        anuncioId, 
                        plano,
                        titulo,
                        descricao,
                        imagemUrl,
                        currentPlano,
                        ativo, // Pass ativo to payload
                        isUpgrade: (ativo && currentPlano === 'basico' && plano === 'premium') // Only upgrade if active
                    };
                    abrirModalPix(payload);
                });
            });

            // Inicia countdown
            startCountdown();
            
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
            const user = data?.usuario || data?.user || data;

            if (user) {
                loggedUserEmail = user.email || null;
                loggedUserCpf = user.cpf || null;
                if (loggedUserEmail) {
                    localStorage.setItem('userEmail', loggedUserEmail);
                }
                if (loggedUserCpf) {
                    localStorage.setItem('userCpf', String(loggedUserCpf));
                }
            }

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
        const toRevoke = adPreviewObjectUrl || null;
        adPreviewObjectUrl = null;
        if (adPreviewImg) {
            try { adPreviewImg.removeAttribute('src'); } catch (_) {}
            try { adPreviewImg.src = ''; } catch (_) {}
        }
        if (adImagePicker) adImagePicker.classList.remove('has-image');
        if (toRevoke) {
            try {
                // Aguarda o ciclo de renderização para garantir que o <img> já limpou o src
                requestAnimationFrame(() => {
                    try { URL.revokeObjectURL(toRevoke); } catch (_) {}
                });
            } catch (_) {
                try { URL.revokeObjectURL(toRevoke); } catch (_) {}
            }
        }
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

    let pendingAnuncioPagamento = null;
    let pixPollingInterval = null;
    let pixCurrentPaymentId = null;
    let pixIsGenerating = false;
    const pixModal = document.getElementById('modal-pix-anuncio');
    const pixEmailInput = document.getElementById('pix-email');
    const pixCpfInput = document.getElementById('pix-cpf');
    const pixEmailGroup = document.getElementById('pix-email-group');
    const pixCpfGroup = document.getElementById('pix-cpf-group');
    const pixQrWrapper = document.getElementById('pix-qrcode-wrapper');
    const pixQrImg = document.getElementById('pix-qrcode-img');
    const pixCopiaCola = document.getElementById('pix-copia-cola');
    const pixCopyBtn = document.getElementById('pix-copy-btn');
    const pixAnuncioPreview = document.getElementById('pix-anuncio-preview');
    const pixAnuncioPreviewImgWrapper = document.getElementById('pix-anuncio-preview-img-wrapper');
    const pixAnuncioPreviewImg = document.getElementById('pix-anuncio-preview-img');
    const pixAnuncioPreviewImgFallback = document.getElementById('pix-anuncio-preview-img-fallback');
    const pixAnuncioPreviewTitulo = document.getElementById('pix-anuncio-preview-titulo');
    const pixAnuncioPreviewDescricao = document.getElementById('pix-anuncio-preview-descricao');
    const pixMsg = document.getElementById('pix-msg');
    const pixGerarBtn = document.getElementById('pix-gerar-btn');
    const pixCartaoBtn = document.getElementById('pix-cartao-btn');
    const pixFecharBtn = document.getElementById('pix-fechar-btn');
    const pixModalEtapaTexto = document.getElementById('pix-modal-etapa-texto');
    const pixAlterarDadosBtn = document.getElementById('pix-alterar-dados-btn');

    function limparEstadoPix() {
        pixCurrentPaymentId = null;
        pixIsGenerating = false;
        if (pixPollingInterval) {
            clearInterval(pixPollingInterval);
            pixPollingInterval = null;
        }
    }

    function renderPixAnuncioPreview(payload) {
        if (!pixAnuncioPreview || !pixAnuncioPreviewTitulo || !pixAnuncioPreviewDescricao) return;
        if (!payload) {
            pixAnuncioPreview.classList.add('hidden');
            pixAnuncioPreviewTitulo.textContent = '';
            pixAnuncioPreviewDescricao.textContent = '';
            if (pixAnuncioPreviewImg) pixAnuncioPreviewImg.style.display = 'none';
            if (pixAnuncioPreviewImgFallback) pixAnuncioPreviewImgFallback.style.display = '';
            return;
        }
        const titulo = payload.titulo || 'Seu anúncio';
        const descricao = payload.descricao || '';
        const imagemUrl = payload.imagemUrl || '';
        pixAnuncioPreviewTitulo.textContent = titulo;
        pixAnuncioPreviewDescricao.textContent = descricao;
        if (imagemUrl && pixAnuncioPreviewImg) {
            pixAnuncioPreviewImg.src = imagemUrl;
            pixAnuncioPreviewImg.style.display = 'block';
            if (pixAnuncioPreviewImgFallback) pixAnuncioPreviewImgFallback.style.display = 'none';
        } else {
            if (pixAnuncioPreviewImg) pixAnuncioPreviewImg.style.display = 'none';
            if (pixAnuncioPreviewImgFallback) pixAnuncioPreviewImgFallback.style.display = '';
        }
        pixAnuncioPreview.classList.remove('hidden');
    }

    async function verificarStatusPix() {
        if (!pixCurrentPaymentId) return;
        try {
            const currentId = pixCurrentPaymentId;
            const resp = await fetch(`/api/pagamentos/mercadopago/pix/status?id=${encodeURIComponent(pixCurrentPaymentId)}`, {
                headers: getAuthHeaders()
            });
            const data = await resp.json().catch(() => ({}));
            const status = data?.status;
            if (status === 'approved') {
                try {
                    if (currentId) {
                        const confirmResp = await fetch('/api/pagamentos/mercadopago/pix/confirm', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                ...getAuthHeaders()
                            },
                            body: JSON.stringify({ id: currentId })
                        });
                        if (!confirmResp.ok) {
                            const errData = await confirmResp.json().catch(() => ({}));
                            console.error('Erro na confirmação:', errData);
                            if (pixMsg) pixMsg.textContent = 'Pagamento aprovado, mas falha ao ativar anúncio: ' + (errData.message || 'Erro desconhecido');
                            return; // Não redireciona se falhou
                        }
                    }
                } catch (e) {
                    console.error('Erro de rede na confirmação:', e);
                    if (pixMsg) pixMsg.textContent = 'Erro de conexão ao confirmar anúncio. Contate o suporte.';
                    return;
                }
                limparEstadoPix();
                if (pixMsg) pixMsg.textContent = 'Pagamento aprovado! Redirecionando...';
                window.location.href = 'configuracoes-conta.html?pagamento=sucesso&section=sec-anuncios';
            } else if (status === 'rejected' || status === 'cancelled') {
                limparEstadoPix();
                if (pixMsg) pixMsg.textContent = 'Pagamento não foi aprovado. Tente gerar um novo Pix.';
            }
        } catch (e) {
            console.error('Erro ao consultar status do Pix:', e);
        }
    }

    function abrirModalPix(payload) {
        pendingAnuncioPagamento = payload;
        limparEstadoPix();
        if (pixModal) {
            pixModal.classList.remove('hidden');
        }
        if (pixQrWrapper) pixQrWrapper.classList.add('hidden');
        if (pixQrImg) pixQrImg.src = '';
        if (pixCopiaCola) pixCopiaCola.value = '';
        if (pixMsg) pixMsg.textContent = '';
        renderPixAnuncioPreview(payload);
        const storedEmail = loggedUserEmail || localStorage.getItem('userEmail') || localStorage.getItem('email') || '';
        const storedCpf = loggedUserCpf || localStorage.getItem('userCpf') || '';
        const hasSaved = !!storedEmail && !!storedCpf;
        if (pixEmailInput) {
            pixEmailInput.value = storedEmail || '';
        }
        if (pixCpfInput) {
            pixCpfInput.value = storedCpf || '';
        }
        if (pixEmailGroup && pixCpfGroup) {
            if (hasSaved) {
                pixEmailGroup.style.display = 'none';
                pixCpfGroup.style.display = 'none';
            } else {
                pixEmailGroup.style.display = '';
                pixCpfGroup.style.display = '';
            }
        }
        if (pixGerarBtn) {
            pixGerarBtn.style.display = hasSaved ? 'none' : '';
        }
        if (pixCopyBtn) {
            pixCopyBtn.style.display = 'none';
        }
        if (pixAlterarDadosBtn) {
            pixAlterarDadosBtn.style.display = hasSaved ? 'inline' : 'none';
        }
        if (pixModalEtapaTexto) {
            pixModalEtapaTexto.textContent = hasSaved
                ? 'Usaremos seu e-mail e CPF já salvos. Gerando Pix...'
                : 'Informe seus dados para gerar o Pix.';
        }
        if (hasSaved) {
            gerarPix();
        }
    }

    function fecharModalPix() {
        limparEstadoPix();
        if (pixModal) {
            pixModal.classList.add('hidden');
        }
    }

    if (pixAlterarDadosBtn) {
        pixAlterarDadosBtn.addEventListener('click', () => {
            if (pixEmailGroup) pixEmailGroup.style.display = '';
            if (pixCpfGroup) pixCpfGroup.style.display = '';
            if (pixAlterarDadosBtn) pixAlterarDadosBtn.style.display = 'none';
            if (pixModalEtapaTexto) {
                pixModalEtapaTexto.textContent = 'Informe seus dados para gerar o Pix.';
            }
            if (pixQrWrapper) pixQrWrapper.classList.add('hidden');
            if (pixQrImg) pixQrImg.src = '';
            if (pixCopiaCola) pixCopiaCola.value = '';
            if (pixCopyBtn) pixCopyBtn.style.display = 'none';
            if (pixGerarBtn) pixGerarBtn.style.display = '';
            if (pixMsg) pixMsg.textContent = '';
        });
    }

    if (pixFecharBtn) {
        pixFecharBtn.addEventListener('click', () => {
            fecharModalPix();
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
                const payload = {
                    titulo,
                    descricao,
                    imagemUrl,
                    linkUrl,
                    endereco,
                    numero,
                    cidade,
                    estado,
                    plano
                };

                // Cria o anúncio no banco antes de pagar
                const resp = await fetch('/api/anuncios', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...getAuthHeaders()
                    },
                    body: JSON.stringify(payload)
                });

                const data = await resp.json().catch(() => ({}));

                if (!resp.ok) {
                    if (msgAnuncio) msgAnuncio.textContent = data.message || 'Erro ao criar anúncio.';
                    return;
                }

                // Sucesso: prepara dados com ID para o pagamento
                const anuncioCriado = data.anuncio || {};
                const dadosParaPagamento = {
                    anuncioId: anuncioCriado._id || anuncioCriado.id,
                    titulo: anuncioCriado.titulo || titulo,
                    descricao: anuncioCriado.descricao || descricao,
                    imagemUrl: anuncioCriado.imagemUrl || imagemUrl,
                    plano: anuncioCriado.plano || plano,
                    ativo: false // Novo anúncio ainda não está ativo
                };

                abrirModalPix(dadosParaPagamento);
            } catch (err) {
                console.error('Erro ao criar anúncio:', err);
                if (msgAnuncio) msgAnuncio.textContent = 'Erro ao processar criação do anúncio.';
            }
        });
    }

    async function iniciarPagamentoAnuncio(anuncioId, plano) {
        try {
            const resp = await fetch('/api/pagamentos/mercadopago/preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ anuncioId, plano })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data?.init_point) {
                console.error('Erro ao iniciar pagamento:', data);
                alert(data?.message || 'Não foi possível iniciar o pagamento.');
                return;
            }
            window.location.href = data.init_point;
        } catch (error) {
            console.error('Erro ao iniciar pagamento do anúncio:', error);
            alert('Erro ao iniciar pagamento do anúncio.');
        }
    }

    // --- Mercado Pago Card Payment Brick ---
    let mp = null;
    let cardPaymentBrickController = null;
    let mpPromise = null;

    async function ensureMercadoPago() {
        if (mp) return mp;
        if (!mpPromise) {
            mpPromise = (async () => {
                try {
                    const resp = await fetch('/api/config/mp-public-key');
                    const data = await resp.json();
                    if (data.success && data.key) {
                        const key = data.key.trim();
                        console.log('Inicializando Mercado Pago com Key:', key.substring(0, 8) + '...');
                        
                        // Validação prévia da chave para evitar erros do SDK no console
                        try {
                             const checkUrl = `https://api.mercadopago.com/v1/payment_methods/search?public_key=${key}&status=active&limit=1`;
                             const checkResp = await fetch(checkUrl);
                             if (!checkResp.ok) {
                                 console.warn('Aviso: Chave pública não reconhecida pela API (404). O Mercado Pago pode não carregar.');
                                 return null;
                             }
                        } catch (checkErr) {
                             console.warn('Não foi possível validar a chave pública previamente:', checkErr);
                             // Continua para tentar com o SDK caso seja apenas erro de rede na validação
                        }

                        try {
                            mp = new MercadoPago(key, {
                                locale: 'pt-BR'
                            });
                        } catch (err) {
                            console.error('Falha ao instanciar SDK MercadoPago:', err);
                            return null;
                        }
                        return mp;
                    } else {
                        console.warn('Public Key do Mercado Pago não encontrada.');
                        return null;
                    }
                } catch (e) {
                    console.warn('Erro ao carregar Public Key do Mercado Pago:', e);
                    return null;
                }
            })();
        }
        return mpPromise;
    }

    // Tenta carregar assim que possível (removido para evitar erros no console se a chave for inválida)
    // ensureMercadoPago().catch(() => {});

    const cardContainer = document.getElementById('card-container');
    const pixContainer = document.getElementById('pix-container');
    const cardVoltarPixBtn = document.getElementById('card-voltar-pix-btn');

    async function initCardBrick(amount) {
        await ensureMercadoPago();
        if (!mp) {
            const msgEl = document.getElementById('card-msg');
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.color = '#ef4444';
                msgEl.innerHTML = '<strong>Erro de Configuração:</strong><br>A Chave Pública do Mercado Pago informada no arquivo .env é inválida ou não foi encontrada.<br>Verifique suas credenciais.';
            }
            return;
        }
        const container = document.getElementById('cardPaymentBrick_container');
        if (!container) return;
        
        console.log('Valor enviado ao Brick:', amount);

        // Limpa anterior se existir de forma robusta
        if (window.cardPaymentBrickController) {
             try {
                 await window.cardPaymentBrickController.unmount();
             } catch (e) { console.warn('Erro ao desmontar controller anterior:', e); }
             window.cardPaymentBrickController = null;
        }

        container.innerHTML = '';

        // Obtém e-mail do usuário logado (variável global ou localStorage)
        const userEmail = loggedUserEmail || localStorage.getItem('userEmail') || localStorage.getItem('email');
        
        // Em produção, DEVE usar o e-mail real do usuário.
        // Em localhost, se não houver e-mail logado, usa um fallback, mas preferencialmente usa o do usuário.
        const payerEmail = userEmail || 'user@example.com';

        console.log('Inicializando Brick com Payer Email:', payerEmail);

        const settings = {
            initialization: {
                amount: Number(amount), // Valor estrito
                payer: {
                    email: payerEmail,
                },
            },
            locale: 'pt-BR',
            customization: {
                visual: {
                    style: {
                        theme: 'dark', // Tema escuro solicitado
                        customVariables: {
                            baseColor: '#007bff', // Azul Helpy
                            outlinePrimaryColor: '#007bff',
                            buttonBackgroundColor: '#007bff',
                            buttonTextColor: '#ffffff',
                            borderRadius: '8px',
                            inputBackgroundColor: '#2d3748',
                            inputTextColor: '#ffffff',
                            inputBorderColor: '#4b5563',
                            formBackgroundColor: 'transparent', // Fundo transparente
                            secondaryColor: '#64748b'
                        }
                    },
                    hideFormTitle: true,
                },
                paymentMethods: {
                    creditCard: 'all',
                    debitCard: 'all',
                    maxInstallments: 12
                }
            },
            callbacks: {
                onReady: () => {
                    console.log('Brick pronto para uso.');
                    const msgEl = document.getElementById('card-msg');
                    if (msgEl) msgEl.style.display = 'none';
                },
                onSubmit: async (cardFormData) => {
                    console.log('Brick onSubmit acionado com dados:', cardFormData);
                    const msgEl = document.getElementById('card-msg');
                    if (msgEl) {
                        msgEl.style.display = 'block';
                        msgEl.style.color = '#eab308'; // Amarelo
                        msgEl.textContent = 'Processando pagamento...';
                    }
                    
                    // Normaliza os dados (algumas versões retornam dentro de .formData)
                    const paymentData = cardFormData.formData || cardFormData;

                    // Validação básica do token
                    if (!paymentData || !paymentData.token) {
                         console.error('Dados do formulário incompletos ou token ausente:', cardFormData);
                         if (msgEl) {
                             msgEl.style.color = '#ef4444';
                             msgEl.innerHTML = `<strong>Falha na validação:</strong><br>O Mercado Pago não gerou o token do cartão.<br>Verifique se o número do cartão é válido (use cartões de teste em localhost).`;
                         }
                         return;
                    }

                    try {
                         // Garante que identification existe
                         const payerData = paymentData.payer || {};
                         const identification = payerData.identification || { type: 'CPF', number: '' };

                         const payload = {
                             ...pendingAnuncioPagamento,
                             token: paymentData.token,
                             issuer_id: paymentData.issuer_id,
                             payment_method_id: paymentData.payment_method_id,
                             transaction_amount: Number(paymentData.transaction_amount),
                             installments: Number(paymentData.installments),
                             payer: {
                                 email: payerEmail,
                                 identification: identification
                             }
                         };
                         
                         console.log('Enviando payload para backend:', payload);

                         const resp = await fetch('/api/pagamentos/mercadopago/card', {
                             method: 'POST',
                             headers: {
                                 'Content-Type': 'application/json',
                                 ...getAuthHeaders()
                             },
                             body: JSON.stringify(payload)
                         });

                         const data = await resp.json();
                         console.log('Resposta do backend:', data);

                         if (data.success) {
                             if (msgEl) {
                                 msgEl.style.color = '#22c55e'; // Verde
                                 msgEl.textContent = 'Pagamento aprovado! Redirecionando...';
                             }
                             setTimeout(() => {
                                 window.location.href = 'configuracoes-conta.html?pagamento=sucesso&section=sec-anuncios';
                             }, 1500);
                         } else {
                             if (msgEl) {
                                 msgEl.style.color = '#ef4444';
                                 let errorMsg = data.message || 'Erro ao processar pagamento.';
                                 if (data.status_detail) errorMsg += ` (${data.status_detail})`;
                                 msgEl.innerHTML = `<strong>Erro:</strong> ${errorMsg}`;
                             }
                         }
                    } catch (e) {
                         console.error('Erro na requisição de pagamento:', e);
                         if (msgEl) {
                             msgEl.style.color = '#ef4444';
                             msgEl.textContent = 'Erro de conexão ao processar pagamento.';
                         }
                    }
                },
                onError: (error) => {
                    // Ignora erros não críticos de inicialização (ex: campos vazios ao carregar)
                    if (error && (error.type === 'non_critical' || error.cause === 'missing_payment_information')) {
                        console.log('Aviso não crítico do Brick (ignorado na UI):', error);
                        return;
                    }

                    // Log solicitado pelo usuário para debug profundo
                    console.error('Erro detalhado do Brick (onError):', error);
                    if (error && error.cause) {
                        console.error('Causa do erro (onError cause):', error.cause);
                    }
                    
                    const msgEl = document.getElementById('card-msg');
                    if (msgEl) {
                        msgEl.style.display = 'block';
                        msgEl.style.color = '#ef4444';
                        let reason = 'Erro desconhecido';
                        if (error) {
                            if (typeof error === 'string') reason = error;
                            else if (error.cause) {
                                 // Tenta extrair mensagem mais útil
                                 reason = JSON.stringify(error.cause);
                                 if (Array.isArray(error.cause)) {
                                     const codes = error.cause.map(c => c.code || c.description).join(', ');
                                     reason = `Erro no preenchimento: ${codes}`;
                                 }
                            }
                            else if (error.message) reason = error.message;
                            else reason = JSON.stringify(error);
                        }
                        msgEl.innerHTML = `<strong>Erro ao processar:</strong><br>${reason}<br>Verifique os dados e tente novamente.`;
                    }
                },
            },
        };
            
            try {
                const bricksBuilder = mp.bricks();
                window.cardPaymentBrickController = await bricksBuilder.create("payment", "cardPaymentBrick_container", settings);
            } catch (e) {
                 console.error('Erro ao criar Brick:', e);
                 const msgEl = document.getElementById('card-msg');
                 if (msgEl) {
                     msgEl.style.color = '#ef4444';
                     msgEl.textContent = 'Erro ao carregar formulário de cartão. Verifique a chave pública ou a conexão.';
                 }
            }
        }

    if (pixCartaoBtn) {
        pixCartaoBtn.addEventListener('click', async () => {
            if (!pendingAnuncioPagamento) return;
            
            // Alterna visibilidade
            if (pixContainer) pixContainer.classList.add('hidden');
            if (cardContainer) cardContainer.classList.remove('hidden');
            
            // Limpa mensagem anterior
            const msgEl = document.getElementById('card-msg');
            if (msgEl) {
                msgEl.textContent = '';
                msgEl.style.color = '#ef4444';
            }
            
            // Calcula valor
            let amount = 1.00; // Default Básico
            const planoAlvo = pendingAnuncioPagamento.plano || 'basico';
            // Se não tem anuncioId, é novo anúncio. Se tem, verifica se já está ativo.
            const isNovoAnuncio = !pendingAnuncioPagamento.anuncioId;
            const isAtivo = !!pendingAnuncioPagamento.ativo;
            const planoAtual = isNovoAnuncio ? null : (pendingAnuncioPagamento.currentPlano || 'basico');
            
            if (planoAlvo === 'premium') {
                if (!isNovoAnuncio && isAtivo && planoAtual === 'basico') {
                    // Upgrade: Diferença (Somente se já estiver ativo/pago)
                    amount = 38.90; // 39.90 - 1.00
                } else {
                    // Novo Premium ou Renovação Premium ou Primeiro Pagamento Premium
                    amount = 39.90;
                }
            } else {
                // Básico (Novo ou Renovação)
                amount = 1.00;
            }
            
            // Inicializa Brick
            await initCardBrick(amount);
        });
    }
    
    if (cardVoltarPixBtn) {
        cardVoltarPixBtn.addEventListener('click', () => {
            if (cardContainer) cardContainer.classList.add('hidden');
            if (pixContainer) pixContainer.classList.remove('hidden');
        });
    }

    async function gerarPix() {
        if (pixIsGenerating) return;
        if (!pendingAnuncioPagamento) return;
        const email = pixEmailInput ? pixEmailInput.value.trim() : '';
        const cpf = pixCpfInput ? pixCpfInput.value.trim() : '';
        if (!email || !cpf) {
            if (pixMsg) pixMsg.textContent = 'Preencha e-mail e CPF para gerar o Pix.';
            return;
        }
        pixIsGenerating = true;
        if (pixMsg) pixMsg.textContent = 'Gerando Pix...';
        if (pixQrWrapper) pixQrWrapper.classList.add('hidden');
        if (pixQrImg) pixQrImg.src = '';
        if (pixCopiaCola) pixCopiaCola.value = '';
        if (pixCopyBtn) pixCopyBtn.style.display = 'none';
        if (pixGerarBtn) pixGerarBtn.style.display = 'none';
        try {
            const body = Object.assign({}, pendingAnuncioPagamento, { email, cpf });
            const resp = await fetch('/api/pagamentos/mercadopago/pix', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify(body)
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data?.success) {
                if (pixMsg) pixMsg.textContent = data?.message || 'Não foi possível gerar o Pix.';
                if (pixGerarBtn) pixGerarBtn.style.display = '';
                return;
            }
            if (!data.qr_code && !data.qr_code_base64) {
                if (pixMsg) pixMsg.textContent = 'Pix criado, mas não retornou QR Code.';
                if (pixGerarBtn) pixGerarBtn.style.display = '';
                return;
            }
            pixCurrentPaymentId = data.id || data.payment_id || null;
            if (pixQrWrapper) pixQrWrapper.classList.remove('hidden');
            if (pixCopiaCola && data.qr_code) {
                pixCopiaCola.value = data.qr_code;
            }
            if (pixQrImg) {
                if (data.qr_code_base64) {
                    pixQrImg.src = 'data:image/png;base64,' + data.qr_code_base64;
                } else if (data.ticket_url) {
                    pixQrImg.src = '';
                }
            }
            if (pixCopyBtn) pixCopyBtn.style.display = '';
            if (pixEmailGroup) pixEmailGroup.style.display = 'none';
            if (pixCpfGroup) pixCpfGroup.style.display = 'none';
            if (pixAlterarDadosBtn) pixAlterarDadosBtn.style.display = 'inline';
            if (pixMsg) pixMsg.textContent = 'Use o QR Code para pagar. Aguardando confirmação...';
            loggedUserEmail = email;
            loggedUserCpf = cpf;
            try {
                if (email) localStorage.setItem('userEmail', email);
                if (cpf) localStorage.setItem('userCpf', cpf);
            } catch (e) {}
            if (pixModalEtapaTexto) pixModalEtapaTexto.textContent = 'Pix gerado. Finalize o pagamento no seu banco.';
            if (pixCurrentPaymentId) {
                if (pixPollingInterval) {
                    clearInterval(pixPollingInterval);
                    pixPollingInterval = null;
                }
                pixPollingInterval = setInterval(verificarStatusPix, 5000);
            }
        } catch (error) {
            console.error('Erro ao gerar Pix:', error);
            if (pixMsg) pixMsg.textContent = 'Erro ao gerar Pix.';
        } finally {
            pixIsGenerating = false;
        }
    }

    if (pixGerarBtn) {
        pixGerarBtn.addEventListener('click', () => {
            gerarPix();
        });
    }

    if (pixCopyBtn) {
        pixCopyBtn.addEventListener('click', async () => {
            const code = pixCopiaCola ? pixCopiaCola.value : '';
            if (!code) return;
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(code);
                } else {
                    const temp = document.createElement('textarea');
                    temp.value = code;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand('copy');
                    document.body.removeChild(temp);
                }
                if (pixMsg) pixMsg.textContent = 'Código Pix copiado.';
            } catch (e) {
                console.error('Erro ao copiar código Pix:', e);
                if (pixMsg) pixMsg.textContent = 'Não foi possível copiar o código Pix.';
            }
        });
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pay-anuncio]');
        if (!btn) return;
        const id = btn.getAttribute('data-pay-anuncio');
        if (!id) return;
        const plano = btn.getAttribute('data-pay-plano') || 'premium';
        const currentPlano = btn.getAttribute('data-current-plano') || 'basico';
        const titulo = btn.getAttribute('data-title') || '';
        const imagem = btn.getAttribute('data-imagem') ? decodeURIComponent(btn.getAttribute('data-imagem')) : '';
        const descricao = btn.getAttribute('data-descricao') || '';
        abrirModalPix({
            anuncioId: id,
            plano,
            currentPlano,
            titulo,
            imagemUrl: imagem,
            descricao
        });
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
    const btnExcluirConta = document.getElementById('btn-excluir-conta');
    if (btnExcluirConta) {
        btnExcluirConta.textContent = 'Excluir conta';
        btnExcluirConta.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirma = confirm('Tem certeza? Todos os seus anúncios e vídeos de 24h serão apagados permanentemente.');
            if (!confirma) return;
            try {
                const resp = await fetch('/api/user/me', {
                    method: 'DELETE',
                    headers: getAuthHeaders()
                });
                const data = await resp.json().catch(() => ({}));
                if (!resp.ok || data?.success === false) {
                    throw new Error(data?.message || 'Não foi possível excluir sua conta.');
                }
                doLogout();
            } catch (err) {
                alert(err.message || 'Erro ao excluir conta.');
            }
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
    const menu = document.querySelector('.config-menu');
    let menuColapsado = false;

    function mostrarTodosOsItensMenu() {
        if (menu) menu.classList.remove('menu-colapsado');
        menuColapsado = false;
    }

    function mostrarApenasItemAtivo() {
        if (menu) menu.classList.add('menu-colapsado');
        menuColapsado = true;
    }

    function inicializarAccordion() {
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                const alvo = item.getAttribute('data-section');
                if (!alvo) return;

                const alvoEl = document.getElementById(alvo);
                const jaAtivo = item.classList.contains('active') && alvoEl && alvoEl.classList.contains('active');

                if (menuColapsado && jaAtivo) {
                    mostrarTodosOsItensMenu();
                    return;
                }

                menuItems.forEach(i => i.classList.remove('active'));
                sections.forEach(sec => sec.classList.remove('active'));

                item.classList.add('active');
                if (alvoEl) {
                    alvoEl.classList.add('active');
                    if (window.innerWidth <= 900) {
                        const headerOffset = 80;
                        const y = alvoEl.getBoundingClientRect().top + window.scrollY - headerOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                }

                mostrarApenasItemAtivo();
            });
        });

        if (!document.querySelector('.config-menu-item.active') && menuItems[0]) {
            menuItems[0].classList.add('active');
        }
        const ativa = document.querySelector('.config-menu-item.active');
        if (ativa) {
            const alvo = ativa.getAttribute('data-section');
            if (alvo) {
                const alvoEl = document.getElementById(alvo);
                if (alvoEl) alvoEl.classList.add('active');
            }
        }
    }

    if (menuItems.length && sections.length) {
        inicializarAccordion();
        try {
            const params = new URLSearchParams(window.location.search || '');
            const sectionParam = params.get('section');
            if (sectionParam) {
                const item = Array.from(menuItems).find(i => i.getAttribute('data-section') === sectionParam);
                const alvoEl = document.getElementById(sectionParam);
                if (item && alvoEl) {
                    menuItems.forEach(i => i.classList.remove('active'));
                    sections.forEach(sec => sec.classList.remove('active'));
                    item.classList.add('active');
                    alvoEl.classList.add('active');
                    mostrarApenasItemAtivo();
                    if (window.innerWidth <= 900) {
                        const headerOffset = 80;
                        const y = alvoEl.getBoundingClientRect().top + window.scrollY - headerOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                    const pagamento = params.get('pagamento');
                    if (pagamento === 'sucesso') {
                        setTimeout(() => {
                            try { carregarMeusAnuncios(); } catch (e) {}
                        }, 700);
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    // ============================================
    // Personalização - Tema (Modo Escuro)
    // ============================================
    const htmlElement = document.documentElement;

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
        } else {
            htmlElement.classList.remove('dark-mode');
        }
    }

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const temaContainerConfig = document.querySelector('.tema-selecao-config');
    const temaOpcoesConfig = document.querySelectorAll('.tema-selecao-config .tema-opcao');

    async function salvarTema(theme) {
        applyTheme(theme);
        localStorage.setItem('theme', theme);

        if (temaContainerConfig) {
            temaContainerConfig.classList.remove('tema-light-ativo', 'tema-dark-ativo');
            temaContainerConfig.classList.add(theme === 'dark' ? 'tema-dark-ativo' : 'tema-light-ativo');
        }

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
                alert('Não foi possível salvar sua preferência de tema. Tente novamente.');
            }
        }
    }

    if (temaOpcoesConfig.length) {
        temaOpcoesConfig.forEach(opcao => {
            const tema = opcao.getAttribute('data-tema') || 'light';
            if (tema === savedTheme) {
                opcao.classList.add('selected');
            } else {
                opcao.classList.remove('selected');
            }
            opcao.addEventListener('click', () => {
                temaOpcoesConfig.forEach(o => o.classList.remove('selected'));
                opcao.classList.add('selected');
                salvarTema(tema);
            });
        });

        if (temaContainerConfig) {
            temaContainerConfig.classList.remove('tema-light-ativo', 'tema-dark-ativo');
            temaContainerConfig.classList.add(savedTheme === 'dark' ? 'tema-dark-ativo' : 'tema-light-ativo');
        }
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
                if (user.cidade) {
                    localStorage.setItem('userCity', user.cidade);
                    // Força recarregamento da home se estiver em SPA ou recarrega a página
                    // Se for página separada, o usuário vai navegar de volta.
                    // Se for modal, podemos disparar um evento customizado.
                    window.dispatchEvent(new CustomEvent('profileUpdated', { detail: { cidade: user.cidade } }));
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
    // Botão Now (redireciona para o feed abrindo o painel)
    // ============================================
    const headerNowBtn = document.getElementById('header-now');
    if (headerNowBtn) {
        headerNowBtn.addEventListener('click', () => {
            localStorage.setItem('feed-open-panel', 'now');
            window.location.href = '/';
        });
    }

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
