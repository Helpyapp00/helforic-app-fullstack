const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const AnuncioPago = mongoose.models.AnuncioPago || mongoose.model('AnuncioPago');

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
        price: 1.0
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

        if (anuncioId && mongoose.Types.ObjectId.isValid(anuncioId)) {
            const anuncio = await AnuncioPago.findById(anuncioId).lean();
            if (!anuncio) {
                return res.status(404).json({ success: false, message: 'Anúncio não encontrado.' });
            }
            externalReference = String(anuncioId);
            itemDescription = anuncio.titulo || planoInfo.title;
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
                    title: planoInfo.title,
                    description: itemDescription,
                    unit_price: Number(planoInfo.price),
                    quantity: 1,
                    currency_id: 'BRL'
                }
            ],
            external_reference: externalReference,
            back_urls: {
                success: `${backBase}/configuracoes-conta.html?pagamento=sucesso`,
                failure: `${backBase}/configuracoes-conta.html?pagamento=erro`,
                pending: `${backBase}/configuracoes-conta.html?pagamento=pendente`
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
                    if (mongoose.Types.ObjectId.isValid(externalRef)) {
                        await AnuncioPago.findByIdAndUpdate(externalRef, {
                            $set: { ativo: true }
                        });
                    } else {
                        try {
                            const json = Buffer.from(String(externalRef), 'base64').toString('utf8');
                            const payload = JSON.parse(json);
                            if (payload && payload.tipo === 'novo_anuncio' && payload.userId && payload.dados) {
                                const planoFinal = payload.plano === 'premium' ? 'premium' : 'basico';
                                const prioridadeFinal = planoFinal === 'premium' ? 10 : 0;
                                const inicioFinal = new Date();
                                const fimFinal = new Date(inicioFinal.getTime() + 30 * 24 * 60 * 60 * 1000);

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

module.exports = {
    criarPreferenciaPagamento,
    webhookMercadoPago
};
