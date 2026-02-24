// api/server.js
const path = require('path'); 
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Suprime avisos específicos incluindo NODE_TLS_REJECT_UNAUTHORIZED
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, type, code, ...args) {
    if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
        return;
    }
    if (warning && warning.message && warning.message.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
        return;
    }
    return originalEmitWarning.call(this, warning, type, code, ...args);
};

// ------------------------------------------------------------
// Logging: evita spam e vazamento de dados sensíveis em produção
// ------------------------------------------------------------
const IS_PROD = process.env.NODE_ENV === 'production';
const IS_DEV = !IS_PROD;

// Para debug manual de códigos de e-mail em dev:
//   DEBUG_EMAIL_CODES=1
const DEBUG_EMAIL_CODES = IS_DEV && process.env.DEBUG_EMAIL_CODES === '1';

// Silencia logs verbosos em produção (mantém warn/error).
if (IS_PROD) {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
}

const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');
const http = require('http');
const https = require('https');
let visionClient = null;

function initializeVisionClient() {
    try {
        const vision = require('@google-cloud/vision');
        const envJson = process.env.GOOGLE_CREDS_JSON;

        if (envJson && envJson.trim()) {
            try {
                const parsed = JSON.parse(envJson);
                if (parsed && typeof parsed === 'object') {
                    return new vision.ImageAnnotatorClient({ credentials: parsed });
                }
            } catch (e) {
                if (!IS_PROD) {
                    console.warn('Falha ao parsear GOOGLE_CREDS_JSON:', e.message || e);
                }
            }
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            return new vision.ImageAnnotatorClient();
        }

        if (!IS_PROD) {
            console.warn('Vision API não inicializada: defina GOOGLE_CREDS_JSON ou GOOGLE_APPLICATION_CREDENTIALS');
        }
    } catch (error) {
        if (!IS_PROD) {
            console.warn('Erro ao inicializar Vision API:', error.message || error);
        }
    }
    return null;
}

visionClient = initializeVisionClient();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }
});

function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token não fornecido.' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded?.user ? decoded.user : decoded;
        if (!req.user?.id && req.user?._id) req.user.id = req.user._id;
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: 'Token inválido.' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token inválido ou expirado.' });
    }
}

async function adminOnly(req, res, next) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        const user = await User.findById(userId).select('email role');
        const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        const isAdmin = user && (user.role === 'admin' || (adminEmail && String(user.email).toLowerCase() === adminEmail));
        if (!isAdmin) return res.status(403).json({ success: false, message: 'Acesso negado.' });
        next();
    } catch (e) {
        return res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
}

let sharpCache = null;
let sharpLoadAttempted = false;

function getSharp() {
    if (sharpLoadAttempted) {
        return sharpCache;
    }
    
    sharpLoadAttempted = true;
    
    try {
        sharpCache = require('sharp');
        if (sharpCache && typeof sharpCache === 'function') {
            return sharpCache;
        }
        throw new Error('Sharp carregado mas não funcional');
    } catch (error) {
        if (IS_DEV) {
            console.warn('⚠️ Sharp não disponível - usando processamento básico de imagem');
            console.warn('   Detalhes:', error.message);
        }
        sharpCache = null;
        return null;
    }
}

async function convertImageToWebp(buffer, maxWidth) {
    const sharp = getSharp();
    if (!sharp || !buffer) return buffer;
    try {
        let instance = sharp(buffer).rotate();
        if (Number.isFinite(maxWidth) && maxWidth > 0) {
            instance = instance.resize({ width: maxWidth, withoutEnlargement: true });
        }
        return await instance.toFormat('webp', { quality: 80 }).toBuffer();
    } catch (e) {
        return buffer;
    }
}

const app = express();

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

app.use((req, res, next) => {
    const allowed = new Set([
        'https://helpyapp.net',
        'https://www.helpyapp.net'
    ]);
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});

const publicDir = path.join(__dirname, '../public');
app.use('/uploads/explorar', express.static(path.join(publicDir, 'uploads/explorar'), { maxAge: 24 * 60 * 60 * 1000 }));
app.use('/uploads/posts', express.static(path.join(publicDir, 'uploads/posts'), { maxAge: 7 * 24 * 60 * 60 * 1000 }));
app.use('/uploads/avatars', express.static(path.join(publicDir, 'uploads/avatars'), { maxAge: 7 * 24 * 60 * 60 * 1000 }));
app.use(express.static(publicDir));

const INTERESSE_KEYWORDS_BASE = [
    'pintura',
    'lanche',
    'lanchonete',
    'cabelo',
    'sobrancelha',
    'unha',
    'massagem',
    'encanador',
    'eletricista',
    'mecanico',
    'oficina',
    'assistencia',
    'barbearia',
    'construcao',
    'reforma',
    'projeto'
];

function normalizeKeyword(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizeCityKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function extractInterestKeywords(texto) {
    const normalized = normalizeKeyword(texto);
    if (!normalized) return [];

    const tokens = normalized
        .split(/[^a-z0-9]+/i)
        .map(token => token.trim())
        .filter(token => token.length >= 3);

    const baseSet = new Set(INTERESSE_KEYWORDS_BASE.map(k => normalizeKeyword(k)));
    const keywords = new Set();

    tokens.forEach(token => {
        if (baseSet.has(token)) keywords.add(token);
    });

    baseSet.forEach(keyword => {
        if (normalized.includes(keyword)) keywords.add(keyword);
    });

    return Array.from(keywords);
}

mongoose.set('strictPopulate', false);

app.use('/api', async (req, res, next) => {
    try {
        await initializeServices();
        return next();
    } catch (error) {
        console.error('❌ Erro ao inicializar serviços para API:', error);
        return res.status(503).json({ success: false, message: 'Serviço indisponível no momento.' });
    }
});

app.get('/api/geocodificar-reversa', async (req, res) => {
    try {
        const lat = Number(req.query.lat);
        const lon = Number(req.query.lon);
        const accuracy = Number(req.query.accuracy);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return res.status(400).json({ success: false, message: 'Latitude/longitude inválidas.' });
        }

        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&addressdetails=1`;

        const data = await new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'HelpyApp/1.0 (contact@helpyapp.net)'
                }
            }, (response) => {
                let body = '';
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => {
                    if (!response.statusCode || response.statusCode >= 400) {
                        return reject(new Error(`Nominatim status ${response.statusCode}`));
                    }
                    try {
                        const parsed = JSON.parse(body);
                        return resolve(parsed);
                    } catch (parseError) {
                        return reject(parseError);
                    }
                });
            });
            request.on('error', reject);
        });

        const normalized = applyLocationOverrideIfNeeded(lat, lon, data, accuracy);

        return res.json({ success: true, data: normalized });
    } catch (error) {
        console.error('Erro ao geocodificar reversa:', error);
        return res.status(500).json({ success: false, message: 'Erro ao buscar endereço.' });
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/cadastro.html'));
});

app.get('/privacidade', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/privacidade.html'));
});

app.get('/termos', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/termos.html'));
});

app.get('/perfil/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/perfil.html'));
});

app.get('/perfil', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/perfil.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body || {};
        if (!email || !senha) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
        }

        const usuario = await User.findOne({ email: String(email).trim().toLowerCase() });
        if (!usuario) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const senhaOk = await bcrypt.compare(String(senha), usuario.senha || '');
        if (!senhaOk) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
        }

        const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        if (adminEmail && String(usuario.email).toLowerCase() === adminEmail && usuario.role !== 'admin') {
            try { 
                usuario.role = 'admin'; 
                await usuario.save(); 
            } catch {}
        }
        const payload = { user: { id: usuario._id, email: usuario.email, tipo: usuario.tipo, role: usuario.role || 'user' } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            token,
            userId: String(usuario._id),
            userType: usuario.tipo || 'usuario',
            userName: usuario.nome || 'Usuário',
            userPhotoUrl: usuario.foto || usuario.avatarUrl || 'https://placehold.co/50?text=User',
            userTheme: usuario.tema || usuario.userTheme || undefined,
            role: usuario.role || 'user'
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/verificar-email/solicitar', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
        }
        const code = (Math.floor(100000 + Math.random() * 900000)).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await EmailVerification.deleteMany({ email });
        const ev = new EmailVerification({ email, code, expiresAt });
        await ev.save();
        let sent = false;
        try {
            if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT || 587),
                    secure: false,
                    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                });
                await transporter.sendMail({
                    from: process.env.SMTP_FROM || 'no-reply@helpyapp.local',
                    to: email,
                    subject: 'Código de verificação Helpy',
                    text: `Seu código é: ${code}`,
                    html: `<p>Seu código é: <strong>${code}</strong></p>`
                });
                sent = true;
            }
        } catch (mailErr) {}
        return res.json({ success: true, sent });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erro ao solicitar verificação de email.' });
    }
});

app.post('/api/verificar-email/validar', async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const codigo = String(req.body?.codigo || '').trim();
        if (!email || !codigo) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios.' });
        }
        const ev = await EmailVerification.findOne({ email }).sort({ createdAt: -1 });
        if (!ev) {
            return res.status(400).json({ success: false, message: 'Código não encontrado.' });
        }
        if (ev.code !== codigo) {
            return res.status(400).json({ success: false, message: 'Código inválido.' });
        }
        if (ev.expiresAt && ev.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Código expirado.' });
        }
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erro ao validar código.' });
    }
});

app.post('/api/cadastro', upload.fields([{ name: 'fotoPerfil', maxCount: 1 }]), async (req, res) => {
    try {
        const nome = String(req.body?.nome || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        const senha = String(req.body?.senha || '');
        const aceitoTermos = String(req.body?.aceitoTermos || '').toLowerCase();
        if (!nome || !email || !senha) {
            return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios.' });
        }
        if (!aceitoTermos || (aceitoTermos !== 'on' && aceitoTermos !== 'true')) {
            return res.status(400).json({ success: false, message: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade.' });
        }
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(409).json({ success: false, message: 'Email já cadastrado.' });
        }
        const hash = await bcrypt.hash(senha, 10);
        let consentDate = new Date();
        if (req.body?.consentimentoLGPDAt) {
            const parsed = new Date(req.body.consentimentoLGPDAt);
            if (!Number.isNaN(parsed.getTime())) {
                consentDate = parsed;
            }
        }
        const baseUser = {
            nome,
            email,
            senha: hash,
            tipo: String(req.body?.tipo || 'usuario'),
            idade: req.body?.idade ? Number(req.body.idade) : undefined,
            telefone: String(req.body?.telefone || '').trim(),
            cidade: String(req.body?.cidade || '').trim(),
            estado: String(req.body?.estado || '').trim(),
            descricao: String(req.body?.descricao || '').trim(),
            atuacao: String(req.body?.atuacao || '').trim(),
            tema: String(req.body?.tema || '').trim(),
            userTheme: String(req.body?.tema || '').trim(),
            consentimentoLGPDAt: consentDate
        };
        const user = new User(baseUser);
        await user.save();
        const file =
            (req.files && req.files.fotoPerfil && req.files.fotoPerfil[0]) ||
            null;
        if (file && file.buffer) {
            const sharp = getSharp();
            let imageBuffer = file.buffer;
            try {
                if (sharp) {
                    imageBuffer = await sharp(file.buffer).resize(512, 512, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                }
            } catch (e) {}
            const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.jpg`;
            let fullUrl = '';
            if (s3Client && bucketName && process.env.AWS_REGION) {
                const key = `avatars/${String(user._id)}/${filename}`;
                const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                await s3Client.send(uploadCommand);
                fullUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            } else {
                const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
                try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (e) {}
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, imageBuffer);
                fullUrl = `/uploads/avatars/${filename}`;
            }
            await User.updateOne({ _id: user._id }, { $set: { avatarUrl: fullUrl, foto: fullUrl } });
        }
        const saved = await User.findById(user._id).select('-senha').lean();
        return res.status(201).json({ success: true, user: saved });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erro ao cadastrar usuário.' });
    }
});

// Overrides de localização (fallback quando provedor não retorna bairro/localidade)
let locationOverrides = [];
try {
    const overridesPath = path.join(__dirname, 'location-overrides.json');
    if (fs.existsSync(overridesPath)) {
        locationOverrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8')) || [];
    }
} catch (e) {
    locationOverrides = [];
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function applyLocationOverrideIfNeeded(lat, lon, normalized, accuracyMeters) {
    try {
        const n = normalized || {};
        const addr = (n.address || {});

        // Se cair dentro do raio de um override, aplica SEMPRE (mesmo que o provedor traga um bairro incorreto).
        // Para desativar em debug: use ?noOverride=1

        const latNum = Number(lat);
        const lonNum = Number(lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return n;

        // Se a localização estiver imprecisa, não aplica override por raio.
        // Isso evita que um GPS/Wi-Fi "solto" caia na área de um override incorreto.
        const accNum = Number(accuracyMeters);
        if (Number.isFinite(accNum) && accNum > 80) {
            return n;
        }

        for (const rule of (locationOverrides || [])) {
            if (!rule || !rule.center || !rule.address) continue;
            const rLat = Number(rule.center.lat);
            const rLon = Number(rule.center.lon);
            const rMeters = Number(rule.radiusMeters);
            if (!Number.isFinite(rLat) || !Number.isFinite(rLon) || !Number.isFinite(rMeters)) continue;
            const dist = haversineDistanceMeters(latNum, lonNum, rLat, rLon);
            if (dist <= rMeters) {
                const next = {
                    ...n,
                    address: {
                        ...addr,
                        ...rule.address
                    },
                    override: {
                        id: rule.id,
                        distanceMeters: Math.round(dist)
                    }
                };

                const a = next.address || {};
                const displayNameParts = [
                    a.road,
                    a.house_number,
                    a.neighbourhood || a.suburb,
                    a.city,
                    a.state,
                    a.postcode,
                    a.country
                ].map(p => (p || '').toString().trim()).filter(Boolean);
                next.display_name = displayNameParts.join(', ');
                return next;
            }
        }
        return n;
    } catch (e) {
        return normalized;
    }
}

let s3Client;
let bucketName;
let isDbConnected = false;

async function initializeServices() {
    // 1. CONEXÃO MONGOOSE
    if (!isDbConnected) {
        if (!process.env.MONGODB_URI) { 
            console.error("ERRO CRÍTICO: MONGODB_URI não encontrado no .env."); 
            throw new Error('Falha na conexão com o Banco de Dados.'); 
        }
        try {
            console.log('Tentando conectar ao MongoDB...');
            await mongoose.connect(process.env.MONGODB_URI, {
                serverSelectionTimeoutMS: 30000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000,
                family: 4
            });
            console.log('Conectado ao MongoDB Atlas com sucesso!');
            isDbConnected = true;
        } catch (err) { 
            console.error('ERRO CRÍTICO ao conectar ao MongoDB Atlas:', err.message); 
            throw new Error('Falha na conexão com o Banco de Dados: ' + err.message); 
        }
    }
    if (!s3Client) {
        if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.S3_BUCKET_NAME) {
             console.warn("AVISO: Variáveis de ambiente AWS S3 incompletas. Uploads não funcionarão.");
        } else {
            s3Client = new S3Client({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                },
            });
            bucketName = process.env.S3_BUCKET_NAME; 
            console.log("Cliente S3 inicializado com sucesso.");
        }
    }
}

// DEFINIÇÃO DOS SCHEMAS
// ----------------------------------------------------------------------
const userSchema = new mongoose.Schema({
    nome: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    senha: { type: String },
    tipo: { type: String, default: 'usuario' },
    foto: { type: String },
    avatarUrl: { type: String },
    tema: { type: String },
    userTheme: { type: String },
    consentimentoLGPDAt: { type: Date },
    role: { type: String, default: 'user' },
    cpf: { type: String, trim: true }
}, { timestamps: true, strict: false });

const User = mongoose.models.User || mongoose.model('User', userSchema);

const notificacaoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tipo: { type: String },
    titulo: { type: String },
    mensagem: { type: String },
    dadosAdicionais: { type: Object },
    lida: { type: Boolean, default: false },
    dataLeitura: { type: Date }
}, { timestamps: true, strict: false });

const Notificacao = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);

const emailVerificationSchema = new mongoose.Schema({
    email: { type: String, index: true },
    code: { type: String },
    expiresAt: { type: Date }
}, { timestamps: true, strict: false });

const EmailVerification = mongoose.models.EmailVerification || mongoose.model('EmailVerification', emailVerificationSchema);

// Helper central para criar notificações
async function criarNotificacao(userId, tipo, titulo, mensagem, dadosAdicionais = {}, link = null) {
    try {
        if (!userId) return null;
        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;
        const notificacao = new Notificacao({
            userId: userIdObjectId,
            tipo,
            titulo,
            mensagem,
            dadosAdicionais: dadosAdicionais || {},
            link
        });
        await notificacao.save();
        return notificacao;
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
        return null;
    }
}

const moderationLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tipo: { type: String },
    motivo: { type: String },
    detalhe: { type: String },
    mediaType: { type: String },
    texto: { type: String },
    origem: { type: String },
    ip: { type: String },
    arquivada: { type: Boolean, default: false }
}, { timestamps: true, strict: false });

const ModerationLog = mongoose.models.ModerationLog || mongoose.model('ModerationLog', moderationLogSchema);

const postagemSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String },
    mediaUrl: { type: String },
    mediaType: { type: String },
    category_tag: { type: String },
    gender_tag: { type: String },
    expiresAt: { type: Date },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [{ type: Object }]
}, { timestamps: true, strict: false });

const Postagem = mongoose.models.Postagem || mongoose.model('Postagem', postagemSchema);

const normalizeKeywordText = (text) => String(text || '')
    .normalize('NFD')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const explorarKeywordSets = {
    Moda: ['moda', 'roupa', 'loja', 'estilo', 'look', 'camisa', 'vestido', 'saia', 'sapato', 'tenis', 'tênis', 'salto', 'bolsa', 'bermuda', 'jaqueta'],
    Comidas: ['comida', 'restaurante', 'lanche', 'pizza', 'hamburguer', 'hambúrguer', 'bolo', 'doce', 'salgado', 'delivery', 'churrasco', 'almoço', 'jantar'],
    Promocoes: ['promocao', 'promoção', 'desconto', 'oferta', 'cupom', 'queima', 'liquidacao', 'liquidação']
};

const explorarGenderKeywords = {
    Masculino: ['tenis', 'tênis', 'camisa', 'sapato', 'bermuda', 'barba', 'masculino'],
    Feminino: ['batom', 'saia', 'vestido', 'maquiagem', 'salto', 'bolsa', 'feminino'],
    Ambos: ['unissex', 'ambos']
};

const detectExplorarCategoryTag = (content) => {
    const normalized = normalizeKeywordText(content);
    if (!normalized) return '';
    const tokens = normalized.split(' ');
    for (const [tag, keywords] of Object.entries(explorarKeywordSets)) {
        if (keywords.some((keyword) => tokens.includes(normalizeKeywordText(keyword)))) {
            return tag === 'Promocoes' ? 'Promoções' : tag;
        }
    }
    return '';
};

const detectExplorarGenderTag = (content) => {
    const normalized = normalizeKeywordText(content);
    if (!normalized) return '';
    const tokens = normalized.split(' ');
    const hasMasculino = explorarGenderKeywords.Masculino.some((keyword) => tokens.includes(normalizeKeywordText(keyword)));
    const hasFeminino = explorarGenderKeywords.Feminino.some((keyword) => tokens.includes(normalizeKeywordText(keyword)));
    const hasAmbos = explorarGenderKeywords.Ambos.some((keyword) => tokens.includes(normalizeKeywordText(keyword)));

    if (hasAmbos || (hasMasculino && hasFeminino)) return 'Ambos';
    if (hasMasculino) return 'Masculino';
    if (hasFeminino) return 'Feminino';
    return '';
};

const avaliacaoVerificadaSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId },
    pedidoUrgenteId: { type: mongoose.Schema.Types.ObjectId },
    estrelas: { type: Number },
    comentario: { type: String },
    servico: { type: String },
    dataServico: { type: Date }
}, { timestamps: true, strict: false });

const AvaliacaoVerificada = mongoose.models.AvaliacaoVerificada || mongoose.model('AvaliacaoVerificada', avaliacaoVerificadaSchema);

const timeProjetoSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    titulo: { type: String },
    status: { type: String, default: 'aberto' },
    candidatos: [{ type: Object }],
    profissionaisNecessarios: [{ type: Object }],
    localizacao: { type: Object }
}, { timestamps: true, strict: false });

const TimeProjeto = mongoose.models.TimeProjeto || mongoose.model('TimeProjeto', timeProjetoSchema);

const timeLocalSchema = new mongoose.Schema({
    liderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nome: { type: String },
    descricao: { type: String },
    categoria: { type: String },
    cidade: { type: String },
    estado: { type: String },
    nivelMedio: { type: Number },
    projetosCompletos: { type: Number },
    membros: [{ type: Object }]
}, { timestamps: true, strict: false });

const TimeLocal = mongoose.models.TimeLocal || mongoose.model('TimeLocal', timeLocalSchema);

const pedidoUrgenteSchema = new mongoose.Schema({}, { timestamps: true, strict: false });
const PedidoUrgente = mongoose.models.PedidoUrgente || mongoose.model('PedidoUrgente', pedidoUrgenteSchema);

const agendamentoSchema = new mongoose.Schema({}, { timestamps: true, strict: false });
const Agendamento = mongoose.models.Agendamento || mongoose.model('Agendamento', agendamentoSchema);

const validacaoParSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comentario: { type: String },
    estrelas: { type: Number },
    data: { type: Date }
}, { timestamps: true, strict: false });

const avaliacaoSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    estrelas: { type: Number },
    comentario: { type: String }
}, { timestamps: true, strict: false });

const servicoSchema = new mongoose.Schema({ 
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    title: { type: String, required: true }, 
    description: { type: String },
    desafio: { type: String }, // Descrição do desafio enfrentado
    tecnologias: [{ type: String }], // Tecnologias/habilidades usadas
    images: [{ type: String }],
    thumbUrls: [{ type: String }], // Miniaturas otimizadas para o feed
    videoUrl: { type: String }, // Vídeo explicando o processo (Selo Humano)
    validacoesPares: [validacaoParSchema], // Validações de outros profissionais
    totalValidacoes: { type: Number, default: 0 },
    isDesafioHelpy: { type: Boolean, default: false }, // Se é um projeto de desafio
    tagDesafio: { type: String }, // Tag do desafio (ex: #DesafioHelpy)
    avaliacoes: [avaliacaoSchema], 
    mediaAvaliacao: { type: Number, default: 0 }
}, { timestamps: true });

const anuncioPagoSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    titulo: { type: String, required: true, trim: true },
    descricao: { type: String, trim: true },
    imagemUrl: { type: String, trim: true },
    linkUrl: { type: String, trim: true },
    endereco: { type: String, trim: true },
    numero: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true },
    plano: { type: String, enum: ['basico', 'premium'], default: 'basico' },
    ativo: { type: Boolean, default: true },
    inicioEm: { type: Date },
    fimEm: { type: Date },
    prioridade: { type: Number, default: 0 }
}, { timestamps: true });

const AnuncioPago = mongoose.models.AnuncioPago || mongoose.model('AnuncioPago', anuncioPagoSchema);

const paymentController = require('./paymentController');

const interesseUsuarioSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    termo: { type: String, index: true },
    score: { type: Number, default: 0 },
    lastSeenAt: { type: Date }
}, { timestamps: true, strict: false });

interesseUsuarioSchema.index({ userId: 1, termo: 1 }, { unique: true });

const InteresseUsuario = mongoose.models.InteresseUsuario
    || mongoose.model('InteresseUsuario', interesseUsuarioSchema);

// ...

app.get('/api/config/mp-public-key', (req, res) => {
    return res.json({ success: true, key: (process.env.MERCADOPAGO_PUBLIC_KEY || '').trim() });
});

app.post('/api/anuncios', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, imagemUrl, linkUrl, endereco, numero, cidade, estado, ativo, plano } = req.body;

        if (!titulo || String(titulo).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Título do anúncio é obrigatório.' });
        }

        if (!imagemUrl || String(imagemUrl).trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Imagem do anúncio é obrigatória.' });
        }

        const planoFinal = (String(plano || 'basico').toLowerCase() === 'premium') ? 'premium' : 'basico';
        const prioridadeFinal = planoFinal === 'premium' ? 10 : 0;
        const inicioFinal = new Date();
        const fimFinal = new Date(inicioFinal.getTime() + 30 * 24 * 60 * 60 * 1000);

        const anuncio = new AnuncioPago({
            ownerId: req.user.id,
            titulo: String(titulo).trim(),
            descricao: descricao ? String(descricao).trim() : '',
            imagemUrl: imagemUrl ? String(imagemUrl).trim() : '',
            linkUrl: linkUrl ? String(linkUrl).trim() : '',
            endereco: endereco ? String(endereco).trim() : '',
            numero: numero ? String(numero).trim() : '',
            cidade: cidade ? String(cidade).trim() : '',
            estado: estado ? String(estado).trim() : '',
            plano: planoFinal,
            ativo: typeof ativo === 'boolean' ? ativo : true,
            inicioEm: inicioFinal,
            fimEm: fimFinal,
            prioridade: prioridadeFinal
        });

        await anuncio.save();
        res.status(201).json({ success: true, anuncio });
    } catch (error) {
        console.error('Erro ao criar anúncio:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/anuncios/upload-imagem', authMiddleware, upload.single('imagem'), async (req, res) => {
    try {
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, message: 'Arquivo de imagem não enviado.' });
        }

        let buffer = file.buffer;
        let mimeType = file.mimetype || '';
        const isImage = mimeType && mimeType.startsWith('image/');

        if (!isImage) {
            return res.status(400).json({ success: false, message: 'Somente imagens são permitidas.' });
        }

        buffer = await convertImageToWebp(buffer, 1280);
        mimeType = 'image/webp';

        const originalExt = path.extname(file.originalname || '').toLowerCase();
        const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.webp`;
        const userId = req.user?.id || 'anon';

        let imagemUrl = '';

        if (s3Client && bucketName && process.env.AWS_REGION) {
            const key = `anuncios/${userId}/${filename}`;
            const uploadCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: buffer,
                ContentType: mimeType || 'image/webp'
            });
            await s3Client.send(uploadCommand);
            imagemUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        } else {
            const uploadsDir = path.join(__dirname, '../public/uploads/anuncios');
            try {
                fs.mkdirSync(uploadsDir, { recursive: true });
            } catch (e) {}
            const filePath = path.join(uploadsDir, filename);
            fs.writeFileSync(filePath, buffer);
            imagemUrl = `/uploads/anuncios/${filename}`;
        }

        res.json({ success: true, imagemUrl });
    } catch (error) {
        console.error('Erro ao fazer upload da imagem do anúncio:', error);
        res.status(500).json({ success: false, message: 'Erro ao subir imagem do anúncio.' });
    }
});

app.get('/api/anuncios', authMiddleware, async (req, res) => {
    try {
        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 30;

        // Limpeza de anúncios inativos (não pagos) com mais de 24h
        const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await AnuncioPago.deleteMany({
            ownerId: req.user.id,
            ativo: false,
            createdAt: { $lt: ontem }
        }).catch(() => {});

        const anuncios = await AnuncioPago.find({ ownerId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.json({ success: true, anuncios });
    } catch (error) {
        console.error('Erro ao buscar anúncios do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/pagamentos/mercadopago/preference', authMiddleware, paymentController.criarPreferenciaPagamento);
app.post('/api/pagamentos/mercadopago/pix', authMiddleware, paymentController.criarPagamentoPix);
app.get('/api/pagamentos/mercadopago/pix/status', authMiddleware, paymentController.consultarPagamentoPix);
app.post('/api/pagamentos/mercadopago/pix/confirm', authMiddleware, paymentController.confirmarPagamentoPix);
app.post('/api/pagamentos/mercadopago/processar-cartao', authMiddleware, paymentController.processarPagamentoCartao);
app.get('/api/config/mp-public-key', (req, res) => {
    return res.json({ success: true, key: process.env.MERCADOPAGO_PUBLIC_KEY || '' });
});
app.post('/webhooks/mercadopago', express.json({ type: '*/*' }), paymentController.webhookMercadoPago);

app.get('/api/anuncios-feed', authMiddleware, async (req, res) => {
    try {
        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 30;
        const agora = new Date();
        const anuncios = await AnuncioPago.find({
            ativo: true,
            inicioEm: { $lte: agora },
            fimEm: { $gte: agora }
        })
            .sort({ prioridade: -1, createdAt: -1 })
            .limit(100)
            .lean();

        const ownerIds = Array.from(new Set(anuncios.map(a => String(a.ownerId || '')).filter(Boolean)));
        const owners = ownerIds.length > 0
            ? await User.find({ _id: { $in: ownerIds } }).select('cidade estado').lean()
            : [];
        const ownerMap = new Map(owners.map(owner => [String(owner._id), owner]));

        const expanded = [];
        for (const anuncio of anuncios) {
            const slots = anuncio?.plano === 'premium' ? 2 : 1;
            const owner = anuncio?.ownerId ? ownerMap.get(String(anuncio.ownerId)) : null;
            const cidadeFinal = anuncio?.cidade || owner?.cidade || '';
            const estadoFinal = anuncio?.estado || owner?.estado || '';
            for (let i = 0; i < slots; i += 1) {
                expanded.push({
                    _id: anuncio._id,
                    _feedKey: `${String(anuncio._id)}:${i}`,
                    titulo: anuncio.titulo,
                    descricao: anuncio.descricao,
                    imagemUrl: anuncio.imagemUrl,
                    linkUrl: anuncio.linkUrl,
                    endereco: anuncio.endereco || '',
                    numero: anuncio.numero || '',
                    cidade: cidadeFinal,
                    estado: estadoFinal,
                    ownerId: anuncio.ownerId,
                    plano: anuncio.plano
                });
            }
        }

        res.json({ success: true, anuncios: expanded.slice(0, limit) });
    } catch (error) {
        console.error('Erro ao buscar anúncios do feed:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/explorar-posts', authMiddleware, upload.single('media'), async (req, res) => {
    try {
        const userId = req.user.id;
        const content = String(req.body?.content || '').trim();
        const categoriaManual = String(req.body?.category_tag || '').trim();
        const generoManual = String(req.body?.gender_tag || '').trim();
        const file = req.file;

        if (!content && !file) {
            return res.status(400).json({ success: false, message: 'Adicione texto ou mídia.' });
        }

        let mediaUrl = '';
        let mediaType = '';
        if (file) {
            mediaType = file.mimetype || '';
            let buffer = file.buffer;
            const isImage = mediaType && mediaType.startsWith('image/');
            if (isImage && buffer) {
                buffer = await convertImageToWebp(buffer, 1080);
                mediaType = 'image/webp';
            }
            const originalExt = path.extname(file.originalname || '').toLowerCase();
            let ext = originalExt || (mediaType.includes('video') ? '.mp4' : (isImage ? '.webp' : '.bin'));
            if (isImage) {
                ext = '.webp';
            }
            const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;

            if (s3Client && bucketName && process.env.AWS_REGION) {
                const key = `explorar/${userId}/${filename}`;
                const uploadCommand = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: buffer,
                    ContentType: mediaType || 'application/octet-stream'
                });
                await s3Client.send(uploadCommand);
                mediaUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            } else {
                const uploadsDir = path.join(__dirname, '../public/uploads/explorar');
                try {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                } catch (e) {}

                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buffer);
                mediaUrl = `/uploads/explorar/${filename}`;
            }
        }

        const category_tag = categoriaManual || detectExplorarCategoryTag(content);
        const gender_tag = generoManual || detectExplorarGenderTag(content);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const newPost = new Postagem({
            userId,
            content,
            mediaUrl,
            mediaType,
            category_tag,
            gender_tag,
            expiresAt,
            likes: [],
            comments: []
        });

        const savedPost = await newPost.save();
        res.status(201).json({ success: true, post: savedPost });
    } catch (error) {
        console.error('Erro ao criar postagem do explorar:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/explorar-feed', authMiddleware, async (req, res) => {
    try {
        const agoraCleanup = new Date();
        await Postagem.deleteMany({
            expiresAt: { $lte: agoraCleanup }
        }).catch(() => {});

        const cidadesRaw = String(req.query.cidades || '')
            .split(',')
            .map((c) => String(c).trim())
            .filter(Boolean);
        const cidadesSet = new Set(cidadesRaw.map((c) => normalizeCityKey(c)).filter(Boolean));

        const categoriaFiltro = String(req.query.categoria || '').trim();
        const generoFiltro = String(req.query.genero || '').trim();
        const agoraStories = new Date();

        const baseQuery = {
            mediaUrl: { $exists: true, $ne: '' },
            expiresAt: { $gt: agoraStories }
        };
        if (categoriaFiltro && categoriaFiltro !== 'Todas') {
            baseQuery.category_tag = categoriaFiltro;
        }
        if (generoFiltro && generoFiltro !== 'Todos') {
            baseQuery.gender_tag = generoFiltro;
        }

        const posts = await Postagem.find(baseQuery)
            .sort({ createdAt: -1 })
            .limit(60)
            .populate('userId', 'nome foto avatarUrl tipo cidade estado telefone')
            .lean();

        const postsFiltrados = cidadesSet.size > 0
            ? posts.filter((post) => {
                const cidade = post?.userId?.cidade || '';
                return cidadesSet.has(normalizeCityKey(cidade));
            })
            : posts;

        const currentUserId = String(req.user.id || '');

        const postItems = postsFiltrados.map((post) => {
            const telefone = post?.userId?.telefone ? String(post.userId.telefone) : '';
            const whatsappUrl = telefone
                ? `https://wa.me/55${telefone.replace(/\D/g, '')}`
                : '';
            const likesArray = Array.isArray(post.likes) ? post.likes : [];
            const likesCount = likesArray.length;
            const isLikedByMe = currentUserId
                ? likesArray.some((id) => String(id) === currentUserId)
                : false;
            return {
                _id: post._id,
                userId: post?.userId?._id,
                tipo: 'post',
                mediaUrl: post.mediaUrl,
                mediaType: post.mediaType || 'video',
                titulo: post?.userId?.nome || 'Video local',
                descricao: post.content || '',
                cidade: post?.userId?.cidade || '',
                estado: post?.userId?.estado || '',
                userTipo: post?.userId?.tipo || 'usuario',
                foto: post?.userId?.foto || '',
                avatarUrl: post?.userId?.avatarUrl || '',
                perfilUrl: post?.userId?._id ? `/perfil.html?id=${post.userId._id}` : '',
                whatsappUrl,
                likesCount,
                isLikedByMe
            };
        });

        const agora = new Date();
        const anuncios = await AnuncioPago.find({
            ativo: true,
            inicioEm: { $lte: agora },
            fimEm: { $gte: agora }
        })
            .sort({ prioridade: -1, createdAt: -1 })
            .limit(50)
            .lean();

        const ownerIds = Array.from(new Set(anuncios.map((a) => String(a.ownerId || '')).filter(Boolean)));
        const owners = ownerIds.length > 0
            ? await User.find({ _id: { $in: ownerIds } }).select('cidade estado').lean()
            : [];
        const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));

        let anunciosExpanded = [];
        anuncios.forEach((anuncio) => {
            const slots = anuncio?.plano === 'premium' ? 2 : 1;
            const owner = anuncio?.ownerId ? ownerMap.get(String(anuncio.ownerId)) : null;
            const cidadeFinal = anuncio?.cidade || owner?.cidade || '';
            const estadoFinal = anuncio?.estado || owner?.estado || '';
            for (let i = 0; i < slots; i += 1) {
                anunciosExpanded.push({
                    _id: anuncio._id,
                    _feedKey: `${String(anuncio._id)}:${i}`,
                    tipo: 'anuncio',
                    titulo: anuncio.titulo,
                    descricao: anuncio.descricao,
                    imagemUrl: anuncio.imagemUrl,
                    linkUrl: anuncio.linkUrl,
                    cidade: cidadeFinal,
                    estado: estadoFinal,
                    ownerId: anuncio.ownerId,
                    perfilUrl: anuncio?.ownerId ? `/perfil.html?id=${anuncio.ownerId}` : ''
                });
            }
        });

        if (cidadesSet.size > 0) {
            anunciosExpanded = anunciosExpanded.filter((anuncio) => cidadesSet.has(normalizeCityKey(anuncio.cidade)));
        }

        const items = [];
        let adIndex = 0;
        postItems.forEach((post, index) => {
            items.push(post);
            if ((index + 1) % 3 === 0 && anunciosExpanded.length > 0) {
                items.push(anunciosExpanded[adIndex % anunciosExpanded.length]);
                adIndex += 1;
            }
        });

        if (items.length === 0 && anunciosExpanded.length > 0) {
            items.push(...anunciosExpanded.slice(0, 6));
        }

        res.json({ success: true, items });
    } catch (error) {
        console.error('Erro ao buscar explorar feed:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/usuario/me', authMiddleware, async (req, res) => {
    try {
        const usuario = await User.findById(req.user.id).select('-senha').lean();
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário atual:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/user/me', authMiddleware, async (req, res) => {
    try {
        const usuario = await User.findById(req.user.id).select('-senha').lean();
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário atual:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.put('/api/user/theme', authMiddleware, async (req, res) => {
    try {
        const tema = String(req.body?.tema || '').toLowerCase();
        if (!tema || !['dark', 'light'].includes(tema)) {
            return res.status(400).json({ success: false, message: 'Tema inválido.' });
        }

        const usuario = await User.findByIdAndUpdate(
            req.user.id,
            { tema, userTheme: tema },
            { new: true, select: '-senha' }
        ).lean();

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        res.json({ success: true, tema: usuario.tema || usuario.userTheme });
    } catch (error) {
        console.error('Erro ao atualizar tema:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/usuario/:id', authMiddleware, async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id).select('-senha').lean();
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/buscar-usuarios', authMiddleware, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const categoriaFiltro = String(req.query.categoria || '').trim();
        const generoFiltro = String(req.query.genero || '').trim();
        const agoraStories = new Date();

        const baseQuery = {
            mediaUrl: { $exists: true, $ne: '' },
            expiresAt: { $gt: agoraStories }
        };
        if (categoriaFiltro && categoriaFiltro !== 'Todas') {
            baseQuery.category_tag = categoriaFiltro;
        }
        if (generoFiltro && generoFiltro !== 'Todos') {
            baseQuery.gender_tag = generoFiltro;
        }

        const normalizeText = (text) => String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
        const escapeRegex = (text) => String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const qNorm = normalizeText(q);
        const accentMap = {
            a: 'aàáâãä',
            e: 'eèéêë',
            i: 'iìíîï',
            o: 'oòóôõö',
            u: 'uùúûü',
            c: 'cç',
            n: 'nñ'
        };
        const pattern = qNorm
            .split('')
            .map((char) => {
                const chars = accentMap[char];
                return chars ? `[${escapeRegex(chars)}]` : escapeRegex(char);
            })
            .join('');
        const regex = new RegExp(pattern, 'i');

        const usuariosRaw = await User.find({
            $or: [
                { nome: regex },
                { cidade: regex },
                { estado: regex },
                { atuacao: regex },
                { email: regex }
            ]
        })
            .select('nome avatarUrl foto cidade estado atuacao')
            .limit(60)
            .lean();

        const usuarios = usuariosRaw
            .map((user) => {
                const nomeNorm = normalizeText(user?.nome);
                const cidadeNorm = normalizeText(user?.cidade);
                const estadoNorm = normalizeText(user?.estado);
                const atuacaoNorm = normalizeText(user?.atuacao);
                const emailNorm = normalizeText(user?.email);
                const fields = [nomeNorm, cidadeNorm, estadoNorm, atuacaoNorm, emailNorm];
                const matches = fields.some((field) => field.includes(qNorm));
                if (!matches) return null;
                const exact = nomeNorm === qNorm ? 3 : 0;
                const starts = nomeNorm.startsWith(qNorm) ? 2 : 0;
                const score = exact + starts + 1;
                return { ...user, _score: score };
            })
            .filter(Boolean)
            .sort((a, b) => b._score - a._score)
            .slice(0, 20)
            .map(({ _score, ...user }) => user);

        return res.json({ success: true, usuarios, servicos: [], posts: [] });
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.put('/api/editar-perfil/:id', authMiddleware, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'fotoPerfil', maxCount: 1 },
    { name: 'foto', maxCount: 1 }
]), async (req, res) => {
    try {
        const targetId = String(req.params.id || '').trim();
        const userId = String(req.user?.id || '').trim();

        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
            return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
        }

        if (!userId || targetId !== userId) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para editar este perfil.' });
        }

        const updates = {};
        if (typeof req.body?.nome !== 'undefined') updates.nome = String(req.body.nome || '').trim();
        if (typeof req.body?.idade !== 'undefined') {
            const idadeNum = Number(req.body.idade);
            if (Number.isFinite(idadeNum)) updates.idade = idadeNum;
        }
        if (typeof req.body?.telefone !== 'undefined') updates.telefone = String(req.body.telefone || '').trim();
        if (typeof req.body?.descricao !== 'undefined') updates.descricao = String(req.body.descricao || '').trim();
        if (typeof req.body?.atuacao !== 'undefined') updates.atuacao = String(req.body.atuacao || '').trim();
        if (typeof req.body?.cidade !== 'undefined') updates.cidade = String(req.body.cidade || '').trim();
        if (typeof req.body?.estado !== 'undefined') updates.estado = String(req.body.estado || '').trim();

        const file =
            (req.files && req.files.avatar && req.files.avatar[0]) ||
            (req.files && req.files.fotoPerfil && req.files.fotoPerfil[0]) ||
            (req.files && req.files.foto && req.files.foto[0]) ||
            null;

        if (file && file.buffer) {
            const sharp = getSharp();
            let imageBuffer = file.buffer;

            try {
                if (sharp) {
                    imageBuffer = await sharp(file.buffer)
                        .resize(512, 512, { fit: 'cover' })
                        .toFormat('jpeg')
                        .toBuffer();
                }
            } catch (e) {
                imageBuffer = file.buffer;
            }

            const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.jpg`;

            if (s3Client && bucketName && process.env.AWS_REGION) {
                const key = `avatars/${userId}/${filename}`;
                const uploadCommand = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: imageBuffer,
                    ContentType: 'image/jpeg'
                });
                await s3Client.send(uploadCommand);
                const fullUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                updates.avatarUrl = fullUrl;
                updates.foto = fullUrl;
            } else {
                const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
                try {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                } catch (e) {}

                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, imageBuffer);

                const publicUrl = `/uploads/avatars/${filename}`;
                updates.avatarUrl = publicUrl;
                updates.foto = publicUrl;
            }
        }

        const userUpdated = await User.findByIdAndUpdate(
            targetId,
            { $set: updates },
            { new: true, runValidators: false }
        ).select('-senha').lean();

        if (!userUpdated) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        return res.json({ success: true, user: userUpdated });
    } catch (error) {
        console.error('Erro ao editar perfil:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/cidades', authMiddleware, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q || q.length < 1) {
            return res.json({ success: true, cidades: [] });
        }

        const normalizeString = (str) => {
            return String(str || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        };

        const qNorm = normalizeString(q);
        const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const baseQuery = { cidade: { $exists: true, $ne: '' } };
        const mongoQuery = (q.length === 1)
            ? { ...baseQuery, cidade: { $regex: new RegExp(`^${escapeRegex(q)}`, 'i') } }
            : baseQuery;

        const usuarios = await User.find(mongoQuery)
            .select('cidade')
            .lean();

        const seen = new Map();
        for (const u of usuarios) {
            const cidade = (u && u.cidade) ? String(u.cidade).trim() : '';
            if (!cidade) continue;
            const key = normalizeString(cidade);
            if (!key) continue;

            const match = (qNorm.length === 1)
                ? key.startsWith(qNorm)
                : (key.startsWith(qNorm) || key.includes(qNorm));

            if (match) {
                if (!seen.has(key)) seen.set(key, cidade);
            }
        }

        const cidades = Array.from(seen.values())
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
            .slice(0, 20);

        res.json({ success: true, cidades });
    } catch (error) {
        console.error('Erro ao buscar cidades:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Criar Post
app.post('/api/posts', authMiddleware, upload.array('media', 10), async (req, res) => {
    try {
        const userId = req.user.id;
        const content = String(req.body.content || '').trim();
        const files = req.files || [];

        // Se veio um único arquivo via upload.single (fallback) ou manualmente em req.file
        if (!files.length && req.file) {
            files.push(req.file);
        }

        if (!content && files.length === 0) {
            return res.status(400).json({ success: false, message: 'Conteúdo vazio.' });
        }

        const mediaList = [];

        for (const file of files) {
            let mediaUrl = '';
            let mediaType = file.mimetype || '';
            let buffer = file.buffer;
            const isImage = mediaType && mediaType.startsWith('image/');
            if (isImage && buffer) {
                buffer = await convertImageToWebp(buffer, 1280);
                mediaType = 'image/webp';
            }
            const originalExt = path.extname(file.originalname || '').toLowerCase();
            let ext = originalExt || (mediaType.includes('video') ? '.mp4' : (isImage ? '.webp' : '.bin'));
            if (isImage) {
                ext = '.webp';
            }
            const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;

            if (s3Client && bucketName && process.env.AWS_REGION) {
                const key = `posts/${userId}/${filename}`;
                const uploadCommand = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: buffer,
                    ContentType: mediaType || 'application/octet-stream'
                });
                await s3Client.send(uploadCommand);
                mediaUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            } else {
                const uploadsDir = path.join(__dirname, '../public/uploads/posts');
                try {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                } catch (e) {}

                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, buffer);
                mediaUrl = `/uploads/posts/${filename}`;
            }
            
            mediaList.push({
                url: mediaUrl,
                type: mediaType
            });
        }

        // Mantém compatibilidade com campos antigos (usa o primeiro item)
        const primaryMedia = mediaList.length > 0 ? mediaList[0] : null;

        const newPost = new Postagem({
            userId,
            content,
            mediaUrl: primaryMedia ? primaryMedia.url : '',
            mediaType: primaryMedia ? primaryMedia.type : '',
            media: mediaList,
            likes: [],
            comments: []
        });

        await newPost.save();
        await newPost.populate('userId', 'nome foto avatarUrl tipo');

        res.status(201).json({ success: true, post: newPost });
    } catch (error) {
        console.error('Erro ao criar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const posts = await Postagem.find({
            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado')
            .exec();

        const normalizeUserId = (value) => {
            if (!value) return '';
            if (typeof value === 'object' && value._id) return String(value._id);
            return String(value);
        };

        const userIds = new Set();
        posts.forEach((post) => {
            (post.comments || []).forEach((comment) => {
                const commentUserId = normalizeUserId(comment?.userId);
                if (commentUserId) userIds.add(commentUserId);
                (comment?.replies || []).forEach((reply) => {
                    const replyUserId = normalizeUserId(reply?.userId);
                    if (replyUserId) userIds.add(replyUserId);
                });
            });
        });

        const users = userIds.size
            ? await User.find({ _id: { $in: Array.from(userIds) } })
                .select('nome foto avatarUrl')
                .lean()
            : [];
        const userMap = new Map(users.map((user) => [String(user._id), user]));

        posts.forEach((post) => {
            let changed = false;
            const comments = Array.isArray(post.comments) ? post.comments : [];
            const hydratedComments = [];
            comments.forEach((comment) => {
                if (!comment._id) {
                    comment._id = new mongoose.Types.ObjectId();
                    changed = true;
                }
                const user = userMap.get(normalizeUserId(comment.userId));
                if (!user) return;
                comment.userId = user;
                const replies = Array.isArray(comment.replies) ? comment.replies : [];
                comment.replies = replies.filter((reply) => {
                    if (!reply._id) {
                        reply._id = new mongoose.Types.ObjectId();
                        changed = true;
                    }
                    const replyUser = userMap.get(normalizeUserId(reply.userId));
                    if (!replyUser) return false;
                    reply.userId = replyUser;
                    return true;
                });
                hydratedComments.push(comment);
            });
            post.comments = hydratedComments;
            if (changed) {
                try {
                    post.markModified('comments');
                    post.save().catch(() => {});
                } catch {}
            }
        });

        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/user-posts/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Postagem.find({
            userId: userId,

            $or: [
                { expiresAt: { $exists: false } },
                { expiresAt: null }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado')
            .exec();

        const normalizeUserId = (value) => {
            if (!value) return '';
            if (typeof value === 'object' && value._id) return String(value._id);
            return String(value);
        };

        const userIds = new Set();
        posts.forEach((post) => {
            (post.comments || []).forEach((comment) => {
                const commentUserId = normalizeUserId(comment?.userId);
                if (commentUserId) userIds.add(commentUserId);
                (comment?.replies || []).forEach((reply) => {
                    const replyUserId = normalizeUserId(reply?.userId);
                    if (replyUserId) userIds.add(replyUserId);
                });
            });
        });

        const users = userIds.size
            ? await User.find({ _id: { $in: Array.from(userIds) } })
                .select('nome foto avatarUrl')
                .lean()
            : [];
        const userMap = new Map(users.map((user) => [String(user._id), user]));

        posts.forEach((post) => {
            let changed = false;
            const comments = Array.isArray(post.comments) ? post.comments : [];
            const hydratedComments = [];
            comments.forEach((comment) => {
                if (!comment._id) {
                    comment._id = new mongoose.Types.ObjectId();
                    changed = true;
                }
                const user = userMap.get(normalizeUserId(comment.userId));
                if (!user) return;
                comment.userId = user;
                const replies = Array.isArray(comment.replies) ? comment.replies : [];
                comment.replies = replies.filter((reply) => {
                    if (!reply._id) {
                        reply._id = new mongoose.Types.ObjectId();
                        changed = true;
                    }
                    const replyUser = userMap.get(normalizeUserId(reply.userId));
                    if (!replyUser) return false;
                    reply.userId = replyUser;
                    return true;
                });
                hydratedComments.push(comment);
            });
            post.comments = hydratedComments;
            if (changed) {
                try {
                    post.markModified('comments');
                    post.save().catch(() => {});
                } catch {}
            }
        });

        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.delete('/api/posts/:postId', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado.' });
        }
        if (String(post.userId) !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para apagar este post.' });
        }
        await Postagem.deleteOne({ _id: postId });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao apagar postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/interesses/registrar', authMiddleware, async (req, res) => {
    try {
        const texto = String(req.body?.texto || '').trim();
        if (!texto) {
            return res.status(400).json({ success: false, message: 'Texto inválido.' });
        }
        const keywords = extractInterestKeywords(texto);
        if (!keywords.length) {
            return res.json({ success: true, saved: 0 });
        }
        const bulkOps = keywords.map((termo) => ({
            updateOne: {
                filter: { userId: req.user.id, termo },
                update: { $set: { lastSeenAt: new Date() }, $inc: { score: 1 } },
                upsert: true
            }
        }));
        await InteresseUsuario.bulkWrite(bulkOps, { ordered: false });
        res.json({ success: true, saved: keywords.length });
    } catch (error) {
        console.error('Erro ao registrar interesses:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Curtir/Descurtir Post
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
    try {
        const post = await Postagem.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post não encontrado' });
        }

        const userId = req.user.id;
        const userIdNormalized = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;
        
        // Garante que likes é um array
        if (!post.likes) {
            post.likes = [];
        }

        const index = post.likes.findIndex((id) => String(id) === String(userId));
        
        if (index === -1) {
            post.likes.push(userIdNormalized);
            
            if (String(post.userId) !== String(userId)) {
                try {
                    const usuarioQueCurtiu = await User.findById(userId).select('nome');
                    const nomeUsuario = usuarioQueCurtiu?.nome || 'Alguém';

                    const agora = new Date();
                    const isExplorar = !!post.expiresAt;
                    let tituloNotificacao;
                    let mensagemNotificacao;
                    if (isExplorar) {
                        tituloNotificacao = 'Você teve uma curtida no seu vídeo ou imagem do Explorar';
                        mensagemNotificacao = `${nomeUsuario} curtiu seu vídeo/imagem do Explorar`;
                    } else {
                        tituloNotificacao = 'Você teve uma curtida no seu post do feed';
                        mensagemNotificacao = `${nomeUsuario} curtiu seu post do feed`;
                    }

                    let mediaUrl = '';
                    let mediaType = '';
                    if (Array.isArray(post.media) && post.media.length > 0) {
                        mediaUrl = post.media[0]?.url || '';
                        mediaType = post.media[0]?.type || '';
                    } else {
                        mediaUrl = post.mediaUrl || '';
                        mediaType = post.mediaType || '';
                    }
                    const isVideoMidia = String(mediaType || '').includes('video');
                    
                    await criarNotificacao(
                        post.userId,
                        'post_curtido',
                        isExplorar
                            ? (isVideoMidia ? 'Você teve uma curtida no seu vídeo do Explorar' : 'Você teve uma curtida na sua imagem do Explorar')
                            : 'Você teve uma curtida no seu post do feed',
                        isExplorar
                            ? (isVideoMidia ? `${nomeUsuario} curtiu seu vídeo do Explorar` : `${nomeUsuario} curtiu sua imagem do Explorar`)
                            : `${nomeUsuario} curtiu seu post do feed`,
                        {
                            postId: post._id,
                            usuarioId: userId,
                            mediaUrl,
                            mediaType,
                            isExplorar,
                            createdAtPost: post.createdAt || agora
                        },
                        null
                    );
                } catch (notifError) {
                    console.error('Erro ao criar notificação de like:', notifError);
                }
            }
        } else {
            post.likes.splice(index, 1);
        }

        post.markModified('likes');
        const saved = await post.save();
        res.json({ success: true, likes: saved.likes || [] });
    } catch (error) {
        console.error('Erro ao curtir post:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

// Obter dados mínimos de um post (suporta checagem de expiração e tipo de mídia)
app.get('/api/posts/:id', authMiddleware, async (req, res) => {
    try {
        const post = await Postagem.findById(req.params.id)
            .select('_id userId content mediaUrl mediaType expiresAt createdAt')
            .lean();
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }
        res.json({ success: true, post });
    } catch (error) {
        console.error('Erro ao obter post:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
app.get('/api/posts/:id/likes', authMiddleware, async (req, res) => {
    try {
        const post = await Postagem.findById(req.params.id).exec();
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const userId = String(req.user.id || '');
        const ownerId = String(post.userId || '');
        const likesArray = Array.isArray(post.likes) ? post.likes : [];
        const likesCount = likesArray.length;
        const isLikedByMe = userId
            ? likesArray.some((id) => String(id) === userId)
            : false;

        const usuarios = likesArray.length
            ? await User.find(
                { _id: { $in: likesArray } },
                'nome foto avatarUrl whatsapp telefone celular phone'
            ).lean()
            : [];

        const userMap = new Map(usuarios.map((u) => [String(u._id), u]));

        const likesFull = likesArray
            .map((id) => {
                const user = userMap.get(String(id));
                if (!user) return null;
                const numeroRaw = user.whatsapp
                    || user.telefone
                    || user.celular
                    || user.phone
                    || '';
                return {
                    id: user._id,
                    nome: user.nome,
                    foto: user.foto || user.avatarUrl || '',
                    whatsapp: numeroRaw
                };
            })
            .filter(Boolean);

        const likesPreview = likesFull.slice(-3);

        if (userId !== ownerId) {
            return res.json({
                success: true,
                likesCount,
                isLikedByMe,
                likesPreview,
                likes: []
            });
        }

        res.json({
            success: true,
            likesCount,
            isLikedByMe,
            likesPreview,
            likes: likesFull
        });
    } catch (error) {
        console.error('Erro ao listar curtidas do post:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Criar um Comentário
app.post('/api/posts/:postId/comments', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Comentário vazio.' });
        }

        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado' });

        const newComment = {
            _id: new mongoose.Types.ObjectId(),
            userId: userIdObjectId,
            content: content.trim(),
            likes: [],
            replies: [],
            createdAt: new Date()
        };

        post.comments.push(newComment);
        post.markModified('comments');
        await post.save();

        const addedComment = post.comments[post.comments.length - 1];
        await User.populate(addedComment, { path: 'userId', select: 'nome foto avatarUrl' });

        res.status(201).json({ success: true, comment: addedComment });
    } catch (error) {
        console.error('Erro ao criar comentário:', error?.stack || error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Criar uma Resposta (Reply) para um Comentário
app.post('/api/posts/:postId/comments/:commentId/reply', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Resposta vazia.' });
        }

        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId)
            ? new mongoose.Types.ObjectId(userId)
            : userId;

        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const comment = post.comments?.id
            ? post.comments.id(commentId)
            : commentsList.find((item) => String(item?._id) === String(commentId));

        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        if (!Array.isArray(comment.replies)) {
            comment.replies = [];
        }

        const newReply = {
            _id: new mongoose.Types.ObjectId(),
            userId: userIdObjectId,
            content: content.trim(),
            likes: [],
            createdAt: new Date()
        };

        comment.replies.push(newReply);
        post.markModified('comments');
        await post.save();

        const addedReply = comment.replies[comment.replies.length - 1];
        await User.populate(addedReply, { path: 'userId', select: 'nome foto avatarUrl avatarUrlPerfil' });

        res.status(201).json({ success: true, reply: addedReply });
    } catch (error) {
        console.error('Erro ao criar resposta:', error?.stack || error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Editar Comentário
app.put('/api/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Conteúdo vazio.' });
        }

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const comment = post.comments?.id
            ? post.comments.id(commentId)
            : commentsList.find((item) => String(item?._id) === String(commentId));

        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        // Verifica permissão (apenas dono do comentário pode editar)
        const commentUserId = comment.userId?._id ? String(comment.userId._id) : String(comment.userId);
        if (commentUserId !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para editar este comentário.' });
        }

        comment.content = content.trim();
        post.markModified('comments');
        await post.save();

        res.json({ success: true, comment });
    } catch (error) {
        console.error('Erro ao editar comentário:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Excluir Comentário
app.delete('/api/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const commentIndex = commentsList.findIndex((item) => String(item?._id) === String(commentId));

        if (commentIndex === -1) return res.status(404).json({ message: 'Comentário não encontrado' });

        const comment = commentsList[commentIndex];
        const commentUserId = comment.userId?._id ? String(comment.userId._id) : String(comment.userId);
        const postUserId = String(post.userId);

        // Permite excluir se for dono do comentário OU dono do post
        if (commentUserId !== String(userId) && postUserId !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para excluir este comentário.' });
        }

        if (post.comments?.id) {
            post.comments.id(commentId).deleteOne();
        } else {
            post.comments.splice(commentIndex, 1);
        }

        post.markModified('comments');
        await post.save();

        res.json({ success: true, message: 'Comentário excluído.' });
    } catch (error) {
        console.error('Erro ao excluir comentário:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Editar Resposta
app.put('/api/posts/:postId/comments/:commentId/replies/:replyId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Conteúdo vazio.' });
        }

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const comment = post.comments?.id
            ? post.comments.id(commentId)
            : commentsList.find((item) => String(item?._id) === String(commentId));

        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const repliesList = Array.isArray(comment.replies) ? comment.replies : [];
        const reply = comment.replies?.id
            ? comment.replies.id(replyId)
            : repliesList.find((item) => String(item?._id) === String(replyId));

        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        // Verifica permissão
        const replyUserId = reply.userId?._id ? String(reply.userId._id) : String(reply.userId);
        if (replyUserId !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para editar esta resposta.' });
        }

        reply.content = content.trim();
        post.markModified('comments');
        await post.save();

        res.json({ success: true, reply });
    } catch (error) {
        console.error('Erro ao editar resposta:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Excluir Resposta
app.delete('/api/posts/:postId/comments/:commentId/replies/:replyId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const comment = post.comments?.id
            ? post.comments.id(commentId)
            : commentsList.find((item) => String(item?._id) === String(commentId));

        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const repliesList = Array.isArray(comment.replies) ? comment.replies : [];
        const replyIndex = repliesList.findIndex((item) => String(item?._id) === String(replyId));

        if (replyIndex === -1) return res.status(404).json({ message: 'Resposta não encontrada' });

        const reply = repliesList[replyIndex];
        const replyUserId = reply.userId?._id ? String(reply.userId._id) : String(reply.userId);
        const commentUserId = comment.userId?._id ? String(comment.userId._id) : String(comment.userId);
        const postUserId = String(post.userId);

        // Permite excluir se for dono da resposta, dono do comentário ou dono do post
        if (replyUserId !== String(userId) && commentUserId !== String(userId) && postUserId !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para excluir esta resposta.' });
        }

        if (comment.replies?.id) {
            comment.replies.id(replyId).deleteOne();
        } else {
            comment.replies.splice(replyIndex, 1);
        }

        post.markModified('comments');
        await post.save();

        res.json({ success: true, message: 'Resposta excluída.' });
    } catch (error) {
        console.error('Erro ao excluir resposta:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/posts/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        console.log('➡️ Curtir comentário:', { postId, commentId, userId });

        if (!postId || !commentId) {
            return res.status(400).json({ success: false, message: 'IDs inválidos.' });
        }

        const post = await Postagem.findById(postId);
        console.log('✅ Post encontrado:', Boolean(post));
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        let comment;
        try {
            comment = post.comments?.id ? post.comments.id(commentId) : null;
        } catch (lookupError) {
            console.error('Erro ao buscar comentário por id():', lookupError?.stack || lookupError);
            comment = null;
        }
        if (!comment) {
            comment = commentsList.find((item) => String(item?._id) === String(commentId));
        }
        console.log('✅ Comentário encontrado:', Boolean(comment));

        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        if (!Array.isArray(comment.likes)) {
            comment.likes = [];
        }
        comment.likes = comment.likes.map((likeId) => String(likeId));
        const likeIndex = comment.likes.indexOf(String(userId));

        console.log('✅ Índice de like:', likeIndex);

        if (likeIndex > -1) {
            comment.likes.splice(likeIndex, 1); // Descurtir
        } else {
            comment.likes.push(String(userId)); // Curtir

            // Cria notificação para o dono do comentário (se não for ele mesmo)
            const comentarioUserId = comment.userId?._id ? String(comment.userId._id) : String(comment.userId);
            if (comentarioUserId !== String(userId)) {
                try {
                    const usuarioQueCurtiu = await User.findById(userId).select('nome');
                    const nomeUsuario = usuarioQueCurtiu?.nome || 'Alguém';

                    await criarNotificacao(
                        comentarioUserId,
                        'comentario_curtido',
                        'Seu comentário recebeu uma curtida',
                        `${nomeUsuario} curtiu seu comentário`,
                        {
                            postId: postId,
                            commentId: commentId,
                            mediaUrl: (Array.isArray(post.media) && post.media.length > 0) ? (post.media[0]?.url || '') : (post.mediaUrl || ''),
                            mediaType: (Array.isArray(post.media) && post.media.length > 0) ? (post.media[0]?.type || '') : (post.mediaType || '')
                        },
                        null
                    );
                } catch (notifError) {
                    console.error('Erro ao criar notificação de comentário curtido:', notifError);
                }
            }
        }

        post.markModified('comments');
        await post.save();
        res.json({ success: true, likes: comment.likes });
    } catch (error) {
        console.error('Erro ao curtir comentário:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Curtir/Descurtir uma Resposta (Reply)
app.post('/api/posts/:postId/comments/:commentId/replies/:replyId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;
        const userIdStr = String(userId);

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });
        const commentsList = Array.isArray(post.comments) ? post.comments : [];
        const comment = post.comments?.id
            ? post.comments.id(commentId)
            : commentsList.find((item) => String(item?._id) === String(commentId));
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const repliesList = Array.isArray(comment.replies) ? comment.replies : [];
        const reply = comment.replies?.id
            ? comment.replies.id(replyId)
            : repliesList.find((item) => String(item?._id) === String(replyId));
        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        if (!Array.isArray(reply.likes)) {
            reply.likes = [];
        }
        reply.likes = reply.likes.map((likeId) => String(likeId));

        const likeIndex = reply.likes.indexOf(userIdStr);
        if (likeIndex > -1) {
            reply.likes.splice(likeIndex, 1);
        } else {
            reply.likes.push(userIdStr);

            // Cria notificação para o dono da resposta (se não for ele mesmo)
            // Garante que pegamos o ID corretamente, seja objeto ou string/ObjectId
            const rawUserId = reply.userId;
            const respostaUserId = rawUserId && typeof rawUserId === 'object' && rawUserId._id 
                ? String(rawUserId._id) 
                : String(rawUserId);
            
            console.log('🔔 Tentando criar notificação de resposta:', {
                replyId,
                rawUserId,
                respostaUserId,
                currentUserId: userIdStr,
                isDifferent: respostaUserId !== userIdStr
            });

            if (respostaUserId && respostaUserId !== 'undefined' && respostaUserId !== userIdStr) {
                try {
                    const usuarioQueCurtiu = await User.findById(userId).select('nome');
                    const nomeUsuario = usuarioQueCurtiu?.nome || 'Alguém';

                    const notifCriada = await criarNotificacao(
                        respostaUserId,
                        'resposta_curtida',
                        'Sua resposta recebeu uma curtida',
                        `${nomeUsuario} curtiu sua resposta`,
                        {
                            postId: postId,
                            commentId: commentId,
                            replyId: replyId,
                            mediaUrl: (Array.isArray(post.media) && post.media.length > 0) ? (post.media[0]?.url || '') : (post.mediaUrl || ''),
                            mediaType: (Array.isArray(post.media) && post.media.length > 0) ? (post.media[0]?.type || '') : (post.mediaType || '')
                        },
                        null
                    );
                    console.log('✅ Notificação de resposta criada:', Boolean(notifCriada));
                } catch (notifError) {
                    console.error('❌ Erro ao criar notificação de resposta curtida:', notifError);
                }
            } else {
                console.log('⚠️ Notificação não criada: ID inválido ou é o próprio usuário.');
            }
        }

        post.markModified('comments');
        await post.save();
        res.json({ success: true, likes: reply.likes });
    } catch (error) {
        console.error('Erro ao curtir resposta:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/servicos/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const servicos = await Servico.find({ userId: userId }).sort({ createdAt: -1 });
        res.json(servicos);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar serviços.' });
    }
});

// 🆕 Destaques de perfis profissionais (mini vitrine de profissionais bem avaliados)
app.get('/api/destaques-servicos', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('cidade estado');

        const limitRaw = Number(req.query.limit);
        const displayLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 30;
        const dbLimit = 100; // Busca mais para permitir rotação

        const filter = {
            tipo: 'trabalhador',
            mediaAvaliacao: { $gte: 4.5 },
            totalAvaliacoes: { $gte: 30 }
        };

        console.log('🔍 Buscando destaques com filtro:', JSON.stringify(filter, null, 2));

        let selected = [];
        const selectedIds = new Set();

        const pushUnique = (items) => {
            (items || []).forEach((it) => {
                const id = String(it._id);
                if (selectedIds.has(id)) return;
                selectedIds.add(id);
                selected.push(it);
            });
        };

        const baseSelect = 'nome cidade estado foto avatarUrl mediaAvaliacao totalAvaliacoes tipo atuacao createdAt avaliacoes';
        const baseSort = { mediaAvaliacao: -1, totalAvaliacoes: -1, createdAt: -1 };

        if (user?.cidade && user?.estado) {
            const cidadeRegex = new RegExp(`^${user.cidade}$`, 'i');
            const estadoRegex = new RegExp(`^${user.estado}$`, 'i');

            console.log(`📍 Buscando profissionais em ${user.cidade}-${user.estado}`);
            const locais = await User.find({ ...filter, cidade: cidadeRegex, estado: estadoRegex })
                .select(baseSelect)
                .sort(baseSort)
                .limit(dbLimit);
            pushUnique(locais);

            if (selected.length < displayLimit) {
                console.log(`📍 Buscando profissionais no estado ${user.estado}`);
                const estaduais = await User.find({ ...filter, estado: estadoRegex })
                    .select(baseSelect)
                    .sort(baseSort)
                    .limit(dbLimit);
                pushUnique(estaduais);
            }
        } else if (user?.estado) {
            const estadoRegex = new RegExp(`^${user.estado}$`, 'i');
            console.log(`📍 Buscando profissionais no estado ${user.estado}`);
            const estaduais = await User.find({ ...filter, estado: estadoRegex })
                .select(baseSelect)
                .sort(baseSort)
                .limit(dbLimit);
            pushUnique(estaduais);
        } else if (user?.cidade) {
            const cidadeRegex = new RegExp(`^${user.cidade}$`, 'i');
            console.log(`📍 Buscando profissionais em ${user.cidade}`);
            const locais = await User.find({ ...filter, cidade: cidadeRegex })
                .select(baseSelect)
                .sort(baseSort)
                .limit(dbLimit);
            pushUnique(locais);
        }

        if (selected.length < displayLimit) {
            console.log('🌎 Buscando profissionais gerais (fallback)');
            const gerais = await User.find({ ...filter })
                .select(baseSelect)
                .sort(baseSort)
                .limit(dbLimit);
            pushUnique(gerais);
        }

        // Lógica de rotação e ordenação:
        // 1. Agrupar por nota (ex: "5.0", "4.9")
        // 2. Embaralhar dentro do grupo
        // 3. Concatenar na ordem decrescente
        const groups = {};
        selected.forEach(p => {
            const rating = (p.mediaAvaliacao || 0).toFixed(1);
            if (!groups[rating]) groups[rating] = [];
            groups[rating].push(p);
        });

        const sortedKeys = Object.keys(groups).sort((a, b) => b - a); // 5.0 primeiro
        let shuffledList = [];

        sortedKeys.forEach(key => {
            const group = groups[key];
            // Shuffle (Fisher-Yates)
            for (let i = group.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [group[i], group[j]] = [group[j], group[i]];
            }
            shuffledList = shuffledList.concat(group);
        });

        let destaques = shuffledList.slice(0, displayLimit);

        destaques.forEach(prof => {
            console.log(`  - ${prof.nome}: ${prof.mediaAvaliacao} estrelas, ${prof.totalAvaliacoes} avaliações, ${prof.cidade}/${prof.estado}`);
        });

        const resposta = destaques.map(profissional => {
            const avaliacoes = profissional?.avaliacoes || [];
            const totalAvaliacoesReal = Array.isArray(avaliacoes) ? avaliacoes.length : (profissional.totalAvaliacoes || 0);
            const mediaAvaliacaoReal = profissional.mediaAvaliacao || 0;

            if (Array.isArray(avaliacoes) && avaliacoes.length > 0) {
                const totalEstrelas = avaliacoes.reduce((acc, av) => acc + (av.estrelas || 0), 0);
                const mediaCalculada = totalEstrelas / avaliacoes.length;
                if (Math.abs(mediaCalculada - mediaAvaliacaoReal) > 0.01 || totalAvaliacoesReal !== profissional.totalAvaliacoes) {
                    User.updateOne(
                        { _id: profissional._id },
                        { $set: { mediaAvaliacao: mediaCalculada, totalAvaliacoes: avaliacoes.length } }
                    ).catch(err => console.error('Erro ao atualizar avaliações:', err));
                }
            }

            const foto = profissional.foto || profissional.avatarUrl || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
            return {
                id: profissional._id,
                user: {
                    _id: profissional._id,
                    nome: profissional.nome,
                    cidade: profissional.cidade,
                    estado: profissional.estado,
                    foto: foto,
                    avatarUrl: foto,
                    mediaAvaliacao: mediaAvaliacaoReal,
                    totalAvaliacoes: totalAvaliacoesReal,
                    tipo: profissional.tipo,
                    atuacao: profissional.atuacao || 'Profissional'
                },
                mediaAvaliacao: mediaAvaliacaoReal,
                totalValidacoes: totalAvaliacoesReal,
                createdAt: profissional.createdAt
            };
        });

        res.json({ success: true, destaques: resposta });
    } catch (error) {
        console.error('Erro ao buscar destaques de perfis:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar destaques de perfis.' });
    }
});

app.get('/api/admin/denuncias', authMiddleware, adminOnly, async (req, res) => {
    try {
        const arquivadas = String(req.query.arquivadas || '').toLowerCase() === 'true';
        const baseFilter = { tipo: 'denuncia' };
        const filter = arquivadas
            ? { ...baseFilter, arquivada: true }
            : { ...baseFilter, $or: [{ arquivada: false }, { arquivada: { $exists: false } }] };
        const logs = await ModerationLog.find(filter)
            .populate('userId', 'nome email')
            .sort({ createdAt: -1 })
            .limit(200);
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro ao listar denúncias.' });
    }
});

app.delete('/api/admin/denuncias/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: 'ID inválido.' });
        const updated = await ModerationLog.findByIdAndUpdate(
            id,
            { $set: { arquivada: true } },
            { new: true }
        );
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Denúncia não encontrada.' });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro ao arquivar denúncia.' });
    }
});

app.delete('/api/admin/posts/:postId', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { postId } = req.params;
        if (!postId) return res.status(400).json({ success: false, message: 'ID inválido.' });
        await Postagem.findByIdAndDelete(postId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Erro ao excluir post.' });
    }
});

// 🆕 Denúncias de conteúdo (UGC)
app.post('/api/denuncias', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const alvoTipo = String(req.body?.alvoTipo || '').trim(); // 'post' | 'explorar' | 'perfil' etc.
        const alvoId = String(req.body?.alvoId || '').trim();
        const motivo = String(req.body?.motivo || '').trim() || 'Conteúdo inadequado';
        const detalhe = String(req.body?.detalhe || '').trim() || '';
        const origem = String(req.body?.origem || '').trim() || 'app';
        if (!alvoTipo || !alvoId) {
            return res.status(400).json({ success: false, message: 'alvoTipo e alvoId são obrigatórios.' });
        }
        const log = new ModerationLog({
            userId,
            tipo: 'denuncia',
            motivo,
            detalhe,
            mediaType: alvoTipo,
            texto: alvoId,
            origem
        });
        await log.save();
        return res.json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar denúncia:', error);
        return res.status(500).json({ success: false, message: 'Erro ao enviar denúncia.' });
    }
});

// 🆕 Exclusão de conta e dados
app.delete('/api/user/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        await Promise.allSettled([
            Postagem.deleteMany({ userId }),
            Notificacao.deleteMany({ userId }),
            AnuncioPago.deleteMany({ ownerId: userId }),
            ModerationLog.deleteMany({ userId }),
            (typeof Servico !== 'undefined' ? Servico.deleteMany({ userId }) : Promise.resolve())
        ]);
        await User.deleteOne({ _id: userId });
        return res.json({ success: true });
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        return res.status(500).json({ success: false, message: 'Erro ao excluir conta.' });
    }
});

// 🆕 ATUALIZADO: Criar Serviço/Projeto do Portfólio
app.post('/api/servico', authMiddleware, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, desafio, tecnologias, isDesafioHelpy, tagDesafio } = req.body;
        const files = req.files;
        const userId = req.user.id;
        
        // Verifica se o usuário existe
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        let imageUrls = [];
        let thumbUrls = [];
        if (files && files.length > 0 && s3Client) {
            const sharp = getSharp();
            if (!sharp) {
                console.warn('Sharp não disponível, pulando processamento de imagens');
            } else {
                await Promise.all(files.map(async (file) => {
                    try {
                        // Imagem principal (800x600)
                        const imageBuffer = await sharp(file.buffer).resize(800, 600, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                        const baseName = `${Date.now()}_${path.basename(file.originalname)}`;
                        const key = `servicos/${userId}/${baseName}`;
                        const uploadCommand = new PutObjectCommand({ Bucket: bucketName, Key: key, Body: imageBuffer, ContentType: 'image/jpeg' });
                        await s3Client.send(uploadCommand);
                        const fullUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                        imageUrls.push(fullUrl);

                        // Miniatura leve (400x300) para o feed de destaques
                        const thumbBuffer = await sharp(file.buffer).resize(400, 300, { fit: 'cover' }).toFormat('jpeg').toBuffer();
                        const thumbKey = `servicos/${userId}/thumbs/${baseName}`;
                        const thumbUpload = new PutObjectCommand({ Bucket: bucketName, Key: thumbKey, Body: thumbBuffer, ContentType: 'image/jpeg' });
                        await s3Client.send(thumbUpload);
                        thumbUrls.push(`https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbKey}`);
                    } catch (error) {
                        console.error('Erro ao processar imagem:', error);
                    }
                }));
            }
        }

        // Processa tecnologias (pode vir como string separada por vírgula ou array)
        let tecnologiasArray = [];
        if (tecnologias) {
            if (typeof tecnologias === 'string') {
                tecnologiasArray = tecnologias.split(',').map(t => t.trim()).filter(t => t);
            } else if (Array.isArray(tecnologias)) {
                tecnologiasArray = tecnologias;
            }
        }

        const newServico = new Servico({
            userId,
            title,
            description,
            desafio: desafio || null,
            tecnologias: tecnologiasArray,
            images: imageUrls,
            isDesafioHelpy: isDesafioHelpy === 'true' || isDesafioHelpy === true,
            tagDesafio: tagDesafio || null,
            thumbUrls,
            validacoesPares: [],
            totalValidacoes: 0,
            avaliacoes: [],
            mediaAvaliacao: 0
        });
        
        const savedServico = await newServico.save();
        await User.findByIdAndUpdate(userId, { $push: { servicosImagens: savedServico._id } });
        
        // 🆕 Adiciona XP por postar projeto no portfólio
        await adicionarXP(userId, 10, 'Projeto postado no portfólio');
        
        res.status(201).json({ success: true, message: 'Projeto adicionado ao portfólio com sucesso!', servico: savedServico });
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Validar projeto por outro profissional (Validação por Pares)
app.post('/api/servico/:servicoId/validar', authMiddleware, async (req, res) => {
    try {
        const { servicoId } = req.params;
        const { comentario } = req.body;
        const profissionalId = req.user.id;
        
        // Verifica se o usuário existe
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const servico = await Servico.findById(servicoId).populate('userId');
        if (!servico) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado.' });
        }
        
        // Verifica se não é o próprio projeto
        if (servico.userId._id.toString() === profissionalId) {
            return res.status(400).json({ success: false, message: 'Você não pode validar seu próprio projeto.' });
        }
        
        // Verifica se já validou
        const jaValidou = servico.validacoesPares.some(
            v => v.profissionalId.toString() === profissionalId
        );
        
        if (jaValidou) {
            return res.status(400).json({ success: false, message: 'Você já validou este projeto.' });
        }
        
        // Adiciona validação
        servico.validacoesPares.push({
            profissionalId,
            comentario: comentario || null,
            dataValidacao: new Date()
        });
        
        servico.totalValidacoes = servico.validacoesPares.length;
        await servico.save();
        
        // 🆕 Adiciona XP ao dono do projeto por validação por pares
        await adicionarXP(servico.userId._id, 150, 'Projeto validado por pares');
        
        res.json({ success: true, message: 'Projeto validado com sucesso!', totalValidacoes: servico.totalValidacoes });
    } catch (error) {
        console.error('Erro ao validar projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.delete('/api/user/:userId/servicos/:servicoId', authMiddleware, async (req, res) => {
    try {
        const { userId, servicoId } = req.params;
        if (req.user.id !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const servico = await Servico.findById(servicoId);
        if (!servico) {
            return res.status(404).json({ success: false, message: 'Serviço não encontrado.' });
        }

        // Deletar imagens do S3
        if (servico.images && servico.images.length > 0 && s3Client) {
            await Promise.all(servico.images.map(async (imageUrl) => {
                try {
                    const url = new URL(imageUrl);
                    const key = url.pathname.substring(1);
                    const deleteCommand = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
                    await s3Client.send(deleteCommand);
                } catch (s3Error) {
                    console.warn(`Falha ao deletar imagem ${imageUrl} do S3:`, s3Error);
                }
            }));
        }

        await Servico.findByIdAndDelete(servicoId);
        await User.findByIdAndUpdate(userId, { $pull: { servicosImagens: servicoId } });
        
        res.json({ success: true, message: 'Serviço removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao remover serviço:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/servico/:servicoId', authMiddleware, async (req, res) => {
    try {
        const { servicoId } = req.params;
        const servico = await Servico.findById(servicoId)
            .populate({
                path: 'avaliacoes.usuarioId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'validacoesPares.profissionalId',
                select: 'nome foto avatarUrl atuacao gamificacao'
            })
            .exec();
            
        if (!servico) {
            return res.status(404).json({ message: 'Serviço não encontrado.' });
        }
        res.json(servico);
    } catch (error) {
        console.error('Erro ao buscar detalhes do serviço:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rotas de Filtro de Trabalhadores
app.get('/api/trabalhadores', authMiddleware, async (req, res) => {
    try {
        // Qualquer usuário ou empresa pode ser trabalhador/profissional
        const trabalhadores = await User.find({ tipo: { $in: ['usuario', 'empresa'] } })
            .select('nome foto avatarUrl atuacao cidade estado mediaAvaliacao totalAvaliacoes localizacao disponivelAgora gamificacao')
            .sort({ mediaAvaliacao: -1, totalAvaliacoes: -1 });
        res.json(trabalhadores);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar trabalhadores.' });
    }
});

// 🆕 NOVO: Rota "Preciso agora!" - Busca profissionais próximos
app.post('/api/preciso-agora', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude, tipoServico, raioKm = 10 } = req.body;
        const userId = req.user.id;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Localização é obrigatória.' });
        }
        
        // Função para calcular distância (Haversine) - GRATUITA, sem API
        function calcularDistancia(lat1, lon1, lat2, lon2) {
            const R = 6371; // Raio da Terra em km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c; // Distância em km
        }
        
        // Busca profissionais disponíveis (qualquer usuário ou empresa)
        let query = { 
            tipo: { $in: ['usuario', 'empresa'] },
            disponivelAgora: true,
            'localizacao.latitude': { $exists: true, $ne: null },
            'localizacao.longitude': { $exists: true, $ne: null }
        };
        
        if (tipoServico) {
            query.atuacao = { $regex: tipoServico, $options: 'i' };
        }
        
        const profissionais = await User.find(query)
            .select('nome foto avatarUrl atuacao cidade estado telefone mediaAvaliacao totalAvaliacoes localizacao gamificacao')
            .exec();
        
        // Calcula distância e tempo estimado para cada profissional
        const profissionaisComDistancia = profissionais.map(prof => {
            const distancia = calcularDistancia(
                latitude, 
                longitude, 
                prof.localizacao.latitude, 
                prof.localizacao.longitude
            );
            
            // Estima tempo em minutos (assumindo velocidade média de 30 km/h em cidade)
            const tempoMinutos = Math.round((distancia / 30) * 60);
            
            return {
                ...prof.toObject(),
                distancia: Math.round(distancia * 10) / 10, // Arredonda para 1 casa decimal
                tempoEstimado: tempoMinutos
            };
        })
        .filter(prof => prof.distancia <= raioKm) // Filtra por raio
        .sort((a, b) => a.distancia - b.distancia) // Ordena por distância
        .slice(0, 20); // Limita a 20 resultados
        
        res.json({ success: true, profissionais: profissionaisComDistancia });
    } catch (error) {
        console.error('Erro ao buscar profissionais próximos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar localização do usuário
app.put('/api/user/localizacao', authMiddleware, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const userId = req.user.id;
        
        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'Coordenadas são obrigatórias.' });
        }
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                'localizacao.latitude': latitude,
                'localizacao.longitude': longitude,
                'localizacao.ultimaAtualizacao': new Date()
            },
            { new: true, select: '-senha' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ success: true, localizacao: updatedUser.localizacao });
    } catch (error) {
        console.error('Erro ao atualizar localização:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Atualizar status de disponibilidade
app.put('/api/user/disponibilidade', authMiddleware, async (req, res) => {
    try {
        const { disponivelAgora } = req.body;
        const userId = req.user.id;
        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { disponivelAgora: disponivelAgora === true },
            { new: true, select: '-senha' }
        );
        
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ success: true, disponivelAgora: updatedUser.disponivelAgora });
    } catch (error) {
        console.error('Erro ao atualizar disponibilidade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Sistema de Gamificação - Adicionar XP (ATUALIZADO com níveis de reputação)
function adicionarXP(userId, quantidadeXP, motivo) {
    return User.findById(userId).then(async user => {
        if (!user) return null;
        
        const novoXP = (user.gamificacao?.xp || 0) + quantidadeXP;
        const nivelAtual = user.gamificacao?.nivel || 1;
        
        // Calcula XP necessário para próximo nível (fórmula: nível * 100)
        const xpProximoNivel = nivelAtual * 100;
        
        let novoNivel = nivelAtual;
        let xpRestante = novoXP;
        
        // Verifica se subiu de nível
        while (xpRestante >= xpProximoNivel && novoNivel < 50) {
            xpRestante -= xpProximoNivel;
            novoNivel++;
        }
        
        // 🆕 NOVO: Determina nível de reputação
        let nivelReputacao = 'iniciante';
        let temSeloQualidade = false;
        
        if (novoNivel >= 30) {
            nivelReputacao = 'mestre';
            temSeloQualidade = true;
        } else if (novoNivel >= 10) {
            nivelReputacao = 'validado';
            temSeloQualidade = true;
        }
        
        const atualizacao = {
            'gamificacao.xp': xpRestante,
            'gamificacao.nivel': novoNivel,
            'gamificacao.xpProximoNivel': novoNivel * 100,
            'gamificacao.nivelReputacao': nivelReputacao,
            'gamificacao.temSeloQualidade': temSeloQualidade
        };
        
        return User.findByIdAndUpdate(userId, { $set: atualizacao }, { new: true });
    });
}

// 🆕 NOVO: Rota para adicionar XP (pode ser chamada internamente)
app.post('/api/user/xp', authMiddleware, async (req, res) => {
    try {
        const { quantidade, motivo } = req.body;
        const userId = req.user.id;
        
        if (!quantidade || quantidade <= 0) {
            return res.status(400).json({ success: false, message: 'Quantidade de XP inválida.' });
        }
        
        const userAtualizado = await adicionarXP(userId, quantidade, motivo);
        
        if (!userAtualizado) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        res.json({ 
            success: true, 
            nivel: userAtualizado.gamificacao.nivel,
            xp: userAtualizado.gamificacao.xp,
            xpProximoNivel: userAtualizado.gamificacao.xpProximoNivel
        });
    } catch (error) {
        console.error('Erro ao adicionar XP:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🌟 NOVO: Criar Avaliação Verificada (após serviço concluído ou avaliação de perfil)
app.post('/api/avaliacoes-verificadas', authMiddleware, async (req, res) => {
    try {
        let { profissionalId, agendamentoId, pedidoUrgenteId, estrelas, comentario, dataServico, servico } = req.body;
        const clienteId = req.user.id;
        
        console.log('💾 Criando avaliação verificada - IDs:', {
            reqUserId: req.user.id,
            reqUserIdString: String(req.user.id),
            reqUserEmail: req.user.email,
            profissionalId: profissionalId,
            profissionalIdString: String(profissionalId),
            isPerfil: servico === 'Avaliação de Perfil'
        });

        let nomeServico = servico || '';
        let dataServicoFinal = dataServico || new Date();

        // Se tem pedidoUrgenteId (pedido urgente sem agendamento), valida o pedido primeiro
        if (pedidoUrgenteId) {
            const pedido = await PedidoUrgente.findById(pedidoUrgenteId);
            if (!pedido) {
                return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
            }

            if (pedido.clienteId.toString() !== clienteId) {
                return res.status(403).json({ success: false, message: 'Você não pode avaliar este serviço.' });
            }

            // Verifica se tem proposta aceita antes de concluir/avaliar
            const propostaAceitaParaAvaliacao = pedido.propostas?.find(prop =>
                prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
            );
            if (!propostaAceitaParaAvaliacao) {
                return res.status(400).json({ success: false, message: 'Este pedido não tem proposta aceita.' });
            }

            // Permite avaliar se estiver concluído; se estiver em andamento, conclui automaticamente
            if (pedido.status !== 'concluido') {
                if (pedido.status === 'em_andamento') {
                    pedido.status = 'concluido';
                    await pedido.save();
                    console.log(' Pedido urgente marcado como concluído antes de criar avaliação (auto):', pedidoUrgenteId);
                } else {
                    return res.status(400).json({ success: false, message: 'O serviço precisa estar concluído para ser avaliado.' });
                }
            }

            // IMPORTANTE: Extrai o profissionalId da proposta aceita do pedido
            // Isso garante que o profissionalId correto seja usado, mesmo se o frontend enviar errado
            // FAZER ISSO ANTES de converter para ObjectId
            const propostaAceita = pedido.propostas?.find(prop => 
                prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
            );
            
            if (propostaAceita && propostaAceita.profissionalId) {
                // Extrai o profissionalId corretamente (pode ser ObjectId ou string)
                let profissionalIdDoPedido = propostaAceita.profissionalId;
                if (profissionalIdDoPedido && typeof profissionalIdDoPedido === 'object' && profissionalIdDoPedido._id) {
                    profissionalIdDoPedido = profissionalIdDoPedido._id;
                }
                profissionalIdDoPedido = String(profissionalIdDoPedido);
                
                console.log('💾 Extraindo profissionalId da proposta aceita do pedido:', {
                    profissionalIdRecebido: profissionalId,
                    profissionalIdDoPedido: profissionalIdDoPedido,
                    usandoProfissionalIdDoPedido: profissionalIdDoPedido !== String(profissionalId)
                });
                
                // Usa o profissionalId da proposta aceita (mais confiável)
                if (profissionalIdDoPedido && mongoose.Types.ObjectId.isValid(profissionalIdDoPedido)) {
                    profissionalId = profissionalIdDoPedido;
                    console.log('✅ Usando profissionalId da proposta aceita:', profissionalId);
                }
            } else {
                console.warn('⚠️ Pedido não tem proposta aceita, usando profissionalId do body:', profissionalId);
            }

            // IMPORTANTE: Prioriza o nome do serviço do pedido se o frontend não enviou ou enviou vazio
            // Mas se o frontend enviou um nome válido, usa ele (mais confiável)
            if (!nomeServico || nomeServico.trim() === '' || nomeServico === 'Serviço concluído') {
                nomeServico = pedido.servico || pedido.titulo || pedido.descricao || '';
                console.log('💾 Nome do serviço obtido do pedido (frontend não enviou ou enviou vazio):', nomeServico);
            } else {
                console.log('💾 Nome do serviço enviado pelo frontend será usado:', nomeServico);
            }
            dataServicoFinal = dataServicoFinal || pedido.updatedAt || new Date();
        }
        // Se tem agendamentoId (serviço agendado), valida o agendamento
        else if (agendamentoId) {
        const agendamento = await Agendamento.findById(agendamentoId);
        if (!agendamento) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
        }

        if (agendamento.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Você não pode avaliar este serviço.' });
        }

        if (agendamento.status !== 'concluido') {
            return res.status(400).json({ success: false, message: 'O serviço precisa estar concluído para ser avaliado.' });
        }

            // IMPORTANTE: Prioriza o nome do serviço do agendamento se o frontend não enviou ou enviou vazio
            if (!nomeServico || nomeServico.trim() === '' || nomeServico === 'Serviço concluído') {
                nomeServico = agendamento.servico || '';
                console.log('💾 Nome do serviço obtido do agendamento (frontend não enviou ou enviou vazio):', nomeServico);
            } else {
                console.log('💾 Nome do serviço enviado pelo frontend será usado:', nomeServico);
            }
            dataServicoFinal = dataServicoFinal || agendamento.dataHora;
        }
        // Se não tem nem agendamentoId nem pedidoUrgenteId
        else {
            // Verifica se é uma avaliação de perfil explícita
            if (servico === 'Avaliação de Perfil') {
                console.log('✅ Avaliação de Perfil identificada (sem serviço vinculado)');
                nomeServico = 'Avaliação de Perfil';
                // Não precisa de validação de pedido/agendamento
            } else {
                return res.status(400).json({ success: false, message: 'É necessário informar um agendamentoId ou pedidoUrgenteId.' });
            }
        }

        // Garantir que profissionalId seja ObjectId (DEPOIS de possivelmente ter sido atualizado acima)
        if (!profissionalId) {
            return res.status(400).json({ success: false, message: 'profissionalId é obrigatório.' });
        }
        
        let profissionalIdFinal = profissionalId;
        if (mongoose.Types.ObjectId.isValid(profissionalId)) {
            profissionalIdFinal = new mongoose.Types.ObjectId(profissionalId);
        } else {
            return res.status(400).json({ success: false, message: 'profissionalId inválido.' });
        }
        
        console.log('💾 Criando avaliação verificada - profissionalId final:', {
            original: profissionalId,
            convertido: profissionalIdFinal,
            tipo: typeof profissionalIdFinal
        });

        // Garantir que pedidoUrgenteId seja ObjectId se fornecido
        let pedidoUrgenteIdFinal = pedidoUrgenteId;
        if (pedidoUrgenteId && mongoose.Types.ObjectId.isValid(pedidoUrgenteId)) {
            pedidoUrgenteIdFinal = new mongoose.Types.ObjectId(pedidoUrgenteId);
        }
        
        // Garantir que clienteId seja ObjectId
        let clienteIdFinal = clienteId;
        if (clienteId && mongoose.Types.ObjectId.isValid(clienteId)) {
            clienteIdFinal = new mongoose.Types.ObjectId(clienteId);
        }

        // Marca o pedido/agendamento como concluído ANTES de criar a avaliação
        if (pedidoUrgenteIdFinal) {
            const pedido = await PedidoUrgente.findById(pedidoUrgenteIdFinal);
            if (pedido && pedido.status !== 'concluido') {
                pedido.status = 'concluido';
                await pedido.save();
                console.log('✅ Pedido urgente marcado como concluído antes de criar avaliação:', pedidoUrgenteIdFinal);
            }
        }
        
        if (agendamentoId) {
            const agendamento = await Agendamento.findById(agendamentoId);
            if (agendamento && agendamento.status !== 'concluido') {
                agendamento.status = 'concluido';
                await agendamento.save();
                console.log('✅ Agendamento marcado como concluído antes de criar avaliação:', agendamentoId);
                
                // Se o agendamento tem um pedido urgente associado, marca ele também como concluído
                if (agendamento.pedidoUrgenteId) {
                    const pedidoAssociado = await PedidoUrgente.findById(agendamento.pedidoUrgenteId);
                    if (pedidoAssociado && pedidoAssociado.status !== 'concluido') {
                        pedidoAssociado.status = 'concluido';
                        await pedidoAssociado.save();
                        console.log('✅ Pedido urgente associado marcado como concluído:', agendamento.pedidoUrgenteId);
                    }
                }
            }
        }

        // Verifica se já existe uma avaliação verificada para este serviço específico
        // Evita avaliações duplicadas do mesmo cliente para o mesmo serviço
        let queryDuplicata = {
            profissionalId: profissionalIdFinal,
            clienteId: clienteIdFinal
        };
        
        // Adiciona condição específica para pedido ou agendamento
        if (pedidoUrgenteIdFinal) {
            queryDuplicata.pedidoUrgenteId = pedidoUrgenteIdFinal;
        } else if (agendamentoId) {
            queryDuplicata.agendamentoId = agendamentoId;
        } else if (servico === 'Avaliação de Perfil') {
            // Se for avaliação de perfil, verifica se já existe avaliação de perfil deste cliente
            // Garante unicidade para avaliações de perfil
            queryDuplicata.servico = 'Avaliação de Perfil';
        }
        
        const avaliacaoExistente = await AvaliacaoVerificada.findOne(queryDuplicata);
        if (avaliacaoExistente) {
            return res.status(400).json({ 
                success: false, 
                message: 'Você já avaliou este serviço. Cada serviço só pode ser avaliado uma vez.' 
            });
        }

        // Cria a avaliação verificada
        console.log('💾 Criando avaliação verificada com:', {
            profissionalId,
            clienteId,
            agendamentoId: agendamentoId || undefined,
            pedidoUrgenteId: pedidoUrgenteId || undefined,
            servico: nomeServico,
            estrelas,
            comentario: comentario?.substring(0, 50) + '...'
        });
        
        const novaAvaliacao = new AvaliacaoVerificada({
            profissionalId: profissionalIdFinal,
            clienteId: clienteIdFinal,
            agendamentoId: agendamentoId || undefined,
            pedidoUrgenteId: pedidoUrgenteIdFinal || undefined,
            estrelas,
            comentario,
            servico: nomeServico,
            dataServico: dataServicoFinal
        });

        await novaAvaliacao.save();
        console.log('✅ Avaliação verificada salva:', {
            _id: novaAvaliacao._id,
            servico: novaAvaliacao.servico,
            profissionalId: novaAvaliacao.profissionalId,
            profissionalIdType: typeof novaAvaliacao.profissionalId,
            profissionalIdString: String(novaAvaliacao.profissionalId),
            pedidoUrgenteId: novaAvaliacao.pedidoUrgenteId,
            pedidoUrgenteIdType: typeof novaAvaliacao.pedidoUrgenteId,
            pedidoUrgenteIdString: String(novaAvaliacao.pedidoUrgenteId),
            clienteId: novaAvaliacao.clienteId,
            clienteIdType: typeof novaAvaliacao.clienteId,
            clienteIdString: String(novaAvaliacao.clienteId),
            reqUserId: req.user.id,
            reqUserIdString: String(req.user.id),
            clienteIdMatch: String(novaAvaliacao.clienteId) === String(req.user.id)
        });

        // Atualiza XP do profissional baseado na avaliação verificada
        let xpGanho = 0;
        if (estrelas === 5) {
            xpGanho = 100; // Mais XP para avaliações verificadas 5 estrelas
        } else if (estrelas === 4) {
            xpGanho = 50;
        } else if (estrelas === 3) {
            xpGanho = 25;
        } else {
            xpGanho = 10; // Mesmo avaliações baixas dão XP (serviço foi feito)
        }

        await adicionarXP(profissionalIdFinal, xpGanho, `Avaliação verificada ${estrelas} estrelas`);

        // Recalcula média de avaliações verificadas do profissional
        const avaliacoesVerificadas = await AvaliacaoVerificada.find({ profissionalId: profissionalIdFinal });
        const mediaVerificada = avaliacoesVerificadas.reduce((acc, av) => acc + av.estrelas, 0) / avaliacoesVerificadas.length;
        
        await User.findByIdAndUpdate(profissionalIdFinal, {
            'gamificacao.mediaAvaliacoesVerificadas': mediaVerificada,
            'gamificacao.totalAvaliacoesVerificadas': avaliacoesVerificadas.length
        });

        res.status(201).json({ 
            success: true, 
            message: 'Avaliação verificada criada com sucesso!',
            avaliacao: novaAvaliacao,
            xpGanho
        });
    } catch (error) {
        console.error('Erro ao criar avaliação verificada:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🌟 NOVO: Listar Avaliações Verificadas de um Usuário/Profissional (enriquece com nome do serviço)
// Nota: profissionalId aqui se refere ao usuário que RECEBE a avaliação (quem prestou o serviço)
app.get('/api/avaliacoes-verificadas/:profissionalId', async (req, res) => {
    try {
        const { profissionalId } = req.params;
        console.log('📋 Buscando avaliações verificadas para profissionalId (usuário que recebe):', profissionalId);
        
        // Normaliza o ID para comparação
        const profissionalIdNormalizado = String(profissionalId).trim();
        
        // Tenta buscar com diferentes formatos
        let avaliacoes = [];
        
        // SEMPRE busca todas as avaliações e filtra manualmente para garantir que encontra todas
        // Isso é mais robusto e garante que não perde nenhuma avaliação por problemas de formato de ID
        console.log('📋 Buscando TODAS as avaliações para filtrar manualmente (método mais robusto)...');
        const todasAvaliacoes = await AvaliacaoVerificada.find({})
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('agendamentoId', 'servico dataHora')
            .populate('pedidoUrgenteId', 'servico titulo descricao foto fotos')
            .sort({ createdAt: -1 })
            .exec();
        
        console.log(`📋 Total de avaliações no banco: ${todasAvaliacoes.length}`);
        console.log('📋 Amostra de profissionalIds no banco:', todasAvaliacoes.slice(0, 10).map(av => ({
            _id: String(av._id),
            profissionalId: String(av.profissionalId),
            profissionalIdTrim: String(av.profissionalId).trim(),
            buscaProfissionalId: profissionalIdNormalizado,
            match: String(av.profissionalId).trim() === profissionalIdNormalizado,
            servico: av.servico,
            clienteId: String(av.clienteId?._id || av.clienteId),
            createdAt: av.createdAt
        })));
        
        // Filtra manualmente comparando IDs normalizados (mais robusto)
        avaliacoes = todasAvaliacoes.filter(av => {
            const avProfId = av.profissionalId ? String(av.profissionalId).trim() : null;
            const match = avProfId && avProfId === profissionalIdNormalizado;
            if (match) {
                console.log('✅ Match encontrado:', {
                    avaliacaoId: av._id,
                    avProfId: avProfId,
                    buscaProfissionalId: profissionalIdNormalizado,
                    servico: av.servico,
                    clienteId: String(av.clienteId?._id || av.clienteId),
                    createdAt: av.createdAt
                });
            }
            return match;
        });
        
        console.log(`📋 Avaliações filtradas manualmente: ${avaliacoes.length}`);
        if (avaliacoes.length !== todasAvaliacoes.filter(av => {
            const avProfId = av.profissionalId ? String(av.profissionalId).trim() : null;
            return avProfId && avProfId === profissionalIdNormalizado;
        }).length) {
            console.warn('⚠️ Inconsistência na filtragem de avaliações!');
        }
        
        // Log de debug se encontrou avaliações
        if (avaliacoes.length > 0) {
            console.log('✅ Primeira avaliação encontrada:', {
                _id: avaliacoes[0]._id,
                profissionalId: String(avaliacoes[0].profissionalId),
                clienteId: avaliacoes[0].clienteId?.nome || String(avaliacoes[0].clienteId),
                servico: avaliacoes[0].servico
            });
        } else if (todasAvaliacoes.length > 0) {
            console.log('⚠️ Nenhuma avaliação encontrada com ObjectId, buscando todas para filtrar...');
            const todasAvaliacoes = await AvaliacaoVerificada.find({})
                .populate('clienteId', 'nome foto avatarUrl')
                .populate('agendamentoId', 'servico dataHora')
                .populate('pedidoUrgenteId', 'servico titulo descricao')
                .sort({ createdAt: -1 })
                .exec();
            
            console.log(`📋 Total de avaliações no banco: ${todasAvaliacoes.length}`);
            console.log('📋 Amostra de profissionalIds no banco:', todasAvaliacoes.slice(0, 5).map(av => ({
                _id: av._id,
                profissionalId: String(av.profissionalId),
                profissionalIdType: typeof av.profissionalId,
                profissionalIdIsObjectId: av.profissionalId instanceof mongoose.Types.ObjectId,
                servico: av.servico,
                createdAt: av.createdAt
            })));
            
            // Filtra manualmente comparando IDs normalizados
            avaliacoes = todasAvaliacoes.filter(av => {
                const avProfId = av.profissionalId ? String(av.profissionalId).trim() : null;
                const match = avProfId && avProfId === profissionalIdNormalizado;
                if (match) {
                    console.log('✅ Match encontrado:', {
                        avaliacaoId: av._id,
                        avProfId: avProfId,
                        buscaProfissionalId: profissionalIdNormalizado,
                        servico: av.servico
                    });
                }
                return match;
            });
            
            console.log(`📋 Avaliações filtradas manualmente: ${avaliacoes.length}`);
            
            // Log de debug se não encontrou mas há avaliações no banco
            console.log('⚠️ Nenhuma avaliação encontrada para este profissionalId. Amostra de avaliações no banco:', {
                primeira: {
                    _id: todasAvaliacoes[0]._id,
                    profissionalId: String(todasAvaliacoes[0].profissionalId),
                    profissionalIdNormalizado: String(todasAvaliacoes[0].profissionalId).trim(),
                    buscaProfissionalId: profissionalIdNormalizado,
                    match: String(todasAvaliacoes[0].profissionalId).trim() === profissionalIdNormalizado
                }
            });
        }
        
        console.log('✅ Total de avaliações encontradas:', avaliacoes.length);
        if (avaliacoes.length > 0) {
            console.log('📋 Primeira avaliação:', {
                _id: avaliacoes[0]._id,
                profissionalId: avaliacoes[0].profissionalId,
                profissionalIdString: String(avaliacoes[0].profissionalId),
                profissionalIdType: typeof avaliacoes[0].profissionalId,
                profissionalIdIsObjectId: avaliacoes[0].profissionalId instanceof mongoose.Types.ObjectId,
                clienteId: avaliacoes[0].clienteId,
                clienteIdString: String(avaliacoes[0].clienteId?._id || avaliacoes[0].clienteId),
                servico: avaliacoes[0].servico,
                pedidoUrgenteId: avaliacoes[0].pedidoUrgenteId ? String(avaliacoes[0].pedidoUrgenteId) : null
            });
            console.log('📋 Todas as avaliações encontradas:', avaliacoes.map(av => ({
                _id: String(av._id),
                profissionalId: String(av.profissionalId),
                clienteId: String(av.clienteId?._id || av.clienteId),
                servico: av.servico,
                createdAt: av.createdAt
            })));
        } else {
            console.log('⚠️ Nenhuma avaliação encontrada para profissionalId:', profissionalIdNormalizado);
            // Buscar todas as avaliações no banco para debug
            const todasAvaliacoesDebug = await AvaliacaoVerificada.find({}).limit(5).lean().exec();
            console.log('📋 Amostra de avaliações no banco (primeiras 5):', todasAvaliacoesDebug.map(av => ({
                _id: String(av._id),
                profissionalId: String(av.profissionalId),
                profissionalIdType: typeof av.profissionalId,
                clienteId: String(av.clienteId),
                servico: av.servico,
                pedidoUrgenteId: av.pedidoUrgenteId ? String(av.pedidoUrgenteId) : null
            })));
        }

        // Enriquecimento: tenta descobrir o nome do serviço via agendamentoId/pedido
        const avaliacoesEnriquecidas = [];
        for (const av of avaliacoes) {
            const plain = av.toObject();
            
            // 1. Se já tem servico salvo na avaliação e não é placeholder, usa ele
            const servicoAtual = plain.servico && plain.servico.trim() ? plain.servico.trim() : '';
            const isPlaceholder = servicoAtual && (
                servicoAtual.toLowerCase() === 'serviço concluído' ||
                servicoAtual.toLowerCase() === 'serviço prestado' ||
                servicoAtual.toLowerCase() === 'serviço realizado'
            );
            
            if (servicoAtual && !isPlaceholder) {
                avaliacoesEnriquecidas.push(plain);
                continue;
            }
            
            // Se tem placeholder ou está vazio, tenta buscar de outras fontes
            
            // 2. Tenta pegar do agendamento populado
            let servicoEncontrado = null;
            if (plain.agendamentoId) {
                // Se está populado (é um objeto com propriedades)
                if (typeof plain.agendamentoId === 'object' && plain.agendamentoId.servico) {
                    servicoEncontrado = plain.agendamentoId.servico;
                } else {
                    // Se é apenas um ObjectId, busca o agendamento
                    const agendamentoIdValue = plain.agendamentoId._id || plain.agendamentoId;
                    if (mongoose.Types.ObjectId.isValid(agendamentoIdValue)) {
                        try {
                            const agendamento = await Agendamento.findById(agendamentoIdValue).lean();
                            if (agendamento?.servico) {
                                servicoEncontrado = agendamento.servico;
                            } else {
                                // Se não encontrou no agendamento, tenta buscar em um pedido urgente que tenha este agendamentoId
                                const pedido = await PedidoUrgente.findOne({ agendamentoId: agendamentoIdValue }).lean();
                                if (pedido?.servico) {
                                    servicoEncontrado = pedido.servico;
                                    // Expor também o pedido urgente no retorno, para o frontend conseguir pegar fotos
                                    plain.pedidoId = pedido._id;
                                    if (!plain.pedidoUrgenteId) {
                                        plain.pedidoUrgenteId = {
                                            _id: pedido._id,
                                            servico: pedido.servico,
                                            foto: pedido.foto,
                                            fotos: pedido.fotos || (pedido.foto ? [pedido.foto] : [])
                                        };
                                    }
                                }
                            }
                    } catch (e) {
                        console.warn('Falha ao enriquecer avaliação verificada com serviço', e);
                    }
                }
            }
            }
            
            // 3. Se não encontrou no agendamento, tenta do pedidoUrgenteId populado
            if (!servicoEncontrado && plain.pedidoUrgenteId) {
                // Se está populado (é um objeto com propriedades)
                if (typeof plain.pedidoUrgenteId === 'object' && plain.pedidoUrgenteId.servico) {
                    servicoEncontrado = plain.pedidoUrgenteId.servico;
                } else {
                    // Se é apenas um ObjectId, busca o pedido urgente
                    const pedidoIdValue = plain.pedidoUrgenteId._id || plain.pedidoUrgenteId;
                    if (mongoose.Types.ObjectId.isValid(pedidoIdValue)) {
                        try {
                            const pedido = await PedidoUrgente.findById(pedidoIdValue).lean();
                            if (pedido?.servico) {
                                servicoEncontrado = pedido.servico;
                            }
                        } catch (e) {
                            console.warn('Falha ao enriquecer avaliação verificada com serviço do pedido urgente', e);
                        }
                    }
                }
            }
            
            // Atribui o serviço encontrado (só se não for placeholder)
            if (servicoEncontrado && servicoEncontrado.trim()) {
                const servicoLimpo = servicoEncontrado.trim();
                const isPlaceholderEncontrado = (
                    servicoLimpo.toLowerCase() === 'serviço concluído' ||
                    servicoLimpo.toLowerCase() === 'serviço prestado' ||
                    servicoLimpo.toLowerCase() === 'serviço realizado'
                );
                
                if (!isPlaceholderEncontrado) {
                    plain.servico = servicoLimpo;
                    console.log(`✅ Nome do serviço atribuído à avaliação ${plain._id}: ${plain.servico}`);
                } else {
                    console.warn(`⚠️ Serviço encontrado é placeholder, não atribuindo: ${servicoLimpo}`);
                }
            } else {
                console.warn(`⚠️ Nenhum nome de serviço encontrado para avaliação ${plain._id}`);
            }
            
            avaliacoesEnriquecidas.push(plain);
        }

        console.log('✅ Total de avaliações enriquecidas retornadas:', avaliacoesEnriquecidas.length);
        res.json({ success: true, avaliacoes: avaliacoesEnriquecidas });
    } catch (error) {
        console.error('Erro ao buscar avaliações verificadas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🔧 ROTA TEMPORÁRIA PARA DEBUG: Listar todas as avaliações verificadas
app.get('/api/avaliacoes-verificadas-debug/todas', authMiddleware, async (req, res) => {
    try {
        const todasAvaliacoes = await AvaliacaoVerificada.find({})
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('profissionalId', 'nome foto avatarUrl')
            .populate('agendamentoId', 'servico dataHora')
            .populate('pedidoUrgenteId', 'servico titulo descricao')
            .sort({ createdAt: -1 })
            .limit(50)
            .exec();
        
        const avaliacoesFormatadas = todasAvaliacoes.map(av => ({
            _id: av._id,
            profissionalId: String(av.profissionalId?._id || av.profissionalId),
            profissionalNome: av.profissionalId?.nome || 'N/A',
            clienteId: String(av.clienteId?._id || av.clienteId),
            clienteNome: av.clienteId?.nome || 'N/A',
            servico: av.servico,
            estrelas: av.estrelas,
            comentario: av.comentario,
            createdAt: av.createdAt
        }));
        
        res.json({ success: true, total: todasAvaliacoes.length, avaliacoes: avaliacoesFormatadas });
    } catch (error) {
        console.error('Erro ao buscar todas as avaliações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota para buscar avaliações verificadas por pedidoId
app.get('/api/avaliacoes-verificadas/pedido/:pedidoId', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.user.id;
        
        console.log('🔍 Buscando avaliações para pedido:', pedidoId, 'Cliente:', clienteId);
        
        // Converter para ObjectId se válido
        let pedidoIdObj = null;
        if (mongoose.Types.ObjectId.isValid(pedidoId)) {
            try {
                pedidoIdObj = new mongoose.Types.ObjectId(pedidoId);
            } catch (e) {
                console.warn('⚠️ Erro ao converter pedidoId para ObjectId:', e);
            }
        }
        
        // Converter clienteId para ObjectId se necessário
        let clienteIdObj = clienteId;
        if (mongoose.Types.ObjectId.isValid(clienteId)) {
            try {
                clienteIdObj = new mongoose.Types.ObjectId(clienteId);
            } catch (e) {
                console.warn('⚠️ Erro ao converter clienteId para ObjectId:', e);
            }
        }
        
        // Normalizar o pedidoId para comparação
        const pedidoIdNormalizado = String(pedidoId).trim();
        const pedidoIdNormalizadoObj = pedidoIdObj ? String(pedidoIdObj) : null;
        
        // Buscar avaliações usando múltiplas estratégias para garantir que encontre
        let avaliacoes = [];
        try {
            // ESTRATÉGIA 1: Buscar todas as avaliações do cliente com pedidoUrgenteId
            // Depois filtrar manualmente (mais confiável)
            console.log('🔍 Buscando todas as avaliações do cliente...');
            console.log('🔍 Parâmetros de busca:', {
                clienteId: String(clienteIdObj),
                clienteIdType: typeof clienteIdObj,
                pedidoIdBuscado: pedidoIdNormalizado,
                pedidoIdObj: pedidoIdObj ? String(pedidoIdObj) : null
            });
            
            const todasAvaliacoesCliente = await AvaliacaoVerificada.find({ 
                clienteId: clienteIdObj,
                pedidoUrgenteId: { $exists: true, $ne: null }
            })
                .populate('clienteId', 'nome foto avatarUrl _id')
                .populate('profissionalId', 'nome foto avatarUrl')
                .sort({ createdAt: -1 })
                .lean()
                .exec();
            
            console.log('📋 Total de avaliações do cliente com pedidoUrgenteId:', todasAvaliacoesCliente.length);
            
            // Debug: mostrar todas as avaliações encontradas
            if (todasAvaliacoesCliente.length > 0) {
                console.log('🔍 Todas as avaliações do cliente:', todasAvaliacoesCliente.map(av => ({
                    _id: String(av._id),
                    pedidoUrgenteId: av.pedidoUrgenteId ? String(av.pedidoUrgenteId) : null,
                    pedidoUrgenteIdType: typeof av.pedidoUrgenteId,
                    clienteId: av.clienteId?._id ? String(av.clienteId._id) : String(av.clienteId),
                    servico: av.servico
                })));
            }
            
            // Filtrar manualmente comparando strings e ObjectIds
            avaliacoes = todasAvaliacoesCliente.filter(av => {
                if (!av.pedidoUrgenteId) {
                    console.log('⚠️ Avaliação sem pedidoUrgenteId:', String(av._id));
                    return false;
                }
                
                // Converter para string para comparação (normalizar)
                const avPedidoIdStr = String(av.pedidoUrgenteId).trim();
                const pedidoIdBuscadoStr = pedidoIdNormalizado.trim();
                
                // Comparar com todas as variações possíveis
                const match1 = avPedidoIdStr === pedidoIdBuscadoStr;
                const match2 = pedidoIdNormalizadoObj && avPedidoIdStr === pedidoIdNormalizadoObj.trim();
                const match3 = pedidoIdObj && avPedidoIdStr === String(pedidoIdObj).trim();
                
                // Comparação adicional: verificar se são ObjectIds equivalentes
                let match4 = false;
                if (pedidoIdObj && mongoose.Types.ObjectId.isValid(av.pedidoUrgenteId)) {
                    try {
                        const avObjId = new mongoose.Types.ObjectId(av.pedidoUrgenteId);
                        match4 = avObjId.equals(pedidoIdObj);
                    } catch (e) {
                        // Ignora erro de conversão
                    }
                }
                
                const match = match1 || match2 || match3 || match4;
                
                if (match) {
                    console.log('✅ Match encontrado:', {
                        pedidoIdBuscado: pedidoIdBuscadoStr,
                        pedidoUrgenteIdEncontrado: avPedidoIdStr,
                        match1,
                        match2,
                        match3,
                        match4
                    });
                } else {
                    console.log('❌ Não match:', {
                        pedidoIdBuscado: pedidoIdBuscadoStr,
                        pedidoUrgenteIdEncontrado: avPedidoIdStr,
                        comparacao: avPedidoIdStr === pedidoIdBuscadoStr
                    });
                }
                
                return match;
            });
            
            console.log('📋 Avaliações encontradas após filtro manual:', avaliacoes.length);
            
            // Se encontrou, converter de volta para documentos Mongoose
            if (avaliacoes.length > 0) {
                const ids = avaliacoes.map(av => av._id);
                avaliacoes = await AvaliacaoVerificada.find({ _id: { $in: ids } })
                    .populate('clienteId', 'nome foto avatarUrl')
                    .populate('profissionalId', 'nome foto avatarUrl')
                    .sort({ createdAt: -1 })
                    .exec();
            } else {
                // Debug: mostrar algumas avaliações para entender o formato
                if (todasAvaliacoesCliente.length > 0) {
                    console.log('🔍 Debug - Primeiras 3 avaliações do cliente:', todasAvaliacoesCliente.slice(0, 3).map(av => ({
                        pedidoUrgenteId: av.pedidoUrgenteId,
                        pedidoUrgenteIdString: String(av.pedidoUrgenteId),
                        pedidoUrgenteIdType: typeof av.pedidoUrgenteId,
                        pedidoIdBuscado: pedidoIdNormalizado,
                        match: String(av.pedidoUrgenteId).trim() === pedidoIdNormalizado
                    })));
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar avaliações:', error);
            console.error('❌ Stack trace:', error.stack);
            avaliacoes = [];
        }
        
        // Se não encontrou, mostrar debug detalhado
        if (avaliacoes.length === 0) {
            console.log('⚠️ Não encontrou avaliação para pedido:', pedidoIdNormalizado, 'cliente:', clienteId);
            console.log('⚠️ Tentou buscar com:', {
                pedidoIdNormalizado,
                pedidoIdObj: pedidoIdObj ? String(pedidoIdObj) : null,
                clienteIdObj: String(clienteIdObj)
            });
        }

        console.log('📋 Avaliações encontradas:', avaliacoes.length, 'para pedido:', pedidoId);
        if (avaliacoes.length > 0) {
            console.log('✅ Primeira avaliação:', {
                _id: avaliacoes[0]._id,
                pedidoUrgenteId: avaliacoes[0].pedidoUrgenteId,
                pedidoUrgenteIdType: typeof avaliacoes[0].pedidoUrgenteId,
                pedidoUrgenteIdString: String(avaliacoes[0].pedidoUrgenteId),
                clienteId: avaliacoes[0].clienteId?._id || avaliacoes[0].clienteId
            });
        } else {
            // Debug: tentar buscar todas as avaliações do cliente para ver o formato
            try {
                const todasAvaliacoesCliente = await AvaliacaoVerificada.find({ 
                    clienteId: clienteIdObj,
                    pedidoUrgenteId: { $exists: true, $ne: null }
                })
                    .limit(3)
                    .lean()
                    .exec();
                
                if (todasAvaliacoesCliente.length > 0) {
                    console.log('🔍 Debug - Primeiras 3 avaliações do cliente:', todasAvaliacoesCliente.map(av => ({
                        pedidoUrgenteId: av.pedidoUrgenteId,
                        pedidoUrgenteIdString: String(av.pedidoUrgenteId),
                        pedidoUrgenteIdType: typeof av.pedidoUrgenteId,
                        pedidoIdBuscado: pedidoId,
                        pedidoIdNormalizado: pedidoIdNormalizado,
                        match: String(av.pedidoUrgenteId).trim() === pedidoIdNormalizado
                    })));
                }
            } catch (debugError) {
                console.error('❌ Erro ao buscar avaliações para debug:', debugError);
            }
        }
        
        res.json({ success: true, avaliacoes });
    } catch (error) {
        console.error('❌ Erro ao buscar avaliações verificadas por pedido:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ PedidoId:', req.params.pedidoId);
        console.error('❌ ClienteId:', req.user?.id);
        res.status(500).json({ success: false, message: 'Erro ao buscar avaliações verificadas.', error: error.message });
    }
});

// 🆕 NOVO: Atualizar avaliação para adicionar XP automaticamente (MANTIDO PARA COMPATIBILIDADE)
app.post('/api/avaliar-trabalhador', authMiddleware, async (req, res) => {
    try {
        const { trabalhadorId, estrelas, comentario, servico, pedidoId, agendamentoId } = req.body;
        const usuarioId = req.user.id;

        const trabalhador = await User.findById(trabalhadorId);
        if (!trabalhador) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Adiciona a nova avaliação
        const novaAvaliacao = {
            usuarioId,
            estrelas,
            comentario,
            servico: servico || '',
            pedidoId: pedidoId || '',
            agendamentoId: agendamentoId || '',
            createdAt: new Date()
        };
        trabalhador.avaliacoes.push(novaAvaliacao);

        // Recalcula a média
        const totalEstrelas = trabalhador.avaliacoes.reduce((acc, avaliacao) => acc + avaliacao.estrelas, 0);
        trabalhador.mediaAvaliacao = totalEstrelas / trabalhador.avaliacoes.length;
        trabalhador.totalAvaliacoes = trabalhador.avaliacoes.length;
        
        await trabalhador.save();

        // 🆕 Adiciona XP se for 5 estrelas (valor atualizado)
        if (estrelas === 5) {
            await adicionarXP(trabalhadorId, 50, 'Avaliação 5 estrelas');
        }

        res.status(201).json({ success: true, message: 'Avaliação adicionada com sucesso!', mediaAvaliacao: trabalhador.mediaAvaliacao });
    } catch (error) {
        console.error('Erro ao avaliar trabalhador:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor ao avaliar.' });
    }
});

// 🏢 NOVO: Rotas de Times Locais (Micro-Agências)
// Criar Time Local
app.post('/api/times-locais', authMiddleware, async (req, res) => {
    try {
        const { nome, descricao, categoria } = req.body;
        const liderId = req.user.id;
        
        const lider = await User.findById(liderId);
        if (!lider) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se o líder tem nível suficiente (Nível 10+)
        if ((lider.gamificacao?.nivel || 1) < 10) {
            return res.status(403).json({ success: false, message: 'Você precisa ser Nível 10 ou superior para criar um time local.' });
        }

        const novoTime = new TimeLocal({
            liderId,
            nome,
            descricao,
            categoria,
            nivelMedio: lider.gamificacao?.nivel || 1
        });

        await novoTime.save();
        
        res.status(201).json({ success: true, message: 'Time local criado com sucesso!', time: novoTime });
    } catch (error) {
        console.error('Erro ao criar time local:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Convidar membro para Time Local
app.post('/api/times-locais/:timeId/convidar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const { profissionalId, funcao } = req.body;
        const liderId = req.user.id;

        const time = await TimeLocal.findById(timeId);
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time local não encontrado.' });
        }

        if (time.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Apenas o líder pode convidar membros.' });
        }

        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se já é membro
        const jaMembro = time.membros.some(m => m.profissionalId.toString() === profissionalId);
        if (jaMembro) {
            return res.status(400).json({ success: false, message: 'Este profissional já é membro do time.' });
        }

        time.membros.push({
            profissionalId,
            funcao,
            status: 'pendente'
        });

        // Recalcula nível médio
        const membrosAtivos = await User.find({ 
            _id: { $in: [...time.membros.map(m => m.profissionalId), time.liderId] } 
        });
        const nivelMedio = membrosAtivos.reduce((sum, m) => sum + (m.gamificacao?.nivel || 1), 0) / membrosAtivos.length;
        time.nivelMedio = Math.round(nivelMedio);

        await time.save();
        
        res.json({ success: true, message: 'Convite enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao convidar membro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Times Locais
app.get('/api/times-locais', async (req, res) => {
    try {
        const { categoria, cidade } = req.query;
        
        let query = { isAtivo: true };
        if (categoria) {
            query.categoria = categoria;
        }

        const times = await TimeLocal.find(query)
            .populate('liderId', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .populate('membros.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ nivelMedio: -1, projetosCompletos: -1 })
            .exec();

        // Filtra por cidade se especificado
        let timesFiltrados = times;
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            timesFiltrados = times.filter(time => {
                const cidadeLider = time.liderId?.cidade || '';
                return normalizeString(cidadeLider).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadeLider));
            });
        }

        res.json({ success: true, times: timesFiltrados });
    } catch (error) {
        console.error('Erro ao buscar times locais:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📋 NOVO: Rotas de Projetos de Time / Mutirão Pago
// Criar Projeto de Time
app.post('/api/projetos-time', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, categoria, localizacao, dataServico, horaInicio, horaFim, profissionaisNecessarios, valorTotal } = req.body;
        const clienteId = req.user.id;

        const novoProjeto = new ProjetoTime({
            clienteId,
            titulo,
            descricao,
            categoria,
            localizacao,
            dataServico: new Date(dataServico),
            horaInicio,
            horaFim,
            profissionaisNecessarios,
            valorTotal
        });

        await novoProjeto.save();
        
        res.status(201).json({ success: true, message: 'Projeto de time criado com sucesso!', projeto: novoProjeto });
    } catch (error) {
        console.error('Erro ao criar projeto de time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Candidatar Time Local a Projeto
app.post('/api/projetos-time/:projetoId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { projetoId } = req.params;
        const { timeLocalId, proposta } = req.body;
        const liderId = req.user.id;

        const projeto = await ProjetoTime.findById(projetoId);
        if (!projeto) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado.' });
        }

        const time = await TimeLocal.findById(timeLocalId);
        if (!time || time.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Você não é líder deste time.' });
        }

        if (projeto.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este projeto não está mais aceitando candidatos.' });
        }

        projeto.candidatos.push({
            timeLocalId,
            proposta,
            status: 'pendente'
        });

        await projeto.save();
        
        res.json({ success: true, message: 'Candidatura enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao candidatar time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Projetos de Time
app.get('/api/projetos-time', async (req, res) => {
    try {
        const { cidade, categoria, status = 'aberto' } = req.query;
        
        let query = { status };
        if (categoria) {
            query.categoria = categoria;
        }

        const projetos = await ProjetoTime.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('candidatos.timeLocalId')
            .populate('timeSelecionado')
            .sort({ createdAt: -1 })
            .exec();

        // Filtra por cidade se especificado
        let projetosFiltrados = projetos;
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            projetosFiltrados = projetos.filter(projeto => {
                const cidadeProjeto = projeto.localizacao?.cidade || '';
                return normalizeString(cidadeProjeto).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadeProjeto));
            });
        }

        res.json({ success: true, projetos: projetosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar projetos de time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🚨 NOVO: Rotas de Pedidos Urgentes ("Preciso Agora!")
// Criar Pedido Urgente
// Middleware para tratar erros do multer
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false, 
                message: 'Arquivo muito grande. Tamanho máximo: 500MB por arquivo.' 
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ 
                success: false, 
                message: 'Muitos arquivos. Máximo: 10 arquivos.' 
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: `Erro no upload: ${err.message}` 
        });
    }
    if (err) {
        return res.status(400).json({ 
            success: false, 
            message: err.message || 'Erro ao processar arquivos.' 
        });
    }
    next();
};

app.post('/api/pedidos-urgentes', authMiddleware, upload.array('fotos', 10), handleMulterError, async (req, res) => {
    try {
        console.log('📤 Recebendo pedido urgente:', {
            servico: req.body.servico,
            temFotos: req.files ? req.files.length : 0,
            categoria: req.body.categoria,
            localizacao: req.body.localizacao ? (typeof req.body.localizacao === 'string' ? 'string' : 'object') : 'undefined'
        });
        
        const { servico, descricao, localizacao, categoria, prazoHoras, tipoAtendimento, dataAgendada } = req.body;
        const clienteId = req.user.id;
        
        if (!clienteId) {
            console.error('❌ ClienteId não encontrado');
            return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
        }
        
        console.log('✅ Cliente autenticado:', clienteId);

        // Processa as fotos se foram enviadas
        let fotoUrl = null; // Mantido para compatibilidade (primeira foto)
        let fotosUrls = []; // Array com todas as fotos
        
        if (req.files && Array.isArray(req.files) && req.files.length > 0) {
            try {
                const sharp = getSharp();
                const uploadsDir = path.join(__dirname, '../public/uploads/pedidos-urgentes');
                
                // Garante que o diretório existe
                try {
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                } catch (dirError) {
                    console.error('Erro ao criar diretório de uploads:', dirError);
                    throw new Error('Não foi possível criar o diretório de uploads');
                }

                // Processa fotos em paralelo (mantém ordem original)
                const photoTasks = req.files.map((file, i) => (async () => {
                    try {
                        if (!file) {
                            console.warn(`Arquivo ${i + 1} é null ou undefined`);
                            return null;
                        }

                        if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
                            console.warn(`Arquivo ${i + 1} não tem buffer válido`);
                            return null;
                        }

                        let imageBuffer = file.buffer;

                        // Processa a imagem com Sharp se disponível
                        if (sharp && file.buffer) {
                            try {
                                imageBuffer = await sharp(file.buffer)
                                    .resize(800, 600, { fit: 'cover' })
                                    .toFormat('jpeg', { quality: 90 })
                                    .toBuffer();
                            } catch (sharpError) {
                                console.warn(`Erro ao processar imagem ${i + 1} com Sharp, usando buffer original:`, sharpError.message);
                                imageBuffer = file.buffer; // Usa buffer original se Sharp falhar
                            }
                        }

                        let urlFoto = null;
                        const timestamp = Date.now();
                        const randomStr = Math.random().toString(36).substring(2, 15);
                        const originalName = file.originalname || 'pedido-urgente.jpg';
                        const fileExt = path.extname(originalName) || '.jpg';
                        const baseName = path.basename(originalName, fileExt);
                        const safeBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);

                        // Tenta enviar para o S3 se estiver configurado
                        if (s3Client && bucketName && process.env.AWS_REGION) {
                            try {
                                const key = `pedidos-urgentes/${clienteId}/${timestamp}_${i}_${randomStr}_${safeBaseName}.jpg`;
                                const uploadCommand = new PutObjectCommand({
                                    Bucket: bucketName,
                                    Key: key,
                                    Body: imageBuffer,
                                    ContentType: 'image/jpeg'
                                });
                                await s3Client.send(uploadCommand);
                                urlFoto = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                                console.log(` Foto ${i + 1} enviada para S3: ${key}`);
                            } catch (s3Error) {
                                console.warn(`Falha ao enviar foto ${i + 1} para S3, usando fallback local:`, s3Error.message);
                            }
                        }

                        // Fallback local se não houver S3 ou se o upload falhar
                        if (!urlFoto) {
                            try {
                                const fileName = `${timestamp}_${i}_${randomStr}_${safeBaseName}.jpg`;
                                const filePath = path.join(uploadsDir, fileName);
                                await fs.promises.writeFile(filePath, imageBuffer);
                                urlFoto = `/uploads/pedidos-urgentes/${fileName}`;
                                console.log(` Foto ${i + 1} salva localmente: ${fileName}`);
                            } catch (fsError) {
                                console.error(`Erro ao salvar foto ${i + 1} localmente:`, fsError.message);
                                console.error('Stack:', fsError.stack);
                                return null; // Pula esta foto e continua com as próximas
                            }
                        }

                        return urlFoto ? { index: i, url: urlFoto } : null;
                    } catch (fotoError) {
                        console.error(`Erro ao processar foto ${i + 1} do pedido urgente:`, fotoError);
                        console.error('Stack:', fotoError.stack);
                        return null;
                    }
                })());

                const photoResults = (await Promise.all(photoTasks)).filter(Boolean);
                photoResults.sort((a, b) => a.index - b.index);
                fotosUrls = photoResults.map(item => item.url);
                fotoUrl = fotosUrls[0] || null;
                
                if (fotosUrls.length > 0) {
                    console.log(` ${fotosUrls.length} de ${req.files.length} foto(s) de pedido urgente processada(s) com sucesso`);
                } else {
                    console.warn(' Nenhuma foto foi processada com sucesso, mas o pedido será criado sem fotos');
                }
            } catch (error) {
                console.error('Erro geral ao processar fotos do pedido urgente:', error);
                console.error('Stack:', error.stack);
                // Não bloqueia a criação do pedido se houver erro no processamento de fotos
                // O pedido será criado sem fotos
            }
        }

        // Normaliza tipo de atendimento e data agendada (quando existir)
        const tipoAt = tipoAtendimento === 'agendado' ? 'agendado' : 'urgente';
        let dataAgendadaDate = null;
        if (tipoAt === 'agendado' && dataAgendada) {
            const parsed = new Date(dataAgendada);
            if (!isNaN(parsed.getTime())) {
                dataAgendadaDate = parsed;
            }
        }

        // Define expiração conforme prazo escolhido (padrão: 1h)
        const horasValidas = [1, 2, 5, 9, 12, 24];
        let horas = parseInt(prazoHoras, 10);
        if (isNaN(horas) || !horasValidas.includes(horas)) {
            horas = 1;
        }

        let dataExpiracao = new Date();
        dataExpiracao.setHours(dataExpiracao.getHours() + horas);

        // Para pedidos agendados, a expiração passa a ser a própria data agendada (quando válida)
        if (tipoAt === 'agendado' && dataAgendadaDate) {
            dataExpiracao = dataAgendadaDate;
        }

        // Garante objeto de localização consistente
        let localizacaoObj = localizacao;
        if (typeof localizacao === 'string') {
            try {
                localizacaoObj = JSON.parse(localizacao);
            } catch (e) {
                console.warn('Erro ao fazer parse da localização:', e);
                localizacaoObj = {};
            }
        }
        
        // Valida e normaliza localização
        if (!localizacaoObj || typeof localizacaoObj !== 'object') {
            console.error('Localização inválida recebida:', localizacao);
            return res.status(400).json({ success: false, message: 'A localização é obrigatória e deve ser um objeto válido.' });
        }

        // Validação básica antes de criar o pedido
        if (!servico || typeof servico !== 'string' || !servico.trim()) {
            console.error('Serviço inválido recebido:', servico);
            return res.status(400).json({ success: false, message: 'O serviço é obrigatório.' });
        }

        if (!localizacaoObj.cidade || !localizacaoObj.estado) {
            console.error('Localização incompleta recebida:', localizacaoObj);
            return res.status(400).json({ 
                success: false, 
                message: 'A localização (cidade e estado) é obrigatória.',
                recebido: localizacaoObj
            });
        }

        // Prepara dados do pedido
        const dadosPedido = {
            clienteId,
            servico: servico.trim(),
            descricao: descricao ? descricao.trim() : '',
            foto: fotoUrl, // Mantido para compatibilidade (primeira foto)
            fotos: fotosUrls.length > 0 ? fotosUrls : (fotoUrl ? [fotoUrl] : []), // Array com todas as fotos
            localizacao: localizacaoObj,
            categoria: categoria || 'outros',
            tipoAtendimento: tipoAt,
            prazoHoras: horas,
            dataAgendada: dataAgendadaDate,
            status: 'aberto',
            dataExpiracao
        };
        
        console.log(' Dados do pedido a serem salvos:', {
            servico: dadosPedido.servico,
            temFoto: !!dadosPedido.foto,
            numFotos: dadosPedido.fotos ? dadosPedido.fotos.length : 0,
            categoria: dadosPedido.categoria,
            cidade: dadosPedido.localizacao?.cidade,
            estado: dadosPedido.localizacao?.estado,
            tipoAtendimento: dadosPedido.tipoAtendimento,
            prazoHoras: dadosPedido.prazoHoras,
            temDataExpiracao: !!dadosPedido.dataExpiracao
        });

        let novoPedido;
        try {
            console.log(' Criando instância do PedidoUrgente...');
            novoPedido = new PedidoUrgente(dadosPedido);
            console.log(' Salvando pedido no banco...');
            await novoPedido.save();
            console.log(` Pedido urgente criado com sucesso: ${novoPedido._id} (${fotosUrls.length} foto(s))`);
        } catch (saveError) {
            console.error(' Erro ao salvar pedido urgente no banco:', saveError);
            console.error('Erro completo:', {
                message: saveError.message,
                name: saveError.name,
                code: saveError.code,
                errors: saveError.errors,
                stack: saveError.stack
            });
            
            // Se for erro de validação do Mongoose, retorna mensagem mais específica
            if (saveError.name === 'ValidationError') {
                const validationErrors = Object.values(saveError.errors || {}).map(e => e.message).join(', ');
                throw new Error(`Erro de validação: ${validationErrors}`);
            }
            
            throw new Error(`Erro ao salvar pedido: ${saveError.message || 'Erro desconhecido'}`);
        }

        // Busca profissionais online na região e categoria (case-insensitive, parcial)
        const queryProfissionais = {
            tipo: { $in: ['usuario', 'empresa'] },
            'localizacao.latitude': { $exists: true },
            'localizacao.longitude': { $exists: true },
            disponivelAgora: true // Campo que indica se está online/disponível
        };

        if (categoria) {
            // Usa regex case-insensitive para evitar falhas por capitalização/acentuação
            queryProfissionais.atuacao = { $regex: categoria, $options: 'i' };
        }

        const profissionais = await User.find(queryProfissionais)
            .select('nome foto avatarUrl atuacao cidade estado gamificacao localizacao disponivelAgora telefone')
            .exec();

        // Cria notificações no banco para cada profissional encontrado
        const notificacoesCriadas = (await Promise.all(
            profissionais.map(async (prof) => {
                try {
                    const titulo = 'Pedido urgente próximo a você';
                    let detalhesHorario = '';
                    if (tipoAt === 'agendado' && dataAgendadaDate) {
                        const dataBR = dataAgendadaDate.toLocaleDateString('pt-BR');
                        const horaBR = dataAgendadaDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        detalhesHorario = ` (agendado para ${dataBR} às ${horaBR})`;
                    }
                    const cidadeLocal = localizacaoObj?.cidade || '';
                    const estadoLocal = localizacaoObj?.estado || '';
                    const mensagem = `Um usuário solicitou: ${servico} em ${cidadeLocal} - ${estadoLocal}${detalhesHorario}. Verifique agora.`;
                    const notif = await criarNotificacao(
                        prof._id,
                        'pedido_urgente',
                        titulo,
                        mensagem,
                        { 
                            pedidoId: novoPedido._id,
                            servico,
                            cidade: cidadeLocal,
                            estado: estadoLocal,
                            tipoAtendimento: tipoAt,
                            dataAgendada: dataAgendadaDate
                        }
                    );
                    return notif?._id || null;
                } catch (err) {
                    console.error('Erro ao criar notificação para profissional', prof._id, err);
                    return null;
                }
            })
        )).filter(Boolean);

        // Salva os IDs dos profissionais e das notificações geradas (se precisar rastrear)
        try {
            novoPedido.notificacoesEnviadas = profissionais.map(p => p._id);
            if (notificacoesCriadas.length > 0) {
                novoPedido.notificacoesCriadas = notificacoesCriadas;
            }
            await novoPedido.save();
            console.log(`✅ Pedido atualizado com notificações: ${novoPedido._id}`);
        } catch (updateError) {
            console.error('⚠️ Erro ao atualizar pedido com notificações (não crítico):', updateError);
            // Não bloqueia a resposta se houver erro ao atualizar notificações
        }

        res.status(201).json({ 
            success: true, 
            message: 'Pedido urgente criado! Profissionais foram notificados.',
            pedido: novoPedido,
            profissionaisNotificados: profissionais.length
        });
    } catch (error) {
        console.error('❌ Erro ao criar pedido urgente:', error);
        console.error('Mensagem do erro:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Se a resposta já foi enviada, não tenta enviar novamente
        if (res.headersSent) {
            console.error('⚠️ Resposta já foi enviada, não é possível enviar erro');
            return;
        }

        const errorMessage = process.env.NODE_ENV === 'development'
            ? `Erro ao criar pedido urgente: ${error.message || 'Erro desconhecido'}`
            : 'Erro interno do servidor ao criar pedido urgente.';

        try {
            res.status(500).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? (error.message || String(error)) : undefined
            });
        } catch (responseError) {
            console.error('❌ Erro ao enviar resposta de erro:', responseError);
        }
    }
});

app.get('/api/pedidos-urgentes', authMiddleware, async (req, res) => {
    try {
        const { categoria, q } = req.query;
        const now = new Date();

        const query = {
            status: 'aberto',
            dataExpiracao: { $gt: now }
        };

        if (categoria && String(categoria).trim()) {
            query.categoria = { $regex: String(categoria).trim(), $options: 'i' };
        }

        if (q && String(q).trim()) {
            const qStr = String(q).trim();
            query.$or = [
                { servico: { $regex: qStr, $options: 'i' } },
                { descricao: { $regex: qStr, $options: 'i' } },
                { categoria: { $regex: qStr, $options: 'i' } },
                { 'localizacao.cidade': { $regex: qStr, $options: 'i' } },
                { 'localizacao.estado': { $regex: qStr, $options: 'i' } }
            ];
        }

        const pedidosRaw = await PedidoUrgente.find(query)
            .sort({ createdAt: -1 })
            .lean()
            .exec();

        const pedidos = await Promise.all(
            (pedidosRaw || []).map(async (p) => {
                try {
                    const clienteIdValue = p?.clienteId?._id || p?.clienteId;
                    const clienteIdStr = clienteIdValue ? String(clienteIdValue) : '';
                    if (clienteIdStr && mongoose.Types.ObjectId.isValid(clienteIdStr)) {
                        const cliente = await User.findById(clienteIdStr)
                            .select('_id nome foto avatarUrl cidade estado')
                            .lean();
                        return { ...p, clienteId: cliente || p.clienteId };
                    }
                    return p;
                } catch (_) {
                    return p;
                }
            })
        );

        res.json({ success: true, pedidos, pedidosAtivos: pedidos, pedidosExpirados: [] });
    } catch (error) {
        console.error('Erro ao listar pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/pedidos-urgentes/meus', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const now = new Date();

        const clienteIdObj = mongoose.Types.ObjectId.isValid(clienteId)
            ? new mongoose.Types.ObjectId(clienteId)
            : null;
        const clienteQuery = clienteIdObj ? { $in: [clienteIdObj, clienteId] } : clienteId;

        const pedidosAllRaw = await PedidoUrgente.find({ clienteId: clienteQuery })
            .sort({ updatedAt: -1 })
            .lean()
            .exec();

        const pedidosAll = await Promise.all(
            (pedidosAllRaw || []).map(async (p) => {
                try {
                    const clienteIdValue = p?.clienteId?._id || p?.clienteId;
                    const clienteIdStr = clienteIdValue ? String(clienteIdValue) : '';
                    if (clienteIdStr && mongoose.Types.ObjectId.isValid(clienteIdStr)) {
                        const cliente = await User.findById(clienteIdStr)
                            .select('_id nome foto avatarUrl cidade estado')
                            .lean();
                        return { ...p, clienteId: cliente || p.clienteId };
                    }
                    return p;
                } catch (_) {
                    return p;
                }
            })
        );

        const pedidosAtivos = (pedidosAll || []).filter(p => {
            if (!p || p.status === 'cancelado') return false;
            if (p.status !== 'aberto' && p.status !== 'em_andamento') return false;
            if (p.status === 'aberto' && p.dataExpiracao && new Date(p.dataExpiracao) <= now) return false;
            return true;
        });

        const pedidosExpirados = (pedidosAll || []).filter(p => {
            if (!p || p.status !== 'aberto') return false;
            if (!p.dataExpiracao) return false;
            return new Date(p.dataExpiracao) <= now;
        });

        res.json({ success: true, pedidos: pedidosAtivos, pedidosAtivos, pedidosExpirados });
    } catch (error) {
        console.error('Erro ao listar meus pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.post('/api/pedidos-urgentes/:pedidoId/proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { valor, tempoChegada, observacoes } = req.body;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
        }

        if (pedido.clienteId && pedido.clienteId.toString() === profissionalId) {
            return res.status(400).json({ success: false, message: 'Você não pode enviar proposta para um pedido criado por você.' });
        }

        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este pedido não está mais aceitando propostas.' });
        }

        if (pedido.dataExpiracao && new Date() > new Date(pedido.dataExpiracao)) {
            return res.status(400).json({ success: false, message: 'Este pedido expirou.' });
        }

        if (!Array.isArray(pedido.propostas)) {
            pedido.propostas = [];
        }

        let propostaIdParaNotificacao = null;
        const propostaExistente = pedido.propostas.find(p => (p?.profissionalId || '').toString() === profissionalId);
        if (propostaExistente) {
            if (propostaExistente.status === 'rejeitada' || propostaExistente.status === 'cancelada') {
                propostaExistente.valor = valor;
                propostaExistente.tempoChegada = tempoChegada;
                propostaExistente.observacoes = observacoes;
                propostaExistente.status = 'pendente';
                propostaExistente.dataProposta = new Date();
                propostaIdParaNotificacao = propostaExistente._id || propostaExistente.profissionalId;
            } else {
                return res.status(400).json({ success: false, message: 'Você já enviou uma proposta para este pedido.' });
            }
        } else {
            const novaPropostaId = new mongoose.Types.ObjectId();
            pedido.propostas.push({
                _id: novaPropostaId,
                profissionalId: mongoose.Types.ObjectId.isValid(profissionalId)
                    ? new mongoose.Types.ObjectId(profissionalId)
                    : profissionalId,
                valor,
                tempoChegada,
                observacoes,
                status: 'pendente',
                dataProposta: new Date()
            });
            propostaIdParaNotificacao = novaPropostaId;
        }

        pedido.markModified('propostas');
        await pedido.save();
        await PedidoUrgente.updateOne(
            { _id: pedido._id },
            { $set: { propostas: pedido.propostas } }
        );

        try {
            const clienteIdFinal = pedido.clienteId?._id || pedido.clienteId;
            if (clienteIdFinal) {
                await criarNotificacao(
                    clienteIdFinal,
                    'proposta_pedido_urgente',
                    'Nova proposta recebida!',
                    `${profissional.nome} enviou uma proposta de R$ ${Number(valor || 0).toFixed(2)} para seu pedido: ${pedido.servico}`,
                    {
                        pedidoId: pedido._id,
                        propostaId: propostaIdParaNotificacao,
                        profissionalId: profissionalId,
                        servico: pedido.servico
                    },
                    `#modal-propostas`
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta:', notifError);
        }

        res.json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/pedidos-urgentes/:pedidoId/propostas', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(pedidoId)) {
            return res.status(400).json({ success: false, message: 'ID inválido.' });
        }

        const pedido = await PedidoUrgente.findById(pedidoId).lean().exec();
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        let clientePopulado = pedido.clienteId;
        try {
            const clienteIdValue = pedido?.clienteId?._id || pedido?.clienteId;
            const clienteIdStr = clienteIdValue ? String(clienteIdValue) : '';
            if (clienteIdStr && mongoose.Types.ObjectId.isValid(clienteIdStr)) {
                const cliente = await User.findById(clienteIdStr)
                    .select('_id nome foto avatarUrl cidade estado telefone')
                    .lean();
                clientePopulado = cliente || pedido.clienteId;
            }
        } catch (_) {
            clientePopulado = pedido.clienteId;
        }

        const propostasFormatadas = await Promise.all((pedido.propostas || []).map(async (prop) => {
            const profissionalIdFinal = prop.profissionalId?._id || prop.profissionalId;
            const propostaIdFinal = prop._id || profissionalIdFinal;
            let profissionalPopulado = prop.profissional || prop.profissionalId;

            try {
                const profIdStr = profissionalIdFinal ? String(profissionalIdFinal) : '';
                if (profIdStr && mongoose.Types.ObjectId.isValid(profIdStr)) {
                    const profissional = await User.findById(profIdStr)
                        .select('_id nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes telefone')
                        .lean();
                    profissionalPopulado = profissional || profissionalPopulado;
                }
            } catch (_) {
                profissionalPopulado = prop.profissional || prop.profissionalId;
            }

            return {
                _id: propostaIdFinal,
                profissionalId: profissionalPopulado,
                usuarioId: profissionalIdFinal,
                valor: prop.valor,
                tempoChegada: prop.tempoChegada,
                observacoes: prop.observacoes,
                status: prop.status,
                dataProposta: prop.dataProposta,
                profissional: profissionalPopulado
            };
        }));

        res.json({
            success: true,
            pedido: {
                _id: pedido._id,
                servico: pedido.servico,
                descricao: pedido.descricao,
                foto: pedido.foto,
                fotos: pedido.fotos || (pedido.foto ? [pedido.foto] : []),
                localizacao: pedido.localizacao,
                categoria: pedido.categoria,
                clienteId: clientePopulado,
                propostaSelecionada: pedido.propostaSelecionada,
                status: pedido.status,
                createdAt: pedido.createdAt,
                dataExpiracao: pedido.dataExpiracao
            },
            propostas: propostasFormatadas
        });
    } catch (error) {
        console.error('Erro ao carregar propostas do pedido urgente:', error);
        return res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/pedidos-urgentes/:pedidoId', authMiddleware, async (req, res, next) => {
    try {
        const { pedidoId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(pedidoId)) {
            return next();
        }

        const pedido = await PedidoUrgente.findById(pedidoId).lean().exec();
        if (!pedido) {
            return res.json({ success: false, message: 'Pedido não encontrado.', pedido: null });
        }

        let clientePopulado = pedido.clienteId;
        try {
            const clienteIdValue = pedido?.clienteId?._id || pedido?.clienteId;
            const clienteIdStr = clienteIdValue ? String(clienteIdValue) : '';
            if (clienteIdStr && mongoose.Types.ObjectId.isValid(clienteIdStr)) {
                const cliente = await User.findById(clienteIdStr)
                    .select('_id nome foto avatarUrl cidade estado')
                    .lean();
                clientePopulado = cliente || pedido.clienteId;
            }
        } catch (_) {
            clientePopulado = pedido.clienteId;
        }

        const propostasFormatadas = await Promise.all((pedido.propostas || []).map(async (prop) => {
            const profissionalIdFinal = prop.profissionalId?._id || prop.profissionalId;
            const propostaIdFinal = prop._id || profissionalIdFinal;
            let profissionalPopulado = prop.profissionalId;

            try {
                const profIdStr = profissionalIdFinal ? String(profissionalIdFinal) : '';
                if (profIdStr && mongoose.Types.ObjectId.isValid(profIdStr)) {
                    const profissional = await User.findById(profIdStr)
                        .select('_id nome foto avatarUrl atuacao cidade estado')
                        .lean();
                    profissionalPopulado = profissional || profissionalPopulado;
                }
            } catch (_) {
                profissionalPopulado = prop.profissionalId;
            }

            return {
                _id: propostaIdFinal,
                profissionalId: profissionalIdFinal,
                usuarioId: profissionalIdFinal,
                valor: prop.valor,
                tempoChegada: prop.tempoChegada,
                observacoes: prop.observacoes,
                status: prop.status,
                dataProposta: prop.dataProposta,
                profissional: profissionalPopulado
            };
        }));

        res.json({
            success: true,
            pedido: {
                _id: pedido._id,
                servico: pedido.servico,
                descricao: pedido.descricao,
                foto: pedido.foto,
                fotos: pedido.fotos || (pedido.foto ? [pedido.foto] : []),
                localizacao: pedido.localizacao,
                categoria: pedido.categoria,
                clienteId: clientePopulado,
                propostas: propostasFormatadas,
                propostaSelecionada: pedido.propostaSelecionada,
                status: pedido.status,
                createdAt: pedido.createdAt,
                dataExpiracao: pedido.dataExpiracao
            }
        });
    } catch (error) {
        console.error('Erro ao buscar pedido urgente:', error);
        return res.json({ success: false, message: 'Erro interno do servidor.', pedido: null });
    }
});

// Aceitar Proposta de um Pedido Urgente (cliente)
app.post('/api/pedidos-urgentes/:pedidoId/aceitar-proposta/:propostaId', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { propostaId } = req.params;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o criador do pedido pode aceitar propostas.' });
        }

        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este pedido não está mais aceitando propostas.' });
        }

        const propostas = Array.isArray(pedido.propostas) ? pedido.propostas : [];
        const propostaIndex = propostas.findIndex(p =>
            (p?._id || '').toString() === propostaId ||
            (p?.profissionalId || '').toString() === propostaId
        );
        const proposta = propostaIndex >= 0 ? propostas[propostaIndex] : null;
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }

        if (proposta.status && proposta.status !== 'pendente') {
            return res.status(400).json({ success: false, message: 'Esta proposta não está mais pendente.' });
        }

        const propostaIdFinal = proposta._id || new mongoose.Types.ObjectId();
        const setUpdate = {
            [`propostas.${propostaIndex}.status`]: 'aceita',
            status: 'em_andamento',
            propostaSelecionada: propostaIdFinal
        };
        if (!proposta._id) {
            setUpdate[`propostas.${propostaIndex}._id`] = propostaIdFinal;
        }
        await PedidoUrgente.updateOne(
            { _id: pedido._id },
            { $set: setUpdate }
        );

        // Notifica o profissional sobre a aceitação da proposta
        try {
            const profissionalIdFinal = proposta.profissionalId?._id || proposta.profissionalId;
            const profissional = profissionalIdFinal ? await User.findById(profissionalIdFinal) : null;
            if (profissional) {
                const titulo = 'Proposta aceita!';
                const mensagem = `O cliente aceitou sua proposta de R$ ${proposta.valor.toFixed(2)} para o pedido: ${pedido.servico}`;
                await criarNotificacao(
                    profissional._id,
                    'proposta_aceita',
                    titulo,
                    mensagem,
                    { 
                        pedidoId: pedido._id,
                        propostaId: propostaIdFinal,
                        servico: pedido.servico
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de aceitação de proposta:', notifError);
        }

        res.json({ success: true, message: 'Proposta aceita com sucesso!' });
    } catch (error) {
        console.error('Erro ao aceitar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar serviços ativos de pedidos urgentes para o profissional (propostas aceitas)
app.get('/api/pedidos-urgentes/ativos', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Busca pedidos onde o profissional tem proposta aceita (status aceita, aceito ou em_andamento)
        // E o pedido não está cancelado ou concluído
        // Usa $elemMatch para garantir que a mesma proposta tenha o profissionalId correto E status aceito
        const profissionalIdObj = mongoose.Types.ObjectId.isValid(profissionalId)
            ? new mongoose.Types.ObjectId(profissionalId)
            : null;
        const profissionalIdQuery = profissionalIdObj
            ? { $in: [profissionalIdObj, profissionalId] }
            : profissionalId;

        const pedidos = await PedidoUrgente.find({
            status: { $in: ['aberto', 'em_andamento'] },
            propostas: {
                $elemMatch: {
                    profissionalId: profissionalIdQuery,
                    status: { $in: ['aceita', 'aceito', 'em_andamento'] }
                }
            }
        })
            .populate('clienteId', '_id nome foto avatarUrl cidade estado telefone')
            .populate('propostas.profissionalId', '_id nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .sort({ updatedAt: -1 })
            .exec();

        // Filtra apenas pedidos onde realmente tem proposta aceita do profissional
        // E que não estão cancelados ou concluídos
        const pedidosFiltrados = pedidos.filter(pedido => {
            // Não retorna pedidos cancelados ou concluídos
            if (pedido.status === 'cancelado' || pedido.status === 'concluido') {
                return false;
            }
            
            // Verifica se o profissional tem proposta aceita neste pedido
            const temPropostaAceita = pedido.propostas.some(prop => {
                // Tenta diferentes formas de acessar o profissionalId
                let propProfId = null;
                if (prop.profissionalId) {
                    if (typeof prop.profissionalId === 'object') {
                        propProfId = prop.profissionalId._id?.toString() || prop.profissionalId.id?.toString() || prop.profissionalId.toString();
                    } else {
                        propProfId = String(prop.profissionalId);
                    }
                }
                const statusAceito = prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento';
                const ehMeuProfissional = propProfId && String(propProfId) === String(profissionalId);
                return ehMeuProfissional && statusAceito;
            });
            
            if (temPropostaAceita) {
                console.log(`✅ Pedido ${pedido._id} tem proposta aceita do profissional ${profissionalId}`);
            }
            
            return temPropostaAceita;
        });

        console.log(`📦 API /api/pedidos-urgentes/ativos - Profissional ${profissionalId}: ${pedidosFiltrados.length} pedidos encontrados`);

        res.json({ success: true, pedidos: pedidosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar serviços ativos de pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar pedidos arquivados (cancelados/concluídos) onde o profissional teve proposta aceita
app.get('/api/pedidos-urgentes/arquivados-profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Busca pedidos cancelados ou concluídos onde o profissional tem proposta aceita
        const profissionalIdObj = mongoose.Types.ObjectId.isValid(profissionalId)
            ? new mongoose.Types.ObjectId(profissionalId)
            : null;
        const profissionalIdQuery = profissionalIdObj
            ? { $in: [profissionalIdObj, profissionalId] }
            : profissionalId;

        const pedidos = await PedidoUrgente.find({
            status: { $in: ['cancelado', 'concluido'] },
            propostas: {
                $elemMatch: {
                    profissionalId: profissionalIdQuery,
                    status: { $in: ['aceita', 'aceito', 'em_andamento'] }
                }
            }
        })
            .populate('clienteId', '_id nome foto avatarUrl cidade estado telefone')
            .populate('propostas.profissionalId', '_id nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .sort({ updatedAt: -1 })
            .exec();

        // Filtra apenas pedidos onde realmente tem proposta aceita do profissional
        const pedidosFiltrados = pedidos.filter(pedido => {
            return pedido.propostas.some(prop => {
                const propProfId = prop.profissionalId?._id?.toString() || prop.profissionalId?.toString() || prop.profissionalId;
                return propProfId === profissionalId.toString() && 
                       (prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento');
            });
        });

        console.log(`📦 API /api/pedidos-urgentes/arquivados-profissional - Profissional ${profissionalId}: ${pedidosFiltrados.length} pedidos encontrados`);

        res.json({ success: true, pedidos: pedidosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar pedidos arquivados do profissional:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cliente marca serviço de pedido urgente como concluído
app.post('/api/pedidos-urgentes/:pedidoId/concluir-servico', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.status !== 'em_andamento') {
            return res.status(400).json({ success: false, message: 'Somente serviços em andamento podem ser concluídos.' });
        }

        // Verifica se o usuário é o criador do pedido (cliente)
        const clienteId = pedido.clienteId.toString();
        if (userId !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o criador do serviço pode marcá-lo como concluído.' });
        }

        // Verifica se tem proposta aceita
        const propostaAceita = (pedido.propostas || []).find(p =>
            (p?._id || '').toString() === String(pedido.propostaSelecionada)
        );
        if (!propostaAceita) {
            // Tenta encontrar por status
            const propostaAceitaPorStatus = pedido.propostas.find(p => 
                p.status === 'aceita' || p.status === 'aceito' || p.status === 'em_andamento'
            );
            if (!propostaAceitaPorStatus) {
                return res.status(400).json({ success: false, message: 'Este pedido não tem proposta aceita.' });
            }
        }

        // Marca pedido como concluído
        pedido.status = 'concluido';
        await pedido.save();

        // Marca agendamento (se existir) como concluído
        if (pedido.agendamentoId) {
            await Agendamento.findByIdAndUpdate(pedido.agendamentoId, { status: 'concluido' });
        }

        // Notifica o profissional que o serviço foi concluído (para avaliar)
        try {
            const propostaAceitaFinal = propostaAceita || pedido.propostas.find(p => 
                p.status === 'aceita' || p.status === 'aceito' || p.status === 'em_andamento'
            );
            if (propostaAceitaFinal && propostaAceitaFinal.profissionalId) {
                const titulo = 'Serviço concluído! Conte como foi 🙂';
                const mensagem = `O cliente concluiu o serviço: ${pedido.servico}. Deixe sua avaliação para ajudar a comunidade.`;
                await criarNotificacao(
                    propostaAceitaFinal.profissionalId,
                    'servico_concluido',
                    titulo,
                    mensagem,
                    {
                        clienteId: pedido.clienteId,
                        agendamentoId: pedido.agendamentoId || null,
                        pedidoId: pedido._id,
                        foto: pedido.foto || null
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de serviço concluído:', notifError);
        }

        res.json({ success: true, message: 'Serviço marcado como concluído.' });
    } catch (error) {
        console.error('Erro ao concluir serviço de pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar agendamentos do cliente
app.get('/api/agenda/cliente', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const agendamentos = await Agendamento.find({ clienteId })
            .populate('profissionalId', 'nome foto avatarUrl telefone atuacao')
            .sort({ dataHora: 1 })
            .exec();
        
        res.json({ success: true, agendamentos });
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Atualizar status do agendamento
app.put('/api/agenda/:agendamentoId/status', authMiddleware, async (req, res) => {
    try {
        const { agendamentoId } = req.params;
        const { status } = req.body;
        const userId = req.user.id;
        
        const agendamento = await Agendamento.findById(agendamentoId);
        if (!agendamento) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado.' });
        }
        
        // Verifica se é o profissional ou cliente
        if (agendamento.profissionalId.toString() !== userId && agendamento.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        agendamento.status = status;
        await agendamento.save();
        
        res.json({ success: true, message: 'Status atualizado com sucesso!', agendamento });
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Equipes Verificadas
// Criar Equipe Verificada
app.post('/api/equipes', authMiddleware, async (req, res) => {
    try {
        const { nome, descricao } = req.body;
        const liderId = req.user.id;
        
        const lider = await User.findById(liderId);
        if (!lider) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const novaEquipe = new EquipeVerificada({
            liderId,
            nome,
            descricao,
            membros: [{
                profissionalId: liderId,
                funcao: lider.atuacao || 'Líder',
                status: 'aceito'
            }],
            xpTotal: lider.gamificacao?.xp || 0,
            nivelEquipe: 1
        });
        
        await novaEquipe.save();
        
        res.status(201).json({ success: true, message: 'Equipe criada com sucesso!', equipe: novaEquipe });
    } catch (error) {
        console.error('Erro ao criar equipe:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Convidar membro para equipe
app.post('/api/equipes/:equipeId/convidar', authMiddleware, async (req, res) => {
    try {
        const { equipeId } = req.params;
        const { profissionalId, funcao } = req.body;
        const liderId = req.user.id;
        
        const equipe = await EquipeVerificada.findById(equipeId);
        if (!equipe) {
            return res.status(404).json({ success: false, message: 'Equipe não encontrada.' });
        }
        
        if (equipe.liderId.toString() !== liderId) {
            return res.status(403).json({ success: false, message: 'Apenas o líder pode convidar membros.' });
        }
        
        // Verifica se já é membro
        const jaMembro = equipe.membros.some(
            m => m.profissionalId.toString() === profissionalId
        );
        
        if (jaMembro) {
            return res.status(400).json({ success: false, message: 'Este profissional já é membro da equipe.' });
        }
        
        equipe.membros.push({
            profissionalId,
            funcao: funcao || 'Membro',
            status: 'pendente'
        });
        
        await equipe.save();
        
        res.json({ success: true, message: 'Convite enviado com sucesso!' });
    } catch (error) {
        console.error('Erro ao convidar membro:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar/Recusar convite
app.put('/api/equipes/:equipeId/convite/:membroId', authMiddleware, async (req, res) => {
    try {
        const { equipeId, membroId } = req.params;
        const { acao } = req.body; // 'aceitar' ou 'recusar'
        const profissionalId = req.user.id;
        
        const equipe = await EquipeVerificada.findById(equipeId);
        if (!equipe) {
            return res.status(404).json({ success: false, message: 'Equipe não encontrada.' });
        }
        
        const membro = equipe.membros.id(membroId);
        if (!membro || membro.profissionalId.toString() !== profissionalId) {
            return res.status(403).json({ success: false, message: 'Convite não encontrado.' });
        }
        
        if (acao === 'aceitar') {
            membro.status = 'aceito';
            // Atualiza XP total da equipe
            const membrosAceitos = equipe.membros.filter(m => m.status === 'aceito');
            const membrosIds = membrosAceitos.map(m => m.profissionalId);
            const membros = await User.find({ _id: { $in: membrosIds } });
            equipe.xpTotal = membros.reduce((sum, m) => sum + (m.gamificacao?.xp || 0), 0);
        } else {
            membro.status = 'recusado';
        }
        
        await equipe.save();
        
        res.json({ success: true, message: `Convite ${acao === 'aceitar' ? 'aceito' : 'recusado'} com sucesso!` });
    } catch (error) {
        console.error('Erro ao processar convite:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar equipes
app.get('/api/equipes', authMiddleware, async (req, res) => {
    try {
        const { cidade } = req.query;
        
        let query = {};
        if (cidade) {
            // Busca equipes com membros da cidade
            const usuariosCidade = await User.find({ cidade }).select('_id');
            const idsUsuarios = usuariosCidade.map(u => u._id);
            query = { 'membros.profissionalId': { $in: idsUsuarios } };
        }
        
        const equipes = await EquipeVerificada.find(query)
            .populate('liderId', 'nome foto avatarUrl atuacao cidade estado gamificacao')
            .populate('membros.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ xpTotal: -1, nivelEquipe: -1 })
            .exec();
        
        res.json({ success: true, equipes });
    } catch (error) {
        console.error('Erro ao buscar equipes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});


// Rotas de Pagamento Seguro REMOVIDAS - funcionalidade descontinuada
// As rotas abaixo foram removidas:
// - POST /api/pagamento-seguro
// - POST /api/pagamento-seguro/:pagamentoId/liberar
// - POST /api/pagamento-seguro/:pagamentoId/reembolsar
// - GET /api/pagamento-seguro/profissional
// - GET /api/pagamento-seguro/cliente
// - GET /api/pagamento-seguro/verificar/:tipoServico/:servicoId

// Rota removida - funcionalidade descontinuada
app.post('/api/pagamento-seguro', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// Rota removida - funcionalidade descontinuada
app.post('/api/pagamento-seguro/:pagamentoId/liberar', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// Rota removida - funcionalidade descontinuada
app.post('/api/pagamento-seguro/:pagamentoId/reembolsar', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// Rota removida - funcionalidade descontinuada
app.get('/api/pagamento-seguro/profissional', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// Rota removida - funcionalidade descontinuada
app.get('/api/pagamento-seguro/cliente', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// Rota removida - funcionalidade descontinuada
app.get('/api/pagamento-seguro/verificar/:tipoServico/:servicoId', authMiddleware, async (req, res) => {
    return res.status(410).json({ success: false, message: 'Funcionalidade de pagamentos garantidos foi descontinuada.' });
});

// 🔔 NOVO: Rotas de Notificações
// Listar notificações do usuário
app.get('/api/notificacoes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { lida, limit = 50, marcarComoLidas } = req.query;
        
        let query = { userId };
        if (lida !== undefined) {
            query.lida = lida === 'true';
        }
        
        let notificacoes = await Notificacao.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .exec();
        
        // ✅ Opcional: marcar como lidas SOMENTE quando o frontend pedir explicitamente.
        // Importante: não marcar por padrão, senão o polling do badge "consome" as não-lidas.
        // Use: /api/notificacoes?marcarComoLidas=true
        const deveMarcarComoLidas =
            marcarComoLidas === 'true' &&
            (lida === undefined || lida === 'false');

        if (deveMarcarComoLidas) {
            const agora = new Date();

            await Notificacao.updateMany(
                { userId, lida: false },
                { $set: { lida: true, dataLeitura: agora } }
            );

            // Mantém o payload consistente com o que foi persistido
            for (const n of notificacoes) {
                if (n && n.lida === false) {
                    n.lida = true;
                    n.dataLeitura = agora;
                }
            }
        }

        // Remove notificações ligadas a posts com expiração vencida (vídeos/status 24h)
        try {
            const agora = new Date();
            const TIPOS_POST = new Set([
                'post_curtido',
                'post_comentado',
                'comentario_respondido',
                'comentario_curtido',
                'resposta_curtida'
            ]);
            const filtradas = [];
            for (const n of notificacoes) {
                const postId = n?.dadosAdicionais?.postId;
                const tipo = n?.tipo;
                if (postId && TIPOS_POST.has(tipo)) {
                    const post = await Postagem.findById(postId).select('expiresAt').lean();
                    if (post?.expiresAt && new Date(post.expiresAt) < agora) {
                        try {
                            await Notificacao.deleteOne({ _id: n._id });
                        } catch (delErr) {
                            console.error('Erro ao deletar notificação expirada:', delErr);
                        }
                        continue; // não inclui na resposta
                    }
                }
                filtradas.push(n);
            }
            notificacoes = filtradas;
        } catch (expErr) {
            console.error('Erro ao filtrar notificações expiradas:', expErr);
        }

        const naoLidas = await Notificacao.countDocuments({ userId, lida: false });
        
        res.json({ 
            success: true, 
            notificacoes,
            totalNaoLidas: naoLidas
        });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Marcar notificação como lida
app.put('/api/notificacoes/:notificacaoId/lida', authMiddleware, async (req, res) => {
    try {
        const { notificacaoId } = req.params;
        const userId = req.user.id;
        
        const notificacao = await Notificacao.findById(notificacaoId);
        if (!notificacao || notificacao.userId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Notificação não encontrada.' });
        }
        
        notificacao.lida = true;
        notificacao.dataLeitura = new Date();
        await notificacao.save();
        
        res.json({ success: true, notificacao });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Marcar todas as notificações como lidas
app.put('/api/notificacoes/marcar-todas-lidas', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        await Notificacao.updateMany(
            { userId, lida: false },
            { lida: true, dataLeitura: new Date() }
        );
        
        res.json({ success: true, message: 'Todas as notificações foram marcadas como lidas.' });
    } catch (error) {
        console.error('Erro ao marcar notificações como lidas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Deletar todas as notificações do usuário
app.delete('/api/notificacoes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { ids } = req.body; // Array de IDs para deletar específicas
        
        let query = { userId };
        if (ids && Array.isArray(ids) && ids.length > 0) {
            // Deleta apenas as notificações especificadas
            query._id = { $in: ids };
        }
        // Se não passar ids, deleta todas
        
        const resultado = await Notificacao.deleteMany(query);
        
        res.json({ 
            success: true, 
            message: ids && ids.length > 0 ? 'Notificações selecionadas foram deletadas.' : 'Todas as notificações foram deletadas.',
            deletadas: resultado.deletedCount
        });
    } catch (error) {
        console.error('Erro ao deletar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ⚖️ NOVO: Rotas de Disputas
// Criar disputa
app.post('/api/disputas', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId, tipo, motivo, evidencias } = req.body;
        const criadorId = req.user.id;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Verifica se o usuário tem direito de criar disputa
        const podeCriarDisputa = pagamento.clienteId.toString() === criadorId || 
                                 pagamento.profissionalId.toString() === criadorId;
        if (!podeCriarDisputa) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        // Verifica se já existe disputa aberta
        const disputaExistente = await Disputa.findOne({ 
            pagamentoId, 
            status: { $in: ['aberta', 'em_analise'] } 
        });
        if (disputaExistente) {
            return res.status(400).json({ success: false, message: 'Já existe uma disputa aberta para este pagamento.' });
        }
        
        // Só pode criar disputa se pagamento está pago mas não liberado
        if (pagamento.status !== 'pago') {
            return res.status(400).json({ success: false, message: 'Apenas pagamentos garantidos podem ter disputas.' });
        }
        
        const disputa = new Disputa({
            pagamentoId,
            criadorId,
            tipo,
            motivo,
            evidencias: evidencias || []
        });
        
        await disputa.save();
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamentoId,
            'disputa_aberta',
            criadorId,
            {},
            { disputaId: disputa._id, tipo, motivo },
            req
        );
        
        // 🔔 Notifica ambos os usuários sobre a disputa
        const outroUsuario = pagamento.clienteId.toString() === criadorId ? 
                           pagamento.profissionalId : pagamento.clienteId;
        
        await criarNotificacao(
            outroUsuario,
            'disputa_aberta',
            '⚖️ Disputa Aberta',
            `Uma disputa foi aberta para o pagamento de R$ ${pagamento.valor.toFixed(2)}. Nossa equipe analisará o caso.`,
            { disputaId: disputa._id, pagamentoId: pagamentoId },
            null
        );

        res.json({ success: true, disputa });
    } catch (error) {
        console.error('Erro ao criar disputa:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar disputas do usuário
app.get('/api/disputas', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Busca disputas onde o usuário é cliente ou profissional do pagamento
        const pagamentos = await PagamentoSeguro.find({
            $or: [{ clienteId: userId }, { profissionalId: userId }]
        }).select('_id');

        const pagamentoIds = pagamentos.map(p => p._id);

        const disputas = await Disputa.find({ pagamentoId: { $in: pagamentoIds } })
            .populate('pagamentoId')
            .populate('criadorId', 'nome foto avatarUrl')
            .populate('resolvidoPor', 'nome')
            .sort({ createdAt: -1 })
            .exec();

        res.json({ success: true, disputas });
    } catch (error) {
        console.error('Erro ao buscar disputas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Resolver disputa (apenas admin)
app.post('/api/disputas/:disputaId/resolver', authMiddleware, async (req, res) => {
    try {
        const { disputaId } = req.params;
        const { resolucao, favoravelA } = req.body; // 'cliente' ou 'profissional'
        const adminId = req.user.id;
        
        // Verificar se usuário é admin
        const user = await User.findById(adminId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Apenas administradores podem resolver disputas.' });
        }
        
        const disputa = await Disputa.findById(disputaId)
            .populate('pagamentoId');
        
        if (!disputa) {
            return res.status(404).json({ success: false, message: 'Disputa não encontrada.' });
        }
        
        if (disputa.status !== 'aberta' && disputa.status !== 'em_analise') {
            return res.status(400).json({ success: false, message: 'Esta disputa já foi resolvida.' });
        }
        
        const pagamento = disputa.pagamentoId;
        
        // Resolve a disputa
        disputa.status = favoravelA === 'cliente' ? 'resolvida_cliente' : 'resolvida_profissional';
        disputa.resolucao = resolucao;
        disputa.resolvidoPor = adminId;
        disputa.dataResolucao = new Date();
        await disputa.save();
        
        // Atualiza pagamento baseado na resolução
        if (favoravelA === 'cliente') {
            // Reembolsa o cliente
            pagamento.status = 'reembolsado';
            await pagamento.save();
        } else {
            // Libera para o profissional
            pagamento.status = 'liberado';
            pagamento.dataLiberacao = new Date();
            await pagamento.save();
        }
        
        // 📊 Registra histórico
        await registrarHistoricoTransacao(
            pagamento._id,
            'disputa_resolvida',
            adminId,
            { status: 'pago' },
            { status: pagamento.status, resolucao },
            req
        );
        
        // 🔔 Notifica ambos os usuários
        await criarNotificacao(
            pagamento.clienteId,
            'disputa_resolvida',
            '⚖️ Disputa Resolvida',
            `A disputa foi resolvida. ${resolucao}`,
            { disputaId: disputa._id, pagamentoId: pagamento._id },
            '/disputas'
        );
        
        await criarNotificacao(
            pagamento.profissionalId,
            'disputa_resolvida',
            '⚖️ Disputa Resolvida',
            `A disputa foi resolvida. ${resolucao}`,
            { disputaId: disputa._id, pagamentoId: pagamento._id },
            '/disputas'
        );
        
        res.json({ success: true, message: 'Disputa resolvida com sucesso!', disputa, pagamento });
    } catch (error) {
        console.error('Erro ao resolver disputa:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📊 NOVO: Rotas de Histórico de Transações
// Obter histórico de um pagamento
app.get('/api/pagamento-seguro/:pagamentoId/historico', authMiddleware, async (req, res) => {
    try {
        const { pagamentoId } = req.params;
        const userId = req.user.id;
        
        const pagamento = await PagamentoSeguro.findById(pagamentoId);
        if (!pagamento) {
            return res.status(404).json({ success: false, message: 'Pagamento não encontrado.' });
        }
        
        // Verifica acesso
        if (pagamento.clienteId.toString() !== userId && pagamento.profissionalId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const historico = await HistoricoTransacao.find({ pagamentoId })
            .populate('realizadoPor', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, historico });
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 📈 NOVO: Dashboard Administrativo
app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id;
        
        // Verificar se usuário é admin
        const user = await User.findById(adminId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Acesso negado. Apenas administradores podem acessar o dashboard.' });
        }
        
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioAno = new Date(hoje.getFullYear(), 0, 1);
        
        // Estatísticas de pagamentos
        const [
            totalPagamentos,
            pagamentosMes,
            pagamentosAno,
            pagamentosPendentes,
            pagamentosLiberados,
            pagamentosReembolsados,
            totalReceitaMes,
            totalReceitaAno,
            disputasAbertas,
            disputasResolvidasMes
        ] = await Promise.all([
            PagamentoSeguro.countDocuments(),
            PagamentoSeguro.countDocuments({ createdAt: { $gte: inicioMes } }),
            PagamentoSeguro.countDocuments({ createdAt: { $gte: inicioAno } }),
            PagamentoSeguro.countDocuments({ status: 'pago' }),
            PagamentoSeguro.countDocuments({ status: 'liberado' }),
            PagamentoSeguro.countDocuments({ status: 'reembolsado' }),
            PagamentoSeguro.aggregate([
                { $match: { status: 'liberado', dataLiberacao: { $gte: inicioMes } } },
                { $group: { _id: null, total: { $sum: '$taxaPlataforma' } } }
            ]),
            PagamentoSeguro.aggregate([
                { $match: { status: 'liberado', dataLiberacao: { $gte: inicioAno } } },
                { $group: { _id: null, total: { $sum: '$taxaPlataforma' } } }
            ]),
            Disputa.countDocuments({ status: { $in: ['aberta', 'em_analise'] } }),
            Disputa.countDocuments({ status: { $in: ['resolvida_cliente', 'resolvida_profissional'] }, dataResolucao: { $gte: inicioMes } })
        ]);
        
        // Pagamentos recentes
        const pagamentosRecentes = await PagamentoSeguro.find()
            .populate('clienteId', 'nome foto avatarUrl')
            .populate('profissionalId', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .limit(10)
            .exec();
        
        // Disputas recentes
        const disputasRecentes = await Disputa.find()
            .populate('pagamentoId')
            .populate('criadorId', 'nome foto avatarUrl')
            .sort({ createdAt: -1 })
            .limit(10)
            .exec();
        
        res.json({
            success: true,
            dashboard: {
                estatisticas: {
                    totalPagamentos,
                    pagamentosMes,
                    pagamentosAno,
                    pagamentosPendentes,
                    pagamentosLiberados,
                    pagamentosReembolsados,
                    receitaMes: totalReceitaMes[0]?.total || 0,
                    receitaAno: totalReceitaAno[0]?.total || 0,
                    disputasAbertas,
                    disputasResolvidasMes
                },
                pagamentosRecentes,
                disputasRecentes
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dashboard:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/admin/moderation-logs', authMiddleware, async (req, res) => {
    try {
        const adminId = req.user.id;
        const user = await User.findById(adminId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ success: false, message: 'Apenas administradores podem acessar os logs.' });
        }

        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
        const filtroUserId = req.query.userId ? String(req.query.userId) : null;
        const filtroMotivo = req.query.motivo ? String(req.query.motivo) : null;

        const query = {};
        if (filtroUserId) query.userId = filtroUserId;
        if (filtroMotivo) query.motivo = filtroMotivo;

        const logs = await ModerationLog.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'nome email tipo')
            .lean();

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Erro ao buscar logs de moderação:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rotas de Mural de Oportunidades
// Criar oportunidade
app.post('/api/oportunidades', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, categoria, orcamento, prazo, localizacao } = req.body;
        const clienteId = req.user.id;
        
        const oportunidade = new Oportunidade({
            clienteId,
            titulo,
            descricao,
            categoria,
            orcamento,
            prazo: new Date(prazo),
            localizacao,
            status: 'aberta'
        });
        
        await oportunidade.save();
        
        res.status(201).json({ success: true, message: 'Oportunidade criada com sucesso!', oportunidade });
    } catch (error) {
        console.error('Erro ao criar oportunidade:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar oportunidades (filtro por categoria e cidade)
app.get('/api/oportunidades', authMiddleware, async (req, res) => {
    try {
        const { categoria, cidade, status = 'aberta' } = req.query;
        
        let query = { status };
        if (categoria) {
            query.categoria = { $regex: categoria, $options: 'i' };
        }
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            const todasOportunidades = await Oportunidade.find(query).exec();
            const oportunidadesFiltradas = todasOportunidades.filter(op => {
                if (!op.localizacao || !op.localizacao.cidade) return false;
                return normalizeString(op.localizacao.cidade).includes(cidadeNormalizada);
            });
            
            await Oportunidade.populate(oportunidadesFiltradas, [
                { path: 'clienteId', select: 'nome foto avatarUrl cidade estado' },
                { path: 'propostas.profissionalId', select: 'nome foto avatarUrl atuacao gamificacao' }
            ]);
            
            return res.json({ success: true, oportunidades: oportunidadesFiltradas });
        }
        
        const oportunidades = await Oportunidade.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('propostas.profissionalId', 'nome foto avatarUrl atuacao gamificacao')
            .sort({ createdAt: -1 })
            .exec();
        
        res.json({ success: true, oportunidades });
    } catch (error) {
        console.error('Erro ao buscar oportunidades:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Enviar proposta para oportunidade
app.post('/api/oportunidades/:oportunidadeId/proposta', authMiddleware, async (req, res) => {
    try {
        const { oportunidadeId } = req.params;
        const { valor, prazo, descricao } = req.body;
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const oportunidade = await Oportunidade.findById(oportunidadeId);
        if (!oportunidade || oportunidade.status !== 'aberta') {
            return res.status(400).json({ success: false, message: 'Oportunidade não está aberta.' });
        }
        
        // Verifica se já enviou proposta
        const jaPropos = oportunidade.propostas.some(
            p => p.profissionalId.toString() === profissionalId
        );
        if (jaPropos) {
            return res.status(400).json({ success: false, message: 'Você já enviou uma proposta para esta oportunidade.' });
        }
        
        oportunidade.propostas.push({
            profissionalId,
            valor,
            prazo: new Date(prazo),
            descricao,
            status: 'pendente'
        });
        
        await oportunidade.save();
        
        res.json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar proposta
app.post('/api/oportunidades/:oportunidadeId/aceitar/:propostaId', authMiddleware, async (req, res) => {
    try {
        const { oportunidadeId, propostaId } = req.params;
        const clienteId = req.user.id;
        
        const oportunidade = await Oportunidade.findById(oportunidadeId);
        if (!oportunidade || oportunidade.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }
        
        const proposta = oportunidade.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }
        
        // Rejeita outras propostas
        oportunidade.propostas.forEach(p => {
            if (p._id.toString() !== propostaId) {
                p.status = 'rejeitada';
            }
        });
        proposta.status = 'aceita';
        oportunidade.status = 'em_negociacao';
        oportunidade.propostaSelecionada = propostaId;
        
        await oportunidade.save();
        
        res.json({ success: true, message: 'Proposta aceita com sucesso!' });
    } catch (error) {
        console.error('Erro ao aceitar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: QG do Profissional - Dashboard
app.get('/api/qg-profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const [agendamentos, pagamentosLiberados, pagamentosPagos, clientes, servicos] = await Promise.all([
            Agendamento.find({ profissionalId }).countDocuments(),
            PagamentoSeguro.find({ profissionalId, status: 'liberado' }),
            PagamentoSeguro.find({ profissionalId, status: 'pago' }),
            Agendamento.distinct('clienteId', { profissionalId }),
            Servico.find({ userId: profissionalId }).countDocuments()
        ]);
        
        const ganhosMes = pagamentosLiberados
            .filter(p => {
                const mesAtual = new Date().getMonth();
                const anoAtual = new Date().getFullYear();
                const dataLib = new Date(p.dataLiberacao);
                return dataLib.getMonth() === mesAtual && dataLib.getFullYear() === anoAtual;
            })
            .reduce((sum, p) => sum + (p.valor - p.taxaPlataforma), 0);
        
        const aReceber = pagamentosPagos
            .reduce((sum, p) => sum + (p.valor - p.taxaPlataforma), 0);
        
        res.json({
            success: true,
            dashboard: {
                totalAgendamentos: agendamentos,
                totalClientes: clientes.length,
                totalProjetos: servicos,
                ganhosMes,
                aReceber,
                nivel: profissional.gamificacao?.nivel || 1,
                xp: profissional.gamificacao?.xp || 0
            }
        });
    } catch (error) {
        console.error('Erro ao buscar QG:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar clientes do profissional (Mini-CRM)
app.get('/api/qg-profissional/clientes', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        
        const agendamentos = await Agendamento.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl telefone cidade estado')
            .exec();
        
        const clientesMap = new Map();
        agendamentos.forEach(ag => {
            const clienteId = ag.clienteId._id.toString();
            if (!clientesMap.has(clienteId)) {
                clientesMap.set(clienteId, {
                    cliente: ag.clienteId,
                    totalServicos: 0,
                    ultimoServico: null
                });
            }
            const clienteData = clientesMap.get(clienteId);
            clienteData.totalServicos++;
            if (!clienteData.ultimoServico || ag.dataHora > clienteData.ultimoServico) {
                clienteData.ultimoServico = ag.dataHora;
            }
        });
        
        const clientes = Array.from(clientesMap.values());
        
        res.json({ success: true, clientes });
    } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Times de Projeto (evita 404 no carregamento do frontend)
app.get('/api/times-projeto', authMiddleware, async (req, res) => {
    try {
        const { cidade, status } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }

        const cidadeStr = typeof cidade === 'string' ? cidade.trim() : '';
        if (cidadeStr) {
            query.$or = [
                { 'localizacao.cidade': { $regex: cidadeStr, $options: 'i' } },
                { 'cidade': { $regex: cidadeStr, $options: 'i' } },
                { 'localizacao.endereco.cidade': { $regex: cidadeStr, $options: 'i' } }
            ];
        }

        const times = await TimeProjeto.find(query)
            .populate('clienteId', '_id nome foto avatarUrl cidade estado')
            .sort({ createdAt: -1 })
            .exec();

        res.json({ success: true, times });
    } catch (error) {
        console.error('Erro ao buscar times de projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota não encontrada (404)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada',
        path: req.path
    });
});

// Middleware de tratamento de erros global (deve vir após todas as rotas)
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    console.error('Stack trace:', err.stack);
    
    if (!res.headersSent) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Erro de validação',
                errors: Object.values(err.errors).map(e => e.message)
            });
        }
        
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }
        
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Arquivo muito grande. O tamanho máximo permitido é 500MB.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Exporta o app
module.exports = app;

// Execução do servidor
// Route /api/avaliacoes-verificadas verified and ready.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  // Inicializa serviços antes de iniciar o servidor
  const startWithFallback = (initialPort) => {
    const tryListen = (port) => {
      const server = app.listen(port, HOST, () => {
        console.log(`🚀 Servidor rodando na porta ${port}`);
        if (process.env.DOMINIO) {
          console.log(`🌐 Domínio: ${process.env.DOMINIO}`);
        }
      });
      server.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          const nextPort = Number(port) + 1;
          console.warn(`⚠️ Porta ${port} em uso. Tentando porta ${nextPort}...`);
          tryListen(nextPort);
        } else {
          console.error('❌ Erro ao iniciar servidor:', err);
          process.exit(1);
        }
      });
    };
    tryListen(Number(initialPort));
  };

  initializeServices().then(() => {
    startWithFallback(PORT);
  }).catch((error) => {
    console.error('❌ Erro ao inicializar serviços:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ MODO DEV: iniciando servidor mesmo com falha na inicialização de serviços.');
      startWithFallback(PORT);
      return;
    }
    process.exit(1);
  });
}
