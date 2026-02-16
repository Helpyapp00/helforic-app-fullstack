document.addEventListener('DOMContentLoaded', () => {
    window.__helpyMainScriptInitialized = true;
    const path = window.location.pathname;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('jwtToken');
    const userType = localStorage.getItem('userType');
    const profileReturnKey = 'helpy:profile-return';
    let shouldRestoreExplorar = false;
    let pendingExplorarOpen = false;
    let pendingProfileReturn = null;
    let pendingProfileReturnTries = 0;
    let pendingProfileReturnUIApplied = false;

    // Tratamento especial para /login: garantir que mostre sempre a página de login real
    if (path === '/login' || path === '/login/') {
        // Se NÃO estiver logado, força ir para o arquivo de login direto
        if (!token || !userId) {
            window.location.replace('/login.html');
        } else {
            // Se já estiver logado e tentar ir para o login, manda para o feed
            window.location.replace('/');
        }

        return;
    }

    // Tratamento especial para /cadastro: garantir que mostre sempre a página de cadastro real
    if (path === '/cadastro' || path === '/cadastro/') {
        // Se NÃO estiver logado, força ir para o arquivo de cadastro direto
        if (!token || !userId) {
            window.location.replace('/cadastro.html');
        } else {
            // Se já estiver logado e tentar ir para o cadastro, manda para o feed
            window.location.replace('/');
        }
        return;
    }


    // --- Elementos do Header ---
    const userAvatarHeader = document.getElementById('user-avatar-header');
    const userNameHeader = document.getElementById('user-name-header');
    const profileButton = document.getElementById('profile-button');
    const logoutButton = document.getElementById('logout-button');
    const searchInput = document.querySelector('.search');
    const searchToggleBtn = document.getElementById('search-toggle');
    const logoBox = document.querySelector('.logo-box');
    const headerEl = document.querySelector('header');
    let searchResultsContainer = null;
    let searchResultsBackdrop = null;
    
    // --- Modais ---
    const logoutConfirmModal = document.getElementById('logout-confirm-modal');
    const confirmLogoutYesBtn = document.getElementById('confirm-logout-yes');
    const confirmLogoutNoBtn = document.getElementById('confirm-logout-no');

    // --- Elementos do Feed ---
    const postForm = document.getElementById('new-post-form');
    const postContentInput = document.getElementById('post-content-input');
    const postMediaInput = document.getElementById('post-media-input');
    const postFormMessage = document.getElementById('post-form-message');
    const postsContainer = document.getElementById('posts-container');
    const feedExplorarSlider = document.querySelector('.feed-explorar-slider');
    const leftoverMobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
    if (leftoverMobileBackdrop) {
        leftoverMobileBackdrop.remove();
    }

    // --- Explorar ---
    const explorarPage = document.getElementById('explorar-page');
    const explorarFeedList = document.getElementById('explorar-feed-list');
    const explorarFeedStatus = document.getElementById('explorar-feed-status');
    const explorarCidadeInput = document.getElementById('explorar-cidade-input');
    const explorarCidadeAddBtn = document.getElementById('explorar-cidade-add');
    const explorarCidadeChips = document.getElementById('explorar-city-chips');
    const explorarCidadesDatalist = document.getElementById('explorar-cidades-sugestoes');
    const explorarCityEditBtn = document.getElementById('explorar-city-edit');
    const explorarCityControls = document.getElementById('explorar-city-controls');
    const explorarCityName = document.getElementById('explorar-city-name');
    const explorarCityRow = document.querySelector('.explorar-city-row');
    const explorarUserAvatar = document.getElementById('explorar-user-avatar');
    const explorarCategoriaCurrent = document.getElementById('explorar-categoria-current');
    const explorarCategoriasModal = document.getElementById('explorar-categorias-modal');
    const explorarAddMediaBtn = document.getElementById('explorar-add-media');
    const explorarValidationMsg = document.getElementById('explorar-validation-msg');
    const explorarMediaInput = document.getElementById('explorar-media-input');
    const explorarPostModal = document.getElementById('explorar-post-modal');
    const explorarPostClose = document.getElementById('explorar-post-close');
    const explorarPostPreview = document.getElementById('explorar-post-preview');
    const explorarPostDesc = document.getElementById('explorar-post-desc');
    const explorarPostSend = document.getElementById('explorar-post-send');
    const explorarVideoOverlay = document.getElementById('explorar-video-overlay');
    const explorarVideoFull = document.getElementById('explorar-video-full');
    const explorarImageFull = document.getElementById('explorar-image-full');
    const explorarVideoBack = document.getElementById('explorar-video-back');
    const explorarVideoDelete = document.getElementById('explorar-video-delete');
    const explorarVideoInfo = document.getElementById('explorar-video-info');
    const explorarVideoPerfil = document.getElementById('explorar-video-perfil');
    const explorarVideoAvatar = document.getElementById('explorar-video-avatar');
    const explorarVideoNome = document.getElementById('explorar-video-nome');
    const explorarVideoDesc = document.getElementById('explorar-video-desc');
    const explorarVideoCidade = document.getElementById('explorar-video-cidade');
    const likesModalOverlay = document.getElementById('likes-modal-overlay');
    const likesModalList = document.getElementById('likes-modal-list');
    const likesModalClose = document.getElementById('likes-modal-close');

    const saveProfileReturnState = () => {
        const mainScroll = document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
        const feedScroll = feedExplorarSlider?.querySelector('main')?.scrollTop ?? null;
        const explorarScroll = explorarPage?.scrollTop ?? null;
        const explorarOpen = document.documentElement.classList.contains('explorar-open');
        const openComments = Array.from(document.querySelectorAll('.post .post-comments.visible'))
            .map((section) => section.closest('.post')?.dataset.postId)
            .filter(Boolean);
        const loadedComments = Array.from(document.querySelectorAll('.post'))
            .map((post) => {
                const postId = post.dataset.postId;
                if (!postId) return null;
                const loadBtn = post.querySelector('.load-more-comments');
                const loaded = loadBtn ? parseInt(loadBtn.dataset.loaded || '0', 10) : 0;
                const visibleCount = post.querySelectorAll('.comment:not(.comment-hidden)').length;
                const targetCount = Number.isFinite(loaded) && loaded > 0 ? loaded : visibleCount;
                return targetCount > 0 ? { postId, loaded: targetCount } : null;
            })
            .filter(Boolean);
        const openReplyLists = Array.from(document.querySelectorAll('.reply-list:not(.oculto)'))
            .map((list) => list.closest('.comment')?.dataset.commentId)
            .filter(Boolean);
        const openReplyForms = Array.from(document.querySelectorAll('.reply-form:not(.oculto)'))
            .map((form) => form.closest('.comment')?.dataset.commentId)
            .filter(Boolean);
        const activeCommentId = document.querySelector('.comment.is-focused')?.dataset.commentId || null;
        const activeReplyId = document.querySelector('.reply.is-focused')?.dataset.replyId || null;
        sessionStorage.setItem(profileReturnKey, JSON.stringify({
            url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            mainScroll,
            feedScroll,
            explorarScroll,
            explorarOpen,
            openComments,
            openReplyLists,
            openReplyForms,
            loadedComments,
            activeCommentId,
            activeReplyId
        }));
    };

    const openCommentSection = (postEl) => {
        if (!postEl) return;
        const commentsSection = postEl.querySelector('.post-comments');
        if (commentsSection && commentsSection.classList.contains('visible')) {
            return;
        }
        const commentBtn = postEl.querySelector('.btn-comment');
        if (commentBtn && typeof toggleCommentSection === 'function') {
            toggleCommentSection({ currentTarget: commentBtn });
            return;
        }
        if (commentsSection) {
            commentsSection.classList.add('visible');
        }
        if (commentBtn) {
            commentBtn.classList.add('active');
        }
    };

    const applyProfileReturnUIState = () => {
        if (!pendingProfileReturn || pendingProfileReturnUIApplied) return true;
        const data = pendingProfileReturn;
        const openComments = Array.isArray(data?.openComments) ? data.openComments : [];
        const openReplyLists = Array.isArray(data?.openReplyLists) ? data.openReplyLists : [];
        const openReplyForms = Array.isArray(data?.openReplyForms) ? data.openReplyForms : [];
        const loadedComments = Array.isArray(data?.loadedComments) ? data.loadedComments : [];
        const activeCommentId = data?.activeCommentId || null;
        const activeReplyId = data?.activeReplyId || null;
        if (!openComments.length && !openReplyLists.length && !openReplyForms.length && !loadedComments.length) {
            pendingProfileReturnUIApplied = true;
            return true;
        }

        let allFound = true;
        openComments.forEach((postId) => {
            const postEl = document.querySelector(`.post[data-post-id="${postId}"]`);
            if (!postEl) {
                allFound = false;
                return;
            }
            openCommentSection(postEl);
        });

        loadedComments.forEach((entry) => {
            const postEl = document.querySelector(`.post[data-post-id="${entry.postId}"]`);
            if (!postEl) {
                allFound = false;
                return;
            }
            const loadBtn = postEl.querySelector('.load-more-comments');
            if (loadBtn) {
                let currentLoaded = parseInt(loadBtn.dataset.loaded || '0', 10);
                let safety = 0;
                while (currentLoaded < entry.loaded && safety < 6) {
                    loadBtn.click();
                    currentLoaded = parseInt(loadBtn.dataset.loaded || '0', 10);
                    safety += 1;
                    if (!document.body.contains(loadBtn)) break;
                }
                return;
            }
            const hidden = Array.from(postEl.querySelectorAll('.comment.comment-hidden'));
            const toShow = entry.loaded - postEl.querySelectorAll('.comment:not(.comment-hidden)').length;
            if (toShow > 0) {
                hidden.slice(0, toShow).forEach((comment) => comment.classList.remove('comment-hidden'));
            }
        });

        const targetId = activeReplyId || activeCommentId;
        if (targetId) {
            const selector = activeReplyId
                ? `.reply[data-reply-id="${activeReplyId}"]`
                : `.comment[data-comment-id="${activeCommentId}"]`;
            const targetEl = document.querySelector(selector);
            if (targetEl) {
                setTimeout(() => {
                    targetEl.scrollIntoView({ block: 'center', behavior: 'auto' });
                }, 0);
            } else {
                allFound = false;
            }
        }

        const allReplyIds = new Set([...openReplyLists, ...openReplyForms]);
        allReplyIds.forEach((commentId) => {
            const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (!commentEl) {
                allFound = false;
                return;
            }
            const replyList = commentEl.querySelector('.reply-list');
            if (replyList && replyList.classList.contains('oculto') && openReplyLists.includes(commentId)) {
                const toggleRepliesBtn = commentEl.querySelector('.btn-toggle-replies');
                if (toggleRepliesBtn) {
                    toggleRepliesBtn.click();
                } else {
                    replyList.classList.remove('oculto');
                }
            }
            const replyForm = commentEl.querySelector('.reply-form');
            if (replyForm && replyForm.classList.contains('oculto') && openReplyForms.includes(commentId)) {
                const replyFormBtn = commentEl.querySelector('.btn-show-reply-form');
                if (replyFormBtn) {
                    replyFormBtn.click();
                } else {
                    replyForm.classList.remove('oculto');
                }
            }
        });

        if (allFound) {
            pendingProfileReturnUIApplied = true;
        }
        return pendingProfileReturnUIApplied;
    };

    const navigateToProfile = (perfilId) => {
        if (!perfilId) return;
        saveProfileReturnState();
        window.location.href = `/perfil.html?id=${perfilId}`;
    };

    const applyProfileReturnScroll = () => {
        if (!pendingProfileReturn) return;
        const data = pendingProfileReturn;
        const desiredMain = typeof data?.mainScroll === 'number' ? data.mainScroll : null;
        const desiredFeed = typeof data?.feedScroll === 'number' ? data.feedScroll : null;
        const desiredExplorar = typeof data?.explorarScroll === 'number' ? data.explorarScroll : null;
        if (desiredMain !== null) {
            window.scrollTo(0, desiredMain);
        }
        const feedMain = feedExplorarSlider?.querySelector('main');
        if (feedMain && desiredFeed !== null) {
            feedMain.scrollTop = desiredFeed;
        }
        if (explorarPage && desiredExplorar !== null) {
            explorarPage.scrollTop = desiredExplorar;
        }

        const mainEl = document.scrollingElement;
        const mainMax = mainEl ? (mainEl.scrollHeight - mainEl.clientHeight) : 0;
        const mainReady = desiredMain === null || (mainEl && mainMax >= desiredMain - 4);
        const mainOk = desiredMain === null ||
            (mainEl && Math.abs(mainEl.scrollTop - desiredMain) < 8) ||
            (!mainEl || mainMax <= 0);

        const feedMax = feedMain ? (feedMain.scrollHeight - feedMain.clientHeight) : 0;
        const feedReady = desiredFeed === null || (feedMain && feedMax >= desiredFeed - 4);
        const feedOk = desiredFeed === null ||
            !feedMain ||
            Math.abs(feedMain.scrollTop - desiredFeed) < 8 ||
            feedMax <= 0;

        const explorarMax = explorarPage ? (explorarPage.scrollHeight - explorarPage.clientHeight) : 0;
        const explorarReady = desiredExplorar === null || (explorarPage && explorarMax >= desiredExplorar - 4);
        const explorarOk = desiredExplorar === null ||
            !explorarPage ||
            Math.abs(explorarPage.scrollTop - desiredExplorar) < 8 ||
            explorarMax <= 0;

        const uiOk = applyProfileReturnUIState();

        if (mainOk && feedOk && explorarOk && mainReady && feedReady && explorarReady && uiOk) {
            sessionStorage.removeItem(profileReturnKey);
            pendingProfileReturn = null;
            pendingProfileReturnTries = 0;
            pendingProfileReturnUIApplied = false;
            return;
        }

        if (pendingProfileReturnTries < 12) {
            pendingProfileReturnTries += 1;
            setTimeout(applyProfileReturnScroll, 140);
        } else {
            sessionStorage.removeItem(profileReturnKey);
            pendingProfileReturn = null;
            pendingProfileReturnTries = 0;
            pendingProfileReturnUIApplied = false;
        }
    };

    const restoreProfileReturnState = () => {
        const raw = sessionStorage.getItem(profileReturnKey);
        if (!raw) return;
        try {
            const data = JSON.parse(raw);
            const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            if (data?.url && data.url !== currentUrl) return;
            shouldRestoreExplorar = !!data?.explorarOpen;
            pendingExplorarOpen = shouldRestoreExplorar;
            pendingProfileReturn = data;
            pendingProfileReturnTries = 0;
            pendingProfileReturnUIApplied = false;
            requestAnimationFrame(() => setTimeout(applyProfileReturnScroll, 0));
        } catch (err) {
            console.warn('Falha ao restaurar retorno do perfil', err);
        }
    };

    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href*="/perfil.html?id="]');
        if (!link) return;
        document.querySelectorAll('.comment.is-focused, .reply.is-focused').forEach((el) => {
            el.classList.remove('is-focused');
        });
        const replyEl = event.target.closest('.reply');
        if (replyEl) {
            replyEl.classList.add('is-focused');
        }
        const commentEl = event.target.closest('.comment');
        if (commentEl) {
            commentEl.classList.add('is-focused');
        }
        saveProfileReturnState();
    });

    restoreProfileReturnState();

    let explorarUserStory = null;
    let explorarStoryQueue = [];
    let explorarStoryIndex = 0;
    let explorarStoryTimer = null;
    let explorarStoryStartAt = 0;
    let explorarStoryElapsed = 0;
    let explorarStoryPaused = false;
    let explorarStoryMode = false;
    let explorarCurrentPostId = null;
    let explorarCurrentOwnerId = null;
    let explorarCurrentIsStory = false;
    const explorarStoryDuration = 10000;
    const explorarStoryProgress = document.getElementById('explorar-story-progress');
    const explorarStoryPrev = document.getElementById('explorar-story-prev');
    const explorarStoryNext = document.getElementById('explorar-story-next');
    const getExplorarStoryKey = (storyId) => `explorar_story_viewed_${userId || 'anon'}_${storyId}`;

    function markExplorarStoryViewed(storyId) {
        if (!storyId) return;
        try {
            localStorage.setItem(getExplorarStoryKey(storyId), '1');
        } catch (e) {}
    }

    function isExplorarStoryViewed(storyId) {
        if (!storyId) return false;
        try {
            return localStorage.getItem(getExplorarStoryKey(storyId)) === '1';
        } catch (e) {
            return false;
        }
    }

    function updateExplorarStoryIndicator() {
        if (!explorarUserAvatar) return;
        const hasStory = !!explorarUserStory?.mediaUrl;
        explorarUserAvatar.classList.toggle('has-story', hasStory);
        explorarUserAvatar.classList.toggle('is-viewed', hasStory && isExplorarStoryViewed(explorarUserStory?.id));
    }

    function updateExplorarStoryNav() {
        if (!explorarStoryPrev || !explorarStoryNext) return;
        if (!explorarStoryMode) {
            explorarStoryPrev.hidden = true;
            explorarStoryNext.hidden = true;
            return;
        }
        const total = explorarStoryQueue.length;
        if (total <= 1) {
            explorarStoryPrev.hidden = true;
            explorarStoryNext.hidden = true;
            return;
        }
        explorarStoryPrev.hidden = explorarStoryIndex <= 0;
        explorarStoryNext.hidden = explorarStoryIndex >= total - 1;
    }

    function updateExplorarDeleteVisibility() {
        if (!explorarVideoDelete) return;
        const isOwner = explorarCurrentOwnerId && userId && String(explorarCurrentOwnerId) === String(userId);
        const shouldShow = !!(isOwner && explorarCurrentPostId);
        explorarVideoDelete.hidden = !shouldShow;
        explorarVideoDelete.style.display = shouldShow ? 'grid' : 'none';
    }

    function setExplorarOverlayMeta({ postId, ownerId, isStory = false } = {}) {
        explorarCurrentPostId = postId || null;
        explorarCurrentOwnerId = ownerId || null;
        explorarCurrentIsStory = !!isStory;
        updateExplorarDeleteVisibility();
    }

    function stopExplorarStoryTimer() {
        if (explorarStoryTimer) {
            cancelAnimationFrame(explorarStoryTimer);
            explorarStoryTimer = null;
        }
    }

    function setExplorarStorySegments(count) {
        if (!explorarStoryProgress) return;
        explorarStoryProgress.innerHTML = '';
        for (let i = 0; i < count; i += 1) {
            const segment = document.createElement('div');
            segment.className = 'explorar-story-progress-segment';
            const fill = document.createElement('div');
            fill.className = 'explorar-story-progress-fill';
            segment.appendChild(fill);
            explorarStoryProgress.appendChild(segment);
        }
    }

    function resetExplorarStoryTimer() {
        stopExplorarStoryTimer();
        explorarStoryStartAt = performance.now();
        explorarStoryElapsed = 0;
        if (explorarStoryProgress) {
            explorarStoryProgress.querySelectorAll('.explorar-story-progress-fill').forEach((fill) => {
                fill.style.transform = 'scaleX(0)';
            });
        }
    }

    function updateExplorarStoryProgress() {
        if (explorarStoryPaused) {
            explorarStoryTimer = requestAnimationFrame(updateExplorarStoryProgress);
            return;
        }
        const now = performance.now();
        const elapsed = explorarStoryElapsed + (now - explorarStoryStartAt);
        const pct = Math.min(1, elapsed / explorarStoryDuration);
        if (explorarStoryProgress) {
            const fills = explorarStoryProgress.querySelectorAll('.explorar-story-progress-fill');
            fills.forEach((fill, idx) => {
                if (idx < explorarStoryIndex) {
                    fill.style.transform = 'scaleX(1)';
                } else if (idx === explorarStoryIndex) {
                    fill.style.transform = `scaleX(${pct})`;
                } else {
                    fill.style.transform = 'scaleX(0)';
                }
            });
        }
        if (pct >= 1) {
            goToExplorarStory(explorarStoryIndex + 1);
            return;
        }
        explorarStoryTimer = requestAnimationFrame(updateExplorarStoryProgress);
    }

    function pauseExplorarStory() {
        if (explorarStoryPaused) return;
        explorarStoryPaused = true;
        explorarStoryElapsed += performance.now() - explorarStoryStartAt;
    }

    function resumeExplorarStory() {
        if (!explorarStoryPaused) return;
        explorarStoryPaused = false;
        explorarStoryStartAt = performance.now();
    }

    function goToExplorarStory(nextIndex) {
        if (!explorarStoryQueue.length) return closeExplorarVideo();
        if (nextIndex < 0 || nextIndex >= explorarStoryQueue.length) {
            closeExplorarVideo();
            return;
        }
        explorarStoryIndex = nextIndex;
        const story = explorarStoryQueue[explorarStoryIndex];
        if (!story) return;
        explorarStoryMode = true;
        resetExplorarStoryTimer();
        setExplorarOverlayMeta({
            postId: story?.id,
            ownerId: story?.ownerId,
            isStory: true
        });
        const info = {
            nome: story?.nome || 'Minha postagem',
            desc: story?.desc || '',
            cidade: story?.cidade || '',
            avatar: explorarUserAvatar?.getAttribute('src') || 'imagens/default-user.png',
            perfilUrl: '#',
            postId: story?.id,
            ownerId: story?.ownerId,
            isStory: true
        };
        if (story?.isVideo) {
            openExplorarVideo(story.mediaUrl, info);
        } else {
            openExplorarImage(story.mediaUrl, info);
        }
        markExplorarStoryViewed(story.id);
        updateExplorarStoryIndicator();
        if (explorarStoryProgress) {
            explorarStoryProgress.setAttribute('aria-hidden', 'false');
        }
        updateExplorarStoryNav();
        updateExplorarStoryProgress();
    }

    if (explorarUserAvatar) {
        explorarUserAvatar.addEventListener('click', () => {
            if (!explorarStoryQueue.length) return;
            explorarStoryPaused = false;
            explorarStoryElapsed = 0;
            goToExplorarStory(0);
        });
    }

    function openExplorarVideo(src, info = {}) {
        if (!explorarVideoOverlay || !explorarVideoFull || !src) return;
        explorarVideoOverlay.classList.remove('is-dragging');
        explorarVideoOverlay.style.transform = '';
        explorarVideoOverlay.removeAttribute('inert');
        if (info?.postId || info?.ownerId || typeof info?.isStory === 'boolean') {
            setExplorarOverlayMeta({
                postId: info?.postId,
                ownerId: info?.ownerId,
                isStory: info?.isStory
            });
        } else {
            setExplorarOverlayMeta({ postId: null, ownerId: null, isStory: false });
        }
        if (explorarImageFull) {
            explorarImageFull.classList.add('hidden');
            explorarImageFull.removeAttribute('src');
        }        const isStory = !!info?.isStory;
        if (explorarVideoInfo) {
            const nome = info?.nome || '';
            const desc = info?.desc || '';
            const cidade = info?.cidade || '';
            const avatar = info?.avatar || 'imagens/default-user.png';
            const perfilUrl = info?.perfilUrl || '#';
            const postId = info?.postId || null;
            const isOwner = info?.ownerId && userId && String(info.ownerId) === String(userId);
            if (explorarVideoPerfil) {
                explorarVideoPerfil.setAttribute('href', perfilUrl);
            }
            if (explorarVideoAvatar) {
                explorarVideoAvatar.src = avatar;
            }
            if (explorarVideoNome) {
                explorarVideoNome.textContent = nome;
            }
            // Adiciona botão de WhatsApp ao lado do nome no fullscreen (apenas se não for dono)
            const existingVideoWa = explorarVideoInfo.querySelector('.explorar-video-whatsapp');
            if (existingVideoWa) existingVideoWa.remove();
            (async () => {
                try {
                    const ownerId = info?.ownerId;
                    const postId = info?.postId;
                    if (!ownerId || !explorarVideoNome || !postId) return;
                    if (userId && String(ownerId) === String(userId)) return; // não mostra para o dono
                    const respUser = await fetch(`/api/usuario/${ownerId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const dataUser = await respUser.json();
                    if (!respUser.ok || dataUser?.success === false) return;
                    const u = dataUser.usuario || {};
                    const numeroRaw = String(u.whatsapp || u.telefone || u.celular || u.phone || '').trim();
                    const numeroDigits = numeroRaw.replace(/\D+/g, '');
                    if (!numeroDigits || numeroDigits.length < 8) return;
                    const previewUrl = `${location.origin}/?postId=${encodeURIComponent(postId)}`;
                    const msg = `Olá! Vi seu vídeo e tenho uma pergunta: ${previewUrl}`;
                    const waLink = document.createElement('a');
                    waLink.href = `https://wa.me/${encodeURIComponent(numeroDigits)}?text=${encodeURIComponent(msg)}`;
                    waLink.target = '_blank';
                    waLink.rel = 'noopener noreferrer';
                    waLink.className = 'explorar-video-whatsapp';
                    waLink.innerHTML = '<i class="fab fa-whatsapp"></i>';
                    ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach((type) => {
                        waLink.addEventListener(type, (ev) => {
                            ev.stopPropagation();
                        });
                    });
                    explorarVideoNome.insertAdjacentElement('afterend', waLink);
                } catch {}
            })();
            if (explorarVideoDesc) {
                explorarVideoDesc.textContent = desc;
                explorarVideoDesc.style.display = desc ? 'block' : 'none';
            }
            if (explorarVideoCidade) {
                explorarVideoCidade.textContent = cidade;
                explorarVideoCidade.style.display = cidade ? 'block' : 'none';
            }
            explorarVideoInfo.style.display = (nome || desc || cidade) ? 'flex' : 'none';
            const existingAvatars = explorarVideoInfo.querySelector('.explorar-like-avatars');
            if (existingAvatars) {
                existingAvatars.remove();
            }
            const existingLikeBtn = explorarVideoInfo.querySelector('.explorar-video-like-btn');
            if (existingLikeBtn) {
                existingLikeBtn.remove();
            }
            const existingLikeList = explorarVideoInfo.querySelector('.explorar-video-like-list');
            if (existingLikeList) {
                existingLikeList.remove();
            }
            if (postId) {
                const likeBtn = document.createElement('button');
                likeBtn.type = 'button';
                likeBtn.className = 'explorar-video-like-btn btn-like';
                likeBtn.dataset.postId = String(postId);
                likeBtn.innerHTML = `
                    <i class="fas fa-heart"></i>
                    <span class="like-count">0</span>
                `;
                likeBtn.addEventListener('click', handleLikePost);
                explorarVideoInfo.appendChild(likeBtn);
                (async () => {
                    try {
                        const resp = await fetch(`/api/posts/${postId}/likes`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await resp.json();
                        if (!resp.ok || data?.success === false) return;
                        const count = Number.isFinite(data.likesCount) ? data.likesCount : 0;
                        likeBtn.querySelector('.like-count').textContent = count;
                        if (data.isLikedByMe) {
                            likeBtn.classList.add('liked');
                        }
                        const preview = Array.isArray(data.likesPreview) ? data.likesPreview : [];
                        const isOwnerWithList = isOwner && Array.isArray(data.likes) && data.likes.length > 0;
                        if (preview.length > 0) {
                            const avatarsBtn = document.createElement('button');
                            avatarsBtn.type = 'button';
                            avatarsBtn.className = 'explorar-like-avatars';
                            preview.forEach((u) => {
                                if (!u || !u.foto) return;
                                const img = document.createElement('img');
                                img.src = u.foto;
                                img.alt = u.nome || '';
                                img.className = 'explorar-like-avatar';
                                img.referrerPolicy = 'no-referrer';
                                avatarsBtn.appendChild(img);
                            });
                            if (avatarsBtn.childElementCount > 0) {
                                if (isOwnerWithList) {
                                    avatarsBtn.addEventListener('click', (ev) => {
                                        openLikesModal(postId, data.likes, avatarsBtn);
                                    });
                                } else {
                                    avatarsBtn.classList.add('non-owner');
                                    ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach((type) => {
                                        avatarsBtn.addEventListener(type, (ev) => {
                                            ev.stopPropagation();
                                            ev.preventDefault();
                                        });
                                    });
                                }
                                explorarVideoInfo.appendChild(avatarsBtn);
                            }
                        }
                    } catch {}
                })();
            }
            const existingControls = explorarVideoInfo.querySelector('.explorar-video-controls');
            if (existingControls) {
                existingControls.remove();
            }
            if (!isStory) {
                const controls = document.createElement('div');
                controls.className = 'explorar-video-controls';
                const progress = document.createElement('input');
                progress.type = 'range';
                progress.min = '0';
                progress.max = '100';
                progress.value = '0';
                progress.className = 'explorar-video-progress';
                controls.appendChild(progress);
                explorarVideoInfo.appendChild(controls);
                explorarVideoProgress = progress;
                let scrubbing = false;
                const setFromProgress = () => {
                    if (!explorarVideoFull || !isFinite(explorarVideoFull.duration) || explorarVideoFull.duration <= 0) return;
                    const pct = Number(progress.value) / 100;
                    explorarVideoFull.currentTime = Math.max(0, Math.min(explorarVideoFull.duration * pct, explorarVideoFull.duration));
                };
                const beginScrub = () => {
                    scrubbing = true;
                    showExplorarVideoControls(0);
                };
                const endScrub = () => {
                    scrubbing = false;
                    showExplorarVideoControls();
                };
                progress.addEventListener('input', () => {
                    setFromProgress();
                });
                progress.addEventListener('mousedown', beginScrub);
                progress.addEventListener('touchstart', beginScrub);
                progress.addEventListener('change', endScrub);
                progress.addEventListener('mouseup', endScrub);
                progress.addEventListener('touchend', endScrub);
                const updateProgressFromVideo = () => {
                    if (!explorarVideoProgress || scrubbing) return;
                    if (!explorarVideoFull || !isFinite(explorarVideoFull.duration) || explorarVideoFull.duration <= 0) return;
                    const pct = (explorarVideoFull.currentTime / explorarVideoFull.duration) * 100;
                    explorarVideoProgress.value = String(Math.max(0, Math.min(pct, 100)));
                };
                explorarVideoFull.addEventListener('timeupdate', updateProgressFromVideo);
                explorarVideoFull.addEventListener('loadedmetadata', updateProgressFromVideo, { once: true });
                showExplorarVideoControls();
            } else {
                explorarVideoProgress = null;
            }
        }
        explorarVideoFull.classList.remove('hidden');
        explorarVideoFull.src = src;
        explorarVideoFull.controls = false;
        try { explorarVideoFull.removeAttribute('controls'); } catch {}
        explorarVideoFull.muted = false;
        explorarVideoFull.playsInline = true;
        try { explorarVideoFull.setAttribute('controlsList', 'nofullscreen noplaybackrate nodownload'); } catch {}
        try { explorarVideoFull.style.pointerEvents = 'none'; } catch {}
        explorarVideoFull.currentTime = 0;
        explorarVideoOverlay.classList.remove('hidden');
        explorarVideoOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('explorar-video-open');
        updateExplorarStoryNav();
        explorarVideoFull.play().catch(() => {});
    }

    function openExplorarImage(src, info = {}) {
        if (!explorarVideoOverlay || !explorarImageFull || !src) return;
        explorarVideoOverlay.classList.remove('is-dragging');
        explorarVideoOverlay.style.transform = '';
        if (info?.postId || info?.ownerId || typeof info?.isStory === 'boolean') {
            setExplorarOverlayMeta({
                postId: info?.postId,
                ownerId: info?.ownerId,
                isStory: info?.isStory
            });
        } else {
            setExplorarOverlayMeta({ postId: null, ownerId: null, isStory: false });
        }
        explorarVideoFull?.pause();
        explorarVideoFull?.removeAttribute('src');
        explorarVideoFull?.classList.add('hidden');
        if (explorarVideoInfo) {
            const nome = info?.nome || '';
            const desc = info?.desc || '';
            const cidade = info?.cidade || '';
            const avatar = info?.avatar || 'imagens/default-user.png';
            const postId = info?.postId || null;
            const isOwner = info?.ownerId && userId && String(info.ownerId) === String(userId);
            if (explorarVideoAvatar) {
                explorarVideoAvatar.src = avatar;
            }
            if (explorarVideoNome) {
                explorarVideoNome.textContent = nome;
            }
            if (explorarVideoDesc) {
                explorarVideoDesc.textContent = desc;
                explorarVideoDesc.style.display = desc ? 'block' : 'none';
            }
            if (explorarVideoCidade) {
                explorarVideoCidade.textContent = cidade;
                explorarVideoCidade.style.display = cidade ? 'block' : 'none';
            }
            explorarVideoInfo.style.display = (nome || desc || cidade) ? 'flex' : 'none';
            const existingAvatars = explorarVideoInfo.querySelector('.explorar-like-avatars');
            if (existingAvatars) {
                existingAvatars.remove();
            }
            const existingLikeBtn = explorarVideoInfo.querySelector('.explorar-video-like-btn');
            if (existingLikeBtn) {
                existingLikeBtn.remove();
            }
            const existingLikeList = explorarVideoInfo.querySelector('.explorar-video-like-list');
            if (existingLikeList) {
                existingLikeList.remove();
            }
            if (postId) {
                const likeBtn = document.createElement('button');
                likeBtn.type = 'button';
                likeBtn.className = 'explorar-video-like-btn btn-like';
                likeBtn.dataset.postId = String(postId);
                likeBtn.innerHTML = `
                    <i class="fas fa-heart"></i>
                    <span class="like-count">0</span>
                `;
                likeBtn.addEventListener('click', handleLikePost);
                explorarVideoInfo.appendChild(likeBtn);
                (async () => {
                    try {
                        const resp = await fetch(`/api/posts/${postId}/likes`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        const data = await resp.json();
                        if (!resp.ok || data?.success === false) return;
                        const count = Number.isFinite(data.likesCount) ? data.likesCount : 0;
                        likeBtn.querySelector('.like-count').textContent = count;
                        if (data.isLikedByMe) {
                            likeBtn.classList.add('liked');
                        }
                        const preview = Array.isArray(data.likesPreview) ? data.likesPreview : [];
                        const isOwnerWithList = isOwner && Array.isArray(data.likes) && data.likes.length > 0;
                        if (preview.length > 0) {
                            const avatarsBtn = document.createElement('button');
                            avatarsBtn.type = 'button';
                            avatarsBtn.className = 'explorar-like-avatars';
                            preview.forEach((u) => {
                                if (!u || !u.foto) return;
                                const img = document.createElement('img');
                                img.src = u.foto;
                                img.alt = u.nome || '';
                                img.className = 'explorar-like-avatar';
                                img.referrerPolicy = 'no-referrer';
                                avatarsBtn.appendChild(img);
                            });
                            if (avatarsBtn.childElementCount > 0) {
                                if (isOwnerWithList) {
                                    avatarsBtn.addEventListener('click', (ev) => {
                                        openLikesModal(postId, data.likes, avatarsBtn);
                                    });
                                }
                                explorarVideoInfo.appendChild(avatarsBtn);
                            }
                        }
                    } catch {}
                })();
            }
        }
        explorarImageFull.src = src;
        explorarImageFull.classList.remove('hidden');
        explorarVideoOverlay.classList.remove('hidden');
        explorarVideoOverlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('explorar-video-open');
        updateExplorarStoryNav();
    }

    function closeExplorarVideo() {
        if (!explorarVideoOverlay || !explorarVideoFull) return;
        explorarVideoOverlay.classList.add('hidden');
        explorarVideoOverlay.setAttribute('aria-hidden', 'true');
        // Evita foco em elementos dentro de um container aria-hidden
        try {
            if (explorarVideoOverlay.contains(document.activeElement)) {
                /** @type {HTMLElement} */(document.activeElement)?.blur?.();
            }
            explorarVideoOverlay.setAttribute('inert', '');
        } catch {}
        explorarVideoFull.pause();
        explorarVideoFull.removeAttribute('src');
        explorarVideoFull.load();
        try { explorarVideoFull.style.pointerEvents = ''; } catch {}
        explorarVideoOverlay.classList.remove('is-dragging');
        explorarVideoOverlay.style.transform = '';
        document.body.classList.remove('explorar-video-open');
        stopExplorarStoryTimer();
        explorarStoryPaused = false;
        explorarStoryMode = false;
        explorarStoryElapsed = 0;
        explorarStoryIndex = 0;
        setExplorarOverlayMeta({ postId: null, ownerId: null, isStory: false });
        if (explorarStoryProgress) {
            explorarStoryProgress.setAttribute('aria-hidden', 'true');
        }
        updateExplorarStoryNav();
        if (explorarImageFull) {
            explorarImageFull.removeAttribute('src');
            explorarImageFull.classList.add('hidden');
        }
    }

    if (explorarStoryPrev) {
        explorarStoryPrev.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToExplorarStory(explorarStoryIndex - 1);
        });
    }

    if (explorarStoryNext) {
        explorarStoryNext.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            goToExplorarStory(explorarStoryIndex + 1);
        });
    }

    let explorarHoldTimer = null;
    let explorarHoldActive = false;
    const explorarHoldDelayMs = 500;
    if (explorarVideoOverlay) {
        const startHold = () => {
            clearTimeout(explorarHoldTimer);
            explorarHoldActive = false;
            explorarHoldTimer = setTimeout(() => {
                explorarHoldActive = true;
                try {
                    if (typeof pauseExplorarStory === 'function' && explorarStoryMode) {
                        pauseExplorarStory();
                    }
                    explorarVideoFull?.pause?.();
                } catch {}
            }, explorarHoldDelayMs);
        };
        const endHold = () => {
            clearTimeout(explorarHoldTimer);
            if (explorarStoryMode && explorarHoldActive) {
                explorarHoldActive = false;
                resumeExplorarStory();
            } else {
                explorarHoldActive = false;
            }
            try { explorarVideoFull?.play?.(); } catch {}
        };
        explorarVideoOverlay.addEventListener('pointerdown', startHold);
        explorarVideoOverlay.addEventListener('pointerup', endHold);
        explorarVideoOverlay.addEventListener('pointercancel', endHold);
        explorarVideoOverlay.addEventListener('touchstart', startHold, { passive: true });
        explorarVideoOverlay.addEventListener('touchend', endHold);
        explorarVideoOverlay.addEventListener('touchcancel', endHold);
    }

    if (explorarVideoOverlay) {
        explorarVideoOverlay.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    if (explorarImageFull) {
        explorarImageFull.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }
    if (explorarVideoFull) {
        explorarVideoFull.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
    }

    let explorarLastTapTime = 0;
    const explorarDoubleTapDelay = 350;
    let explorarNavigationBlockUntil = 0;
    let explorarDoubleTapWindowUntil = 0;
    let explorarVideoProgress = null;
    let explorarControlsHideTimer = null;

    function showExplorarVideoControls(autoHideMs = 2000) {
        if (!explorarVideoOverlay) return;
        explorarVideoOverlay.classList.add('show-controls');
        if (explorarControlsHideTimer) clearTimeout(explorarControlsHideTimer);
        if (autoHideMs > 0) {
            explorarControlsHideTimer = setTimeout(() => {
                if (explorarVideoOverlay) {
                    explorarVideoOverlay.classList.remove('show-controls');
                }
            }, autoHideMs);
        }
    }

    function handleExplorarMediaDoubleLike(event) {
        const postId = explorarCurrentPostId;
        if (!postId) return;
        if (event && event.type === 'dblclick') {
            if (event.preventDefault) event.preventDefault();
            explorarNavigationBlockUntil = Date.now() + 700;
            explorarDoubleTapWindowUntil = explorarNavigationBlockUntil;
            const anyBtn = document.querySelector(`.btn-like[data-post-id="${postId}"]`);
            const alreadyLiked = !!(anyBtn && anyBtn.classList.contains('liked'));
            if (alreadyLiked) {
                triggerLikePulse(postId);
            } else {
                ensureLikeForPost(postId);
            }
            return;
        }
        const now = Date.now();
        if (now - explorarLastTapTime < explorarDoubleTapDelay) {
            explorarLastTapTime = 0;
            explorarNavigationBlockUntil = Date.now() + 700;
            explorarDoubleTapWindowUntil = explorarNavigationBlockUntil;
            const anyBtn = document.querySelector(`.btn-like[data-post-id="${postId}"]`);
            const alreadyLiked = !!(anyBtn && anyBtn.classList.contains('liked'));
            if (alreadyLiked) {
                triggerLikePulse(postId);
            } else {
                ensureLikeForPost(postId);
            }
        } else {
            explorarLastTapTime = now;
        }
    }

    async function ensureLikeForPost(postId) {
        try {
            const anyBtn = document.querySelector(`.btn-like[data-post-id="${postId}"]`);
            const alreadyLiked = !!(anyBtn && anyBtn.classList.contains('liked'));
            if (alreadyLiked) return;
            await toggleLikeForPost(postId);
        } catch {}
    }
    function triggerLikePulse(postId) {
        const btns = document.querySelectorAll(`.btn-like[data-post-id="${postId}"]`);
        btns.forEach((btn) => {
            btn.classList.add('pulse');
            const onEnd = () => {
                btn.classList.remove('pulse');
                btn.removeEventListener('animationend', onEnd);
            };
            btn.addEventListener('animationend', onEnd);
            setTimeout(onEnd, 600);
        });
    }

    if (explorarImageFull) {
        explorarImageFull.addEventListener('touchstart', (event) => {
            event.preventDefault();
        }, { passive: false });
        explorarImageFull.addEventListener('touchend', handleExplorarMediaDoubleLike);
    }

    function closeLikesModal() {
        if (!likesModalOverlay) return;
        likesModalOverlay.classList.add('hidden');
        likesModalOverlay.setAttribute('aria-hidden', 'true');
        likesModalOverlay.style.display = 'none';
        likesModalOverlay.style.pointerEvents = 'none';
        const contentEl = document.getElementById('likes-modal-content');
        if (contentEl) {
            contentEl.style.left = '';
            contentEl.style.top = '';
        }
        if (likesModalList) {
            likesModalList.innerHTML = '';
        }
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    async function openLikesModal(postId, likesFromCaller, anchorEl = null) {
        if (!likesModalOverlay || !likesModalList || !postId) return;
        likesModalOverlay.classList.remove('hidden');
        likesModalOverlay.setAttribute('aria-hidden', 'false');
        likesModalOverlay.style.display = 'flex';
        likesModalOverlay.style.pointerEvents = 'auto';
        let likes = null;
        try {
            const resp = await fetch(`/api/posts/${postId}/likes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok || data?.success === false) return;
            if (Array.isArray(data.likes) && data.likes.length) {
                likes = data.likes;
            }
        } catch {
            if (Array.isArray(likesFromCaller) && likesFromCaller.length) {
                likes = likesFromCaller;
            } else {
                return;
            }
        }
        likesModalList.innerHTML = '';
        likes.forEach((u) => {
            if (!u || (!u.nome && !u.foto)) return;
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'likes-modal-item';
            const avatar = document.createElement('img');
            avatar.className = 'likes-modal-avatar';
            avatar.src = u.foto || 'imagens/default-user.png';
            avatar.alt = u.nome || '';
            avatar.referrerPolicy = 'no-referrer';
            const infoWrap = document.createElement('div');
            infoWrap.className = 'likes-modal-info';
            const name = document.createElement('span');
            name.className = 'likes-modal-name';
            name.textContent = u.nome || '';
            infoWrap.appendChild(name);
            const numeroRaw = String(u.whatsapp || '').trim();
            const numeroDigits = numeroRaw.replace(/\D+/g, '');
            if (numeroDigits && numeroDigits.length >= 8) {
                const waLink = document.createElement('a');
                waLink.href = `https://wa.me/${encodeURIComponent(numeroDigits)}`;
                waLink.target = '_blank';
                waLink.rel = 'noopener noreferrer';
                waLink.className = 'likes-modal-whatsapp';
                waLink.innerHTML = '<i class="fab fa-whatsapp"></i>';
                waLink.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                });
                infoWrap.appendChild(waLink);
            }
            item.appendChild(avatar);
            item.appendChild(infoWrap);
            if (u.id) {
                item.addEventListener('click', () => {
                    window.location.href = `/perfil.html?id=${encodeURIComponent(u.id)}`;
                });
            }
            likesModalList.appendChild(item);
        });
        if (!likesModalList.childElementCount) {
            // Se não houver ninguém para mostrar, fecha de forma segura
            closeLikesModal();
            return;
        }
        const contentEl = document.getElementById('likes-modal-content');
        if (contentEl) {
            contentEl.style.position = 'absolute';
            let desiredLeft = 20;
            let desiredTop = 20;
            if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
                const rect = anchorEl.getBoundingClientRect();
                const panelWidth = contentEl.offsetWidth || 340;
                const panelHeight = contentEl.offsetHeight || 360;
                const viewportW = window.innerWidth;
                const viewportH = window.innerHeight;
                desiredLeft = Math.min(
                    Math.max(rect.right - panelWidth + 10, 10),
                    viewportW - panelWidth - 10
                );
                desiredTop = Math.min(
                    Math.max(rect.top - panelHeight - 12, 10),
                    viewportH - panelHeight - 10
                );
            }
            contentEl.style.left = `${desiredLeft}px`;
            contentEl.style.top = `${desiredTop}px`;
        }
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    if (likesModalClose) {
        likesModalClose.addEventListener('click', () => {
            closeLikesModal();
        });
    }

    if (likesModalOverlay) {
        likesModalOverlay.addEventListener('click', (event) => {
            const contentEl = document.getElementById('likes-modal-content');
            if (!contentEl || !contentEl.contains(event.target)) {
                closeLikesModal();
            }
            event.stopPropagation();
        });
    }

    function handleExplorarDelete(btn, clickEvent = null) {
        if (!explorarCurrentPostId) return;
        if (typeof showDeleteConfirmPopup !== 'function') return;
        showDeleteConfirmPopup(btn, async () => {
            try {
                const response = await fetch(`/api/posts/${explorarCurrentPostId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                if (!response.ok || data?.success === false) {
                    throw new Error(data?.message || 'Erro ao apagar status.');
                }
                const cardToRemove = document.querySelector(`.explorar-card[data-explorar-id="${explorarCurrentPostId}"]`);
                if (cardToRemove) cardToRemove.remove();
                if (explorarStoryMode) {
                    explorarStoryQueue = explorarStoryQueue.filter((item) => String(item.id) !== String(explorarCurrentPostId));
                    setExplorarStorySegments(explorarStoryQueue.length);
                    if (!explorarStoryQueue.length) {
                        closeExplorarVideo();
                    } else {
                        const nextIndex = Math.min(explorarStoryIndex, explorarStoryQueue.length - 1);
                        goToExplorarStory(nextIndex);
                    }
                } else {
                    closeExplorarVideo();
                }
                if (explorarCurrentIsStory) {
                    explorarUserStory = explorarStoryQueue[0] || null;
                    updateExplorarStoryIndicator();
                }
            } catch (error) {
                console.error('Erro ao apagar status:', error);
                alert(error.message);
            }
        }, clickEvent);
    }

    if (explorarVideoDelete) {
        explorarVideoDelete.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            handleExplorarDelete(explorarVideoDelete, event);
        });
    }

    if (explorarVideoBack) {
        explorarVideoBack.addEventListener('click', closeExplorarVideo);
    }

    if (explorarVideoOverlay) {
        let touchStartX = null;
        let touchStartY = null;
        let dragging = false;
        let lockingDirection = null;

        explorarVideoOverlay.addEventListener('click', (event) => {
            const target = event.target;
            if (target.closest('.explorar-video-info') || target.closest('.explorar-video-controls') || target.closest('.explorar-video-whatsapp')) {
                return;
            }
            event.stopPropagation();
            showExplorarVideoControls();
            const nowClick = Date.now();
            if (nowClick - explorarLastTapTime < explorarDoubleTapDelay) {
                explorarLastTapTime = 0;
                handleExplorarMediaDoubleLike({ type: 'dblclick' });
            } else {
                explorarLastTapTime = nowClick;
            }
        });
        explorarVideoOverlay.addEventListener('touchstart', (event) => {
            const target = event.target;
            if (target.closest('.explorar-video-info') || target.closest('.explorar-video-controls') || target.closest('.explorar-video-whatsapp')) {
                return;
            }
            touchStartX = event.touches[0]?.clientX ?? null;
            touchStartY = event.touches[0]?.clientY ?? null;
            dragging = false;
            lockingDirection = null;
            showExplorarVideoControls();
        }, { passive: false });

        explorarVideoOverlay.addEventListener('touchmove', (event) => {
            if (touchStartY === null || touchStartX === null) return;
            const currentX = event.touches[0]?.clientX ?? touchStartX;
            const currentY = event.touches[0]?.clientY ?? touchStartY;
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;
            if (!lockingDirection) {
                lockingDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
            }
            // Bloqueia rolagem durante o gesto
            event.preventDefault();
            if (!dragging && (Math.abs(deltaX) > 18 || Math.abs(deltaY) > 18)) {
                dragging = true;
                explorarVideoOverlay.classList.add('is-dragging');
            }
            if (!dragging) return;
            // Só aplica transformação visual em arraste vertical (gesto de fechar)
            if (lockingDirection === 'vertical') {
                const scale = 0.9;
                explorarVideoOverlay.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
            }
        }, { passive: false });

        explorarVideoOverlay.addEventListener('touchend', (event) => {
            const target = event.target;
            if (target.closest('.explorar-video-info') || target.closest('.explorar-video-controls') || target.closest('.explorar-video-whatsapp')) {
                touchStartX = null;
                touchStartY = null;
                dragging = false;
                return;
            }
            // Detecção de double tap para curtida
            if (!dragging) {
                const nowTap = Date.now();
                if (nowTap - explorarLastTapTime < explorarDoubleTapDelay) {
                    explorarLastTapTime = 0;
                    handleExplorarMediaDoubleLike(event);
                    explorarVideoOverlay.classList.remove('is-dragging');
                    touchStartX = null;
                    touchStartY = null;
                    dragging = false;
                    return;
                } else {
                    explorarLastTapTime = nowTap;
                }
            }
            const touch = event.changedTouches && event.changedTouches[0];
            const endX = touch?.clientX ?? 0;
            const endY = touch?.clientY ?? 0;
            const overlayRect = explorarVideoOverlay.getBoundingClientRect();
            const deltaX = (endX - (touchStartX ?? endX));
            const deltaY = (endY - (touchStartY ?? endY));
            const closeVerticalThreshold = 100;
            if (dragging && Math.abs(deltaY) > closeVerticalThreshold) {
                // Arraste forte para cima/baixo: fecha
                closeExplorarVideo();
            } else {
                // Não fechou: volta para o lugar original
                if (!explorarVideoOverlay.classList.contains('hidden')) {
                    if (typeof resumeExplorarStory === 'function' && explorarStoryMode) resumeExplorarStory();
                    try { explorarVideoFull?.play?.(); } catch {}
                    explorarVideoOverlay.style.transform = '';
                }
            }
            explorarVideoOverlay.classList.remove('is-dragging');
            touchStartX = null;
            touchStartY = null;
            dragging = false;
        });
    }

    window.addEventListener('popstate', () => {
        history.pushState(null, document.title, location.href);
    });

    let explorarSelectedFile = null;

    const normalizeExplorarText = (text) => String(text || '')
        .normalize('NFD')
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const resetExplorarModal = () => {
        explorarSelectedFile = null;
        if (explorarPostDesc) explorarPostDesc.value = '';
        if (explorarPostPreview) explorarPostPreview.innerHTML = '';
        if (explorarMediaInput) explorarMediaInput.value = '';
    };

    const openExplorarModal = (file) => {
        if (!explorarPostModal || !explorarPostPreview) return;
        try {
            if (explorarPostModal.parentElement && explorarPostModal.parentElement !== document.body) {
                document.body.appendChild(explorarPostModal);
            }
        } catch {}
        try {
            window.scrollTo({ top: 0, behavior: 'auto' });
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
        } catch {}
        explorarSelectedFile = file || null;
        explorarPostPreview.innerHTML = '';
        if (file) {
            const isVideo = file.type.startsWith('video/');
            const url = URL.createObjectURL(file);
            explorarPostPreview.innerHTML = isVideo
                ? `<video src="${url}" playsinline controls preload="metadata"></video>`
                : `<img src="${url}" alt="Prévia">`;
            if (isVideo) {
                const previewVideo = explorarPostPreview.querySelector('video');
                if (previewVideo) {
                    previewVideo.addEventListener('loadeddata', () => {
                        try {
                            previewVideo.currentTime = Math.min(0.1, previewVideo.duration || 0);
                        } catch (e) {}
                        try { previewVideo.muted = false; } catch {}
                        previewVideo.play().catch(() => {});
                    }, { once: true });
                }
            }
        }
        explorarPostModal.classList.add('is-open');
        explorarPostModal.removeAttribute('inert');
        explorarPostModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('explorar-post-modal-open');
    };

    const closeExplorarModal = () => {
        if (!explorarPostModal) return;
        explorarPostModal.classList.remove('is-open');
        try {
            if (explorarPostModal.contains(document.activeElement)) {
                /** @type {HTMLElement} */(document.activeElement)?.blur?.();
            }
            explorarPostModal.setAttribute('inert', '');
        } catch {}
        explorarPostModal.setAttribute('aria-hidden', 'true');
        resetExplorarModal();
        document.body.classList.remove('explorar-post-modal-open');
    };

    if (explorarAddMediaBtn && explorarMediaInput) {
        const showExplorarMsg = (msg) => {
            if (!explorarValidationMsg) return;
            explorarValidationMsg.textContent = msg;
            explorarValidationMsg.classList.add('visible');
            setTimeout(() => {
                explorarValidationMsg.classList.remove('visible');
            }, 3000);
        };

        explorarAddMediaBtn.addEventListener('click', () => {
            explorarMediaInput.click();
        });
        explorarMediaInput.addEventListener('change', (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) {
                // Determine Limit based on OS
                const ua = navigator.userAgent;
                let maxSize = 500 * 1024 * 1024; // Default Desktop 500MB
                if (/Android/i.test(ua)) {
                    maxSize = 72 * 1024 * 1024;
                } else if (/iPhone|iPad|iPod/i.test(ua)) {
                    maxSize = 287 * 1024 * 1024;
                }

                // Validação de Tamanho
                if (file.size > maxSize) {
                    showExplorarMsg('Exedeu o limite de tamanho do video');
                    explorarMediaInput.value = ''; // Limpa o input
                    return;
                }

                // Validação de Vídeo (Duração max 30s)
                if (file.type.startsWith('video/')) {
                    openExplorarModal(file);
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = function() {
                        window.URL.revokeObjectURL(video.src);
                        if (video.duration > 31) { // Margem de erro de 1s
                            showExplorarMsg('Apenas videos de 30 segundos');
                            explorarMediaInput.value = ''; // Limpa o input
                            closeExplorarModal();
                        } else {
                            // ok, nada a fazer (modal já aberto)
                        }
                    };
                    video.onerror = function() {
                         window.URL.revokeObjectURL(video.src);
                         console.error('Erro ao carregar metadados do vídeo.');
                         // mantém modal aberto, apenas loga erro
                    };
                    video.src = URL.createObjectURL(file);
                } else {
                    openExplorarModal(file);
                }
            }
        });
    }

    if (explorarPostClose) {
        explorarPostClose.addEventListener('click', closeExplorarModal);
    }

    if (explorarPostModal) {
        explorarPostModal.addEventListener('click', (event) => {
            if (event.target === explorarPostModal) {
                closeExplorarModal();
            }
        });
    }

    if (explorarPostSend) {
        explorarPostSend.addEventListener('click', async () => {
            if (!token) return;
            const content = explorarPostDesc?.value || '';
            if (!content.trim() && !explorarSelectedFile) return;
            const formData = new FormData();
            formData.append('content', content);
            const categoriaAtual = explorarCategoriaCurrent?.textContent?.trim();
            if (categoriaAtual && categoriaAtual !== 'Todas') {
                formData.append('category_tag', categoriaAtual);
            }
            if (explorarSelectedFile) {
                formData.append('media', explorarSelectedFile);
            }
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/api/explorar-posts', true);
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                let uploadBar = null;
                let uploadWrapper = null;
                if (explorarPostPreview) {
                    uploadWrapper = explorarPostPreview.querySelector('.explorar-upload-progress');
                    if (!uploadWrapper) {
                        uploadWrapper = document.createElement('div');
                        uploadWrapper.className = 'explorar-upload-progress';
                        const bar = document.createElement('div');
                        bar.className = 'explorar-upload-progress-bar';
                        uploadWrapper.appendChild(bar);
                        explorarPostPreview.appendChild(uploadWrapper);
                        uploadBar = bar;
                    } else {
                        uploadBar = uploadWrapper.querySelector('.explorar-upload-progress-bar');
                    }
                }
                if (uploadWrapper && uploadBar) {
                    uploadWrapper.style.display = 'block';
                    uploadBar.style.width = '0%';
                }
                xhr.upload.onprogress = (e) => {
                    if (!uploadBar || !uploadWrapper) return;
                    if (e.lengthComputable && e.total > 0) {
                        const raw = (e.loaded / e.total) * 95;
                        const pct = Math.max(0, Math.min(95, Math.floor(raw)));
                        uploadBar.style.width = `${pct}%`;
                    } else {
                        uploadBar.style.width = '20%';
                    }
                };
                xhr.onreadystatechange = () => {
                    if (xhr.readyState !== 4) return;
                    if (uploadWrapper && uploadBar) {
                        uploadBar.style.width = '100%';
                        uploadWrapper.style.display = 'block';
                    }
                    try {
                        const data = JSON.parse(xhr.responseText || '{}');
                        if (xhr.status < 200 || xhr.status >= 300 || data?.success === false) {
                            throw new Error(data?.message || 'Erro ao publicar.');
                        }
                        closeExplorarModal();
                        fetchExplorarFeed();
                    } catch (err) {
                        console.error('Erro ao enviar explorar:', err);
                    }
                };
                xhr.send(formData);
            } catch (err) {
                console.error('Erro ao enviar explorar:', err);
            }
        });
    }
    
    // --- Filtros e Configurações ---
    const feedTipoSelect = document.getElementById('feed-tipo-select');
    const filtroCidadeInput = document.getElementById('filtro-cidade');
    const filtroCidadeBtn = document.getElementById('filtro-cidade-btn');
    const datalistCidades = document.getElementById('cidade-sugestoes');
    // Mantém o estado do filtro (para reaplicar após recarregar posts por cidade, etc.)
    let currentTipoFeed = 'todos';
    const destaquesScroll = document.getElementById('destaques-scroll');
    const modalDestaqueServico = document.getElementById('modal-destaque-servico');
    const destaqueModalImagens = document.getElementById('destaque-modal-imagens');
    const destaqueModalInfo = document.getElementById('destaque-modal-info');
    const destaqueModalPerfil = document.getElementById('destaque-modal-perfil');
    const btnDestaquesAvancar = document.getElementById('btn-destaques-avancar');
    const btnDestaquesVoltar = document.getElementById('btn-destaques-voltar');
    let destaquesCache = [];
    
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const htmlElement = document.documentElement; // O elemento <html>

    // --- Disponibilidade (no menu lateral do feed) ---
    const menuDisponibilidade = document.getElementById('menu-disponibilidade');
    const toggleDisponibilidade = document.getElementById('toggle-disponibilidade');

    async function initDisponibilidadeMenu() {
        if (!menuDisponibilidade || !toggleDisponibilidade) return;
        if (!token) {
            menuDisponibilidade.style.display = 'none';
            return;
        }

        // Evita múltiplos listeners se o script re-inicializar por algum motivo
        if (toggleDisponibilidade.dataset.bound === '1') return;
        toggleDisponibilidade.dataset.bound = '1';

        try {
            const resp = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            const user = data?.user || data; // compat

            // Mostra principalmente para profissionais (mas não quebra se não existir campo)
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
                            'Authorization': `Bearer ${token}`
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

    // --- Barra inferior (mobile) ---
    const bottomNavHomeBtn = document.getElementById('bottom-nav-home');
    const bottomNavQuickBtn = document.getElementById('bottom-nav-quick');
    const bottomNavSearchBtn = document.getElementById('bottom-nav-search');
    const bottomNavNotificationsBtn = document.getElementById('bottom-nav-notifications');
    const bottomNavSettingsBtn = document.getElementById('bottom-nav-settings');
    let abrirBuscaComHistorico = null;

    function fecharModaisPrecisoAgoraEPedidoUrgente() {
        const m1 = document.getElementById('modal-preciso-agora');
        const m2 = document.getElementById('modal-pedido-urgente');
        let mudou = false;
        if (m1 && !m1.classList.contains('hidden')) {
            m1.classList.add('hidden');
            mudou = true;
        }
        if (m2 && !m2.classList.contains('hidden')) {
            m2.classList.add('hidden');
            mudou = true;
        }
        if (mudou) {
            try { window.syncModalScrollLock?.(); } catch {}
        }
        return mudou;
    }

    // Se algum desses dois modais estiver aberto e o usuário clicar no header
    // ou na barra inferior, fecha antes de abrir qualquer outra coisa.
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;

        const modalPrecisoAgoraOpen = (() => {
            const el = document.getElementById('modal-preciso-agora');
            return !!(el && !el.classList.contains('hidden'));
        })();
        const modalPedidoUrgenteOpen = (() => {
            const el = document.getElementById('modal-pedido-urgente');
            return !!(el && !el.classList.contains('hidden'));
        })();
        if (!modalPrecisoAgoraOpen && !modalPedidoUrgenteOpen) return;

        const clickedHeader = !!target.closest('header');
        const clickedBottomNav = !!target.closest('#mobile-bottom-nav, .mobile-bottom-nav');
        if (!clickedHeader && !clickedBottomNav) return;

        // Não interfere se o clique foi em botão de fechar modal (será tratado na lógica existente)
        if (target.closest('.btn-close-modal')) return;

        fecharModaisPrecisoAgoraEPedidoUrgente();
    }, true);

    function fecharBuscaUI() {
        // Fecha UI de busca (campo + resultados + backdrop)
        headerEl && headerEl.classList.remove('search-open');
        if (searchResultsContainer) {
            searchResultsContainer.innerHTML = '';
            searchResultsContainer.style.display = 'none';
        }
        if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
        const backdropEl = document.getElementById('search-results-backdrop');
        if (backdropEl) {
            backdropEl.classList.remove('visible');
            backdropEl.style.display = 'none';
        }
    }

    // Mantém uma variável CSS com a altura real do header (pra posicionar modais abaixo dele)
    function atualizarAlturaHeaderCssVar() {
        if (!headerEl) return;
        const h = Math.ceil(headerEl.getBoundingClientRect().height || 70);
        document.documentElement.style.setProperty('--header-height', `${h}px`);
    }

    // Mantém uma variável CSS com a altura real da barra inferior (pra recortar modais)
    const bottomNavEl = document.getElementById('mobile-bottom-nav') || document.querySelector('.mobile-bottom-nav');
    function atualizarAlturaBottomNavCssVar() {
        if (!bottomNavEl) return;
        const h = Math.ceil(bottomNavEl.getBoundingClientRect().height || 56);
        document.documentElement.style.setProperty('--bottom-nav-height', `${h}px`);
    }

    atualizarAlturaHeaderCssVar();
    atualizarAlturaBottomNavCssVar();
    window.addEventListener('resize', atualizarAlturaHeaderCssVar);
    window.addEventListener('resize', atualizarAlturaBottomNavCssVar);

    // Observa mudanças de altura do header (ex: abrir/fechar busca no mobile)
    if (headerEl && typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => atualizarAlturaHeaderCssVar());
        ro.observe(headerEl);
    }

    // Observa mudanças de altura da barra inferior (se necessário)
    if (bottomNavEl && typeof ResizeObserver !== 'undefined') {
        const roNav = new ResizeObserver(() => atualizarAlturaBottomNavCssVar());
        roNav.observe(bottomNavEl);
    }

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
                    logoImg.src = logoPaths[currentPathIndex];
                } else {
                    console.error('❌ Não foi possível carregar o logo de nenhum caminho disponível');
                }
            };
            
            // Verifica se a imagem já foi carregada corretamente
            if (!logoImg.complete || logoImg.naturalHeight === 0) {
                // Se não carregou, força reload com o primeiro caminho
                logoImg.src = logoPaths[0];
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

    // ----------------------------------------------------------------------
    // LÓGICA DO TEMA (DARK MODE)
    // ----------------------------------------------------------------------
    function updateSendCommentIcons() {
        const isDark = htmlElement.classList.contains('dark-mode');
        document.querySelectorAll('.send-comment-icon, .publish-icon, .send-reply-icon').forEach((img) => {
            const nextSrc = isDark ? img.dataset.srcDark : img.dataset.srcLight;
            if (nextSrc) img.src = nextSrc;
        });
    }

    function closeExplorarCityControls() {
        if (explorarCityControls) {
            explorarCityControls.classList.remove('is-open');
        }
        if (explorarCityRow) {
            explorarCityRow.classList.remove('is-hidden');
        }
        persistExplorarCities();
        renderExplorarCityChips();
        fetchExplorarFeed();
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = true;
        } else {
            htmlElement.classList.remove('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = false;
        }
        updateSendCommentIcons();
        updateFeedLevelBadgesTheme();
    }

    function updateFeedLevelBadgesTheme() {
        const isDark = htmlElement.classList.contains('dark-mode');
        document.querySelectorAll('.feed-fita-nivel-img').forEach((img) => {
            const nextSrc = isDark ? img.dataset.srcDark : img.dataset.srcLight;
            if (nextSrc) img.src = nextSrc;
        });
    }

    // Carregar tema salvo do localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    // Atualizar tema quando o usuário mudar
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', async () => {
            const theme = darkModeToggle.checked ? 'dark' : 'light';
            applyTheme(theme);
            localStorage.setItem('theme', theme);
            
            // Se o usuário estiver logado, atualizar a preferência no servidor
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('jwtToken');
            
            if (userId && token) {
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
                    
                    console.log('Tema atualizado com sucesso:', result);
                } catch (error) {
                    console.error('Erro ao atualizar preferência de tema:', error);
                    // Reverte a mudança em caso de erro
                    const revertedTheme = theme === 'dark' ? 'light' : 'dark';
                    applyTheme(revertedTheme);
                    localStorage.setItem('theme', revertedTheme);
                    darkModeToggle.checked = revertedTheme === 'dark';
                    alert('Não foi possível salvar sua preferência de tema. Tente novamente.');
                }
            }
        });
    }

    // ----------------------------------------------------------------------
    // LÓGICA DO TEXTAREA AUTO-RESIZE
    // ----------------------------------------------------------------------
    if (postContentInput) {
        postContentInput.addEventListener('input', () => {
            postContentInput.style.height = 'auto'; // Reseta a altura
            postContentInput.style.height = (postContentInput.scrollHeight) + 'px'; // Ajusta à altura do conteúdo
        });
    }

    // estado do botão enviar configurado após fotosPostSelecionadas

    // --- FUNÇÕES DE FEEDBACK ---
    function showMessage(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `form-message ${type}`;
            element.classList.remove('hidden');
            if (element._hideTimer) {
                clearTimeout(element._hideTimer);
            }
            const timeout = type === 'info' ? 3000 : 4000;
            element._hideTimer = setTimeout(() => {
                element.classList.add('hidden');
            }, timeout);
        }
    }

    // ----------------------------------------------------------------------
    // TOGGLE DE BUSCA NO MOBILE
    // ----------------------------------------------------------------------
    if (searchToggleBtn && searchInput) {
        searchToggleBtn.addEventListener('click', () => {
            if (!headerEl) return;
            const willOpen = !headerEl.classList.contains('search-open');
            if (willOpen) {
                headerEl.classList.add('search-open');
                searchInput.focus();
            } else {
                fecharBuscaUI();
                document.getElementById('search-results-backdrop')?.classList.remove('visible');
            }
        });
    }

    // ----------------------------------------------------------------------
    // BARRA INFERIOR (MOBILE): ações rápidas / busca / notificações / config
    // ----------------------------------------------------------------------
    function isMobileScreen() {
        return window.innerWidth <= 768;
    }

    function mostrarHeaderNoMobile() {
        if (!headerEl) return;
        headerEl.classList.remove('header-hidden');
    }

    if (bottomNavHomeBtn) {
        bottomNavHomeBtn.addEventListener('click', () => {
            fecharModaisPrecisoAgoraEPedidoUrgente();
            fecharBuscaUI();
            if (explorarPage?.classList.contains('is-open')) {
                closeExplorarPanel();
                return;
            }
            if (feedExplorarSlider) {
                feedExplorarSlider.classList.remove('is-explorar');
                feedExplorarSlider.style.transform = 'translateX(-100vw)';
            }
        });
    }

    const headerExplorarBtn = document.getElementById('header-explorar');
    if (headerExplorarBtn) {
        headerExplorarBtn.addEventListener('click', () => {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            
            // Toggle logic for desktop
            if (!isMobile) {
                if (document.body.classList.contains('explorar-open')) {
                    closeExplorarPanel();
                } else {
                    openExplorarPanel(true);
                }
                return;
            }

            fecharModaisPrecisoAgoraEPedidoUrgente();
            fecharBuscaUI();
            openExplorarPanel();
        });
    }

    // Botão Voltar Desktop (ao lado do Menu)
    const desktopBackBtn = document.getElementById('desktop-back-btn');
    if (desktopBackBtn) {
        desktopBackBtn.addEventListener('click', () => {
            closeExplorarPanel();
        });
    }

    

    if (bottomNavQuickBtn) {
        bottomNavQuickBtn.addEventListener('click', () => {
            fecharModaisPrecisoAgoraEPedidoUrgente();
            fecharBuscaUI();
            if (mobileSidebarToggle) {
                mobileSidebarToggle.click();
            }
        });
    }

    if (bottomNavSearchBtn) {
        bottomNavSearchBtn.addEventListener('click', () => {
            if (searchToggleBtn) searchToggleBtn.click();
            if (typeof abrirBuscaComHistorico === 'function') {
                abrirBuscaComHistorico();
            }
            atualizarAlturaHeaderCssVar();
        });
    }

    if (bottomNavNotificationsBtn) {
        bottomNavNotificationsBtn.addEventListener('click', () => {
            fecharModaisPrecisoAgoraEPedidoUrgente();
            fecharBuscaUI();
            // Garante que os cabeçalhos não "sumam" ao abrir notificações
            mostrarHeaderNoMobile();
            headerEl && headerEl.classList.remove('header-hidden');
            atualizarAlturaHeaderCssVar();

            // Abre o modal de notificações reutilizando o botão existente
            const btnNotificacoes = document.getElementById('btn-notificacoes');
            if (btnNotificacoes) {
                btnNotificacoes.click();
            }
        });
    }

    if (bottomNavSettingsBtn) {
        bottomNavSettingsBtn.addEventListener('click', () => {
            fecharModaisPrecisoAgoraEPedidoUrgente();
            fecharBuscaUI();
            window.location.href = '/configuracoes-conta.html';
        });
    }

    // ----------------------------------------------------------------------
    // Permite outras páginas abrirem algo no feed (via localStorage)
    // ----------------------------------------------------------------------
    try {
        const openPanel = localStorage.getItem('feed-open-panel');
        if (openPanel) {
            localStorage.removeItem('feed-open-panel');
            if (openPanel === 'quick' && mobileSidebarToggle) {
                mobileSidebarToggle.click();
            }
            if (openPanel === 'search' && bottomNavSearchBtn) {
                bottomNavSearchBtn.click();
            }
            if (openPanel === 'notifications' && bottomNavNotificationsBtn) {
                bottomNavNotificationsBtn.click();
            }

            if (openPanel === 'preciso-agora') {
                const modal = document.getElementById('modal-preciso-agora');
                if (modal) {
                    modal.classList.remove('hidden');
                    try { window.syncModalScrollLock?.(); } catch {}
                }
            }

            if (openPanel === 'pedidos-urgentes') {
                const modal = document.getElementById('modal-pedidos-urgentes-profissional');
                if (modal) {
                    modal.classList.remove('hidden');
                    try { window.syncModalScrollLock?.(); } catch {}
                }
            }
        }

        // (Removido) abrir criar-post vindo do perfil (agora cria direto no perfil)
    } catch {
        // ignore
    }

    // ----------------------------------------------------------------------
    // HEADER SOME AO ROLAR PRA BAIXO (somente no mobile)
    // ----------------------------------------------------------------------
    if (headerEl) {
        let lastY = window.scrollY || 0;
        let ticking = false;

        const onScroll = () => {
            if (!isMobileScreen()) {
                headerEl.classList.remove('header-hidden');
                lastY = window.scrollY || 0;
                return;
            }

            // Não esconder o header enquanto notificações estiverem abertas
            if (document.documentElement.classList.contains('modal-notificacoes-open')) {
                headerEl.classList.remove('header-hidden');
                lastY = window.scrollY || 0;
                return;
            }

            // Não esconder o header enquanto a busca estiver aberta
            if (headerEl.classList.contains('search-open')) {
                headerEl.classList.remove('header-hidden');
                lastY = window.scrollY || 0;
                return;
            }

            const y = window.scrollY || 0;
            const delta = y - lastY;

            // Depois de um pequeno offset, rolando pra baixo -> esconde
            if (y > 110 && delta > 6) {
                headerEl.classList.add('header-hidden');
            }

            // Rolando pra cima -> mostra
            if (delta < -6 || y < 60) {
                headerEl.classList.remove('header-hidden');
            }

            lastY = y;
        };

        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                onScroll();
                ticking = false;
            });
        }, { passive: false });
    }

    // ----------------------------------------------------------------------
    // OBSERVA ABERTURA/FECHAMENTO DO MODAL DE NOTIFICAÇÕES
    // (pra manter header visível e facilitar CSS)
    // ----------------------------------------------------------------------
    const modalNotificacoesEl = document.getElementById('modal-notificacoes');
    if (modalNotificacoesEl) {
        const syncNotifState = () => {
            const aberto = !modalNotificacoesEl.classList.contains('hidden');
            document.documentElement.classList.toggle('modal-notificacoes-open', aberto);
            if (aberto) {
                mostrarHeaderNoMobile();
                atualizarAlturaHeaderCssVar();
                atualizarAlturaBottomNavCssVar();
                fecharBuscaUI();
            }
        };

        syncNotifState();
        const obs = new MutationObserver(syncNotifState);
        obs.observe(modalNotificacoesEl, { attributes: true, attributeFilter: ['class'] });
    }

    // ----------------------------------------------------------------------
    // --- CARREGAMENTO INICIAL ---
    function loadHeaderInfo() {
        const storedName = localStorage.getItem('userName') || '';
        const storedPhotoUrl = localStorage.getItem('userPhotoUrl');

        const syncExplorarAvatar = () => {
            if (explorarUserAvatar && userAvatarHeader?.src) {
                explorarUserAvatar.src = userAvatarHeader.src;
            }
        };

        if (userNameHeader) {
            userNameHeader.textContent = storedName ? storedName.split(' ')[0] : '';
        }
        if (userAvatarHeader) {
            // Se não tem foto ou é inválida, usa a imagem padrão
            if (!storedPhotoUrl || storedPhotoUrl === 'undefined' || storedPhotoUrl === 'null' || storedPhotoUrl.includes('placehold.co/50?text=User')) {
                userAvatarHeader.src = '/imagens/default-user.png';
                syncExplorarAvatar();
                if (token) {
                    const headers = { 'Authorization': `Bearer ${token}` };
                    fetch('/api/user/me', { headers })
                        .then((resp) => resp.json())
                        .then((data) => {
                            const user = data?.usuario || data?.user || data;
                            if (user?.cidade) {
                                localStorage.setItem('userCity', user.cidade);
                            }
                            const apiPhoto = user?.avatarUrl || user?.foto;
                            if (apiPhoto) {
                                localStorage.setItem('userPhotoUrl', apiPhoto);
                                userAvatarHeader.src = apiPhoto;
                                syncExplorarAvatar();
                                return;
                            }
                            return fetch('/api/usuario/me', { headers })
                                .then((resp) => resp.json())
                                .then((fallbackData) => {
                                    const fallbackUser = fallbackData?.usuario || fallbackData?.user || fallbackData;
                                    const fallbackPhoto = fallbackUser?.avatarUrl || fallbackUser?.foto;
                                    if (fallbackPhoto) {
                                        localStorage.setItem('userPhotoUrl', fallbackPhoto);
                                        userAvatarHeader.src = fallbackPhoto;
                                        syncExplorarAvatar();
                                    }
                                });
                        })
                        .catch(() => {});
                }
                return; // Retorna cedo para não continuar o processamento
            } else if (!storedPhotoUrl.includes('pixabay')) {
                // Remove src primeiro para forçar reload completo
                userAvatarHeader.src = '';

                // Usa a URL salva (sem cache-bust em toda navegação)
                const freshUrl = storedPhotoUrl;

                // Pré-carrega a imagem SEM usar crossOrigin (evita erros de CORS com S3)
                const preloadImg = new Image();

                preloadImg.onload = function () {
                    userAvatarHeader.src = freshUrl;
                    userAvatarHeader.loading = 'eager';
                    userAvatarHeader.decoding = 'sync';
                    syncExplorarAvatar();
                    
                    userAvatarHeader.style.opacity = '0';
                    setTimeout(() => {
                        userAvatarHeader.style.opacity = '1';
                        userAvatarHeader.offsetHeight;
                    }, 10);
                };
                
                preloadImg.onerror = function () {
                    // Se a foto do usuário falhar, usa a imagem padrão
                    userAvatarHeader.src = '/imagens/default-user.png';
                    userAvatarHeader.loading = 'eager';
                    syncExplorarAvatar();
                };
                
                preloadImg.src = freshUrl;
            } else {
                // Sem foto do usuário, usa a imagem padrão
                userAvatarHeader.src = '/imagens/default-user.png';
                syncExplorarAvatar();
            }
        }
        syncExplorarAvatar();
    }

    // ----------------------------------------------------------------------
    // DESTAQUES MINI (faixa tipo stories)
    // ----------------------------------------------------------------------
    function buildDemoDestaques() {
        const nomes = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eva', 'Fábio', 'Gabi', 'Hugo', 'Iris', 'João'];
        return nomes.map((nome, idx) => {
            const img = `https://placehold.co/300x200?text=Trabalho+${idx+1}`;
            return {
                id: `demo-${idx}`,
                title: `Projeto ${idx + 1}`,
                description: 'Trabalho de demonstração',
                images: [img, img, img, img, img, img],
                thumbUrls: [img],
                user: {
                    _id: `demo-user-${idx}`,
                    nome: nome,
                    cidade: 'Sua cidade',
                    estado: 'BR',
                    mediaAvaliacao: 5
                },
                mediaAvaliacao: 5,
                totalValidacoes: 10,
                createdAt: new Date()
            };
        });
    }

    async function fetchDestaques() {
        if (!destaquesScroll) return;
        destaquesScroll.innerHTML = '<p class="mensagem-vazia" style="padding:8px 10px;margin:0;">Carregando...</p>';
        try {
            // Garante que temos a cidade do usuário para filtro
            // Sempre busca do servidor para garantir consistência
            if (token) {
                try {
                    const uResp = await fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } });
                    if (uResp.ok) {
                        const uData = await uResp.json();
                        const u = uData?.usuario || uData?.user || uData;
                        if (u?.cidade) {
                            localStorage.setItem('userCity', u.cidade);
                        }
                    }
                } catch (e) { console.warn('Falha ao obter cidade user:', e); }
            }

            const response = await fetch(`/api/destaques-servicos?_t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Erro ao carregar destaques');
            }
            const recebidos = data.destaques || [];
            
            let filtered = recebidos;
            const userCity = localStorage.getItem('userCity');
            
            if (userCity && recebidos.length > 0) {
                // O servidor já deve retornar filtrado, mas o frontend pode refinar se necessário.
                // Se o servidor retornou items de outra cidade (ex: cache de query), o filtro aqui resolve.
                // Mas se o user mudou a cidade, o localStorage deve estar atualizado.
                filtered = recebidos.filter(item => {
                    // Item pode ser o próprio user object ou ter .user/.userId
                    const p = item.user || item.userId || item; // item pode ser o user direto se vier do endpoint modificado
                    // No novo endpoint, 'item' É o objeto do usuário (profissional)
                    // Mas verificamos se tem wrapper
                    const prof = p._id ? p : item;
                    
                    return prof.cidade && prof.cidade.trim().toLowerCase() === userCity.trim().toLowerCase();
                });
            }

            // Se veio da API mas o filtro removeu tudo, exibe vazio.
            // Se a API não trouxe nada, exibe demo.
            if (recebidos.length > 0 && filtered.length === 0) {
                destaquesCache = [];
            } else {
                destaquesCache = filtered.length > 0 ? filtered : buildDemoDestaques();
            }

            renderDestaquesMini(destaquesCache);
            setTimeout(atualizarBotoesDestaques, 120);
        } catch (error) {
            console.error('Erro ao buscar destaques:', error);
            destaquesCache = buildDemoDestaques();
            renderDestaquesMini(destaquesCache);
            setTimeout(atualizarBotoesDestaques, 120);
        }
    }

    function renderDestaquesMini(lista) {
        if (!destaquesScroll) return;
        if (!lista || lista.length === 0) {
            destaquesScroll.innerHTML = '<p class="mensagem-vazia" style="padding:8px 10px;margin:0;">Ainda sem destaques. Profissionais com 4.5+ estrelas e 50+ avaliações aparecerão aqui!</p>';
            return;
        }

        destaquesScroll.innerHTML = '';

        lista.forEach(item => {
            const profissional = item.user || item.userId || {};
            const foto = profissional.foto || profissional.avatarUrl || 'imagens/default-user.png';
            const nota = item.mediaAvaliacao || profissional.mediaAvaliacao || 0;
            const isEmpresa = profissional.tipo === 'empresa';
            const profissao = profissional.atuacao || 'Profissional';
            
            const card = document.createElement('div');
            card.className = 'thumb-destaque';
            card.innerHTML = `
                <img src="${foto}" alt="Foto de ${profissional.nome || 'Profissional'}" loading="lazy" decoding="async">
                <div class="thumb-overlay"></div>
                <div class="thumb-info-overlay">
                    ${isEmpresa ? '' : `<div class="thumb-profissao">${profissao}</div>`}
                    <div class="thumb-avaliacao">
                        <i class="fas fa-star" style="color:#f5a623;"></i> 
                        <span>${nota.toFixed(1)}</span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                const perfilId = profissional._id || item.userId || item.idUser;
                navigateToProfile(perfilId);
            });
            destaquesScroll.appendChild(card);
        });
    }

    function openDestaqueModal(item) {
        if (!modalDestaqueServico || !destaqueModalImagens || !destaqueModalInfo) return;
        const imagens = (item.images || []).slice(0, 6);
        const thumbs = (item.thumbUrls || []).slice(0, 6);
        const fotos = thumbs.length ? thumbs : imagens;
        const profissional = item.user || {};
        const cidadeEstado = [profissional.cidade, profissional.estado].filter(Boolean).join(' - ');
        const nota = item.mediaAvaliacao || profissional.mediaAvaliacao || 0;

        destaqueModalImagens.innerHTML = fotos.map(img => `<img src="${img}" alt="Foto do serviço">`).join('');
        destaqueModalInfo.innerHTML = `
            <p class="destaque-prof" style="margin:0; font-weight:700;">${item.title || 'Serviço'}</p>
            <p class="destaque-local" style="margin:4px 0 0 0;">${profissional.nome || 'Profissional'} ${cidadeEstado ? '• ' + cidadeEstado : ''}</p>
            <p class="destaque-nota" style="margin:6px 0 0 0;"><i class="fas fa-star" style="color:#f5a623;"></i> ${(nota || 0).toFixed(1)}</p>
        `;

        const perfilId = profissional._id || item.userId || item.idUser;
        if (destaqueModalPerfil) {
            destaqueModalPerfil.onclick = () => {
                navigateToProfile(perfilId);
            };
        }

        modalDestaqueServico.classList.remove('hidden');
    }

    const UF_LIST = new Set([
        'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ]);

    const UF_TO_STATE_NAME = {
        AC: 'Acre',
        AL: 'Alagoas',
        AP: 'Amapá',
        AM: 'Amazonas',
        BA: 'Bahia',
        CE: 'Ceará',
        DF: 'Distrito Federal',
        ES: 'Espírito Santo',
        GO: 'Goiás',
        MA: 'Maranhão',
        MT: 'Mato Grosso',
        MS: 'Mato Grosso do Sul',
        MG: 'Minas Gerais',
        PA: 'Pará',
        PB: 'Paraíba',
        PR: 'Paraná',
        PE: 'Pernambuco',
        PI: 'Piauí',
        RJ: 'Rio de Janeiro',
        RN: 'Rio Grande do Norte',
        RS: 'Rio Grande do Sul',
        RO: 'Rondônia',
        RR: 'Roraima',
        SC: 'Santa Catarina',
        SP: 'São Paulo',
        SE: 'Sergipe',
        TO: 'Tocantins'
    };
    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    // Mapa por nome normalizado (sem acento) -> UF
    const STATE_NAME_TO_UF = Object.fromEntries(
        Object.entries(UF_TO_STATE_NAME).map(([uf, name]) => [normalizeText(name), uf])
    );

    function isUF(value) {
        const v = String(value || '').trim().toUpperCase();
        return v.length === 2 && UF_LIST.has(v);
    }

    function isStateName(value) {
        const v = normalizeText(value);
        return !!STATE_NAME_TO_UF[v];
    }

    function populateDatalist(values) {
        if (!datalistCidades) return;
        datalistCidades.innerHTML = '';
        const frag = document.createDocumentFragment();
        (values || []).filter(Boolean).forEach((v) => {
            const opt = document.createElement('option');
            opt.value = v;
            frag.appendChild(opt);
        });
        datalistCidades.appendChild(frag);
    }

    async function fetchPosts(cidade = null, estado = null) {
        if (!postsContainer) return;
        let url = '/api/posts';
        const params = new URLSearchParams();
        if (cidade) params.set('cidade', cidade);
        if (estado) params.set('estado', estado);
        const qs = params.toString();
        if (qs) url += `?${qs}`;
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Não foi possível carregar as postagens.');
            }
            const posts = await response.json();
            atualizarSugestoesCidades(posts);
            renderPosts(posts);
            applyProfileReturnScroll();
            // Reaplica o filtro atual após renderizar/recarregar o feed
            if (typeof filterFeed === 'function') {
                filterFeed(currentTipoFeed);
            }
        } catch (error) {
            console.error('Erro ao buscar postagens:', error);
            postsContainer.innerHTML = '<p class="mensagem-vazia">Erro ao carregar o feed.</p>';
        }
    }

    let explorarSelectedCities = [];
    let explorarLazyObserver = null;
    let explorarTouchStart = null;
    let explorarHasFetched = false;

    function normalizeCityKey(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function formatCityName(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return raw
            .toLowerCase()
            .split(/\s+/)
            .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
            .join(' ');
    }

    function resolveCityName(value) {
        const formatted = formatCityName(value);
        if (!explorarCidadesDatalist) return formatted;
        const options = Array.from(explorarCidadesDatalist.options || []);
        const match = options.find((opt) => normalizeCityKey(opt.value) === normalizeCityKey(formatted));
        return match ? match.value : formatted;
    }

    function persistExplorarCities() {
        try {
            localStorage.setItem('explorarCities', JSON.stringify(explorarSelectedCities));
        } catch (e) {
            console.warn('Nao foi possivel salvar cidades do explorar.');
        }
    }

    function renderExplorarCityChips() {
        if (!explorarCidadeChips) return;
        explorarCidadeChips.innerHTML = '';
        if (explorarCityName) {
            explorarCityName.textContent = explorarSelectedCities.length
                ? explorarSelectedCities.join(', ')
                : '-';
        }
        explorarSelectedCities.forEach((cidade) => {
            const chip = document.createElement('div');
            chip.className = 'explorar-city-chip';
            chip.innerHTML = `
                <span>${cidade}</span>
                <button type="button" aria-label="Remover cidade">&times;</button>
            `;
            const btn = chip.querySelector('button');
            btn.addEventListener('click', () => {
                explorarSelectedCities = explorarSelectedCities.filter((c) => normalizeCityKey(c) !== normalizeCityKey(cidade));
                persistExplorarCities();
                renderExplorarCityChips();
                fetchExplorarFeed();
            });
            explorarCidadeChips.appendChild(chip);
        });
    }

    function addExplorarCity(value) {
        const city = resolveCityName(value);
        if (!city) return;
        const exists = explorarSelectedCities.some((c) => normalizeCityKey(c) === normalizeCityKey(city));
        if (exists) return;
        explorarSelectedCities = [city, ...explorarSelectedCities.filter((c) => normalizeCityKey(c) !== normalizeCityKey(city))];
        persistExplorarCities();
        renderExplorarCityChips();
        fetchExplorarFeed();
        if (explorarCityControls) {
            explorarCityControls.classList.remove('is-open');
        }
        if (explorarCityRow) {
            explorarCityRow.classList.remove('is-hidden');
        }
    }

    function setupExplorarLazyLoading() {
        if (!explorarFeedList || !('IntersectionObserver' in window)) return;
        if (explorarLazyObserver) {
            explorarLazyObserver.disconnect();
        }
        const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
        const observerOptions = isDesktop
            ? { root: null, rootMargin: '400px 0px', threshold: 0.25 }
            : { root: explorarFeedList, rootMargin: '200px 0px', threshold: 0.25 };

        explorarLazyObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const media = entry.target.querySelector('video[data-src], img[data-src]');
                if (media) {
                    const src = media.getAttribute('data-src');
                    if (src) {
                        media.setAttribute('src', src);
                        media.removeAttribute('data-src');
                        if (media.tagName === 'VIDEO') {
                            media.load();
                        }
                    }
                }
                explorarLazyObserver.unobserve(entry.target);
            });
        }, observerOptions);

        explorarFeedList.querySelectorAll('.explorar-card').forEach((card) => explorarLazyObserver.observe(card));
    }

    // Aplica src imediato aos primeiros cartões visíveis (fallback para garantir carregamento inicial)
    function primeExplorarMediaSrc() {
        if (!explorarFeedList) return;
        const cards = Array.from(explorarFeedList.querySelectorAll('.explorar-card')).slice(0, 2);
        cards.forEach((card) => {
            const media = card.querySelector('video[data-src], img[data-src]');
            if (media) {
                const src = media.getAttribute('data-src');
                if (src) {
                    media.setAttribute('src', src);
                    media.removeAttribute('data-src');
                    if (media.tagName === 'VIDEO') {
                        try { media.load(); } catch {}
                    }
                }
            }
        });
    }

    // --------------------------
    // Autoplay/Pause de vídeos
    // --------------------------
    let videoAutoObserver = null;
    function setupVideoAutoplayObserver() {
        if (!('IntersectionObserver' in window)) return;
        if (videoAutoObserver) {
            videoAutoObserver.disconnect();
        }
        const thresholds = [0.25, 0.5, 0.65, 0.8, 1];
        videoAutoObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const video = entry.target;
                const ratio = entry.intersectionRatio || 0;
                if (entry.isIntersecting && ratio >= 0.65) {
                    // Garante política de autoplay
                    try {
                        video.muted = true;
                        video.playsInline = true;
                        const p = video.play();
                        if (p && typeof p.catch === 'function') {
                            p.catch(() => {});
                        }
                    } catch {}
                } else {
                    try {
                        video.pause();
                    } catch {}
                }
            });
        }, { root: null, rootMargin: '0px', threshold: thresholds });

        // Observa vídeos já presentes
        attachAutoObserverToExistingVideos();

        // Observa adições no feed principal e no explorar
        const observeContainer = (el) => {
            if (!el) return;
            const mo = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    m.addedNodes.forEach((node) => {
                        if (!(node instanceof HTMLElement)) return;
                        node.querySelectorAll?.('video').forEach((v) => {
                            v.muted = true;
                            v.playsInline = true;
                            videoAutoObserver.observe(v);
                        });
                        if (node.tagName === 'VIDEO') {
                            node.muted = true;
                            node.playsInline = true;
                            videoAutoObserver.observe(node);
                        }
                    });
                });
            });
            mo.observe(el, { childList: true, subtree: true });
        };

        observeContainer(document.getElementById('posts-container'));
        observeContainer(document.getElementById('explorar-feed-list'));
    }

    function attachAutoObserverToExistingVideos() {
        const candidates = [
            ...document.querySelectorAll('#posts-container video.post-media-item'),
            ...document.querySelectorAll('#explorar-feed-list video')
        ];
        candidates.forEach((v) => {
            try {
                v.muted = true;
                v.playsInline = true;
                videoAutoObserver.observe(v);
            } catch {}
        });
    }

    function buildExplorarActionLinks(item) {
        const actions = [];
        if (item?.perfilUrl) {
            actions.push({ label: 'Ver perfil', url: item.perfilUrl, className: 'outline' });
        }
        if (item?.whatsappUrl) {
            actions.push({ label: 'Chamar no Zap', url: item.whatsappUrl, className: 'secondary' });
        }
        if (item?.linkUrl) {
            actions.push({ label: 'Ver oferta', url: item.linkUrl, className: '' });
        }
        if (actions.length === 0) {
            actions.push({ label: 'Ver detalhes', url: item?.perfilUrl || item?.linkUrl || '#', className: '' });
        }
        return actions;
    }

    function renderExplorarFeed(items) {
        if (!explorarFeedList) return;
        explorarFeedList.innerHTML = '';

        if (!Array.isArray(items) || items.length === 0) {
            if (explorarFeedStatus) {
                explorarFeedStatus.textContent = 'Sem videos para estas cidades no momento.';
            }
            return;
        }

        if (explorarFeedStatus) {
            explorarFeedStatus.textContent = '';
        }

        items.forEach((item, index) => {
            const card = document.createElement('article');
            card.className = 'explorar-card';
            const rawItemId = item?._id || item?.id || '';
            if (rawItemId) {
                card.dataset.explorarId = String(rawItemId);
            }
            const mediaUrl = item.mediaUrl || item.imagemUrl || '';
            const isVideo = String(item.mediaType || '').includes('video');
            const badge = item.tipo === 'anuncio' ? 'Anuncio' : '';
            const title = item.titulo || item.nome || 'Oferta local';
            const desc = item.descricao || item.content || '';
            const cityText = [item.cidade, item.estado].filter(Boolean).join(' - ');
            const empresaNome = item.empresa || item.nomeEmpresa || item.user?.nome || item.anunciante || item.titulo || item.nome || 'Perfil';
            const actions = buildExplorarActionLinks(item);
            const perfilAction = actions.find((action) => action.label === 'Ver perfil');
            const rawPerfilId = item?.userId?._id || item?.userId || item?.dono?._id || item?.dono?.id || item?.ownerId || item?.autorId;
            const ownerId = rawPerfilId?._id || rawPerfilId;
            const fallbackPerfilUrl = rawPerfilId ? `/perfil?id=${rawPerfilId}` : null;
            const perfilUrl = item?.perfilUrl || perfilAction?.url || fallbackPerfilUrl || '#';
            const rawFoto = item?.foto
                || item?.avatarUrl
                || item?.user?.foto
                || item?.user?.avatarUrl
                || item?.userId?.foto
                || item?.userId?.avatarUrl
                || item?.dono?.foto
                || item?.dono?.avatarUrl
                || item?.profissional?.foto
                || item?.profissional?.avatarUrl
                || item?.anuncianteFoto
                || '';
            const perfilFoto = rawFoto && !['undefined', 'null'].includes(String(rawFoto)) ? rawFoto : 'imagens/default-user.png';
            const likesCount = Number.isFinite(item.likesCount) ? item.likesCount : 0;
            const isLiked = !!item.isLikedByMe;

            const mediaHTML = isVideo
                ? `<video class="explorar-video" loop muted playsinline autoplay preload="metadata" data-src="${mediaUrl}"></video>`
                : `<img class="explorar-image" alt="" loading="lazy" decoding="async" data-src="${mediaUrl}">`;
            const isOwner = ownerId && userId && String(ownerId) === String(userId);
            const deleteButtonHTML = isOwner
                ? `<button class="explorar-card-delete" type="button" aria-label="Apagar status" data-id="${rawItemId}">
                        <i class="fas fa-trash"></i>
                    </button>`
                : '';

            card.innerHTML = `
                <div class="explorar-card-media">
                    ${mediaHTML}
                    ${badge ? `<div class="explorar-card-badge">${badge}</div>` : ''}
                    ${deleteButtonHTML}
                    <div class="explorar-card-info-overlay">
                        <div class="explorar-card-info">
                            <a class="explorar-card-perfil" href="${perfilUrl}">
                                <img class="explorar-card-avatar" src="${perfilFoto}" alt="${empresaNome}" onerror="this.src='imagens/default-user.png'">
                                <span class="explorar-card-empresa">${empresaNome}</span>
                            </a>
                        </div>
                        ${(desc || title) ? `<p class="explorar-card-desc">${desc || title}</p>` : ''}
                        ${cityText ? `<span class="explorar-card-cidade">${cityText}</span>` : ''}
                        ${rawItemId ? `
                        <button class="explorar-like-btn btn-like ${isLiked ? 'liked' : ''}" type="button" data-post-id="${rawItemId}" aria-label="Curtir status">
                            <i class="fas fa-heart"></i>
                            <span class="like-count">${likesCount}</span>
                        </button>` : ''}
                    </div>
                </div>
            `;

            const videoEl = card.querySelector('video.explorar-video');
            if (videoEl) {
                videoEl.addEventListener('click', (event) => {
                    event.preventDefault();
                    const src = videoEl.getAttribute('src') || videoEl.getAttribute('data-src');
                    if (src && !videoEl.getAttribute('src')) {
                        videoEl.setAttribute('src', src);
                        videoEl.removeAttribute('data-src');
                    }
                    openExplorarVideo(src, {
                        nome: empresaNome,
                        desc: desc || title,
                        cidade: cityText,
                        avatar: perfilFoto,
                        perfilUrl,
                        postId: rawItemId,
                        ownerId,
                        isStory: false
                    });
                });
            }
            // Adiciona botão WhatsApp no card do explorar ao lado do nome (apenas se não for dono)
            (async () => {
                try {
                    const perfilAnchor = card.querySelector('.explorar-card-perfil');
                    if (!perfilAnchor || !ownerId) return;
                    if (userId && String(ownerId) === String(userId)) return; // não mostra para o dono
                    const respUser = await fetch(`/api/usuario/${ownerId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const dataUser = await respUser.json();
                    if (!respUser.ok || dataUser?.success === false) return;
                    const u = dataUser.usuario || {};
                    const numeroRaw = String(u.whatsapp || u.telefone || u.celular || u.phone || '').trim();
                    const numeroDigits = numeroRaw.replace(/\D+/g, '');
                    if (!numeroDigits || numeroDigits.length < 8) return;
                    const previewUrl = `${location.origin}/?postId=${encodeURIComponent(rawItemId)}`;
                    const msg = `Olá! Vi seu vídeo e tenho uma pergunta: ${previewUrl}`;
                    const waLink = document.createElement('a');
                    waLink.href = `https://wa.me/${encodeURIComponent(numeroDigits)}?text=${encodeURIComponent(msg)}`;
                    waLink.target = '_blank';
                    waLink.rel = 'noopener noreferrer';
                    waLink.className = 'explorar-card-whatsapp';
                    waLink.innerHTML = '<i class="fab fa-whatsapp"></i>';
                    ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach((type) => {
                        waLink.addEventListener(type, (ev) => {
                            ev.stopPropagation();
                        });
                    });
                    perfilAnchor.insertAdjacentElement('afterend', waLink);
                } catch {}
            })();

            const deleteBtn = card.querySelector('.explorar-card-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const postId = deleteBtn.dataset.id;
                    if (!postId) return;
                    if (typeof showDeleteConfirmPopup !== 'function') return;
                    showDeleteConfirmPopup(deleteBtn, async () => {
                        try {
                            const response = await fetch(`/api/posts/${postId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            const data = await response.json();
                            if (!response.ok || data?.success === false) {
                                throw new Error(data?.message || 'Erro ao apagar status.');
                            }
                            card.remove();
                            explorarStoryQueue = explorarStoryQueue.filter((item) => String(item.id) !== String(postId));
                            explorarUserStory = explorarStoryQueue[0] || null;
                            setExplorarStorySegments(explorarStoryQueue.length);
                            updateExplorarStoryIndicator();
                        } catch (error) {
                            console.error('Erro ao apagar status:', error);
                            alert(error.message);
                        }
                    }, event);
                });
            }

            const imgEl = card.querySelector('img.explorar-image');
            if (imgEl) {
                imgEl.addEventListener('click', (event) => {
                    event.preventDefault();
                    const src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
                    if (src && !imgEl.getAttribute('src')) {
                        imgEl.setAttribute('src', src);
                        imgEl.removeAttribute('data-src');
                    }
                    openExplorarImage(src, {
                        nome: empresaNome,
                        desc: desc || title,
                        cidade: cityText,
                        avatar: perfilFoto,
                        perfilUrl,
                        postId: rawItemId,
                        ownerId,
                        isStory: false
                    });
                });
            }

            const likeBtn = card.querySelector('.explorar-like-btn.btn-like');
            if (likeBtn) {
                likeBtn.addEventListener('click', handleLikePost);
            }

            explorarFeedList.appendChild(card);

            if (rawItemId) {
                const overlay = card.querySelector('.explorar-card-info-overlay');
                if (overlay) {
                    (async () => {
                        try {
                            const resp = await fetch(`/api/posts/${rawItemId}/likes`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await resp.json();
                            if (!resp.ok || data?.success === false) return;
                            const preview = Array.isArray(data.likesPreview) ? data.likesPreview : [];
                            if (!preview.length) return;
                            const existing = overlay.querySelector('.explorar-like-avatars');
                            if (existing) existing.remove();
                            const avatarsBtn = document.createElement('button');
                            avatarsBtn.type = 'button';
                            avatarsBtn.className = 'explorar-like-avatars';
                            preview.forEach((u) => {
                                if (!u || !u.foto) return;
                                const img = document.createElement('img');
                                img.src = u.foto;
                                img.alt = u.nome || '';
                                img.className = 'explorar-like-avatar';
                                img.referrerPolicy = 'no-referrer';
                                avatarsBtn.appendChild(img);
                            });
                            if (!avatarsBtn.childElementCount) return;
                            const isOwnerForModal = isOwner && Array.isArray(data.likes) && data.likes.length > 0;
                            if (isOwnerForModal) {
                                avatarsBtn.addEventListener('click', () => {
                                    openLikesModal(rawItemId, data.likes, avatarsBtn);
                                });
                            }
                            overlay.appendChild(avatarsBtn);
                        } catch {}
                    })();
                }
            }

            if ((index + 1) % 4 === 0) {
                const ad = pickNextAdFeed();
                if (ad) {
                    const adEl = buildAdElementFeed(ad);
                    adEl.classList.add('explorar-card');
                    explorarFeedList.appendChild(adEl);
                }
            }
        });

        setupExplorarLazyLoading();
        primeExplorarMediaSrc();
        // Após carregar cards, garantir autoplay/pause conforme visibilidade
        setupVideoAutoplayObserver();
    }

    async function fetchExplorarFeed() {
        if (!explorarFeedList) return;
        if (explorarFeedStatus) {
            explorarFeedStatus.textContent = 'Carregando novidades...';
        }
        const params = new URLSearchParams();
        if (explorarSelectedCities.length > 0) {
            params.set('cidades', explorarSelectedCities.join(','));
        }
        const categoriaAtual = explorarCategoriaCurrent?.textContent?.trim();
        if (categoriaAtual && categoriaAtual !== 'Todas') {
            params.set('categoria', categoriaAtual);
        }
        const url = `/api/explorar-feed?${params.toString()}`;
        try {
            const resp = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok || data?.success === false) {
                throw new Error(data?.message || 'Falha ao carregar explore.');
            }
            const items = Array.isArray(data?.items) ? data.items : [];
            renderExplorarFeed(items);
            applyProfileReturnScroll();
            if (userId) {
                const userStories = items.filter((item) => {
                    const itemUserId = item?.userId?._id || item?.userId || item?.autorId || item?.ownerId;
                    return item?.tipo === 'post' && itemUserId && String(itemUserId) === String(userId) && item?.mediaUrl;
                });
                explorarStoryQueue = userStories.map((story) => ({
                    id: String(story._id || ''),
                    ownerId: story?.userId?._id || story?.userId || story?.ownerId || story?.autorId,
                    mediaUrl: story.mediaUrl,
                    isVideo: String(story.mediaType || '').includes('video'),
                    nome: story?.titulo || story?.nome || 'Minha postagem',
                    desc: story?.descricao || story?.content || '',
                    cidade: [story?.cidade, story?.estado].filter(Boolean).join(' - ')
                }));
                explorarUserStory = explorarStoryQueue[0] || null;
                setExplorarStorySegments(explorarStoryQueue.length);
                updateExplorarStoryIndicator();
            }
            explorarHasFetched = true;
        } catch (err) {
            console.error('Erro ao carregar explorar:', err);
            if (explorarFeedStatus) {
                explorarFeedStatus.textContent = 'Nao foi possivel carregar o explorar.';
            }
        }
    }

    function openExplorarPanel(force = false) {
        if (!explorarPage) return;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (!force && !isMobile) return;
        
        explorarPage.classList.add('is-open');
        explorarPage.classList.remove('is-dragging');
        explorarPage.style.transform = '';
        explorarPage.setAttribute('aria-hidden', 'false');
        document.documentElement.classList.add('explorar-open');
        document.body.classList.add('explorar-open');

        if (isMobile) {
            if (feedExplorarSlider) {
                feedExplorarSlider.classList.add('is-explorar');
                feedExplorarSlider.classList.remove('is-dragging');
                feedExplorarSlider.style.transform = 'translateX(0)';
            }
        } else {
            // Desktop: Esconder o feed principal para mostrar o explorar no lugar
            const mainFeed = document.querySelector('main');
            if (mainFeed) mainFeed.style.display = 'none';
            // Garantir que o feedExplorarSlider ocupe o espaço se necessário
            if (feedExplorarSlider) feedExplorarSlider.style.flex = '1';
        }

        if (!explorarHasFetched) {
            fetchExplorarFeed();
        }
    }

    if (pendingExplorarOpen) {
        openExplorarPanel(true);
        pendingExplorarOpen = false;
    }

    function closeExplorarPanel() {
        if (!explorarPage) return;
        explorarPage.classList.remove('is-open');
        explorarPage.classList.remove('is-dragging');
        explorarPage.style.transform = '';
        explorarPage.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('explorar-open');
        document.body.classList.remove('explorar-open');
        
        // Restaurar visibilidade do feed (Desktop)
        const mainFeed = document.querySelector('main');
        if (mainFeed) mainFeed.style.display = '';
        if (feedExplorarSlider) feedExplorarSlider.style.flex = '';

        if (feedExplorarSlider) {
            feedExplorarSlider.classList.remove('is-explorar');
            feedExplorarSlider.classList.remove('is-dragging');
            // Remove inline transform to let CSS handle state (mobile: -100vw, desktop: none)
            feedExplorarSlider.style.transform = '';
        }
    }

    async function bootstrapExplorarCities() {
        if (!explorarSelectedCities.length && token) {
            try {
                const resp = await fetch('/api/user/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await resp.json();
                const cidade = data?.usuario?.cidade || data?.user?.cidade || '';
                if (cidade) {
                    explorarSelectedCities = [cidade];
                    persistExplorarCities();
                }
            } catch (e) {
                console.warn('Nao foi possivel obter cidade do usuario.');
            }
        }
        renderExplorarCityChips();
    }

    function setupExplorarSwipe() {
        if (!('ontouchstart' in window)) return;
        let isDragging = false;
        let wasBackdropVisible = false;
        let isClosing = false;
        document.addEventListener('touchstart', (event) => {
            if (explorarVideoOverlay && !explorarVideoOverlay.classList.contains('hidden')) {
                return;
            }
            const touch = event.touches[0];
            if (!touch) return;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (!isMobile) return;
            if (explorarPage?.classList.contains('is-open')) {
                const edgeThreshold = window.innerWidth * 0.3;
                if (touch.clientX < edgeThreshold) return;
                isClosing = true;
                explorarTouchStart = {
                    x: touch.clientX || 0,
                    y: touch.clientY || 0,
                    time: Date.now()
                };
                return;
            }
            const edgeThreshold = window.innerWidth * 0.3;
            if (touch.clientX > edgeThreshold) return;
            explorarTouchStart = {
                x: touch.clientX || 0,
                y: touch.clientY || 0,
                time: Date.now()
            };
        }, { passive: false });

        document.addEventListener('touchmove', (event) => {
            if (explorarVideoOverlay && !explorarVideoOverlay.classList.contains('hidden')) {
                return;
            }
            if (!explorarTouchStart) return;
            const touch = event.touches[0];
            if (!touch) return;
            const deltaX = touch.clientX - explorarTouchStart.x;
            const deltaY = touch.clientY - explorarTouchStart.y;
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (absX < 40) return;
            if (absX < absY * 2.2) return;
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (!isMobile) return;
            if (event.cancelable) {
                event.preventDefault();
            }
            const panelWidth = window.innerWidth;
            const translateX = isClosing
                ? Math.max(-panelWidth, Math.min(0, deltaX))
                : Math.min(0, -panelWidth + deltaX);
            if (!isDragging) {
                isDragging = true;
                explorarPage.classList.add('is-dragging');
                explorarPage.classList.remove('is-open');
                explorarPage.setAttribute('aria-hidden', 'false');
                document.documentElement.classList.add('explorar-open');
                document.body.classList.add('explorar-open');
                if (mobileSidebarBackdrop) {
                    wasBackdropVisible = mobileSidebarBackdrop.classList.contains('visible');
                    mobileSidebarBackdrop.classList.remove('visible');
                }
                if (feedExplorarSlider) {
                    feedExplorarSlider.classList.add('is-dragging');
                    feedExplorarSlider.classList.remove('is-explorar');
                }
            }
            if (feedExplorarSlider) {
                feedExplorarSlider.style.transform = `translateX(${translateX}px)`;
            }
        }, { passive: false });

        document.addEventListener('touchend', (event) => {
            if (explorarVideoOverlay && !explorarVideoOverlay.classList.contains('hidden')) {
                return;
            }
            if (!explorarTouchStart) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const deltaX = touch.clientX - explorarTouchStart.x;
            const deltaY = touch.clientY - explorarTouchStart.y;
            const elapsed = Date.now() - explorarTouchStart.time;
            explorarTouchStart = null;
            if (isDragging) {
                isDragging = false;
                const panelWidth = window.innerWidth;
                const shouldComplete = Math.abs(deltaX) > panelWidth * 0.5;
                if (isClosing) {
                    if (shouldComplete) {
                        closeExplorarPanel();
                    } else {
                        openExplorarPanel(true);
                    }
                } else {
                    if (shouldComplete) {
                        openExplorarPanel(true);
                    } else {
                        closeExplorarPanel();
                    }
                }
                if (mobileSidebarBackdrop && wasBackdropVisible) {
                    mobileSidebarBackdrop.classList.add('visible');
                }
                isClosing = false;
                return;
            }
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (elapsed > 700) return;
            if (absX < 45) return;
            if (absX < absY * 2.2) return;
            if (!isClosing && deltaX > window.innerWidth * 0.5) {
                openExplorarPanel(true);
            }
            if (isClosing && deltaX < -window.innerWidth * 0.5) {
                closeExplorarPanel();
            }
            isClosing = false;
        }, { passive: true });
    }

    let allPostsFeed = [];
    let nextPostIndexFeed = 0;
    let renderedPostsCountFeed = 0;
    let isRenderingFeedChunk = false;
    let feedChunkSize = 10;

    let adsPoolFeed = [];
    let adsSeenFeed = new Set();
    let adsCursorFeed = 0;
    let adsLoadedFeed = false;

    let feedInterestQueue = new Set();
    let feedInterestTimer = null;
    let feedInterestObserver = null;

    function queueFeedInterest(texto) {
        if (!texto || !token) return;
        feedInterestQueue.add(texto);
        if (feedInterestTimer) return;
        feedInterestTimer = setTimeout(async () => {
            const payloads = Array.from(feedInterestQueue);
            feedInterestQueue.clear();
            feedInterestTimer = null;
            for (const text of payloads) {
                try {
                    await fetch('/api/interesses/registrar', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ texto: text })
                    });
                } catch (error) {
                    console.warn('Falha ao registrar interesse:', error);
                }
            }
        }, 1200);
    }

    function setupFeedInterestObserver() {
        if (!('IntersectionObserver' in window)) return;
        if (feedInterestObserver) return;
        feedInterestObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const postEl = entry.target;
                const text = postEl.dataset.postContent || '';
                if (text) {
                    queueFeedInterest(text);
                }
                feedInterestObserver.unobserve(postEl);
            });
        }, { threshold: 0.55 });
    }

    async function fetchAdsFeed() {
        if (adsLoadedFeed) return;
        try {
            const resp = await fetch('/api/anuncios-feed?limit=50', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error('Falha ao buscar anúncios.');
            const json = await resp.json();
            const anuncios = Array.isArray(json?.anuncios) ? json.anuncios : [];
            adsPoolFeed = anuncios;
            adsLoadedFeed = true;
        } catch (e) {
            console.warn('Não foi possível carregar anúncios do feed:', e);
            adsPoolFeed = [];
            adsLoadedFeed = true;
        }
    }

    function pickNextAdFeed() {
        if (!adsPoolFeed || adsPoolFeed.length === 0) return null;

        for (let i = 0; i < adsPoolFeed.length; i += 1) {
            const idx = (adsCursorFeed + i) % adsPoolFeed.length;
            const item = adsPoolFeed[idx];
            const id = item?._feedKey || item?._id || item?.id;
            if (!id) continue;
            if (adsSeenFeed.has(String(id))) continue;
            adsSeenFeed.add(String(id));
            adsCursorFeed = (idx + 1) % adsPoolFeed.length;
            return item;
        }

        adsSeenFeed = new Set();
        const item = adsPoolFeed[adsCursorFeed % adsPoolFeed.length];
        adsCursorFeed = (adsCursorFeed + 1) % adsPoolFeed.length;
        return item || null;
    }

    function buildAdElementFeed(destaque) {
        const titulo = destaque?.titulo || destaque?.title || 'Anúncio';
        const descricao = destaque?.descricao || destaque?.subtitle || destaque?.texto || '';
        const imagem = destaque?.imagemUrl || destaque?.imageUrl || destaque?.imagem || 'https://placehold.co/600x320?text=Anuncio';
        const link = destaque?.linkUrl || destaque?.url || destaque?.link;
        const perfilUrl = destaque?.ownerId ? `/perfil.html?id=${destaque.ownerId}` : null;
        const cidadeEstado = [destaque?.ownerCidade, destaque?.ownerEstado].filter(Boolean).join(' - ');

        const adEl = document.createElement('article');
        adEl.className = 'post anuncio-nativo-feed';
        adEl.innerHTML = `
            <img src="${imagem}" alt="" class="anuncio-nativo-img" loading="lazy" decoding="async">
            <div class="anuncio-nativo-overlay feed">
                <div class="anuncio-nativo-badge">Anúncio</div>
                ${perfilUrl ? `<a class="anuncio-nativo-titulo" href="${perfilUrl}">${titulo}</a>` : `<div class="anuncio-nativo-titulo">${titulo}</div>`}
                ${descricao ? `<div class="anuncio-nativo-loja">${descricao}</div>` : ''}
                ${cidadeEstado ? `<div class="anuncio-nativo-endereco">${cidadeEstado}</div>` : ''}
            </div>
        `;
        const titleLink = adEl.querySelector('.anuncio-nativo-titulo[href]');
        if (titleLink) {
            titleLink.addEventListener('click', (event) => {
                event.stopPropagation();
            });
        }
        adEl.addEventListener('click', () => {
            if (link) window.open(link, '_blank');
        });
        return adEl;
    }

    function renderSinglePostElement(post) {
        // Armazena posts em cache para acesso global (ex: lightbox)
        if (!window.postsCache) window.postsCache = {};
        window.postsCache[post._id] = post;

        if (!post?.userId) return null;

        const postElement = document.createElement('article');
        postElement.className = 'post';
        postElement.dataset.postId = post._id;
        postElement.dataset.userType = post.userId.tipo;
        postElement.dataset.postContent = post.content || '';

        const isPostOwner = (post.userId._id === userId);
        if (isPostOwner) {
            postElement.classList.add('is-owner');
        }

        const isEmpresa = post.userId.tipo === 'empresa';

        const postAuthorPhoto = (post.userId.foto && !post.userId.foto.includes('pixabay'))
                                ? post.userId.foto
                                : (post.userId.avatarUrl && !post.userId.avatarUrl.includes('pixabay')
                                    ? post.userId.avatarUrl
                                    : 'imagens/default-user.png');

        const postAuthorName = post.userId.nome || 'Usuário Anônimo';
        const postAuthorCity = post.userId.cidade || '';
        const postAuthorState = post.userId.estado || '';
        const postAuthorPhone = post.userId.telefone || '';
        const postAuthorEndereco = post.userId.endereco || '';
        const postAuthorRating = typeof post.userId.mediaAvaliacao === 'number'
            ? post.userId.mediaAvaliacao
            : null;
        const postAuthorLevel = post.userId.gamificacao?.nivel || null;

        let deleteButton = '';
        if (isPostOwner) {
            deleteButton = `<button class="delete-post-btn" data-id="${post._id}"><i class="fas fa-trash"></i></button>`;
        }

        let mediaHTML = '';
        const mediaList = post.media || [];
        
        // Se houver mediaUrl antigo/legado e não houver lista, converte para lista
        if (post.mediaUrl && mediaList.length === 0) {
            mediaList.push({
                url: post.mediaUrl,
                type: post.mediaType || 'image/jpeg'
            });
        }

        if (mediaList.length > 0) {
            // Separa imagens de vídeos para tratamento (embora o grid misture, o lightbox precisa saber)
            // Lógica de Grid
            const totalMedia = mediaList.length;
            let gridClass = '';
            if (totalMedia === 1) gridClass = 'grid-1';
            else if (totalMedia === 2) gridClass = 'grid-2';
            else if (totalMedia === 3) gridClass = 'grid-3';
            else gridClass = 'grid-4';

            // Pega apenas os primeiros 4 itens para exibir
            const visibleMedia = mediaList.slice(0, 4);
            
            mediaHTML = `<div class="post-media-grid ${gridClass}">`;
            
            visibleMedia.forEach((media, index) => {
                const isLast = index === 3;
                const remaining = totalMedia - 4;
                const isVideo = media.type && media.type.includes('video'); // Usa includes para garantir (ex: video/mp4)
                
                let content = '';
                if (isVideo) {
                     content = `<video src="${media.url}" class="post-media-item" preload="metadata" muted playsinline></video>`;
                } else {
                     content = `<img src="${media.url}" alt="Mídia da postagem" class="post-media-item" loading="lazy">`;
                }

                // Wrapper para clique e overlay
                mediaHTML += `
                    <div class="post-media-wrapper" onclick="abrirLightbox('${post._id}', ${index})">
                        ${content}
                        ${(isLast && remaining > 0) ? `<div class="more-media-overlay">+${remaining}</div>` : ''}
                        ${isVideo ? '<div class="video-indicator"><i class="fas fa-play"></i></div>' : ''}
                    </div>
                `;
            });
            
            mediaHTML += '</div>';
            
            // Armazena dados da mídia no elemento DOM para o lightbox usar
            // Vamos usar um atributo data-media-json no article ou salvar em um objeto global se preferir,
            // mas data attribute é mais seguro para SPA simples.
            // Porém, JSON em atributo pode ser grande. Vamos tentar usar window.postsData ou algo assim?
            // Melhor: codificar em base64 ou apenas confiar que o array 'posts' global (se existir) tem os dados.
            // Como 'renderSinglePostElement' recebe 'post', e não temos garantia de acesso global fácil,
            // vamos serializar no dataset do wrapper principal apenas os URLs ou IDs?
            // Simplificação: vamos salvar no objeto global window.postsCache se necessário, ou apenas passar via parametro onclick.
            // Problema: onclick stringify pode quebrar.
            // Solução: Adicionar event listeners depois de criar o elemento, em vez de onclick inline string.
        }

        const levelBadge = postAuthorLevel
            ? `
                <div class="feed-nivel-badge" data-theme-switch>
                    <img src="/imagens/selo.png" alt="Selo" class="feed-nivel-selo" loading="lazy" decoding="async">
                    <div class="feed-fita-nivel">
                        <img
                            src="/imagens/fitadeseloescuro.png"
                            data-src-light="/imagens/fitadeseloclaro.png"
                            data-src-dark="/imagens/fitadeseloescuro.png"
                            alt="Fita Nível"
                            class="feed-fita-nivel-img"
                            loading="lazy"
                            decoding="async"
                        >
                        <span class="feed-nivel-texto">${postAuthorLevel}</span>
                    </div>
                </div>
            `
            : '';
        const ratingInline = postAuthorRating !== null
            ? `<span class="feed-rating-inline">★ ${postAuthorRating.toFixed(1)}</span>`
            : '';

        const enderecoTexto = [postAuthorEndereco, postAuthorCity, postAuthorState]
            .filter(Boolean)
            .join(postAuthorEndereco ? ' · ' : ', ');
        const whatsappLink = postAuthorPhone
            ? `https://wa.me/55${String(postAuthorPhone).replace(/\D/g, '')}`
            : '';

        const isLiked = post.likes.includes(userId);

        const allComments = Array.isArray(post.comments)
            ? post.comments.filter(c => c && c.userId)
            : [];
        const totalComments = allComments.length;
        const initialComments = allComments.slice(0, 2);
        const hasMoreComments = totalComments > 2;

        let commentsHTML = initialComments.map(comment => {
            if (!comment.userId) return '';
            const commentUser = (comment.userId && typeof comment.userId === 'object')
                ? comment.userId
                : { _id: comment.userId, nome: 'Usuário', foto: '', avatarUrl: '' };

            const isCommentOwner = commentUser._id === userId;
            const canEditComment = isCommentOwner;
            const canDeleteComment = isPostOwner || isCommentOwner;

            let repliesHTML = (comment.replies || []).map(reply => {
                const replyUser = (reply.userId && typeof reply.userId === 'object')
                    ? reply.userId
                    : { _id: reply.userId, nome: 'Usuário', foto: '', avatarUrl: '' };
                const isReplyOwner = replyUser && replyUser._id === userId;
                const canEditReply = isReplyOwner;
                const canDeleteReply = isPostOwner || isReplyOwner;
                return renderReply(reply, comment._id, canEditReply, canDeleteReply, replyUser);
            }).join('');

            const commentPhoto = commentUser.foto || commentUser.avatarUrl || 'imagens/default-user.png';
            const isCommentLiked = Array.isArray(comment.likes)
                ? comment.likes.some(likeId => String(likeId) === String(userId))
                : false;
            const replyCount = comment.replies?.length || 0;

            return `
            <div class="comment" data-comment-id="${comment._id}">
                <a href="/perfil.html?id=${commentUser._id}" style="text-decoration: none; color: inherit;">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar" style="cursor: pointer;" loading="lazy" decoding="async">
                </a>
                <div class="comment-body-container">
                    <div class="comment-body">
                        <a href="/perfil.html?id=${commentUser._id}" style="text-decoration: none; color: inherit; font-weight: bold; cursor: pointer;">${commentUser.nome || 'Usuário'}</a>
                        <p class="comment-content">${comment.content}</p>
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
                        ${(replyCount > 0) ? `<button class="comment-action-btn btn-toggle-replies" data-comment-id="${comment._id}">Ver ${replyCount} Respostas</button>` : ''}
                    </div>
                    <div class="reply-list oculto">${repliesHTML}</div>
                    <div class="reply-form oculto">
                        <input type="text" class="reply-input" placeholder="Responda a ${commentUser.nome || 'Usuário'}...">
                        <button class="btn-send-reply" data-comment-id="${comment._id}" aria-label="Enviar resposta" title="Enviar resposta">
                            <img
                                class="send-reply-icon"
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
        }).join('');

        const remainingComments = allComments.slice(2);
        let hiddenCommentsHTML = remainingComments.map((comment, index) => {
            if (!comment.userId) return '';
            const commentUser = (comment.userId && typeof comment.userId === 'object')
                ? comment.userId
                : { _id: comment.userId, nome: 'Usuário', foto: '', avatarUrl: '' };

            const isCommentOwner = commentUser._id === userId;
            const canEditComment = isCommentOwner;
            const canDeleteComment = isPostOwner || isCommentOwner;

            let repliesHTML = (comment.replies || []).map(reply => {
                const replyUser = (reply.userId && typeof reply.userId === 'object')
                    ? reply.userId
                    : { _id: reply.userId, nome: 'Usuário', foto: '', avatarUrl: '' };
                const isReplyOwner = replyUser && replyUser._id === userId;
                const canEditReply = isReplyOwner;
                const canDeleteReply = isPostOwner || isReplyOwner;
                return renderReply(reply, comment._id, canEditReply, canDeleteReply, replyUser);
            }).join('');

            const commentPhoto = commentUser.foto || commentUser.avatarUrl || 'imagens/default-user.png';
            const isCommentLiked = Array.isArray(comment.likes)
                ? comment.likes.some(likeId => String(likeId) === String(userId))
                : false;
            const replyCount = comment.replies?.length || 0;

            return `
            <div class="comment comment-hidden" data-comment-id="${comment._id}" data-comment-index="${index + 2}">
                <a href="/perfil.html?id=${commentUser._id}" style="text-decoration: none; color: inherit;">
                    <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar" style="cursor: pointer;" loading="lazy" decoding="async">
                </a>
                <div class="comment-body-container">
                    <div class="comment-body">
                        <a href="/perfil.html?id=${commentUser._id}" style="text-decoration: none; color: inherit; font-weight: bold; cursor: pointer;">${commentUser.nome || 'Usuário'}</a>
                        <p class="comment-content">${comment.content}</p>
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
                        ${(replyCount > 0) ? `<button class="comment-action-btn btn-toggle-replies" data-comment-id="${comment._id}">Ver ${replyCount} Respostas</button>` : ''}
                    </div>
                    <div class="reply-list oculto">${repliesHTML}</div>
                    <div class="reply-form oculto">
                        <input type="text" class="reply-input" placeholder="Responda a ${commentUser.nome || 'Usuário'}...">
                        <button class="btn-send-reply" data-comment-id="${comment._id}" aria-label="Enviar resposta" title="Enviar resposta">
                            <img
                                class="send-reply-icon"
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
        }).join('');

        const loadMoreHTML = hasMoreComments ? `<div class="load-more-comments" data-post-id="${post._id}" data-loaded="2" data-total="${totalComments}">Carregar mais</div>` : '';

        const postDate = new Date(post.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const cityDisplay = [postAuthorCity, postAuthorState].filter(Boolean).join(', ');
        const citySeparator = cityDisplay ? ` &bull; ${cityDisplay}` : '';

        const visibleCommentsCount = Array.isArray(post.comments)
            ? post.comments.filter(c => c && c.userId).length
            : 0;

        const comentariosVisiveis = '';

        const conteudoPrincipal = isEmpresa
            ? `
                <div class="feed-empresa-card">
                    ${mediaHTML ? `<div class="feed-empresa-media">${mediaHTML}</div>` : ''}
                    <div class="feed-empresa-info">
                        <p class="feed-empresa-texto">${post.content}</p>
                        ${enderecoTexto ? `<div class="feed-empresa-endereco"><i class="fas fa-map-marker-alt"></i> ${enderecoTexto}</div>` : ''}
                        ${whatsappLink ? `<a class="feed-empresa-whatsapp" href="${whatsappLink}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> WhatsApp direto</a>` : ''}
                    </div>
                </div>
            `
            : `
                <div class="feed-usuario-card">
                    <p class="feed-usuario-texto">${post.content}</p>
                    ${mediaHTML ? `<div class="feed-usuario-media">${mediaHTML}</div>` : ''}
                </div>
            `;

        postElement.innerHTML = `
            <div class="post-header">
                <img src="${postAuthorPhoto}" alt="Avatar" class="post-avatar" data-userid="${post.userId._id}" loading="lazy" decoding="async">
                <div class="post-meta">
                    <div class="post-author-line">
                        <span class="user-name" data-userid="${post.userId._id}">${postAuthorName}</span>
                        ${ratingInline}
                    </div>
                    <div>
                       <span class="post-date-display">${postDate}</span>
                       <span class="post-author-city">${citySeparator}</span>
                    </div>
                </div>
                <div class="post-header-actions">
                    ${levelBadge}
                    ${deleteButton}
                </div>
            </div>
            <div class="post-content">
                ${conteudoPrincipal}
            </div>
            <div class="post-actions">
                <button class="action-btn btn-like ${isLiked ? 'liked' : ''}" data-post-id="${post._id}">
                    <i class="fas fa-thumbs-up"></i> 
                    <span class="like-count">${post.likes.length}</span> Curtir
                </button>
                <button class="action-btn btn-comment ${comentariosVisiveis ? 'active' : ''}" data-post-id="${post._id}">
                    <i class="fas fa-comment"></i> ${visibleCommentsCount} Comentários
                </button>
            </div>
            <div class="post-comments ${comentariosVisiveis}">
                <div class="comment-list">
                    ${commentsHTML}
                    ${hiddenCommentsHTML}
                    ${loadMoreHTML}
                </div>
                <div class="comment-form">
                    <textarea class="comment-input" placeholder="Escreva um comentário..." rows="1"></textarea>
                    <button class="btn-send-comment" data-post-id="${post._id}" aria-label="Enviar comentário" title="Enviar comentário">
                        <img
                            class="send-comment-icon"
                            alt=""
                            src="${document.documentElement.classList.contains('dark-mode') ? '/imagens/enviar.tema.escuro.png' : '/imagens/enviar.tema.claro.png'}"
                            data-src-light="/imagens/enviar.tema.claro.png"
                            data-src-dark="/imagens/enviar.tema.escuro.png"
                        >
                    </button>
                </div>
            </div>
        `;

        if (postElement.dataset.postContent) {
            queueFeedInterest(postElement.dataset.postContent);
        }

        return postElement;
    }

    async function renderNextFeedChunk() {
        if (!postsContainer) return;
        if (isRenderingFeedChunk) return;
        if (!allPostsFeed || nextPostIndexFeed >= allPostsFeed.length) return;

        isRenderingFeedChunk = true;
        try {
            await fetchAdsFeed();
            const isMobileAds = window.innerWidth <= 992;

            const end = Math.min(nextPostIndexFeed + feedChunkSize, allPostsFeed.length);
            for (let i = nextPostIndexFeed; i < end; i += 1) {
                const p = allPostsFeed[i];
                const postEl = renderSinglePostElement(p);
                if (!postEl) continue;
                postsContainer.appendChild(postEl);
                renderedPostsCountFeed += 1;

                setupFeedInterestObserver();
                if (feedInterestObserver) {
                    feedInterestObserver.observe(postEl);
                }

                if (isMobileAds && renderedPostsCountFeed % 4 === 0) {
                    const ad = pickNextAdFeed();
                    if (ad) {
                        const adEl = buildAdElementFeed(ad);
                        postsContainer.appendChild(adEl);
                    }
                }
            }
            nextPostIndexFeed = end;

            setupPostListeners();
            setupAutoCloseCommentsOnScroll();

            setTimeout(() => {
                document.querySelectorAll('.comment').forEach(comment => {
                    const buttons = comment.querySelectorAll('.btn-comment-options');
                    if (buttons.length > 1) {
                        for (let i = 1; i < buttons.length; i++) {
                            buttons[i].remove();
                        }
                    }
                    const menu = comment.querySelector('.comment-options-menu');
                    if (menu && checkCommentHasMultipleLines(comment)) {
                        menu.classList.add('comentario-multiplas-linhas');
                    }
                });
                document.querySelectorAll('.reply').forEach(reply => {
                    const buttons = reply.querySelectorAll('.btn-reply-options');
                    if (buttons.length > 1) {
                        for (let i = 1; i < buttons.length; i++) {
                            buttons[i].remove();
                        }
                    }
                    const menu = reply.querySelector('.reply-options-menu');
                    if (menu && checkCommentHasMultipleLines(reply)) {
                        menu.classList.add('comentario-multiplas-linhas');
                    }
                });
            }, 100);

            if (typeof filterFeed === 'function') {
                filterFeed(currentTipoFeed);
            }
        } finally {
            isRenderingFeedChunk = false;
        }
    }

    function setupInfiniteFeedScroll() {
        if (window.__feedInfiniteScrollSetup) return;
        window.__feedInfiniteScrollSetup = true;

        window.addEventListener('scroll', () => {
            const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 900);
            if (!nearBottom) return;
            renderNextFeedChunk();
        }, { passive: true });
    }

    function atualizarSugestoesCidades(posts) {
        if (!datalistCidades) return;
        datalistCidades.innerHTML = '';
        if (!Array.isArray(posts) || posts.length === 0) return;

        const seen = new Map(); // key normalizada -> valor original

        posts.forEach((post) => {
            const cidade = post?.userId?.cidade;
            if (!cidade || typeof cidade !== 'string') return;
            const limpa = cidade.trim();
            if (!limpa) return;
            const key = limpa.toLowerCase();
            if (!seen.has(key)) seen.set(key, limpa);
        });

        const cidades = Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const frag = document.createDocumentFragment();
        cidades.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c;
            frag.appendChild(opt);
        });
        datalistCidades.appendChild(frag);
    }

    function renderPosts(posts) {
        if (!postsContainer) return;
        postsContainer.innerHTML = '';

        allPostsFeed = Array.isArray(posts) ? posts : [];
        nextPostIndexFeed = 0;
        renderedPostsCountFeed = 0;
        isRenderingFeedChunk = false;

        adsPoolFeed = [];
        adsSeenFeed = new Set();
        adsCursorFeed = 0;
        adsLoadedFeed = false;

        if (!allPostsFeed || allPostsFeed.length === 0) {
            postsContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma postagem encontrada.</p>';
            return;
        }

        setupInfiniteFeedScroll();
        renderNextFeedChunk();
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-comment-options') && !e.target.closest('.comment-options-menu')) {
            document.querySelectorAll('.comment-options-menu').forEach(m => {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const commentId = m.dataset.commentId;
                    const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                    if (commentElement) {
                        const commentBody = commentElement.querySelector('.comment-body-container');
                        if (commentBody) {
                            commentBody.appendChild(m);
                        }
                    }
                }
            });
        }
        if (!e.target.closest('.btn-reply-options') && !e.target.closest('.reply-options-menu')) {
            document.querySelectorAll('.reply-options-menu').forEach(m => {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const replyId = m.dataset.replyId;
                    const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
                    if (replyElement) {
                        const replyBody = replyElement.querySelector('.reply-body-container');
                        if (replyBody) {
                            replyBody.appendChild(m);
                        }
                    }
                }
            });
        }
    });
    
    // Fecha menus de opções ao rolar a página
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            document.querySelectorAll('.comment-options-menu:not(.oculto)').forEach(m => {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const commentId = m.dataset.commentId;
                    const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                    if (commentElement) {
                        const commentBody = commentElement.querySelector('.comment-body-container');
                        if (commentBody) {
                            commentBody.appendChild(m);
                        }
                    }
                }
            });
            document.querySelectorAll('.reply-options-menu:not(.oculto)').forEach(m => {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const replyId = m.dataset.replyId;
                    const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
                    if (replyElement) {
                        const replyBody = replyElement.querySelector('.reply-body-container');
                        if (replyBody) {
                            replyBody.appendChild(m);
                        }
                    }
                }
            });
        }, 50);
    }, { passive: true });

    // Fecha automaticamente comentários abertos quando o post sai totalmente da tela (mobile/desktop)
    let autoCloseCommentsObserver = null;
    function setupAutoCloseCommentsOnScroll() {
        if (autoCloseCommentsObserver) {
            autoCloseCommentsObserver.disconnect();
            autoCloseCommentsObserver = null;
        }

        if (!('IntersectionObserver' in window)) return;

        autoCloseCommentsObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) return;
                const postEl = entry.target;
                const commentsSection = postEl.querySelector('.post-comments');
                if (commentsSection && commentsSection.classList.contains('visible')) {
                    commentsSection.classList.remove('visible');
                    const btnComment = postEl.querySelector('.btn-comment');
                    if (btnComment) btnComment.classList.remove('active');

                    // Reseta modo "rolagem interna" (se estava ativo)
                    const commentList = commentsSection.querySelector('.comment-list');
                    if (commentList) {
                        commentList.classList.remove('comment-list-scroll');
                        commentList.style.removeProperty('--comment-list-max-height');
                    }
                }
            });
        }, { threshold: 0 });

        document.querySelectorAll('.post').forEach((post) => autoCloseCommentsObserver.observe(post));
    }

    // 🛑 NOVO: Função para renderizar uma Resposta (Reply)
    function renderReply(reply, commentId, canEditReply, canDeleteReply, replyUser) {
        if (!reply || !reply.userId) return '';
        const userData = replyUser || (typeof reply.userId === 'object'
            ? reply.userId
            : { _id: reply.userId, nome: 'Usuário', foto: '', avatarUrl: '' });
        const replyPhoto = userData.foto || userData.avatarUrl || 'imagens/default-user.png';
        const isReplyLiked = Array.isArray(reply.likes)
            ? reply.likes.some(likeId => String(likeId) === String(userId))
            : false;
        
        return `
        <div class="reply" data-reply-id="${reply._id}">
            <a href="/perfil.html?id=${userData._id}" style="text-decoration: none; color: inherit;">
                <img src="${replyPhoto.includes('pixabay') ? 'imagens/default-user.png' : replyPhoto}" alt="Avatar" class="reply-avatar" style="cursor: pointer;" loading="lazy" decoding="async">
            </a>
            <div class="reply-body-container">
                <div class="reply-body">
                    <a href="/perfil.html?id=${userData._id}" style="text-decoration: none; color: inherit; font-weight: bold; cursor: pointer;">${userData.nome || 'Usuário'}</a>
                    <p class="reply-content">${reply.content}</p>
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

    // --- HANDLERS DE EVENTO ---

    // Função para verificar se o comentário tem mais de 1 linha
    function checkCommentHasMultipleLines(commentElement) {
        if (window.innerWidth > 767) return false; // Só aplica em telas menores
        
        const commentContent = commentElement.querySelector('.comment-content') || commentElement.querySelector('.reply-content');
        if (!commentContent) return false;
        
        // Verifica se a altura do conteúdo é maior que uma linha
        const lineHeight = parseFloat(getComputedStyle(commentContent).lineHeight) || 20;
        const contentHeight = commentContent.scrollHeight;
        
        return contentHeight > lineHeight * 1.5; // Mais de 1.5 linhas
    }

    function setupPostListeners() {
        document.querySelectorAll('.post-avatar, .user-name').forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                const targetUserId = e.currentTarget.dataset.userid;
                if (targetUserId) {
                    navigateToProfile(targetUserId);
                }
            });
        });
        
        // Ações do Post
        document.querySelectorAll('.btn-like').forEach(btn => btn.addEventListener('click', handleLikePost));
        document.querySelectorAll('.btn-comment').forEach(btn => btn.addEventListener('click', toggleCommentSection));
        document.querySelectorAll('.btn-send-comment').forEach(btn => btn.addEventListener('click', handleSendComment));
        document.querySelectorAll('.feed-empresa-whatsapp').forEach(link => {
            link.addEventListener('click', () => {
                const postEl = link.closest('.post');
                if (postEl?.dataset?.postContent) {
                    queueFeedInterest(postEl.dataset.postContent);
                }
            });
        });
        
        // Auto-resize e Enter para enviar comentários
        document.querySelectorAll('.comment-input').forEach(textarea => {
            // Auto-resize ao digitar
            textarea.addEventListener('input', function() {
                autoResizeTextarea(this);
            });
            
            // Enter envia, Shift+Enter quebra linha
            textarea.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const postElement = this.closest('.post');
                    const sendBtn = postElement.querySelector('.btn-send-comment');
                    if (sendBtn) {
                        sendBtn.click();
                    }
                }
            });
        });

        // Enter envia resposta (reply)
        document.querySelectorAll('.reply-input').forEach((input) => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const replyForm = input.closest('.reply-form');
                    const sendBtn = replyForm ? replyForm.querySelector('.btn-send-reply') : null;
                    if (sendBtn) sendBtn.click();
                }
            });
        });
        
        // Revalida comentários longos ao redimensionar a janela
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                document.querySelectorAll('.comment').forEach(comment => {
                    checkLongComment(comment);
                });
            }, 200);
        });
        
        // 🛑 NOVO: Ações de Comentário
        document.querySelectorAll('.btn-like-comment').forEach(btn => btn.addEventListener('click', handleLikeComment));
        document.querySelectorAll('.btn-delete-comment').forEach(btn => btn.addEventListener('click', handleDeleteComment));
        document.querySelectorAll('.btn-show-reply-form').forEach(btn => btn.addEventListener('click', toggleReplyForm));
        document.querySelectorAll('.btn-toggle-replies').forEach(btn => btn.addEventListener('click', toggleReplyList));
        document.querySelectorAll('.btn-send-reply').forEach(btn => btn.addEventListener('click', handleSendReply));
        document.querySelectorAll('.btn-comment-options').forEach(btn => btn.addEventListener('click', handleCommentOptions));
        document.querySelectorAll('.btn-edit-comment').forEach(btn => btn.addEventListener('click', handleEditComment));

        // 🛑 NOVO: Ações de Resposta
        document.querySelectorAll('.btn-like-reply').forEach(btn => btn.addEventListener('click', handleLikeReply));
        document.querySelectorAll('.btn-delete-reply').forEach(btn => btn.addEventListener('click', handleDeleteReply));
        document.querySelectorAll('.btn-reply-options').forEach(btn => btn.addEventListener('click', handleReplyOptions));
        document.querySelectorAll('.btn-edit-reply').forEach(btn => btn.addEventListener('click', handleEditReply));
        
        // Botão "Carregar mais" comentários (carrega 5 por vez)
        document.querySelectorAll('.load-more-comments').forEach(btn => {
            btn.addEventListener('click', function() {
                const postId = this.dataset.postId;
                const postElement = this.closest('.post');
                if (!postElement) return;
                const currentlyLoaded = parseInt(this.dataset.loaded) || 2;
                const totalComments = parseInt(this.dataset.total) || 0;
                const nextBatch = currentlyLoaded + 5;
                const isMobile = window.innerWidth <= 767;
                
                const hiddenComments = Array.from(postElement.querySelectorAll('.comment-hidden'));
                const commentList = postElement.querySelector('.comment-list');

                // Mobile: após 4 comentários, vira rolagem dentro da lista (sem crescer o post/modal)
                if (isMobile) {
                    // Revela TODOS os comentários restantes (a rolagem controla o tamanho)
                    const commentsToShow = hiddenComments;
                    commentsToShow.forEach(comment => {
                        comment.classList.remove('comment-hidden');
                        // Garante que comentários recém-visíveis não tenham estilos inline de limite
                        const commentText = comment.querySelector('.comment-body p');
                        if (commentText) {
                            commentText.style.maxHeight = '';
                            commentText.style.overflow = '';
                            commentText.style.overflowY = '';
                            commentText.style.height = '';
                        }
                    });

                    // Remove o botão "Carregar mais" (agora é só rolagem)
                    this.remove();

                    // Aplica rolagem com altura aproximada de 4 comentários
                    if (commentList) {
                        commentList.classList.add('comment-list-scroll');
                        requestAnimationFrame(() => {
                            const visibleComments = Array.from(commentList.querySelectorAll('.comment')).slice(0, 4);
                            if (visibleComments.length >= 4) {
                                let h = 0;
                                visibleComments.forEach((c) => {
                                    const rect = c.getBoundingClientRect();
                                    const styles = getComputedStyle(c);
                                    const mb = parseFloat(styles.marginBottom || '0') || 0;
                                    h += rect.height + mb;
                                });
                                // Clamp para não ficar gigante mesmo com comentários longos
                                const clamped = Math.min(Math.max(h, 180), 320);
                                commentList.style.setProperty('--comment-list-max-height', `${Math.round(clamped)}px`);
                            } else {
                                // fallback: ainda força um max-height padrão para permitir rolagem
                                commentList.style.setProperty('--comment-list-max-height', `260px`);
                            }
                        });
                    }

                    // Reconfigura listeners dos comentários que acabaram de ficar visíveis
                    commentsToShow.forEach(commentElement => {
                        const likeBtn = commentElement.querySelector('.btn-like-comment');
                        const deleteBtn = commentElement.querySelector('.btn-delete-comment');
                        const replyFormBtn = commentElement.querySelector('.btn-show-reply-form');
                        const toggleRepliesBtn = commentElement.querySelector('.btn-toggle-replies');
                        const sendReplyBtn = commentElement.querySelector('.btn-send-reply');

                        if (likeBtn) likeBtn.addEventListener('click', handleLikeComment);
                        if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteComment);
                        if (replyFormBtn) replyFormBtn.addEventListener('click', toggleReplyForm);
                        if (toggleRepliesBtn) toggleRepliesBtn.addEventListener('click', toggleReplyList);
                        if (sendReplyBtn) sendReplyBtn.addEventListener('click', handleSendReply);
                        const optionsBtn = commentElement.querySelector('.btn-comment-options');
                        const editBtn = commentElement.querySelector('.btn-edit-comment');
                        if (optionsBtn) optionsBtn.addEventListener('click', handleCommentOptions);
                        if (editBtn) editBtn.addEventListener('click', handleEditComment);
                    });

                    // garante ícones corretos no tema atual
                    updateSendCommentIcons();

                    // Recalcula comentários longos depois de renderizar
                    setTimeout(() => {
                        document.querySelectorAll('.comment').forEach(commentElement => {
                            if (commentElement.offsetParent !== null) {
                                checkLongComment(commentElement);
                            }
                        });
                    }, 400);
                    return;
                }

                // Desktop/tablet: Mostra os próximos 5 comentários (ou menos se não houver 5)
                const commentsToShow = hiddenComments.slice(0, 5);
                
                commentsToShow.forEach(comment => {
                    comment.classList.remove('comment-hidden');
                    // Garante que comentários recém-visíveis não tenham estilos inline de limite
                    const commentText = comment.querySelector('.comment-body p');
                    if (commentText) {
                        commentText.style.maxHeight = '';
                        commentText.style.overflow = '';
                        commentText.style.overflowY = '';
                        commentText.style.height = '';
                    }
                });
                
                // Atualiza o contador de comentários carregados
                const newLoadedCount = Math.min(nextBatch, totalComments);
                this.dataset.loaded = newLoadedCount;
                
                // Se ainda houver mais comentários, mantém o botão, senão remove
                if (newLoadedCount >= totalComments) {
                    this.remove();
                } else {
                    // Atualiza o texto se necessário (opcional)
                    // this.textContent = `Carregar mais (${totalComments - newLoadedCount} restantes)`;
                }
                
                // Reconfigura listeners dos novos comentários visíveis
                commentsToShow.forEach(commentElement => {
                    const commentId = commentElement.dataset.commentId;
                    const likeBtn = commentElement.querySelector('.btn-like-comment');
                    const deleteBtn = commentElement.querySelector('.btn-delete-comment');
                    const replyFormBtn = commentElement.querySelector('.btn-show-reply-form');
                    const toggleRepliesBtn = commentElement.querySelector('.btn-toggle-replies');
                    const sendReplyBtn = commentElement.querySelector('.btn-send-reply');
                    
                    if (likeBtn) likeBtn.addEventListener('click', handleLikeComment);
                    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteComment);
                    if (replyFormBtn) replyFormBtn.addEventListener('click', toggleReplyForm);
                    if (toggleRepliesBtn) toggleRepliesBtn.addEventListener('click', toggleReplyList);
                    if (sendReplyBtn) sendReplyBtn.addEventListener('click', handleSendReply);
                    const optionsBtn = commentElement.querySelector('.btn-comment-options');
                    const editBtn = commentElement.querySelector('.btn-edit-comment');
                    if (optionsBtn) optionsBtn.addEventListener('click', handleCommentOptions);
                    if (editBtn) editBtn.addEventListener('click', handleEditComment);
                });
                
                // Verifica comentários longos após um delay maior para garantir renderização completa
                setTimeout(() => {
                    commentsToShow.forEach(commentElement => {
                        // Aguarda o elemento estar visível antes de verificar
                        if (commentElement.offsetParent !== null) {
                            checkLongComment(commentElement);
                        }
                    });
                }, 500);
            });
        });
    }

    async function deletePost(postId, postElement) {
        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                postElement.remove();
                // Remove do cache
                if (window.postsCache) delete window.postsCache[postId];
            } else {
                throw new Error(data.message || 'Erro ao deletar postagem.');
            }
        } catch (error) {
            console.error('Erro ao deletar postagem:', error);
            alert(error.message);
        }
    }


    // --- Estado de imagens selecionadas na criação de post ---
    const btnSelecionarFotoPost = document.getElementById('btn-selecionar-foto-post');
    const btnAdicionarFotoPost = document.getElementById('btn-adicionar-foto-post');
    const previewFotosPost = document.getElementById('preview-fotos-post');
    const fotosPostSelecionadas = [];
    const MAX_FOTOS_POST = 10;

    function atualizarVisibilidadeBotoesPost() {
        const temFotos = fotosPostSelecionadas.length > 0;
        if (btnSelecionarFotoPost) {
            btnSelecionarFotoPost.style.display = temFotos ? 'none' : 'inline-flex';
        }
        if (btnAdicionarFotoPost) {
            btnAdicionarFotoPost.style.display = temFotos ? 'inline-flex' : 'none';
        }
    }

    function criarThumbnailPost(file) {
        if (!previewFotosPost) return;

        const item = document.createElement('div');
        item.className = 'post-foto-item';

        const img = document.createElement('img');
        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'post-foto-remove';
        btnRemover.innerHTML = '&times;';

        item.appendChild(img);
        item.appendChild(btnRemover);
        previewFotosPost.appendChild(item);

        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        btnRemover.addEventListener('click', () => {
            const idx = fotosPostSelecionadas.indexOf(file);
            if (idx !== -1) {
                fotosPostSelecionadas.splice(idx, 1);
            }
            item.remove();
            atualizarVisibilidadeBotoesPost();
            if (postMediaInput && fotosPostSelecionadas.length === 0) {
                postMediaInput.value = '';
            }
        });
    }

    window.abrirLightbox = function(postId, initialIndex) {
        const post = window.postsCache[postId];
        if (!post || !post.media || !post.media.length) return;

        // Se houver mediaUrl legado e media não foi populado corretamente no cache
        let mediaList = post.media;
        if (post.mediaUrl && (!mediaList || mediaList.length === 0)) {
            mediaList = [{ url: post.mediaUrl, type: post.mediaType || 'image/jpeg' }];
        }

        let currentIndex = initialIndex;

        // Remove lightbox existente
        const existingLightbox = document.querySelector('.lightbox-overlay');
        if (existingLightbox) existingLightbox.remove();

        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox-overlay active';
        
        const updateContent = () => {
            const media = mediaList[currentIndex];
            const isVideo = media.type && media.type.includes('video');
            
            let mediaContent = '';
            if (isVideo) {
                mediaContent = `<video src="${media.url}" class="lightbox-media" controls autoplay></video>`;
            } else {
                mediaContent = `<img src="${media.url}" class="lightbox-media">`;
            }
            
            // Botões de navegação
            const showPrev = currentIndex > 0;
            const showNext = currentIndex < mediaList.length - 1;

            const prevBtn = showPrev ? `
                <button class="lightbox-nav lightbox-prev" onclick="event.stopPropagation(); changeLightboxImage(-1)">
                    <span>&lt;</span>
                </button>` : '';
                
            const nextBtn = showNext ? `
                <button class="lightbox-nav lightbox-next" onclick="event.stopPropagation(); changeLightboxImage(1)">
                    <span>&gt;</span>
                </button>` : '';

            lightbox.innerHTML = `
                <button class="lightbox-close" onclick="fecharLightbox()">&times;</button>
                <div class="lightbox-content" onclick="event.stopPropagation()">
                    ${prevBtn}
                    ${mediaContent}
                    ${nextBtn}
                </div>
            `;
        };

        window.changeLightboxImage = (direction) => {
            const newIndex = currentIndex + direction;
            if (newIndex >= 0 && newIndex < mediaList.length) {
                currentIndex = newIndex;
                updateContent();
            }
        };

        window.fecharLightbox = () => {
            lightbox.classList.remove('active');
            setTimeout(() => lightbox.remove(), 300);
        };

        lightbox.addEventListener('click', window.fecharLightbox);
        
        updateContent();
        document.body.appendChild(lightbox);
        
        // Teclado
        const handleKey = (e) => {
            if (!document.querySelector('.lightbox-overlay')) {
                document.removeEventListener('keydown', handleKey);
                return;
            }
            if (e.key === 'Escape') window.fecharLightbox();
            if (e.key === 'ArrowLeft') window.changeLightboxImage(-1);
            if (e.key === 'ArrowRight') window.changeLightboxImage(1);
        };
        document.addEventListener('keydown', handleKey);
    };

    // Função global para deletar post com modal personalizado (simulando inline se possível, mas usando o modal de confirmação existente ou criando um novo)
    // O usuário pediu "modal pequeno perto da lixeira".
    // Como temos showDeleteConfirmPopup usado em comentários, vamos reutilizá-lo ou adaptá-lo.
    // Verificando se showDeleteConfirmPopup existe e é exportado ou global.
    // Assumindo que showDeleteConfirmPopup está definido em algum lugar neste arquivo (vou verificar se já li).
    
    // Se showDeleteConfirmPopup não estiver global, vamos criá-lo ou usar lógica similar inline.
    // Vou substituir o confirm() nativo pela lógica de popup.

    // Escuta cliques no documento para delegar delete-post-btn
    document.addEventListener('click', async (event) => {
        const button = event.target.closest('.delete-post-btn');
        if (button) {
            event.preventDefault();
            event.stopPropagation();
            const postId = button.dataset.id;
            const postElement = button.closest('.post');

            // Usa o modal de confirmação existente ou cria um inline
            if (typeof showDeleteConfirmPopup === 'function') {
                showDeleteConfirmPopup(button, async () => {
                    await deletePost(postId, postElement);
                });
            } else {
                // Fallback: cria um modal inline simples se a função não existir
                const confirmDiv = document.createElement('div');
                confirmDiv.className = 'delete-confirm-popup'; // Usar classe existente se houver
                confirmDiv.style.position = 'absolute';
                confirmDiv.style.background = '#fff';
                confirmDiv.style.border = '1px solid #ccc';
                confirmDiv.style.padding = '10px';
                confirmDiv.style.borderRadius = '5px';
                confirmDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                confirmDiv.style.zIndex = '1000';
                confirmDiv.style.color = '#000';
                
                // Posiciona perto do botão
                const rect = button.getBoundingClientRect();
                // Ajuste simples de posição
                // Melhor: anexar ao pai do botão e usar position absolute
                button.parentNode.style.position = 'relative';
                confirmDiv.style.top = '100%';
                confirmDiv.style.right = '0';

                confirmDiv.innerHTML = `
                    <p style="margin: 0 0 10px; font-size: 14px;">Tem certeza?</p>
                    <div style="display: flex; gap: 5px; justify-content: flex-end;">
                        <button class="confirm-yes" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Sim</button>
                        <button class="confirm-no" style="background: #ccc; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">Não</button>
                    </div>
                `;

                confirmDiv.querySelector('.confirm-yes').onclick = async () => {
                    confirmDiv.remove();
                    await deletePost(postId, postElement);
                };
                confirmDiv.querySelector('.confirm-no').onclick = () => {
                    confirmDiv.remove();
                };

                button.parentNode.appendChild(confirmDiv);
            }
        }
    });

    if (postMediaInput && !postMediaInput.hasAttribute('multiple')) {
        postMediaInput.setAttribute('multiple', 'multiple');
    }

    const abrirSeletorPost = () => postMediaInput.click();

    if (btnSelecionarFotoPost) {
        btnSelecionarFotoPost.addEventListener('click', abrirSeletorPost);
    }
    if (btnAdicionarFotoPost) {
        btnAdicionarFotoPost.addEventListener('click', abrirSeletorPost);
    }

    if (postMediaInput) {
        postMediaInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (!files.length) return;

            let addedCount = 0;
            files.forEach((file) => {
                if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
                if (fotosPostSelecionadas.length >= MAX_FOTOS_POST) return;
                if (!fotosPostSelecionadas.includes(file)) {
                    fotosPostSelecionadas.push(file);
                    criarThumbnailPost(file);
                    addedCount++;
                }
            });

            if (fotosPostSelecionadas.length >= MAX_FOTOS_POST && (files.length > addedCount || fotosPostSelecionadas.length === MAX_FOTOS_POST)) {
                showMessage(postFormMessage, `Máximo de ${MAX_FOTOS_POST} arquivos por publicação.`, 'info');
            }

            atualizarVisibilidadeBotoesPost();
            if (postForm) {
                postForm.classList.add('is-active');
            }
            
            // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
            postMediaInput.value = '';
        });
    }

    if (postForm) {
        const activatePostActions = () => postForm.classList.add('is-active');
        const deactivatePostActions = () => postForm.classList.remove('is-active');
        const syncSendButtonState = () => {
            const hasText = !!postContentInput?.value?.trim();
            const hasImages = fotosPostSelecionadas.length > 0;
            postForm.classList.toggle('has-content', hasText || hasImages);
        };

        postContentInput?.addEventListener('focus', activatePostActions);
        postContentInput?.addEventListener('input', () => {
            syncSendButtonState();
        });

        syncSendButtonState();

        document.addEventListener('click', (event) => {
            if (!postForm.contains(event.target)) {
                const hasText = !!postContentInput?.value?.trim();
                const hasImages = fotosPostSelecionadas.length > 0;
                if (!hasText && !hasImages) {
                    deactivatePostActions();
                }
            }
        });
    }

    if (postForm) {
        postForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = postContentInput.value;
            const temMidia = fotosPostSelecionadas.length > 0 || (postMediaInput && postMediaInput.files && postMediaInput.files.length > 0);

            if (!content && !temMidia) {
                showMessage(postFormMessage, 'Você precisa adicionar um texto ou uma foto.', 'error');
                return;
            }
            const formData = new FormData();
            formData.append('content', content);
            
            // Adiciona todas as fotos selecionadas ao FormData
            fotosPostSelecionadas.forEach((file) => {
                formData.append('media', file);
            });

            // Fallback: se não houver fotos selecionadas no array (drag&drop ou seleção múltipla),
            // mas houver no input (caso raro se não usarmos o array), tenta pegar do input
            if (fotosPostSelecionadas.length === 0 && postMediaInput && postMediaInput.files && postMediaInput.files.length > 0) {
                 Array.from(postMediaInput.files).forEach(file => {
                     formData.append('media', file);
                 });
            }
            
            showMessage(postFormMessage, 'Publicando...', 'info');
            
            try {
                const response = await fetch('/api/posts', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    showMessage(postFormMessage, 'Postagem criada com sucesso!', 'success');
                    postForm.reset();
                    // Limpa seleção de fotos e thumbnails
                    fotosPostSelecionadas.length = 0;
                    if (previewFotosPost) {
                        previewFotosPost.innerHTML = '';
                    }
                    if (postMediaInput) {
                        postMediaInput.value = '';
                    }
                    atualizarVisibilidadeBotoesPost();
                    if (postContentInput) postContentInput.style.height = 'auto';
                    fetchPosts(); // Recarrega o feed
                } else {
                    throw new Error(data.message || 'Erro ao criar postagem.');
                }
            } catch (error) {
                console.error('Erro ao criar postagem:', error);
                showMessage(postFormMessage, error.message, 'error');
            }
        });
    }
    
    function filterFeed(tipo) {
        currentTipoFeed = tipo || 'todos';
        document.querySelectorAll('.post').forEach(post => {
            if (currentTipoFeed === 'todos') {
                post.style.display = 'block';
            } else {
                if (post.dataset.userType === currentTipoFeed) {
                    post.style.display = 'block';
                } else {
                    post.style.display = 'none';
                }
            }
        });

        // Mantém o select sincronizado (ex.: quando reaplica após fetchPosts)
        if (feedTipoSelect && feedTipoSelect.value !== currentTipoFeed) {
            feedTipoSelect.value = currentTipoFeed;
        }
    }

    if (feedTipoSelect) {
        // Inicializa (caso o HTML mude o selected)
        currentTipoFeed = feedTipoSelect.value || 'todos';
        
        // Ajusta a largura do select conforme o texto selecionado (Todos/Clientes/Profissionais)
        function ajustarLarguraSelectTipo() {
            if (!feedTipoSelect) return;

            // Em mobile o CSS já força 100%
            if (window.innerWidth <= 767) {
                feedTipoSelect.style.width = '';
                return;
            }

            const selectedText = feedTipoSelect.options[feedTipoSelect.selectedIndex]?.text || '';
            const span = document.createElement('span');
            const cs = window.getComputedStyle(feedTipoSelect);

            span.style.position = 'absolute';
            span.style.visibility = 'hidden';
            span.style.whiteSpace = 'nowrap';
            span.style.font = cs.font;
            span.textContent = selectedText;
            document.body.appendChild(span);

            const textWidth = span.getBoundingClientRect().width;
            document.body.removeChild(span);

            // Soma uma folga para paddings + seta do select
            const extra = 34;
            feedTipoSelect.style.width = `${Math.ceil(textWidth + extra)}px`;
        }

        ajustarLarguraSelectTipo();
        window.addEventListener('resize', ajustarLarguraSelectTipo);

        feedTipoSelect.addEventListener('change', () => {
            filterFeed(feedTipoSelect.value || 'todos');
            ajustarLarguraSelectTipo();
        });
    }

    // ----------------------------------------------------------------------
    // BOTÃO LATERAL (MOBILE) PARA ABRIR CATEGORIAS / AÇÕES RÁPIDAS / TIMES
    // ----------------------------------------------------------------------
    const categoriasAside = document.querySelector('.categorias');
    console.log('🔍 Elemento categorias encontrado:', categoriasAside);
    const mobileSidebarClose = document.getElementById('mobile-sidebar-close');
    let mobileSidebarBackdrop = null;

    if (mobileSidebarToggle && categoriasAside) {
        console.log('🔧 Botão de filtros encontrado, configurando...');
        mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop');
        if (mobileSidebarBackdrop) {
            mobileSidebarBackdrop.remove();
            mobileSidebarBackdrop = null;
        }

        function isMediaScreen() {
            return window.innerWidth >= 769 && window.innerWidth <= 992;
        }

        function fecharSidebarMobile() {
            console.log('🔒 Fechando sidebar...');
            categoriasAside.classList.remove('aberta');
            document.documentElement.classList.remove('mobile-sidebar-open');
            document.body.classList.remove('mobile-sidebar-open');
            
            // Remover listener de clique fora quando fechar
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler);
                outsideClickHandler = null;
            }
            
            if (!isMediaScreen()) {
                if (mobileSidebarBackdrop) {
                    mobileSidebarBackdrop.classList.remove('visible');
                }
                mobileSidebarToggle.classList.remove('hidden');
            }
        }

        // Função para fechar sidebar quando modal é aberto (apenas em telas médias)
        // Torna a função global para acesso de outros scripts
        window.fecharSidebarSeMedia = function() {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                fecharSidebarMobile();
            }
        };

        function abrirSidebarMobile() {
            console.log('🔓 Abrindo sidebar...', 'isMediaScreen:', isMediaScreen());
            
            // Configura listener de clique fora para todas as telas
            setupOutsideClickHandler();
            document.documentElement.classList.add('mobile-sidebar-open');
            document.body.classList.add('mobile-sidebar-open');
            // Ao abrir o menu, fecha a busca (pra não ficar sobreposta)
            try { fecharBuscaUI(); } catch {}
            
            if (isMediaScreen()) {
                // Primeiro adicionar a classe para mostrar
                categoriasAside.classList.add('aberta');
                
                // Posicionar dropdown abaixo do botão em telas médias
                // Usar requestAnimationFrame para garantir que o DOM seja atualizado
                requestAnimationFrame(() => {
                    const toggleRect = mobileSidebarToggle.getBoundingClientRect();
                    console.log('📍 Posicionando dropdown:', toggleRect);
                    
                    // Definir posição explicitamente
                    categoriasAside.style.position = 'fixed';
                    categoriasAside.style.top = `${toggleRect.bottom + 8}px`;
                    categoriasAside.style.left = `${toggleRect.left}px`;
                    categoriasAside.style.right = 'auto';
                    categoriasAside.style.bottom = 'auto';
                    categoriasAside.style.display = 'block';
                    categoriasAside.style.visibility = 'visible';
                    categoriasAside.style.opacity = '1';
                    categoriasAside.style.pointerEvents = 'auto';
                    categoriasAside.style.zIndex = '9999';
                    
                    // Verificar se o elemento está visível após aplicar os estilos
                    requestAnimationFrame(() => {
                        const rect = categoriasAside.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         rect.top >= 0 && rect.left >= 0 &&
                                         rect.top < window.innerHeight && 
                                         rect.left < window.innerWidth;
                        
                        console.log('✅ Estilos aplicados:', {
                            top: categoriasAside.style.top,
                            left: categoriasAside.style.left,
                            display: categoriasAside.style.display,
                            visibility: categoriasAside.style.visibility,
                            opacity: categoriasAside.style.opacity,
                            zIndex: categoriasAside.style.zIndex,
                            rect: rect,
                            isVisible: isVisible
                        });
                        
                        if (!isVisible) {
                            console.warn('⚠️ Dropdown pode estar fora da viewport!', rect);
                        }
                    });
                });
            } else {
                categoriasAside.classList.add('aberta');
                if (mobileSidebarBackdrop) {
                    mobileSidebarBackdrop.classList.add('visible');
                }
                mobileSidebarToggle.classList.add('hidden');
            }
        }

        let isOpening = false;
        let isProcessing = false;
        let clickTimeout = null;
        let outsideClickHandler = null;
        let lastClickTime = 0;
        const CLICK_DEBOUNCE = 300; // Tempo mínimo entre cliques em ms

        function setupOutsideClickHandler() {
            // Remover listener anterior se existir
            if (outsideClickHandler) {
                document.removeEventListener('click', outsideClickHandler);
                outsideClickHandler = null;
            }
            
            outsideClickHandler = (e) => {
                // ------------------------------------------------------------
                // MOBILE: se algum modal/popup estiver aberto, NÃO fecha o menu.
                // Isso evita que ao fechar/clicar fora de um modal o usuário
                // "volte pro feed" porque o menu lateral foi fechado.
                // ------------------------------------------------------------
                if (window.innerWidth <= 768) {
                    const temModalAberto = !!document.querySelector('.modal-overlay:not(.hidden)');
                    const temPopupEquipes = !!document.querySelector('.popup-equipes-concluidas');
                    if (temModalAberto || temPopupEquipes) {
                        return;
                    }
                }

                // Ignorar se estiver abrindo ou processando
                if (isOpening || isProcessing) {
                    return;
                }
                
                // Verifica se o menu está aberto
                if (!categoriasAside.classList.contains('aberta')) {
                    return;
                }
                
                const clickedElement = e.target;
                
                // Verifica se clicou dentro do menu
                if (categoriasAside.contains(clickedElement)) {
                    return;
                }
                
                // Verifica se clicou no botão de abrir/fechar
                if (mobileSidebarToggle && mobileSidebarToggle.contains(clickedElement)) {
                    return;
                }
                
                // Verifica se clicou no botão de fechar
                if (mobileSidebarClose && mobileSidebarClose.contains(clickedElement)) {
                    return;
                }
                
                // Em telas menores, verifica se clicou no backdrop (isso já fecha automaticamente)
                if (!isMediaScreen() && mobileSidebarBackdrop && 
                    (mobileSidebarBackdrop.contains(clickedElement) || clickedElement === mobileSidebarBackdrop)) {
                    return;
                }
                
                // Se chegou aqui, clicou fora - fecha o menu
                console.log('✅ Fechando menu - clique fora detectado');
                fecharSidebarMobile();
            };
            
            // Adiciona o listener imediatamente quando o menu está aberto
            // Usa um pequeno delay para evitar capturar o clique do botão que abriu
            setTimeout(() => {
                if (categoriasAside.classList.contains('aberta')) {
                    document.addEventListener('click', outsideClickHandler, true);
                    console.log('✅ Listener de clique fora adicionado');
                }
            }, 50);
        }

        mobileSidebarToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const now = Date.now();
            const timeSinceLastClick = now - lastClickTime;
            
            // Debounce: ignorar cliques muito próximos
            if (timeSinceLastClick < CLICK_DEBOUNCE) {
                console.log(`⏸️ Clique ignorado - muito rápido (${timeSinceLastClick}ms)`);
                return;
            }
            
            // Prevenir múltiplos cliques rápidos
            if (isProcessing || isOpening) {
                console.log('⏸️ Clique ignorado - já processando ou abrindo');
                return;
            }
            
            // Verificar estado atual antes de processar
            const isCurrentlyOpen = categoriasAside.classList.contains('aberta');
            
            lastClickTime = now;
            console.log('🖱️ Botão clicado!', 'Estado atual:', isCurrentlyOpen ? 'aberto' : 'fechado');
            isProcessing = true;
            
            // Limpar timeout anterior se existir
            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;
            }
            
            if (isCurrentlyOpen) {
                console.log('🔒 Fechando dropdown...');
                fecharSidebarMobile();
                setTimeout(() => {
                    isProcessing = false;
                }, 200);
            } else {
                console.log('🔓 Abrindo dropdown...');
                isOpening = true;
                abrirSidebarMobile();
                
                // Configurar listener de clique fora apenas quando abrir
                setupOutsideClickHandler();
                
                // Delay maior para garantir que o evento de clique fora não interfira
                clickTimeout = setTimeout(() => {
                    isOpening = false;
                    isProcessing = false;
                    clickTimeout = null;
                    console.log('✅ Dropdown totalmente aberto e pronto');
                }, 600);
            }
        }, { capture: true, once: false }); // Usar capture: true para garantir que seja processado primeiro

        if (mobileSidebarClose) {
            mobileSidebarClose.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                fecharSidebarMobile();
            });
        }

        if (mobileSidebarBackdrop) {
            mobileSidebarBackdrop.addEventListener('click', fecharSidebarMobile);
        }

        // Reposicionar dropdown ao rolar ou redimensionar em telas médias
        function reposicionarDropdown() {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                const toggleRect = mobileSidebarToggle.getBoundingClientRect();
                categoriasAside.style.top = `${toggleRect.bottom + 8}px`;
                categoriasAside.style.left = `${toggleRect.left}px`;
            }
        }

        window.addEventListener('scroll', reposicionarDropdown, true);
        window.addEventListener('resize', () => {
            if (isMediaScreen() && categoriasAside.classList.contains('aberta')) {
                reposicionarDropdown();
            } else if (!isMediaScreen()) {
                // Se mudou para outra resolução, fechar dropdown
                fecharSidebarMobile();
            }
        });

        // Observer para fechar sidebar quando qualquer modal é aberto (apenas em telas médias)
        const observerModais = new MutationObserver((mutations) => {
            if (!isMediaScreen()) return;
            if (!categoriasAside.classList.contains('aberta')) return;
            
            mutations.forEach((mutation) => {
                // Verifica mudanças na classe 'hidden' de modais existentes
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if ((target.classList?.contains('modal-overlay') || target.classList?.contains('modal')) &&
                        !target.classList.contains('hidden')) {
                        fecharSidebarMobile();
                    }
                }
                
                // Verifica se novos modais foram adicionados
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const isModal = node.classList?.contains('modal-overlay') || 
                                       node.classList?.contains('modal') ||
                                       (node.querySelector && (node.querySelector('.modal-overlay') || node.querySelector('.modal')));
                        
                        if (isModal) {
                            const modalElement = node.classList?.contains('modal-overlay') || node.classList?.contains('modal') 
                                ? node 
                                : node.querySelector('.modal-overlay') || node.querySelector('.modal');
                            
                            if (modalElement && !modalElement.classList.contains('hidden')) {
                                fecharSidebarMobile();
                            }
                        }
                    }
                });
            });
        });

        // Observa o body para detectar quando modais são abertos (classe hidden removida)
        observerModais.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    if (filtroCidadeBtn && filtroCidadeInput) {
        filtroCidadeBtn.addEventListener('click', () => {
            const termo = filtroCidadeInput.value.trim();
            if (!termo) return fetchPosts(null, null);
            if (isUF(termo)) return fetchPosts(null, termo.toUpperCase());
            if (isStateName(termo)) return fetchPosts(null, STATE_NAME_TO_UF[normalizeText(termo)]);
            return fetchPosts(termo, null);
        });

        // Enter no campo também dispara a busca (mais rápido e natural)
        filtroCidadeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                filtroCidadeBtn.click();
            }
        });

        // Autocomplete de cidades (servidor) conforme digita
        let sugestaoCidadeTimer = null;
        filtroCidadeInput.addEventListener('input', () => {
            if (!datalistCidades) return;
            const termo = filtroCidadeInput.value.trim();
            // Se o usuário digitar um UF (ex: MG), sugere só o estado (não cidades).
            if (isUF(termo)) {
                const uf = termo.toUpperCase();
                populateDatalist([uf, UF_TO_STATE_NAME[uf]].filter(Boolean));
                return;
            }

            if (sugestaoCidadeTimer) clearTimeout(sugestaoCidadeTimer);
            sugestaoCidadeTimer = setTimeout(async () => {
                if (!termo || termo.length < 1) return;
                try {
                    const resp = await fetch(`/api/cidades?q=${encodeURIComponent(termo)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data?.success) return;

                    const sugestoes = Array.isArray(data.sugestoes) ? data.sugestoes : (Array.isArray(data.cidades) ? data.cidades : []);
                    populateDatalist(sugestoes);
                } catch (err) {
                    // Se falhar, mantém as sugestões locais já existentes
                    console.warn('Falha ao buscar sugestões de cidades:', err);
                }
            }, 180);
        });
    }

    if (explorarCidadeAddBtn && explorarCidadeInput) {
        explorarCidadeAddBtn.addEventListener('click', () => {
            addExplorarCity(explorarCidadeInput.value);
            explorarCidadeInput.value = '';
        });
        explorarCidadeInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                addExplorarCity(explorarCidadeInput.value);
                explorarCidadeInput.value = '';
            }
        });

        explorarCidadeInput.addEventListener('blur', () => {
            if (explorarCidadeInput.value) {
                explorarCidadeInput.value = resolveCityName(explorarCidadeInput.value);
            }
        });

        let explorarSugestaoTimer = null;
        explorarCidadeInput.addEventListener('input', () => {
            if (!explorarCidadesDatalist) return;
            const termo = explorarCidadeInput.value.trim();
            if (explorarSugestaoTimer) clearTimeout(explorarSugestaoTimer);
            if (!termo || termo.length < 1) return;
            explorarSugestaoTimer = setTimeout(async () => {
                try {
                    const resp = await fetch(`/api/cidades?q=${encodeURIComponent(termo)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const data = await resp.json();
                    if (!resp.ok || !data?.success) return;
                    const sugestoes = Array.isArray(data.cidades) ? data.cidades : (Array.isArray(data.sugestoes) ? data.sugestoes : []);
                    if (explorarCidadesDatalist) {
                        explorarCidadesDatalist.innerHTML = '';
                        const frag = document.createDocumentFragment();
                        sugestoes.forEach((cidade) => {
                            const opt = document.createElement('option');
                            opt.value = cidade;
                            frag.appendChild(opt);
                        });
                        explorarCidadesDatalist.appendChild(frag);
                    }
                } catch (err) {
                    console.warn('Falha ao buscar sugestoes de cidades:', err);
                }
            }, 250);
        });
    }

    if (explorarCityEditBtn && explorarCityControls) {
        explorarCityEditBtn.addEventListener('click', () => {
            explorarCityControls.classList.toggle('is-open');
            if (explorarCityRow) {
                explorarCityRow.classList.toggle('is-hidden');
            }
            if (!explorarCityControls.classList.contains('is-open')) {
                closeExplorarCityControls();
            }
        });
    }

    if (explorarCityControls) {
        document.addEventListener('click', (event) => {
            if (!explorarCityControls.classList.contains('is-open')) return;
            const target = event.target;
            if (explorarCityControls.contains(target) || explorarCityEditBtn?.contains(target)) return;
            closeExplorarCityControls();
        });
    }

    if (explorarCategoriaCurrent && explorarCategoriasModal) {
        explorarCategoriaCurrent.addEventListener('click', () => {
            const isOpen = explorarCategoriasModal.classList.toggle('is-open');
            const current = explorarCategoriaCurrent.textContent?.trim();
            explorarCategoriasModal.querySelectorAll('.explorar-categoria-option').forEach((option) => {
                option.classList.toggle('is-hidden', option.textContent?.trim() === current);
            });
        });
        explorarCategoriasModal.querySelectorAll('.explorar-categoria-option').forEach((option) => {
            option.addEventListener('click', () => {
                explorarCategoriaCurrent.textContent = option.textContent || 'Todas';
                explorarCategoriasModal.classList.remove('is-open');
                
                fetchExplorarFeed();
            });
        });
        document.addEventListener('click', (event) => {
            if (!explorarCategoriasModal.classList.contains('is-open')) return;
            const target = event.target;
            if (explorarCategoriasModal.contains(target) || explorarCategoriaCurrent.contains(target)) return;
            explorarCategoriasModal.classList.remove('is-open');
        });

    }

    // ----------------------------------------------------------------------
    // BUSCA RÁPIDA NO CABEÇALHO (serviços / profissionais no feed)
    // ----------------------------------------------------------------------
    function aplicarFiltroBusca(term) {
        const termo = (term || '').trim().toLowerCase();
        const posts = document.querySelectorAll('.post');

        posts.forEach(post => {
            if (!termo) {
                post.style.display = 'block';
                return;
            }

            const textoPost = post.querySelector('.post-content')?.innerText.toLowerCase() || '';
            const nomeAutor = post.querySelector('.user-name')?.innerText.toLowerCase() || '';
            const cidadeAutor = post.querySelector('.post-author-city')?.innerText.toLowerCase() || '';

            const corresponde = textoPost.includes(termo) ||
                                nomeAutor.includes(termo) ||
                                cidadeAutor.includes(termo);

            post.style.display = corresponde ? 'block' : 'none';
        });
    }

    if (searchInput) {
        // Cria container de resultados de busca abaixo do header
        const headerElement = document.querySelector('header');
        if (!document.getElementById('search-results')) {
            searchResultsContainer = document.createElement('div');
            searchResultsContainer.id = 'search-results';
            searchResultsContainer.innerHTML = '';
            if (headerElement) headerElement.appendChild(searchResultsContainer);
        } else {
            searchResultsContainer = document.getElementById('search-results');
        }

        // Backdrop escuro atrás dos resultados
        if (!document.getElementById('search-results-backdrop')) {
            searchResultsBackdrop = document.createElement('div');
            searchResultsBackdrop.id = 'search-results-backdrop';
            document.body.appendChild(searchResultsBackdrop);

            searchResultsBackdrop.addEventListener('click', () => {
                // Ao clicar fora, limpa resultados e esconde o fundo escurecido
                if (searchResultsContainer) {
                    searchResultsContainer.innerHTML = '';
                    searchResultsContainer.style.display = 'none';
                }
                searchResultsBackdrop.classList.remove('visible');
                // No mobile, fecha a área de busca do header também
                const headerEl = document.querySelector('header');
                headerEl && headerEl.classList.remove('search-open');
            });
        } else {
            searchResultsBackdrop = document.getElementById('search-results-backdrop');
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
            try {
                localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items));
            } catch {
                // ignore
            }
        }

        function pushUserToHistory(user) {
            if (!user || !user.id) return;
            const history = getSearchHistoryUsers();
            const next = [
                user,
                ...history.filter((h) => h && h.id && h.id !== user.id)
            ].slice(0, 10);
            setSearchHistoryUsers(next);
        }

        function renderSearchHistoryUsers() {
            if (!searchResultsContainer) return;
            searchResultsContainer.style.display = 'block';
            const history = getSearchHistoryUsers();

            if (!history.length) {
                searchResultsContainer.innerHTML = `
                    <div class="search-results-empty">
                        Nenhuma pesquisa recente.
                    </div>
                `;
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
                    navigateToProfile(targetUserId);
                });
            });
        }

        // Permite a barra inferior abrir a busca já com histórico
        abrirBuscaComHistorico = function () {
            // Se não tiver termo, mostra histórico; se tiver, deixa o input disparar
            const q = (searchInput.value || '').trim();
            if (!q) {
                renderSearchHistoryUsers();
            }
        };

        async function buscarNoServidor(termo) {
            const q = (termo || '').trim();
            if (!q) {
                // No mobile, quando a busca estiver "aberta", mostra histórico ao invés de fechar tudo
                if (headerElement?.classList?.contains('search-open') && window.innerWidth <= 768) {
                    renderSearchHistoryUsers();
                } else {
                    if (searchResultsContainer) searchResultsContainer.innerHTML = '';
                    if (searchResultsBackdrop) searchResultsBackdrop.classList.remove('visible');
                }
                return;
            }

            try {
                const response = await fetch(`/api/buscar-usuarios?q=${encodeURIComponent(q)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    console.error('Erro na busca:', data.message);
                    return;
                }
                renderSearchResults(data, q);
            } catch (err) {
                console.error('Erro ao chamar /api/busca:', err);
            }
        }

        function renderSearchResults(data, termo) {
            if (!searchResultsContainer) return;
            searchResultsContainer.style.display = 'block';

            const { usuarios = [], servicos = [], posts = [] } = data;

            // Para o modo "pesquisar pessoas", se não achou usuários, mostra mensagem dedicada
            if (usuarios.length === 0) {
                searchResultsContainer.innerHTML = `
                    <div class="search-results-empty">
                        Nenhuma pessoa encontrada.
                    </div>
                `;
                if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');
                return;
            }

            let html = '<div class="search-results-box">';

            if (usuarios.length > 0) {
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
                                <div class="search-subtitle">
                                    ${u.atuacao || ''} ${cidadeEstado ? '• ' + cidadeEstado : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
            }

            html += '</div>';
            searchResultsContainer.innerHTML = html;

            if (searchResultsBackdrop) searchResultsBackdrop.classList.add('visible');

            // Clique em usuário → abre perfil
            searchResultsContainer.querySelectorAll('.search-user').forEach(item => {
                item.addEventListener('click', () => {
                    const targetUserId = item.dataset.userId;
                    if (targetUserId) {
                        // Salva no histórico (até 10)
                        const nome = item.querySelector('.search-title')?.textContent?.trim() || '';
                        const subtitulo = item.querySelector('.search-subtitle')?.textContent?.trim() || '';
                        const foto = item.querySelector('img')?.getAttribute('src') || '';
                        pushUserToHistory({ id: targetUserId, nome, subtitulo, foto });
                        navigateToProfile(targetUserId);
                    }
                });
            });
        }

        let buscaTimeout = null;

        searchInput.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            const valor = searchInput.value;
            buscaTimeout = setTimeout(() => {
                buscarNoServidor(valor);
            }, 200);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const valor = searchInput.value;
                buscarNoServidor(valor);
            }
        });
    }

    async function refreshPostLikesUI(postId) {
        if (!postId) return;
        try {
            const resp = await fetch(`/api/posts/${postId}/likes`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await resp.json();
            if (!resp.ok || data?.success === false) return;
            const count = Number.isFinite(data.likesCount) ? data.likesCount : 0;
            const preview = Array.isArray(data.likesPreview) ? data.likesPreview : [];
            const likesFull = Array.isArray(data.likes) ? data.likes : [];
            const isLikedByMe = !!data.isLikedByMe;
            const allButtons = document.querySelectorAll(`.btn-like[data-post-id="${postId}"]`);
            allButtons.forEach((button) => {
                const countEl = button.querySelector('.like-count');
                if (countEl) countEl.textContent = count;
                if (isLikedByMe) {
                    button.classList.add('liked');
                } else {
                    button.classList.remove('liked');
                }
            });
            const feedOverlays = document.querySelectorAll(`.explorar-card[data-explorar-id="${postId}"] .explorar-card-info-overlay`);
            feedOverlays.forEach((overlay) => {
                const existing = overlay.querySelector('.explorar-like-avatars');
                if (existing) existing.remove();
                if (!preview.length) return;
                const avatarsBtn = document.createElement('button');
                avatarsBtn.type = 'button';
                avatarsBtn.className = 'explorar-like-avatars';
                preview.forEach((u) => {
                    if (!u || !u.foto) return;
                    const img = document.createElement('img');
                    img.src = u.foto;
                    img.alt = u.nome || '';
                    img.className = 'explorar-like-avatar';
                    img.referrerPolicy = 'no-referrer';
                    avatarsBtn.appendChild(img);
                });
                if (!avatarsBtn.childElementCount) return;
                const card = overlay.closest('.explorar-card');
                const isOwnerForModal = !!(card && card.querySelector('.explorar-card-delete') && likesFull.length > 0);
                if (isOwnerForModal) {
                    avatarsBtn.addEventListener('click', () => {
                        openLikesModal(postId, likesFull, avatarsBtn);
                    });
                } else {
                    avatarsBtn.classList.add('non-owner');
                    ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach((type) => {
                        avatarsBtn.addEventListener(type, (ev) => {
                            ev.stopPropagation();
                            ev.preventDefault();
                        });
                    });
                }
                overlay.appendChild(avatarsBtn);
            });
            if (explorarVideoInfo && explorarCurrentPostId && String(explorarCurrentPostId) === String(postId)) {
                const existing = explorarVideoInfo.querySelector('.explorar-like-avatars');
                if (existing) existing.remove();
                if (preview.length) {
                    const avatarsBtn = document.createElement('button');
                    avatarsBtn.type = 'button';
                    avatarsBtn.className = 'explorar-like-avatars';
                    preview.forEach((u) => {
                        if (!u || !u.foto) return;
                        const img = document.createElement('img');
                        img.src = u.foto;
                        img.alt = u.nome || '';
                        img.className = 'explorar-like-avatar';
                        img.referrerPolicy = 'no-referrer';
                        avatarsBtn.appendChild(img);
                    });
                    if (avatarsBtn.childElementCount) {
                        const isOwner = explorarCurrentOwnerId && userId && String(explorarCurrentOwnerId) === String(userId);
                        const isOwnerWithList = isOwner && likesFull.length > 0;
                        if (isOwnerWithList) {
                            avatarsBtn.addEventListener('click', (ev) => {
                                openLikesModal(postId, likesFull, avatarsBtn);
                            });
                        } else {
                            avatarsBtn.classList.add('non-owner');
                            ['click', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach((type) => {
                                avatarsBtn.addEventListener(type, (ev) => {
                                    ev.stopPropagation();
                                    ev.preventDefault();
                                });
                            });
                        }
                        explorarVideoInfo.appendChild(avatarsBtn);
                    }
                }
            }
        } catch {}
    }

    async function toggleLikeForPost(postId) {
        if (!postId) return;
        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                await refreshPostLikesUI(postId);
            }
        } catch (error) {
            console.error('Erro ao curtir:', error);
        }
    }

    async function handleLikePost(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.postId;
        toggleLikeForPost(postId);
    }

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

    // Função para auto-resize do textarea
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = window.innerWidth <= 767 ? 66 : 200; // 3 linhas em mobile, mais em desktop
        textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }

    function toggleCommentSection(e) {
        const btn = e.currentTarget;
        const postElement = btn.closest('.post');
        const commentsSection = postElement.querySelector('.post-comments');
        commentsSection.classList.toggle('visible');
        if (commentsSection.classList.contains('visible')) {
            const textarea = commentsSection.querySelector('.comment-input');
            if (textarea) {
                textarea.focus();
                // Inicializa altura do textarea
                textarea.style.height = (window.innerWidth <= 767 ? 44 : 50) + 'px';
            }
            // Verifica comentários longos após abrir
            setTimeout(() => {
                const comments = commentsSection.querySelectorAll('.comment');
                comments.forEach(comment => {
                    if (comment.offsetParent !== null) {
                        checkLongComment(comment);
                    }
                });
            }, 300);
        }
    }

    async function handleSendComment(e) {
        const btn = e.currentTarget;
        const postId = btn.dataset.postId;
        const postElement = btn.closest('.post');
        const input = postElement.querySelector('.comment-form .comment-input');
        const content = input.value.trim();
        if (!content) return;
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            const data = await response.json();
            if (data.success && data.comment) {
                const commentList = postElement.querySelector('.comment-list');
                const comment = data.comment;
                const commentPhoto = comment.userId.foto || comment.userId.avatarUrl || 'imagens/default-user.png';
                const isPostOwner = postElement.classList.contains('is-owner');
                // O usuário que acabou de criar o comentário sempre é o dono dele
                const isCommentOwner = comment.userId._id === userId;
                const canEditComment = isCommentOwner; // Só dono pode editar
                const canDeleteComment = isPostOwner || isCommentOwner; // Dono OU dono da foto pode apagar

                const newCommentHTML = `
                <div class="comment" data-comment-id="${comment._id}">
                    <a href="/perfil.html?id=${comment.userId._id}" style="text-decoration: none; color: inherit;">
                        <img src="${commentPhoto.includes('pixabay') ? 'imagens/default-user.png' : commentPhoto}" alt="Avatar" class="comment-avatar" style="cursor: pointer;" loading="lazy" decoding="async">
                    </a>
                    <div class="comment-body-container">
                        <div class="comment-body">
                            <a href="/perfil.html?id=${comment.userId._id}" style="text-decoration: none; color: inherit; font-weight: bold; cursor: pointer;">${comment.userId.nome}</a>
                            <p class="comment-content">${comment.content}</p>
                            ${(canEditComment || canDeleteComment) ? `
                                <button class="btn-comment-options" data-comment-id="${comment._id}" title="Opções" style="display: block;">⋮</button>
                                <div class="comment-options-menu oculto" data-comment-id="${comment._id}">
                                    ${canEditComment ? `<button class="btn-edit-comment" data-comment-id="${comment._id}" title="Editar">✏️</button>` : ''}
                                    ${canDeleteComment ? `<button class="btn-delete-comment" data-comment-id="${comment._id}" title="Apagar">🗑️</button>` : ''}
                                </div>
                            ` : ''}
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn btn-like-comment" data-comment-id="${comment._id}">
                                <i class="fas fa-thumbs-up"></i>
                                <span class="like-count">0</span>
                            </button>
                            <button class="comment-action-btn btn-show-reply-form" data-comment-id="${comment._id}">Responder</button>
                        </div>
                        <div class="reply-list oculto"></div>
                        <div class="reply-form oculto">
                            <input type="text" class="reply-input" placeholder="Responda a ${comment.userId.nome}...">
                            <button class="btn-send-reply" data-comment-id="${comment._id}" aria-label="Enviar resposta" title="Enviar resposta">
                                <img
                                    class="send-reply-icon"
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
                // Cria um elemento temporário para inserir o HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = newCommentHTML;
                const newCommentElement = tempDiv.firstElementChild;
                
                // Remove botões duplicados antes de adicionar
                const existingButtons = newCommentElement.querySelectorAll('.btn-comment-options');
                if (existingButtons.length > 1) {
                    // Mantém apenas o primeiro botão
                    for (let i = 1; i < existingButtons.length; i++) {
                        existingButtons[i].remove();
                    }
                }
                
                commentList.appendChild(newCommentElement);
                
                // Re-anexa listeners para os novos botões
                newCommentElement.querySelector('.btn-like-comment').addEventListener('click', handleLikeComment);
                const deleteBtn = newCommentElement.querySelector('.btn-delete-comment');
                if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteComment);
                newCommentElement.querySelector('.btn-show-reply-form').addEventListener('click', toggleReplyForm);
                newCommentElement.querySelector('.btn-send-reply').addEventListener('click', handleSendReply);
                const optionsBtn = newCommentElement.querySelector('.btn-comment-options');
                const editBtn = newCommentElement.querySelector('.btn-edit-comment');
                if (optionsBtn) optionsBtn.addEventListener('click', handleCommentOptions);
                if (editBtn) editBtn.addEventListener('click', handleEditComment);
                
                // Verifica se o novo comentário é longo após renderização
                setTimeout(() => {
                    if (newCommentElement.offsetParent !== null) {
                        checkLongComment(newCommentElement);
                    }
                }, 300);
                
                // Limpa e reseta o textarea
                input.value = '';
                input.style.height = 'auto';
                input.style.height = (window.innerWidth <= 767 ? 44 : 50) + 'px';
            } else {
                throw new Error(data.message || 'Erro ao enviar comentário.');
            }
        } catch (error) {
            console.error('Erro ao comentar:', error);
            alert('Não foi possível enviar o comentário.');
        }
    }


    // ----------------------------------------------------------------------
    // 🛑 NOVOS HANDLERS (Comentários e Respostas)
    // ----------------------------------------------------------------------

    function toggleReplyForm(e) {
        const btn = e.currentTarget;
        const commentElement = btn.closest('.comment');
        const replyForm = commentElement.querySelector('.reply-form');
        if (replyForm) {
            replyForm.classList.toggle('oculto');
            if (!replyForm.classList.contains('oculto')) {
                replyForm.querySelector('.reply-input').focus();
            }
        }
    }

    function toggleReplyList(e) {
        const btn = e.currentTarget;
        const commentElement = btn.closest('.comment');
        const replyList = commentElement.querySelector('.reply-list');
        if (replyList) {
            replyList.classList.toggle('oculto');
            const replyCount = replyList.children.length;
            btn.textContent = replyList.classList.contains('oculto') ? `Ver ${replyCount} Respostas` : "Ocultar Respostas";
        }
    }

    function syncRepliesUI(commentElement) {
        if (!commentElement) return;
        const replyList = commentElement.querySelector('.reply-list');
        const replyCount = replyList ? replyList.querySelectorAll('.reply').length : 0;
        const actions = commentElement.querySelector('.comment-actions');
        const replyFormBtn = actions ? actions.querySelector('.btn-show-reply-form') : null;
        let toggleBtn = actions ? actions.querySelector('.btn-toggle-replies') : null;

        // Sem respostas: remove o botão e mantém a lista oculta
        if (replyCount <= 0) {
            if (toggleBtn) toggleBtn.remove();
            if (replyList) replyList.classList.add('oculto');
            return;
        }

        // Primeira resposta adicionada: cria o botão de ver respostas
        if (!toggleBtn && actions && replyFormBtn) {
            toggleBtn = document.createElement('button');
            toggleBtn.className = 'comment-action-btn btn-toggle-replies';
            toggleBtn.dataset.commentId = commentElement.dataset.commentId || '';
            toggleBtn.addEventListener('click', toggleReplyList);
            replyFormBtn.insertAdjacentElement('afterend', toggleBtn);
        }

        if (toggleBtn) {
            toggleBtn.textContent = (replyList && replyList.classList.contains('oculto'))
                ? `Ver ${replyCount} Respostas`
                : 'Ocultar Respostas';
        }
    }

    async function handleSendReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId || btn.closest('.comment')?.dataset.commentId;
        const postElement = btn.closest('.post');
        const postId = postElement ? postElement.dataset.postId : null;
        if (!commentId || !postId) {
            console.warn('Responder comentário sem IDs necessários', { commentId, postId });
            return;
        }
        const replyForm = btn.closest('.reply-form');
        const input = replyForm.querySelector('.reply-input');
        const content = input.value.trim();
        if (!content) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            const data = await response.json();
            if (data.success && data.reply) {
                const replyList = btn.closest('.comment-body-container').querySelector('.reply-list');
                const commentElement = btn.closest('.comment');
                const isPostOwner = postElement.classList.contains('is-owner');
                const replyUserId = data.reply?.userId?._id || data.reply?.userId;
                const isReplyOwner = replyUserId && String(replyUserId) === String(userId);
                const canEditReply = !!isReplyOwner;
                const canDeleteReply = !!(isPostOwner || isReplyOwner);
                const newReplyHTML = renderReply(data.reply, commentId, canEditReply, canDeleteReply);
                replyList.innerHTML += newReplyHTML;
                
                // Re-anexa listeners para os novos botões da resposta
                const newReplyElement = replyList.lastElementChild;
                newReplyElement.querySelector('.btn-like-reply').addEventListener('click', handleLikeReply);
                const deleteReplyBtn = newReplyElement.querySelector('.btn-delete-reply');
                if (deleteReplyBtn) deleteReplyBtn.addEventListener('click', handleDeleteReply);
                const replyOptionsBtn = newReplyElement.querySelector('.btn-reply-options');
                const editReplyBtn = newReplyElement.querySelector('.btn-edit-reply');
                if (replyOptionsBtn) replyOptionsBtn.addEventListener('click', handleReplyOptions);
                if (editReplyBtn) editReplyBtn.addEventListener('click', handleEditReply);

                replyList.classList.remove('oculto'); // Mostra a lista
                syncRepliesUI(commentElement);
                // garante o ícone correto no tema atual
                updateSendCommentIcons();
                input.value = '';
                replyForm.classList.add('oculto'); // Esconde o form
            } else {
                throw new Error(data.message || 'Erro ao enviar resposta.');
            }
        } catch (error) {
            console.error('Erro ao responder:', error);
            alert('Não foi possível enviar a resposta.');
        }
    }

    async function handleLikeComment(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId || btn.closest('.comment')?.dataset.commentId;
        const postId = btn.closest('.post')?.dataset.postId;
        if (!commentId || !postId) {
            console.warn('Like comentário sem IDs necessários', { commentId, postId });
            return;
        }
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.classList.toggle('liked');
                btn.querySelector('.like-count').textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir comentário:', error);
        }
    }

    async function handleLikeReply(e) {
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        const postId = btn.closest('.post').dataset.postId;
        
        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                btn.classList.toggle('liked');
                btn.querySelector('.like-count').textContent = data.likes.length;
            }
        } catch (error) {
            console.error('Erro ao curtir resposta:', error);
        }
    }

    // Handler para abrir/fechar menu de opções do comentário
    function handleCommentOptions(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const menu = document.querySelector(`.comment-options-menu[data-comment-id="${commentId}"]`);
        const commentElement = btn.closest('.comment') || btn.closest('.reply');
        
        // Verifica se deve aparecer acima ou ao lado
        if (commentElement && menu) {
            const isMobile = window.innerWidth <= 767;
            if (isMobile) {
                // Em telas menores, verifica se há espaço ao lado primeiro
                // A classe será aplicada/removida pela função adjustMenuPosition
                menu.classList.remove('comentario-multiplas-linhas'); // Remove primeiro, adjustMenuPosition decide
            } else {
                // Em telas maiores, só aplica se tiver múltiplas linhas
                if (checkCommentHasMultipleLines(commentElement)) {
                    menu.classList.add('comentario-multiplas-linhas');
                } else {
                    menu.classList.remove('comentario-multiplas-linhas');
                }
            }
        }
        
        // Fecha todos os outros menus
        document.querySelectorAll('.comment-options-menu').forEach(m => {
            if (m !== menu) {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const originalComment = document.querySelector(`.comment[data-comment-id="${m.dataset.commentId}"], .reply[data-reply-id="${m.dataset.replyId}"]`);
                    if (originalComment) {
                        const commentBody = originalComment.querySelector('.comment-body-container, .reply-body-container');
                        if (commentBody) {
                            commentBody.appendChild(m);
                        }
                    }
                }
            }
        });
        document.querySelectorAll('.reply-options-menu').forEach(m => {
            m.classList.add('oculto');
            // Retorna menu para o lugar original se estiver no body
            if (m.parentElement === document.body) {
                const originalReply = document.querySelector(`.reply[data-reply-id="${m.dataset.replyId}"]`);
                if (originalReply) {
                    const replyBody = originalReply.querySelector('.reply-body-container');
                    if (replyBody) {
                        replyBody.appendChild(m);
                    }
                }
            }
        });
        
        if (menu) {
            const wasHidden = menu.classList.contains('oculto');
            menu.classList.toggle('oculto');
            
            // Ajusta posicionamento após abrir
            if (!menu.classList.contains('oculto')) {
                // Não move para o body aqui - deixa adjustMenuPosition decidir
                requestAnimationFrame(() => {
                    adjustMenuPosition(menu, commentElement, btn);
                });
            } else {
                // Se está fechando, retorna para o lugar original
                if (menu.parentElement === document.body) {
                    const originalComment = document.querySelector(`.comment[data-comment-id="${commentId}"], .reply[data-reply-id="${commentId}"]`);
                    if (originalComment) {
                        const commentBody = originalComment.querySelector('.comment-body-container, .reply-body-container');
                        if (commentBody) {
                            commentBody.appendChild(menu);
                        }
                    }
                }
            }
        }
    }
    
    // Função para ajustar posicionamento do menu para não sair da tela
    function adjustMenuPosition(menu, commentElement, btn) {
        if (!menu || !commentElement || !btn) return;
        
        const isMobile = window.innerWidth <= 767;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;
        const headerHeight = 70;
        
        // Remove estilos inline anteriores
        menu.style.top = '';
        menu.style.left = '';
        menu.style.right = '';
        menu.style.bottom = '';
        menu.style.position = '';
        
        // Garante que o menu esteja visível e exibido
        menu.classList.remove('oculto');
        menu.style.visibility = 'visible';
        menu.style.display = 'flex';
        menu.style.zIndex = '10000'; // Garante que sobreponha post-comments
        
        // Força um reflow para garantir que o menu seja renderizado
        void menu.offsetHeight;
        
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();
            const commentRect = commentElement.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            
            // Se o menu não tem dimensões, tenta novamente
            if (menuRect.width === 0 || menuRect.height === 0) {
                requestAnimationFrame(() => {
                    adjustMenuPosition(menu, commentElement, btn);
                });
                return;
            }
            
            if (isMobile) {
                // Em telas menores: primeiro tenta ao lado do botão, se não couber, coloca acima próximo ao botão
                const spaceRight = viewportWidth - btnRect.right;
                const spaceLeft = btnRect.left;
                // Espaço mínimo necessário: largura do menu + padding
                const minSpace = menuRect.width + padding;
                
                // Verifica se há espaço suficiente ao lado do botão (direita ou esquerda)
                const canFitBeside = spaceRight >= minSpace || spaceLeft >= minSpace;
                
                if (canFitBeside) {
                    // Tem espaço ao lado: usa comportamento padrão (ao lado do comentário)
                    menu.classList.remove('comentario-multiplas-linhas');
                    
                    // Se o menu está no body, retorna para o lugar original ANTES de calcular posições
                    if (menu.parentElement === document.body) {
                        const commentBody = commentElement.querySelector('.comment-body-container, .reply-body-container');
                        if (commentBody) {
                            commentBody.appendChild(menu);
                            // Força reflow
                            void menu.offsetHeight;
                        }
                    }
                    
                    // Remove todos os estilos inline de posicionamento
                    menu.style.removeProperty('top');
                    menu.style.removeProperty('left');
                    menu.style.removeProperty('right');
                    menu.style.removeProperty('bottom');
                    menu.style.removeProperty('position');
                    
                    // Garante que está visível
                    menu.classList.remove('oculto');
                    menu.style.visibility = 'visible';
                    menu.style.display = 'flex';
                    
                    // Garante z-index alto mesmo quando ao lado
                    menu.style.zIndex = '10000';
                    
                    // Verifica se realmente cabe após aplicar CSS
                    requestAnimationFrame(() => {
                        const currentMenuRect = menu.getBoundingClientRect();
                        if (currentMenuRect.width === 0 || currentMenuRect.height === 0) {
                            // Menu ainda não renderizado, tenta novamente
                            setTimeout(() => adjustMenuPosition(menu, commentElement, btn), 50);
                            return;
                        }
                        
                        if (currentMenuRect.right > viewportWidth - padding) {
                            // Se não couber à direita, move para o body e usa fixed
                            if (menu.parentElement !== document.body) {
                                document.body.appendChild(menu);
                            }
                            menu.classList.add('comentario-multiplas-linhas');
                            menu.style.position = 'fixed';
                            
                            // Recalcula dimensões após mover para body
                            const newMenuRect = menu.getBoundingClientRect();
                            
                            // Calcula posição fixa
                            let fixedTop = btnRect.top - newMenuRect.height - 5;
                            let fixedRight = viewportWidth - btnRect.right;
                            
                            if (fixedTop < headerHeight + padding) {
                                fixedTop = btnRect.bottom + 5;
                            }
                            
                            menu.style.top = `${fixedTop}px`;
                            menu.style.right = `${fixedRight}px`;
                            menu.style.left = 'auto';
                            menu.style.zIndex = '10000';
                        }
                    });
                } else {
                    // Não tem espaço ao lado: coloca acima ou abaixo do botão, próximo a ele
                    menu.classList.add('comentario-multiplas-linhas');
                    
                    // Move o menu para o body para escapar completamente do contexto de clipping
                    // das divs post-comments e comment-list
                    if (menu.parentElement !== document.body) {
                        document.body.appendChild(menu);
                    }
                    
                    // SEMPRE usa posicionamento fixed para escapar do contexto de clipping
                    menu.style.position = 'fixed';
                    
                    // Calcula posição fixa baseada no botão (coordenadas da viewport)
                    let fixedTop = btnRect.top - menuRect.height - 5;
                    let fixedRight = viewportWidth - btnRect.right;
                    
                    // Verifica se cabe acima
                    if (fixedTop < headerHeight + padding) {
                        // Se não couber acima, coloca abaixo do botão
                        fixedTop = btnRect.bottom + 5;
                    }
                    
                    // Verifica espaço à direita
                    const spaceRight = viewportWidth - btnRect.right;
                    if (spaceRight < menuRect.width + padding) {
                        // Ajusta mas mantém próximo ao botão
                        fixedRight = Math.max(padding, spaceRight - menuRect.width);
                    }
                    
                    // Ajusta se sair da tela embaixo
                    if (fixedTop + menuRect.height > viewportHeight - padding) {
                        fixedTop = viewportHeight - menuRect.height - padding;
                    }
                    
                    // Ajusta se sair da tela em cima (permite sobrepor header se necessário)
                    if (fixedTop < padding) {
                        fixedTop = Math.max(padding, btnRect.top - menuRect.height - 5);
                    }
                    
                    menu.style.top = `${fixedTop}px`;
                    menu.style.right = `${fixedRight}px`;
                    menu.style.left = 'auto';
                    menu.style.zIndex = '10000';
                }
            } else {
                // Em telas maiores: ao lado (comportamento padrão)
                requestAnimationFrame(() => {
                    const currentMenuRect = menu.getBoundingClientRect();
                    
                    // Se sair da tela à direita, move para a esquerda
                    if (currentMenuRect.right > viewportWidth - padding) {
                        menu.style.left = 'auto';
                        menu.style.right = `${viewportWidth - commentRect.left + padding}px`;
                    }
                    
                    // Se sair da tela em cima, ajusta para baixo
                    if (currentMenuRect.top < padding) {
                        menu.style.top = `${padding - commentRect.top}px`;
                    }
                    
                    // Se sair da tela embaixo, ajusta para cima
                    if (currentMenuRect.bottom > viewportHeight - padding) {
                        menu.style.top = `${viewportHeight - commentRect.bottom - menuRect.height - padding}px`;
                    }
                });
            }
        });
    }

    // Handler para editar comentário
    function handleEditComment(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
        
        if (!commentElement) {
            console.error('❌ Comentário não encontrado:', commentId);
            return;
        }
        
        // Verifica se já existe uma caixa de edição ativa
        const existingEditInput = commentElement.querySelector('.comment-edit-input');
        if (existingEditInput) {
            // Se já existe, apenas foca nela
            existingEditInput.focus();
            existingEditInput.select();
            return;
        }
        
        const contentElement = commentElement.querySelector('.comment-content');
        if (!contentElement) {
            console.error('❌ Elemento de conteúdo não encontrado no comentário:', commentId);
            return;
        }
        
        const originalText = contentElement.textContent;

        const optionsBtn = commentElement.querySelector('.btn-comment-options');
        const originalOptionsText = optionsBtn ? optionsBtn.textContent : null;
        const cancelEditViaX = () => {
            contentElement.style.display = '';
            editRow.remove();
            commentElement.dataset.editing = '';
            if (optionsBtn) {
                optionsBtn.textContent = originalOptionsText || '⋯';
                optionsBtn.style.display = '';
            }
            document.removeEventListener('mousedown', outsideCancelHandler, true);
        };
        const outsideCancelHandler = (ev) => {
            if (commentElement.dataset.editing !== '1') return;
            if (editRow.contains(ev.target)) return;
            cancelEditViaX();
        };
        
        // Fecha o menu
        const menu = commentElement.querySelector('.comment-options-menu');
        if (menu) menu.classList.add('oculto');
        
        // Cria textarea de edição (auto-expansível)
        const editInput = document.createElement('textarea');
        editInput.className = 'comment-edit-input';
        editInput.value = originalText;

        // Wrapper da edição com botão enviar (ícone por tema)
        const editWrap = document.createElement('div');
        editWrap.className = 'comment-edit-actions';
        editWrap.innerHTML = `
            <button class="btn-confirm-edit" type="button" data-comment-id="${commentId}" title="Enviar">
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
        editRow.appendChild(editInput);
        editRow.appendChild(editWrap);
        
        // Substitui o conteúdo
        contentElement.style.display = 'none';
        contentElement.parentNode.insertBefore(editRow, contentElement);

        // Marca edição ativa
        commentElement.dataset.editing = '1';
        if (optionsBtn) {
            optionsBtn.textContent = originalOptionsText || '⋯';
            optionsBtn.style.display = 'none';
        }
        document.addEventListener('mousedown', outsideCancelHandler, true);
        updateSendCommentIcons();
        
        editInput.focus();
        editInput.select();

        const autoGrow = () => {
            editInput.style.height = 'auto';
            editInput.style.height = `${editInput.scrollHeight}px`;
        };
        autoGrow();
        editInput.addEventListener('input', autoGrow);
        
        // Handler para confirmar
        editWrap.querySelector('.btn-confirm-edit').addEventListener('click', async () => {
            document.removeEventListener('mousedown', outsideCancelHandler, true);
            const newContent = editInput.value.trim();
            if (!newContent) {
                alert('O comentário não pode estar vazio.');
                return;
            }
            
            const postId = commentElement.closest('.post').dataset.postId;
            if (!postId) {
                alert('Erro: ID do post não encontrado.');
                return;
            }
            
            console.log('📝 Editando comentário:', { postId, commentId, newContent });
            
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newContent })
                });
                
                console.log('📥 Resposta do servidor:', { status: response.status, ok: response.ok });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
                    throw new Error(errorData.message || `Erro HTTP ${response.status}`);
                }
                
                const data = await response.json();
                console.log('📥 Dados recebidos:', data);
                
                if (data.success) {
                    contentElement.textContent = newContent;
                    contentElement.style.display = '';
                    editRow.remove();
                    commentElement.dataset.editing = '';
                    if (optionsBtn) {
                        optionsBtn.textContent = originalOptionsText || '⋯';
                        optionsBtn.style.display = '';
                    }
                } else {
                    throw new Error(data.message || 'Erro ao editar comentário');
                }
            } catch (error) {
                console.error('❌ Erro ao editar comentário:', error);
                alert('Erro ao editar comentário: ' + error.message);
                document.addEventListener('mousedown', outsideCancelHandler, true);
            }
        });

        // Enter para enviar (Shift+Enter para nova linha)
        editInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                editWrap.querySelector('.btn-confirm-edit')?.click();
            }
        });
    }

    // Handler para abrir/fechar menu de opções da resposta
    function handleReplyOptions(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const replyId = btn.dataset.replyId;
        const commentId = btn.dataset.commentId;
        
        // Tenta encontrar o menu de múltiplas formas
        let menu = document.querySelector(`.reply-options-menu[data-reply-id="${replyId}"]`);
        const replyElement = btn.closest('.reply');
        
        // Se não encontrou, tenta encontrar dentro do reply element
        if (!menu && replyElement) {
            menu = replyElement.querySelector('.reply-options-menu');
        }
        
        // Se ainda não encontrou, tenta encontrar no body (pode ter sido movido)
        if (!menu) {
            const menuInBody = document.querySelector(`.reply-options-menu[data-reply-id="${replyId}"][data-comment-id="${commentId}"]`);
            if (menuInBody) {
                menu = menuInBody;
            }
        }
        
        if (!menu) {
            console.error('❌ Menu de opções não encontrado para reply:', replyId);
            return;
        }
        
        // Verifica se deve aparecer acima ou ao lado
        if (replyElement && menu) {
            const isMobile = window.innerWidth <= 767;
            if (isMobile) {
                // Em telas menores, verifica se há espaço ao lado primeiro
                // A classe será aplicada/removida pela função adjustMenuPosition
                menu.classList.remove('comentario-multiplas-linhas'); // Remove primeiro, adjustMenuPosition decide
            } else {
                // Em telas maiores, só aplica se tiver múltiplas linhas
                if (checkCommentHasMultipleLines(replyElement)) {
                    menu.classList.add('comentario-multiplas-linhas');
                } else {
                    menu.classList.remove('comentario-multiplas-linhas');
                }
            }
        }
        
        // Fecha todos os outros menus
        document.querySelectorAll('.reply-options-menu').forEach(m => {
            if (m !== menu) {
                m.classList.add('oculto');
                // Retorna menu para o lugar original se estiver no body
                if (m.parentElement === document.body) {
                    const originalReply = document.querySelector(`.reply[data-reply-id="${m.dataset.replyId}"]`);
                    if (originalReply) {
                        const replyBody = originalReply.querySelector('.reply-body-container');
                        if (replyBody) {
                            replyBody.appendChild(m);
                        }
                    }
                }
            }
        });
        document.querySelectorAll('.comment-options-menu').forEach(m => {
            m.classList.add('oculto');
            // Retorna menu para o lugar original se estiver no body
            if (m.parentElement === document.body) {
                const originalComment = document.querySelector(`.comment[data-comment-id="${m.dataset.commentId}"]`);
                if (originalComment) {
                    const commentBody = originalComment.querySelector('.comment-body-container');
                    if (commentBody) {
                        commentBody.appendChild(m);
                    }
                }
            }
        });
        
        if (menu) {
            const wasHidden = menu.classList.contains('oculto');
            menu.classList.toggle('oculto');
            
            // Ajusta posicionamento após abrir
            if (!menu.classList.contains('oculto')) {
                // Garante que o menu esteja visível
                menu.classList.remove('oculto');
                menu.style.visibility = 'visible';
                menu.style.display = 'flex';
                
                // Não move para o body aqui - deixa adjustMenuPosition decidir
                requestAnimationFrame(() => {
                    adjustMenuPosition(menu, replyElement, btn);
                });
            } else {
                // Se está fechando, retorna para o lugar original
                if (menu.parentElement === document.body) {
                    const originalReply = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
                    if (originalReply) {
                        const replyBody = originalReply.querySelector('.reply-body-container');
                        if (replyBody) {
                            replyBody.appendChild(menu);
                        }
                    }
                }
            }
        } else {
            console.warn('⚠️ Menu de opções não encontrado para reply:', replyId);
        }
    }

    // Handler para editar resposta
    function handleEditReply(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
        
        if (!replyElement) {
            console.error('❌ Resposta não encontrada:', replyId);
            return;
        }
        
        // Verifica se já existe uma caixa de edição ativa
        const existingEditInput = replyElement.querySelector('.reply-edit-input');
        if (existingEditInput) {
            // Se já existe, apenas foca nela
            existingEditInput.focus();
            existingEditInput.select();
            return;
        }
        
        const contentElement = replyElement.querySelector('.reply-content');
        if (!contentElement) {
            console.error('❌ Elemento de conteúdo não encontrado na resposta:', replyId);
            return;
        }
        
        const originalText = contentElement.textContent;
        
        // Fecha o menu
        const menu = replyElement.querySelector('.reply-options-menu');
        if (menu) menu.classList.add('oculto');
        
        // Cria textarea de edição (auto-expansível)
        const editInput = document.createElement('textarea');
        editInput.className = 'reply-edit-input';
        editInput.value = originalText;

        const optionsBtn = replyElement.querySelector('.btn-reply-options');
        const originalOptionsText = optionsBtn ? optionsBtn.textContent : null;
        const cancelEditViaX = () => {
            contentElement.style.display = '';
            editRow.remove();
            replyElement.dataset.editing = '';
            if (optionsBtn) {
                optionsBtn.textContent = originalOptionsText || '⋯';
                optionsBtn.style.display = '';
            }
            document.removeEventListener('mousedown', outsideCancelHandler, true);
        };
        const outsideCancelHandler = (ev) => {
            if (replyElement.dataset.editing !== '1') return;
            if (editRow.contains(ev.target)) return;
            cancelEditViaX();
        };

        const editWrap = document.createElement('div');
        editWrap.className = 'reply-edit-actions';
        editWrap.innerHTML = `
            <button class="btn-confirm-edit-reply" type="button" data-comment-id="${commentId}" data-reply-id="${replyId}" title="Enviar">
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
        editRow.appendChild(editInput);
        editRow.appendChild(editWrap);
        
        // Substitui o conteúdo
        contentElement.style.display = 'none';
        contentElement.parentNode.insertBefore(editRow, contentElement);

        replyElement.dataset.editing = '1';
        if (optionsBtn) {
            optionsBtn.textContent = originalOptionsText || '⋯';
            optionsBtn.style.display = 'none';
        }
        document.addEventListener('mousedown', outsideCancelHandler, true);
        updateSendCommentIcons();
        
        editInput.focus();
        editInput.select();

        const autoGrow = () => {
            editInput.style.height = 'auto';
            editInput.style.height = `${editInput.scrollHeight}px`;
        };
        autoGrow();
        editInput.addEventListener('input', autoGrow);
        
        // Handler para confirmar
        editWrap.querySelector('.btn-confirm-edit-reply').addEventListener('click', async () => {
            document.removeEventListener('mousedown', outsideCancelHandler, true);
            const newContent = editInput.value.trim();
            if (!newContent) {
                alert('A resposta não pode estar vazia.');
                return;
            }
            
            const postId = replyElement.closest('.post').dataset.postId;
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ content: newContent })
                });
                const data = await response.json();
                
                if (data.success) {
                    contentElement.textContent = newContent;
                    contentElement.style.display = '';
                    editRow.remove();
                    replyElement.dataset.editing = '';
                    if (optionsBtn) {
                        optionsBtn.textContent = originalOptionsText || '⋯';
                        optionsBtn.style.display = '';
                    }
                } else {
                    throw new Error(data.message || 'Erro ao editar resposta');
                }
            } catch (error) {
                console.error('Erro ao editar resposta:', error);
                alert('Erro ao editar resposta: ' + error.message);
                document.addEventListener('mousedown', outsideCancelHandler, true);
            }
        });

        editInput.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                editWrap.querySelector('.btn-confirm-edit-reply')?.click();
            }
        });
    }

    // Função auxiliar para mostrar popup de confirmação pequeno
    function showDeleteConfirmPopup(btn, onConfirm, clickEvent = null) {
        // Remove popup existente se houver
        const existingPopup = document.querySelector('.delete-confirm-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Cria o popup
        const popup = document.createElement('div');
        popup.className = 'delete-confirm-popup';
        popup.innerHTML = `
            <div class="delete-confirm-text">Tem certeza?</div>
            <div class="delete-confirm-buttons">
                <button class="btn-confirm-yes">Sim</button>
                <button class="btn-confirm-no">Não</button>
            </div>
        `;

        // Adiciona ao body primeiro para poder calcular dimensões
        document.body.appendChild(popup);
        
        // Guarda a posição do clique do mouse como fallback
        let clickX = clickEvent ? clickEvent.clientX : null;
        let clickY = clickEvent ? clickEvent.clientY : null;

        // Usa duplo requestAnimationFrame para garantir que o DOM esteja totalmente renderizado
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // SEMPRE tenta encontrar o botão no DOM original primeiro (não no body)
                // Isso garante que temos as coordenadas corretas mesmo quando o menu está no body
                const commentId = btn.dataset.commentId;
                const replyId = btn.dataset.replyId;
                
                let actualBtn = null;
                
                // Tenta encontrar o botão no DOM original
                if (commentId) {
                    const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                    if (commentElement) {
                        actualBtn = commentElement.querySelector('.btn-delete-comment');
                    }
                } else if (replyId) {
                    const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
                    if (replyElement) {
                        actualBtn = replyElement.querySelector('.btn-delete-reply');
                    }
                }
                
                // Se não encontrou no DOM original, usa o botão clicado
                if (!actualBtn) {
                    actualBtn = btn;
                }
                
                // Âncora do popup (usa viewport coords). Não mutar DOMRect (read-only).
                const rect = actualBtn.getBoundingClientRect();
                let anchorRect = {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    right: rect.right,
                    bottom: rect.bottom
                };
                
                // Obtém o menu de opções que contém o botão (se ainda existir no DOM)
                // Tenta encontrar o menu no DOM original primeiro
                let menu = null;
                if (commentId) {
                    const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                    if (commentElement) {
                        menu = commentElement.querySelector('.comment-options-menu');
                    }
                } else if (replyId) {
                    const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
                    if (replyElement) {
                        menu = replyElement.querySelector('.reply-options-menu');
                    }
                }
                
                // Se não encontrou no DOM original, tenta pelo botão ou no body
                if (!menu) {
                    menu = actualBtn.closest('.comment-options-menu') || actualBtn.closest('.reply-options-menu');
                }
                
                // Se ainda não encontrou, tenta encontrar no body (pode ter sido movido)
                if (!menu) {
                    if (commentId) {
                        const menuInBody = document.querySelector(`.comment-options-menu[data-comment-id="${commentId}"]`);
                        if (menuInBody && !menuInBody.classList.contains('oculto')) {
                            menu = menuInBody;
                        }
                    } else if (replyId) {
                        const menuInBody = document.querySelector(`.reply-options-menu[data-reply-id="${replyId}"]`);
                        if (menuInBody && !menuInBody.classList.contains('oculto')) {
                            menu = menuInBody;
                        }
                    }
                }
                
                // Se ainda não encontrou, procura todos os menus visíveis no body
                if (!menu) {
                    const allMenus = document.querySelectorAll('.comment-options-menu:not(.oculto), .reply-options-menu:not(.oculto)');
                    if (allMenus.length > 0) {
                        // Pega o último menu visível (provavelmente o que foi clicado)
                        menu = allMenus[allMenus.length - 1];
                    }
                }
                
                // SEMPRE tenta usar o menu como referência primeiro (ele está visível quando o usuário clica)
                if (menu && !menu.classList.contains('oculto')) {
                    const menuRect = menu.getBoundingClientRect();
                    if (menuRect.width > 0 && menuRect.height > 0) {
                        // O menu contém 2 botões: lápis (✏️) e lixeira (🗑️)
                        // Gap entre botões: 12px
                        // Cada botão tem aproximadamente 20px de largura
                        // A lixeira está no final (direita) do menu
                        const buttonWidth = 20;
                        const gap = 12;
                        
                        // Calcula onde está o botão de lixeira dentro do menu
                        anchorRect = {
                            left: menuRect.right - buttonWidth,
                            top: menuRect.top,
                            width: buttonWidth,
                            height: menuRect.height,
                            right: (menuRect.right - buttonWidth) + buttonWidth,
                            bottom: menuRect.top + menuRect.height
                        };
                        console.log('✅ Usando menu visível como referência:', { menuRect, anchorRect });
                    }
                }
                
                // Se o menu não foi encontrado ou não está visível, verifica se o botão tem dimensões válidas
                if ((anchorRect.width === 0 && anchorRect.height === 0) || (anchorRect.left === 0 && anchorRect.top === 0)) {
                    console.warn('⚠️ Botão não tem dimensões válidas, tentando alternativas');
                    
                    // Se ainda não tem dimensões válidas, usa a posição do clique do mouse
                    if (clickX !== null && clickY !== null) {
                        anchorRect = {
                            left: clickX - 10,
                            top: clickY - 10,
                            width: 20,
                            height: 20,
                            right: (clickX - 10) + 20,
                            bottom: (clickY - 10) + 20
                        };
                        console.log('✅ Usando posição do clique como referência:', anchorRect);
                    } else {
                        console.warn('⚠️ Sem coordenadas válidas, usando posição padrão');
                    }
                }
                
                // Usa o botão diretamente para posicionamento mais preciso
                const popupRect = popup.getBoundingClientRect();
                const isMobile = window.innerWidth <= 767;
                
                let left, top;
                
                // Debug: verifica se as coordenadas são válidas
                if (anchorRect.left === 0 && anchorRect.top === 0 && anchorRect.width === 0 && anchorRect.height === 0) {
                    console.warn('⚠️ Coordenadas do botão inválidas, usando posição do clique ou padrão');
                    // Tenta usar a posição do clique primeiro
                    if (clickX !== null && clickY !== null) {
                        left = clickX;
                        top = clickY + 30; // Abaixo do clique
                    } else {
                        // Posição padrão: centro da tela
                        left = (window.innerWidth - popupRect.width) / 2;
                        top = (window.innerHeight - popupRect.height) / 2;
                    }
                } else {
                    if (isMobile) {
                        // Em telas menores: popup embaixo do botão, centralizado horizontalmente
                        left = anchorRect.left + (anchorRect.width / 2) - (popupRect.width / 2);
                        top = anchorRect.bottom + 8;
                        
                        // Ajusta se o popup sair da tela à direita
                        if (left + popupRect.width > window.innerWidth - 8) {
                            left = window.innerWidth - popupRect.width - 8;
                        }
                        
                        // Garante que não saia da tela à esquerda
                        if (left < 8) {
                            left = 8;
                        }
                    } else {
                        // Em telas maiores: ao lado direito do botão de lixeira, alinhado verticalmente
                        left = anchorRect.right + 8;
                        top = anchorRect.top + (anchorRect.height / 2) - (popupRect.height / 2);
                        
                        // Ajusta se o popup sair da tela à direita
                        if (left + popupRect.width > window.innerWidth - 8) {
                            left = anchorRect.left - popupRect.width - 8;
                        }
                        
                        // Garante que não saia da tela à esquerda
                        if (left < 8) {
                            left = 8;
                        }
                    }
                    
                    // Ajusta se o popup sair da tela embaixo
                    if (top + popupRect.height > window.innerHeight - 8) {
                        top = window.innerHeight - popupRect.height - 8;
                    }
                    
                    // Ajusta se o popup sair da tela em cima (considerando header)
                    const headerHeight = 70; // Altura aproximada do header
                    if (top < headerHeight + 8) {
                        // Se não couber acima, coloca abaixo do botão
                        top = anchorRect.bottom + 8;
                    }
                }

                // Aplica posicionamento (fixed usa coordenadas da viewport)
                popup.style.position = 'fixed';
                popup.style.top = `${top}px`;
                popup.style.left = `${left}px`;
                popup.style.zIndex = '10001';
                
                // Agora fecha o menu após calcular a posição
                if (menu && !menu.classList.contains('oculto')) {
                    menu.classList.add('oculto');
                }
                
                // Event listeners (adicionados após posicionamento)
                const btnYes = popup.querySelector('.btn-confirm-yes');
                const btnNo = popup.querySelector('.btn-confirm-no');

                btnYes.addEventListener('click', () => {
                    popup.remove();
                    onConfirm();
                });

                btnNo.addEventListener('click', () => {
                    popup.remove();
                });

                // Fecha ao clicar fora
                setTimeout(() => {
                    document.addEventListener('click', function closePopup(e) {
                        if (!popup.contains(e.target) && e.target !== btn && !btn.closest('.comment-options-menu')?.contains(e.target) && !btn.closest('.reply-options-menu')?.contains(e.target)) {
                            popup.remove();
                            document.removeEventListener('click', closePopup);
                        }
                    });
                }, 10);
            });
        });
    }

    async function handleDeleteComment(e) {
        if (e && e.__handledDelete) return;
        if (e) e.__handledDelete = true;
        e.stopPropagation();
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        
        // Encontra o post de forma mais robusta
        let postElement = btn.closest('.post');
        if (!postElement) {
            // Se o botão estiver no body, tenta encontrar pelo comentário
            const commentElement = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
            if (commentElement) {
                postElement = commentElement.closest('.post');
            }
        }
        
        if (!postElement) {
            console.error('❌ Post não encontrado para o comentário:', commentId);
            alert('Erro: Não foi possível encontrar o post.');
            return;
        }
        
        const postId = postElement.dataset.postId;
        const userId = localStorage.getItem('userId');

        // NÃO fecha o menu ainda - deixa showDeleteConfirmPopup usar como referência
        // O menu será fechado dentro de showDeleteConfirmPopup após calcular a posição

        // Mostra popup de confirmação pequeno (passa o evento para ter a posição do clique)
        showDeleteConfirmPopup(btn, async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                
                console.log('📥 Resposta do servidor:', {
                    status: response.status,
                    success: data.success,
                    message: data.message
                });
                
                if (data.success) {
                    const removed = postElement.querySelector(`.comment[data-comment-id="${commentId}"]`) || btn.closest('.comment');
                    if (removed) removed.remove(); // Remove o comentário do DOM

                    // Atualiza o contador no botão de comentários
                    const btnComment = postElement.querySelector('.btn-comment');
                    if (btnComment) {
                        const count = postElement.querySelectorAll('.comment').length;
                        btnComment.innerHTML = `<i class="fas fa-comment"></i> ${count} Comentários`;
                    }

                    // Ajusta o "Carregar mais" se existir
                    const loadMoreBtn = postElement.querySelector('.load-more-comments');
                    if (loadMoreBtn) {
                        const count = postElement.querySelectorAll('.comment').length;
                        loadMoreBtn.dataset.total = String(count);
                        const hiddenCount = postElement.querySelectorAll('.comment-hidden').length;
                        if (hiddenCount <= 0) loadMoreBtn.remove();
                    }
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('❌ Erro ao deletar comentário:', error);
                alert('Erro: ' + error.message);
            }
        }, e);
    }

    async function handleDeleteReply(e) {
        if (e && e.__handledDelete) return;
        if (e) e.__handledDelete = true;
        e.stopPropagation();
        const btn = e.currentTarget;
        const commentId = btn.dataset.commentId;
        const replyId = btn.dataset.replyId;
        
        // Encontra o post de forma mais robusta
        let postElement = btn.closest('.post');
        if (!postElement) {
            // Se o botão estiver no body, tenta encontrar pela resposta
            const replyElement = document.querySelector(`.reply[data-reply-id="${replyId}"]`);
            if (replyElement) {
                postElement = replyElement.closest('.post');
            }
        }
        
        if (!postElement) {
            console.error('❌ Post não encontrado para a resposta:', replyId);
            alert('Erro: Não foi possível encontrar o post.');
            return;
        }
        
        const postId = postElement.dataset.postId;
        const userId = localStorage.getItem('userId');

        // NÃO fecha o menu ainda - deixa showDeleteConfirmPopup usar como referência
        // O menu será fechado dentro de showDeleteConfirmPopup após calcular a posição

        // Mostra popup de confirmação pequeno (passa o evento para ter a posição do clique)
        showDeleteConfirmPopup(btn, async () => {
            try {
                const response = await fetch(`/api/posts/${postId}/comments/${commentId}/replies/${replyId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();

                console.log('📥 Resposta do servidor:', {
                    status: response.status,
                    success: data.success,
                    message: data.message
                });

                if (data.success) {
                    const replyEl = postElement.querySelector(`.reply[data-reply-id="${replyId}"]`) || btn.closest('.reply');
                    if (replyEl) replyEl.remove(); // Remove a resposta do DOM

                    // Atualiza o botão "Ver X Respostas" (se não tem mais respostas, remove)
                    const commentElement = postElement.querySelector(`.comment[data-comment-id="${commentId}"]`) || document.querySelector(`.comment[data-comment-id="${commentId}"]`);
                    syncRepliesUI(commentElement);
                } else {
                    throw new Error(data.message);
                }
            } catch (error) {
                console.error('❌ Erro ao deletar resposta:', error);
                alert('Erro: ' + error.message);
            }
        }, e);
    }

    // --- NAVEGAÇÃO DO HEADER ---
    // Navegação para o perfil: botão (quando existir) e avatar
    if (profileButton) {
        profileButton.addEventListener('click', () => {
            navigateToProfile(userId);
        });
    }

    // Event delegation: garante que a lixeira funcione mesmo se o menu for movido para o body
    document.addEventListener('click', (ev) => {
        const deleteCommentBtn = ev.target && ev.target.closest ? ev.target.closest('.btn-delete-comment') : null;
        if (deleteCommentBtn) {
            handleDeleteComment({
                __handledDelete: false,
                stopPropagation: () => ev.stopPropagation(),
                preventDefault: () => ev.preventDefault(),
                currentTarget: deleteCommentBtn,
                clientX: ev.clientX,
                clientY: ev.clientY,
                target: ev.target
            });
            return;
        }

        const deleteReplyBtn = ev.target && ev.target.closest ? ev.target.closest('.btn-delete-reply') : null;
        if (deleteReplyBtn) {
            handleDeleteReply({
                __handledDelete: false,
                stopPropagation: () => ev.stopPropagation(),
                preventDefault: () => ev.preventDefault(),
                currentTarget: deleteReplyBtn,
                clientX: ev.clientX,
                clientY: ev.clientY,
                target: ev.target
            });
        }
    }, true);
    if (userAvatarHeader) {
        userAvatarHeader.style.cursor = 'pointer';
        userAvatarHeader.addEventListener('click', () => {
            navigateToProfile(userId);
        });
    }

    // Nome do usuário no cabeçalho também leva para o próprio perfil
    if (userNameHeader) {
        userNameHeader.style.cursor = 'pointer';
        userNameHeader.addEventListener('click', () => {
            navigateToProfile(userId);
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logoutConfirmModal && logoutConfirmModal.classList.remove('hidden');
        });
    }
    if (confirmLogoutYesBtn) {
        confirmLogoutYesBtn.addEventListener('click', () => {
            // Fecha todos os modais antes de fazer logout
            const modalPropostas = document.getElementById('modal-propostas');
            if (modalPropostas) {
                modalPropostas.classList.add('hidden');
            }
            // Preserva a informação se este dispositivo já fez login alguma vez
            const jaLogou = localStorage.getItem('helpy-ja-logou');
            localStorage.clear();
            if (jaLogou) {
                localStorage.setItem('helpy-ja-logou', jaLogou);
            }
            // Usa replace para evitar que o usuário volte para o feed com o botão "voltar"
            window.location.replace('/login');
        });
    }
    if (confirmLogoutNoBtn) {
        confirmLogoutNoBtn.addEventListener('click', () => {
            logoutConfirmModal && logoutConfirmModal.classList.add('hidden');
        });
    }

    // ----------------------------------------------------------------------
    // 🆕 NOVO: FUNCIONALIDADES "PRECISO AGORA!" - Profissionais Próximos
    // ----------------------------------------------------------------------
    // Disponível para todos os usuários (clientes e profissionais podem precisar de outros profissionais)
    const btnPrecisoAgora = document.getElementById('btn-preciso-agora');
    const modalPrecisoAgora = document.getElementById('modal-preciso-agora');
    const profissionaisProximos = document.getElementById('profissionais-proximos');
    const btnBuscarProximos = document.getElementById('btn-buscar-proximos');
    const filtroTipoServico = document.getElementById('filtro-tipo-servico');

    if (btnPrecisoAgora) {
        btnPrecisoAgora.addEventListener('click', async () => {
            if (!navigator.geolocation) {
                alert('Seu navegador não suporta geolocalização.');
                return;
            }

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            modalPrecisoAgora?.classList.remove('hidden');
            profissionaisProximos.innerHTML = '<p>Obtendo sua localização...</p>';

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // Atualiza localização do usuário no servidor
                    try {
                        await fetch('/api/user/localizacao', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ latitude, longitude })
                        });
                    } catch (error) {
                        console.error('Erro ao atualizar localização:', error);
                    }

                    // Busca profissionais próximos
                    await buscarProfissionaisProximos(latitude, longitude);
                },
                (error) => {
                    profissionaisProximos.innerHTML = `<p class="erro">Erro ao obter localização: ${error.message}</p>`;
                }
            );
        });
    }

    async function buscarProfissionaisProximos(latitude, longitude, tipoServico = null) {
        if (!profissionaisProximos) return;
        
        profissionaisProximos.innerHTML = '<p>Buscando profissionais...</p>';
        
        try {
            const response = await fetch('/api/preciso-agora', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ latitude, longitude, tipoServico, raioKm: 10 })
            });

            const data = await response.json();
            
            if (data.success && data.profissionais.length > 0) {
                profissionaisProximos.innerHTML = data.profissionais.map(prof => {
                    const temSelo = prof.gamificacao?.temSeloQualidade || false;
                    const nivelReputacao = prof.gamificacao?.nivelReputacao || 'iniciante';
                    const nivel = prof.gamificacao?.nivel || 1;
                    const perfilUrl = `/perfil?id=${prof._id}`;
                    
                    return `
                    <div class="profissional-card ${temSelo ? 'com-selo' : ''}">
                        <a href="${perfilUrl}" class="profissional-avatar-link">
                            <img src="${prof.foto || prof.avatarUrl || 'imagens/default-user.png'}" alt="${prof.nome}" class="profissional-avatar">
                        </a>
                        <div class="profissional-info">
                            <h4>
                                <a href="${perfilUrl}" class="profissional-nome-link">
                                    ${prof.nome}
                                </a>
                                ${temSelo ? '<span class="selo-qualidade" title="Selo de Qualidade Helpy">🛡️</span>' : ''}
                                ${nivelReputacao === 'mestre' ? '<span class="badge-mestre" title="Mestre Helpy">👑</span>' : ''}
                            </h4>
                            <p><i class="fas fa-briefcase"></i> ${prof.atuacao || 'Profissional'}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${prof.cidade || ''}${prof.estado ? ', ' + prof.estado : ''}</p>
                            <p><i class="fas fa-star"></i> ${prof.mediaAvaliacao?.toFixed(1) || '0.0'} (${prof.totalAvaliacoes || 0} avaliações)</p>
                            <p><i class="fas fa-trophy"></i> Nível ${nivel} - ${nivelReputacao === 'mestre' ? 'Mestre' : nivelReputacao === 'validado' ? 'Validado' : 'Iniciante'}</p>
                            <p class="distancia-info">
                                <i class="fas fa-route"></i> ${prof.distancia} km &bull; 
                                <i class="fas fa-clock"></i> ~${prof.tempoEstimado} min
                            </p>
                            ${prof.telefone ? `<a href="https://wa.me/55${prof.telefone.replace(/\D/g, '')}" target="_blank" class="btn-contatar"><i class="fab fa-whatsapp"></i> Contatar</a>` : ''}
                        </div>
                    </div>
                `;
                }).join('');
            } else {
                profissionaisProximos.innerHTML = '<p class="mensagem-vazia">Nenhum profissional disponível próximo a você no momento.</p>';
            }
        } catch (error) {
            console.error('Erro ao buscar profissionais:', error);
            profissionaisProximos.innerHTML = '<p class="erro">Erro ao buscar profissionais. Tente novamente.</p>';
        }
    }

    if (btnBuscarProximos && filtroTipoServico) {
        btnBuscarProximos.addEventListener('click', async () => {
            if (!navigator.geolocation) return;
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const tipoServico = filtroTipoServico.value.trim() || null;
                    await buscarProfissionaisProximos(latitude, longitude, tipoServico);
                },
                (error) => {
                    alert('Erro ao obter localização: ' + error.message);
                }
            );
        });
    }


    // ----------------------------------------------------------------------
    // 🆕 NOVO: FUNCIONALIDADES EQUIPE
    // ----------------------------------------------------------------------
    const btnCriarTime = document.getElementById('btn-criar-time');
    const modalCriarTime = document.getElementById('modal-criar-time');
    const formCriarTime = document.getElementById('form-criar-time');
    const timesContainer = document.getElementById('times-container');
    const profissionaisLista = document.getElementById('profissionais-lista');

    // Carregar times locais
    async function carregarTimesLocais() {
        if (!timesContainer) return;
        
        try {
            // Força recarregamento sem cache para pegar a cidade atualizada
            const user = await fetch(`/api/usuario/${userId}?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            }).then(r => r.json());
            
            const cidade = user.cidade || '';
            
            // Busca times da cidade
            const responseCidade = await fetch(`/api/times-projeto?cidade=${encodeURIComponent(cidade)}&status=aberto&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            const dataCidade = await responseCidade.json();
            
            // Busca também todos os times abertos (sem filtro de cidade) para encontrar os times do criador
            // Isso garante que o criador sempre veja seus próprios times, mesmo que não estejam na mesma cidade
            const responseTodosTimes = await fetch(`/api/times-projeto?status=aberto&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            const dataTodosTimes = await responseTodosTimes.json();
            
            // Combina os resultados
            const timesCidade = dataCidade.success ? dataCidade.times : [];
            const todosTimes = dataTodosTimes.success ? dataTodosTimes.times : [];
            
            // Filtra apenas os times criados pelo usuário atual
            const meusTimes = todosTimes.filter(time => {
                const criadorId = time.clienteId?._id?.toString() || time.clienteId?.toString() || time.clienteId;
                const userIdStr = userId?.toString();
                return criadorId === userIdStr;
            });
            
            // Combina os arrays e remove duplicatas baseado no _id
            const timesMap = new Map();
            [...timesCidade, ...meusTimes].forEach(time => {
                if (time._id) {
                    timesMap.set(time._id.toString(), time);
                }
            });
            
            // Ordena por data de criação (mais recentes primeiro)
            const timesUnicos = Array.from(timesMap.values());
            timesUnicos.sort((a, b) => {
                const dateA = new Date(a.createdAt || a._id.getTimestamp?.() || 0);
                const dateB = new Date(b.createdAt || b._id.getTimestamp?.() || 0);
                return dateB - dateA;
            });
            
            const data = {
                success: true,
                times: timesUnicos
            };
            
            if (data.success && data.times.length > 0) {
                timesContainer.innerHTML = data.times.map(time => `
                    <div class="time-card">
                        ${time.clienteId ? (() => {
                            const criador = time.clienteId;
                            const fotoCriador = criador?.foto || criador?.avatarUrl || 'imagens/default-user.png';
                            const nomeCriador = criador?.nome || 'Cliente';
                            const criadorId = criador?._id || criador?.id || time.clienteId;
                            const isCriador = (criadorId?.toString() === userId?.toString()) || (time.clienteId?.toString() === userId?.toString());
                            return `
                                <div class="time-criador-topo">
                                    <a href="/perfil.html?id=${criadorId}" class="criador-time-link">
                                        <img src="${fotoCriador}" alt="${nomeCriador}" class="criador-time-foto" onerror="this.src='imagens/default-user.png'">
                                        <span class="criador-time-nome">${nomeCriador}</span>
                                    </a>
                                    ${isCriador ? `
                                        <button class="btn-deletar-time" data-time-id="${time._id}" title="Deletar time">
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        })() : ''}
                        <div class="time-header">
                            <h3>${time.titulo}</h3>
                            <span class="time-status status-${time.status}">${time.status.replace('_', ' ')}</span>
                        </div>
                        <p class="time-descricao">${time.descricao}</p>
                        <p class="time-localizacao">
                            <i class="fas fa-map-marker-alt"></i> ${(() => {
                                const endereco = [];
                                if (time.localizacao.rua) endereco.push(time.localizacao.rua);
                                if (time.localizacao.numero) endereco.push(`Nº ${time.localizacao.numero}`);
                                if (time.localizacao.bairro) endereco.push(time.localizacao.bairro);
                                if (time.localizacao.cidade) endereco.push(time.localizacao.cidade);
                                if (time.localizacao.estado) endereco.push(time.localizacao.estado);
                                return endereco.length > 0 ? endereco.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()}
                        </p>
                        <div class="time-profissionais">
                            <strong>Profissionais necessários:</strong>
                            <ul>
                                ${time.profissionaisNecessarios.map(p => {
                                    // Verifica se está marcado como "A Combinar" ou se não tem valor (para compatibilidade com dados antigos)
                                    const valorBaseNum = p.valorBase !== null && p.valorBase !== undefined && !isNaN(parseFloat(p.valorBase)) && parseFloat(p.valorBase) > 0 ? parseFloat(p.valorBase) : null;
                                    const aCombinar = p.aCombinar === true || valorBaseNum === null;
                                    const valorTexto = aCombinar ? 'A Combinar' : `R$ ${valorBaseNum.toFixed(2)}/dia`;
                                    return `<li>${p.quantidade}x ${p.tipo} - ${valorTexto}</li>`;
                                }).join('')}
                            </ul>
                        </div>
                        <div class="time-candidatos">
                            ${(() => {
                                const candidatosPendentes = (time.candidatos || []).filter(c => c.status === 'pendente');
                                const totalCandidatos = candidatosPendentes.length;
                                return `
                                    <strong>Candidatos: ${totalCandidatos}</strong>
                                    ${((time.clienteId?._id === userId || time.clienteId === userId) && totalCandidatos > 0) ? `
                                        <button class="btn-ver-candidatos" data-time-id="${time._id}" title="Ver candidatos">
                                            <i class="fas fa-eye"></i>
                            </button>
                        ` : ''}
                                `;
                            })()}
                        </div>
                        ${(userType === 'usuario' || userType === 'empresa') ? (() => {
                            const jaCandidatou = time.candidatos?.some(c => 
                                (c.profissionalId?._id === userId || c.profissionalId === userId) && c.status === 'pendente'
                            );
                            return jaCandidatou ? `
                                <button class="btn-candidatar candidatado" data-time-id="${time._id}" data-ja-candidatou="true">
                                    <i class="fas fa-briefcase"></i> 
                                    <span class="btn-candidatar-text">Candidatado</span>
                                </button>
                            ` : `
                                <div class="time-acoes-candidatar">
                                    ${time.profissionaisNecessarios.map((prof, index) => {
                                        const aCombinar = prof.aCombinar || !prof.valorBase;
                                        const valorBase = prof.valorBase || 0;
                                        const valorTexto = aCombinar ? 'A Combinar' : `R$ ${valorBase.toFixed(2)}/dia`;
                                        return `
                                            <div class="profissional-candidatura-item">
                                                <div class="profissional-candidatura-linha">
                                                    <span class="profissional-candidatura-tipo">${prof.tipo} (${prof.quantidade}x) - ${valorTexto}</span>
                                                    <button class="btn-candidatar-profissional" data-time-id="${time._id}" data-tipo="${prof.tipo}" data-valor-base="${valorBase}" data-a-combinar="${aCombinar}">
                                                        <span class="btn-candidatar-texto">Candidatar-se</span>
                                                        <i class="fas fa-hand-paper"></i>
                                                    </button>
                                                </div>
                                                ${index < time.profissionaisNecessarios.length - 1 ? '<hr class="profissional-separador">' : ''}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            `;
                        })() : ''}
                    </div>
                `).join('');
                
                // Adiciona listeners aos botões de candidatar-se
                document.querySelectorAll('.btn-candidatar-profissional').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const tipo = e.currentTarget.dataset.tipo;
                        const aCombinar = e.currentTarget.dataset.aCombinar === 'true';
                        const valorBase = aCombinar ? null : parseFloat(e.currentTarget.dataset.valorBase || 0);
                        await mostrarModalEscolhaCandidatura(timeId, tipo, valorBase, aCombinar, btn);
                    });
                });
                
                // Adiciona listeners aos botões de candidatura (para cancelar)
                document.querySelectorAll('.btn-candidatar.candidatado').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const confirmar = await mostrarConfirmacaoCancelar(btn);
                        if (confirmar) {
                            await cancelarCandidatura(timeId, btn);
                        }
                    });
                });
                
                // Adiciona listeners aos botões de deletar time
                document.querySelectorAll('.btn-deletar-time').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        
                        const confirmar = await mostrarConfirmacaoDeletarTime(btn, timeId);
                        if (confirmar) {
                            await deletarTime(timeId);
                        }
                    });
                });
                
                // Adiciona listeners aos botões de ver candidatos
                document.querySelectorAll('.btn-ver-candidatos').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const timeId = e.currentTarget.dataset.timeId;
                        const time = data.times.find(t => t._id === timeId);
                        if (time) {
                            mostrarCandidatosTime(time, btn);
                        }
                    });
                });
            } else {
                timesContainer.innerHTML = '<p class="mensagem-vazia">Nenhuma equipe aberta na sua cidade no momento.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar equipes:', error);
            timesContainer.innerHTML = '<p class="erro">Erro ao carregar equipes.</p>';
        }
    }


    // Função para mostrar modal de equipes concluídas (popup próximo ao botão)
    async function mostrarEquipesConcluidas(botao) {
        // Remove popup anterior se existir
        const popupAnterior = document.querySelector('.popup-equipes-concluidas');
        if (popupAnterior) {
            popupAnterior.remove();
        }

        // Carrega dados primeiro
        const token = localStorage.getItem('jwtToken');
        if (!token) return;

        let equipesData = [];
        try {
            const user = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(r => r.json());

            const cidade = user.cidade || '';
            const response = await fetch(`/api/times-projeto?cidade=${encodeURIComponent(cidade)}&status=concluido&t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });

            const data = await response.json();
            if (data.success) {
                equipesData = data.times || [];
            }
        } catch (error) {
            console.error('Erro ao carregar equipes concluídas:', error);
        }

        // Cria o popup
        const popup = document.createElement('div');
        popup.className = 'popup-equipes-concluidas';

        // Variáveis para modo de seleção (escopo da função)
        let modoSelecaoEquipes = false;
        let equipesSelecionadas = new Set();
        
        if (equipesData.length > 0) {
            listaHTML = equipesData.map(time => {
                const candidatosAceitos = (time.candidatos || []).filter(c => c.status === 'aceito');
                const timeId = time._id?.toString() || time._id;
                
                return `
                    <div class="equipe-concluida-item" data-time-id="${timeId}">
                        <div class="equipe-concluida-header">
                            <h5>${time.titulo}</h5>
                        </div>
                        <p class="equipe-localizacao">
                            <i class="fas fa-map-marker-alt"></i> ${(() => {
                                const endereco = [];
                                if (time.localizacao.rua) endereco.push(time.localizacao.rua);
                                if (time.localizacao.numero) endereco.push(`Nº ${time.localizacao.numero}`);
                                if (time.localizacao.bairro) endereco.push(time.localizacao.bairro);
                                if (time.localizacao.cidade) endereco.push(time.localizacao.cidade);
                                if (time.localizacao.estado) endereco.push(time.localizacao.estado);
                                return endereco.length > 0 ? endereco.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()}
                        </p>
                        <div class="equipe-profissionais-aceitos">
                            ${candidatosAceitos.map(candidato => {
                                const prof = candidato.profissionalId || {};
                                const fotoProf = prof?.foto || prof?.avatarUrl || 'imagens/default-user.png';
                                const nomeProf = prof?.nome || 'Profissional';
                                const profId = prof?._id || prof?.id || candidato.profissionalId;
                                const valor = candidato.valor || 0;
                                const tipo = candidato.tipo || 'Profissional';
                                
                                return `
                                    <div class="profissional-aceito-item">
                                        <a href="/perfil.html?id=${profId}" class="profissional-aceito-link">
                                            <img src="${fotoProf}" alt="${nomeProf}" class="profissional-aceito-foto" onerror="this.src='imagens/default-user.png'">
                                            <div class="profissional-aceito-info">
                                                <span class="profissional-aceito-nome">${nomeProf}</span>
                                                <span class="profissional-aceito-tipo">${tipo}</span>
                                                <span class="profissional-aceito-valor">R$ ${valor.toFixed(2).replace('.', ',')}/dia</span>
                                            </div>
                                        </a>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            listaHTML = '<p class="mensagem-vazia-popup">Nenhuma equipe concluída no momento.</p>';
        }

        popup.innerHTML = `
            <div class="popup-equipes-concluidas-content">
                <div class="popup-equipes-concluidas-header">
                    <h4>Equipes Concluídas</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="btn-lixeira-equipes" title="Deletar equipes" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 16px; padding: 5px; border-radius: 4px; transition: all 0.2s;">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn-fechar-popup-equipes">&times;</button>
                    </div>
                </div>
                <div id="selecionar-tudo-equipes-container" style="display: none; margin-bottom: 10px; padding: 0 12px;">
                    <button id="btn-selecionar-tudo-equipes" class="btn-secondary" style="padding: 6px 12px; font-size: 14px;">
                        Selecionar tudo
                    </button>
                    <span id="mensagem-selecionar-primeiro-equipes" style="display: none; margin-left: 10px; color: #ff6b6b; font-size: 12px;">Primeiro selecione!</span>
                </div>
                <div class="popup-equipes-concluidas-body">
                    ${listaHTML}
                </div>
            </div>
        `;

        // Posiciona o popup similar ao modal de deletar (lixeira)
        const botaoRect = botao.getBoundingClientRect();
        const isMobile = window.innerWidth <= 767;
        const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
        const popupContent = popup.querySelector('.popup-equipes-concluidas-content');
        
        document.body.appendChild(popup);

        if (!isMobile && !isMedia) {
            // Em telas maiores, posiciona FORA do container, ao lado direito - igual ao modal de deletar
            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
            
            if (filtroTimesLocais) {
                const containerRect = filtroTimesLocais.getBoundingClientRect();
                const header = document.querySelector('header');
                const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                const headerBottom = headerRect.bottom || 0;
                
                // Calcula a posição do popup (mesma lógica do modal de deletar)
                let popupTop = containerRect.top + 35;
                
                // O popup sempre fica abaixo do cabeçalho (z-index menor que 1000)
                if (popupTop < headerBottom) {
                    popupTop = headerBottom + 10;
                }

                // Cria um overlay transparente para posicionar o popup
                popup.style.position = 'fixed';
                popup.style.top = `${containerRect.top}px`;
                popup.style.left = `${containerRect.left}px`;
                popup.style.width = `${containerRect.width}px`;
                popup.style.height = `${containerRect.height}px`;
                popup.style.display = 'flex';
                popup.style.alignItems = 'flex-start';
                popup.style.justifyContent = 'flex-start';
                popup.style.padding = '0';
                popup.style.background = 'transparent';
                popup.style.zIndex = '10000';
                popup.style.pointerEvents = 'none';
                popup.style.overflow = 'visible';

                // Verifica se há espaço à direita
                const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                const larguraPopup = Math.min(320, larguraDisponivel);

                popupContent.style.position = 'fixed';
                popupContent.style.top = `${popupTop}px`;
                
                if (larguraDisponivel >= 280) {
                    // Posiciona à direita do container
                    popupContent.style.left = `${containerRect.right + 16}px`;
                    popupContent.style.right = 'auto';
                } else {
                    // Se não há espaço à direita, posiciona à esquerda
                    popupContent.style.left = 'auto';
                    popupContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                }
                
                popupContent.style.maxWidth = `${larguraPopup}px`;
                popupContent.style.pointerEvents = 'auto';
                popupContent.style.zIndex = '5001'; // Acima do header e dos modais
                
                // Atualiza a posição quando a janela redimensiona ou quando o container rola
                const atualizarPosicaoPopup = () => {
                    if (!document.body.contains(popup)) return;
                    
                    const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                    const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const novoHeaderBottom = novoHeaderRect.bottom || 0;
                    
                    // Atualiza a área do popup
                    popup.style.top = `${novoContainerRect.top}px`;
                    popup.style.left = `${novoContainerRect.left}px`;
                    popup.style.width = `${novoContainerRect.width}px`;
                    popup.style.height = `${novoContainerRect.height}px`;
                    
                    // Atualiza posição do conteúdo
                    let novoPopupTop = novoContainerRect.top + 35;
                    if (novoPopupTop < novoHeaderBottom) {
                        novoPopupTop = novoHeaderBottom + 10;
                    }
                    
                    const novaLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                    const novaLarguraPopup = Math.min(320, novaLarguraDisponivel);
                    
                    popupContent.style.top = `${novoPopupTop}px`;
                    
                    if (novaLarguraDisponivel >= 280) {
                        popupContent.style.left = `${novoContainerRect.right + 16}px`;
                        popupContent.style.right = 'auto';
                    } else {
                        popupContent.style.left = 'auto';
                        popupContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                    }
                    
                    popupContent.style.maxWidth = `${novaLarguraPopup}px`;
                };
                
                window.addEventListener('scroll', atualizarPosicaoPopup, { passive: true });
                window.addEventListener('resize', atualizarPosicaoPopup);
                
                // Remove listeners quando o popup é fechado
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(popup)) {
                        window.removeEventListener('scroll', atualizarPosicaoPopup);
                        window.removeEventListener('resize', atualizarPosicaoPopup);
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                // Fallback: posiciona próximo ao botão
                popup.style.position = 'absolute';
                popup.style.top = `${botaoRect.bottom + 10 + window.scrollY}px`;
                popup.style.left = `${botaoRect.right + 10 + window.scrollX}px`;
            }
        } else {
            // Mobile/Tablet: aparece como modal centralizado sobreposto (evita rolagem lateral)
            // Previne rolagem do body quando o modal está aberto
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            
            popup.style.position = 'fixed';
            popup.style.top = '0';
            popup.style.left = '0';
            popup.style.width = '100vw';
            popup.style.height = '100vh';
            popup.style.display = 'flex';
            popup.style.alignItems = 'center';
            popup.style.justifyContent = 'center';
            popup.style.padding = '20px';
            popup.style.background = 'rgba(0, 0, 0, 0.5)';
            popup.style.zIndex = '10000';
            popup.style.pointerEvents = 'auto';
            popup.style.overflow = 'auto';
            popup.style.boxSizing = 'border-box';
            
            // Ajusta o conteúdo do popup para ser um modal centralizado
            popupContent.style.position = 'relative';
            popupContent.style.width = '100%';
            popupContent.style.maxWidth = '90vw';
            popupContent.style.maxHeight = '80vh';
            popupContent.style.margin = 'auto';
            popupContent.style.pointerEvents = 'auto';
            popupContent.style.zIndex = '10001';
            popupContent.style.boxSizing = 'border-box';
            
            // Restaura o scroll do body quando o modal for fechado
            const restaurarScroll = () => {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollY);
            };
            
            // Armazena a função de restauração no popup para usar quando fechar
            popup._restaurarScroll = restaurarScroll;
        }

        // Função para atualizar botão selecionar tudo
        const atualizarBotaoSelecionarTudoEquipes = () => {
            const btnSelecionarTudo = popup.querySelector('#btn-selecionar-tudo-equipes');
            if (!btnSelecionarTudo) return;
            const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
            const todasSelecionadas = todasEquipes.length > 0 && equipesSelecionadas.size === todasEquipes.length;
            btnSelecionarTudo.innerHTML = todasSelecionadas 
                ? 'Desselecionar tudo'
                : 'Selecionar tudo';
        };
        
        // Função para entrar/sair do modo de seleção
        const toggleModoSelecaoEquipes = () => {
            modoSelecaoEquipes = !modoSelecaoEquipes;
            equipesSelecionadas.clear();
            
            const btnLixeira = popup.querySelector('.btn-lixeira-equipes');
            const selecionarTudoContainer = popup.querySelector('#selecionar-tudo-equipes-container');
            const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
            
            if (modoSelecaoEquipes) {
                if (btnLixeira) {
                    btnLixeira.classList.add('modo-selecao');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'block';
                }
                todasEquipes.forEach(item => {
                    item.classList.add('modo-selecao');
                });
            } else {
                if (btnLixeira) {
                    btnLixeira.classList.remove('modo-selecao');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'none';
                }
                todasEquipes.forEach(item => {
                    item.classList.remove('modo-selecao', 'selecionada');
                });
            }
            atualizarBotaoSelecionarTudoEquipes();
        };
        
        // Listener para botão lixeira
        const btnLixeira = popup.querySelector('.btn-lixeira-equipes');
        if (btnLixeira) {
            btnLixeira.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Se não está em modo de seleção, entra no modo
                if (!modoSelecaoEquipes) {
                    toggleModoSelecaoEquipes();
                    return;
                }
                
                // Se está em modo de seleção e tem equipes selecionadas, oculta
                if (equipesSelecionadas.size === 0) {
                    const mensagemEl = popup.querySelector('#mensagem-selecionar-primeiro-equipes');
                    if (mensagemEl) {
                        mensagemEl.style.display = 'inline';
                        setTimeout(() => {
                            mensagemEl.style.display = 'none';
                        }, 3000);
                    }
                    return;
                }
                
                // Remove confirmação - oculta diretamente
                try {
                    const token = localStorage.getItem('jwtToken');
                    const equipesIds = Array.from(equipesSelecionadas);
                    
                    // Oculta cada equipe (não deleta do banco, apenas oculta para o usuário)
                    for (const timeId of equipesIds) {
                        await fetch(`/api/times-projeto/${timeId}/ocultar`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                    }
                    
                    equipesSelecionadas.clear();
                    toggleModoSelecaoEquipes();
                    
                    // Recarrega as equipes
                    await mostrarEquipesConcluidas(botao);
                } catch (err) {
                    console.error('Erro ao ocultar equipes:', err);
                    alert('Erro ao ocultar equipes. Tente novamente.');
                }
            });
        }
        
        // Listener para botão selecionar tudo
        const btnSelecionarTudo = popup.querySelector('#btn-selecionar-tudo-equipes');
        if (btnSelecionarTudo) {
            btnSelecionarTudo.addEventListener('click', () => {
                const todasEquipes = popup.querySelectorAll('.equipe-concluida-item');
                const todasSelecionadas = todasEquipes.length > 0 && equipesSelecionadas.size === todasEquipes.length;
                
                if (todasSelecionadas) {
                    equipesSelecionadas.clear();
                    todasEquipes.forEach(item => item.classList.remove('selecionada'));
                } else {
                    todasEquipes.forEach(item => {
                        const timeId = item.dataset.timeId;
                        if (timeId) {
                            equipesSelecionadas.add(timeId);
                            item.classList.add('selecionada');
                        }
                    });
                }
                atualizarBotaoSelecionarTudoEquipes();
            });
        }
        
        // Listeners para cliques nas equipes (modo seleção)
        popup.querySelectorAll('.equipe-concluida-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!modoSelecaoEquipes) return;
                
                e.stopPropagation();
                const timeId = item.dataset.timeId;
                if (!timeId) return;
                
                if (equipesSelecionadas.has(timeId)) {
                    equipesSelecionadas.delete(timeId);
                    item.classList.remove('selecionada');
                } else {
                    equipesSelecionadas.add(timeId);
                    item.classList.add('selecionada');
                }
                atualizarBotaoSelecionarTudoEquipes();
            });
        });
        
        // Função para fechar o popup e restaurar scroll
        const fecharPopup = () => {
            // Se estiver em modo de seleção sem seleção, apenas reseta
            if (modoSelecaoEquipes && equipesSelecionadas.size === 0) {
                toggleModoSelecaoEquipes();
                return;
            }
            
            // Restaura scroll do body se estiver em mobile
            if ((isMobile || isMedia) && popup._restaurarScroll) {
                popup._restaurarScroll();
            }
            popup.remove();
        };
        
        // Botão fechar
        const btnFechar = popup.querySelector('.btn-fechar-popup-equipes');
        btnFechar.addEventListener('click', fecharPopup);

        // Fecha ao clicar fora
        const fecharAoClicarFora = (e) => {
            // Se estiver em modo de seleção sem seleção, apenas reseta
            if (modoSelecaoEquipes && equipesSelecionadas.size === 0) {
                if (!popupContent.contains(e.target) && e.target !== botao) {
                    toggleModoSelecaoEquipes();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
                return;
            }
            
            // Em mobile, fecha ao clicar no overlay (background escuro)
            if (isMobile || isMedia) {
                if (e.target === popup || (!popupContent.contains(e.target) && e.target !== botao)) {
                    fecharPopup();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
            } else {
                // Em telas maiores, comportamento original
                if (!popup.contains(e.target) && e.target !== botao) {
                    fecharPopup();
                    document.removeEventListener('click', fecharAoClicarFora);
                }
            }
        };

        setTimeout(() => {
            document.addEventListener('click', fecharAoClicarFora);
        }, 100);
    }

    // Listener para botão "Concluídas"
    const btnVerConcluidas = document.getElementById('btn-ver-concluidas');
    if (btnVerConcluidas) {
        btnVerConcluidas.addEventListener('click', async (e) => {
            e.stopPropagation();
            // Fecha sidebar em telas médias quando abre o popup
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            await mostrarEquipesConcluidas(btnVerConcluidas);
        });
    }

    // Função para mostrar popup de confirmação de cancelamento
    function mostrarConfirmacaoCancelar(botao) {
        return new Promise((resolve) => {
            // Remove popup anterior se existir
            const popupAnterior = document.querySelector('.popup-confirmacao-cancelar');
            if (popupAnterior) {
                popupAnterior.remove();
            }

            // Cria o popup
            const popup = document.createElement('div');
            popup.className = 'popup-confirmacao-cancelar';
            popup.innerHTML = `
                <div class="popup-confirmacao-content">
                    <p>Cancelar candidatura?</p>
                    <div class="popup-confirmacao-buttons">
                        <button class="btn-confirmar-sim">Sim</button>
                        <button class="btn-confirmar-nao">Não</button>
                    </div>
                </div>
            `;

            // Posiciona o popup ao lado do botão
            const rect = botao.getBoundingClientRect();
            document.body.appendChild(popup);
            
            // Ajusta posição
            const popupRect = popup.getBoundingClientRect();
            popup.style.top = `${rect.top + window.scrollY}px`;
            popup.style.left = `${rect.right + 10 + window.scrollX}px`;

            // Em telas menores, ajusta para aparecer acima ou abaixo
            if (window.innerWidth < 768) {
                popup.style.left = `${rect.left + window.scrollX}px`;
                popup.style.top = `${rect.bottom + 10 + window.scrollY}px`;
            }

            // Botões
            const btnSim = popup.querySelector('.btn-confirmar-sim');
            const btnNao = popup.querySelector('.btn-confirmar-nao');

            // Event listeners
            btnSim.addEventListener('click', () => {
                popup.remove();
                resolve(true);
            });

            btnNao.addEventListener('click', () => {
                popup.remove();
                resolve(false);
            });

            // Fecha ao clicar fora
            const fecharAoClicarFora = (e) => {
                if (!popup.contains(e.target) && e.target !== botao) {
                    popup.remove();
                    document.removeEventListener('click', fecharAoClicarFora);
                    resolve(false);
                }
            };

            // Aguarda um pouco antes de adicionar o listener para não fechar imediatamente
            setTimeout(() => {
                document.addEventListener('click', fecharAoClicarFora);
            }, 100);
        });
    }

    // Função para mostrar modal de escolha (aceitar ou contraproposta)
    function mostrarModalEscolhaCandidatura(timeId, tipo, valorBase, aCombinar, botao) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-escolha-candidatura');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-escolha-candidatura';
            modal.className = 'modal-overlay';
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);

            const valorTexto = aCombinar ? 'A Combinar' : `R$ ${(valorBase || 0).toFixed(2)}/dia`;
            
            modal.innerHTML = `
                <div class="modal-content modal-escolha-candidatura">
                    <div class="modal-body">
                        <div class="escolha-candidatura-content">
                            <p class="escolha-candidatura-info">Profissional: <strong>${tipo}</strong></p>
                            <p class="escolha-candidatura-info">Valor: <strong>${valorTexto}</strong></p>
                            <div class="escolha-candidatura-botoes">
                                ${!aCombinar ? `
                                    <button class="btn-escolher-aceitar" data-time-id="${timeId}" data-tipo="${tipo}" data-valor="${valorBase}">
                                        <i class="fas fa-check-circle"></i> Aceitar Valor
                                    </button>
                                ` : ''}
                                <button class="btn-escolher-contraproposta" data-time-id="${timeId}" data-tipo="${tipo}" data-valor-base="${valorBase || 0}" data-a-combinar="${aCombinar}">
                                    <i class="fas fa-comment-dollar"></i> ${aCombinar ? 'Enviar Proposta' : 'Enviar Contraproposta'}
                                </button>
                                <button class="btn-cancelar-escolha">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de candidatos
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            
            if (!isMobile && !isMedia) {
                // Em telas maiores, posiciona o modal FORA do container, ao lado (lateral)
                document.body.appendChild(modal);
                const modalContent = modal.querySelector('.modal-content');
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    
                    // Posiciona o modal fixo na tela, ao lado do container de times locais
                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';
                    
                    // Posiciona o conteúdo do modal ao lado direito do container de times locais
                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(200, larguraDisponivel);
                    
                    // Obtém a posição do cabeçalho
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Calcula a posição do modal
                    let modalTop = containerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    if (modalTop < headerBottom) {
                        modalTop = headerBottom + 10;
                    }
                    
                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    modalContent.style.left = `${containerRect.right + 16}px`;
                    modalContent.style.right = 'auto';
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.width = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '5001';
                    
                    // Função para atualizar a posição do modal quando houver scroll ou resize
                    const atualizarPosicaoModal = () => {
                        const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                        const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                        const novoHeaderBottom = novoHeaderRect.bottom || 0;
                        
                        let novoModalTop = novoContainerRect.top + 35;
                        if (novoModalTop < novoHeaderBottom) {
                            novoModalTop = novoHeaderBottom + 10;
                        }
                        
                        modal.style.top = `${novoContainerRect.top}px`;
                        modal.style.left = `${novoContainerRect.left}px`;
                        modal.style.width = `${novoContainerRect.width}px`;
                        modal.style.height = `${novoContainerRect.height}px`;
                        
                        const novaLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                        const novaLarguraModal = Math.min(200, novaLarguraDisponivel);
                        
                        modalContent.style.top = `${novoModalTop}px`;
                        modalContent.style.left = `${novoContainerRect.right + 16}px`;
                        modalContent.style.maxWidth = `${novaLarguraModal}px`;
                        modalContent.style.width = `${novaLarguraModal}px`;
                        modalContent.style.zIndex = '5001';
                    };
                    
                    // Adiciona listeners para scroll e resize
                    window.addEventListener('scroll', atualizarPosicaoModal, { passive: true });
                    window.addEventListener('resize', atualizarPosicaoModal);
                    
                    // Remove os listeners quando o modal for fechado
                    const removerListeners = () => {
                        window.removeEventListener('scroll', atualizarPosicaoModal);
                        window.removeEventListener('resize', atualizarPosicaoModal);
                    };
                    
                    // Armazena a função de remoção no modal para ser chamada quando fechar
                    modal._removerListeners = removerListeners;
                } else {
                    document.body.appendChild(modal);
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                document.body.appendChild(modal);
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');

            // Listener do botão aceitar
            const btnAceitar = modal.querySelector('.btn-escolher-aceitar');
            if (btnAceitar) {
                btnAceitar.addEventListener('click', async () => {
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    const timeId = btnAceitar.dataset.timeId;
                    const tipo = btnAceitar.dataset.tipo;
                    await aceitarValorTime(timeId, tipo, botao);
                    resolve(true);
                });
            }

            // Listener do botão contraproposta
            modal.querySelector('.btn-escolher-contraproposta').addEventListener('click', async () => {
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                const timeId = modal.querySelector('.btn-escolher-contraproposta').dataset.timeId;
                const tipo = modal.querySelector('.btn-escolher-contraproposta').dataset.tipo;
                const aCombinar = modal.querySelector('.btn-escolher-contraproposta').dataset.aCombinar === 'true';
                const valorBase = aCombinar ? null : parseFloat(modal.querySelector('.btn-escolher-contraproposta').dataset.valorBase || 0);
                await mostrarModalContraproposta(timeId, tipo, valorBase, aCombinar, botao);
                resolve(true);
            });

            // Listener do botão cancelar
            modal.querySelector('.btn-cancelar-escolha').addEventListener('click', () => {
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    // Função para aceitar o valor base
    async function aceitarValorTime(timeId, tipo, botao) {
        if (!botao) return;
        
        botao.disabled = true;
        const originalHTML = botao.innerHTML;
        botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aceitando...';
        
        try {
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tipo: tipo })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Recarrega os times para atualizar a interface
                setTimeout(() => {
                    carregarTimesLocais();
                }, 500);
            } else {
                botao.innerHTML = originalHTML;
                botao.disabled = false;
                alert(data.message || 'Erro ao aceitar valor.');
            }
        } catch (error) {
            console.error('Erro ao aceitar valor:', error);
            botao.innerHTML = originalHTML;
            botao.disabled = false;
            alert('Erro ao aceitar valor. Verifique sua conexão e tente novamente.');
        }
    }
    
    // Função para mostrar modal de contraproposta
    function mostrarModalContraproposta(timeId, tipo, valorBase, aCombinar, botao) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-contraproposta-time');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-contraproposta-time';
            modal.className = 'modal-overlay';
            
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);

            modal.innerHTML = `
                <div class="modal-content modal-contraproposta">
                    <div class="modal-body">
                        <div class="contraproposta-content">
                            <p class="contraproposta-info">Profissional: <strong>${tipo}</strong></p>
                            ${aCombinar ? `
                                <p class="contraproposta-info">Valor: <strong>A Combinar</strong></p>
                            ` : `
                                <p class="contraproposta-info">Valor base: <strong>R$ ${valorBase.toFixed(2)}/dia</strong></p>
                            `}
                            <div class="form-group">
                                <label>Seu valor (R$/dia)</label>
                                <input type="number" id="contraproposta-valor" ${aCombinar ? '' : `min="${valorBase}"`} step="0.01" placeholder="Ex: 230.00" required>
                            </div>
                            <div class="form-group">
                                <label>Justificativa</label>
                                <textarea id="contraproposta-justificativa" rows="3" placeholder="Ex: Levo minhas próprias ferramentas" required></textarea>
                            </div>
                            <div class="contraproposta-botoes">
                                <button class="btn-cancelar-contraproposta">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                                <button class="btn-enviar-contraproposta" data-time-id="${timeId}">
                                    <i class="fas fa-paper-plane"></i> Enviar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de confirmação
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            const modalContent = modal.querySelector('.modal-content');

            if (!isMobile && !isMedia) {
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    let modalTop = containerRect.top + 35;
                    if (modalTop < headerBottom) {
                        modalTop = headerBottom + 10;
                    }

                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';

                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(320, larguraDisponivel);

                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    
                    if (larguraDisponivel >= 200) {
                        modalContent.style.left = `${containerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '5001';
                } else {
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');

            // Listener do botão enviar
            modal.querySelector('.btn-enviar-contraproposta').addEventListener('click', async () => {
                const valor = parseFloat(document.getElementById('contraproposta-valor').value);
                const justificativa = document.getElementById('contraproposta-justificativa').value.trim();
                
                if (!valor || valor <= 0) {
                    alert('Por favor, informe um valor válido maior que zero.');
                    return;
                }
                
                if (!justificativa) {
                    alert('Por favor, informe uma justificativa.');
                    return;
                }
                
                const btnEnviar = modal.querySelector('.btn-enviar-contraproposta');
                btnEnviar.disabled = true;
                btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                
                try {
                    const response = await fetch(`/api/times-projeto/${timeId}/contraproposta`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            tipo: tipo,
                            valor: valor,
                            justificativa: justificativa
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        modal.remove();
                        // Recarrega os times para atualizar a interface
                        setTimeout(() => {
                            carregarTimesLocais();
                        }, 500);
                        resolve(true);
                    } else {
                        btnEnviar.disabled = false;
                        btnEnviar.innerHTML = 'Enviar';
                        alert(data.message || 'Erro ao enviar contraproposta.');
                    }
                } catch (error) {
                    console.error('Erro ao enviar contraproposta:', error);
                    btnEnviar.disabled = false;
                    btnEnviar.innerHTML = 'Enviar';
                    alert('Erro ao enviar contraproposta. Verifique sua conexão e tente novamente.');
                }
            });

            // Listener do botão cancelar
            modal.querySelector('.btn-cancelar-contraproposta').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    async function candidatarTime(timeId, botao) {
        if (!botao) {
            botao = document.querySelector(`.btn-candidatar[data-time-id="${timeId}"]`);
        }
        
        if (!botao) return;
        
        const icon = botao.querySelector('i');
        const text = botao.querySelector('.btn-candidatar-text');
        
        // Desabilita o botão durante a animação
        botao.disabled = true;
        
        try {
            // Animação: transição do ícone de mão para joia
            icon.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
            icon.style.transform = 'scale(0) rotate(180deg)';
            icon.style.opacity = '0';
            
            setTimeout(() => {
                icon.className = 'fas fa-briefcase';
                icon.style.transform = 'scale(1.2) rotate(0deg)';
                icon.style.opacity = '1';
                
                // Efeito de brilho
                icon.style.animation = 'bagPulse 0.6s ease';
                
                setTimeout(() => {
                    icon.style.transform = 'scale(1)';
                    icon.style.animation = '';
                }, 600);
            }, 400);
            
            // Atualiza o texto
            if (text) {
                text.textContent = 'Candidatado';
            }
            
            // Faz a requisição
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Atualiza o estado do botão
                botao.classList.add('candidatado');
                botao.dataset.jaCandidatou = 'true';
                botao.disabled = false;
                
                // Recarrega para atualizar contador
                setTimeout(() => {
                carregarTimesLocais();
                }, 1000);
            } else {
                // Reverte a animação em caso de erro
                icon.className = 'fas fa-hand-paper';
                icon.style.transform = 'scale(1)';
                if (text) text.textContent = 'Candidatar-se';
                botao.classList.remove('candidatado');
                botao.dataset.jaCandidatou = 'false';
                botao.disabled = false;
                alert(data.message || 'Erro ao candidatar-se.');
            }
        } catch (error) {
            console.error('Erro ao candidatar-se:', error);
            // Reverte a animação em caso de erro
            icon.className = 'fas fa-hand-paper';
            icon.style.transform = 'scale(1)';
            if (text) text.textContent = 'Candidatar-se';
            botao.classList.remove('candidatado');
            botao.dataset.jaCandidatou = 'false';
            botao.disabled = false;
            alert('Erro ao enviar candidatura.');
        }
    }

    async function cancelarCandidatura(timeId, botao) {
        if (!botao) {
            botao = document.querySelector(`.btn-candidatar[data-time-id="${timeId}"]`);
        }
        
        if (!botao) return;
        
        const icon = botao.querySelector('i');
        const text = botao.querySelector('.btn-candidatar-text');
        
        // Desabilita o botão durante a animação
        botao.disabled = true;
        
        try {
            // Animação reversa: joia para mão
            icon.style.transition = 'transform 0.4s ease, opacity 0.3s ease';
            icon.style.transform = 'scale(0) rotate(-180deg)';
            icon.style.opacity = '0';
            
            setTimeout(() => {
                icon.className = 'fas fa-hand-paper';
                icon.style.transform = 'scale(1) rotate(0deg)';
                icon.style.opacity = '1';
            }, 400);
            
            // Atualiza o texto
            if (text) {
                text.textContent = 'Candidatar-se';
            }
            
            // Faz a requisição
            const response = await fetch(`/api/times-projeto/${timeId}/candidatar`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Se a resposta não for OK, tenta ler o JSON de erro
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: `Erro ${response.status}: ${response.statusText}` };
                }
                throw new Error(errorData.message || 'Erro ao cancelar candidatura');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Atualiza o estado do botão
                botao.classList.remove('candidatado');
                botao.dataset.jaCandidatou = 'false';
                botao.disabled = false;
                
                // Recarrega para atualizar contador
                setTimeout(() => {
                    carregarTimesLocais();
                }, 1000);
            } else {
                // Reverte a animação em caso de erro
                icon.className = 'fas fa-briefcase';
                icon.style.transform = 'scale(1)';
                if (text) text.textContent = 'Candidatado';
                botao.classList.add('candidatado');
                botao.dataset.jaCandidatou = 'true';
                botao.disabled = false;
                alert(data.message || 'Erro ao cancelar candidatura.');
            }
        } catch (error) {
            console.error('Erro ao cancelar candidatura:', error);
            // Reverte a animação em caso de erro
            icon.className = 'fas fa-briefcase';
            icon.style.transform = 'scale(1)';
            if (text) text.textContent = 'Candidatado';
            botao.classList.add('candidatado');
            botao.dataset.jaCandidatou = 'true';
            botao.disabled = false;
            alert(error.message || 'Erro ao cancelar candidatura. Verifique sua conexão e tente novamente.');
        }
    }

    // Função para mostrar modal de confirmação de deletar time
    function mostrarConfirmacaoDeletarTime(botao, timeId) {
        return new Promise((resolve) => {
            // Remove modal anterior se existir
            const modalAnterior = document.getElementById('modal-confirmar-deletar-time');
            if (modalAnterior) {
                modalAnterior.remove();
            }

            // Cria novo modal
            const modal = document.createElement('div');
            modal.id = 'modal-confirmar-deletar-time';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);

            modal.innerHTML = `
                <div class="modal-content modal-confirmacao-deletar">
                    <div class="modal-body">
                        <div class="confirmacao-deletar-content">
                            <p class="confirmacao-deletar-mensagem">Tem certeza?</p>
                            <div class="confirmacao-deletar-botoes">
                                <button class="btn-cancelar-deletar" data-acao="cancelar">Não</button>
                                <button class="btn-confirmar-deletar" data-acao="confirmar">Sim</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Posiciona o modal similar ao modal de candidatos
            const botaoRect = botao.getBoundingClientRect();
            const isMobile = window.innerWidth <= 767;
            const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
            const modalContent = modal.querySelector('.modal-content');

            if (!isMobile && !isMedia) {
                // Em telas maiores, posiciona FORA do container, ao lado (lateral) - igual ao modal de candidatos
                const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                
                if (filtroTimesLocais) {
                    const containerRect = filtroTimesLocais.getBoundingClientRect();
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                    let modalTop = containerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                    if (modalTop < headerBottom) {
                        // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                        modalTop = headerBottom + 10;
                    }

                    // Posiciona o modal fixo na tela, ao lado do container de times locais
                    modal.style.position = 'fixed';
                    modal.style.top = `${containerRect.top}px`;
                    modal.style.left = `${containerRect.left}px`;
                    modal.style.width = `${containerRect.width}px`;
                    modal.style.height = `${containerRect.height}px`;
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'flex-start';
                    modal.style.justifyContent = 'flex-start';
                    modal.style.padding = '0';
                    modal.style.background = 'transparent';
                    modal.style.zIndex = '10000';
                    modal.style.pointerEvents = 'none';
                    modal.style.overflow = 'visible';

                    // Verifica se há espaço à direita
                    const larguraDisponivel = window.innerWidth - containerRect.right - 32;
                    const larguraModal = Math.min(200, larguraDisponivel);

                    modalContent.style.position = 'fixed';
                    modalContent.style.top = `${modalTop}px`;
                    
                    if (larguraDisponivel >= 150) {
                        modalContent.style.left = `${containerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.pointerEvents = 'auto';
                    modalContent.style.zIndex = '5001'; // Acima do header e dos modais
                    
                    // Atualiza a posição quando a janela redimensiona ou quando o container rola
                    const atualizarPosicaoModal = () => {
                        if (!document.body.contains(modal)) return;
                        
                        const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                        const novoBotaoRect = botao.getBoundingClientRect();
                        
                        // Obtém a posição do cabeçalho
                        const novoHeaderRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                        const novoHeaderBottom = novoHeaderRect.bottom || 0;
                        
                        // Atualiza a área do modal
                        modal.style.top = `${novoContainerRect.top}px`;
                        modal.style.left = `${novoContainerRect.left}px`;
                        modal.style.width = `${novoContainerRect.width}px`;
                        modal.style.height = `${novoContainerRect.height}px`;
                        
                        // Calcula a posição do modal
                        let novoModalTop = novoContainerRect.top + 35;
                        
                        // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                        // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                        if (novoModalTop < novoHeaderBottom) {
                            // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                            novoModalTop = novoHeaderBottom + 10;
                        }
                        
                        // Atualiza a posição do conteúdo
                        modalContent.style.top = `${novoModalTop}px`;
                        modalContent.style.zIndex = '5001'; // Acima do header e dos modais
                        
                        // Verifica se há espaço à direita
                        const novoLarguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                        const novoLarguraModal = Math.min(200, novoLarguraDisponivel);
                        
                        if (novoLarguraDisponivel >= 150) {
                            modalContent.style.left = `${novoContainerRect.right + 16}px`;
                            modalContent.style.right = 'auto';
                        } else {
                            modalContent.style.left = 'auto';
                            modalContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                        }
                        
                        modalContent.style.maxWidth = `${novoLarguraModal}px`;
                    };
                    
                    // Adiciona listeners para atualizar posição
                    const timesContainer = document.querySelector('.times-container-lateral');
                    if (timesContainer) {
                        timesContainer.addEventListener('scroll', atualizarPosicaoModal);
                    }
                    window.addEventListener('resize', atualizarPosicaoModal);
                    window.addEventListener('scroll', atualizarPosicaoModal);
                    
                    // Remove os listeners quando o modal for fechado
                    const removerListeners = () => {
                        if (timesContainer) {
                            timesContainer.removeEventListener('scroll', atualizarPosicaoModal);
                        }
                        window.removeEventListener('resize', atualizarPosicaoModal);
                        window.removeEventListener('scroll', atualizarPosicaoModal);
                    };
                    
                    // Observa quando o modal é removido
                    const observer = new MutationObserver(() => {
                        if (!document.body.contains(modal)) {
                            removerListeners();
                            observer.disconnect();
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                    
                    // Armazena a função de remoção no modal para usar no fecharModal
                    modal._removerListeners = removerListeners;
                } else {
                    // Fallback
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.right = '0';
                    modal.style.bottom = '0';
                    modal.style.display = 'flex';
                    modal.style.alignItems = 'center';
                    modal.style.justifyContent = 'center';
                    modal.style.background = 'rgba(0, 0, 0, 0.5)';
                    modal.style.zIndex = '10000';
                }
            } else {
                // Em telas menores, centraliza
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'center';
                modal.style.justifyContent = 'center';
                modal.style.background = 'rgba(0, 0, 0, 0.5)';
                modal.style.zIndex = '10000';
            }

            modal.classList.remove('hidden');

            // Listeners dos botões
            modal.querySelector('.btn-confirmar-deletar').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.querySelector('.btn-cancelar-deletar').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            // Fechar ao clicar fora
            const fecharModal = (e) => {
                if (!modalContent.contains(e.target) && e.target !== botao) {
                    // Remove listeners se existirem
                    if (modal._removerListeners) {
                        modal._removerListeners();
                    }
                    modal.remove();
                    document.removeEventListener('click', fecharModal);
                    resolve(false);
                }
            };

            setTimeout(() => {
                document.addEventListener('click', fecharModal);
            }, 100);
        });
    }

    // Função para deletar time
    async function deletarTime(timeId) {
        try {
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                alert('Você precisa estar logado para deletar um time.');
                return;
            }

            const response = await fetch(`/api/times-projeto/${timeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                // Remove o card do time da interface
                const timeCard = document.querySelector(`.btn-deletar-time[data-time-id="${timeId}"]`)?.closest('.time-card');
                if (timeCard) {
                    timeCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    timeCard.style.opacity = '0';
                    timeCard.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        timeCard.remove();
                        // Recarrega os times para atualizar a lista
                        carregarTimesLocais();
                    }, 300);
                } else {
                    // Se não encontrar o card, apenas recarrega
                    carregarTimesLocais();
                }
                // Removido alert de sucesso - não precisa aparecer nada
            } else {
                alert(data.message || 'Erro ao deletar time. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao deletar time:', error);
            alert('Erro ao deletar time. Verifique sua conexão e tente novamente.');
        }
    }

    // Função global para abrir modal de proposta aceita
    window.abrirModalPropostaAceita = async function(dadosAdicionais) {
        try {
            const modal = document.getElementById('modal-proposta-aceita');
            if (!modal) {
                console.error('Modal de proposta aceita não encontrado');
                return;
            }

            // Busca dados do time
            const timeId = dadosAdicionais.timeId;
            const token = localStorage.getItem('jwtToken');
            
            console.log('🔍 Abrindo modal de proposta aceita:', { timeId, dadosAdicionais });
            
            if (!token || !timeId) {
                console.error('Token ou timeId não encontrado:', { token: !!token, timeId });
                alert('Erro: dados da notificação incompletos.');
                return;
            }

            // Busca dados completos do time
            const response = await fetch(`/api/times-projeto/${timeId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });

            console.log('📡 Resposta da API:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro na resposta:', errorText);
                throw new Error(`Erro ao buscar dados do time: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 Dados recebidos:', data);
            
            if (!data.success || !data.time) {
                throw new Error('Time não encontrado na resposta');
            }

            const time = data.time;
            const valorAceito = dadosAdicionais.valorAceito || 0;
            // Monta endereço completo com rua e número se disponíveis
            const enderecoParts = [];
            if (time.localizacao.rua) enderecoParts.push(time.localizacao.rua);
            if (time.localizacao.numero) enderecoParts.push(`Nº ${time.localizacao.numero}`);
            if (time.localizacao.bairro) enderecoParts.push(time.localizacao.bairro);
            if (time.localizacao.cidade) enderecoParts.push(time.localizacao.cidade);
            if (time.localizacao.estado) enderecoParts.push(time.localizacao.estado);
            const enderecoCompleto = dadosAdicionais.enderecoCompleto || (enderecoParts.length > 0 ? enderecoParts.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`);
            const cliente = time.clienteId || {};
            const clienteNome = cliente.nome || dadosAdicionais.clienteNome || 'Cliente';
            const clienteTelefone = cliente.telefone || dadosAdicionais.clienteTelefone || '';
            const clienteId = cliente._id || cliente.id || '';
            const clienteFoto = cliente.foto || cliente.avatarUrl || '/imagens/default-user.png';

            // Preenche o perfil do cliente no header
            const perfilLink = document.getElementById('proposta-aceita-perfil-link');
            const perfilAvatar = document.getElementById('proposta-aceita-perfil-avatar');
            const perfilNome = document.getElementById('proposta-aceita-perfil-nome');
            
            if (perfilLink && perfilAvatar && perfilNome) {
                if (clienteId) {
                    perfilLink.href = `/perfil.html?id=${clienteId}`;
                    perfilLink.style.display = 'flex';
                } else {
                    perfilLink.style.display = 'none';
                }
                perfilAvatar.src = clienteFoto;
                perfilAvatar.onerror = function() {
                    this.src = '/imagens/default-user.png';
                };
                perfilNome.textContent = clienteNome;
            }

            // Preenche os dados no modal
            document.getElementById('proposta-aceita-titulo-projeto').textContent = time.titulo || '-';
            document.getElementById('proposta-aceita-valor').textContent = `R$ ${valorAceito.toFixed(2).replace('.', ',')}`;
            
            // Endereço clicável (abre no Google Maps)
            const enderecoLink = document.getElementById('proposta-aceita-endereco-link');
            if (enderecoLink) {
                enderecoLink.textContent = enderecoCompleto;
                // Cria link do Google Maps
                const enderecoEncoded = encodeURIComponent(enderecoCompleto);
                enderecoLink.href = `https://www.google.com/maps/search/?api=1&query=${enderecoEncoded}`;
            }

            // Cria mensagem do WhatsApp
            const mensagemWhatsApp = encodeURIComponent(
                `Olá! Minha proposta foi aceita no site para o projeto "${time.titulo}". Vamos combinar os detalhes?`
            );
            
            // Cria link do WhatsApp
            let whatsappLink = `https://wa.me/${clienteTelefone.replace(/\D/g, '')}?text=${mensagemWhatsApp}`;
            
            // Se não tiver telefone, usa um link genérico
            if (!clienteTelefone || clienteTelefone.trim() === '') {
                whatsappLink = `https://wa.me/?text=${mensagemWhatsApp}`;
            }

            const btnWhatsApp = document.getElementById('btn-whatsapp-proposta');
            if (btnWhatsApp) {
                btnWhatsApp.href = whatsappLink;
            }

            // Abre o modal
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Previne scroll do body

            // Fecha o modal ao clicar no backdrop ou no botão fechar
            const backdrop = modal.querySelector('.modal-proposta-aceita-backdrop');
            const btnClose = modal.querySelector('.modal-proposta-aceita-close');

            const fecharModal = () => {
                modal.classList.add('hidden');
                document.body.style.overflow = '';
            };

            if (backdrop) {
                backdrop.onclick = fecharModal;
            }

            if (btnClose) {
                btnClose.onclick = fecharModal;
            }

            // Fecha com ESC
            const handleEsc = (e) => {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    fecharModal();
                    document.removeEventListener('keydown', handleEsc);
                }
            };
            document.addEventListener('keydown', handleEsc);

        } catch (error) {
            console.error('Erro ao abrir modal de proposta aceita:', error);
            alert('Erro ao carregar informações da proposta aceita.');
        }
    };

    // Função global para abrir candidatos a partir de notificação
    window.abrirCandidatosPorNotificacao = async function(timeId, profissionalId = null, tipoNotificacao = null, candidatoId = null) {
        try {
            console.log('🔔 Abrindo candidatos por notificação, timeId:', timeId, 'profissionalId:', profissionalId, 'tipoNotificacao:', tipoNotificacao);
            const token = localStorage.getItem('jwtToken');
            if (!token) {
                console.error('Token não encontrado');
                return false; // Retorna false para indicar que não foi bem-sucedido
            }
            
            // Verifica se o modal de notificações está aberto
            const modalNotificacoes = document.getElementById('modal-notificacoes');
            const modalEstaAberto = modalNotificacoes && !modalNotificacoes.classList.contains('hidden');
            
            // Busca o time específico - busca todos os times e filtra
            const response = await fetch(`/api/times-projeto?t=${Date.now()}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                cache: 'no-cache'
            });
            
            if (!response.ok) {
                // Se a resposta não for OK (ex: 404), verifica se foi concluído ou removido
                if (response.status === 404) {
                    // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                    let mensagemFinal = 'Esta equipe foi removida.';
                    try {
                        const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (responseConcluidos.ok) {
                            const dataConcluidos = await responseConcluidos.json();
                            if (dataConcluidos.success && dataConcluidos.times) {
                                const timeConcluido = dataConcluidos.times.find(t => {
                                    const tId = t._id?.toString() || t._id;
                                    const searchId = timeId?.toString() || timeId;
                                    return tId === searchId;
                                });
                                
                                if (timeConcluido && timeConcluido.status === 'concluido') {
                                    mensagemFinal = 'Esta equipe já foi concluída.';
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao verificar time concluído:', err);
                    }
                    
                    // Garante que o modal de notificações está aberto
                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    
                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                        window.temMensagemErroNotificacao = true;
                        
                        // Abre o modal se estiver fechado
                        if (modalNotificacoes.classList.contains('hidden')) {
                            modalNotificacoes.classList.remove('hidden');
                        }
                        
                        mensagemTexto.textContent = mensagemFinal;
                        mensagemProposta.style.display = 'block';
                        
                        // Remove o flag após um tempo para permitir recarregamento futuro
                        setTimeout(() => {
                            window.temMensagemErroNotificacao = false;
                        }, 5000);
                    }
                    return false; // Retorna false para indicar erro
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📋 Dados recebidos:', data);
            
            if (data.success && data.times) {
                // Tenta encontrar o time pelo ID (pode ser string ou ObjectId)
                const time = data.times.find(t => {
                    const tId = t._id?.toString() || t._id;
                    const searchId = timeId?.toString() || timeId;
                    return tId === searchId;
                });
                console.log('🔍 Time encontrado:', time);
                console.log('🔍 TimeId buscado:', timeId);
                console.log('🔍 Times disponíveis:', data.times.map(t => ({ id: t._id, titulo: t.titulo })));
                
                if (!time) {
                    // Time não encontrado - verifica se foi concluído ou removido
                    console.error('❌ Time não encontrado com ID:', timeId);
                    
                    // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                    let mensagemFinal = 'Esta equipe foi removida.';
                    try {
                        const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (responseConcluidos.ok) {
                            const dataConcluidos = await responseConcluidos.json();
                            if (dataConcluidos.success && dataConcluidos.times) {
                                const timeConcluido = dataConcluidos.times.find(t => {
                                    const tId = t._id?.toString() || t._id;
                                    const searchId = timeId?.toString() || timeId;
                                    return tId === searchId;
                                });
                                
                                if (timeConcluido && timeConcluido.status === 'concluido') {
                                    mensagemFinal = 'Esta equipe já foi concluída.';
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao verificar time concluído:', err);
                    }
                    
                    // Garante que o modal de notificações está aberto
                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    
                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                        window.temMensagemErroNotificacao = true;
                        
                        // Abre o modal se estiver fechado
                        if (modalNotificacoes.classList.contains('hidden')) {
                            modalNotificacoes.classList.remove('hidden');
                        }
                        
                        mensagemTexto.textContent = mensagemFinal;
                        mensagemProposta.style.display = 'block';
                        
                        // Remove o flag após um tempo para permitir recarregamento futuro
                        setTimeout(() => {
                            window.temMensagemErroNotificacao = false;
                        }, 5000);
                    }
                    return false; // Retorna false para indicar erro
                }
                
                if (time) {
                    // Verifica se o time foi concluído ANTES de processar
                    if (time.status === 'concluido') {
                        // Garante que o modal de notificações está aberto
                        const modalNotificacoes = document.getElementById('modal-notificacoes');
                        const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                        const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                        
                        if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                            // Define o flag ANTES de qualquer coisa para evitar recarregamento
                            window.temMensagemErroNotificacao = true;
                            
                            // Abre o modal se estiver fechado
                            if (modalNotificacoes.classList.contains('hidden')) {
                                modalNotificacoes.classList.remove('hidden');
                            }
                            
                            mensagemTexto.textContent = 'Esta equipe já foi concluída.';
                            mensagemProposta.style.display = 'block';
                            
                            // Remove o flag após um tempo para permitir recarregamento futuro
                            setTimeout(() => {
                                window.temMensagemErroNotificacao = false;
                            }, 5000);
                        }
                        return false; // Não abre o modal de candidatos
                    }
                    
                    // Popula candidatos se necessário
                    // Verifica se há um candidato específico para esta notificação (por candidatoId)
                    // Busca o time completo com candidatos populados para verificar o status
                    try {
                        const timeCompletoResponse = await fetch(`/api/times-projeto/${timeId}`, {
                            headers: { 'Authorization': `Bearer ${token}` },
                            cache: 'no-cache'
                        });
                        
                        if (timeCompletoResponse.ok) {
                            const timeCompletoData = await timeCompletoResponse.json();
                            if (timeCompletoData.success && timeCompletoData.time) {
                                time = timeCompletoData.time; // Atualiza o time com dados completos
                                
                                // Verifica novamente se foi concluído após buscar dados completos
                                if (time.status === 'concluido') {
                                    // Garante que o modal de notificações está aberto
                                    const modalNotificacoes = document.getElementById('modal-notificacoes');
                                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                                    
                                    if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                        // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                        window.temMensagemErroNotificacao = true;
                                        
                                        // Abre o modal se estiver fechado
                                        if (modalNotificacoes.classList.contains('hidden')) {
                                            modalNotificacoes.classList.remove('hidden');
                                        }
                                        
                                        mensagemTexto.textContent = 'Esta equipe já foi concluída.';
                                        mensagemProposta.style.display = 'block';
                                        
                                        // Remove o flag após um tempo para permitir recarregamento futuro
                                        setTimeout(() => {
                                            window.temMensagemErroNotificacao = false;
                                        }, 5000);
                                    }
                                    return false; // Não abre o modal de candidatos
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Erro ao buscar time completo:', err);
                    }
                    
                    // Verifica se há candidatoId na notificação (identificação específica)
                    // Se não tiver candidatoId, não podemos identificar qual candidato específico a notificação se refere
                    const candidatos = time.candidatos || [];
                    let candidatoEspecifico = null;
                    
                    console.log('🔍 Verificando candidato específico:', { candidatoId, profissionalId, totalCandidatos: candidatos.length });
                    
                    // Primeiro tenta encontrar pelo candidatoId (mais específico - como nos pedidos urgentes)
                    if (candidatoId) {
                        candidatoEspecifico = candidatos.find(c => {
                            const cId = c._id?.toString() || c._id;
                            const searchId = candidatoId?.toString() || candidatoId;
                            const match = cId === searchId;
                            if (match) {
                                console.log('✅ Candidato encontrado pelo candidatoId:', { cId, searchId, status: c.status });
                            }
                            return match;
                        });
                        
                        if (!candidatoEspecifico) {
                            console.warn('⚠️ CandidatoId fornecido mas não encontrado - candidato foi recusado/removido:', candidatoId);
                            // Se não encontrou o candidato pelo ID, significa que foi recusado (removido do array)
                            // Garante que o modal de notificações está aberto
                            const modalNotificacoes = document.getElementById('modal-notificacoes');
                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                            
                            if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                window.temMensagemErroNotificacao = true;
                                
                                // Abre o modal se estiver fechado
                                if (modalNotificacoes.classList.contains('hidden')) {
                                    modalNotificacoes.classList.remove('hidden');
                                }
                                
                                mensagemTexto.textContent = 'Esta proposta/candidatura já foi recusada.';
                                mensagemProposta.style.display = 'block';
                                
                                // Remove o flag após um tempo para permitir recarregamento futuro (aumentado para evitar piscar)
                                setTimeout(() => {
                                    window.temMensagemErroNotificacao = false;
                                }, 5000);
                            }
                            return false; // Não abre o modal
                        }
                    } else {
                        console.warn('⚠️ Notificação sem candidatoId - não é possível identificar candidato específico');
                        // Se não tem candidatoId, não podemos identificar qual candidato específico
                        // Verifica se há candidatos do profissional que já foram respondidos
                        if (profissionalId) {
                            const candidatosDoProfissional = candidatos.filter(c => {
                                const cProfId = c.profissionalId?._id?.toString() || c.profissionalId?.toString() || c.profissionalId;
                                const searchProfId = profissionalId?.toString() || profissionalId;
                                return cProfId === searchProfId;
                            });
                            
                            console.log('🔍 Candidatos do profissional (sem candidatoId):', candidatosDoProfissional.length);
                            
                            // Se TODOS os candidatos do profissional já foram respondidos, mostra mensagem
                            const todosRespondidos = candidatosDoProfissional.length > 0 && 
                                candidatosDoProfissional.every(c => {
                                    const status = c.status || 'pendente';
                                    return status !== 'pendente';
                                });
                            
                            if (todosRespondidos) {
                                console.log('✅ Todos os candidatos do profissional já foram respondidos');
                                // Garante que o modal de notificações está aberto
                                const modalNotificacoes = document.getElementById('modal-notificacoes');
                                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                                
                                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                    // Abre o modal se estiver fechado
                                    if (modalNotificacoes.classList.contains('hidden')) {
                                        modalNotificacoes.classList.remove('hidden');
                                    }
                                    
                                    mensagemTexto.textContent = 'Esta notificação não pode ser aberta porque não é possível identificar qual proposta específica ela se refere.';
                                    mensagemProposta.style.display = 'block';
                                    
                                    setTimeout(() => {
                                        mensagemProposta.style.display = 'none';
                                    }, 5000);
                                }
                                return false;
                            }
                            // Se houver candidatos pendentes, não faz nada aqui - deixa abrir o modal normalmente
                            // mas não destaca nenhum candidato específico
                        }
                    }
                    
                    // Se encontrou o candidato específico pelo candidatoId, verifica se ainda está pendente
                    if (candidatoEspecifico) {
                        const status = candidatoEspecifico.status || 'pendente';
                        console.log('🔍 Status do candidato específico:', status);
                        if (status !== 'pendente') {
                            // Candidatura já foi respondida
                            const statusTexto = status === 'aceito' ? 'aceita' : status === 'rejeitado' ? 'recusada' : 'respondida';
                            // Garante que o modal de notificações está aberto
                            const modalNotificacoes = document.getElementById('modal-notificacoes');
                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                            
                            if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                                // Define o flag ANTES de qualquer coisa para evitar recarregamento
                                window.temMensagemErroNotificacao = true;
                                
                                // Abre o modal se estiver fechado
                                if (modalNotificacoes.classList.contains('hidden')) {
                                    modalNotificacoes.classList.remove('hidden');
                                }
                                
                                mensagemTexto.textContent = `Esta proposta/candidatura já foi ${statusTexto}.`;
                                mensagemProposta.style.display = 'block';
                                
                                // Remove o flag após um tempo para permitir recarregamento futuro (aumentado para evitar piscar)
                                setTimeout(() => {
                                    window.temMensagemErroNotificacao = false;
                                }, 5000);
                            }
                            return false;
                        }
                    }
                    if (time.candidatos && time.candidatos.length > 0) {
                        console.log('👥 Candidatos no time:', time.candidatos.length);
                        const candidatosPendentes = time.candidatos.filter(c => c.status === 'pendente');
                        console.log('⏳ Candidatos pendentes:', candidatosPendentes.length);
                    }
                    
                    const isMobile = window.innerWidth <= 767;
                    const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
                    
                    // Em todas as telas (médias, menores e maiores), rola até o time antes de abrir o modal
                    // Sempre executa o scroll para todas as telas
                    // Abre o menu lateral se estiver fechado (apenas em telas médias e menores)
                    if (isMobile || isMedia) {
                        const categoriasAside = document.querySelector('.categorias');
                        if (categoriasAside && !categoriasAside.classList.contains('aberta')) {
                            const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
                            if (mobileSidebarToggle) {
                                mobileSidebarToggle.click();
                            }
                        }
                    }
                    
                    // Aguarda o menu abrir (se necessário) e depois rola até o time
                    const delayMenu = (isMobile || isMedia) ? 200 : 0;
                    setTimeout(() => {
                            // Primeiro, rola a página até a seção de times locais
                            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
                            if (filtroTimesLocais) {
                                filtroTimesLocais.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                            
                            // Aguarda um pouco e depois procura o time card (reduzido de 500ms para 200ms)
                            setTimeout(() => {
                                // Procura o time card pelo ID - tenta várias formas
                                let timeCardEncontrado = null;
                                let botaoEncontrado = null;
                                
                                // Primeiro tenta encontrar pelo botão
                                botaoEncontrado = document.querySelector(`.btn-ver-candidatos[data-time-id="${timeId}"]`);
                                if (botaoEncontrado) {
                                    timeCardEncontrado = botaoEncontrado.closest('.time-card');
                                }
                                
                                // Se não encontrou, procura em todos os time cards
                                if (!timeCardEncontrado) {
                                    const timeCards = document.querySelectorAll('.time-card');
                                    timeCards.forEach(card => {
                                        const btnVerCandidatos = card.querySelector(`.btn-ver-candidatos[data-time-id="${timeId}"]`);
                                        if (btnVerCandidatos) {
                                            timeCardEncontrado = card;
                                            botaoEncontrado = btnVerCandidatos;
                                        }
                                    });
                                }
                                
                                if (timeCardEncontrado && botaoEncontrado) {
                                    // Rola até o time card dentro do container de times
                                    const timesContainer = document.querySelector('.times-container-lateral');
                                    if (timesContainer) {
                                        // Primeiro rola a página até o card se necessário
                                        const cardRect = timeCardEncontrado.getBoundingClientRect();
                                        const containerRect = timesContainer.getBoundingClientRect();
                                        
                                        // Se o card não está visível, rola a página primeiro
                                        if (cardRect.top < containerRect.top || cardRect.bottom > containerRect.bottom) {
                                            timeCardEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            
                                            // Aguarda o scroll da página e depois rola dentro do container (reduzido de 500ms para 200ms)
                                            setTimeout(() => {
                                                const novoCardRect = timeCardEncontrado.getBoundingClientRect();
                                                const novoContainerRect = timesContainer.getBoundingClientRect();
                                                const scrollTop = timesContainer.scrollTop;
                                                const targetScroll = scrollTop + (novoCardRect.top - novoContainerRect.top) - (novoContainerRect.height / 2) + (novoCardRect.height / 2);
                                                
                                                timesContainer.scrollTo({
                                                    top: Math.max(0, targetScroll),
                                                    behavior: 'smooth'
                                                });
                                                
                                                // Aguarda o scroll e depois abre o modal (reduzido de 600ms para 300ms)
                                                setTimeout(() => {
                                                    // Destaca o candidato se:
                                                    // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                                    // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                                    const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                        (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                        ? profissionalId 
                                                        : null;
                                                    console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                                    mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                                }, 300);
                                            }, 200);
                                        } else {
                                            // O card já está visível, apenas rola dentro do container
                                            const scrollTop = timesContainer.scrollTop;
                                            const targetScroll = scrollTop + (cardRect.top - containerRect.top) - (containerRect.height / 2) + (cardRect.height / 2);
                                            
                                            timesContainer.scrollTo({
                                                top: Math.max(0, targetScroll),
                                                behavior: 'smooth'
                                            });
                                            
                                            // Aguarda o scroll e depois abre o modal (reduzido de 600ms para 300ms)
                                            setTimeout(() => {
                                                // Destaca o candidato se:
                                                // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                                // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                                const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                    (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                    ? profissionalId 
                                                    : null;
                                                console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                                mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                            }, 300);
                                        }
                                    } else {
                                        // Fallback: scroll normal
                                        timeCardEncontrado.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 300);
                                    }
                                } else {
                                    // Se não encontrar o card, tenta abrir o modal mesmo assim
                                    if (botaoEncontrado) {
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoEncontrado, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 100);
                                    } else {
                                        // Fallback: cria botão virtual
                                        const botaoVirtual = document.createElement('button');
                                        botaoVirtual.style.position = 'fixed';
                                        botaoVirtual.style.top = '50%';
                                        botaoVirtual.style.left = '50%';
                                        botaoVirtual.style.opacity = '0';
                                        botaoVirtual.style.pointerEvents = 'none';
                                        document.body.appendChild(botaoVirtual);
                                        setTimeout(() => {
                                            // Destaca o candidato se:
                                            // 1. For notificação de confirmar_perfil_time (sempre destaca)
                                            // 2. Ou se tiver candidatoId e o candidato específico estiver pendente
                                            const profissionalIdParaDestacar = (tipoNotificacao === 'confirmar_perfil_time' && candidatoEspecifico) || 
                                                (candidatoId && candidatoEspecifico && candidatoEspecifico.status === 'pendente')
                                                ? profissionalId 
                                                : null;
                                            console.log('🎯 Destacando candidato:', { profissionalIdParaDestacar, tipoNotificacao, candidatoId, status: candidatoEspecifico?.status });
                                            mostrarCandidatosTime(time, botaoVirtual, profissionalIdParaDestacar, tipoNotificacao);
                                        }, 100);
                                    }
                                }
                            }, 200);
                    }, delayMenu);
                }
                // Retorna true para indicar sucesso
                return true;
            } else {
                console.error('❌ Erro ao buscar times:', data);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao abrir candidatos por notificação:', error);
            
            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
            const mensagemTexto = document.getElementById('mensagem-proposta-texto');
            
            // Verifica se é erro 404 (time não encontrado)
            if (error.message && (error.message.includes('404') || error.message.includes('não encontrado') || error.message.includes('not found'))) {
                // Tenta buscar o time incluindo concluídos para verificar se foi concluído
                let mensagemFinal = 'Esta equipe foi removida.';
                try {
                    const responseConcluidos = await fetch(`/api/times-projeto?status=concluido&t=${Date.now()}`, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        cache: 'no-cache'
                    });
                    
                    if (responseConcluidos.ok) {
                        const dataConcluidos = await responseConcluidos.json();
                        if (dataConcluidos.success && dataConcluidos.times) {
                            const timeConcluido = dataConcluidos.times.find(t => {
                                const tId = t._id?.toString() || t._id;
                                const searchId = timeId?.toString() || timeId;
                                return tId === searchId;
                            });
                            
                            if (timeConcluido && timeConcluido.status === 'concluido') {
                                mensagemFinal = 'Esta equipe já foi concluída.';
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Erro ao verificar time concluído:', err);
                }
                
                // Garante que o modal de notificações está aberto
                const modalNotificacoes = document.getElementById('modal-notificacoes');
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                
                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                    // Define o flag ANTES de qualquer coisa para evitar recarregamento
                    window.temMensagemErroNotificacao = true;
                    
                    // Abre o modal se estiver fechado
                    if (modalNotificacoes.classList.contains('hidden')) {
                        modalNotificacoes.classList.remove('hidden');
                    }
                    
                    mensagemTexto.textContent = mensagemFinal;
                    mensagemProposta.style.display = 'block';
                    
                    // Remove o flag após um tempo para permitir recarregamento futuro
                    setTimeout(() => {
                        window.temMensagemErroNotificacao = false;
                    }, 5000);
                }
            } else {
                // Garante que o modal de notificações está aberto
                const modalNotificacoes = document.getElementById('modal-notificacoes');
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                
                if (modalNotificacoes && mensagemProposta && mensagemTexto) {
                    // Define o flag ANTES de qualquer coisa para evitar recarregamento
                    window.temMensagemErroNotificacao = true;
                    
                    // Abre o modal se estiver fechado
                    if (modalNotificacoes.classList.contains('hidden')) {
                        modalNotificacoes.classList.remove('hidden');
                    }
                    
                    mensagemTexto.textContent = 'Erro ao abrir candidatos. Tente novamente.';
                    mensagemProposta.style.display = 'block';
                    
                    // Remove o flag após um tempo para permitir recarregamento futuro
                    setTimeout(() => {
                        window.temMensagemErroNotificacao = false;
                    }, 5000);
                }
            }
            return false; // Retorna false para indicar erro
        }
    };

    // Listener global para notificações (se houver sistema de notificações)
    document.addEventListener('click', async (e) => {
        const notificacaoItem = e.target.closest('[data-notificacao-tipo="candidatura_time"]');
        if (notificacaoItem) {
            const timeId = notificacaoItem.dataset.timeId || notificacaoItem.dataset.notificacaoTimeId;
            if (timeId) {
                e.preventDefault();
                await window.abrirCandidatosPorNotificacao(timeId);
            }
        }
    });

    function mostrarCandidatosTime(time, botao, profissionalIdDestacado = null, tipoNotificacao = null) {
        console.log('📦 mostrarCandidatosTime chamado, time:', time, 'profissionalIdDestacado:', profissionalIdDestacado);
        
        // Remove modal anterior se existir
        const modalAnterior = document.getElementById('modal-candidatos-time');
        if (modalAnterior) {
            modalAnterior.remove();
        }

        // Cria novo modal
        const modal = document.createElement('div');
        modal.id = 'modal-candidatos-time';
        modal.className = 'modal-overlay';
        
        // Não adiciona ao body ainda - será adicionado no posicionamento

        // Garante que os candidatos estão populados
        const candidatos = time.candidatos || [];
        console.log('👥 Total de candidatos:', candidatos.length);
        console.log('📋 Candidatos:', candidatos);
        
        const candidatosPendentes = candidatos.filter(c => {
            // Verifica se o candidato tem status pendente
            const status = c.status || 'pendente';
            return status === 'pendente';
        });
        
        console.log('⏳ Candidatos pendentes filtrados:', candidatosPendentes.length);
        
        if (candidatosPendentes.length === 0) {
            // Remove o modal se não houver candidatos
            modal.remove();
            alert('Não há candidatos pendentes no momento.');
            return;
        }

        modal.innerHTML = `
            <div class="modal-content modal-grande">
                <div class="modal-body">
                    <div class="candidatos-lista">
                        ${candidatosPendentes.map(candidato => {
                            const prof = candidato.profissionalId;
                            const fotoProf = prof?.foto || prof?.avatarUrl || 'imagens/default-user.png';
                            const nomeProf = prof?.nome || 'Profissional';
                            const atuacaoProf = prof?.atuacao || candidato.tipo || 'Profissional';
                            const profId = prof?._id || prof?.id;
                            
                            // Verifica se este candidato deve ser destacado
                            const profIdStr = profId?.toString() || prof?.toString() || '';
                            const profissionalIdDestacadoStr = profissionalIdDestacado?.toString() || '';
                            const isDestacado = profissionalIdDestacado && profIdStr === profissionalIdDestacadoStr;
                            console.log('🔍 Verificando destaque:', { profIdStr, profissionalIdDestacadoStr, isDestacado, tipoNotificacao });
                            
                            // Informações de valor e contraproposta
                            const valor = candidato.valor || time.valorBase || 0;
                            const tipoCandidatura = candidato.tipoCandidatura || 'aceite';
                            const justificativa = candidato.justificativa || '';
                            const isContraproposta = tipoCandidatura === 'contraproposta';
                            
                            return `
                                <div class="candidato-item ${isDestacado ? 'candidato-destacado' : ''}" data-candidato-id="${candidato._id}" data-time-id="${time._id}" data-profissional-id="${profId}">
                                    <div class="candidato-info">
                                        <img src="${fotoProf}" alt="${nomeProf}" class="candidato-foto" onerror="this.src='imagens/default-user.png'">
                                        <div class="candidato-detalhes">
                                            <a href="/perfil.html?id=${profId}" class="candidato-nome">${nomeProf}</a>
                                            <span class="candidato-profissao">${atuacaoProf}</span>
                                            <div class="candidato-valor">
                                                ${isContraproposta ? `
                                                    <span class="valor-contraproposta">
                                                        <i class="fas fa-comment-dollar"></i> Contraproposta: <strong>R$ ${valor.toFixed(2)}/dia</strong>
                                                    </span>
                                                    ${justificativa ? `<span class="justificativa-contraproposta">"${justificativa}"</span>` : ''}
                                                ` : `
                                                    <span class="valor-aceito">
                                                        <i class="fas fa-check-circle"></i> Aceitou: <strong>R$ ${valor.toFixed(2)}/dia</strong>
                                                    </span>
                                                `}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="candidato-acoes">
                                        ${tipoNotificacao === 'confirmar_perfil_time' && candidato.tipoCandidatura === 'aceite' ? `
                                        <button class="btn-confirmar-perfil" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-check-circle"></i> Confirma
                                        </button>
                                        <button class="btn-recusar-perfil" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-times"></i> Recusar
                                        </button>
                                        ` : `
                                        <button class="btn-aceitar-candidato" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-check"></i> Aceitar
                                        </button>
                                        <button class="btn-recusar-candidato" data-candidato-id="${candidato._id}" data-time-id="${time._id}">
                                            <i class="fas fa-times"></i> Recusar
                                        </button>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        // Posiciona o modal ao lado do botão em telas maiores
        const botaoRect = botao ? botao.getBoundingClientRect() : { bottom: window.innerHeight / 2, left: window.innerWidth / 2 };
        const isMobile = window.innerWidth <= 767;
        const isMedia = window.innerWidth >= 768 && window.innerWidth <= 992;
        
        if (!isMobile && !isMedia) {
            // Em telas maiores, posiciona o modal FORA do container, ao lado (lateral)
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);
            const modalContent = modal.querySelector('.modal-content');
            const filtroTimesLocais = document.querySelector('.filtro-times-locais');
            
            if (filtroTimesLocais) {
                const containerRect = filtroTimesLocais.getBoundingClientRect();
                
                // Posiciona o modal fixo na tela, ao lado do container de times locais
                // Mas apenas na área do sidebar, não sobrepondo o feed
                modal.style.position = 'fixed';
                modal.style.top = `${containerRect.top}px`;
                modal.style.left = `${containerRect.left}px`;
                modal.style.width = `${containerRect.width}px`;
                modal.style.height = `${containerRect.height}px`;
                modal.style.display = 'flex';
                modal.style.alignItems = 'flex-start';
                modal.style.justifyContent = 'flex-start';
                modal.style.padding = '0';
                modal.style.background = 'transparent';
                modal.style.zIndex = '10000';
                modal.style.pointerEvents = 'none';
                modal.style.overflow = 'visible';
                
                // Posiciona o conteúdo do modal ao lado direito do container de times locais
                // Mas verifica se não vai ultrapassar a largura da tela
                const larguraDisponivel = window.innerWidth - containerRect.right - 32; // 16px de cada lado
                const larguraModal = Math.min(380, larguraDisponivel);
                
                // Obtém a posição do cabeçalho
                const header = document.querySelector('header');
                const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                const headerBottom = headerRect.bottom || 0;
                
                // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                let modalTop = containerRect.top + 35;
                
                // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                if (modalTop < headerBottom) {
                    // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                    modalTop = headerBottom + 10;
                }
                
                modalContent.style.position = 'fixed';
                modalContent.style.top = `${modalTop}px`;
                modalContent.style.left = `${containerRect.right + 16}px`; // Ao lado direito do container
                modalContent.style.right = 'auto';
                modalContent.style.maxWidth = `${larguraModal}px`;
                modalContent.style.width = `${larguraModal}px`;
                modalContent.style.margin = '0';
                modalContent.style.pointerEvents = 'auto';
                modalContent.style.zIndex = '5001'; // Acima do header e dos modais
                
                // Se não houver espaço suficiente à direita, posiciona à esquerda do container
                if (larguraDisponivel < 200) {
                    modalContent.style.left = 'auto';
                    modalContent.style.right = `${window.innerWidth - containerRect.left + 16}px`;
                }
                
                // Atualiza a posição quando a janela redimensiona ou quando o container rola
                const atualizarPosicaoModal = () => {
                    if (!document.body.contains(modal)) return;
                    
                    const novoContainerRect = filtroTimesLocais.getBoundingClientRect();
                    const novoBotaoRect = botao ? botao.getBoundingClientRect() : botaoRect;
                    
                    // Obtém a posição do cabeçalho
                    const header = document.querySelector('header');
                    const headerRect = header ? header.getBoundingClientRect() : { bottom: 0 };
                    const headerBottom = headerRect.bottom || 0;
                    
                    // Atualiza a área do modal
                    modal.style.top = `${novoContainerRect.top}px`;
                    modal.style.left = `${novoContainerRect.left}px`;
                    modal.style.width = `${novoContainerRect.width}px`;
                    modal.style.height = `${novoContainerRect.height}px`;
                    
                    // Calcula a posição do modal (desceu pela metade - estava em 10px, agora 35px)
                    let modalTop = novoContainerRect.top + 35;
                    
                    // O modal sempre fica abaixo do cabeçalho (z-index menor que 1000)
                    // Se o modal estiver acima do cabeçalho visualmente, ajusta a posição
                    if (modalTop < headerBottom) {
                        // Se o modal estiver atrás do cabeçalho, ajusta para ficar abaixo
                        modalTop = headerBottom + 10;
                    }
                    
                    // Atualiza a posição do conteúdo
                    modalContent.style.top = `${modalTop}px`;
                    modalContent.style.zIndex = '5001'; // Acima do header e dos modais
                    
                    // Verifica se há espaço à direita
                    const larguraDisponivel = window.innerWidth - novoContainerRect.right - 32;
                    const larguraModal = Math.min(380, larguraDisponivel);
                    
                    if (larguraDisponivel >= 200) {
                        modalContent.style.left = `${novoContainerRect.right + 16}px`;
                        modalContent.style.right = 'auto';
                    } else {
                        modalContent.style.left = 'auto';
                        modalContent.style.right = `${window.innerWidth - novoContainerRect.left + 16}px`;
                    }
                    
                    modalContent.style.maxWidth = `${larguraModal}px`;
                    modalContent.style.width = `${larguraModal}px`;
                };
                
                // Adiciona listeners para atualizar posição
                const timesContainer = document.querySelector('.times-container-lateral');
                if (timesContainer) {
                    timesContainer.addEventListener('scroll', atualizarPosicaoModal);
                }
                window.addEventListener('resize', atualizarPosicaoModal);
                window.addEventListener('scroll', atualizarPosicaoModal);
                
                // Remove os listeners quando o modal for fechado
                const removerListeners = () => {
                    if (timesContainer) {
                        timesContainer.removeEventListener('scroll', atualizarPosicaoModal);
                    }
                    window.removeEventListener('resize', atualizarPosicaoModal);
                    window.removeEventListener('scroll', atualizarPosicaoModal);
                };
                
                // Observa quando o modal é removido
                const observer = new MutationObserver(() => {
                    if (!document.body.contains(modal)) {
                        removerListeners();
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
                
                // Armazena a função de remoção no modal para usar no fecharModal
                modal._removerListeners = removerListeners;
            } else {
                // Fallback: posiciona como antes se não encontrar o container
                // Fecha sidebar em telas médias quando abre o modal
                if (typeof window.fecharSidebarSeMedia === 'function') {
                    window.fecharSidebarSeMedia();
                }
                
                document.body.appendChild(modal);
                const modalContent = modal.querySelector('.modal-content');
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.right = '0';
                modal.style.bottom = '0';
                modal.style.display = 'flex';
                modal.style.alignItems = 'flex-start';
                modal.style.justifyContent = 'flex-start';
                modal.style.padding = '0';
                modal.style.background = 'transparent';
                modal.style.zIndex = '10000';
                
                modalContent.style.position = 'absolute';
                modalContent.style.top = `${botaoRect.bottom + 8}px`;
                modalContent.style.left = `${botaoRect.left}px`;
                modalContent.style.right = 'auto';
                modalContent.style.maxWidth = '380px';
                modalContent.style.margin = '0';
            }
        } else {
            // Em telas menores, centraliza o modal
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            
            document.body.appendChild(modal);
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.right = '0';
            modal.style.bottom = '0';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.background = 'rgba(0, 0, 0, 0.5)';
            modal.style.zIndex = '10000';
        }

        // Fecha sidebar em telas médias quando abre o modal
        if (typeof window.fecharSidebarSeMedia === 'function') {
            window.fecharSidebarSeMedia();
        }
        
        modal.classList.remove('hidden');
        console.log('✅ Modal criado e exibido');

        // Destaca o candidato específico se foi passado profissionalIdDestacado
        if (profissionalIdDestacado) {
            setTimeout(() => {
                const candidatoItem = modal.querySelector(`[data-profissional-id="${profissionalIdDestacado}"]`);
                if (candidatoItem) {
                    console.log('✨ Destacando candidato:', profissionalIdDestacado);
                    candidatoItem.classList.add('candidato-destacado');
                    
                    // Efeito de piscar 2 vezes
                    let piscadas = 0;
                    const piscar = () => {
                        candidatoItem.style.opacity = '0.3';
                        setTimeout(() => {
                            candidatoItem.style.opacity = '1';
                            piscadas++;
                            if (piscadas < 2) {
                                setTimeout(piscar, 300);
                            } else {
                                // Remove a classe após o efeito
                                setTimeout(() => {
                                    candidatoItem.classList.remove('candidato-destacado');
                                }, 500);
                            }
                        }, 300);
                    };
                    piscar();
                    
                    // Scroll para o candidato destacado
                    candidatoItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    console.warn('⚠️ Candidato não encontrado para destacar:', profissionalIdDestacado);
                }
            }, 100);
        }

        // Listeners para aceitar/recusar
        modal.querySelectorAll('.btn-aceitar-candidato').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'aceitar', false);
            });
        });

        modal.querySelectorAll('.btn-recusar-candidato').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'recusar', false);
            });
        });
        
        // Listeners para confirmar/recusar perfil
        modal.querySelectorAll('.btn-confirmar-perfil').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'aceitar', true);
            });
        });

        modal.querySelectorAll('.btn-recusar-perfil').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const candidatoId = e.currentTarget.dataset.candidatoId;
                const timeId = e.currentTarget.dataset.timeId;
                await processarCandidato(timeId, candidatoId, 'recusar', true);
            });
        });

        // Fechar ao clicar fora
        const fecharModal = (e) => {
            if (!modal.contains(e.target) && e.target !== botao) {
                // Remove listeners se existirem
                if (modal._removerListeners) {
                    modal._removerListeners();
                }
                modal.remove();
                document.removeEventListener('click', fecharModal);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', fecharModal);
        }, 100);
    }

    async function processarCandidato(timeId, candidatoId, acao, isConfirmarPerfil = false) {
        try {
            // Usa rota diferente se for confirmação de perfil
            const endpoint = isConfirmarPerfil 
                ? `/api/times-projeto/${timeId}/candidatos/${candidatoId}/confirmar-perfil`
                : `/api/times-projeto/${timeId}/candidatos/${candidatoId}`;
            
            const response = await fetch(endpoint, {
                method: isConfirmarPerfil ? 'POST' : 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ acao })
            });

            const data = await response.json();

            if (data.success) {
                // Remove o candidato da lista visualmente
                const candidatoItem = document.querySelector(`.candidato-item[data-candidato-id="${candidatoId}"]`);
                if (candidatoItem) {
                    candidatoItem.remove();
                }
                
                // Se não houver mais candidatos pendentes, fecha o modal
                const modal = document.getElementById('modal-candidatos-time');
                if (modal) {
                    const candidatosRestantes = modal.querySelectorAll('.candidato-item');
                    if (candidatosRestantes.length === 0) {
                        modal.remove();
                    }
                }
                
                // Recarrega os times para atualizar contador
                setTimeout(() => {
                    carregarTimesLocais();
                }, 300);
            } else {
                alert(data.message || 'Erro ao processar candidato.');
            }
        } catch (error) {
            console.error('Erro ao processar candidato:', error);
            alert('Erro ao processar candidato. Tente novamente.');
        }
    }

    if (btnCriarTime) {
        btnCriarTime.addEventListener('click', () => {
            // 🆕 ATUALIZADO: Permite profissionais também criarem times
            // Fecha sidebar em telas médias quando abre o modal
            if (typeof window.fecharSidebarSeMedia === 'function') {
                window.fecharSidebarSeMedia();
            }
            modalCriarTime?.classList.remove('hidden');
        });
    }

    // Adicionar/remover profissionais no formulário
    if (profissionaisLista) {
        // Adiciona listeners para checkboxes "A Combinar" existentes no carregamento
        profissionaisLista.querySelectorAll('.a-combinar-checkbox').forEach(checkbox => {
            const profissionalItem = checkbox.closest('.profissional-item');
            const valorInput = profissionalItem.querySelector('.valor-profissional');
            const label = checkbox.closest('.checkbox-a-combinar');
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    valorInput.disabled = true;
                    valorInput.value = '';
                    valorInput.removeAttribute('required');
                    label.classList.add('checked');
                } else {
                    valorInput.disabled = false;
                    valorInput.setAttribute('required', 'required');
                    label.classList.remove('checked');
                }
            });
            
            // Verifica estado inicial
            if (checkbox.checked) {
                label.classList.add('checked');
            }
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.id === 'btn-adicionar-profissional') {
                const novoItem = document.createElement('div');
                novoItem.className = 'profissional-item';
                novoItem.innerHTML = `
                    <input type="text" placeholder="Tipo (ex: pedreiro)" class="tipo-profissional" required>
                    <input type="number" placeholder="Qtd" class="qtd-profissional" min="1" value="1" required>
                    <input type="number" placeholder="Valor/dia (R$)" class="valor-profissional" min="0" step="0.01">
                    <label class="checkbox-a-combinar">
                        <span>A Combinar</span>
                        <input type="checkbox" class="a-combinar-checkbox">
                    </label>
                    <button type="button" class="btn-remover-profissional"><i class="fas fa-trash"></i></button>
                `;
                profissionaisLista.appendChild(novoItem);
                
                // Adiciona listener para o checkbox "A Combinar"
                const checkbox = novoItem.querySelector('.a-combinar-checkbox');
                const valorInput = novoItem.querySelector('.valor-profissional');
                const label = novoItem.querySelector('.checkbox-a-combinar');
                
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        valorInput.disabled = true;
                        valorInput.value = '';
                        valorInput.removeAttribute('required');
                        label.classList.add('checked');
                    } else {
                        valorInput.disabled = false;
                        valorInput.setAttribute('required', 'required');
                        label.classList.remove('checked');
                    }
                });
            }
            
            // Listener para checkboxes "A Combinar" existentes
            if (e.target.classList.contains('a-combinar-checkbox')) {
                const profissionalItem = e.target.closest('.profissional-item');
                const valorInput = profissionalItem.querySelector('.valor-profissional');
                const label = e.target.closest('.checkbox-a-combinar');
                
                if (e.target.checked) {
                    valorInput.disabled = true;
                    valorInput.value = '';
                    valorInput.removeAttribute('required');
                    label.classList.add('checked');
                } else {
                    valorInput.disabled = false;
                    valorInput.setAttribute('required', 'required');
                    label.classList.remove('checked');
                }
            }
            
            if (e.target.classList.contains('btn-remover-profissional') || e.target.closest('.btn-remover-profissional')) {
                const botao = e.target.classList.contains('btn-remover-profissional') ? e.target : e.target.closest('.btn-remover-profissional');
                if (profissionaisLista.children.length > 1) {
                    botao.closest('.profissional-item').remove();
                } else {
                    alert('Você precisa de pelo menos um profissional.');
                }
            }
        });
    }

    if (formCriarTime) {
        formCriarTime.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Remove mensagem de erro anterior
            const mensagemErro = document.getElementById('mensagem-erro-criar-time');
            if (mensagemErro) {
                mensagemErro.style.display = 'none';
                mensagemErro.textContent = '';
            }
            
            // Remove classes de erro anteriores
            document.querySelectorAll('.campo-erro').forEach(el => {
                el.classList.remove('campo-erro');
                el.style.borderColor = '';
            });
            
            // Validação dos campos obrigatórios
            const titulo = document.getElementById('time-titulo');
            const descricao = document.getElementById('time-descricao');
            const rua = document.getElementById('time-rua');
            const bairro = document.getElementById('time-bairro');
            const numero = document.getElementById('time-numero');
            const cidade = document.getElementById('time-cidade');
            const estado = document.getElementById('time-estado');
            
            const erros = [];
            let primeiroCampoErro = null;
            
            // Valida título
            if (!titulo || !titulo.value.trim()) {
                erros.push('Título do Projeto');
                if (!primeiroCampoErro) primeiroCampoErro = titulo;
                titulo.classList.add('campo-erro');
                titulo.style.borderColor = '#dc3545';
            }
            
            // Valida descrição
            if (!descricao || !descricao.value.trim()) {
                erros.push('Descrição');
                if (!primeiroCampoErro) primeiroCampoErro = descricao;
                descricao.classList.add('campo-erro');
                descricao.style.borderColor = '#dc3545';
            }
            
            // Valida rua
            if (!rua || !rua.value.trim()) {
                erros.push('Endereço (Rua)');
                if (!primeiroCampoErro) primeiroCampoErro = rua;
                rua.classList.add('campo-erro');
                rua.style.borderColor = '#dc3545';
            }
            
            // Valida bairro
            if (!bairro || !bairro.value.trim()) {
                erros.push('Bairro');
                if (!primeiroCampoErro) primeiroCampoErro = bairro;
                bairro.classList.add('campo-erro');
                bairro.style.borderColor = '#dc3545';
            }
            
            // Valida número
            if (!numero || !numero.value.trim()) {
                erros.push('Número');
                if (!primeiroCampoErro) primeiroCampoErro = numero;
                numero.classList.add('campo-erro');
                numero.style.borderColor = '#dc3545';
            }
            
            // Valida cidade
            if (!cidade || !cidade.value.trim()) {
                erros.push('Cidade');
                if (!primeiroCampoErro) primeiroCampoErro = cidade;
                cidade.classList.add('campo-erro');
                cidade.style.borderColor = '#dc3545';
            }
            
            // Valida estado
            if (!estado || !estado.value.trim()) {
                erros.push('Estado');
                if (!primeiroCampoErro) primeiroCampoErro = estado;
                estado.classList.add('campo-erro');
                estado.style.borderColor = '#dc3545';
            }
            
            // Valida profissionais
            const profissionaisItems = Array.from(profissionaisLista.children);
            if (profissionaisItems.length === 0) {
                erros.push('Adicione pelo menos um profissional');
            } else {
                profissionaisItems.forEach((item, index) => {
                    const tipoInput = item.querySelector('.tipo-profissional');
                    const quantidadeInput = item.querySelector('.qtd-profissional');
                    const valorInput = item.querySelector('.valor-profissional');
                    const aCombinarCheckbox = item.querySelector('.a-combinar-checkbox');
                    
                    // Valida tipo
                    if (!tipoInput || !tipoInput.value.trim()) {
                        erros.push(`Tipo do profissional ${index + 1}`);
                        if (!primeiroCampoErro) primeiroCampoErro = tipoInput;
                        tipoInput.classList.add('campo-erro');
                        tipoInput.style.borderColor = '#dc3545';
                    }
                    
                    // Valida quantidade
                    const quantidade = parseInt(quantidadeInput?.value || 0);
                    if (!quantidadeInput || !quantidade || quantidade <= 0) {
                        erros.push(`Quantidade do profissional ${index + 1}`);
                        if (!primeiroCampoErro) primeiroCampoErro = quantidadeInput;
                        quantidadeInput.classList.add('campo-erro');
                        quantidadeInput.style.borderColor = '#dc3545';
                    }
                    
                    // Valida valor OU "A Combinar"
                    const aCombinar = aCombinarCheckbox?.checked || false;
                    const valor = valorInput ? parseFloat(valorInput.value) : 0;
                    
                    if (!aCombinar && (!valor || valor <= 0)) {
                        erros.push(`Valor ou "A Combinar" para o profissional ${index + 1} (${tipoInput?.value || 'sem tipo'})`);
                        if (!primeiroCampoErro) primeiroCampoErro = valorInput || aCombinarCheckbox;
                        if (valorInput) {
                            valorInput.classList.add('campo-erro');
                            valorInput.style.borderColor = '#dc3545';
                        }
                    }
                });
            }
            
            // Se houver erros, mostra mensagem e rola até o primeiro campo
            if (erros.length > 0) {
                if (mensagemErro) {
                    mensagemErro.textContent = `Por favor, preencha os seguintes campos: ${erros.join(', ')}.`;
                    mensagemErro.style.display = 'block';
                }
                
                // Rola até o primeiro campo com erro em telas menores
                if (primeiroCampoErro && window.innerWidth <= 767) {
                    setTimeout(() => {
                        primeiroCampoErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
                
                return; // Para a execução
            }
            
            // Se chegou aqui, todos os campos estão válidos
            const profissionais = profissionaisItems.map(item => {
                const tipo = item.querySelector('.tipo-profissional').value;
                const quantidade = parseInt(item.querySelector('.qtd-profissional').value);
                const aCombinar = item.querySelector('.a-combinar-checkbox').checked;
                const valorInput = item.querySelector('.valor-profissional');
                const valorBase = aCombinar ? null : parseFloat(valorInput.value);
                
                return {
                    tipo: tipo,
                    quantidade: quantidade,
                    valorBase: valorBase,
                    aCombinar: aCombinar
                };
            });
            
            const timeData = {
                titulo: titulo.value.trim(),
                descricao: descricao.value.trim(),
                localizacao: {
                    rua: rua.value.trim(),
                    numero: numero.value.trim(),
                    bairro: bairro.value.trim(),
                    cidade: cidade.value.trim(),
                    estado: estado.value.toUpperCase().trim()
                },
                profissionaisNecessarios: profissionais
            };
            
            try {
                const response = await fetch('/api/times-projeto', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(timeData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Limpa o formulário
                    formCriarTime.reset();
                    
                    // Esconde o formulário e mostra mensagem de sucesso dentro do modal
                    const modalBody = modalCriarTime?.querySelector('.modal-body');
                    const formElement = formCriarTime;
                    
                    if (modalBody && formElement) {
                        // Esconde o formulário
                        formElement.style.display = 'none';
                        
                        // Remove mensagem anterior se existir
                        const mensagemAnterior = modalBody.querySelector('.mensagem-sucesso-time');
                        if (mensagemAnterior) {
                            mensagemAnterior.remove();
                        }
                        
                        // Cria nova mensagem de sucesso
                        const mensagemSucesso = document.createElement('div');
                        mensagemSucesso.className = 'mensagem-sucesso-time';
                        mensagemSucesso.innerHTML = `
                            <div style="text-align: center; padding: 40px 20px;">
                                <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
                                <div style="color: #28a745; font-size: 20px; font-weight: 600; margin-bottom: 10px;">
                                    Equipe criada com sucesso!
                                </div>
                            </div>
                        `;
                        mensagemSucesso.style.cssText = `
                            color: #28a745;
                            animation: fadeIn 0.3s ease-in;
                        `;
                        
                        // Adiciona animação fadeIn se não existir
                        if (!document.querySelector('#animacao-fadein')) {
                            const style = document.createElement('style');
                            style.id = 'animacao-fadein';
                            style.textContent = `
                                @keyframes fadeIn {
                                    from { opacity: 0; transform: translateY(-10px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        // Insere a mensagem no modal-body
                        modalBody.appendChild(mensagemSucesso);
                        
                        // Fecha o modal após 2 segundos
                        setTimeout(() => {
                            // Remove estilos inline do modal para garantir que possa ser reaberto
                            if (modalCriarTime) {
                                modalCriarTime.classList.add('hidden');
                                modalCriarTime.style.cssText = '';
                            }
                            
                            // Restaura o formulário para a próxima vez
                            if (formElement) {
                                formElement.style.display = '';
                            }
                            
                            // Remove a mensagem
                            if (mensagemSucesso.parentElement) {
                                mensagemSucesso.remove();
                            }
                        }, 2000);
                    }
                    
                    // Recarrega os times após um pequeno delay para garantir que o time foi salvo no banco
                    setTimeout(() => {
                        carregarTimesLocais();
                    }, 500);
                } else {
                    // Mostra erro na mensagem de erro
                    if (mensagemErro) {
                        mensagemErro.textContent = data.message || 'Erro ao criar time.';
                        mensagemErro.style.display = 'block';
                    } else {
                        alert(data.message || 'Erro ao criar time.');
                    }
                }
            } catch (error) {
                console.error('Erro ao criar time:', error);
                // Mostra erro na mensagem de erro
                if (mensagemErro) {
                    mensagemErro.textContent = error.message || 'Erro ao criar time de projeto.';
                    mensagemErro.style.display = 'block';
                } else {
                    alert(error.message || 'Erro ao criar time de projeto.');
                }
            }
        });
        
        // Remove erro quando o usuário começa a digitar
        const camposValidacao = [
            'time-titulo',
            'time-descricao',
            'time-rua',
            'time-bairro',
            'time-numero',
            'time-cidade',
            'time-estado'
        ];
        
        camposValidacao.forEach(id => {
            const campo = document.getElementById(id);
            if (campo) {
                campo.addEventListener('input', function() {
                    this.classList.remove('campo-erro');
                    this.style.borderColor = '';
                });
            }
        });
        
        // Remove erro dos campos de profissionais quando começam a digitar
        if (profissionaisLista) {
            profissionaisLista.addEventListener('input', function(e) {
                const campo = e.target;
                if (campo.classList.contains('tipo-profissional') || 
                    campo.classList.contains('qtd-profissional') || 
                    campo.classList.contains('valor-profissional')) {
                    campo.classList.remove('campo-erro');
                    campo.style.borderColor = '';
                }
            });
            
            // Remove erro quando marca "A Combinar"
            profissionaisLista.addEventListener('change', function(e) {
                if (e.target.classList.contains('a-combinar-checkbox')) {
                    const item = e.target.closest('.profissional-item');
                    const valorInput = item?.querySelector('.valor-profissional');
                    if (valorInput) {
                        valorInput.classList.remove('campo-erro');
                        valorInput.style.borderColor = '';
                    }
                }
            });
        }
    }

    // Fechar modais
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.btn-close-modal');
        if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const modalId = closeBtn.dataset.modal;
            if (modalId) {
                document.getElementById(modalId)?.classList.add('hidden');
            }
            // Sincroniza trava de rolagem quando fecha
            try { window.syncModalScrollLock?.(); } catch {}
            return;
        }
        
        // Fechar ao clicar fora do modal (no overlay/backdrop)
        // Verifica se o clique foi no overlay, não no conteúdo do modal
        const modalOverlay = e.target.closest('.modal-overlay');
        if (modalOverlay) {
            const modalContent = modalOverlay.querySelector('.modal-content');
            
            // Se clicou diretamente no overlay (não no conteúdo)
            if (e.target === modalOverlay || (modalContent && !modalContent.contains(e.target))) {
                // Não fecha se clicou em um botão dentro do modal
                if (!e.target.closest('button') || e.target.classList.contains('btn-close-modal')) {
                    e.preventDefault();
                    e.stopPropagation();
                    modalOverlay.classList.add('hidden');
                    // Sincroniza trava de rolagem quando fecha
                    try { window.syncModalScrollLock?.(); } catch {}
                    
                    // Se o modal foi criado dinamicamente, remove do DOM após animação
                    // IMPORTANTE: NÃO remove modais permanentes que estão definidos no HTML
                    // Lista completa de todos os modais permanentes que não devem ser removidos
                    const modaisPermanentes = [
                        // Modais de notificações
                        'modal-notificacoes',
                        'modal-aviso-notificacoes',
                        // Modais de pedidos e serviços
                        'modal-propostas',
                        'modal-servicos-ativos',
                        'modal-pedido-urgente',
                        'modal-pedidos-urgentes-profissional',
                        'modal-meus-pedidos-urgentes',
                        'modal-pedidos-concluidos',
                        'modal-enviar-proposta',
                        // Modais de times e projetos
                        'modal-criar-time',
                        'modal-criar-time-local',
                        'modal-candidatos-vaga',
                        'modal-projeto-time',
                        // Modais de pagamento
                        'modal-pagamento-seguro',
                        'modal-liberar-pagamento',
                        'modal-meus-pagamentos',
                        'modal-pagamentos-garantidos',
                        // Modais de vagas
                        'modal-vaga-relampago',
                        'modal-vagas-relampago-profissional',
                        // Modais de disputas
                        'modal-criar-disputa',
                        'modal-minhas-disputas',
                        // Modais de destaque
                        'modal-destaque-servico',
                        // Modais de precisar agora
                        'modal-preciso-agora',
                        // Modais de confirmação
                        'modal-confirmacao-acao',
                        // Modais de admin
                        'modal-dashboard-admin',
                        // Modais de proposta aceita
                        'modal-proposta-aceita',
                        // Modais de perfil
                        'modal-preview-avatar',
                        'modal-validar-projeto',
                        'modal-adicionar-projeto',
                        'modal-lembrete-avaliacao',
                        'modal-postagem-completa',
                        // Modais de imagem
                        'modal-image-pedido',
                        'modal-image'
                    ];
                    const isModalPermanente = modalOverlay.id && modaisPermanentes.includes(modalOverlay.id);
                    
                    // Apenas remove modais que foram criados dinamicamente (não estão na lista de permanentes)
                    if (modalOverlay.id && (modalOverlay.id.includes('modal-') || modalOverlay.id.includes('popup-')) && !isModalPermanente) {
                        setTimeout(() => {
                            if (modalOverlay.parentNode && modalOverlay.classList.contains('hidden')) {
                                modalOverlay.remove();
                            }
                        }, 300);
                    }
                }
            }
        }
    });

    // ----------------------------------------------------------------------
    // Scroll lock global quando QUALQUER modal abrir (evita 2 barras de rolagem)
    // ----------------------------------------------------------------------
    window.syncModalScrollLock = function syncModalScrollLock() {
        const anyOpenModal = document.querySelector('.modal-overlay:not(.hidden)');
        document.documentElement.classList.toggle('modal-open', !!anyOpenModal);
        document.body.classList.toggle('modal-open', !!anyOpenModal);
        // Força o travamento mesmo se alguma regra CSS estiver brigando.
        try {
            document.body.style.overflow = anyOpenModal ? 'hidden' : '';
        } catch {}
    };

    // Observa mudanças de classe em modais (abrir/fechar) e sincroniza automaticamente.
    try {
        const modalObserver = new MutationObserver(() => window.syncModalScrollLock());
        modalObserver.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
        window.syncModalScrollLock();
    } catch {}

    function atualizarBotoesDestaques() {
        if (!destaquesScroll || !btnDestaquesVoltar || !btnDestaquesAvancar) return;
        const maxScrollLeft = Math.max(0, destaquesScroll.scrollWidth - destaquesScroll.clientWidth);
        const atStart = destaquesScroll.scrollLeft <= 4;
        const atEnd = destaquesScroll.scrollLeft >= maxScrollLeft - 4;
        const hasOverflow = (destaquesScroll.scrollWidth - destaquesScroll.clientWidth) > 12;

        if (hasOverflow && !atStart) {
            btnDestaquesVoltar.classList.add('show');
        } else {
            btnDestaquesVoltar.classList.remove('show');
        }

        if (hasOverflow && !atEnd) {
            btnDestaquesAvancar.classList.add('show');
        } else {
            btnDestaquesAvancar.classList.remove('show');
        }
    }

    // Botões de rolagem lateral dos destaques
    if (btnDestaquesAvancar && destaquesScroll) {
        btnDestaquesAvancar.addEventListener('click', () => {
            const delta = destaquesScroll.clientWidth * 0.8;
            destaquesScroll.scrollBy({ left: delta, behavior: 'smooth' });
            setTimeout(atualizarBotoesDestaques, 220);
        });
    }
    if (btnDestaquesVoltar && destaquesScroll) {
        btnDestaquesVoltar.addEventListener('click', () => {
            const delta = destaquesScroll.clientWidth * 0.8;
            destaquesScroll.scrollBy({ left: -delta, behavior: 'smooth' });
            setTimeout(atualizarBotoesDestaques, 220);
        });
    }
    if (destaquesScroll) {
        destaquesScroll.addEventListener('scroll', atualizarBotoesDestaques);
        window.addEventListener('resize', () => setTimeout(atualizarBotoesDestaques, 80));
        setTimeout(atualizarBotoesDestaques, 80);
    }

    // Drag-to-scroll na faixa de destaques
    if (destaquesScroll) {
        let isDragging = false;
        let startX = 0;
        let scrollStart = 0;

        const startDrag = (x) => {
            isDragging = true;
            startX = x;
            scrollStart = destaquesScroll.scrollLeft;
        };
        const moveDrag = (x) => {
            if (!isDragging) return;
            const dx = x - startX;
            destaquesScroll.scrollLeft = scrollStart - dx;
        };
        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            atualizarBotoesDestaques();
        };

        destaquesScroll.addEventListener('mousedown', (e) => startDrag(e.pageX));
        window.addEventListener('mousemove', (e) => moveDrag(e.pageX));
        window.addEventListener('mouseup', endDrag);
        destaquesScroll.addEventListener('mouseleave', endDrag);

        destaquesScroll.addEventListener('touchstart', (e) => {
            const x = e.touches[0]?.pageX || 0;
            startDrag(x);
        }, { passive: true });
        destaquesScroll.addEventListener('touchmove', (e) => {
            const x = e.touches[0]?.pageX || 0;
            moveDrag(x);
        }, { passive: true });
        destaquesScroll.addEventListener('touchend', endDrag);
        destaquesScroll.addEventListener('touchcancel', endDrag);
    }

    // ----------------------------------------------------------------------
    // VALIDAÇÃO DA SESSÃO (TRATAR TOKEN INVÁLIDO / EXPIRADO)
    // ----------------------------------------------------------------------
    async function validarSessaoAtiva() {
        // Se não houver token ou userId, já consideramos sessão inválida aqui
        if (!token || !userId) {
            return false;
        }

        try {
            const resp = await fetch('/api/usuario/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (resp.status === 401) {
                console.warn('Sessão inválida ou expirada. Limpando dados locais e redirecionando para login.');
                const jaLogou = localStorage.getItem('helpy-ja-logou');
                localStorage.clear();
                if (jaLogou) {
                    localStorage.setItem('helpy-ja-logou', jaLogou);
                }
                window.location.replace('/login');
                return false;
            }

            // Se der outro erro (500, etc.), não vamos derrubar o usuário à força
            return true;
        } catch (e) {
            console.error('Erro ao validar sessão:', e);
            // Em caso de erro de rede, mantemos o usuário e deixamos as rotas lidarem com isso
            return true;
        }
    }

    // --- INICIALIZAÇÃO ---
    const deferNonCriticalInit = (fn) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout: 1200 });
        } else {
            setTimeout(fn, 400);
        }
    };
    (async () => {
        const urlParams = new URLSearchParams(window.location.search);
        if (!token || !userId) {
            const isLoginPath = path.endsWith('/login') || path.endsWith('/login.html');
            const isCadastroPath = path.endsWith('/cadastro') || path.endsWith('/cadastro.html');
            // Se está no feed (ou outra página protegida) sem login → manda para /login
            if (!isLoginPath && !isCadastroPath) {
                window.location.href = '/login';
            } else {
                // Se está na página de login/cadastro, garante header limpo
                if (userNameHeader) userNameHeader.textContent = '';
                if (userAvatarHeader) userAvatarHeader.src = '/imagens/default-user.png';
            }
        } else {
            // Antes de carregar o feed e outras informações, valida se o token ainda é aceito pelo backend
            const sessaoValida = await validarSessaoAtiva();
            if (!sessaoValida) {
                return;
            }

            const abrirCandidatos = urlParams.get('abrirCandidatos');
            const profissionalId = urlParams.get('profissionalId');
            const candidatoId = urlParams.get('candidatoId');
            const tipoNotificacao = urlParams.get('tipoNotificacao');
            if (abrirCandidatos && window.abrirCandidatosPorNotificacao) {
                setTimeout(() => {
                    window.abrirCandidatosPorNotificacao(abrirCandidatos, profissionalId, tipoNotificacao, candidatoId);
                    // Remove o parâmetro da URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                }, 1000); // Aguarda carregar os times primeiro
            }

            // Recarrega times quando a página volta ao foco (caso tenha mudado a cidade em outra aba)
            window.addEventListener('focus', () => {
                carregarTimesLocais();
            });

            // Recarrega times quando a cidade é atualizada (evento customizado)
            window.addEventListener('cidadeAtualizada', () => {
                carregarTimesLocais();
            });

            // Recarrega times quando a página de configurações é fechada (se foi aberta na mesma aba)
            window.addEventListener('storage', (e) => {
                if (e.key === 'cidadeAtualizada' || e.key === 'perfilAtualizado') {
                    carregarTimesLocais();
                }
            });

            if (postsContainer) {
                loadHeaderInfo();
                fetchPosts();
            }
            if (destaquesScroll) {
                deferNonCriticalInit(() => fetchDestaques());
            }

            if (explorarPage) {
                try {
                    const storedCities = JSON.parse(localStorage.getItem('explorarCities') || '[]');
                    if (Array.isArray(storedCities)) {
                        explorarSelectedCities = storedCities.filter(Boolean);
                    }
                } catch (e) {
                    explorarSelectedCities = [];
                }
                bootstrapExplorarCities();
                setupExplorarSwipe();
            }
        }
        
        // Abrir modal de propostas se houver pedidoId na URL
        const urlParamsCheck = new URLSearchParams(window.location.search);
        const pedidoIdFromUrl = urlParamsCheck.get('pedidoId');
        const hashFromUrl = window.location.hash;
        
        if (pedidoIdFromUrl && hashFromUrl === '#propostas') {
            // Aguarda o carregamento completo da página e scripts
            setTimeout(async () => {
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoIdFromUrl);
                }
            }, 1000);
        } else if (pedidoIdFromUrl && hashFromUrl === '#meus-pedidos-urgentes') {
            // Redireciona para o modal unificado "Procurar Pedidos" e abre "Meus serviços ativos"
            setTimeout(async () => {
                const modalProcurarPedidos = document.getElementById('modal-pedidos-urgentes-profissional');
                const btnServicosAtivos = document.getElementById('btn-servicos-ativos');
                if (modalProcurarPedidos) {
                    modalProcurarPedidos.classList.remove('hidden');
                    // Clica no botão "Meus serviços ativos" para mostrar os pedidos do usuário
                    if (btnServicosAtivos && typeof window.carregarServicosAtivos === 'function') {
                        await window.carregarServicosAtivos();
                    }
                    // Fecha sidebar em telas médias quando abre o modal
                    if (typeof window.fecharSidebarSeMedia === 'function') {
                        window.fecharSidebarSeMedia();
                    }
                    modalMeusPedidos.classList.remove('hidden');
                } else if (btnMeusPedidos) {
                    btnMeusPedidos.click();
                }
            }, 1000);
        }
        
        // Verifica se há parâmetros na URL para navegar até um post específico
        const urlParamsNav = new URLSearchParams(window.location.search);
        const postIdNav = urlParamsNav.get('postId');
        const commentIdNav = urlParamsNav.get('commentId');
        const replyIdNav = urlParamsNav.get('replyId');
        
        if (postIdNav) {
            console.log('📍 Parâmetros de navegação encontrados:', { postIdNav, commentIdNav, replyIdNav });
            setTimeout(() => {
                if (window.navegarParaPost) {
                    window.navegarParaPost(postIdNav, commentIdNav, replyIdNav);
                }
            }, 1500); // Aguarda posts carregarem
        }
    
    // Função global para navegar até um post e comentário/resposta específico (usada por notificações)
    window.navegarParaPost = async function(postId, commentId = null, replyId = null) {
        console.log('📱 [script.js] Navegando para post:', { postId, commentId, replyId });
        
        // Função auxiliar para encontrar o post
        const encontrarPost = () => {
            let postElement = Array.from(document.querySelectorAll('article.post')).find(article => {
                const btn = article.querySelector(`button[data-post-id="${postId}"]`);
                return btn !== null;
            });
            
            if (!postElement) {
                // Tenta encontrar por qualquer article que contenha o botão
                postElement = Array.from(document.querySelectorAll('article')).find(article => {
                    const btn = article.querySelector(`button[data-post-id="${postId}"]`);
                    return btn !== null;
                });
            }
            
            return postElement;
        };
        
        // Tenta encontrar o post, com retry
        let postElement = encontrarPost();
        let tentativas = 0;
        const maxTentativas = 5;
        
        while (!postElement && tentativas < maxTentativas) {
            console.log(`⏳ Post não encontrado, tentativa ${tentativas + 1}/${maxTentativas}, aguardando...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            postElement = encontrarPost();
            tentativas++;
        }
        
        if (postElement) {
            console.log('✅ Post encontrado:', postElement);
            
            // Expande comentários se necessário
            const btnComentarios = postElement.querySelector(`.btn-comment[data-post-id="${postId}"]`);
            if (btnComentarios) {
                const comentariosDiv = postElement.querySelector('.post-comments');
                if (comentariosDiv && (comentariosDiv.classList.contains('hidden') || !comentariosDiv.classList.contains('visible'))) {
                    console.log('📂 Expandindo comentários...');
                    btnComentarios.click();
                    await new Promise(resolve => setTimeout(resolve, 400));
                }
            }
            
            // Rola até o post
            console.log('📜 Rolando até o post...');
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Se tem replyId, rola até a resposta
            if (replyId) {
                console.log('🔍 Procurando resposta:', replyId);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                const allComments = postElement.querySelectorAll('.comment');
                let replyElement = null;
                
                for (const comment of allComments) {
                    // Expande respostas do comentário se necessário
                    const replyList = comment.querySelector('.reply-list');
                    if (replyList && (replyList.classList.contains('oculto') || replyList.style.display === 'none')) {
                        const btnToggleReplies = comment.querySelector('.btn-toggle-replies');
                        if (btnToggleReplies) {
                            console.log('📂 Expandindo respostas do comentário...');
                            btnToggleReplies.click();
                            await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                    
                    // Busca a resposta dentro deste comentário
                    const replies = comment.querySelectorAll('.reply');
                    for (const reply of replies) {
                        const replyIdAttr = reply.getAttribute('data-reply-id');
                        if (replyIdAttr === replyId || String(replyIdAttr) === String(replyId)) {
                            replyElement = reply;
                            break;
                        }
                    }
                    
                    if (replyElement) break;
                }
                
                if (replyElement) {
                    console.log('✅ Resposta encontrada, rolando...');
                    replyElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    replyElement.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
                    replyElement.style.transition = 'background-color 0.3s';
                    setTimeout(() => {
                        replyElement.style.backgroundColor = '';
                    }, 2000);
                } else {
                    console.warn('⚠️ Resposta não encontrada:', replyId);
                }
            }
            // Se tem commentId, rola até o comentário
            else if (commentId) {
                console.log('🔍 Procurando comentário:', commentId);
                await new Promise(resolve => setTimeout(resolve, 300));
                
                let commentElement = postElement.querySelector(`.comment[data-comment-id="${commentId}"]`);
                
                if (!commentElement) {
                    console.log('🔍 Comentário não encontrado com seletor direto, buscando em todos...');
                    const allComments = postElement.querySelectorAll('.comment');
                    console.log(`📋 Total de comentários encontrados: ${allComments.length}`);
                    for (const comment of allComments) {
                        const commentIdAttr = comment.getAttribute('data-comment-id');
                        console.log(`🔍 Comparando: ${commentIdAttr} === ${commentId}?`, commentIdAttr === commentId);
                        if (commentIdAttr === commentId || String(commentIdAttr) === String(commentId)) {
                            commentElement = comment;
                            console.log('✅ Comentário encontrado!');
                            break;
                        }
                    }
                }
                
                if (commentElement) {
                    console.log('✅ Comentário encontrado, rolando...');
                    commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    commentElement.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
                    commentElement.style.transition = 'background-color 0.3s';
                    setTimeout(() => {
                        commentElement.style.backgroundColor = '';
                    }, 2000);
                } else {
                    console.warn('⚠️ Comentário não encontrado:', commentId);
                    // Lista todos os IDs de comentários para debug
                    const allComments = postElement.querySelectorAll('.comment');
                    const commentIds = Array.from(allComments).map(c => c.getAttribute('data-comment-id'));
                    console.log('📋 IDs de comentários disponíveis:', commentIds);
                }
            } else {
                // Apenas destaca o post
                console.log('✨ Apenas destacando o post...');
                postElement.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
                postElement.style.transition = 'background-color 0.3s';
                setTimeout(() => {
                    postElement.style.backgroundColor = '';
                }, 2000);
            }
        } else {
            console.error('❌ Post não encontrado após várias tentativas:', postId);
            // Lista todos os posts disponíveis para debug
            const allPosts = document.querySelectorAll('article.post');
            const postIds = Array.from(allPosts).map(article => {
                const btn = article.querySelector('button[data-post-id]');
                return btn ? btn.getAttribute('data-post-id') : null;
            }).filter(Boolean);
            console.log('📋 IDs de posts disponíveis:', postIds);
        }
    };
    
    })();
});
