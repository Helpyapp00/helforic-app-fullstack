// ============================================
// HEADER E NOTIFICAÇÕES COMPARTILHADO
// ============================================
// Este arquivo contém toda a lógica de cabeçalho e notificações
// que é compartilhada entre feed, perfil e outras páginas

(function() {
    'use strict';
    
    // Variáveis globais compartilhadas
    let modoSelecao = false;
    let notificacoesSelecionadas = new Set();
    let token = null;
    let carregarNotificacoes = null;
    let toggleModoSelecao = null;

    // Logs de debug (silenciosos por padrão).
    // Para ativar: localStorage.setItem('DEBUG_NOTIFICACOES', '1')
    // NÃO ativa automaticamente em localhost para evitar vazamento por padrão.
    const DEBUG_NOTIFICACOES = localStorage.getItem('DEBUG_NOTIFICACOES') === '1';

    function dlog(...args) { if (DEBUG_NOTIFICACOES) console.log(...args); }
    function dwarn(...args) { if (DEBUG_NOTIFICACOES) console.warn(...args); }
    
    // Função para mostrar modal de aviso/confirmação customizado
    window.mostrarModalAviso = function(mensagem, titulo = 'Aviso', tipo = 'aviso', mostrarCancelar = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('modal-aviso-notificacoes');
            const icon = document.getElementById('modal-aviso-icon');
            const tituloEl = document.getElementById('modal-aviso-titulo');
            const mensagemEl = document.getElementById('modal-aviso-mensagem');
            const btnOk = document.getElementById('modal-aviso-btn-ok');
            const btnCancelar = document.getElementById('modal-aviso-btn-cancelar');
            
            if (!modal || !icon || !tituloEl || !mensagemEl || !btnOk) {
                // Fallback para alert padrão se o modal não existir
                if (mostrarCancelar) {
                    resolve(confirm(mensagem));
                } else {
                    alert(mensagem);
                    resolve(true);
                }
                return;
            }
            
            // Define ícone baseado no tipo
            if (tipo === 'erro') {
                icon.textContent = '❌';
                icon.style.color = '#dc3545';
            } else if (tipo === 'sucesso') {
                icon.textContent = '✅';
                icon.style.color = '#28a745';
            } else if (tipo === 'confirmacao') {
                icon.textContent = '❓';
                icon.style.color = '#ffc107';
            } else {
                icon.textContent = '⚠️';
                icon.style.color = '#ffc107';
            }
            
            tituloEl.textContent = titulo;
            mensagemEl.textContent = mensagem;
            
            // Mostra/esconde botão cancelar
            if (mostrarCancelar) {
                btnCancelar.style.display = 'block';
            } else {
                btnCancelar.style.display = 'none';
            }
            
            // Remove listeners antigos
            const novoBtnOk = btnOk.cloneNode(true);
            btnOk.parentNode.replaceChild(novoBtnOk, btnOk);
            
            const novoBtnCancelar = btnCancelar.cloneNode(true);
            btnCancelar.parentNode.replaceChild(novoBtnCancelar, btnCancelar);
            
            // Adiciona listeners
            novoBtnOk.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(true);
            });
            
            novoBtnCancelar.addEventListener('click', () => {
                modal.classList.add('hidden');
                resolve(false);
            });
            
            // Fecha ao clicar fora
            const fecharAoClicarFora = (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    modal.removeEventListener('click', fecharAoClicarFora);
                    resolve(false);
                }
            };
            modal.addEventListener('click', fecharAoClicarFora);
            
            // Mostra o modal
            modal.classList.remove('hidden');
        });
    };
    
    // Função auxiliar para carregar serviços ativos (disponível globalmente)
    async function carregarServicosAtivosAuxiliar(pedidoIdDestacado = null) {
        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
        const listaServicosAtivos = document.getElementById('lista-servicos-ativos');
        
        if (!modalServicosAtivos || !listaServicosAtivos) {
            dwarn('Modal de serviços ativos não encontrado, redirecionando para o feed...');
            window.location.href = '/#servicos-ativos';
            return;
        }

        try {
            // Busca os pedidos que EU criei (independente do tipo de conta)
            const response = await fetch('/api/pedidos-urgentes/meus', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                listaServicosAtivos.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar meus serviços ativos.</p>';
                return;
            }

            // Filtra apenas os pedidos que têm proposta aceita (serviços ativos)
            const todosPedidos = data.pedidos || [];
            const pedidos = todosPedidos.filter(p => {
                // Mostra apenas pedidos com proposta aceita (status 'aceita', 'aceito' ou 'em_andamento')
                return p.propostas && p.propostas.some(prop =>
                    prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
                );
            });

            if (pedidos.length === 0) {
                listaServicosAtivos.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--text-secondary);">Você ainda não tem serviços ativos de pedidos urgentes.</p>';
                modalServicosAtivos.classList.remove('hidden');
                return;
            }

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
                // Encontra a proposta aceita para mostrar o profissional
                const propostaAceita = pedido.propostas?.find(prop => 
                    prop.status === 'aceito' || prop.status === 'em_andamento'
                );
                const profissional = propostaAceita?.profissionalId || null;
                
                const endereco = pedido.localizacao || {};
                const enderecoLinha = endereco.endereco || '';
                const cidadeEstado = `${endereco.cidade || ''}${endereco.cidade && endereco.estado ? ' - ' : ''}${endereco.estado || ''}`;
                const enderecoMapa = encodeURIComponent(`${enderecoLinha} ${cidadeEstado}`);
                const isDestacado = pedidoIdDestacado && String(pedido._id) === String(pedidoIdDestacado);
                const estiloDestacado = isDestacado ? 'border: 3px solid #28a745; box-shadow: 0 0 10px rgba(40, 167, 69, 0.5);' : '';
                
                return `
                    <div class="pedido-card-servico" data-pedido-id="${pedido._id}" style="${estiloDestacado}">
                        ${pedido.foto || (pedido.fotos && pedido.fotos.length > 0) ? `
                            <div class="pedido-foto-servico" style="display: flex; flex-wrap: wrap; gap: 5px; margin: 10px 0; overflow: visible; overflow-x: visible; overflow-y: visible;">
                                ${pedido.fotos && pedido.fotos.length > 0 ? 
                                    pedido.fotos.map((foto, idx) => `
                                        <img src="${foto}" alt="Foto do serviço ${idx + 1}" class="foto-pedido-clickable" data-foto-url="${foto}" style="width: calc(50% - 2.5px); max-width: 150px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer; flex-shrink: 0;">
                                    `).join('') :
                                    `<img src="${pedido.foto}" alt="Foto do serviço" class="foto-pedido-clickable" data-foto-url="${pedido.foto}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; cursor: pointer;">`
                                }
                            </div>
                        ` : ''}
                        <div class="pedido-info-servico">
                            <h3>${pedido.servico || 'Serviço'}</h3>
                            ${pedido.descricao ? `<p>${pedido.descricao}</p>` : ''}
                            <div class="pedido-meta-servico">
                                ${profissional ? `<span><i class="fas fa-user-tie"></i> Profissional: <a href="/perfil?id=${profissional._id || profissional.id || ''}" style="color: inherit; text-decoration: none; font-weight: 600; cursor: pointer;">${profissional.nome || 'Profissional'}</a>
                                     </span>` : ''}
                                ${enderecoLinha || cidadeEstado ? `<span><i class="fas fa-map-marker-alt"></i> ${enderecoLinha}${enderecoLinha && cidadeEstado ? ', ' : ''}${cidadeEstado}</span>` : ''}
                            </div>
                            ${enderecoMapa ? `<a href="https://www.google.com/maps/search/?api=1&query=${enderecoMapa}" target="_blank" class="btn-como-chegar"><i class="fas fa-directions"></i> Como chegar</a>` : ''}
                        </div>
                        <div class="pedido-acoes-servico">
                            <button class="btn-concluir-servico" data-pedido-id="${pedido._id}" style="background: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin-bottom: 10px;">
                                <i class="fas fa-check"></i> Concluir Serviço
                            </button>
                            <button class="btn-cancelar-servico" data-pedido-id="${pedido._id}" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            // Adicionar listeners para concluir/cancelar serviço
            document.querySelectorAll('.btn-concluir-servico').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoIdBtn = btn.dataset.pedidoId;
                    if (confirm('Tem certeza que deseja concluir este serviço?')) {
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoIdBtn}/concluir`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await response.json();
                            if (data.success) {
                                alert('Serviço concluído com sucesso!');
                                // Recarrega usando a função global se disponível, senão usa a auxiliar
                                if (typeof window.carregarServicosAtivos === 'function') {
                                    await window.carregarServicosAtivos();
                                } else {
                                    await carregarServicosAtivosAuxiliar();
                                }
                            } else {
                                alert(data.message || 'Erro ao concluir serviço.');
                            }
                        } catch (error) {
                            console.error('Erro ao concluir serviço:', error);
                            alert('Erro ao concluir serviço.');
                        }
                    }
                });
            });

            document.querySelectorAll('.btn-cancelar-servico').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pedidoIdBtn = btn.dataset.pedidoId;
                    if (confirm('Tem certeza que deseja cancelar este serviço?')) {
                        try {
                            const response = await fetch(`/api/pedidos-urgentes/${pedidoIdBtn}/cancelar`, {
                                method: 'POST',
                                headers: {
                                    'Authorization': `Bearer ${token}`
                                }
                            });
                            const data = await response.json();
                            if (data.success) {
                                alert('Serviço cancelado com sucesso.');
                                // Recarrega usando a função global se disponível, senão usa a auxiliar
                                if (typeof window.carregarServicosAtivos === 'function') {
                                    await window.carregarServicosAtivos();
                                } else {
                                    await carregarServicosAtivosAuxiliar();
                                }
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

            // Adicionar listeners para fotos clicáveis (abrir modal)
            document.querySelectorAll('.foto-pedido-clickable').forEach(img => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const fotoUrl = img.dataset.fotoUrl || img.src;
                    if (typeof window.abrirModalImagem === 'function') {
                        window.abrirModalImagem(fotoUrl);
                    } else {
                        // Fallback: usar função local se disponível
                        const modalImagem = document.getElementById('image-modal-pedido');
                        const imagemModal = document.getElementById('modal-image-pedido');
                        if (modalImagem && imagemModal) {
                            imagemModal.src = fotoUrl;
                            modalImagem.classList.remove('hidden');
                            document.body.style.overflow = 'hidden';
                        }
                    }
                });
            });

            modalServicosAtivos.classList.remove('hidden');
        } catch (error) {
            console.error('Erro ao carregar serviços ativos:', error);
            alert('Erro ao carregar serviços ativos. Redirecionando para o feed...');
            window.location.href = '/#servicos-ativos';
        }
    }

    // Função auxiliar para carregar propostas (disponível globalmente)
    async function carregarPropostasAuxiliar(pedidoId) {
        const modalPropostas = document.getElementById('modal-propostas');
        const listaPropostas = document.getElementById('lista-propostas');
        
        if (!modalPropostas || !listaPropostas) {
            dwarn('Modal de propostas não encontrado, redirecionando para o feed...');
            window.location.href = `/?pedidoId=${pedidoId}#propostas`;
            return;
        }

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
                const propostas = data.propostas || [];

                if (propostas.length === 0) {
                    listaPropostas.innerHTML = '<p>Ainda não há propostas. Profissionais serão notificados!</p>';
                    return;
                }

                let headerHtml = '';
                if (pedido) {
                    headerHtml = `
                        <div class="pedido-propostas-header">
                            <div class="pedido-propostas-info">
                                <strong>${pedido.servico || ''}</strong>
                                ${pedido.descricao ? `<p class="pedido-descricao">${pedido.descricao}</p>` : ''}
                            </div>
                            ${pedido.foto ? `
                                <div class="pedido-propostas-foto">
                                    <img src="${pedido.foto}" alt="Foto do serviço" class="pedido-foto-miniatura">
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
                                <img src="${prof.avatarUrl || prof.foto || '/imagens/default-user.png'}" 
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
                            <div style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn-aceitar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}">
                                Aceitar Proposta
                            </button>
                                <button class="btn-recusar-proposta" data-proposta-id="${proposta._id}" data-pedido-id="${pedidoId}" style="background: #dc3545; color: #fff; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                                    Recusar
                            </button>
                            </div>
                        </div>
                    `;
                }).join('');

                listaPropostas.innerHTML = headerHtml + propostasHtml;

                // Adicionar listeners para aceitar propostas
                document.querySelectorAll('.btn-aceitar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoIdBtn = btn.dataset.pedidoId;
                        
                        // Verifica se há função de confirmação disponível
                        if (typeof window.abrirConfirmacaoAcao === 'function') {
                            window.abrirConfirmacaoAcao({
                                titulo: 'Aceitar proposta',
                                texto: 'Ao aceitar esta proposta, o serviço será iniciado com este profissional.',
                                exigeMotivo: false,
                                onConfirm: async () => {
                                    await aceitarProposta(propostaId, pedidoIdBtn);
                                }
                            });
                        } else {
                            if (confirm('Tem certeza que deseja aceitar esta proposta?')) {
                                await aceitarProposta(propostaId, pedidoIdBtn);
                            }
                        }
                    });
                });

                // Adicionar listeners para recusar propostas
                document.querySelectorAll('.btn-recusar-proposta').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const propostaId = btn.dataset.propostaId;
                        const pedidoIdBtn = btn.dataset.pedidoId;
                        
                        if (!confirm('Tem certeza que deseja recusar esta proposta?')) return;
                        
                        await recusarProposta(propostaId, pedidoIdBtn);
                    });
                });
            }
        } catch (error) {
            console.error('Erro ao carregar propostas:', error);
            alert('Erro ao carregar propostas. Redirecionando para o feed...');
            window.location.href = `/?pedidoId=${pedidoId}#propostas`;
        }
    }

    // Função auxiliar para aceitar proposta
    async function aceitarProposta(propostaId, pedidoId) {
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
                toast.style.cssText = 'position: fixed; top: 80px; right: 20px; background: #28a745; color: white; padding: 15px 20px; border-radius: 8px; z-index: 10000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
                toast.innerHTML = '<span>✔</span> Proposta aceita! Agora é só aguardar o profissional.';
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s';
                    setTimeout(() => toast.remove(), 300);
                }, 2500);

                const modalPropostas = document.getElementById('modal-propostas');
                if (modalPropostas) modalPropostas.classList.add('hidden');
                
                // Recarrega as propostas se a função estiver disponível
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoId);
                } else {
                    await carregarPropostasAuxiliar(pedidoId);
                }
            } else {
                alert(data.message || 'Erro ao aceitar proposta.');
            }
        } catch (error) {
            console.error('Erro ao aceitar proposta:', error);
            alert('Erro ao aceitar proposta.');
        }
    }

    // Função auxiliar para recusar proposta
    async function recusarProposta(propostaId, pedidoId) {
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
                alert('Proposta recusada com sucesso.');
                // Recarrega as propostas se a função estiver disponível
                if (typeof window.carregarPropostas === 'function') {
                    await window.carregarPropostas(pedidoId);
                } else {
                    await carregarPropostasAuxiliar(pedidoId);
                }
            } else {
                alert(data.message || 'Erro ao recusar proposta.');
            }
        } catch (error) {
            console.error('Erro ao recusar proposta:', error);
            alert('Erro ao recusar proposta.');
        }
    }

    // Define handleClickLixeira ANTES do DOM estar pronto para que o onclick inline funcione
    dlog('Definindo window.handleClickLixeira (debug)');
    window.handleClickLixeira = async function handleClickLixeira(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        dlog('handleClickLixeira', { modoSelecao, selecionadas: notificacoesSelecionadas.size });
        
        // Se não está em modo de seleção, entra no modo
        if (!modoSelecao) {
            dlog('Entrando no modo de seleção');
            if (toggleModoSelecao) {
                toggleModoSelecao();
            } else {
                console.error('toggleModoSelecao não está disponível ainda');
            }
            return;
        }
        
        // Se está em modo de seleção e tem notificações selecionadas, deleta
        if (notificacoesSelecionadas.size === 0) {
            // Mostra mensagem perto do botão "Selecionar tudo"
            const mensagemEl = document.getElementById('mensagem-selecionar-primeiro');
            if (mensagemEl) {
                mensagemEl.style.display = 'block';
                // Esconde a mensagem após 3 segundos
                setTimeout(() => {
                    mensagemEl.style.display = 'none';
                }, 3000);
            }
            return;
        }

        // Busca o botão lixeira e o container do modal de notificações
        const btnLixeira = document.getElementById('btn-limpar-notificacoes');
        const modalNotificacoes = document.getElementById('modal-notificacoes');
        if (!btnLixeira || !modalNotificacoes) {
            console.error('Botão lixeira ou modal não encontrado');
            return;
        }

        // Remove modal anterior se existir
        const modalAnterior = modalNotificacoes.querySelector('.modal-apagar-notificacao-inline');
        if (modalAnterior) {
            modalAnterior.remove();
        }

        // Cria modal inline abaixo do botão
        const modalInline = document.createElement('div');
        modalInline.className = 'modal-apagar-notificacao-inline';
        modalInline.style.cssText = `
            position: absolute;
            right: 0;
            top: 100%;
            margin-top: 5px;
            background: var(--bg-primary, #fff);
            border: 1px solid var(--border-color, #ddd);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 150px;
            max-width: 200px;
        `;
        modalInline.innerHTML = `
            <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; text-align: center;">
                Tem Certeza?
            </p>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button class="btn-confirmar-apagar-notificacao" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Apagar
                </button>
                <button class="btn-cancelar-apagar-notificacao" style="padding: 6px 12px; background: var(--bg-secondary, #f0f0f0); color: var(--text-primary); border: 1px solid var(--border-color, #ddd); border-radius: 4px; cursor: pointer; font-size: 13px;">
                    Cancelar
                </button>
            </div>
        `;

        // Adiciona o modal ao container do botão (precisa ter position: relative)
        const btnContainer = btnLixeira.parentElement;
        if (btnContainer) {
            btnContainer.style.position = 'relative';
            btnContainer.appendChild(modalInline);
        } else {
            // Fallback: nunca altere o overlay (#modal-notificacoes). Ancore no conteúdo interno.
            const modalContent = modalNotificacoes.querySelector('.modal-content') || modalNotificacoes;
            modalContent.style.position = 'relative';
            modalContent.appendChild(modalInline);
        }

        // Aguarda confirmação do usuário
        const confirmar = await new Promise((resolve) => {
            // Fecha ao clicar em cancelar
            modalInline.querySelector('.btn-cancelar-apagar-notificacao').addEventListener('click', () => {
                modalInline.remove();
                resolve(false);
            });

            // Confirma ao clicar em apagar
            modalInline.querySelector('.btn-confirmar-apagar-notificacao').addEventListener('click', () => {
                modalInline.remove();
                resolve(true);
            });

            // Fecha ao clicar fora
            setTimeout(() => {
                const fecharAoClicarFora = (e) => {
                    if (!modalInline.contains(e.target) && !btnLixeira.contains(e.target)) {
                        modalInline.remove();
                        document.removeEventListener('click', fecharAoClicarFora);
                        resolve(false);
                    }
                };
                document.addEventListener('click', fecharAoClicarFora);
            }, 10);
        });

        if (!confirmar) {
            return;
        }

        try {
            const currentToken = token || localStorage.getItem('jwtToken');
            dlog('Deletando notificações (debug)', Array.from(notificacoesSelecionadas));
            const response = await fetch('/api/notificacoes', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${currentToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ids: Array.from(notificacoesSelecionadas) })
            });
            const data = await response.json();
            dlog('Resposta da API (debug)', data);
            if (response.ok && data.success) {
                notificacoesSelecionadas.clear();
                if (toggleModoSelecao) {
                    toggleModoSelecao(); // Sai do modo de seleção
                }
                if (carregarNotificacoes) {
                    await carregarNotificacoes();
                }
            } else {
                throw new Error(data.message || 'Erro ao deletar notificações');
            }
        } catch (err) {
            console.error('Erro ao deletar notificações:', err);
            alert('Erro ao deletar notificações. Tente novamente.');
        }
    };
    dlog('window.handleClickLixeira definida:', typeof window.handleClickLixeira);
    
    // Aguarda o DOM estar pronto
    dlog('header-notificacoes.js carregado, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        dlog('Aguardando DOMContentLoaded...');
        document.addEventListener('DOMContentLoaded', initHeaderNotificacoes);
    } else {
        dlog('DOM já pronto, inicializando imediatamente...');
        initHeaderNotificacoes();
    }
    
    function initHeaderNotificacoes() {
        dlog('Inicializando header-notificacoes.js...');
        token = localStorage.getItem('jwtToken');
        const loggedInUserId = localStorage.getItem('userId');
        
        if (!token || !loggedInUserId) {
            // Sem spam de logs em produção
            dwarn('Usuário não logado, não inicializando notificações');
            return; // Não inicializa se não estiver logado
        }

        dlog('Usuário logado, buscando elementos do DOM...');
        // Elementos do DOM
        const btnNotificacoes = document.getElementById('btn-notificacoes');
        // IMPORTANTE: o botão é clonado mais abaixo para limpar listeners;
        // então este elemento pode ficar "stale" se não for atualizado.
        let badgeNotificacoes = document.getElementById('badge-notificacoes');
        let modalNotificacoes = document.getElementById('modal-notificacoes');
        
        // Proteção: garante que o modal sempre exista no DOM
        if (!modalNotificacoes) {
            dwarn('Modal de notificações não encontrado no DOM inicialmente. Verificando novamente...');
            // Aguarda um pouco e tenta novamente
            setTimeout(() => {
                modalNotificacoes = document.getElementById('modal-notificacoes');
                if (!modalNotificacoes) {
                    console.error('Modal de notificações ainda não encontrado após aguardar. Verifique se o elemento existe no HTML.');
                }
            }, 100);
        }
        
        // Proteção adicional: MutationObserver para detectar se o modal é removido do DOM
        if (modalNotificacoes && !window.modalNotificacoesObserver) {
            window.modalNotificacoesObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === 1 && (node.id === 'modal-notificacoes' || node.querySelector && node.querySelector('#modal-notificacoes'))) {
                            console.error('Modal de notificações foi removido do DOM.');
                            // Tenta encontrar o modal novamente
                            const modalRecriado = document.getElementById('modal-notificacoes');
                            if (!modalRecriado) {
                                console.error('Não foi possível encontrar o modal após remoção. Recarregue a página.');
                            }
                        }
                    });
                });
            });
            
            // Observa mudanças no body para detectar remoção do modal
            window.modalNotificacoesObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            dlog('MutationObserver configurado para proteger o modal de notificações');
        }
        
        const listaNotificacoes = document.getElementById('lista-notificacoes');
        const btnMarcarTodasLidas = document.getElementById('btn-marcar-todas-lidas');
        const btnLimparNotificacoes = document.getElementById('btn-limpar-notificacoes');
        const btnSelecionarTudo = document.getElementById('btn-selecionar-tudo');
        const selecionarTudoContainer = document.getElementById('selecionar-tudo-container');
        
        dlog('Elementos encontrados (debug):', {
            btnNotificacoes: !!btnNotificacoes,
            badgeNotificacoes: !!badgeNotificacoes,
            modalNotificacoes: !!modalNotificacoes,
            listaNotificacoes: !!listaNotificacoes,
            btnMarcarTodasLidas: !!btnMarcarTodasLidas,
            btnLimparNotificacoes: !!btnLimparNotificacoes,
            btnSelecionarTudo: !!btnSelecionarTudo,
            selecionarTudoContainer: !!selecionarTudoContainer
        });
        
        // Função para atualizar o botão "Selecionar tudo"
        function atualizarBotaoSelecionarTudo() {
            if (!btnSelecionarTudo) return;
            const todasCards = document.querySelectorAll('.notificacao-card');
            const todasSelecionadas = todasCards.length > 0 && notificacoesSelecionadas.size === todasCards.length;
            btnSelecionarTudo.textContent = todasSelecionadas 
                ? 'Desselecionar tudo'
                : 'Selecionar tudo';
        }
        
        // Função para entrar/sair do modo de seleção (atribuída à variável global)
        toggleModoSelecao = function() {
            modoSelecao = !modoSelecao;
            notificacoesSelecionadas.clear();
            dlog('Modo de seleção alterado (debug):', modoSelecao);
            
            // Busca o botão novamente (pode ter sido clonado)
            const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
            const btnSelecionarTudoAtual = document.getElementById('btn-selecionar-tudo');
            
            if (modoSelecao) {
                if (btnLixeiraAtual) {
                    btnLixeiraAtual.classList.add('modo-selecao');
                    dlog('Classe modo-selecao adicionada ao botão (debug)');
                }
                if (selecionarTudoContainer) {
                    selecionarTudoContainer.style.display = 'block';
                    dlog('Container selecionar tudo exibido (debug)');
                }
                // Inicializa o botão "Selecionar tudo" sem check
                if (btnSelecionarTudoAtual) {
                    btnSelecionarTudoAtual.textContent = 'Selecionar tudo';
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
            if (carregarNotificacoes) {
                carregarNotificacoes();
            }
        };
        
        // Função para carregar notificações (atribuída à variável global e window)
        carregarNotificacoes = async function() {
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
                // Busca o modal dinamicamente para garantir que a referência está atualizada
                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                // Preserva a mensagem de erro se estiver sendo exibida
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                let mensagemPreservada = null;
                const temMensagemFlag = window.temMensagemErroNotificacao;
                
                // Verifica se há mensagem de erro sendo exibida
                const temMensagemVisivel = mensagemProposta && mensagemTexto && mensagemProposta.style.display !== 'none';
                if (temMensagemVisivel || temMensagemFlag) {
                    if (mensagemProposta && mensagemTexto) {
                        mensagemPreservada = {
                            texto: mensagemTexto.textContent || 'Esta proposta/candidatura já foi recusada.',
                            display: mensagemProposta.style.display || 'block'
                        };
                    }
                    
                    // NUNCA recarrega a lista se há mensagem de erro sendo exibida (evita piscar)
                    if ((temMensagemFlag || temMensagemVisivel) && listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
                        // Apenas atualiza o badge, não recarrega a lista para evitar piscar
                        if (badgeNotificacoes) {
                            if (data.totalNaoLidas > 0) {
                                badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                                badgeNotificacoes.style.display = 'flex';
                            } else {
                                badgeNotificacoes.style.display = 'none';
                            }
                        }
                        return; // Sai da função sem recarregar a lista
                    }
                }
                
                if (listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
                    const notificacoes = data.notificacoes || [];

                    // Se chegou notificação de proposta recusada, libera "reenviar proposta" no frontend
                    // (remove o estado "Aguardando" do botão do pedido correspondente)
                    try {
                        for (const n of notificacoes) {
                            const pedidoId = n?.dadosAdicionais?.pedidoId;
                            const isPropostaRecusada =
                                n?.tipo === 'proposta_pedido_urgente' &&
                                (n?.dadosAdicionais?.status === 'rejeitada' || n?.dadosAdicionais?.status === 'recusada');
                            if (isPropostaRecusada && pedidoId) {
                                localStorage.removeItem(`propostaStatus:${pedidoId}`);
                                const btn = document.querySelector(`.btn-enviar-proposta[data-pedido-id="${pedidoId}"]`);
                                if (btn) {
                                    btn.classList.remove('btn-proposta-aguardando');
                                    btn.style.background = '';
                                    btn.innerHTML = `<i class="fas fa-paper-plane"></i> Enviar Proposta`;
                                }
                            }
                        }
                    } catch (_) {}

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
                            servico_cancelado: '❌',
                            avaliacao_recebida: '⭐',
                            candidatura_time: '👥',
                            contraproposta_time: '💰',
                            proposta_time_aceita: '🎉',
                            confirmar_perfil_time: '👤',
                            candidatura_recusada_time: '❌',
                            post_curtido: '❤️',
                            post_comentado: '💬',
                            comentario_respondido: '↩️',
                            comentario_curtido: '👍',
                            resposta_curtida: '👍'
                        };
                        listaNotificacoes.innerHTML = notificacoes.map(notif => {
                            const dataFmt = new Date(notif.createdAt).toLocaleString('pt-BR');
                            const isSelecionada = notificacoesSelecionadas.has(notif._id);
                            const modoSelecaoClass = modoSelecao ? 'modo-selecao' : '';
                            const selecionadaClass = isSelecionada ? 'selecionada' : '';
                            const paddingLeft = modoSelecao ? '35px' : '15px';
                            // Verifica se é notificação de recusa para aplicar estilo vermelho
                            const isPropostaRecusada =
                                notif.tipo === 'proposta_pedido_urgente' &&
                                (notif.dadosAdicionais?.status === 'rejeitada' || notif.dadosAdicionais?.status === 'recusada');
                            const isRecusada =
                                notif.tipo === 'candidatura_recusada_time' ||
                                isPropostaRecusada;
                            const estiloRecusada = isRecusada ? 'style="color: #dc3545; border-left: 3px solid #dc3545; padding-left: 12px;"' : '';
                            const icone = isPropostaRecusada ? '🚫' : (iconMap[notif.tipo] || '🔔');
                            
                            return `
                                <div class="notificacao-card ${notif.lida ? '' : 'nao-lida'} ${modoSelecaoClass} ${selecionadaClass} ${isRecusada ? 'notificacao-recusada' : ''}" data-notif-id="${notif._id}" ${estiloRecusada}>
                                    <div style="display: flex; gap: 10px; align-items: flex-start; padding-left: ${paddingLeft};">
                                        <div style="font-size: 18px; line-height: 1;">${icone}</div>
                                        <div style="flex: 1;">
                                            <strong ${isRecusada ? 'style="color: #dc3545;"' : ''}>${notif.titulo || 'Notificação'}</strong>
                                            <p style="margin: 3px 0; color: var(--text-secondary);">${notif.mensagem || ''}</p>
                                            <small style="color: var(--text-secondary);">${dataFmt}</small>
                                        </div>
                                        ${!notif.lida ? '<span style="background: #007bff; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-top: 5px;"></span>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        // Restaura a mensagem preservada se houver
                        if (mensagemPreservada && mensagemProposta && mensagemTexto) {
                            mensagemTexto.textContent = mensagemPreservada.texto;
                            mensagemProposta.style.display = mensagemPreservada.display;
                        }

                        // Clique em cada notificação (usando capture phase para garantir que execute antes)
                        document.querySelectorAll('.notificacao-card').forEach(card => {
                            // Remove listeners antigos se houver
                            const novoCard = card.cloneNode(true);
                            card.parentNode.replaceChild(novoCard, card);
                            
                            novoCard.addEventListener('click', async (e) => {
                                e.stopPropagation(); // Impede que o clique seja capturado pelo listener de fechar modal
                                e.stopImmediatePropagation(); // Impede que outros listeners sejam executados
                                const notifId = novoCard.dataset.notifId;
                                dlog('Clique na notificação (debug):', notifId);
                                if (!notifId) return;
                                
                                // Se estiver em modo de seleção, apenas seleciona/desseleciona
                                if (modoSelecao) {
                                    e.stopPropagation();
                                    if (notificacoesSelecionadas.has(notifId)) {
                                        notificacoesSelecionadas.delete(notifId);
                                        novoCard.classList.remove('selecionada');
                                    } else {
                                        notificacoesSelecionadas.add(notifId);
                                        novoCard.classList.add('selecionada');
                                    }
                                    atualizarBotaoSelecionarTudo();
                                    return;
                                }
                                
                                // Busca o modal atualizado
                                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                                
                                // Função auxiliar para fechar o modal de notificações
                                const fecharModalNotificacoes = () => {
                                    // Busca o modal novamente para garantir que tem a referência atualizada
                                    const modal = document.getElementById('modal-notificacoes');
                                    if (modal) {
                                        // Remove todos os estilos inline primeiro
                                        modal.style.cssText = '';
                                        modal.style.removeProperty('display');
                                        modal.style.removeProperty('visibility');
                                        modal.style.removeProperty('opacity');
                                        modal.style.removeProperty('position');
                                        modal.style.removeProperty('z-index');
                                        modal.style.removeProperty('top');
                                        modal.style.removeProperty('left');
                                        modal.style.removeProperty('width');
                                        modal.style.removeProperty('height');
                                        
                                        // Adiciona a classe hidden
                                        modal.classList.add('hidden');
                                        
                                        // Reseta a flag
                                        modalAbertoAgora = false;

                                        dlog('Modal de notificações fechado');
                                    }
                                };
                                
                                // Verifica ANTES de marcar como lida se haverá mensagem de erro
                                // Define flag preventivo para notificações que podem gerar erro
                                const notif = (data.notificacoes || []).find(n => n._id === notifId);
                                const podeGerarErro = notif && (
                                    notif.tipo === 'candidatura_time' || 
                                    notif.tipo === 'contraproposta_time' || 
                                    notif.tipo === 'confirmar_perfil_time'
                                );
                                
                                // Define flag preventivo ANTES de processar para evitar recarregamento
                                // Isso garante que não haverá recarregamento mesmo se a função demorar
                                // Mas NÃO impede o processamento da notificação - apenas evita recarregamento da lista
                                if (podeGerarErro) {
                                    window.temMensagemErroNotificacao = true;
                                    dlog('Flag preventivo: temMensagemErroNotificacao');
                                }
                                
                                // Comportamento normal quando não está em modo de seleção
                                try {
                                    const lidaResponse = await fetch(`/api/notificacoes/${notifId}/lida`, {
                                        method: 'PUT',
                                        headers: { 'Authorization': `Bearer ${token}` }
                                    });
                                    
                                    if (lidaResponse.ok) {
                                        // Atualiza o badge imediatamente
                                        if (badgeNotificacoes && typeof carregarNotificacoes === 'function') {
                                            // Verifica se há uma mensagem de erro sendo exibida (usando flag global também)
                                            const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                                            const temMensagem = (mensagemProposta && mensagemProposta.style.display !== 'none') || window.temMensagemErroNotificacao;
                                            
                                            // NUNCA recarrega se houver mensagem de erro sendo exibida ou flag ativo
                                            if (!temMensagem) {
                                                // Recarrega as notificações para atualizar o badge
                                                await carregarNotificacoes();
                                            } else {
                                                // Apenas atualiza o badge sem recarregar a lista (evita piscar)
                                                try {
                                                    const resp = await fetch('/api/notificacoes?limit=1', {
                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                    });
                                                    if (resp.ok) {
                                                        const data = await resp.json();
                                                        if (data.success && badgeNotificacoes) {
                                                            if (data.totalNaoLidas > 0) {
                                                                badgeNotificacoes.textContent = data.totalNaoLidas > 99 ? '99+' : data.totalNaoLidas;
                                                                badgeNotificacoes.style.display = 'flex';
                                                            } else {
                                                                badgeNotificacoes.style.display = 'none';
                                                            }
                                                        }
                                                    }
                                                } catch (err) {
                                                    dwarn('Erro ao atualizar badge:', err);
                                                }
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error('Erro ao marcar notificação como lida', err);
                                }
                                
                                // Redireciona se for serviço concluído
                                // Reutiliza a variável notif já declarada acima
                                dlog('Notificação encontrada (debug):', notif?.tipo);
                                
                                // Flag para indicar se algo foi aberto (redirecionamento, modal, etc.)
                                let algoFoiAberto = false;
                                
                                // Se for notificação de proposta de pedido urgente, abre o modal de propostas
                                if (notif?.tipo === 'proposta_pedido_urgente' && notif.dadosAdicionais?.pedidoId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const pedidoId = notif.dadosAdicionais.pedidoId;
                                    dlog('Abrindo modal de propostas (debug)');
                                    
                                    // Tenta usar a função global do feed primeiro, depois a auxiliar
                                    if (typeof window.carregarPropostas === 'function') {
                                        dlog('Usando função global carregarPropostas');
                                        await window.carregarPropostas(pedidoId);
                                    } else {
                                        dlog('Usando função auxiliar carregarPropostasAuxiliar');
                                        // Usa a função auxiliar que funciona em qualquer página
                                        await carregarPropostasAuxiliar(pedidoId);
                                    }
                                    return;
                                }
                                
                                // Se for notificação de serviço cancelado, abre o modal de serviços ativos e destaca o pedido
                                if (notif?.tipo === 'servico_cancelado') {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    dlog('Notificação de serviço cancelado (debug)');
                                    const pedidoId = notif.dadosAdicionais?.pedidoId;
                                    
                                    if (pedidoId) {
                                        dlog('Abrindo serviços ativos (debug)');
                                        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                                        // Tenta usar a função global do feed primeiro, depois a auxiliar
                                        if (typeof window.carregarServicosAtivos === 'function') {
                                            dlog('Usando função global carregarServicosAtivos');
                                            await window.carregarServicosAtivos(pedidoId, true); // true = mostrar cancelados
                                            if (modalServicosAtivos) {
                                                modalServicosAtivos.classList.remove('hidden');
                                                // Faz o pedido piscar 2 vezes
                                                setTimeout(() => {
                                                    const card = document.querySelector(`[data-pedido-id="${pedidoId}"]`) || 
                                                                 document.querySelector(`.pedido-urgente-card[data-pedido-id="${pedidoId}"]`);
                                                    if (card) {
                                                        let count = 0;
                                                        const piscar = () => {
                                                            card.style.transition = 'opacity 0.3s';
                                                            card.style.opacity = '0.3';
                                                            setTimeout(() => {
                                                                card.style.opacity = '1';
                                                                count++;
                                                                if (count < 2) {
                                                                    setTimeout(piscar, 300);
                                                                } else {
                                                                    card.style.transition = '';
                                                                }
                                                            }, 300);
                                                        };
                                                        piscar();
                                                    }
                                                }, 500);
                                            }
                                        } else {
                                            dlog('Usando função auxiliar carregarServicosAtivosAuxiliar');
                                            await carregarServicosAtivosAuxiliar(pedidoId);
                                        }
                                    } else {
                                        dwarn('Notificação de serviço cancelado sem pedidoId');
                                        window.location.reload();
                                    }
                                    return;
                                }
                                
                                // Se for notificação de proposta aceita, abre o modal de serviços ativos
                                if (notif?.tipo === 'proposta_aceita') {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    dlog('Notificação de proposta aceita (debug)');
                                    // Pode ter pedidoId ou agendamentoId
                                    const pedidoId = notif.dadosAdicionais?.pedidoId || notif.dadosAdicionais?.agendamentoId;
                                    
                                    if (pedidoId) {
                                        dlog('Abrindo serviços ativos (debug)');
                                        const modalServicosAtivos = document.getElementById('modal-servicos-ativos');
                                        // Tenta usar a função global do feed primeiro, depois a auxiliar
                                        if (typeof window.carregarServicosAtivos === 'function') {
                                            dlog('Usando função global carregarServicosAtivos');
                                            await window.carregarServicosAtivos(pedidoId);
                                            if (modalServicosAtivos) {
                                                modalServicosAtivos.classList.remove('hidden');
                                            }
                                        } else {
                                            dlog('Usando função auxiliar carregarServicosAtivosAuxiliar');
                                            // Usa a função auxiliar que funciona em qualquer página
                                            await carregarServicosAtivosAuxiliar(pedidoId);
                                        }
                                    } else {
                                        dwarn('Notificação de proposta aceita sem pedidoId ou agendamentoId');
                                        // Se não tem pedidoId, apenas recarrega a página
                                        window.location.reload();
                                    }
                                    return;
                                }
                                
                                // Redireciona se for serviço concluído (deve ser processado ANTES do check de podeGerarErro)
                                if (notif?.tipo === 'servico_concluido' && notif.dadosAdicionais?.profissionalId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const params = new URLSearchParams({
                                        id: notif.dadosAdicionais.profissionalId,
                                        origem: 'servico_concluido'
                                    });
                                    
                                    // Tenta extrair o nome do serviço da mensagem da notificação
                                    let nomeServicoDaMensagem = '';
                                    if (notif.mensagem) {
                                        const match = notif.mensagem.match(/serviço:\s*([^.]+)/i);
                                        if (match && match[1]) {
                                            nomeServicoDaMensagem = match[1].trim();
                                            dlog('Nome do serviço extraído da mensagem (debug)');
                                        }
                                    }
                                    
                                    const pedidoId = notif.dadosAdicionais.pedidoId || '';
                                    if (pedidoId) {
                                        const pidClean = String(pedidoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                        if (pidClean) {
                                            params.set('pedidoId', pidClean);
                                            // Salva o pedidoId no localStorage para uso posterior
                                            localStorage.setItem('pedidoIdUltimoServicoConcluido', pidClean);
                                            dlog('PedidoId salvo no localStorage (debug)');
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
                                                        dlog('Nome do serviço salvo do pedido (debug)');
                                                    }
                                                }
                                            } catch (e) {
                                                dwarn('Erro ao buscar nome do serviço do pedido:', e);
                                                if (nomeServicoDaMensagem) {
                                                    params.set('servico', nomeServicoDaMensagem);
                                                    localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                                }
                                            }
                                        }
                                    } else if (notif.dadosAdicionais.agendamentoId) {
                                        const agendamentoId = notif.dadosAdicionais.agendamentoId;
                                        const aidClean = String(agendamentoId).match(/[a-fA-F0-9]{24}/)?.[0] || '';
                                        if (aidClean) {
                                            params.set('agendamentoId', aidClean);
                                            // Salva o agendamentoId no localStorage para uso posterior
                                            localStorage.setItem('agendamentoIdUltimoServico', aidClean);
                                            dlog('AgendamentoId salvo no localStorage (debug)');
                                        }
                                        try {
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
                                                    dlog('Nome do serviço salvo do agendamento (debug)');
                                                }
                                            }
                                        } catch (e) {
                                            dwarn('Erro ao buscar nome do serviço do agendamento:', e);
                                            if (nomeServicoDaMensagem) {
                                                params.set('servico', nomeServicoDaMensagem);
                                                localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                            }
                                        }
                                    } else if (nomeServicoDaMensagem) {
                                        params.set('servico', nomeServicoDaMensagem);
                                        localStorage.setItem('ultimoServicoNome', nomeServicoDaMensagem);
                                        dlog('Nome do serviço usado da mensagem (debug)');
                                    }
                                    const fotoServico = notif.dadosAdicionais.foto || localStorage.getItem('fotoUltimoServicoConcluido') || localStorage.getItem('ultimaFotoPedido');
                                    if (fotoServico) params.set('foto', fotoServico);
                                    dlog('Redirecionando para perfil com avaliação (debug)');
                                    window.location.href = `/perfil?${params.toString()}#secao-avaliacao`;
                                    return;
                                }
                                
                                // Trata notificações de posts (curtidas, comentários, respostas) ANTES do check de podeGerarErro
                                // Função auxiliar para navegar até um post e comentário/resposta específico
                                const navegarParaPost = async (postId, commentId = null, replyId = null) => {
                                    dlog('[header-notificacoes] Navegando para post (debug)', { postId, commentId, replyId });
                                    
                                    // Se não estiver no feed, redireciona para o feed
                                    const currentPath = window.location.pathname;
                                    dlog('Caminho atual (debug):', currentPath);
                                    if (currentPath !== '/' && currentPath !== '/index.html') {
                                        dlog('Redirecionando para feed com parâmetros (debug)');
                                        const params = new URLSearchParams();
                                        if (postId) params.set('postId', postId);
                                        if (commentId) params.set('commentId', commentId);
                                        if (replyId) params.set('replyId', replyId);
                                        window.location.href = `/?${params.toString()}`;
                                        return;
                                    }
                                    
                                    // Se já estiver no feed, usa a função global se disponível
                                    dlog('Verificando window.navegarParaPost (debug):', typeof window.navegarParaPost);
                                    if (typeof window.navegarParaPost === 'function') {
                                        dlog('window.navegarParaPost encontrada, chamando (debug)');
                                        await window.navegarParaPost(postId, commentId, replyId);
                                    } else {
                                        dwarn('window.navegarParaPost não encontrada, recarregando página com parâmetros');
                                        // Fallback: recarrega a página com parâmetros
                                        const params = new URLSearchParams();
                                        if (postId) params.set('postId', postId);
                                        if (commentId) params.set('commentId', commentId);
                                        if (replyId) params.set('replyId', replyId);
                                        window.location.href = `/?${params.toString()}`;
                                    }
                                };
                                
                                // Trata notificações de posts (curtidas, comentários, respostas)
                                if (notif?.tipo === 'post_curtido' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    await navegarParaPost(notif.dadosAdicionais.postId);
                                    return;
                                }
                                
                                if (notif?.tipo === 'post_comentado' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const commentId = notif.dadosAdicionais?.comentarioId || notif.dadosAdicionais?.commentId;
                                    await navegarParaPost(notif.dadosAdicionais.postId, commentId);
                                    return;
                                }
                                
                                if (notif?.tipo === 'comentario_respondido' && notif.dadosAdicionais?.postId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const commentId = notif.dadosAdicionais?.comentarioId || notif.dadosAdicionais?.commentId;
                                    const replyId = notif.dadosAdicionais?.respostaId || notif.dadosAdicionais?.replyId;
                                    await navegarParaPost(notif.dadosAdicionais.postId, commentId, replyId);
                                    return;
                                }
                                
                                if (notif?.tipo === 'comentario_curtido' && notif.dadosAdicionais?.postId) {
                                    dlog('Notificação de comentário curtido (debug)');
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const commentId = notif.dadosAdicionais?.commentId;
                                    dlog('Chamando navegarParaPost (debug)');
                                    await navegarParaPost(notif.dadosAdicionais.postId, commentId);
                                    return;
                                }
                                
                                if (notif?.tipo === 'resposta_curtida' && notif.dadosAdicionais?.postId) {
                                    dlog('Notificação de resposta curtida (debug)');
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    const commentId = notif.dadosAdicionais?.commentId;
                                    const replyId = notif.dadosAdicionais?.replyId;
                                    dlog('Chamando navegarParaPost (debug)');
                                    await navegarParaPost(notif.dadosAdicionais.postId, commentId, replyId);
                                    return;
                                }
                                
                                // Se a notificação não for do tipo que pode gerar erro, não precisa processar mais
                                // As notificações que podem gerar erro são processadas abaixo
                                if (!podeGerarErro) {
                                    return;
                                }
                                
                                // Processa notificações que podem gerar erro (candidatura_time, contraproposta_time, confirmar_perfil_time)
                                // NOTA: servico_concluido já foi processado acima, então não precisa ser processado aqui novamente
                                
                                // Trata notificação de proposta aceita em time
                                if (notif?.tipo === 'proposta_time_aceita' && notif.dadosAdicionais?.timeId) {
                                    algoFoiAberto = true;
                                    fecharModalNotificacoes();
                                    dlog('Notificação de proposta aceita (time) (debug)');
                                    
                                    // Abre o modal de proposta aceita
                                    if (typeof window.abrirModalPropostaAceita === 'function') {
                                        await window.abrirModalPropostaAceita(notif.dadosAdicionais);
                                    } else {
                                        console.error('❌ Função abrirModalPropostaAceita não encontrada');
                                    }
                                    return;
                                }
                                
                                // Trata notificação de confirmação de perfil em time
                                if (notif?.tipo === 'confirmar_perfil_time' && notif.dadosAdicionais?.timeId) {
                                    dlog('Notificação de confirmação de perfil (debug)');
                                    
                                    const timeId = notif.dadosAdicionais.timeId;
                                    const candidatoId = notif.dadosAdicionais.candidatoId;
                                    const profissionalId = notif.dadosAdicionais.profissionalId;
                                    
                                    // Define flag ANTES de chamar a função para evitar recarregamento
                                    window.temMensagemErroNotificacao = true;
                                    
                                    // Se estiver no feed (index.html), chama a função diretamente
                                    if (typeof window.abrirCandidatosPorNotificacao === 'function') {
                                        dlog('Chamando abrirCandidatosPorNotificacao (confirmar perfil) (debug)');
                                        const sucesso = await window.abrirCandidatosPorNotificacao(timeId, profissionalId, 'confirmar_perfil_time', candidatoId);
                                        // Só fecha o modal se tudo deu certo
                                        if (sucesso) {
                                            // Remove o flag IMEDIATAMENTE se deu certo (notificação válida)
                                            window.temMensagemErroNotificacao = false;
                                            dlog('Flag removida - notificação processada (debug)');
                                            algoFoiAberto = true;
                                            fecharModalNotificacoes();
                                        }
                                        // Se não deu certo, o flag permanece e a mensagem já foi exibida
                                    } else {
                                        dlog('Função não disponível, redirecionando para feed (debug)');
                                        // Remove o flag antes de redirecionar
                                        window.temMensagemErroNotificacao = false;
                                        algoFoiAberto = true;
                                        fecharModalNotificacoes();
                                        const params = new URLSearchParams({ abrirCandidatos: timeId });
                                        if (profissionalId) {
                                            params.append('profissionalId', profissionalId);
                                        }
                                        if (candidatoId) {
                                            params.append('candidatoId', candidatoId);
                                        }
                                        params.append('tipoNotificacao', 'confirmar_perfil_time');
                                        window.location.href = `/index.html?${params.toString()}`;
                                    }
                                    return;
                                }
                                
                                // Trata notificação de candidatura em time
                                if ((notif?.tipo === 'candidatura_time' || notif?.tipo === 'contraproposta_time') && notif.dadosAdicionais?.timeId) {
                                    dlog('Notificação de candidatura/contraproposta (debug)');
                                    
                                    const timeId = notif.dadosAdicionais.timeId;
                                    const profissionalId = notif.dadosAdicionais.profissionalId;
                                    const candidatoId = notif.dadosAdicionais.candidatoId; // ID específico do candidato
                                    const tipoNotificacao = notif.tipo;
                                    
                                    // Define flag ANTES de chamar a função para evitar recarregamento
                                    // A função pode retornar false se houver erro, então preparamos para isso
                                    window.temMensagemErroNotificacao = true;
                                    
                                    // Se estiver no feed (index.html), chama a função diretamente
                                    if (typeof window.abrirCandidatosPorNotificacao === 'function') {
                                        dlog('Chamando abrirCandidatosPorNotificacao (debug)');
                                        const sucesso = await window.abrirCandidatosPorNotificacao(timeId, profissionalId, tipoNotificacao, candidatoId);
                                        // Só fecha o modal se tudo deu certo
                                        if (sucesso) {
                                            // Remove o flag IMEDIATAMENTE se deu certo (notificação válida)
                                            window.temMensagemErroNotificacao = false;
                                            dlog('Flag removida - notificação processada (debug)');
                                            algoFoiAberto = true;
                                            fecharModalNotificacoes();
                                        }
                                        // Se não deu certo, o flag permanece e a mensagem já foi exibida
                                    } else {
                                        dlog('Função não disponível, redirecionando para feed (debug)');
                                        // Remove o flag antes de redirecionar
                                        window.temMensagemErroNotificacao = false;
                                        algoFoiAberto = true;
                                        fecharModalNotificacoes();
                                        // Se não estiver no feed, redireciona para o feed com parâmetro
                                        const params = new URLSearchParams({ abrirCandidatos: timeId });
                                        if (profissionalId) {
                                            params.append('profissionalId', profissionalId);
                                        }
                                        if (candidatoId) {
                                            params.append('candidatoId', candidatoId);
                                        }
                                        if (tipoNotificacao) {
                                            params.append('tipoNotificacao', tipoNotificacao);
                                        }
                                        window.location.href = `/index.html?${params.toString()}`;
                                    }
                                    return;
                                }
                            });
                        });
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar notificações:', error);
                if (badgeNotificacoes) badgeNotificacoes.style.display = 'none';
                // Busca o modal dinamicamente para garantir que a referência está atualizada
                const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                if (listaNotificacoes && modalNotificacoesAtual && !modalNotificacoesAtual.classList.contains('hidden')) {
                    listaNotificacoes.innerHTML = '<p style="color: var(--error-color);">Erro ao carregar notificações.</p>';
                }
            }
        }
        
        // Função para configurar o botão lixeira
        function configurarBotaoLixeira() {
            const btnLixeira = document.getElementById('btn-limpar-notificacoes');
            if (!btnLixeira) {
                dwarn('Botão lixeira não encontrado no DOM');
                return false;
            }

            dlog('Botão lixeira encontrado (debug)');
            
            // Remove listeners antigos clonando o elemento
            const novoBtn = btnLixeira.cloneNode(true);
            btnLixeira.parentNode.replaceChild(novoBtn, btnLixeira);
            
            // Função wrapper para garantir que funcione
            const clickHandler = function(e) {
                e.stopPropagation();
                e.preventDefault();
                if (window.handleClickLixeira) {
                    window.handleClickLixeira(e);
                } else {
                    console.error('window.handleClickLixeira não encontrado no clickHandler!');
                }
                return false;
            };
            
            // Adiciona múltiplos listeners
            novoBtn.addEventListener('click', clickHandler, true);
            novoBtn.addEventListener('click', clickHandler, false);
            novoBtn.onclick = clickHandler;
            
            // Garante que o onclick inline funcione (sobrescreve o atributo) sem logs de debug
            const onclickInline = 'event.stopPropagation(); event.preventDefault(); if (window.handleClickLixeira) { window.handleClickLixeira(event); } return false;';
            novoBtn.setAttribute('onclick', onclickInline);
            
            // Testa se o onclick está funcionando
            dlog('Botão clonado (debug)', {
                onclickAtributo: novoBtn.getAttribute('onclick'),
                onclickPropriedade: typeof novoBtn.onclick,
                handleClickLixeira: typeof window.handleClickLixeira
            });
            
            // Ícone dentro do botão
            const icon = novoBtn.querySelector('.fa-trash');
            if (icon) {
                icon.style.pointerEvents = 'none';
            }
            
            dlog('Listener do botão lixeira configurado');
            return true;
        }
        
        // Flag para evitar fechar modal imediatamente após abrir (compartilhada)
        let modalAbertoAgora = false;
        
        // Configuração do botão de notificações
        if (btnNotificacoes) {
            dlog('Configurando botão de notificações (debug)');
            // Remove listeners antigos clonando o elemento para evitar conflitos
            const novoBtnNotificacoes = btnNotificacoes.cloneNode(true);
            btnNotificacoes.parentNode.replaceChild(novoBtnNotificacoes, btnNotificacoes);
            // Atualiza referência do badge (o clone cria um novo <span id="badge-notificacoes">)
            badgeNotificacoes =
                novoBtnNotificacoes.querySelector('#badge-notificacoes') ||
                document.getElementById('badge-notificacoes');
            
            novoBtnNotificacoes.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation(); // Impede que outros listeners executem
                
                // Busca o modal novamente no DOM para garantir que a referência está atualizada
                // Tenta múltiplas vezes com pequenos delays para garantir que encontre o modal
                let modalNotificacoesAtual = null;
                for (let tentativa = 0; tentativa < 5; tentativa++) {
                    modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                    if (modalNotificacoesAtual) {
                        break;
                    }
                    // Aguarda um pouco antes de tentar novamente
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                if (!modalNotificacoesAtual) {
                    console.error('modalNotificacoes não encontrado no DOM após múltiplas tentativas!');
                    // Tenta encontrar qualquer elemento com id modal-notificacoes
                    const todosModais = document.querySelectorAll('[id*="modal-notificacoes"]');
                    dlog('Elementos com id contendo "modal-notificacoes" (debug):', todosModais.length);
                    
                    // Se ainda não encontrou, tenta buscar pelo seletor de classe
                    const modalPorClasse = document.querySelector('.modal-overlay[id="modal-notificacoes"]');
                    if (modalPorClasse) {
                        dlog('Modal encontrado por classe (debug)');
                        modalNotificacoesAtual = modalPorClasse;
                    } else {
                        console.error('Modal não encontrado de forma alguma. Verifique se o elemento existe no HTML.');
                        return;
                    }
                }
                dlog('modalNotificacoes encontrado (debug)');
                
                // Verifica o estado atual do modal de forma mais robusta
                const temClasseHidden = modalNotificacoesAtual.classList.contains('hidden');
                const displayAtual = window.getComputedStyle(modalNotificacoesAtual).display;
                const visibilityAtual = window.getComputedStyle(modalNotificacoesAtual).visibility;
                const opacityAtual = window.getComputedStyle(modalNotificacoesAtual).opacity;
                const estaVisivel = !temClasseHidden && displayAtual !== 'none' && displayAtual !== '' && visibilityAtual !== 'hidden' && opacityAtual !== '0';
                
                dlog('Estado do modal (debug):', {
                    temClasseHidden,
                    displayAtual,
                    visibilityAtual,
                    opacityAtual,
                    estaVisivel,
                    offsetParent: modalNotificacoesAtual.offsetParent !== null,
                    styleDisplay: modalNotificacoesAtual.style.display,
                    styleVisibility: modalNotificacoesAtual.style.visibility
                });
                
                // Se o modal está visível (não tem hidden E display não é none), então fecha
                if (estaVisivel) {
                    dlog('Fechando modal (debug)');
                    
                    // IMPORTANTE: NUNCA remove o modal do DOM, apenas adiciona a classe hidden
                    // Verifica se o modal ainda está no DOM antes de fechar
                    if (!document.body.contains(modalNotificacoesAtual)) {
                        console.error('Modal não está no DOM! Não é possível fechar.');
                        return;
                    }
                    
                    // Remove TODOS os estilos inline PRIMEIRO para que a classe hidden funcione
                    modalNotificacoesAtual.style.cssText = '';
                    // Remove também via removeProperty para garantir
                    modalNotificacoesAtual.style.removeProperty('display');
                    modalNotificacoesAtual.style.removeProperty('visibility');
                    modalNotificacoesAtual.style.removeProperty('opacity');
                    modalNotificacoesAtual.style.removeProperty('position');
                    modalNotificacoesAtual.style.removeProperty('z-index');
                    modalNotificacoesAtual.style.removeProperty('top');
                    modalNotificacoesAtual.style.removeProperty('left');
                    modalNotificacoesAtual.style.removeProperty('width');
                    modalNotificacoesAtual.style.removeProperty('height');
                    
                    // Agora adiciona a classe hidden
                    modalNotificacoesAtual.classList.add('hidden');
                    
                    // Limpa a mensagem de erro/aviso quando fecha o modal
                    const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                    if (mensagemProposta) {
                        mensagemProposta.style.display = 'none';
                        const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                        if (mensagemTexto) {
                            mensagemTexto.textContent = '';
                        }
                        // Remove o flag quando limpa a mensagem
                        window.temMensagemErroNotificacao = false;
                    }
                    
                    // Reseta a flag imediatamente ao fechar
                    modalAbertoAgora = false;
                    // Sempre reseta o modo de seleção ao fechar o modal
                    if (modoSelecao) {
                        dlog('Resetando modo de seleção ao fechar modal (debug)');
                        modoSelecao = false;
                        notificacoesSelecionadas.clear();
                        const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                        if (btnLixeiraAtual) {
                            btnLixeiraAtual.classList.remove('modo-selecao');
                        }
                        if (selecionarTudoContainer) {
                            selecionarTudoContainer.style.display = 'none';
                        }
                    }
                    
                    // Verifica se o modal foi fechado corretamente (múltiplas verificações)
                    setTimeout(() => {
                        const modalVerificacao = document.getElementById('modal-notificacoes');
                        if (modalVerificacao) {
                            const aindaTemHidden = modalVerificacao.classList.contains('hidden');
                            const displayVerificacao = window.getComputedStyle(modalVerificacao).display;
                            dlog('Verificação pós-fechar (debug):', {
                                aindaTemHidden,
                                displayVerificacao,
                                aindaNoDOM: true
                            });
                        } else {
                            console.error('Modal não encontrado no DOM após fechar. Algo está removendo o modal.');
                        }
                    }, 50);
                    
                    setTimeout(() => {
                        const modalVerificacao2 = document.getElementById('modal-notificacoes');
                        if (!modalVerificacao2) {
                            dwarn('Modal ainda não encontrado após 100ms!');
                        }
                    }, 100);
                    
                    return;
                }
                
                // Se chegou aqui, o modal está fechado - vamos abrir
                dlog('Abrindo modal (debug)');
                dlog('Estado antes de abrir (debug):', {
                    temClasseHidden: modalNotificacoesAtual.classList.contains('hidden'),
                    display: window.getComputedStyle(modalNotificacoesAtual).display,
                    modalAbertoAgora: modalAbertoAgora
                });
                
                // Limpa a mensagem de erro/aviso quando abre o modal
                const mensagemProposta = document.getElementById('mensagem-proposta-respondida');
                if (mensagemProposta) {
                    mensagemProposta.style.display = 'none';
                    const mensagemTexto = document.getElementById('mensagem-proposta-texto');
                    if (mensagemTexto) {
                        mensagemTexto.textContent = '';
                    }
                    // Remove o flag quando limpa a mensagem
                    window.temMensagemErroNotificacao = false;
                }
                
                // Garante que o modo de seleção está desativado ao abrir o modal
                if (modoSelecao) {
                    dlog('Resetando modo de seleção ao abrir modal (debug)');
                    modoSelecao = false;
                    notificacoesSelecionadas.clear();
                    const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                    if (btnLixeiraAtual) {
                        btnLixeiraAtual.classList.remove('modo-selecao');
                    }
                    if (selecionarTudoContainer) {
                        selecionarTudoContainer.style.display = 'none';
                    }
                }
                
                // Reseta a flag ANTES de abrir para garantir que não interfira
                modalAbertoAgora = false;
                
                if (listaNotificacoes) listaNotificacoes.innerHTML = '<p style="text-align: center; padding: 20px;">Carregando notificações...</p>';
                
                // Remove a classe hidden PRIMEIRO
                modalNotificacoesAtual.classList.remove('hidden');
                
                // Força os estilos necessários de forma simples e direta
                modalNotificacoesAtual.style.setProperty('display', 'flex', 'important');
                modalNotificacoesAtual.style.setProperty('visibility', 'visible', 'important');
                modalNotificacoesAtual.style.setProperty('opacity', '1', 'important');
                modalNotificacoesAtual.style.setProperty('position', 'fixed', 'important');
                modalNotificacoesAtual.style.setProperty('z-index', '1000', 'important');
                modalNotificacoesAtual.style.setProperty('top', '0', 'important');
                modalNotificacoesAtual.style.setProperty('left', '0', 'important');
                modalNotificacoesAtual.style.setProperty('width', '100%', 'important');
                modalNotificacoesAtual.style.setProperty('height', '100%', 'important');
                
                // Marca que o modal acabou de ser aberto DEPOIS de aplicar os estilos
                modalAbertoAgora = true;
                
                dlog('Modal aberto, preparando leitura e carregando notificações (debug)');

                // Some o badge IMEDIATAMENTE ao abrir (UX)
                if (badgeNotificacoes) {
                    badgeNotificacoes.textContent = '0';
                    badgeNotificacoes.style.display = 'none';
                }
                
                // Aguarda um frame para garantir que os estilos foram aplicados
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Verifica se o modal realmente abriu
                const modalAposAbrir = document.getElementById('modal-notificacoes');
                if (modalAposAbrir) {
                    const aindaTemHidden = modalAposAbrir.classList.contains('hidden');
                    const displayAposAbrir = window.getComputedStyle(modalAposAbrir).display;
                    const visibilityAposAbrir = window.getComputedStyle(modalAposAbrir).visibility;
                    
                    dlog('Estado após abrir (debug):', {
                        temClasseHidden: aindaTemHidden,
                        display: displayAposAbrir,
                        visibility: visibilityAposAbrir,
                        modalAbertoAgora: modalAbertoAgora,
                        offsetParent: modalAposAbrir.offsetParent !== null
                    });
                    
                    // Se ainda tem hidden ou display é none, força novamente
                    if (aindaTemHidden || displayAposAbrir === 'none') {
                        dwarn('Modal não abriu corretamente, forçando novamente...');
                        modalAposAbrir.classList.remove('hidden');
                        modalAposAbrir.style.setProperty('display', 'flex', 'important');
                        modalAposAbrir.style.setProperty('visibility', 'visible', 'important');
                        modalAposAbrir.style.setProperty('opacity', '1', 'important');
                    }
                } else {
                    console.error('❌ Modal não encontrado após tentar abrir!');
                }
                
                // Marca todas como lidas ao abrir (antes de carregar, pra já zerar o número)
                try {
                    await fetch('/api/notificacoes/marcar-todas-lidas', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (err) {
                    console.error('Erro ao marcar todas como lidas:', err);
                }

                // Carrega as notificações (agora já devem vir como lidas e com totalNaoLidas=0)
                await carregarNotificacoes();
                
                // Verifica se o modal ainda está visível após carregar
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Busca o modal novamente para garantir que ainda está no DOM
                const modalVerificacao = document.getElementById('modal-notificacoes');
                if (modalVerificacao) {
                    const aindaTemHidden = modalVerificacao.classList.contains('hidden');
                    const displayVerificacao = window.getComputedStyle(modalVerificacao).display;
                    
                    if (aindaTemHidden || displayVerificacao === 'none') {
                        dwarn('Modal foi fechado durante o carregamento, reabrindo...');
                        modalVerificacao.classList.remove('hidden');
                        modalVerificacao.style.setProperty('display', 'flex', 'important');
                        modalVerificacao.style.setProperty('visibility', 'visible', 'important');
                        modalVerificacao.style.setProperty('opacity', '1', 'important');
                    }
                }
                
                setTimeout(() => {
                    configurarBotaoLixeira();
                    // Remove a flag após um tempo maior para garantir que o modal não fecha imediatamente
                    setTimeout(() => {
                        modalAbertoAgora = false;
                        dlog('Flag modalAbertoAgora removida (debug)');
                    }, 500);
                }, 300);
                
                // (removido) já marcamos como lidas acima, antes do carregamento
            });
            dlog('Event listener do botão de notificações adicionado (debug)');
            
            // Fecha modal ao clicar fora (usa novoBtnNotificacoes)
            // Usa um listener único por página para evitar múltiplos listeners
            if (!window.notificacoesClickForaListener) {
                window.notificacoesClickForaListener = true;
                document.addEventListener('click', (ev) => {
                    // Se o modal acabou de ser aberto, ignora este clique
                    if (modalAbertoAgora) {
                        dlog('Ignorando clique - modal acabou de ser aberto (debug)');
                        return;
                    }
                    
                    // Busca o modal dinamicamente para garantir que a referência está atualizada
                    const modalNotificacoesAtual = document.getElementById('modal-notificacoes');
                    if (!modalNotificacoesAtual) {
                        dwarn('Modal não encontrado no listener de clique fora');
                        return;
                    }
                    
                    // Verifica se o modal está realmente aberto
                    // Considera tanto a classe hidden quanto os estilos inline
                    const temClasseHidden = modalNotificacoesAtual.classList.contains('hidden');
                    const displayAtual = window.getComputedStyle(modalNotificacoesAtual).display;
                    const styleDisplay = modalNotificacoesAtual.style.display;
                    const styleVisibility = modalNotificacoesAtual.style.visibility;
                    
                    // Modal está aberto se: não tem hidden E (display é flex OU tem estilos inline forçando visibilidade)
                    const estaAberto = !temClasseHidden && (displayAtual === 'flex' || styleDisplay === 'flex' || (styleDisplay && styleDisplay.includes('flex')));
                    
                    if (!estaAberto) {
                        // Modal já está fechado, não precisa fazer nada
                        return;
                    }
                    
                    const cliqueDentro = modalNotificacoesAtual.contains(ev.target);
                    const cliqueNoBotao = novoBtnNotificacoes.contains(ev.target);
                    dlog('Verificando clique fora (debug):', { 
                        cliqueDentro, 
                        cliqueNoBotao, 
                        target: ev.target,
                        estaAberto,
                        temClasseHidden,
                        displayAtual
                    });
                    
                    if (!cliqueDentro && !cliqueNoBotao) {
                        dlog('Fechando modal por clique fora (debug)');
                        
                        // IMPORTANTE: NUNCA remove o modal do DOM, apenas adiciona a classe hidden
                        // Verifica se o modal ainda está no DOM antes de fechar
                        if (!document.body.contains(modalNotificacoesAtual)) {
                            console.error('❌ Modal não está no DOM! Não é possível fechar.');
                            return;
                        }
                        
                        // Remove TODOS os estilos inline PRIMEIRO para que a classe hidden funcione
                        modalNotificacoesAtual.style.cssText = '';
                        // Remove também via removeProperty para garantir
                        modalNotificacoesAtual.style.removeProperty('display');
                        modalNotificacoesAtual.style.removeProperty('visibility');
                        modalNotificacoesAtual.style.removeProperty('opacity');
                        modalNotificacoesAtual.style.removeProperty('position');
                        modalNotificacoesAtual.style.removeProperty('z-index');
                        modalNotificacoesAtual.style.removeProperty('top');
                        modalNotificacoesAtual.style.removeProperty('left');
                        modalNotificacoesAtual.style.removeProperty('width');
                        modalNotificacoesAtual.style.removeProperty('height');
                        
                        // Agora adiciona a classe hidden
                        modalNotificacoesAtual.classList.add('hidden');
                        
                        // Reseta a flag imediatamente ao fechar
                        modalAbertoAgora = false;
                        // Sempre reseta o modo de seleção ao fechar o modal
                        if (modoSelecao) {
                            dlog('Resetando modo de seleção ao fechar modal (debug)');
                            modoSelecao = false;
                            notificacoesSelecionadas.clear();
                            const btnLixeiraAtual = document.getElementById('btn-limpar-notificacoes');
                            if (btnLixeiraAtual) {
                                btnLixeiraAtual.classList.remove('modo-selecao');
                            }
                            if (selecionarTudoContainer) {
                                selecionarTudoContainer.style.display = 'none';
                            }
                        }
                        
                        // Verifica se o modal ainda está no DOM após fechar (múltiplas verificações)
                        setTimeout(() => {
                            const modalVerificacao = document.getElementById('modal-notificacoes');
                            if (!modalVerificacao) {
                                console.error('❌ Modal foi removido do DOM após fechar!');
                                console.error('❌ Isso não deveria acontecer. Algo está removendo o modal.');
                            } else {
                                dlog('Modal ainda está no DOM após fechar (debug)');
                                // Verifica se ainda tem a classe hidden
                                if (!modalVerificacao.classList.contains('hidden')) {
                                    dwarn('Modal não tem classe hidden após fechar, adicionando...');
                                    modalVerificacao.classList.add('hidden');
                                }
                            }
                        }, 50);
                        
                        setTimeout(() => {
                            const modalVerificacao2 = document.getElementById('modal-notificacoes');
                            if (!modalVerificacao2) {
                                console.error('❌ Modal ainda não encontrado após 100ms!');
                            }
                        }, 100);
                    }
                });
            }
        } else {
            dwarn('Botão de notificações não encontrado no DOM!');
        }
        
        // Botão marcar todas como lidas
        if (btnMarcarTodasLidas) {
            btnMarcarTodasLidas.addEventListener('click', async () => {
                try {
                    await fetch('/api/notificacoes/marcar-todas-lidas', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    await carregarNotificacoes();
                } catch (err) {
                    console.error('Erro ao marcar todas notificações como lidas:', err);
                }
            });
        }
        
        // Botão selecionar tudo
        if (btnSelecionarTudo) {
            btnSelecionarTudo.addEventListener('click', () => {
                const todasCards = document.querySelectorAll('.notificacao-card');
                const todasSelecionadas = notificacoesSelecionadas.size === todasCards.length;
                
                if (todasSelecionadas) {
                    notificacoesSelecionadas.clear();
                    todasCards.forEach(card => card.classList.remove('selecionada'));
                } else {
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
        
        // Delegação de eventos no modal (captura TODOS os cliques no modal)
        if (modalNotificacoes) {
            modalNotificacoes.addEventListener('click', (e) => {
                // Ignora cliques em notificações (elas têm seus próprios listeners)
                const notificacaoCard = e.target.closest('.notificacao-card');
                if (notificacaoCard) {
                    // Deixa o clique passar para o listener da notificação
                    return;
                }
                
                // Se clicou diretamente no overlay (não no conteúdo), fecha o modal
                const modalContent = modalNotificacoes.querySelector('.modal-content');
                if (e.target === modalNotificacoes || (modalContent && !modalContent.contains(e.target))) {
                    // Não fecha se clicou em um botão
                    if (!e.target.closest('button') || e.target.classList.contains('btn-close-modal')) {
                        dlog('Fechando modal por clique no overlay (delegação) (debug)');
                        // Remove estilos inline primeiro
                        modalNotificacoes.style.cssText = '';
                        modalNotificacoes.style.removeProperty('display');
                        modalNotificacoes.style.removeProperty('visibility');
                        modalNotificacoes.style.removeProperty('opacity');
                        // Adiciona classe hidden
                        modalNotificacoes.classList.add('hidden');
                        modalAbertoAgora = false;
                        e.stopPropagation();
                        return;
                    }
                }
                
                dlog('Clique detectado no modal (debug)');
                const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
                const iconLixeira = e.target.closest('.fa-trash');
                const isLixeira = btnLixeira || (iconLixeira && iconLixeira.closest('#btn-limpar-notificacoes'));
                
                if (isLixeira) {
                    dlog('Clique detectado via delegação no modal (debug)');
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.handleClickLixeira) {
                        window.handleClickLixeira(e);
                    } else {
                        console.error('❌ window.handleClickLixeira não encontrado na delegação!');
                    }
                    return false;
                }
            }, true); // Capture phase - captura antes de outros eventos
            
            // Também adiciona no bubble phase
            modalNotificacoes.addEventListener('click', (e) => {
                const btnLixeira = e.target.closest('#btn-limpar-notificacoes');
                if (btnLixeira) {
                    dlog('Clique detectado via delegação (bubble) (debug)');
                    e.stopPropagation();
                    e.preventDefault();
                    if (window.handleClickLixeira) {
                        window.handleClickLixeira(e);
                    }
                    return false;
                }
            }, false);
        }
        
        // Torna a função global para acesso externo
        window.carregarNotificacoes = carregarNotificacoes;
        
        // Carrega notificações periodicamente (mas não se houver mensagem de erro)
        setInterval(() => {
            if (!window.temMensagemErroNotificacao) {
                carregarNotificacoes();
            }
        }, 30000);
        carregarNotificacoes();
        
        // Proteção: verifica periodicamente se o modal ainda está no DOM
        setInterval(() => {
            const modalVerificacao = document.getElementById('modal-notificacoes');
            if (!modalVerificacao) {
                console.error('❌ Modal de notificações não encontrado no DOM durante verificação periódica!');
                console.error('❌ Isso não deveria acontecer. O modal pode ter sido removido por algum código.');
                // Tenta encontrar o modal no HTML original
                const modalNoHTML = document.querySelector('[id="modal-notificacoes"]');
                if (!modalNoHTML) {
                    console.error('❌ Modal não encontrado em lugar nenhum. Verifique se o elemento existe no HTML.');
                }
            }
        }, 5000); // Verifica a cada 5 segundos
    }
})();

