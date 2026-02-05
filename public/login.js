document.addEventListener('DOMContentLoaded', function() {
    const formLogin = document.getElementById('form-login');
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    const formMessage = document.getElementById('form-message');
    const toggleSenhaBtn = document.getElementById('toggle-senha-login');
    const loginTitle = document.getElementById('login-title');

    // Define saudação dinâmica: "Bem-vindo!" ou "Bem-vindo de volta!"
    // Usa uma marcação no localStorage para saber se esse navegador já fez login antes.
    const jaLogouNesteDispositivo = localStorage.getItem('helpy-ja-logou') === 'true';
    if (loginTitle) {
        loginTitle.textContent = jaLogouNesteDispositivo ? 'Bem-vindo de volta!' : 'Bem-vindo!';
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

    formLogin.addEventListener('submit', async function(event) {
        event.preventDefault(); 

        const email = emailInput.value;
        const senha = senhaInput.value;

        if (!email || !senha) {
            showMessage('Por favor, preencha todos os campos.', 'error');
            return;
        }

        showMessage('Verificando credenciais...', 'info');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, senha })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // Se o servidor retornar HTML (ex: "A server error occurred"),
                // evita quebrar o login e mostra uma mensagem amigável.
                const rawText = await response.text().catch(() => '');
                console.error('Resposta não-JSON do /api/login:', rawText);
                throw new Error('Erro no servidor ao fazer login. Tente novamente em alguns instantes.');
            }

            if (response.ok && data.success) {
                showMessage(data.message || 'Login realizado com sucesso!', 'success');
                
                // 🛑 CORREÇÃO:
                // O server.js agora envia os campos na raiz do objeto 'data'.
                // (antes ele enviava data.user._id, data.user.tipo, etc.)
                
                if (!data.userId || !data.userType) {
                    throw new Error('Resposta do servidor incompleta. IDs não encontrados.');
                }

                localStorage.setItem('jwtToken', data.token);
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('userType', data.userType);
                localStorage.setItem('userName', data.userName || 'Usuário');
                localStorage.setItem('userPhotoUrl', data.userPhotoUrl || '/imagens/default-user.png');
                // Marca que esse dispositivo já efetuou login pelo menos uma vez
                localStorage.setItem('helpy-ja-logou', 'true');
                // Salva o tema do usuário no localStorage
                if (data.userTheme) {
                    localStorage.setItem('theme', data.userTheme);
                    document.documentElement.classList.toggle('dark-mode', data.userTheme === 'dark');
                }
                
                window.location.href = '/'; // Redireciona para o feed
            } else {
                showMessage(data.message || 'Erro ao fazer login. Verifique suas credenciais.', 'error');
            }
        } catch (error) {
            console.error('Erro ao enviar o formulário de login:', error);
            // Este é o erro que você está vendo no navegador
            showMessage(`Erro: ${error.message || 'Não foi possível conectar ao servidor.'}`, 'error');
        }
    });
});
