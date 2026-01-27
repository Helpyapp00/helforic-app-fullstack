document.addEventListener('DOMContentLoaded', function() {
    const formSolicitarCodigo = document.getElementById('form-solicitar-codigo');
    const formNovaSenha = document.getElementById('form-nova-senha');
    const btnValidarCodigo = document.getElementById('btn-validar-codigo-recuperacao');
    const btnVoltarSolicitar = document.getElementById('btn-voltar-solicitar');
    const linkReenviarCodigo = document.getElementById('link-reenviar-codigo-recuperacao');
    const codigoRecuperacaoInput = document.getElementById('codigo-recuperacao');
    const emailRecuperacaoInput = document.getElementById('email-recuperacao');
    const emailExibidoRecuperacao = document.getElementById('email-exibido-recuperacao');
    const formMessage = document.getElementById('form-message');

    const etapaSolicitar = document.getElementById('etapa-solicitar');
    const etapaValidarCodigo = document.getElementById('etapa-validar-codigo');
    const etapaNovaSenha = document.getElementById('etapa-nova-senha');

    let emailRecuperacao = null;

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

    function mostrarEtapa(etapa) {
        etapaSolicitar.classList.remove('active');
        etapaValidarCodigo.classList.remove('active');
        etapaNovaSenha.classList.remove('active');
        
        if (etapa === 'solicitar') {
            etapaSolicitar.classList.add('active');
        } else if (etapa === 'validar-codigo') {
            etapaValidarCodigo.classList.add('active');
        } else if (etapa === 'nova-senha') {
            etapaNovaSenha.classList.add('active');
        }
    }

    // Formatação do código (apenas números)
    codigoRecuperacaoInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
    });

    // Solicitar código
    formSolicitarCodigo.addEventListener('submit', async function(event) {
        event.preventDefault();

        const email = emailRecuperacaoInput.value.trim();

        if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            showMessage('Por favor, informe um email válido.', 'error');
            return;
        }

        showMessage('Enviando código de verificação...', 'info');
        const submitButton = formSolicitarCodigo.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            const response = await fetch('/api/esqueci-senha/solicitar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                emailRecuperacao = email;
                emailExibidoRecuperacao.textContent = email;
                mostrarEtapa('validar-codigo');
                showMessage('Código enviado! Verifique sua caixa de entrada.', 'success');
                codigoRecuperacaoInput.focus();
            } else {
                throw new Error(data.message || 'Erro ao enviar código de verificação.');
            }
        } catch (error) {
            console.error('Erro ao solicitar código:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar código';
        }
    });

    // Voltar para solicitar código
    btnVoltarSolicitar.addEventListener('click', function() {
        mostrarEtapa('solicitar');
        codigoRecuperacaoInput.value = '';
    });

    // Reenviar código
    linkReenviarCodigo.addEventListener('click', async function(e) {
        e.preventDefault();
        if (emailRecuperacao) {
            showMessage('Reenviando código...', 'info');
            try {
                const response = await fetch('/api/esqueci-senha/solicitar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: emailRecuperacao })
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

    // Validar código
    btnValidarCodigo.addEventListener('click', async function() {
        const codigo = codigoRecuperacaoInput.value.trim();

        if (!codigo || codigo.length !== 6) {
            showMessage('Por favor, informe o código de 6 dígitos.', 'error');
            return;
        }

        if (!emailRecuperacao) {
            showMessage('Erro: Email não encontrado. Por favor, comece novamente.', 'error');
            mostrarEtapa('solicitar');
            return;
        }

        showMessage('Validando código...', 'info');
        btnValidarCodigo.disabled = true;
        btnValidarCodigo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';

        try {
            const response = await fetch('/api/esqueci-senha/validar-codigo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: emailRecuperacao,
                    codigo: codigo
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                mostrarEtapa('nova-senha');
                showMessage('Código válido! Agora defina sua nova senha.', 'success');
            } else {
                throw new Error(data.message || 'Código inválido.');
            }
        } catch (error) {
            console.error('Erro ao validar código:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            btnValidarCodigo.disabled = false;
            btnValidarCodigo.innerHTML = '<i class="fas fa-check"></i> Validar';
        }
    });

    // Redefinir senha
    formNovaSenha.addEventListener('submit', async function(event) {
        event.preventDefault();

        const novaSenha = document.getElementById('nova-senha').value;
        const confirmarNovaSenha = document.getElementById('confirmar-nova-senha').value;

        if (novaSenha !== confirmarNovaSenha) {
            showMessage('As senhas não coincidem.', 'error');
            return;
        }

        if (novaSenha.length < 6) {
            showMessage('A senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        if (!emailRecuperacao) {
            showMessage('Erro: Email não encontrado. Por favor, comece novamente.', 'error');
            mostrarEtapa('solicitar');
            return;
        }

        const codigo = codigoRecuperacaoInput.value.trim();
        if (!codigo || codigo.length !== 6) {
            showMessage('Por favor, informe o código de verificação.', 'error');
            mostrarEtapa('validar-codigo');
            return;
        }

        showMessage('Redefinindo senha...', 'info');
        const submitButton = formNovaSenha.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

        try {
            const response = await fetch('/api/esqueci-senha/redefinir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: emailRecuperacao,
                    codigo: codigo,
                    novaSenha: novaSenha
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                showMessage('Senha redefinida com sucesso! Redirecionando para login...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                throw new Error(data.message || 'Erro ao redefinir senha.');
            }
        } catch (error) {
            console.error('Erro ao redefinir senha:', error);
            showMessage(`Erro: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-key"></i> Redefinir Senha';
        }
    });
});

