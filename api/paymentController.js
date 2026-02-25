const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const AnuncioPago = mongoose.models.AnuncioPago || mongoose.model('AnuncioPago');
const User = mongoose.models.User || mongoose.model('User');

function getMpAccessToken() {
    const direct =
        process.env.MERCADOPAGO_ACCESS_TOKEN ||
        process.env.MP_ACCESS_TOKEN ||
        process.env.ACCESS_TOKEN;

    if (direct) return direct;

    const candidates = Object.keys(process.env || {}).filter((key) => {
        const upper = key.toUpperCase();
        return upper.includes('MERCADOPAGO') && upper.includes('ACCESS');
    });

    if (candidates.length > 0) {
        const key = candidates[0];
        if (process.env[key]) {
            console.warn('[Mercado Pago] Usando variável de ambiente alternativa para o token:', key);
            return process.env[key];
        }
    }

    try {
        const envPath = path.join(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf8');
            const lines = content.split(/\r?\n/);
            for (const raw of lines) {
                const line = raw.trim();
                if (!line || line.startsWith('#')) continue;
                const idx = line.indexOf('=');
                if (idx === -1) continue;
                const key = line.slice(0, idx).trim();
                if (!key) continue;
                const upperKey = key.toUpperCase();
                if (upperKey.includes('MERCADOPAGO') && upperKey.includes('ACCESS')) {
                    const value = line.slice(idx + 1).trim();
                    if (value) {
                        process.env.MERCADOPAGO_ACCESS_TOKEN = value;
                        console.warn('[Mercado Pago] Token carregado do arquivo .env usando chave:', key);
                        return value;
                    }
                }
            }
        } else {
            console.warn('[Mercado Pago] Arquivo .env não encontrado em:', envPath);
        }
    } catch (e) {
        console.error('[Mercado Pago] Erro ao tentar ler o arquivo .env diretamente:', e.message);
    }

    console.warn('[Mercado Pago] Access token não encontrado nas variáveis de ambiente esperadas.');
    return '';
}

function createPreferenceClient() {
    const token = getMpAccessToken();
    if (!token) {
        console.warn('[Mercado Pago] Access token não configurado no .env');
        return null;
    }
    const mpClient = new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 5000 }
    });
    return new Preference(mpClient);
}

function createPaymentClient() {
    const token = getMpAccessToken();
    if (!token) {
        console.warn('[Mercado Pago] Access token não configurado no .env');
        return null;
    }
    const mpClient = new MercadoPagoConfig({
        accessToken: token,
        options: { timeout: 5000 }
    });
    return new Payment(mpClient);
}

const PLANOS = {
    basico: {
        title: 'Plano Básico - Anúncio Helpy',
        price: 19.9
    },
    premium: {
        title: 'Plano Premium - Anúncio Helpy',
        price: 39.9
    }
};

function getAppBaseUrl() {
    const envUrl = process.env.APP_BASE_URL || process.env.FRONTEND_URL || '';
    if (envUrl) return envUrl.replace(/\/+$/, '');
    if (process.env.NODE_ENV !== 'production') {
        return 'http://localhost:3000';
    }
    return '';
}

async function criarPreferenciaPagamento(req, res) {
    try {
        const {
            plano,
            anuncioId,
            titulo,
            descricao,
            imagemUrl,
            linkUrl,
            endereco,
            numero,
            cidade,
            estado
        } = req.body || {};

        const planoKey = String(plano || 'basico').toLowerCase() === 'premium' ? 'premium' : 'basico';
        const planoInfo = PLANOS[planoKey];

        const preferenceClient = createPreferenceClient();
        if (!preferenceClient) {
            return res.status(500).json({ success: false, message: 'Pagamento indisponível no momento.' });
        }

        const baseUrl = getAppBaseUrl();
        const backBase = (baseUrl && baseUrl.trim().length > 0) ? baseUrl : 'http://localhost:3000';
        const isLocalBack = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(backBase);

        let externalReference = '';
        let itemDescription = planoInfo.title;
        let unitPrice = Number(planoInfo.price);

        if (anuncioId && mongoose.Types.ObjectId.isValid(anuncioId)) {
            const anuncio = await AnuncioPago.findById(anuncioId).lean();
            if (!anuncio) {
                return res.status(404).json({ success: false, message: 'Anúncio não encontrado.' });
            }
            externalReference = String(anuncioId);
            itemDescription = anuncio.titulo || planoInfo.title;
            if (planoKey === 'premium' && String(anuncio.plano) === 'basico') {
                const diff = Math.max(Number(PLANOS.premium.price) - Number(PLANOS.basico.price), 0);
                unitPrice = diff;
            }
        } else {
            const userId = req.user && req.user.id ? String(req.user.id) : null;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
            }
            if (!titulo || !imagemUrl) {
                return res.status(400).json({ success: false, message: 'Título e imagem são obrigatórios para criar o anúncio.' });
            }
            const payload = {
                tipo: 'novo_anuncio',
                userId,
                plano: planoKey,
                dados: {
                    titulo: String(titulo || '').trim(),
                    descricao: descricao ? String(descricao).trim() : '',
                    imagemUrl: String(imagemUrl || '').trim(),
                    linkUrl: linkUrl ? String(linkUrl).trim() : '',
                    endereco: endereco ? String(endereco).trim() : '',
                    numero: numero ? String(numero).trim() : '',
                    cidade: cidade ? String(cidade).trim() : '',
                    estado: estado ? String(estado).trim() : ''
                }
            };
            const json = JSON.stringify(payload);
            externalReference = Buffer.from(json, 'utf8').toString('base64');
            itemDescription = payload.dados.titulo || planoInfo.title;
        }

        const preference = {
            items: [
                {
                    title: (anuncioId && planoKey === 'premium') ? 'Upgrade para Premium - Anúncio Helpy' : planoInfo.title,
                    description: itemDescription,
                    unit_price: unitPrice,
                    quantity: 1,
                    currency_id: 'BRL'
                }
            ],
            external_reference: externalReference,
            back_urls: {
                success: `${backBase}/configuracoes-conta.html?pagamento=sucesso&section=sec-anuncios`,
                failure: `${backBase}/configuracoes-conta.html?pagamento=erro&section=sec-anuncios`,
                pending: `${backBase}/configuracoes-conta.html?pagamento=pendente&section=sec-anuncios`
            },
            auto_return: isLocalBack ? undefined : 'approved',
            payment_methods: {
                excluded_payment_types: [],
                excluded_payment_methods: [],
                installments: 12
            },
            notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || 'https://helpyapp.net/webhooks/mercadopago'
        };

        const mpResp = await preferenceClient.create({ body: preference });
        return res.json({
            success: true,
            init_point: mpResp?.init_point || mpResp?.sandbox_init_point || null,
            id: mpResp?.id || null
        });
    } catch (error) {
        console.error('Erro ao criar preferência de pagamento Mercado Pago:', error);
        return res.status(500).json({ success: false, message: 'Erro ao iniciar pagamento.' });
    }
}

async function criarPagamentoPix(req, res) {
    try {
        const {
            plano,
            anuncioId,
            titulo,
            descricao,
            imagemUrl,
            linkUrl,
            endereco,
            numero,
            cidade,
            estado,
            email,
            cpf
        } = req.body || {};

        const planoKey = String(plano || 'basico').toLowerCase() === 'premium' ? 'premium' : 'basico';
        const planoInfo = PLANOS[planoKey];

        if (!email || !cpf) {
            return res.status(400).json({ success: false, message: 'E-mail e CPF são obrigatórios para pagamento via Pix.' });
        }

        const paymentClient = createPaymentClient();
        if (!paymentClient) {
            return res.status(500).json({ success: false, message: 'Pagamento indisponível no momento.' });
        }

        const userId = req.user && req.user.id ? String(req.user.id) : null;

        let externalReference = '';
        let itemDescription = planoInfo.title;
        let unitPrice = Number(planoInfo.price);

        if (anuncioId && mongoose.Types.ObjectId.isValid(anuncioId)) {
            const anuncio = await AnuncioPago.findById(anuncioId).lean();
            if (!anuncio) {
                return res.status(404).json({ success: false, message: 'Anúncio não encontrado.' });
            }
            externalReference = String(anuncioId);
            itemDescription = anuncio.titulo || planoInfo.title;
            if (planoKey === 'premium' && String(anuncio.plano) === 'basico') {
                const diff = Math.max(Number(PLANOS.premium.price) - Number(PLANOS.basico.price), 0);
                unitPrice = diff;
            }
        } else {
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
            }
            if (!titulo || !imagemUrl) {
                return res.status(400).json({ success: false, message: 'Título e imagem são obrigatórios para criar o anúncio.' });
            }
            const tituloFinal = String(titulo || '').trim();
            const anuncioNovo = new AnuncioPago({
                ownerId: userId,
                titulo: tituloFinal,
                descricao: descricao ? String(descricao).trim() : '',
                imagemUrl: String(imagemUrl || '').trim(),
                linkUrl: linkUrl ? String(linkUrl).trim() : '',
                endereco: endereco ? String(endereco).trim() : '',
                numero: numero ? String(numero).trim() : '',
                cidade: cidade ? String(cidade).trim() : '',
                estado: estado ? String(estado).trim() : '',
                plano: planoKey,
                ativo: false,
                prioridade: planoKey === 'premium' ? 10 : 0
            });
            const salvo = await anuncioNovo.save();
            externalReference = String(salvo._id);
            itemDescription = tituloFinal || planoInfo.title;
        }

        const cleanCpf = String(cpf).replace(/\D/g, '');

        const body = {
            transaction_amount: unitPrice,
            description: itemDescription,
            payment_method_id: 'pix',
            external_reference: externalReference,
            payer: {
                email: String(email).trim(),
                identification: {
                    type: 'CPF',
                    number: cleanCpf
                }
            }
        };

        try {
            console.log('[PIX] Criando pagamento', {
                anuncioId: anuncioId || null,
                plano: planoKey,
                unitPrice,
                external_reference: externalReference
            });
        } catch (e) {}

        const payment = await paymentClient.create({ body });
        if (userId && cleanCpf && cleanCpf.length === 11) {
            try {
                const existingUser = await User.findById(userId).select('cpf').exec();
                if (existingUser && !existingUser.cpf) {
                    existingUser.cpf = cleanCpf;
                    await existingUser.save();
                }
            } catch (e) {
                console.error('Erro ao atualizar CPF do usuário:', e);
            }
        }
        const transactionData = payment && payment.point_of_interaction && payment.point_of_interaction.transaction_data
            ? payment.point_of_interaction.transaction_data
            : {};

        return res.json({
            success: true,
            id: payment && payment.id ? payment.id : null,
            status: payment && payment.status ? payment.status : null,
            status_detail: payment && payment.status_detail ? payment.status_detail : null,
            qr_code: transactionData.qr_code || null,
            qr_code_base64: transactionData.qr_code_base64 || null,
            ticket_url: transactionData.ticket_url || null,
            copy_and_paste: transactionData.qr_code || null
        });
    } catch (error) {
        console.error('Erro ao criar pagamento Pix Mercado Pago:', error);
        return res.status(500).json({ success: false, message: 'Erro ao iniciar pagamento via Pix.' });
    }
}

async function consultarPagamentoPix(req, res) {
    try {
        const id = req.query.id || req.query.paymentId;
        if (!id) {
            return res.status(400).json({ success: false, message: 'ID do pagamento é obrigatório.' });
        }
        const paymentClient = createPaymentClient();
        if (!paymentClient) {
            return res.status(500).json({ success: false, message: 'Pagamento indisponível no momento.' });
        }
        const payment = await paymentClient.get({ id });
        return res.json({
            success: true,
            status: payment && payment.status ? payment.status : null,
            status_detail: payment && payment.status_detail ? payment.status_detail : null
        });
    } catch (error) {
        console.error('Erro ao consultar pagamento Pix Mercado Pago:', error);
        return res.status(500).json({ success: false, message: 'Erro ao consultar status do pagamento Pix.' });
    }
}

async function confirmarPagamentoPix(req, res) {
    try {
        const id = req.body?.id || req.body?.paymentId;
        if (!id) {
            return res.status(400).json({ success: false, message: 'ID do pagamento é obrigatório.' });
        }
        const paymentClient = createPaymentClient();
        if (!paymentClient) {
            return res.status(500).json({ success: false, message: 'Pagamento indisponível no momento.' });
        }
        const payment = await paymentClient.get({ id });
        const status = payment && payment.status;
        const externalRef = payment && payment.external_reference;
        
        if (status === 'approved' && externalRef && mongoose.Types.ObjectId.isValid(externalRef)) {
            await _atualizarAnuncioAposPagamento(externalRef, payment);
        }
        return res.json({ success: true, status: status || null });
    } catch (error) {
        console.error('Erro ao confirmar pagamento Pix:', error);
        return res.status(500).json({ success: false, message: 'Erro ao confirmar pagamento Pix.' });
    }
}
async function webhookMercadoPago(req, res) {
    try {
        const type = req.query.type || req.query.topic;
        const dataId = req.query['data.id'] || req.query.id;

        if (type === 'payment' && dataId) {
            try {
                const paymentClient = createPaymentClient();
                if (!paymentClient) {
                    console.error('Pagamento recebido no webhook, mas access token do Mercado Pago não está configurado.');
                    return res.sendStatus(500);
                }

                const payment = await paymentClient.get({ id: dataId });
                const status = payment && payment.status;
                const externalRef = payment && payment.external_reference;

                if (status === 'approved' && externalRef) {
                    try {
                        console.log('[WEBHOOK] Pagamento aprovado', {
                            paymentId: dataId,
                            externalRef,
                            amount: payment?.transaction_amount || null
                        });
                    } catch (e) {}
                    if (mongoose.Types.ObjectId.isValid(externalRef)) {
                        await _atualizarAnuncioAposPagamento(externalRef, payment);
                    } else {
                        try {
                            const json = Buffer.from(String(externalRef), 'base64').toString('utf8');
                            const payload = JSON.parse(json);
                            if (payload && payload.tipo === 'novo_anuncio' && payload.userId && payload.dados) {
                                const planoFinal = payload.plano === 'premium' ? 'premium' : 'basico';
                                const prioridadeFinal = planoFinal === 'premium' ? 10 : 0;
                                const inicioFinal = new Date();
                                // Lógica de duração: Premium = 30 dias, Básico = 14 dias
                                const days = planoFinal === 'premium' ? 30 : 14;
                                const fimFinal = new Date(inicioFinal.getTime() + days * 24 * 60 * 60 * 1000);

                                const anuncio = new AnuncioPago({
                                    ownerId: payload.userId,
                                    titulo: payload.dados.titulo || '',
                                    descricao: payload.dados.descricao || '',
                                    imagemUrl: payload.dados.imagemUrl || '',
                                    linkUrl: payload.dados.linkUrl || '',
                                    endereco: payload.dados.endereco || '',
                                    numero: payload.dados.numero || '',
                                    cidade: payload.dados.cidade || '',
                                    estado: payload.dados.estado || '',
                                    plano: planoFinal,
                                    ativo: true,
                                    inicioEm: inicioFinal,
                                    fimEm: fimFinal,
                                    prioridade: prioridadeFinal
                                });
                                await anuncio.save();
                                console.log('[WEBHOOK] Criado novo anúncio a partir do pagamento', {
                                    ownerId: payload.userId,
                                    plano: planoFinal,
                                    _id: anuncio._id
                                });
                            }
                        } catch (parseErr) {
                            console.error('Falha ao interpretar external_reference do pagamento:', parseErr);
                        }
                    }
                }
            } catch (err) {
                console.error('Erro ao processar webhook de pagamento MP:', err);
            }
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Erro no webhook Mercado Pago:', error);
        res.sendStatus(500);
    }
}

async function _atualizarAnuncioAposPagamento(anuncioId, payment) {
    try {
        const anuncioExistente = await AnuncioPago.findById(anuncioId);
        if (anuncioExistente) {
            const planoAtual = anuncioExistente.plano === 'premium' ? 'premium' : 'basico';
            const amount = Number(payment && payment.transaction_amount ? payment.transaction_amount : 0);
            const diff = Math.max(Number(PLANOS.premium.price) - Number(PLANOS.basico.price), 0);
            const EPS = 0.1;
            const paidPremium = Math.abs(amount - Number(PLANOS.premium.price)) < EPS;
            const paidBasico = Math.abs(amount - Number(PLANOS.basico.price)) < EPS;
            const isUpgrade = (planoAtual === 'basico') && Math.abs(amount - diff) < EPS;
            const now = new Date();
            
            // Lógica de duração: Premium = 30 dias, Básico = 14 dias
            const daysPremium = 30;
            const daysBasic = 14;
            const getExpiry = (days) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

            let update = { ativo: true };
            
            if (isUpgrade) {
                update = { ativo: true, inicioEm: now, fimEm: getExpiry(daysPremium), prioridade: 10, plano: 'premium' };
            } else if (paidPremium) {
                update = { ativo: true, inicioEm: now, fimEm: getExpiry(daysPremium), prioridade: 10, plano: 'premium' };
            } else if (paidBasico) {
                update = { ativo: true, inicioEm: now, fimEm: getExpiry(daysBasic), prioridade: 0, plano: 'basico' };
            } else if (!anuncioExistente.inicioEm) {
                const isPremium = planoAtual === 'premium';
                const days = isPremium ? daysPremium : daysBasic;
                update = { ativo: true, inicioEm: now, fimEm: getExpiry(days), prioridade: isPremium ? 10 : 0 };
            }
            
            console.log('[_atualizarAnuncio] approved', {
                paymentId: payment?.id,
                anuncioId,
                amount,
                planoAtual,
                isUpgrade,
                set: update
            });
            
            await AnuncioPago.findByIdAndUpdate(anuncioId, { $set: update });
        }
    } catch (e) {
        console.error('Erro ao atualizar anúncio após pagamento:', e);
    }
}

async function processarPagamentoCartao(req, res) {
    try {
        const body = req.body || {};
        console.log('Recebendo pagamento cartão. Body:', JSON.stringify(body, null, 2));

        const {
            token,
            issuer_id,
            payment_method_id,
            transaction_amount,
            installments,
            payer,
            anuncioId,
            plano,
            titulo,
            imagemUrl,
            descricao,
            linkUrl,
            endereco,
            numero,
            cidade,
            estado
        } = body;

        if (!token || !payment_method_id) {
            console.error('Dados incompletos recebidos do frontend:', { token: !!token, payment_method_id, payer });
            return res.status(400).json({ success: false, message: 'Dados incompletos para processar pagamento (token ou método faltando).' });
        }

        const paymentClient = createPaymentClient();
        if (!paymentClient) {
            return res.status(500).json({ success: false, message: 'Pagamento indisponível no momento.' });
        }

        let anuncio = null;
        let expectedAmount = 0;
        let itemDescription = '';
        let targetAnuncioId = anuncioId;

        const planoKey = String(plano || 'basico').toLowerCase() === 'premium' ? 'premium' : 'basico';
        const planoInfo = PLANOS[planoKey];

        if (anuncioId && mongoose.Types.ObjectId.isValid(anuncioId)) {
            // Anúncio existente
            anuncio = await AnuncioPago.findById(anuncioId).lean();
            if (!anuncio) {
                return res.status(404).json({ success: false, message: 'Anúncio não encontrado.' });
            }
            
            // Valor padrão é o do plano escolhido
            expectedAmount = Number(planoInfo.price);
            itemDescription = anuncio.titulo || planoInfo.title;

            // Lógica de Upgrade: Só aplica se o anúncio JÁ ESTIVER ATIVO (pago anteriormente)
            // Se não estiver ativo (ativo: false), cobra o valor cheio, pois é o primeiro pagamento.
            if (anuncio.ativo && planoKey === 'premium' && String(anuncio.plano) === 'basico') {
                const diff = Math.max(Number(PLANOS.premium.price) - Number(PLANOS.basico.price), 0);
                expectedAmount = diff;
                itemDescription = 'Upgrade para Premium - Anúncio Helpy';
            }
        } else {
            // Novo Anúncio
            const userId = req.user && req.user.id ? String(req.user.id) : null;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
            }
            if (!titulo || !imagemUrl) {
                return res.status(400).json({ success: false, message: 'Título e imagem são obrigatórios para criar o anúncio.' });
            }

            const anuncioNovo = new AnuncioPago({
                ownerId: userId,
                titulo: String(titulo || '').trim(),
                descricao: descricao ? String(descricao).trim() : '',
                imagemUrl: String(imagemUrl || '').trim(),
                linkUrl: linkUrl ? String(linkUrl).trim() : '',
                endereco: endereco ? String(endereco).trim() : '',
                numero: numero ? String(numero).trim() : '',
                cidade: cidade ? String(cidade).trim() : '',
                estado: estado ? String(estado).trim() : '',
                plano: planoKey,
                ativo: false, // Só ativa após pagamento aprovado
                prioridade: planoKey === 'premium' ? 10 : 0
            });
            const salvo = await anuncioNovo.save();
            targetAnuncioId = String(salvo._id);
            expectedAmount = Number(planoInfo.price);
            itemDescription = salvo.titulo || planoInfo.title;
        }

        const paymentData = {
            transaction_amount: expectedAmount, // Força o valor correto calculado pelo backend
            token,
            description: itemDescription,
            installments: Number(installments || 1),
            payment_method_id,
            issuer_id,
            payer: {
                email: (payer && payer.email) ? payer.email : 'user@example.com' 
            },
            external_reference: targetAnuncioId
        };
        
        // Adiciona identificação se disponível (obrigatório em alguns casos de produção)
        if (payer && payer.identification) {
            paymentData.payer.identification = payer.identification;
        }

        // Se o email vier do frontend (payer.email), confiamos nele.
        // Removemos a lógica que forçava e-mail de teste, pois estava causando 403 Forbidden.
        
        console.log('Enviando pagamento para MP:', JSON.stringify(paymentData, null, 2));
        
        const response = await paymentClient.create({ body: paymentData });
        
        if (response.status === 'approved') {
            await _atualizarAnuncioAposPagamento(targetAnuncioId, response);
        }

        return res.status(200).json({ success: true, payment_id: response.id, status: response.status });

    } catch (error) {
        console.error('Erro ao processar pagamento cartão:', error);
        if (error.cause) {
            console.error('Causa do erro Mercado Pago:', JSON.stringify(error.cause, null, 2));
        }
        const statusDetail = error.status_detail || error.message || 'Erro desconhecido';
        return res.status(500).json({ success: false, message: 'Erro ao processar pagamento.', status_detail: statusDetail });
    }
}

module.exports = {
    criarPreferenciaPagamento,
    criarPagamentoPix,
    consultarPagamentoPix,
    confirmarPagamentoPix,
    processarPagamentoCartao,
    webhookMercadoPago
};
