document.addEventListener('DOMContentLoaded', function() {
    try {
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflowY = 'auto';
    } catch (e) {}

    // Fecha qualquer overlay/modal que possa travar a rolagem do body
    try {
        const overlays = document.querySelectorAll('.modal-overlay, #image-modal-pedido, .image-modal-overlay');
        overlays.forEach((el) => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    } catch (e) {}
    // Elementos das etapas
    const etapaValidarCodigo = document.getElementById('etapa-validar-codigo');
    const formCadastro = document.getElementById('form-cadastro');
    
    // Elementos da etapa de validação
    const codigoVerificacaoInput = document.getElementById('codigo-verificacao');
    const btnValidarCodigo = document.getElementById('btn-validar-codigo');
    const btnVoltarFormulario = document.getElementById('btn-voltar-formulario');
    const linkReenviarCodigo = document.getElementById('link-reenviar-codigo');
    const emailExibido = document.getElementById('email-exibido');
    
    // Variáveis para armazenar dados do formulário
    let emailDoFormulario = null;
    let dadosFormulario = null;
    
    // Elementos do formulário de cadastro
    const nomeInput = document.getElementById('nome');
    const sobrenomeInput = document.getElementById('sobrenome');
    const fotoInput = document.getElementById('foto');
    const fotoPreview = document.getElementById('foto-preview');
    const fotoPreviewContainer = document.querySelector('.foto-preview-container');
    const btnRemoverFotoPerfil = document.querySelector('.btn-remover-foto-perfil');
    const idadeInput = document.getElementById('idade');
    const cidadeInput = document.getElementById('cidade');
    const estadoInput = document.getElementById('estado');
    const atuacaoInput = document.getElementById('atuacao');
    const atuacaoGroup = document.getElementById('atuacao-group');
    const tipoSelect = document.getElementById('tipo');
    const descricaoTextarea = document.getElementById('descricao');
    const telefoneInput = document.getElementById('telefone');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const confirmarSenhaInput = document.getElementById('confirmar-senha');
    const formMessage = document.getElementById('form-message');
    const toggleSenhaBtn = document.getElementById('toggle-senha');
    const toggleConfirmarSenhaBtn = document.getElementById('toggle-confirmar-senha');
    const temaInput = document.getElementById('tema');
    const temaOpcoes = document.querySelectorAll('.tema-opcao');
    const temaContainer = document.querySelector('.tema-selecao-container');

    function setTema(tema) {
        if (!temaInput) return;
        temaInput.value = tema;

        // Cartões de preview (desktop e mobile)
        temaOpcoes.forEach(o => {
            const optTema = o.getAttribute('data-tema');
            if (optTema === tema) {
                o.classList.add('selected');
            } else {
                o.classList.remove('selected');
            }
        });

        // Define o estado visual do "slider" (mostra só um card com animação)
        if (temaContainer) {
            temaContainer.classList.remove('tema-light-ativo', 'tema-dark-ativo');
            temaContainer.classList.add(tema === 'dark' ? 'tema-dark-ativo' : 'tema-light-ativo');
        }
    }

    // Toggle mostrar/ocultar senha
    if (toggleSenhaBtn) {
        toggleSenhaBtn.addEventListener('click', function() {
            const type = senhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
            senhaInput.setAttribute('type', type);
            
            const icon = toggleSenhaBtn.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    }

    // Toggle mostrar/ocultar confirmar senha
    if (toggleConfirmarSenhaBtn) {
        toggleConfirmarSenhaBtn.addEventListener('click', function() {
            const type = confirmarSenhaInput.getAttribute('type') === 'password' ? 'text' : 'password';
            confirmarSenhaInput.setAttribute('type', type);
            
            const icon = toggleConfirmarSenhaBtn.querySelector('i');
            if (type === 'password') {
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            } else {
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            }
        });
    }

    // Seleção visual de tema
    // Simplificado: clique seleciona diretamente o tema, independente do dispositivo
    temaOpcoes.forEach(opcao => {
        opcao.addEventListener('click', function() {
            const temaDaOpcao = opcao.getAttribute('data-tema') || 'light';
            setTema(temaDaOpcao);
        });
    });

    // Inicializa com o valor do input (padrão 'dark' se não definido)
    setTema(temaInput && temaInput.value ? temaInput.value : 'dark');

    // --- Funções de Feedback ---
    function showMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`; 
        formMessage.classList.remove('hidden');
        if (type !== 'info') { 
            setTimeout(() => {
                formMessage.classList.add('hidden');
            }, 5000);
        }
    }

    // --- Função para mostrar etapa ---
    function mostrarEtapa(etapa) {
        etapaValidarCodigo.style.display = 'none';
        formCadastro.style.display = 'none';
        
        if (etapa === 'codigo') {
            etapaValidarCodigo.style.display = 'block';
        } else if (etapa === 'cadastro') {
            formCadastro.style.display = 'block';
        }
    }

    // --- Voltar para formulário ---
    btnVoltarFormulario.addEventListener('click', function() {
        mostrarEtapa('cadastro');
        codigoVerificacaoInput.value = '';
    });

    // --- Reenviar código ---
    linkReenviarCodigo.addEventListener('click', async function(e) {
        e.preventDefault();
        if (emailDoFormulario) {
            showMessage('Reenviando código...', 'info');
            try {
                const response = await fetch('/api/verificar-email/solicitar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: emailDoFormulario })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    showMessage('Código reenviado! Verifique sua caixa de entrada.', 'success');
                } else {
                    throw new Error(data.message || 'Erro ao reenviar código.');
                }
            } catch (error) {
                console.error('Erro ao reenviar código:', error);
                showMessage(`Erro: ${error.message}`, 'error');
            }
        }
    });

    // --- Formatação do código (apenas números) ---
    codigoVerificacaoInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
    });

    // --- Lógica da Pré-visualização da Foto ---
    if (fotoInput) {
    fotoInput.addEventListener('change', function(event) {
        const file = event.target.files[0]; 
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                fotoPreview.src = e.target.result;
                fotoPreviewContainer.classList.add('has-image');
                    if (btnRemoverFotoPerfil) btnRemoverFotoPerfil.style.display = 'flex';
            };
            reader.readAsDataURL(file);
        } else {
                fotoPreview.src = 'imagens/default-user.png';
                fotoPreviewContainer.classList.remove('has-image');
                if (btnRemoverFotoPerfil) btnRemoverFotoPerfil.style.display = 'none';
            }
        });
    }

    // Clique na área da foto: sempre abre o seletor de arquivo
    if (fotoPreviewContainer && fotoInput) {
        fotoPreviewContainer.addEventListener('click', function() {
            fotoInput.click();
        });
    }

    // Botão "X" para limpar/remover a foto e voltar ao padrão
    if (btnRemoverFotoPerfil && fotoInput) {
        btnRemoverFotoPerfil.addEventListener('click', function(event) {
            event.stopPropagation();
            fotoInput.value = '';
            fotoPreview.src = 'imagens/default-user.png';
            fotoPreviewContainer.classList.remove('has-image');
            btnRemoverFotoPerfil.style.display = 'none';
        });
        }

    // --- Campo de Atuação sempre opcional ---
    // Atuação é opcional para todos os tipos de usuário
    if (atuacaoInput) {
        atuacaoInput.removeAttribute('required');
    } 

    function syncAtuacaoVisibility() {
        if (!tipoSelect || !atuacaoGroup) return;
        // Mantém a Área de atuação sempre visível, apenas sem required
        atuacaoGroup.classList.remove('atuacao-hidden');
    }

    if (tipoSelect) {
        tipoSelect.addEventListener('change', syncAtuacaoVisibility);
    }
    syncAtuacaoVisibility();

    // --- Fallback para rolagem com a roda do mouse ---
    // Alguns navegadores/interações em inputs impedem o scroll da página. Garantimos manualmente.
    try {
        window.addEventListener('wheel', function(e) {
            if (e && typeof e.deltaY === 'number') {
                // Não cancela se algum modal ativo exigir bloqueio (não aplicável aqui)
                window.scrollBy({ top: e.deltaY, behavior: 'auto' });
            }
        }, { passive: true });
        // Evita que roda do mouse altere número/seleção e não role a página
        const wheelTargets = document.querySelectorAll('#form-cadastro input[type=\"number\"], #form-cadastro select');
        wheelTargets.forEach(el => {
            el.addEventListener('wheel', function(e) {
                e.preventDefault();
                e.stopPropagation();
                window.scrollBy({ top: e.deltaY, behavior: 'auto' });
            }, { passive: false });
        });
    } catch (e) {}

    // --- Lógica de Formatação de Telefone ---
    telefoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, ''); 
        value = value.substring(0, 11); 
        let formattedValue = '';
        if (value.length > 0) {
            formattedValue = '(' + value.substring(0, 2);
        }
        if (value.length > 2) {
            const part1Length = (value.length <= 10) ? 4 : 5; 
            formattedValue += ') ' + value.substring(2, 2 + part1Length);
        }
        if (value.length > 6) { 
            formattedValue += '-' + value.substring(2 + (value.length <= 10 ? 4 : 5));
        }
        e.target.value = formattedValue;
    });

    // --- Submissão do Formulário de Cadastro ---
    formCadastro.addEventListener('submit', async function(event) {
        event.preventDefault(); 

        // Validações
        if (senhaInput.value !== confirmarSenhaInput.value) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        const email = emailInput.value.trim();
        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            showMessage('Por favor, informe um email válido.', 'error');
            return;
        }

        // Armazena dados do formulário
        emailDoFormulario = email;
        const formData = new FormData(formCadastro);
        // Combina nome e sobrenome em um único campo "nome"
        const nomeCompleto = `${nomeInput.value.trim()} ${sobrenomeInput.value.trim()}`.trim();
        formData.set('nome', nomeCompleto);
        dadosFormulario = formData;

        // Solicita código de verificação
        showMessage('Enviando código de verificação...', 'info');
        const submitButton = formCadastro.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';

        try {
            const response = await fetch('/api/verificar-email/solicitar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                emailExibido.textContent = email;
                mostrarEtapa('codigo');
                showMessage('Código enviado! Verifique sua caixa de entrada.', 'success');
                codigoVerificacaoInput.focus();
            } else {
                throw new Error(data.message || 'Erro ao enviar código de verificação.');
            }
        } catch (error) {
            console.error('Erro ao solicitar código:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Próximo';
        }
    });

    // --- Validar Código e Criar Conta ---
    btnValidarCodigo.addEventListener('click', async function() {
        const codigo = codigoVerificacaoInput.value.trim();
        
        if (!codigo || codigo.length !== 6) {
            showMessage('Por favor, informe o código de 6 dígitos.', 'error');
            return;
        }

        if (!emailDoFormulario || !dadosFormulario) {
            showMessage('Erro: Dados do formulário não encontrados. Por favor, comece novamente.', 'error');
            mostrarEtapa('cadastro');
            return;
        }

        showMessage('Validando código e criando conta...', 'info');
        btnValidarCodigo.disabled = true;
        btnValidarCodigo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

        try {
            // Primeiro valida o código
            const validarResponse = await fetch('/api/verificar-email/validar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: emailDoFormulario,
                    codigo: codigo 
                })
            });

            const validarData = await validarResponse.json();

            if (!validarResponse.ok || !validarData.success) {
                throw new Error(validarData.message || 'Código inválido.');
            }

            // Se código válido, cria a conta
            const cadastroResponse = await fetch('/api/cadastro', {
                method: 'POST',
                body: dadosFormulario
            });

            const cadastroData = await cadastroResponse.json();

            if (cadastroResponse.ok && cadastroData.success) {
                // ✅ Cadastro concluído, mas NÃO vamos logar automaticamente
                showMessage('Cadastro realizado com sucesso! Agora faça login para entrar.', 'success');

                // Garante que não fique nenhum dado antigo de login
                localStorage.removeItem('jwtToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('userType');
                localStorage.removeItem('userName');
                localStorage.removeItem('userPhotoUrl');
                
                // Redireciona para a página de login
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else {
                throw new Error(cadastroData.message || 'Houve um erro ao criar a conta.');
            }

        } catch (error) {
            console.error('Erro ao validar código e criar conta:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            btnValidarCodigo.disabled = false;
            btnValidarCodigo.innerHTML = '<i class="fas fa-check-circle"></i> Validar e Criar Conta';
        }
    });
});
