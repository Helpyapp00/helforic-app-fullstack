$path = 'c:\meu-app-fullstack\api\server.js'
$content = Get-Content -Raw -LiteralPath $path
$start = "// Confirmar perfil de candidato (quando profissional aceita o valor)"
$end = "// 🆕 NOVO: Rotas de Agendador Helpy"
$pattern = [regex]::Escape($start) + '.*?' + [regex]::Escape($end)
$newBlock = @'
// Confirmar perfil de candidato (quando profissional aceita o valor)
app.post('/api/times-projeto/:timeId/candidatos/:candidatoId/confirmar-perfil', authMiddleware, async (req, res) => {
    try {
        const { timeId, candidatoId } = req.params;
        const { acao } = req.body; // 'aceitar' ou 'recusar'
        const userId = req.user.id;

        const time = await TimeProjeto.findById(timeId);
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }

        // Verifica se o usuário é o dono do time
        if (time.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Apenas o dono do projeto pode confirmar perfis.' });
        }

        const candidatoIndex = time.candidatos.findIndex(c => c._id.toString() === candidatoId);
        if (candidatoIndex === -1) {
            return res.status(404).json({ success: false, message: 'Candidato não encontrado.' });
        }

        const candidato = time.candidatos[candidatoIndex];

        // Só pode confirmar se o candidato aceitou o valor (não contraproposta)
        if (candidato.tipoCandidatura !== 'aceite') {
            return res.status(400).json({ success: false, message: 'Esta ação só é válida para candidatos que aceitaram o valor proposto.' });
        }

        if (acao === 'aceitar') {
            const tipoProfissional = candidato.tipo;

            // Marca candidato como aceito
            time.candidatos[candidatoIndex].status = 'aceito';

            // Remove a vaga do tipo de profissional aceito de profissionaisNecessarios
            const profissionalIndex = time.profissionaisNecessarios.findIndex(p => p.tipo === tipoProfissional);
            if (profissionalIndex !== -1) {
                const profissionalNecessario = time.profissionaisNecessarios[profissionalIndex];
                // Reduz a quantidade ou remove se for 1
                if (profissionalNecessario.quantidade > 1) {
                    profissionalNecessario.quantidade -= 1;
                } else {
                    // Remove completamente a vaga
                    time.profissionaisNecessarios.splice(profissionalIndex, 1);
                }
            }

            // Se não há mais profissionais necessários, marca o time como concluído
            if (time.profissionaisNecessarios.length === 0) {
                time.status = 'concluido';
            }

            // Cria notificação para o profissional que foi aceito
            try {
                const profissionalId = candidato.profissionalId;
                const [profissional, cliente] = await Promise.all([
                    User.findById(profissionalId).select('nome'),
                    User.findById(time.clienteId).select('nome telefone')
                ]);

                if (profissional && profissionalId.toString() !== userId.toString()) {
                    const tituloNotificacao = 'Você agora faz parte da Equipe!';
                    const mensagemNotificacao = `Você agora faz parte da Equipe de "${time.titulo}"!`;

                    await criarNotificacao(
                        profissionalId,
                        'proposta_time_aceita',
                        tituloNotificacao,
                        mensagemNotificacao,
                        {
                            timeId: time._id.toString(),
                            candidatoId: candidato._id.toString(),
                            valorAceito: candidato.valor || 0,
                            tipoProfissional: candidato.tipo || '',
                            clienteNome: cliente?.nome || 'Cliente',
                            clienteTelefone: cliente?.telefone || '',
                            enderecoCompleto: (() => {
                                const enderecoParts = [];
                                if (time.localizacao.rua) enderecoParts.push(time.localizacao.rua);
                                if (time.localizacao.numero) enderecoParts.push(`Nº ${time.localizacao.numero}`);
                                if (time.localizacao.bairro) enderecoParts.push(time.localizacao.bairro);
                                if (time.localizacao.cidade) enderecoParts.push(time.localizacao.cidade);
                                if (time.localizacao.estado) enderecoParts.push(time.localizacao.estado);
                                return enderecoParts.length > 0
                                    ? enderecoParts.join(', ')
                                    : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()
                        },
                        null
                    );
                }
            } catch (notifError) {
                console.error('Erro ao criar notificação de proposta aceita:', notifError);
            }
        } else if (acao === 'recusar') {
            const candidatoRecusado = time.candidatos[candidatoIndex];
            const profissionalIdRecusado = candidatoRecusado.profissionalId;

            // Cria notificação para o profissional que foi recusado
            try {
                if (profissionalIdRecusado) {
                    const [profissionalRecusado, cliente] = await Promise.all([
                        User.findById(profissionalIdRecusado).select('nome'),
                        User.findById(time.clienteId).select('nome')
                    ]);
                    const nomeProfissional = profissionalRecusado?.nome || 'Você';
                    const nomeCliente = cliente?.nome || 'O usuário';

                    const tituloNotificacao = 'Candidatura recusada';
                    const mensagemNotificacao = `${nomeCliente} recusou sua candidatura para a equipe "${time.titulo}".`;

                    await criarNotificacao(
                        profissionalIdRecusado.toString(),
                        'candidatura_recusada_time',
                        tituloNotificacao,
                        mensagemNotificacao,
                        {
                            timeId: time._id.toString(),
                            candidatoId: candidatoId,
                            clienteId: time.clienteId.toString(),
                            clienteNome: nomeCliente,
                            tituloEquipe: time.titulo
                        },
                        null
                    );

                    console.log('✅ Notificação de recusa criada para profissional:', profissionalIdRecusado.toString());
                }
            } catch (notifError) {
                console.error('Erro ao criar notificação de recusa:', notifError);
            }

            // Remove completamente o candidato do array quando recusado
            time.candidatos.splice(candidatoIndex, 1);
        } else {
            return res.status(400).json({ success: false, message: 'Ação inválida. Use "aceitar" ou "recusar".' });
        }

        await time.save();
        res.json({ success: true, message: `Perfil ${acao === 'aceitar' ? 'confirmado' : 'recusado'} com sucesso!` });
    } catch (error) {
        console.error('Erro ao confirmar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
'@
$content = [regex]::Replace($content, $pattern, $newBlock + "`r`n`r`n" + $end, [System.Text.RegularExpressions.RegexOptions]::Singleline)
Set-Content -LiteralPath $path -Value $content -NoNewline
