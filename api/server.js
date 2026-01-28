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
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { URL } = require('url');

// Função helper para carregar sharp apenas quando necessário (lazy loading)
// Cache para evitar múltiplas tentativas de carregamento
let sharpCache = null;
let sharpLoadAttempted = false;

function getSharp() {
    // Se já tentou carregar antes e falhou, retorna null imediatamente
    if (sharpLoadAttempted) {
        return sharpCache;
    }
    
    sharpLoadAttempted = true;
    
    try {
        // Tenta carregar o Sharp
        sharpCache = require('sharp');
        
        // Verifica se o Sharp está funcionando
        if (sharpCache && typeof sharpCache === 'function') {
            return sharpCache;
        }
        throw new Error('Sharp carregado mas não funcional');
    } catch (error) {
        // Não loga como erro crítico, apenas como aviso informativo
        // O sistema funciona normalmente sem Sharp usando o buffer original
        // Só loga detalhes em desenvolvimento para não poluir logs de produção
        if (IS_DEV) {
            console.warn('⚠️ Sharp não disponível - usando processamento básico de imagem');
            console.warn('   Detalhes:', error.message);
        }
        sharpCache = null;
        return null;
    }
}

const app = express();

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
// ----------------------------------------------------------------------
// DEFINIÇÃO DOS SCHEMAS
// ----------------------------------------------------------------------
const avaliacaoSchema = new mongoose.Schema({ usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, estrelas: { type: Number, required: true, min: 1, max: 5 }, comentario: { type: String, trim: true } }, { timestamps: true });

// 🆕 ATUALIZADO: Schema de Serviço/Portfólio com validação por pares
const validacaoParSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataValidacao: { type: Date, default: Date.now },
    comentario: { type: String, trim: true }
}, { timestamps: true });

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
const replySchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], createdAt: { type: Date, default: Date.now } });
const commentSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, required: true }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], replies: [replySchema], createdAt: { type: Date, default: Date.now } });
const postagemSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, content: { type: String, trim: true }, mediaUrl: { type: String }, mediaType: { type: String, enum: ['image', 'video'] }, likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], comments: [commentSchema], createdAt: { type: Date, default: Date.now }, });

const anuncioPagoSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    titulo: { type: String, required: true, trim: true },
    descricao: { type: String, trim: true },
    imagemUrl: { type: String, trim: true },
    linkUrl: { type: String, trim: true },
    cidade: { type: String, trim: true },
    estado: { type: String, trim: true },
    plano: { type: String, enum: ['basico', 'premium'], default: 'basico' },
    ativo: { type: Boolean, default: true },
    inicioEm: { type: Date },
    fimEm: { type: Date },
    prioridade: { type: Number, default: 0 }
}, { timestamps: true });

// 🆕 NOVO: Schema de Time de Projeto
const timeProjetoSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    localizacao: {
        rua: { type: String },
        numero: { type: String },
        bairro: { type: String, required: true },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    profissionaisNecessarios: [{
        tipo: { type: String, required: true }, // ex: "pedreiro", "eletricista", "pintor"
        quantidade: { type: Number, default: 1 },
        valorBase: { type: Number }, // Valor base por dia para este tipo de profissional (null se "A Combinar")
        aCombinar: { type: Boolean, default: false } // Se o valor será combinado depois
    }],
    candidatos: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        tipo: { type: String }, // tipo de profissional que está se candidatando
        status: { type: String, enum: ['pendente', 'aceito', 'rejeitado'], default: 'pendente' },
        valor: { type: Number }, // Valor aceito ou proposto pelo profissional
        justificativa: { type: String }, // Justificativa da contraproposta
        tipoCandidatura: { type: String, enum: ['aceite', 'contraproposta'], default: 'aceite' }, // Se aceitou o valor base ou enviou contraproposta
        dataCandidatura: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], default: 'aberto' },
    dataInicio: { type: Date },
    dataConclusao: { type: Date }
}, { timestamps: true });

// 🆕 NOVO: Schema de Agendamento
const agendamentoSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dataHora: { type: Date, required: true },
    servico: { type: String, required: true },
    observacoes: { type: String },
    status: { type: String, enum: ['pendente', 'confirmado', 'cancelado', 'concluido'], default: 'pendente' },
    endereco: {
        rua: { type: String },
        numero: { type: String },
        bairro: { type: String },
        pontoReferencia: { type: String },
        cidade: { type: String },
        estado: { type: String }
    }
}, { timestamps: true });

// 🆕 NOVO: Schema de Horários Disponíveis
const horarioDisponivelSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    diaSemana: { type: Number, required: true, min: 0, max: 6 }, // 0 = Domingo, 6 = Sábado
    horaInicio: { type: String, required: true }, // Formato "HH:MM"
    horaFim: { type: String, required: true },
    disponivel: { type: Boolean, default: true }
}, { timestamps: true });

// 🆕 NOVO: Schema de Equipe Verificada
const equipeVerificadaSchema = new mongoose.Schema({
    liderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nome: { type: String, required: true },
    descricao: { type: String },
    membros: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        funcao: { type: String, required: true },
        status: { type: String, enum: ['pendente', 'aceito', 'recusado'], default: 'pendente' },
        dataConvite: { type: Date, default: Date.now }
    }],
    xpTotal: { type: Number, default: 0 }, // Soma do XP de todos os membros
    nivelEquipe: { type: Number, default: 1 },
    projetosCompletos: { type: Number, default: 0 },
    isVerificada: { type: Boolean, default: false }
}, { timestamps: true });

// Em ambientes serverless (como Vercel), o arquivo pode ser carregado mais de uma vez.
// Usamos mongoose.models[...] para evitar OverwriteModelError ao recompilar os models.
const TimeProjeto = mongoose.models.TimeProjeto || mongoose.model('TimeProjeto', timeProjetoSchema);
const Agendamento = mongoose.models.Agendamento || mongoose.model('Agendamento', agendamentoSchema);
const HorarioDisponivel = mongoose.models.HorarioDisponivel || mongoose.model('HorarioDisponivel', horarioDisponivelSchema);
const EquipeVerificada = mongoose.models.EquipeVerificada || mongoose.model('EquipeVerificada', equipeVerificadaSchema);

const pagamentoSeguroSchema = new mongoose.Schema({
    pedidoUrgenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoUrgente' },
    projetoTimeId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjetoTime' },
    
    // Tipo de serviço para identificar qual referência usar
    tipoServico: { 
        type: String, 
        enum: ['agendamento', 'pedido_urgente', 'projeto_time'], 
        required: true 
    },
    
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    valor: { type: Number, required: true },
    taxaPlataforma: { type: Number, default: 0.05 }, // 5% padrão, pode ser configurável
    valorLiquido: { type: Number }, // Valor que o profissional recebe (valor - taxa)
    status: { 
        type: String, 
        enum: ['pendente', 'pago', 'liberado', 'reembolsado', 'cancelado'], 
        default: 'pendente' 
    },
    dataPagamento: { type: Date },
    dataLiberacao: { type: Date },
    metodoPagamento: { type: String },
    transacaoId: { type: String },
    // Flag para identificar serviços com Garantia Helpy (para XP extra)
    temGarantiaHelpy: { type: Boolean, default: true }
}, { timestamps: true });

const PagamentoSeguro = mongoose.models.PagamentoSeguro || mongoose.model('PagamentoSeguro', pagamentoSeguroSchema);

const AnuncioPago = mongoose.models.AnuncioPago || mongoose.model('AnuncioPago', anuncioPagoSchema);

// NOVO: Schema de Oportunidade (Mural)
const oportunidadeSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true }, // ex: "design", "programacao", "construcao"
    orcamento: { type: Number, required: true },
    prazo: { type: Date, required: true },
    localizacao: {
        cidade: { type: String },
        estado: { type: String }
    },
    propostas: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        valor: { type: Number, required: true },
        prazo: { type: Date, required: true },
        descricao: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada'], default: 'pendente' },
        dataProposta: { type: Date, default: Date.now }
    }],
    status: { 
        type: String, 
        enum: ['aberta', 'em_negociacao', 'fechada', 'cancelada'], 
        default: 'aberta' 
    },
    propostaSelecionada: { type: mongoose.Schema.Types.ObjectId, ref: 'oportunidadeSchema.propostas' }
}, { timestamps: true });

const Oportunidade = mongoose.models.Oportunidade || mongoose.model('Oportunidade', oportunidadeSchema);

// NOVO: Schema de Notificações
const notificacaoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tipo: { 
        type: String, 
        enum: [
            'pagamento_garantido',
            'pagamento_liberado',
            'pagamento_reembolsado',
            'proposta_aceita',
            'servico_concluido',
            'servico_cancelado',
            'disputa_aberta',
            'disputa_resolvida',
            'avaliacao_recebida',
            'pedido_urgente',
            'proposta_pedido_urgente',
            'candidatura_time',
            'contraproposta_time',
            'proposta_time_aceita',
            'confirmar_perfil_time',
            'candidatura_recusada_time',
            'post_curtido',
            'post_comentado',
            'comentario_respondido',
            'comentario_curtido',
            'resposta_curtida'
        ], 
        required: true 
    },
    titulo: { type: String, required: true },
    mensagem: { type: String, required: true },
    lida: { type: Boolean, default: false },
    dataLeitura: { type: Date },
    dadosAdicionais: { type: mongoose.Schema.Types.Mixed }, // Dados extras (IDs, valores, etc.)
    link: { type: String } // Link para ação relacionada
}, { timestamps: true });

// ⚖️ NOVO: Schema de Disputas
const disputaSchema = new mongoose.Schema({
    pagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PagamentoSeguro', required: true },
    criadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Cliente ou Profissional
    tipo: { 
        type: String, 
        enum: ['cliente_nao_liberou', 'profissional_nao_executou', 'servico_nao_conforme', 'outro'], 
        required: true 
    },
    motivo: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['aberta', 'em_analise', 'resolvida_cliente', 'resolvida_profissional', 'cancelada'], 
        default: 'aberta' 
    },
    resolucao: { type: String }, // Decisão do admin
    resolvidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin que resolveu
    dataResolucao: { type: Date },
    evidencias: [{ type: String }] // URLs de imagens/comprovantes
}, { timestamps: true });

// 📊 NOVO: Schema de Histórico de Transações (auditoria)
const historicoTransacaoSchema = new mongoose.Schema({
    pagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'PagamentoSeguro', required: true },
    acao: { 
        type: String, 
        enum: ['criado', 'pago', 'liberado', 'reembolsado', 'disputa_aberta', 'disputa_resolvida', 'cancelado'],
        required: true 
    },
    realizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dadosAntes: { type: mongoose.Schema.Types.Mixed },
    dadosDepois: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String }
}, { timestamps: true });

const Notificacao = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);
const Disputa = mongoose.models.Disputa || mongoose.model('Disputa', disputaSchema);
const HistoricoTransacao = mongoose.models.HistoricoTransacao || mongoose.model('HistoricoTransacao', historicoTransacaoSchema);

// 🔔 Função auxiliar para criar notificações
async function criarNotificacao(userId, tipo, titulo, mensagem, dadosAdicionais = {}, link = null) {
    try {
        // Validação básica
        if (!userId || !tipo || !titulo || !mensagem) {
            console.error('❌ Dados inválidos para criar notificação:', { userId, tipo, titulo, mensagem: mensagem ? 'presente' : 'ausente' });
            return null;
        }
        
        const notificacao = new Notificacao({
            userId,
            tipo,
            titulo,
            mensagem,
            dadosAdicionais,
            link
        });
        
        await notificacao.save();
        
        console.log('✅ Notificação criada com sucesso:', {
            id: notificacao._id,
            userId,
            tipo,
            titulo
        });

        // TODO: Aqui você pode integrar com serviços de push notification
        // Exemplo: Firebase Cloud Messaging, OneSignal, etc.
        // await enviarPushNotification(userId, titulo, mensagem);

        return notificacao;
    } catch (error) {
        console.error('❌ Erro ao criar notificação:', error);
        console.error('Detalhes:', {
            userId,
            tipo,
            titulo,
            mensagem: mensagem ? 'presente' : 'ausente',
            errorMessage: error.message,
            errorStack: error.stack
        });
        // Não falha a operação principal se a notificação falhar
        return null;
    }
}

// 📊 Função auxiliar para registrar histórico de transações
async function registrarHistoricoTransacao(pagamentoId, acao, realizadoPor, dadosAntes = {}, dadosDepois = {}, req = null) {
    try {
        const historico = new HistoricoTransacao({
            pagamentoId,
            acao,
            realizadoPor,
            dadosAntes,
            dadosDepois,
            ip: req?.ip || req?.connection?.remoteAddress || null,
            userAgent: req?.get('user-agent') || null
        });
        await historico.save();
        return historico;
    } catch (error) {
        console.error('Erro ao registrar histórico:', error);
        return null;
    }
}

// 🌟 NOVO: Schema de Avaliação Verificada (Sistema Híbrido de Confiança)
const avaliacaoVerificadaSchema = new mongoose.Schema({
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' }, // Opcional para pedidos urgentes
    pedidoUrgenteId: { type: mongoose.Schema.Types.ObjectId, ref: 'PedidoUrgente' }, // Para pedidos urgentes sem agendamento
    estrelas: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, trim: true },
    servico: { type: String }, // Nome do serviço prestado
    isVerificada: { type: Boolean, default: true }, // Sempre true para avaliações verificadas
    dataServico: { type: Date, required: true } // Data em que o serviço foi realizado
}, { timestamps: true });

// 🏢 NOVO: Schema de Time Local (Micro-Agência)
const timeLocalSchema = new mongoose.Schema({
    liderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nome: { type: String, required: true },
    descricao: { type: String },
    categoria: { type: String, required: true }, // ex: "construcao", "pintura", "jardinagem"
    membros: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        funcao: { type: String, required: true }, // ex: "Pintor", "Ajudante", "Eletricista"
        status: { type: String, enum: ['pendente', 'aceito', 'recusado'], default: 'pendente' },
        dataConvite: { type: Date, default: Date.now }
    }],
    nivelMedio: { type: Number, default: 1 }, // Média dos níveis dos membros
    projetosCompletos: { type: Number, default: 0 },
    avaliacaoMedia: { type: Number, default: 0 },
    isAtivo: { type: Boolean, default: true }
}, { timestamps: true });

// 📋 NOVO: Schema de Projeto de Time / Mutirão Pago
const projetoTimeSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    categoria: { type: String, required: true },
    localizacao: {
        endereco: { type: String, required: true },
        bairro: { type: String },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    dataServico: { type: Date, required: true },
    horaInicio: { type: String, required: true }, // Formato "HH:MM"
    horaFim: { type: String, required: true },
    profissionaisNecessarios: [{
        tipo: { type: String, required: true }, // ex: "pintor", "ajudante"
        quantidade: { type: Number, default: 1 },
        valorPorPessoa: { type: Number, required: true }
    }],
    valorTotal: { type: Number, required: true },
    candidatos: [{
        timeLocalId: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLocal' },
        proposta: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada'], default: 'pendente' },
        dataCandidatura: { type: Date, default: Date.now }
    }],
    status: { 
        type: String, 
        enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], 
        default: 'aberto' 
    },
    timeSelecionado: { type: mongoose.Schema.Types.ObjectId, ref: 'TimeLocal' }
}, { timestamps: true });

// 🚨 NOVO: Schema de Pedido Urgente ("Preciso Agora!")
const pedidoUrgenteSchema = new mongoose.Schema({
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    servico: { type: String, required: true }, // Tipo de serviço necessário
    descricao: { type: String },
    foto: { type: String }, // URL da foto do serviço (mantido para compatibilidade)
    fotos: [{ type: String }], // Array de URLs das fotos do serviço
    localizacao: {
        endereco: { type: String, required: true }, // Rua completa (pode incluir número/bairro)
        rua: { type: String },
        numero: { type: String },
        bairro: { type: String },
        pontoReferencia: { type: String },
        cidade: { type: String, required: true },
        estado: { type: String, required: true },
        latitude: { type: Number },
        longitude: { type: Number }
    },
    categoria: { type: String, required: true }, // Para filtrar profissionais
    tipoAtendimento: { type: String, enum: ['urgente', 'agendado'], default: 'urgente' }, // urgente (agora) ou agendado
    prazoHoras: { type: Number, default: 1 }, // Prazo escolhido (1, 2, 5, 9, 12, 24)
    dataAgendada: { type: Date }, // Quando o cliente agendou o serviço (opcional)
    propostas: [{
        profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        valor: { type: Number, required: true },
        tempoChegada: { type: String, required: true }, // ex: "30 min", "1 hora"
        observacoes: { type: String },
        status: { type: String, enum: ['pendente', 'aceita', 'rejeitada', 'cancelada'], default: 'pendente' },
        dataProposta: { type: Date, default: Date.now }
    }],
    propostaSelecionada: { type: mongoose.Schema.Types.ObjectId },
    agendamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agendamento' },
    status: { 
        type: String, 
        enum: ['aberto', 'em_andamento', 'concluido', 'cancelado'], 
        default: 'aberto' 
    },
    motivoCancelamento: { type: String },
    canceladoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dataExpiracao: { type: Date }, // Pedidos urgentes expiram rápido
    notificacoesEnviadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Profissionais notificados
    notificacoesCriadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Notificacao' }] // IDs das notificações geradas
}, { timestamps: true });

const AvaliacaoVerificada = mongoose.models.AvaliacaoVerificada || mongoose.model('AvaliacaoVerificada', avaliacaoVerificadaSchema);
const TimeLocal = mongoose.models.TimeLocal || mongoose.model('TimeLocal', timeLocalSchema);
const ProjetoTime = mongoose.models.ProjetoTime || mongoose.model('ProjetoTime', projetoTimeSchema);
const PedidoUrgente = mongoose.models.PedidoUrgente || mongoose.model('PedidoUrgente', pedidoUrgenteSchema);

// Schema de Vaga-Relâmpago REMOVIDO - funcionalidade descontinuada

// 🛑 ATUALIZADO: Schema de Usuário
const userSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    slugPerfil: { type: String, unique: true, sparse: true },
    idade: { type: Number },
    cidade: { type: String }, 
    estado: { type: String }, 
    tipo: { type: String, enum: ['usuario', 'empresa'], required: true },
    atuacao: { type: String, default: null }, // Opcional - qualquer usuário pode ter área de atuação
    telefone: { type: String, default: null },
    descricao: { type: String, default: null },
    email: { 
        type: String, 
        required: true, 
        unique: true,
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} não é um e-mail válido!`
        }
    },
    emailVerificado: { type: Boolean, default: false },
    codigoVerificacao: { type: String },
    codigoExpiracao: { type: Date },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    avatarUrl: { type: String, default: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' },
    servicosImagens: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Servico' }],
    isVerified: { type: Boolean, default: false },
    emailVerificado: { type: Boolean, default: false },
    codigoVerificacao: { type: String, default: null },
    codigoVerificacaoExpira: { type: Date, default: null },
    mediaAvaliacao: { type: Number, default: 0 },
    totalAvaliacoes: { type: Number, default: 0 },
    avaliacoes: [avaliacaoSchema],
    // 🛑 NOVO: Campo Tema
    tema: { type: String, enum: ['light', 'dark'], default: 'light' },
    // 🆕 NOVO: Localização (coordenadas)
    localizacao: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        ultimaAtualizacao: { type: Date, default: null }
    },
    // 🆕 NOVO: Gamificação
    gamificacao: {
        nivel: { type: Number, default: 1, min: 1, max: 50 },
        xp: { type: Number, default: 0 },
        xpProximoNivel: { type: Number, default: 100 },
        desafiosCompletos: [{ type: String }],
        portfolioValidado: { type: Boolean, default: false },
        mediaAvaliacoesVerificadas: { type: Number, default: 0 },
        totalAvaliacoesVerificadas: { type: Number, default: 0 },
        temSeloQualidade: { type: Boolean, default: false }, // Nível 10+
        temSeloHumano: { type: Boolean, default: false }, // Selo de trabalho 100% humano
        nivelReputacao: { type: String, enum: ['iniciante', 'validado', 'mestre'], default: 'iniciante' }
    },
    // 🆕 NOVO: Status de disponibilidade (para "Preciso agora!")
    disponivelAgora: { type: Boolean, default: false },
    // 👑 NOVO: Flag de administrador
    isAdmin: { type: Boolean, default: false },
    // 🆕 NOVO: Equipes concluídas ocultas (para limpar a lista sem deletar do banco)
    equipesConcluidasOcultas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TimeProjeto' }]
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Postagem = mongoose.models.Postagem || mongoose.model('Postagem', postagemSchema);
const Servico = mongoose.models.Servico || mongoose.model('Servico', servicoSchema);
//----------------------------------------------------------------------

// Helper para gerar slug único de perfil (baseado no nome)
async function gerarSlugPerfil(nome) {
    if (!nome) {
        // Fallback simples se não tiver nome
        const base = `user-${Date.now()}`;
        return base;
    }

    const baseSlug = nome
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') || `user-${Date.now()}`;

    let slug = baseSlug;
    let contador = 0;

    // Garante unicidade
    while (await User.exists({ slugPerfil: slug })) {
        contador += 1;
        slug = `${baseSlug}-${contador}`;
    }

    return slug;
}

// MIDDLEWARES (App.use, Auth, Multer)
// ----------------------------------------------------------------------
// Configuração do CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Servir arquivos estáticos
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Rotas amigáveis para páginas principais (sem expor .html)
app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/cadastro', (req, res) => {
    res.sendFile(path.join(publicDir, 'cadastro.html'));
});

// Perfil por query (?id=...) - redireciona para slug amigável quando possível
app.get('/perfil', async (req, res) => {
    try {
        const { id } = req.query;
        if (id) {
            const usuario = await User.findById(id).select('slugPerfil');
            if (usuario && usuario.slugPerfil) {
                return res.redirect(`/perfil/${usuario.slugPerfil}`);
            }
        }
        // Fallback: serve a página normalmente
        res.sendFile(path.join(publicDir, 'perfil.html'));
    } catch (error) {
        console.error('Erro ao redirecionar perfil por id para slug:', error);
        res.sendFile(path.join(publicDir, 'perfil.html'));
    }
});

// Perfil por slug amigável: /perfil/:slug
app.get('/perfil/:slug', (req, res) => {
    res.sendFile(path.join(publicDir, 'perfil.html'));
});

// API: Buscar usuário por slug de perfil
app.get('/api/usuarios/slug/:slug', authMiddleware, async (req, res) => {
    try {
        const { slug } = req.params;
        const usuario = await User.findOne({ slugPerfil: slug }).select('-senha -codigoVerificacao -codigoExpiracao');
        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario });
    } catch (error) {
        console.error('Erro ao buscar usuário por slug:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Inicialização dos serviços
app.use(async (req, res, next) => { 
    try { 
        await initializeServices(); 
        next(); 
    } catch (error) { 
        console.error("Falha na inicialização dos serviços:", error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                message: "Erro interno do servidor. Não foi possível inicializar os serviços.",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } 
});

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para garantir Content-Type JSON em todas as rotas da API
app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
});

// Segredo JWT com fallback seguro em desenvolvimento (evita erro 500 se variável não estiver definida)
const JWT_SECRET = process.env.JWT_SECRET || 'helpy-dev-secret-2024';

// Helper para comparar IDs de forma consistente (ObjectId ou string)
function compareIds(id1, id2) {
    if (!id1 || !id2) {
        console.log('⚠️ compareIds: um dos IDs é null/undefined', { id1, id2 });
        return false;
    }
    
    // Função auxiliar para normalizar qualquer tipo de ID para string
    const normalizeId = (id) => {
        // Se for null ou undefined
        if (!id) return '';
        
        // Se for objeto populado (tem _id)
        if (id._id) {
            const normalized = String(id._id);
            console.log('📌 ID normalizado (objeto populado):', normalized);
            return normalized;
        }
        
        // Se tiver método toString (ObjectId do mongoose)
        if (id.toString && typeof id.toString === 'function') {
            const str = id.toString();
            console.log('📌 ID normalizado (toString):', str, 'tipo:', typeof id, 'constructor:', id.constructor?.name);
            return str;
        }
        
        // Caso padrão: converte para string
        const normalized = String(id);
        console.log('📌 ID normalizado (string):', normalized);
        return normalized;
    };
    
    const str1 = normalizeId(id1);
    const str2 = normalizeId(id2);
    
    const result = str1 === str2 && str1 !== '';
    console.log('🔍 Comparação:', { str1, str2, result });
    
    return result;
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token não fornecido ou inválido.' });
    }
    const token = authHeader.split(' ')[1];
    
    // Validação adicional: verifica se o token não é null, undefined ou string vazia
    if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
        return res.status(401).json({ message: 'Token não fornecido ou inválido.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // Não loga erro se for apenas token malformado ou expirado (evita spam de logs)
        if (error.message === 'jwt malformed' || error.message === 'jwt expired') {
            // Log apenas em desenvolvimento
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Token JWT inválido ou expirado:', error.message);
            }
        } else {
            console.error('Erro ao verificar token JWT:', error.message);
        }
        return res.status(401).json({ message: 'Token inválido.' });
    }
}
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']; if (allowedTypes.includes(file.mimetype)) { cb(null, true); } else { cb(new Error('Tipo de arquivo não suportado.'), false); } } });

const uploadAdImage = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não suportado. Envie apenas imagem.'), false);
        }
    }
});

// ----------------------------------------------------------------------
// FUNÇÕES DE VERIFICAÇÃO DE EMAIL
// ----------------------------------------------------------------------

// Função para criar transporter de email
function criarTransporterEmail() {
    try {
        // Verifica se tem configurações SMTP
        const hasSMTPConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
        
        if (!hasSMTPConfig) {
            console.warn('═══════════════════════════════════════════════════════════');
            console.warn('AVISO: Configurações SMTP não encontradas.');
            console.warn('Para enviar emails, configure as seguintes variáveis na Vercel:');
            console.warn('- SMTP_HOST (ex: smtp.gmail.com)');
            console.warn('- SMTP_PORT (ex: 587)');
            console.warn('- SMTP_USER (seu email)');
            console.warn('- SMTP_PASS (sua senha ou senha de app)');
            console.warn('- SMTP_SECURE (true para porta 465, false para 587)');
            console.warn('- SMTP_FROM (ex: Helpy <noreply@helpy.com>)');
            console.warn('═══════════════════════════════════════════════════════════');
            return null;
        }
        
        // Cria transporter com as configurações
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            requireTLS: process.env.SMTP_SECURE !== 'true', // Requer TLS para porta 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            // Timeout aumentado para evitar erros
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000
        });
        
        console.log('✅ Transporter de email configurado com sucesso');
        return transporter;
    } catch (error) {
        console.error('❌ Erro ao criar transporter de email:', error);
        return null;
    }
}

// Função para gerar código de verificação
function gerarCodigoVerificacao() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
}

// Função para enviar código de verificação por email
async function enviarCodigoVerificacao(email, codigo) {
    try {
        const transporter = criarTransporterEmail();
        
        // Se não houver transporter configurado, NÃO loga código/email por padrão (evita vazamento).
        if (!transporter) {
            if (DEBUG_EMAIL_CODES) {
                console.warn('[DEV] SMTP não configurado. Código de verificação gerado (debug):', codigo);
                console.warn('[DEV] Email (debug):', email);
            }
            // Sempre retorna true quando não há SMTP - código já foi salvo no banco
            return true;
        }
        
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Helpy <noreply@helpy.com>',
            to: email,
            subject: 'Código de Verificação - Helpy',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4CAF50;">Verificação de Email - Helpy</h2>
                    <p>Olá!</p>
                    <p>Seu código de verificação é:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #4CAF50; font-size: 36px; letter-spacing: 5px; margin: 0;">${codigo}</h1>
                    </div>
                    <p>Este código expira em 10 minutos.</p>
                    <p>Se você não solicitou este código, ignore este email.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 12px;">Equipe Helpy</p>
                </div>
            `,
            text: `Seu código de verificação é: ${codigo}. Este código expira em 10 minutos.`
        };

        const info = await transporter.sendMail(mailOptions);
        // Evita logar metadados/PII por padrão (email/messageId).
        if (IS_DEV) {
            console.log('Email de verificação enviado com sucesso.');
        }
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar email de verificação:', error);
        console.error('   Detalhes:', error.message);
        
        // Se houver SMTP configurado, tenta novamente ou retorna false
        if (process.env.SMTP_HOST) {
            console.error('   SMTP configurado mas falhou. Verifique as credenciais.');
            // Em produção com SMTP configurado, retorna false para alertar
            if (process.env.NODE_ENV === 'production') {
                return false;
            }
            // Em desenvolvimento, ainda retorna true para não bloquear testes
            console.warn('   MODO DEV: Continuando mesmo com erro (código salvo no banco)');
            if (DEBUG_EMAIL_CODES) {
                console.warn('   Código de verificação (debug):', codigo);
            }
            return true;
        }
        
        // Sem SMTP configurado, retorna true (código já foi salvo no banco)
        if (DEBUG_EMAIL_CODES) {
            console.warn('[DEV] Código de verificação (debug):', codigo);
        }
        return true;
    }
}

// ----------------------------------------------------------------------
// ROTAS DE API
// ----------------------------------------------------------------------

// 🆕 NOVO: Rota para solicitar código de verificação de email
app.post('/api/verificar-email/solicitar', async (req, res) => {
    try {
        // Garante que os serviços estão inicializados
        await initializeServices();
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se o email já está verificado em outra conta
        const emailJaVerificado = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true 
        });

        if (emailJaVerificado) {
            return res.status(409).json({ 
                success: false, 
                message: 'Este email já está vinculado a outra conta verificada. Por favor, use outro email ou faça login na conta existente.' 
            });
        }

        // Gera código de verificação
        const codigo = gerarCodigoVerificacao();
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 10); // Expira em 10 minutos

        // Verifica se já existe um usuário temporário com este email (não verificado)
        let usuarioTemp = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: false 
        });

        if (usuarioTemp) {
            // Atualiza código existente
            usuarioTemp.codigoVerificacao = codigo;
            usuarioTemp.codigoVerificacaoExpira = expiraEm;
            await usuarioTemp.save();
        } else {
            // Cria usuário temporário apenas para armazenar o código
            usuarioTemp = new User({
                email: emailNormalizado,
                senha: 'temp_' + Date.now(), // Senha temporária
                nome: 'TEMP',
                tipo: 'cliente',
                codigoVerificacao: codigo,
                codigoVerificacaoExpira: expiraEm,
                emailVerificado: false
            });
            await usuarioTemp.save();
        }

        // Envia código por email (não bloqueia se falhar - código já foi salvo no banco)
        try {
            const emailEnviado = await enviarCodigoVerificacao(emailNormalizado, codigo);
            // Se o email não foi enviado mas estamos em produção E temos SMTP configurado, retorna erro
            // Caso contrário, continua normalmente (código já está salvo no banco)
            if (!emailEnviado && process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
                console.warn('Email não foi enviado em produção, mas código foi salvo no banco');
                // Não retorna erro, apenas avisa - o código já está salvo e pode ser usado
            }
        } catch (emailError) {
            console.error('Erro ao tentar enviar email:', emailError);
            // Não bloqueia o processo - o código já foi salvo no banco
            // Em produção com SMTP configurado, apenas loga o erro
            if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
                console.error('Erro crítico ao enviar email em produção com SMTP configurado');
                // Mesmo assim, não retorna erro porque o código foi salvo
            } else {
                console.log('MODO DEV/SEM SMTP: Continuando mesmo com erro no envio de email');
            }
        }

        return res.json({ 
            success: true, 
            message: 'Código de verificação enviado para seu email!',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao solicitar verificação de email:', error);
        console.error('Stack trace:', error.stack);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        
        // Garante que sempre retorna JSON
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'application/json');
            
            if (error.code === 11000) {
                return res.status(409).json({ 
                    success: false, 
                    message: 'Este email já está cadastrado.' 
                });
            }
            
            // Se for erro de conexão com MongoDB
            if (error.message && error.message.includes('Falha na conexão')) {
                return res.status(500).json({ 
                    success: false, 
                    message: 'Erro ao conectar com o banco de dados. Tente novamente mais tarde.',
                    error: process.env.NODE_ENV === 'development' ? error.message : undefined
                });
            }
            
            return res.status(500).json({ 
                success: false, 
                message: 'Erro interno do servidor.',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

// 🆕 NOVO: Rota para validar código de verificação
app.post('/api/verificar-email/validar', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se o email já está verificado em outra conta (ANTES de validar o código)
        const emailJaVerificadoEmOutraConta = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (emailJaVerificadoEmOutraConta) {
            return res.status(409).json({ 
                success: false, 
                message: 'Este email já está vinculado a outra conta verificada. Por favor, use outro email ou faça login na conta existente.' 
            });
        }

        const usuario = await User.findOne({ 
            email: emailNormalizado 
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Email não encontrado. Solicite um novo código.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        // NÃO marca como verificado aqui - isso será feito no cadastro
        // Apenas valida o código e retorna sucesso
        res.json({ 
            success: true, 
            message: 'Código válido! Prosseguindo com o cadastro...',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao validar código:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ----------------------------------------------------------------------
// 📍 ROTA DE GEOCODIFICAÇÃO REVERSA (Proxy para Nominatim)
// ----------------------------------------------------------------------
app.get('/api/geocodificar-reversa', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({
                success: false,
                message: 'Latitude e longitude são obrigatórios.'
            });
        }
        
        // Adiciona delay para respeitar rate limit do Nominatim
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=pt-BR&zoom=18`;
        
        const response = await fetch(geocodeUrl, {
            headers: {
                'User-Agent': 'HelpyApp/1.0' // Nominatim requer User-Agent
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar endereço: ${response.status}`);
        }
        
        const data = await response.json();
        
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Erro na geocodificação reversa:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar endereço.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ----------------------------------------------------------------------
// 🔍 ROTA DE BUSCA GLOBAL (usuários, serviços, postagens)
// ----------------------------------------------------------------------
app.get('/api/busca', authMiddleware, async (req, res) => {
    try {
        const termoBruto = (req.query.q || '').toString().trim();

        if (!termoBruto) {
            return res.json({
                success: true,
                usuarios: [],
                servicos: [],
                posts: []
            });
        }

        // Busca tolerante a acentos (ex: "joao" encontra "João")
        function buildAccentInsensitiveRegex(input) {
            const s = (input || '')
                .toString()
                .trim()
                // remove acentos para gerar um padrão base
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            const map = {
                a: 'aàáâãäåÀÁÂÃÄÅ',
                e: 'eèéêëÈÉÊË',
                i: 'iìíîïÌÍÎÏ',
                o: 'oòóôõöÒÓÔÕÖ',
                u: 'uùúûüÙÚÛÜ',
                c: 'cçÇ',
                n: 'nñÑ'
            };

            const escapeChar = (ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            let pattern = '';
            for (let i = 0; i < s.length; i++) {
                const ch = s[i];
                if (/\s/.test(ch)) {
                    // permite múltiplos espaços
                    pattern += '\\s+';
                    continue;
                }
                const lower = ch.toLowerCase();
                if (map[lower]) {
                    pattern += `[${map[lower]}]`;
                } else if (/[a-z0-9]/i.test(ch)) {
                    pattern += escapeChar(ch);
                } else {
                    pattern += escapeChar(ch);
                }
            }
            return new RegExp(pattern, 'i');
        }

        const regex = buildAccentInsensitiveRegex(termoBruto);

        const [usuarios, servicos, posts] = await Promise.all([
            User.find({
                $or: [
                    { nome: regex },
                    { atuacao: regex },
                    { cidade: regex },
                    { estado: regex },
                    { email: regex }
                ]
            })
            .select('nome cidade estado atuacao avatarUrl foto slugPerfil tipo')
            .limit(10),

            Servico.find({
                $or: [
                    { title: regex },
                    { description: regex },
                    { tecnologias: regex },
                    { desafio: regex }
                ]
            })
            .select('title description imagens ownerId')
            .limit(10),

            Postagem.find({
                $or: [
                    { content: regex }
                ]
            })
            .populate('userId', 'nome cidade estado tipo avatarUrl foto slugPerfil')
            .select('content mediaUrl mediaType createdAt userId')
            .limit(10)
        ]);

        res.json({
            success: true,
            usuarios,
            servicos,
            posts
        });
    } catch (error) {
        console.error('Erro na rota /api/busca:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao realizar busca.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota de Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
        }
        
        const emailNormalizado = email.toLowerCase().trim();
        const user = await User.findOne({ email: emailNormalizado });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        // Validação extra: garante que há uma senha hash válida antes de chamar o bcrypt
        if (!user.senha || typeof user.senha !== 'string' || !user.senha.startsWith('$2')) {
            console.warn('Login bloqueado: senha inválida ou não-hash para evitar erro 500.');
            return res.status(401).json({ 
                success: false, 
                message: 'Não foi possível fazer login com esta conta. Por favor, redefina sua senha ou finalize seu cadastro.' 
            });
        }

        // Verifica se a senha está correta
        const isMatch = await bcrypt.compare(senha, user.senha);
        
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }
        
        // Verifica se o e-mail foi verificado
        if (!user.emailVerificado) {
            return res.status(403).json({ 
                success: false, 
                message: 'Por favor, verifique seu e-mail para fazer login. Verifique sua caixa de entrada ou spam.',
                needsVerification: true,
                email: user.email
            });
        }

        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                tipo: user.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        const responseData = {
            success: true,
            message: 'Login bem-sucedido!',
            token,
            userId: user._id,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl || user.foto,
            userTheme: user.tema || 'light'
        };
        
        res.json(responseData);
    } catch (error) {
        console.error('Erro no login:', error);
        console.error('Stack trace:', error.stack);
        
        // Verifica se a resposta já foi enviada
        if (res.headersSent) {
            console.error('A resposta já foi enviada, não é possível enviar outra resposta.');
            return;
        }
        
        // Para evitar que a Vercel/servidor substitua nossa resposta JSON por HTML genérico,
        // sempre retornamos 200 aqui com success: false.
        res.json({ 
            success: false, 
            message: 'Erro interno do servidor ao fazer login. Tente novamente em alguns instantes.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rota de Cadastro
// Rota para verificar e-mail
app.post('/api/verificar-email', async (req, res) => {
    try {
        const { email, codigo } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({ 
                success: false, 
                message: 'E-mail e código são obrigatórios.' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado.' 
            });
        }

        // Verifica se o e-mail já está verificado
        if (user.emailVerificado) {
            return res.json({ 
                success: true, 
                message: 'E-mail já verificado anteriormente.' 
            });
        }

        // Verifica se o código está correto e não expirou
        const agora = new Date();
        if (user.codigoVerificacao !== codigo || user.codigoExpiracao < agora) {
            return res.status(400).json({ 
                success: false, 
                message: 'Código inválido ou expirado. Por favor, solicite um novo código.' 
            });
        }

        // Atualiza o usuário como verificado
        user.emailVerificado = true;
        user.codigoVerificacao = undefined;
        user.codigoExpiracao = undefined;
        await user.save();

        // Gera token de autenticação
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email, 
                tipo: user.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );

        res.json({
            success: true,
            message: 'E-mail verificado com sucesso!',
            token,
            userId: user._id,
            emailVerificado: true,
            userType: user.tipo,
            userName: user.nome,
            userPhotoUrl: user.avatarUrl,
            userTheme: user.tema || 'light'
        });
    } catch (error) {
        console.error('Erro ao verificar e-mail:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao verificar e-mail.' 
        });
    }
});

// Rota para reenviar código de verificação
app.post('/api/reenviar-codigo', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'E-mail é obrigatório.' 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'Usuário não encontrado.' 
            });
        }

        // Gera novo código de verificação
        const novoCodigo = gerarCodigoVerificacao();
        const dataExpiracao = new Date();
        dataExpiracao.setHours(dataExpiracao.getHours() + 24); // Expira em 24 horas

        // Atualiza os dados do usuário
        user.codigoVerificacao = novoCodigo;
        user.codigoExpiracao = dataExpiracao;
        await user.save();

        // Envia o novo código por e-mail
        const emailEnviado = await enviarEmailVerificacao(email, novoCodigo);
        if (!emailEnviado) {
            return res.status(500).json({ 
                success: false, 
                message: 'Falha ao enviar e-mail de verificação.' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Novo código de verificação enviado para seu e-mail.' 
        });
    } catch (error) {
        console.error('Erro ao reenviar código:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar sua solicitação.' 
        });
    }
});

app.post('/api/cadastro', upload.single('fotoPerfil'), async (req, res) => {
    try {
        const { nome, idade, cidade, estado, tipo, atuacao, telefone, descricao, email, senha, tema } = req.body;
        const avatarFile = req.file;

        if (!nome || !email || !senha || !tipo) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios (Nome, Email, Senha, Tipo) não preenchidos.' });
        }

        const emailNormalizado = email.toLowerCase().trim();

        // Verifica se já existe um usuário com este email
        let usuarioExistente = await User.findOne({ email: emailNormalizado });
        
        // Se existe um usuário verificado, retorna erro
        if (usuarioExistente && usuarioExistente.emailVerificado) {
            return res.status(400).json({ 
                success: false, 
                message: 'Este e-mail já está cadastrado. Por favor, use outro e-mail ou faça login.'
            });
        }

        // Se existe um usuário não verificado (temporário), vamos atualizá-lo
        const atualizarUsuario = usuarioExistente && !usuarioExistente.emailVerificado;

        // Se existe um usuário temporário, verifica se tem código de verificação válido
        if (atualizarUsuario && !usuarioExistente.codigoVerificacao) {
            return res.status(400).json({ 
                success: false, 
                message: 'Por favor, valide o código de verificação primeiro.'
            });
        }

        // --- Lógica de Upload S3 ou Local ---
        let fotoUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
        if (avatarFile) {
            try {
                const sharp = getSharp();
                let imageBuffer;
                const mimeType = avatarFile.mimetype || '';
                
                if (sharp) {
                    // Processa a imagem com Sharp com máxima qualidade
                    // Usa tamanho 1000x1000 para melhor qualidade quando redimensionada pelo navegador
                    let pipeline = sharp(avatarFile.buffer)
                        .resize(1000, 1000, { 
                            fit: 'cover',
                            withoutEnlargement: true, // Não aumenta imagens menores
                            kernel: 'lanczos3' // Melhor algoritmo de redimensionamento
                        });

                    // Mantém PNG/WebP praticamente sem perda, e JPEG com qualidade muito alta
                    if (mimeType.includes('png')) {
                        imageBuffer = await pipeline
                            .png({
                                compressionLevel: 6,
                                adaptiveFiltering: true
                            })
                            .toBuffer();
                    } else if (mimeType.includes('webp')) {
                        imageBuffer = await pipeline
                            .webp({
                                quality: 98,
                                lossless: true
                            })
                            .toBuffer();
                    } else {
                        imageBuffer = await pipeline
                        .jpeg({ 
                            quality: 98, 
                            mozjpeg: true,
                            progressive: true,
                            optimizeScans: true,
                            trellisQuantisation: true,
                            overshootDeringing: true
                        })
                        .toBuffer();
                    }
                } else {
                    // Se Sharp não estiver disponível, usa o buffer original
                    imageBuffer = avatarFile.buffer;
                    console.warn('Sharp não disponível, usando imagem original sem redimensionamento');
                }

                if (s3Client) {
                    // Upload para S3
                    try {
                        const key = `avatars/${Date.now()}_${path.basename(avatarFile.originalname || 'avatar')}`;
                        const uploadCommand = new PutObjectCommand({ 
                            Bucket: bucketName, 
                            Key: key, 
                            Body: imageBuffer, 
                            ContentType: 'image/jpeg' 
                        });
                        await s3Client.send(uploadCommand);
                        fotoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
                        console.log('✅ Foto enviada para S3:', fotoUrl);
                    } catch (s3Error) {
                        console.warn("Falha no upload da foto de perfil para o S3:", s3Error);
                        // Continua para o fallback local
                    }
                }
                
                // Fallback: Salvar localmente se S3 não estiver configurado ou falhou
                if (!s3Client || fotoUrl === 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png') {
                    const uploadsDir = path.join(__dirname, '../public/uploads/avatars');
                    
                    // Cria o diretório se não existir
                    if (!fs.existsSync(uploadsDir)) {
                        fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const fileName = `${Date.now()}_${path.basename(avatarFile.originalname || 'avatar.jpg')}`;
                    const filePath = path.join(uploadsDir, fileName);
                    
                    // Salva o arquivo
                    fs.writeFileSync(filePath, imageBuffer);
                    
                    // URL relativa para servir via express.static
                    fotoUrl = `/uploads/avatars/${fileName}`;
                    console.log('✅ Foto salva localmente:', fotoUrl);
                }
            } catch (uploadError) {
                console.error('Erro ao processar upload da foto:', uploadError);
                // Mantém a foto padrão em caso de erro
            }
        }
        // --- Fim da Lógica de Upload ---

        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);

        let usuarioFinal;

        if (atualizarUsuario) {
            // Atualiza o usuário temporário com os dados completos
            usuarioExistente.nome = nome;
            usuarioExistente.idade = idade;
            usuarioExistente.cidade = cidade;
            usuarioExistente.estado = estado;
            usuarioExistente.tipo = tipo;
            usuarioExistente.atuacao = atuacao || null; // Atuacao é opcional para todos
            usuarioExistente.telefone = telefone;
            usuarioExistente.descricao = descricao;
            usuarioExistente.senha = senhaHash; // Atualiza com a senha hash correta
            usuarioExistente.foto = fotoUrl;
            usuarioExistente.avatarUrl = fotoUrl;
            usuarioExistente.tema = tema || 'light';
            // Marca email como verificado ao finalizar o cadastro
            usuarioExistente.emailVerificado = true;
            usuarioExistente.codigoVerificacao = null;
            usuarioExistente.codigoVerificacaoExpira = null;
            
            // Gera slug de perfil se ainda não existir
            if (!usuarioExistente.slugPerfil) {
                usuarioExistente.slugPerfil = await gerarSlugPerfil(nome);
            }
            
            await usuarioExistente.save();
            usuarioFinal = usuarioExistente;
        } else {
            // Cria novo usuário (caso não tenha passado pela verificação de email)
            const slugPerfil = await gerarSlugPerfil(nome);

            const newUser = new User({
                nome,
                idade,
                cidade,
                estado, 
                tipo,
                atuacao: atuacao || null, // Atuacao é opcional para todos
                telefone,
                descricao,
                email: emailNormalizado,
                senha: senhaHash,
                foto: fotoUrl,
                avatarUrl: fotoUrl,
                slugPerfil,
                tema: tema || 'light',
                emailVerificado: true // Assumindo que já foi verificado antes de chegar aqui
            });

            await newUser.save();
            usuarioFinal = newUser;
        }

        // Gera token de autenticação
        const token = jwt.sign(
            { 
                id: usuarioFinal._id, 
                email: usuarioFinal.email, 
                tipo: usuarioFinal.tipo 
            }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        
        // 🛑 ATUALIZADO: Envia o tema salvo
        res.status(201).json({ 
            success: true, 
            message: 'Cadastro realizado com sucesso!',
            token,
            userId: usuarioFinal._id,
            emailVerificado: usuarioFinal.emailVerificado,
            userType: usuarioFinal.tipo,
            userName: usuarioFinal.nome,
            userPhotoUrl: usuarioFinal.avatarUrl,
            userTheme: usuarioFinal.tema || 'light'
        });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        if (error.code === 11000) {
            return res.status(409).json({ message: 'Este email já está cadastrado.' });
        }
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para solicitar código de redefinição de senha
app.post('/api/esqueci-senha/solicitar', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Verifica se o usuário existe e está verificado
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            // Por segurança, não revela se o email existe ou não
            return res.json({ 
                success: true, 
                message: 'Se o email estiver cadastrado, você receberá um código de verificação.' 
            });
        }

        // Gera código de verificação
        const codigo = gerarCodigoVerificacao();
        const expiraEm = new Date();
        expiraEm.setMinutes(expiraEm.getMinutes() + 10); // Expira em 10 minutos

        // Salva o código no usuário
        usuario.codigoVerificacao = codigo;
        usuario.codigoVerificacaoExpira = expiraEm;
        await usuario.save();

        // Envia código por email
        try {
            await enviarCodigoVerificacao(emailNormalizado, codigo);
        } catch (emailError) {
            console.error('Erro ao enviar email de redefinição:', emailError);
            // Não bloqueia o processo - código já foi salvo
        }

        return res.json({ 
            success: true, 
            message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
            email: emailNormalizado
        });
    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para validar código de redefinição (sem redefinir senha ainda)
app.post('/api/esqueci-senha/validar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ success: false, message: 'Email e código são obrigatórios.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Busca o usuário
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        res.json({ 
            success: true, 
            message: 'Código válido!'
        });
    } catch (error) {
        console.error('Erro ao validar código de redefinição:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// 🆕 NOVO: Rota para validar código e redefinir senha
app.post('/api/esqueci-senha/redefinir', async (req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;
        
        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ success: false, message: 'Email, código e nova senha são obrigatórios.' });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres.' });
        }

        const emailNormalizado = email.toLowerCase().trim();
        
        // Busca o usuário
        const usuario = await User.findOne({ 
            email: emailNormalizado,
            emailVerificado: true
        });

        if (!usuario) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se o código está correto e não expirou
        if (usuario.codigoVerificacao !== codigo) {
            return res.status(400).json({ success: false, message: 'Código de verificação inválido.' });
        }

        if (usuario.codigoVerificacaoExpira && new Date() > usuario.codigoVerificacaoExpira) {
            return res.status(400).json({ success: false, message: 'Código de verificação expirado. Solicite um novo código.' });
        }

        // Hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(novaSenha, salt);

        // Atualiza a senha e limpa o código
        usuario.senha = senhaHash;
        usuario.codigoVerificacao = null;
        usuario.codigoVerificacaoExpira = null;
        await usuario.save();

        res.json({ 
            success: true, 
            message: 'Senha redefinida com sucesso! Você já pode fazer login.'
        });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rota para obter dados do usuário atual
app.get('/api/user/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-senha');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json(user.toObject());
    } catch (error) {
        console.error('Erro ao buscar usuário atual:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Atualizar preferência de tema do usuário
app.put('/api/user/theme', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const tema = String(req.body?.tema || 'light').toLowerCase();
        const temaFinal = tema === 'dark' ? 'dark' : 'light';

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { tema: temaFinal } },
            { new: true, runValidators: true }
        ).select('tema');

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        res.json({ success: true, tema: user.tema });
    } catch (error) {
        console.error('Erro ao atualizar tema do usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/usuario/me', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-senha');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json(user.toObject());
    } catch (error) {
        console.error('Erro ao buscar usuário atual:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/usuario/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).select('-senha');
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        res.json({ success: true, usuario: user.toObject() });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Upload da imagem do anúncio (logo/cartaz). Retorna imagemUrl.
app.post('/api/anuncios/upload-imagem', authMiddleware, uploadAdImage.single('imagem'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }

        const sharp = getSharp();
        let imageBuffer = file.buffer;
        if (sharp) {
            imageBuffer = await sharp(file.buffer)
                .resize(1200, 700, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 90, mozjpeg: true, progressive: true })
                .toBuffer();
        }

        let imagemUrl = '';
        if (s3Client && bucketName && process.env.AWS_REGION) {
            try {
                const safeBase = path.basename(file.originalname || 'anuncio.jpg').replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const key = `anuncios/${req.user.id}/${Date.now()}_${safeBase}`;
                const uploadCommand = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: imageBuffer,
                    ContentType: 'image/jpeg'
                });
                await s3Client.send(uploadCommand);
                imagemUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
            } catch (s3Error) {
                console.warn('Falha no upload da imagem do anúncio para o S3:', s3Error.message);
            }
        }

        if (!imagemUrl) {
            const uploadsDir = path.join(__dirname, '../public/uploads/anuncios');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const fileName = `${Date.now()}_${path.basename(file.originalname || 'anuncio.jpg')}`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, imageBuffer);
            imagemUrl = `/uploads/anuncios/${fileName}`;
        }

        res.json({ success: true, imagemUrl });
    } catch (error) {
        console.error('Erro ao fazer upload da imagem do anúncio:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Criar Anúncio (manual, sem pagamento integrado ainda)
app.post('/api/anuncios', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, imagemUrl, linkUrl, cidade, estado, ativo, plano } = req.body;
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

app.get('/api/anuncios', authMiddleware, async (req, res) => {
    try {
        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

        const anuncios = await AnuncioPago.find({ ownerId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.json({ success: true, anuncios });
    } catch (error) {
        console.error('Erro ao listar anúncios:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar anúncios do feed (prioridade: cidade+estado -> estado -> geral)
app.get('/api/anuncios-feed', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('cidade estado');

        const limitRaw = Number(req.query.limit);
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 30;

        const now = new Date();
        const baseFilter = {
            ativo: true,
            $and: [
                { $or: [{ inicioEm: null }, { inicioEm: { $lte: now } }] },
                { $or: [{ fimEm: null }, { fimEm: { $gte: now } }] }
            ]
        };

        const selected = [];
        const selectedIds = new Set();
        const pushUnique = (items) => {
            (items || []).forEach((it) => {
                const id = String(it._id);
                if (selectedIds.has(id)) return;
                selectedIds.add(id);
                selected.push(it);
            });
        };

        const sortOrder = { prioridade: -1, createdAt: -1 };

        if (user?.cidade && user?.estado) {
            const cidadeRegex = new RegExp(`^${user.cidade}$`, 'i');
            const estadoRegex = new RegExp(`^${user.estado}$`, 'i');

            const locais = await AnuncioPago.find({ ...baseFilter, cidade: cidadeRegex, estado: estadoRegex })
                .sort(sortOrder)
                .limit(limit);
            pushUnique(locais);

            if (selected.length < limit) {
                const estaduais = await AnuncioPago.find({ ...baseFilter, estado: estadoRegex })
                    .sort(sortOrder)
                    .limit(limit);
                pushUnique(estaduais);
            }
        } else if (user?.estado) {
            const estadoRegex = new RegExp(`^${user.estado}$`, 'i');
            const estaduais = await AnuncioPago.find({ ...baseFilter, estado: estadoRegex })
                .sort(sortOrder)
                .limit(limit);
            pushUnique(estaduais);
        } else if (user?.cidade) {
            const cidadeRegex = new RegExp(`^${user.cidade}$`, 'i');
            const locais = await AnuncioPago.find({ ...baseFilter, cidade: cidadeRegex })
                .sort(sortOrder)
                .limit(limit);
            pushUnique(locais);
        }

        if (selected.length < limit) {
            const gerais = await AnuncioPago.find({ ...baseFilter })
                .sort(sortOrder)
                .limit(limit);
            pushUnique(gerais);
        }

        const expanded = [];
        for (const a of selected) {
            const slots = a?.plano === 'premium' ? 3 : 1;
            for (let i = 0; i < slots; i += 1) {
                expanded.push({
                    _id: a._id,
                    _feedKey: `${String(a._id)}:${i}`,
                    titulo: a.titulo,
                    descricao: a.descricao,
                    imagemUrl: a.imagemUrl,
                    linkUrl: a.linkUrl,
                    cidade: a.cidade,
                    estado: a.estado,
                    plano: a.plano
                });
            }
        }

        const anuncios = expanded.slice(0, limit);

        res.json({ success: true, anuncios });
    } catch (error) {
        console.error('Erro ao buscar anúncios do feed:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Sugestões de cidades (autocomplete) - retorna cidades do banco conforme o usuário digita
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

        // Busca cidades dos usuários e filtra no Node para ficar tolerante a acentos.
        // Para 1 letra, reduz o universo com regex de prefixo.
        const baseQuery = { cidade: { $exists: true, $ne: '' } };
        const mongoQuery = (q.length === 1)
            ? { ...baseQuery, cidade: { $regex: new RegExp(`^${escapeRegex(q)}`, 'i') } }
            : baseQuery;

        const usuarios = await User.find(mongoQuery)
            .select('cidade')
            .lean();

        const seen = new Map(); // key normalizada -> valor original
        for (const u of usuarios) {
            const cidade = (u && u.cidade) ? String(u.cidade).trim() : '';
            if (!cidade) continue;
            const key = normalizeString(cidade);
            if (!key) continue;

            // Para 1 letra: só "começa com" (evita muitas sugestões irrelevantes)
            // Para 2+ letras: "começa com" OU "contém" (mais flexível)
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
        console.error('Erro ao buscar sugestões de cidades:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const posts = await Postagem.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado')
            .populate({
                path: 'comments.userId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'comments.replies.userId',
                select: 'nome foto avatarUrl'
            })
            .exec();

        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar Postagens de um Usuário
app.get('/api/user-posts/:userId', authMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const posts = await Postagem.find({ userId: userId })
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado')
            .populate({
                path: 'comments.userId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'comments.replies.userId',
                select: 'nome foto avatarUrl'
            })
            .exec();
        res.json(posts);
    } catch (error) {
        console.error('Erro ao buscar postagens do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// Curtir/Descurtir Postagem
app.post('/api/posts/:postId/like', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        const likeIndex = post.likes.indexOf(userId);
        const isLiking = likeIndex === -1; // Se não está na lista, está curtindo
        
        if (likeIndex > -1) {
            post.likes.splice(likeIndex, 1); // Descurtir
        } else {
            post.likes.push(userId); // Curtir
            
            // Cria notificação para o dono do post (se não for ele mesmo)
            if (post.userId.toString() !== userId.toString()) {
                try {
                    const usuarioQueCurtiu = await User.findById(userId).select('nome');
                    const nomeUsuario = usuarioQueCurtiu?.nome || 'Alguém';
                    
                    await criarNotificacao(
                        post.userId,
                        'post_curtido',
                        'Nova curtida no seu post',
                        `${nomeUsuario} curtiu seu post`,
                        {
                            postId: post._id.toString(),
                            usuarioId: userId.toString(),
                            usuarioNome: nomeUsuario
                        },
                        null
                    );
                } catch (notifError) {
                    console.error('Erro ao criar notificação de curtida:', notifError);
                }
            }
        }
        await post.save();
        res.json({ success: true, likes: post.likes });
    } catch (error) {
        console.error('Erro ao curtir postagem:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Adicionar Comentário
app.post('/api/posts/:postId/comment', authMiddleware, async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        // Garante que userId seja ObjectId válido
        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;

        const newComment = {
            userId: userIdObjectId,
            content,
            likes: [],
            replies: [],
            createdAt: new Date()
        };

        const post = await Postagem.findById(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Postagem não encontrada.' });
        }
        
        // Adiciona o comentário
        post.comments.push(newComment);
        await post.save();
        
        const addedComment = post.comments[post.comments.length - 1];
        await User.populate(addedComment, { path: 'userId', select: 'nome foto avatarUrl' });
        
        // Cria notificação para o dono do post (se não for ele mesmo)
        // Popula o userId do post se necessário
        if (!post.userId || typeof post.userId === 'string') {
            await post.populate('userId', 'nome');
        }
        
        const postOwnerId = post.userId?._id?.toString() || post.userId?.toString() || post.userId;
        if (postOwnerId && postOwnerId.toString() !== userId.toString()) {
            try {
                const usuarioQueComentou = await User.findById(userId).select('nome');
                const nomeUsuario = usuarioQueComentou?.nome || 'Alguém';
                const previewComentario = content.length > 50 ? content.substring(0, 50) + '...' : content;
                
                await criarNotificacao(
                    postOwnerId,
                    'post_comentado',
                    'Novo comentário no seu post',
                    `${nomeUsuario} comentou: "${previewComentario}"`,
                    {
                        postId: post._id.toString(),
                        comentarioId: addedComment._id.toString(),
                        usuarioId: userId.toString(),
                        usuarioNome: nomeUsuario
                    },
                    null
                );
            } catch (notifError) {
                console.error('Erro ao criar notificação de comentário:', notifError);
            }
        }
        
        res.status(201).json({ success: true, comment: addedComment });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// ----------------------------------------------------------------------
// ROTAS DE INTERAÇÃO COM COMENTÁRIOS
// ----------------------------------------------------------------------

// Curtir/Descurtir Comentário
app.post('/api/posts/:postId/comments/:commentId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });
        
        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const likeIndex = comment.likes.indexOf(userId);
        const isLiking = likeIndex === -1; // Se não está na lista, está curtindo
        
        if (likeIndex > -1) {
            comment.likes.splice(likeIndex, 1); // Descurtir
        } else {
            comment.likes.push(userId); // Curtir
            
            // Cria notificação para o dono do comentário (se não for ele mesmo)
            const comentarioUserId = comment.userId.toString();
            if (comentarioUserId !== userId.toString()) {
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
                            commentId: commentId
                        },
                        null
                    );
                } catch (notifError) {
                    console.error('Erro ao criar notificação de comentário curtido:', notifError);
                }
            }
        }
        
        await post.save();
        res.json({ success: true, likes: comment.likes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Responder a um Comentário
app.post('/api/posts/:postId/comments/:commentId/reply', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        // Garante que userId seja ObjectId válido
        const userIdObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        const newReply = {
            userId: userIdObjectId,
            content,
            likes: [],
            createdAt: new Date()
        };

        comment.replies.push(newReply);
        await post.save();

        const addedReply = comment.replies[comment.replies.length - 1];
        await User.populate(addedReply, { path: 'userId', select: 'nome foto avatarUrl' });
        
        // Cria notificação para quem fez o comentário original (se não for ele mesmo)
        // Normaliza os IDs para comparação correta
        const comentarioUserId = comment.userId?._id ? comment.userId._id.toString() : (comment.userId?.toString() || String(comment.userId));
        const userIdStr = userIdObjectId.toString();
        
        console.log('📝 Criando notificação de resposta:', {
            comentarioUserId,
            userIdStr,
            commentUserIdType: typeof comment.userId,
            commentUserIdValue: comment.userId,
            saoDiferentes: comentarioUserId !== userIdStr,
            postId: post._id.toString(),
            commentId: comment._id.toString(),
            replyId: addedReply._id.toString()
        });
        
        if (comentarioUserId && comentarioUserId !== userIdStr) {
            try {
                const usuarioQueRespondeu = await User.findById(userId).select('nome');
                const nomeUsuario = usuarioQueRespondeu?.nome || 'Alguém';
                const previewResposta = content.length > 50 ? content.substring(0, 50) + '...' : content;
                
                console.log('📤 Enviando notificação para:', {
                    destinatario: comentarioUserId,
                    tipo: 'comentario_respondido',
                    titulo: 'Nova resposta ao seu comentário',
                    mensagem: `${nomeUsuario} respondeu seu comentário: "${previewResposta}"`
                });
                
                const notificacaoCriada = await criarNotificacao(
                    comentarioUserId,
                    'comentario_respondido',
                    'Nova resposta ao seu comentário',
                    `${nomeUsuario} respondeu seu comentário: "${previewResposta}"`,
                    {
                        postId: post._id.toString(),
                        comentarioId: comment._id.toString(),
                        respostaId: addedReply._id.toString(),
                        usuarioId: userIdStr,
                        usuarioNome: nomeUsuario
                    },
                    null
                );
                
                console.log('✅ Notificação de resposta criada:', notificacaoCriada ? 'Sucesso' : 'Falha');
            } catch (notifError) {
                console.error('❌ Erro ao criar notificação de resposta:', notifError);
            }
        } else {
            console.log('ℹ️ Usuário respondeu seu próprio comentário ou comentarioUserId inválido, notificação não será criada');
        }
        
        res.status(201).json({ success: true, reply: addedReply });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Deletar um Comentário (Dono do Post)
app.delete('/api/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });

        // Função auxiliar para normalizar ID para string
        const normalizeId = (id) => {
            if (!id) return '';
            // Se for ObjectId do mongoose, usa toString()
            if (id.toString && typeof id.toString === 'function' && id.constructor && id.constructor.name === 'ObjectId') {
                return id.toString();
            }
            // Se for objeto populado (tem _id)
            if (id._id) {
                return String(id._id);
            }
            // Caso padrão: converte para string
            return String(id);
        };

        // Normaliza todos os IDs
        const postUserIdStr = normalizeId(post.userId);
        const commentUserIdStr = normalizeId(comment.userId);
        const currentUserIdStr = normalizeId(userId);
        
        // Comparação direta (mais confiável)
        const isPostOwner = postUserIdStr === currentUserIdStr && postUserIdStr !== '';
        const isCommentOwner = commentUserIdStr === currentUserIdStr && commentUserIdStr !== '';
        
        // Log detalhado para debug
        console.log('🔍 Verificando permissão de deletar comentário:', {
            postUserId: postUserIdStr,
            commentUserId: commentUserIdStr,
            currentUserId: currentUserIdStr,
            postUserIdRaw: post.userId,
            commentUserIdRaw: comment.userId,
            currentUserIdRaw: userId,
            postUserIdType: typeof post.userId,
            commentUserIdType: typeof comment.userId,
            commentUserIdConstructor: comment.userId?.constructor?.name,
            isPostOwner,
            isCommentOwner,
            lengths: {
                postUserId: postUserIdStr.length,
                commentUserId: commentUserIdStr.length,
                currentUserId: currentUserIdStr.length
            }
        });

        if (!isPostOwner && !isCommentOwner) {
            console.log('❌ Permissão negada:', { 
                isPostOwner, 
                isCommentOwner,
                postUserId: postUserIdStr,
                commentUserId: commentUserIdStr,
                currentUserId: currentUserIdStr,
                comparison: {
                    postMatch: postUserIdStr === currentUserIdStr,
                    commentMatch: commentUserIdStr === currentUserIdStr
                }
            });
            return res.status(403).json({ success: false, message: 'Ação não permitida.' });
        }
        
        console.log('✅ Permissão concedida:', { isPostOwner, isCommentOwner });

        comment.deleteOne(); // Remove o subdocumento
        await post.save();
        
        res.json({ success: true, message: 'Comentário deletado.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Editar um Comentário (Apenas dono do comentário)
app.put('/api/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        console.log(`[PUT] Editando comentário - PostId: ${postId}, CommentId: ${commentId}, UserId: ${userId}`);

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'O conteúdo do comentário não pode estar vazio.' });
        }

        const post = await Postagem.findById(postId);
        if (!post) {
            console.log(`[PUT] Post não encontrado: ${postId}`);
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const comment = post.comments.id(commentId);
        if (!comment) {
            console.log(`[PUT] Comentário não encontrado: ${commentId}`);
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        // Função auxiliar para normalizar ID
        const normalizeId = (id) => {
            if (!id) return '';
            if (id.toString && typeof id.toString === 'function' && id.constructor && id.constructor.name === 'ObjectId') {
                return id.toString();
            }
            if (id._id) {
                return String(id._id);
            }
            return String(id);
        };

        const commentUserIdStr = normalizeId(comment.userId);
        const currentUserIdStr = normalizeId(userId);

        console.log(`[PUT] Verificando permissão - CommentUserId: ${commentUserIdStr}, CurrentUserId: ${currentUserIdStr}`);

        // Apenas o dono do comentário pode editar
        if (commentUserIdStr !== currentUserIdStr) {
            console.log(`[PUT] Permissão negada - usuário não é dono do comentário`);
            return res.status(403).json({ success: false, message: 'Você só pode editar seus próprios comentários.' });
        }

        comment.content = content.trim();
        await post.save();

        console.log(`[PUT] Comentário editado com sucesso - CommentId: ${commentId}`);
        res.json({ success: true, message: 'Comentário editado com sucesso.', comment });
    } catch (error) {
        console.error('[PUT] Erro ao editar comentário:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Curtir/Descurtir uma Resposta (Reply)
app.post('/api/posts/:postId/comments/:commentId/replies/:replyId/like', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });
        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });
        const reply = comment.replies.id(replyId);
        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        const likeIndex = reply.likes.indexOf(userId);
        const isLiking = likeIndex === -1; // Se não está na lista, está curtindo
        
        if (likeIndex > -1) {
            reply.likes.splice(likeIndex, 1); // Descurtir
        } else {
            reply.likes.push(userId); // Curtir
            
            // Cria notificação para o dono da resposta (se não for ele mesmo)
            const respostaUserId = reply.userId.toString();
            if (respostaUserId !== userId.toString()) {
                try {
                    const usuarioQueCurtiu = await User.findById(userId).select('nome');
                    const nomeUsuario = usuarioQueCurtiu?.nome || 'Alguém';
                    
                    await criarNotificacao(
                        respostaUserId,
                        'resposta_curtida',
                        'Sua resposta recebeu uma curtida',
                        `${nomeUsuario} curtiu sua resposta`,
                        {
                            postId: postId,
                            commentId: commentId,
                            replyId: replyId
                        },
                        null
                    );
                } catch (notifError) {
                    console.error('Erro ao criar notificação de resposta curtida:', notifError);
                }
            }
        }
        
        await post.save();
        res.json({ success: true, likes: reply.likes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Deletar uma Resposta (Reply) (Dono do Post OU dono da resposta)
app.delete('/api/posts/:postId/comments/:commentId/replies/:replyId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const userId = req.user.id;

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ message: 'Post não encontrado' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ message: 'Comentário não encontrado' });
        
        const reply = comment.replies.id(replyId);
        if (!reply) return res.status(404).json({ message: 'Resposta não encontrada' });

        // Função auxiliar para normalizar ID para string
        const normalizeId = (id) => {
            if (!id) return '';
            // Se for ObjectId do mongoose, usa toString()
            if (id.toString && typeof id.toString === 'function' && id.constructor && id.constructor.name === 'ObjectId') {
                return id.toString();
            }
            // Se for objeto populado (tem _id)
            if (id._id) {
                return String(id._id);
            }
            // Caso padrão: converte para string
            return String(id);
        };

        // Normaliza todos os IDs
        const postUserIdStr = normalizeId(post.userId);
        const replyUserIdStr = normalizeId(reply.userId);
        const currentUserIdStr = normalizeId(userId);
        
        // Comparação direta (mais confiável)
        const isPostOwner = postUserIdStr === currentUserIdStr && postUserIdStr !== '';
        const isReplyOwner = replyUserIdStr === currentUserIdStr && replyUserIdStr !== '';
        
        // Log detalhado para debug
        console.log('🔍 Verificando permissão de deletar resposta:', {
            postUserId: postUserIdStr,
            replyUserId: replyUserIdStr,
            currentUserId: currentUserIdStr,
            postUserIdRaw: post.userId,
            replyUserIdRaw: reply.userId,
            currentUserIdRaw: userId,
            postUserIdType: typeof post.userId,
            replyUserIdType: typeof reply.userId,
            replyUserIdConstructor: reply.userId?.constructor?.name,
            isPostOwner,
            isReplyOwner,
            lengths: {
                postUserId: postUserIdStr.length,
                replyUserId: replyUserIdStr.length,
                currentUserId: currentUserIdStr.length
            }
        });

        if (!isPostOwner && !isReplyOwner) {
            console.log('❌ Permissão negada (reply):', { 
                isPostOwner, 
                isReplyOwner,
                postUserId: postUserIdStr,
                replyUserId: replyUserIdStr,
                currentUserId: currentUserIdStr,
                comparison: {
                    postMatch: postUserIdStr === currentUserIdStr,
                    replyMatch: replyUserIdStr === currentUserIdStr
                }
            });
            return res.status(403).json({ success: false, message: 'Ação não permitida.' });
        }
        
        console.log('✅ Permissão concedida (reply):', { isPostOwner, isReplyOwner });

        reply.deleteOne(); // Remove o subdocumento
        await post.save();
        
        res.json({ success: true, message: 'Resposta deletada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Editar uma Resposta (Apenas dono da resposta)
app.put('/api/posts/:postId/comments/:commentId/replies/:replyId', authMiddleware, async (req, res) => {
    try {
        const { postId, commentId, replyId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'O conteúdo da resposta não pode estar vazio.' });
        }

        const post = await Postagem.findById(postId);
        if (!post) return res.status(404).json({ success: false, message: 'Post não encontrado' });

        const comment = post.comments.id(commentId);
        if (!comment) return res.status(404).json({ success: false, message: 'Comentário não encontrado' });

        const reply = comment.replies.id(replyId);
        if (!reply) return res.status(404).json({ success: false, message: 'Resposta não encontrada' });

        // Função auxiliar para normalizar ID
        const normalizeId = (id) => {
            if (!id) return '';
            if (id.toString && typeof id.toString === 'function' && id.constructor && id.constructor.name === 'ObjectId') {
                return id.toString();
            }
            if (id._id) {
                return String(id._id);
            }
            return String(id);
        };

        const replyUserIdStr = normalizeId(reply.userId);
        const currentUserIdStr = normalizeId(userId);

        // Apenas o dono da resposta pode editar
        if (replyUserIdStr !== currentUserIdStr) {
            return res.status(403).json({ success: false, message: 'Você só pode editar suas próprias respostas.' });
        }

        reply.content = content.trim();
        await post.save();

        res.json({ success: true, message: 'Resposta editada com sucesso.', reply });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// ----------------------------------------------------------------------
// ROTAS DE SERVIÇOS E AVALIAÇÃO
// ----------------------------------------------------------------------
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
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 30;

        const filter = {
            tipo: 'trabalhador',
            mediaAvaliacao: { $gte: 4.5 },
            totalAvaliacoes: { $gte: 50 }
        };

        console.log('🔍 Buscando destaques com filtro:', JSON.stringify(filter, null, 2));

        const selected = [];
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
                .limit(limit);
            pushUnique(locais);

            if (selected.length < limit) {
                console.log(`📍 Buscando profissionais no estado ${user.estado}`);
                const estaduais = await User.find({ ...filter, estado: estadoRegex })
                    .select(baseSelect)
                    .sort(baseSort)
                    .limit(limit);
                pushUnique(estaduais);
            }
        } else if (user?.estado) {
            const estadoRegex = new RegExp(`^${user.estado}$`, 'i');
            console.log(`📍 Buscando profissionais no estado ${user.estado}`);
            const estaduais = await User.find({ ...filter, estado: estadoRegex })
                .select(baseSelect)
                .sort(baseSort)
                .limit(limit);
            pushUnique(estaduais);
        } else if (user?.cidade) {
            const cidadeRegex = new RegExp(`^${user.cidade}$`, 'i');
            console.log(`📍 Buscando profissionais em ${user.cidade}`);
            const locais = await User.find({ ...filter, cidade: cidadeRegex })
                .select(baseSelect)
                .sort(baseSort)
                .limit(limit);
            pushUnique(locais);
        }

        if (selected.length < limit) {
            console.log('🌎 Buscando profissionais gerais (fallback)');
            const gerais = await User.find({ ...filter })
                .select(baseSelect)
                .sort(baseSort)
                .limit(limit);
            pushUnique(gerais);
        }

        let destaques = selected.slice(0, limit);

        const usuarioCompleto = await User.findById(req.user.id).select('avaliacoes mediaAvaliacao totalAvaliacoes tipo');
        if (usuarioCompleto) {
            const totalAvaliacoesUsuario = usuarioCompleto.avaliacoes?.length || usuarioCompleto.totalAvaliacoes || 0;
            const mediaAvaliacaoUsuario = usuarioCompleto.mediaAvaliacao || 0;
            console.log(`👤 Verificando perfil do usuário logado: ${mediaAvaliacaoUsuario} estrelas, ${totalAvaliacoesUsuario} avaliações`);

            if (mediaAvaliacaoUsuario >= 4.5 && totalAvaliacoesUsuario >= 50) {
                const userIdStr = usuarioCompleto._id.toString();
                const jaEstaNaLista = destaques.some(d => d._id.toString() === userIdStr);
                if (!jaEstaNaLista) {
                    const usuarioDestaque = await User.findById(req.user.id)
                        .select(baseSelect);
                    if (usuarioDestaque) {
                        destaques.unshift(usuarioDestaque);
                        destaques = destaques.slice(0, limit);
                    }
                }
            } else {
                console.log(`⚠️ Perfil do usuário não atende aos critérios: precisa 4.5+ estrelas (tem ${mediaAvaliacaoUsuario}) e 50+ avaliações (tem ${totalAvaliacoesUsuario})`);
            }
        }

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

// 🌟 NOVO: Criar Avaliação Verificada (após serviço concluído)
app.post('/api/avaliacao-verificada', authMiddleware, async (req, res) => {
    try {
        let { profissionalId, agendamentoId, pedidoUrgenteId, estrelas, comentario, dataServico, servico } = req.body;
        const clienteId = req.user.id;
        
        console.log('💾 Criando avaliação verificada - IDs:', {
            reqUserId: req.user.id,
            reqUserIdString: String(req.user.id),
            reqUserEmail: req.user.email,
            profissionalId: profissionalId,
            profissionalIdString: String(profissionalId)
        });

        let nomeServico = servico || '';
        let dataServicoFinal = dataServico;

        // Se tem pedidoUrgenteId (pedido urgente sem agendamento), valida o pedido primeiro
        if (pedidoUrgenteId) {
            const pedido = await PedidoUrgente.findById(pedidoUrgenteId);
            if (!pedido) {
                return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
            }

            if (pedido.clienteId.toString() !== clienteId) {
                return res.status(403).json({ success: false, message: 'Você não pode avaliar este serviço.' });
            }

            if (pedido.status !== 'concluido') {
                return res.status(400).json({ success: false, message: 'O serviço precisa estar concluído para ser avaliado.' });
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
        // Se não tem nem agendamentoId nem pedidoUrgenteId, retorna erro
        else {
            return res.status(400).json({ success: false, message: 'É necessário informar um agendamentoId ou pedidoUrgenteId.' });
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
                message: 'Arquivo muito grande. Tamanho máximo: 10MB por arquivo.' 
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

                // Processa cada foto sequencialmente para evitar problemas de concorrência
                for (let i = 0; i < req.files.length; i++) {
                    const file = req.files[i];
                    try {
                        if (!file) {
                            console.warn(`Arquivo ${i + 1} é null ou undefined`);
                            continue;
                        }
                        
                        if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
                            console.warn(`Arquivo ${i + 1} não tem buffer válido`);
                            continue;
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
                                console.log(`✅ Foto ${i + 1} enviada para S3: ${key}`);
                            } catch (s3Error) {
                                console.warn(`Falha ao enviar foto ${i + 1} para S3, usando fallback local:`, s3Error.message);
                            }
                        }

                        // Fallback local se não houver S3 ou se o upload falhar
                        if (!urlFoto) {
                            try {
                                const fileName = `${timestamp}_${i}_${randomStr}_${safeBaseName}.jpg`;
                                const filePath = path.join(uploadsDir, fileName);
                                fs.writeFileSync(filePath, imageBuffer);
                                urlFoto = `/uploads/pedidos-urgentes/${fileName}`;
                                console.log(`✅ Foto ${i + 1} salva localmente: ${fileName}`);
                            } catch (fsError) {
                                console.error(`Erro ao salvar foto ${i + 1} localmente:`, fsError.message);
                                console.error('Stack:', fsError.stack);
                                continue; // Pula esta foto e continua com as próximas
                            }
                        }

                        if (urlFoto) {
                            fotosUrls.push(urlFoto);
                            // A primeira foto também é salva em fotoUrl para compatibilidade
                            if (!fotoUrl) {
                                fotoUrl = urlFoto;
                            }
                        }
                    } catch (fotoError) {
                        console.error(`Erro ao processar foto ${i + 1} do pedido urgente:`, fotoError);
                        console.error('Stack:', fotoError.stack);
                        // Continua processando as outras fotos mesmo se uma falhar
                    }
                }
                
                if (fotosUrls.length > 0) {
                    console.log(`✅ ${fotosUrls.length} de ${req.files.length} foto(s) de pedido urgente processada(s) com sucesso`);
                } else {
                    console.warn('⚠️ Nenhuma foto foi processada com sucesso, mas o pedido será criado sem fotos');
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
            dataExpiracao
        };
        
        console.log('📝 Dados do pedido a serem salvos:', {
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
            console.log('🔄 Criando instância do PedidoUrgente...');
            novoPedido = new PedidoUrgente(dadosPedido);
            console.log('🔄 Salvando pedido no banco...');
            await novoPedido.save();
            console.log(`✅ Pedido urgente criado com sucesso: ${novoPedido._id} (${fotosUrls.length} foto(s))`);
        } catch (saveError) {
            console.error('❌ Erro ao salvar pedido urgente no banco:', saveError);
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
        const notificacoesCriadas = [];
        for (const prof of profissionais) {
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
                if (notif) notificacoesCriadas.push(notif._id);
            } catch (err) {
                console.error('Erro ao criar notificação para profissional', prof._id, err);
            }
        }

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
        console.error('Tipo do erro:', typeof error);
        console.error('Mensagem do erro:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Se a resposta já foi enviada, não tenta enviar novamente
        if (res.headersSent) {
            console.error('⚠️ Resposta já foi enviada, não é possível enviar erro');
            return;
        }
        
        // Retorna mensagem de erro mais específica em desenvolvimento
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

// Enviar Proposta Rápida para Pedido Urgente
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

        // Impede que o próprio criador envie proposta para o seu pedido
        if (pedido.clienteId.toString() === profissionalId) {
            return res.status(400).json({ success: false, message: 'Você não pode enviar proposta para um pedido criado por você.' });
        }

        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este pedido não está mais aceitando propostas.' });
        }

        if (new Date() > pedido.dataExpiracao) {
            return res.status(400).json({ success: false, message: 'Este pedido expirou.' });
        }

        // Verifica se já enviou proposta (permite reenviar caso tenha sido rejeitada/cancelada)
        let propostaIdParaNotificacao = null;
        const propostaExistente = pedido.propostas.find(p => p.profissionalId.toString() === profissionalId);
        if (propostaExistente) {
            if (propostaExistente.status === 'rejeitada' || propostaExistente.status === 'cancelada') {
                propostaExistente.valor = valor;
                propostaExistente.tempoChegada = tempoChegada;
                propostaExistente.observacoes = observacoes;
                propostaExistente.status = 'pendente';
                propostaExistente.dataProposta = new Date();
                propostaIdParaNotificacao = propostaExistente._id;
            } else {
                return res.status(400).json({ success: false, message: 'Você já enviou uma proposta para este pedido.' });
            }
        } else {
            pedido.propostas.push({
                profissionalId,
                valor,
                tempoChegada,
                observacoes,
                status: 'pendente'
            });
            propostaIdParaNotificacao = pedido.propostas[pedido.propostas.length - 1]._id;
        }

        await pedido.save();

        // Cria notificação para o usuário sobre a nova proposta
        try {
            const cliente = await User.findById(pedido.clienteId);
            if (cliente) {
                // Remove notificações antigas dessa mesma proposta (evita duplicidade ao reenviar)
                try {
                    await Notificacao.deleteMany({
                        userId: pedido.clienteId,
                        tipo: 'proposta_pedido_urgente',
                        'dadosAdicionais.pedidoId': pedido._id,
                        'dadosAdicionais.propostaId': propostaIdParaNotificacao,
                        'dadosAdicionais.profissionalId': profissionalId
                    });
                } catch (delNotifErr) {
                    console.warn('⚠️ Falha ao limpar notificações antigas de proposta:', delNotifErr);
                }

                const titulo = 'Nova proposta recebida!';
                const mensagem = `${profissional.nome} enviou uma proposta de R$ ${valor.toFixed(2)} para seu pedido: ${pedido.servico}`;
                await criarNotificacao(
                    pedido.clienteId,
                    'proposta_pedido_urgente',
                    titulo,
                    mensagem,
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
            // Não falha a operação principal se a notificação falhar
        }
        
        res.json({ success: true, message: 'Proposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Propostas de um Pedido Urgente (para o cliente)
app.get('/api/pedidos-urgentes/:pedidoId/propostas', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId)
            .populate('propostas.profissionalId', 'nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .exec();

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Acesso negado.' });
        }

        // Não mostra propostas canceladas (profissional cancelou antes de aceitar/recusar)
        const propostasVisiveis = (pedido.propostas || []).filter(p => p && p.status !== 'cancelada');

        res.json({ 
            success: true, 
            propostas: propostasVisiveis,
            pedido: {
                _id: pedido._id,
                servico: pedido.servico,
                descricao: pedido.descricao,
                foto: pedido.foto,
                categoria: pedido.categoria,
                localizacao: pedido.localizacao,
                tipoAtendimento: pedido.tipoAtendimento,
                dataAgendada: pedido.dataAgendada
            }
        });
    } catch (error) {
        console.error('Erro ao buscar propostas:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar proposta enviada (profissional)
app.post('/api/pedidos-urgentes/:pedidoId/cancelar-proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const profissionalId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido urgente não encontrado.' });
        }

        // Só cancela se o pedido ainda estiver aberto
        if (pedido.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este pedido não aceita mais alterações de proposta.' });
        }

        const proposta = (pedido.propostas || []).find(
            p => p && p.profissionalId && p.profissionalId.toString() === profissionalId
        );
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Você não tem proposta neste pedido.' });
        }

        if (proposta.status !== 'pendente') {
            return res.status(400).json({ success: false, message: 'Não é possível cancelar uma proposta que já foi processada.' });
        }

        proposta.status = 'cancelada';
        await pedido.save();

        // Apaga a notificação de "nova proposta" que chegou para o cliente (se existir)
        try {
            await Notificacao.deleteMany({
                userId: pedido.clienteId,
                tipo: 'proposta_pedido_urgente',
                'dadosAdicionais.pedidoId': pedido._id,
                'dadosAdicionais.propostaId': proposta._id,
                'dadosAdicionais.profissionalId': profissionalId
            });
        } catch (delNotifErr) {
            console.warn('⚠️ Falha ao deletar notificação de proposta do cliente:', delNotifErr);
        }

        return res.json({
            success: true,
            message: 'Proposta cancelada com sucesso.',
            pedidoId: pedido._id,
            propostaId: proposta._id
        });
    } catch (error) {
        console.error('Erro ao cancelar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Recusar Proposta de Pedido Urgente (cliente não gostou da proposta)
app.post('/api/pedidos-urgentes/:pedidoId/recusar-proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { propostaId } = req.body;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o criador do pedido pode recusar propostas.' });
        }

        const proposta = pedido.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }

        if (proposta.status === 'aceita') {
            return res.status(400).json({ success: false, message: 'Não é possível recusar uma proposta já aceita.' });
        }

        proposta.status = 'rejeitada';
        await pedido.save();

        // Notifica o profissional que a proposta foi recusada
        try {
            const profissional = await User.findById(proposta.profissionalId);
            const cliente = await User.findById(clienteId);
            if (profissional && cliente) {
                const titulo = 'Sua proposta foi recusada';
                const mensagem = `${cliente.nome} recusou sua proposta para o pedido: ${pedido.servico}.`;
                await criarNotificacao(
                    proposta.profissionalId,
                    'proposta_pedido_urgente',
                    titulo,
                    mensagem,
                    {
                        pedidoId: pedido._id,
                        propostaId: proposta._id,
                        servico: pedido.servico,
                        status: 'rejeitada'
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta recusada:', notifError);
        }

        return res.json({ success: true, message: 'Proposta recusada com sucesso.', pedido });
    } catch (error) {
        console.error('Erro ao recusar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar um pedido urgente por ID (dados básicos e foto) - restringe a ObjectId para não conflitar com /ativos, /meus etc.
app.get('/api/pedidos-urgentes/:pedidoId([a-fA-F0-9]{24})', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const pedido = await PedidoUrgente.findById(pedidoId)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('propostas.profissionalId', 'nome foto avatarUrl atuacao cidade estado')
            .exec();

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        // Prepara as propostas com usuarioId (alias de profissionalId para compatibilidade)
        const propostasFormatadas = pedido.propostas.map(prop => ({
            _id: prop._id,
            profissionalId: prop.profissionalId?._id || prop.profissionalId,
            usuarioId: prop.profissionalId?._id || prop.profissionalId, // Alias para compatibilidade
            valor: prop.valor,
            tempoChegada: prop.tempoChegada,
            observacoes: prop.observacoes,
            status: prop.status,
            dataProposta: prop.dataProposta,
            profissional: prop.profissionalId // Dados populados do profissional
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
                clienteId: pedido.clienteId,
                propostas: propostasFormatadas,
                propostaSelecionada: pedido.propostaSelecionada,
                status: pedido.status
            }
        });
    } catch (error) {
        console.error('Erro ao buscar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar Proposta de Pedido Urgente
app.post('/api/pedidos-urgentes/:pedidoId/aceitar-proposta', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { propostaId } = req.body;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o criador do pedido pode aceitar propostas.' });
        }

        const proposta = pedido.propostas.id(propostaId);
        if (!proposta) {
            return res.status(404).json({ success: false, message: 'Proposta não encontrada.' });
        }

        // Rejeita outras propostas
        pedido.propostas.forEach(p => {
            if (p._id.toString() !== propostaId) {
                p.status = 'rejeitada';
            }
        });

        proposta.status = 'aceita';
        pedido.propostaSelecionada = propostaId;

        // Cria agendamento automaticamente
        const dataHoraServico = pedido.dataAgendada || new Date(); // Se tiver horário agendado, usa ele

        const agendamento = new Agendamento({
            profissionalId: proposta.profissionalId,
            clienteId,
            dataHora: dataHoraServico,
            servico: pedido.servico,
            observacoes: `Pedido urgente: ${pedido.descricao || ''}. ${proposta.observacoes || ''}`,
            endereco: pedido.localizacao,
            status: 'confirmado'
        });

        await agendamento.save();

        // Vincula o agendamento ao pedido e marca como em andamento
        pedido.agendamentoId = agendamento._id;
        pedido.status = 'em_andamento';
        await pedido.save();

        // Notifica o profissional que a proposta foi aceita
        try {
            const profissional = await User.findById(proposta.profissionalId);
            if (profissional) {
                const titulo = 'Sua proposta foi aceita!';
                const mensagem = `Um usuário aceitou sua proposta para o pedido urgente: ${pedido.servico}. Prepare-se para o atendimento.`;
                await criarNotificacao(
                    proposta.profissionalId,
                    'proposta_aceita',
                    titulo,
                    mensagem,
                    {
                        pedidoId: pedido._id,
                        agendamentoId: agendamento._id
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta aceita para o profissional:', notifError);
        }

        // Notifica o usuário que a proposta foi aceita (para sincronização e atualização do modal)
        try {
            const cliente = await User.findById(clienteId);
            if (cliente) {
                const titulo = 'Proposta aceita!';
                const mensagem = `Você aceitou a proposta para o pedido: ${pedido.servico}. O serviço está em andamento.`;
                await criarNotificacao(
                    clienteId,
                    'proposta_aceita',
                    titulo,
                    mensagem,
                    {
                        pedidoId: pedido._id,
                        agendamentoId: agendamento._id
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de proposta aceita para o usuário:', notifError);
        }
        
        res.json({ 
            success: true, 
            message: 'Proposta aceita! Agora é só aguardar o profissional.',
            pedido,
            agendamento
        });
    } catch (error) {
        console.error('Erro ao aceitar proposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar Pedido Urgente (cliente)
app.post('/api/pedidos-urgentes/:pedidoId/cancelar', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        if (pedido.clienteId.toString() !== clienteId) {
            return res.status(403).json({ success: false, message: 'Apenas o criador do pedido pode cancelar o pedido.' });
        }

        // Permite cancelar pedidos que não têm proposta aceita (independente do status, exceto já cancelados ou concluídos)
        const temPropostaAceita = pedido.propostas && pedido.propostas.some(p => 
            p.status === 'aceita' || p.status === 'aceito' || p.status === 'em_andamento'
        );
        
        if (pedido.status === 'cancelado') {
            return res.status(400).json({ success: false, message: 'Este pedido já foi cancelado.' });
        }
        
        if (pedido.status === 'concluido') {
            return res.status(400).json({ success: false, message: 'Não é possível cancelar um pedido já concluído.' });
        }
        
        // Se tem proposta aceita, deve usar a rota cancelar-servico
        if (temPropostaAceita) {
            return res.status(400).json({ success: false, message: 'Este pedido tem proposta aceita. Use a opção "Cancelar serviço" em vez de "Apagar serviço".' });
        }

        pedido.status = 'cancelado';
        // Marca propostas pendentes como canceladas
        pedido.propostas.forEach(p => {
            if (p.status === 'pendente') {
                p.status = 'cancelada';
            }
        });

        await pedido.save();

        return res.json({ success: true, message: 'Pedido cancelado com sucesso.', pedido });
    } catch (error) {
        console.error('Erro ao cancelar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar serviço de pedido urgente após aceito (cliente ou profissional)
app.post('/api/pedidos-urgentes/:pedidoId/cancelar-servico', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const { motivo } = req.body;
        const userId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        // Verifica se já está cancelado
        if (pedido.status === 'cancelado') {
            return res.status(400).json({ success: false, message: 'Este pedido já foi cancelado.' });
        }

        // Verifica se já está concluído
        if (pedido.status === 'concluido') {
            return res.status(400).json({ success: false, message: 'Não é possível cancelar um pedido já concluído.' });
        }

        // Tenta encontrar proposta aceita pela propostaSelecionada
        let propostaAceita = null;
        if (pedido.propostaSelecionada) {
            propostaAceita = pedido.propostas.id(pedido.propostaSelecionada);
        }
        
        // Se não encontrou pela propostaSelecionada, procura por status
        if (!propostaAceita) {
            propostaAceita = pedido.propostas.find(prop => 
                prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento'
            );
        }

        // Permite cancelar se tiver proposta aceita OU se estiver em andamento
        const temPropostaAceita = propostaAceita && (propostaAceita.status === 'aceita' || propostaAceita.status === 'aceito' || propostaAceita.status === 'em_andamento');
        const estaEmAndamento = pedido.status === 'em_andamento';
        
        if (!temPropostaAceita && !estaEmAndamento) {
            console.log(`⚠️ Tentativa de cancelar pedido ${pedidoId}: status=${pedido.status}, temPropostaAceita=${temPropostaAceita}, propostaSelecionada=${pedido.propostaSelecionada}`);
            return res.status(400).json({ success: false, message: 'Somente serviços em andamento ou com proposta aceita podem ser cancelados.' });
        }

        const clienteId = pedido.clienteId.toString();
        let profissionalId = null;
        
        // Se tem proposta aceita, obtém o profissionalId dela
        if (propostaAceita) {
            profissionalId = propostaAceita.profissionalId.toString();
        }

        // Apenas o criador do pedido ou o profissional responsável podem cancelar
        if (profissionalId) {
            if (userId !== clienteId && userId !== profissionalId) {
                return res.status(403).json({ success: false, message: 'Você não tem permissão para cancelar este serviço.' });
            }
        } else {
            // Se não tem profissionalId, permite cancelar apenas para o criador do pedido
            if (userId !== clienteId) {
                return res.status(403).json({ success: false, message: 'Apenas o criador do pedido pode cancelar este serviço.' });
            }
        }

        pedido.status = 'cancelado';
        pedido.motivoCancelamento = motivo || null;
        pedido.canceladoPor = userId;
        await pedido.save();

        // Cancela agendamento relacionado, se existir
        if (pedido.agendamentoId) {
            await Agendamento.findByIdAndUpdate(pedido.agendamentoId, { status: 'cancelado' });
        }

        // Notifica a outra parte sobre o cancelamento (se tiver profissional)
        if (profissionalId) {
            try {
                const outroLadoId = userId === clienteId ? profissionalId : clienteId;
                const titulo = 'Serviço cancelado';
                const mensagem = `O serviço "${pedido.servico}" foi cancelado. Motivo: ${motivo || 'não informado.'}`;
                await criarNotificacao(
                    outroLadoId,
                    'servico_cancelado',
                    titulo,
                    mensagem,
                    {
                        pedidoId: pedido._id,
                        canceladoPor: userId,
                        motivo: motivo || null
                    },
                    null
                );
            } catch (notifError) {
                console.error('Erro ao criar notificação de cancelamento de serviço:', notifError);
            }
        }

        res.json({ success: true, message: 'Serviço cancelado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cancelar serviço de pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Deletar Pedido Urgente (apenas para o criador do pedido)
app.delete('/api/pedidos-urgentes/:pedidoId', authMiddleware, async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const userId = req.user.id;

        const pedido = await PedidoUrgente.findById(pedidoId);
        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido não encontrado.' });
        }

        // Apenas o criador do pedido pode deletar
        if (pedido.clienteId.toString() !== userId) {
            return res.status(403).json({ success: false, message: 'Você não tem permissão para deletar este pedido.' });
        }

        await PedidoUrgente.findByIdAndDelete(pedidoId);

        res.json({ success: true, message: 'Pedido deletado com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar pedido urgente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Pedidos Urgentes Disponíveis (para profissionais)
app.get('/api/pedidos-urgentes', authMiddleware, async (req, res) => {
    try {
        const { categoria, cidade } = req.query;
        const profissionalId = req.user.id;

        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        let query = { 
            status: 'aberto',
            dataExpiracao: { $gt: new Date() }, // Apenas pedidos não expirados
            clienteId: { $ne: profissionalId } // Não mostrar pedidos criados por este profissional
        };

        // Filtra por categoria apenas se especificado explicitamente
        if (categoria) {
            query.categoria = categoria;
        }

        const pedidos = await PedidoUrgente.find(query)
            .populate('clienteId', '_id nome foto avatarUrl cidade estado')
            .sort({ createdAt: -1 })
            .exec();

        console.log(`📦 API /api/pedidos-urgentes - Profissional ${profissionalId}: ${pedidos.length} pedidos encontrados (query: ${JSON.stringify(query)})`);
        console.log(`📋 Profissional atuacao: ${profissional.atuacao || 'N/A'}`);
        if (pedidos.length > 0) {
            pedidos.forEach(p => {
                console.log(`  - Pedido ${p._id}: status=${p.status}, categoria=${p.categoria}, servico=${p.servico}, cidade=${p.localizacao?.cidade}, dataExpiracao=${p.dataExpiracao}`);
            });
        }

        // Filtra por profissão (atuacao) de forma flexível, se nenhuma categoria foi informada
        let pedidosFiltrados = pedidos;
        if (!categoria && profissional.atuacao) {
            const atuacaoNorm = profissional.atuacao
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().trim();

            const filtraPorAtuacao = (texto) => {
                if (!texto) return false;
                const norm = String(texto)
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase().trim();
                return norm.includes(atuacaoNorm) || atuacaoNorm.includes(norm);
            };

            const porProfissao = pedidos.filter(p => 
                filtraPorAtuacao(p.categoria) || filtraPorAtuacao(p.servico)
            );

            console.log(`🔍 Filtro por profissão: ${porProfissao.length} pedidos encontrados (de ${pedidos.length} total)`);
            
            // Se o filtro por profissão trouxer algum resultado, usa ele;
            // senão, mantém a lista completa para não esconder tudo.
            if (porProfissao.length > 0) {
                pedidosFiltrados = porProfissao;
                console.log(`✅ Usando filtro por profissão (${pedidosFiltrados.length} pedidos)`);
            } else {
                console.log(`⚠️ Filtro por profissão não encontrou resultados, mantendo lista completa (${pedidosFiltrados.length} pedidos)`);
            }
        } else {
            console.log(`ℹ️ Filtro por profissão não aplicado (categoria=${categoria}, atuacao=${profissional.atuacao || 'N/A'})`);
        }

        // Filtra por cidade se especificado
        if (cidade) {
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);
            pedidosFiltrados = pedidosFiltrados.filter(pedido => {
                const cidadePedido = pedido.localizacao?.cidade || '';
                return normalizeString(cidadePedido).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(cidadePedido));
            });
        }

        console.log(`📤 Retornando ${pedidosFiltrados.length} pedidos filtrados (de ${pedidos.length} total)`);
        res.json({ success: true, pedidos: pedidosFiltrados });
    } catch (error) {
        console.error('Erro ao buscar pedidos urgentes:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Pedidos Urgentes do Cliente (seus próprios pedidos)
app.get('/api/pedidos-urgentes/meus', authMiddleware, async (req, res) => {
    try {
        const clienteId = req.user.id;
        const { status } = req.query;

        const cliente = await User.findById(clienteId);
        if (!cliente) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        let query = { clienteId };
        
        // Filtra por status se especificado
        if (status) {
            query.status = status;
        }

        const pedidos = await PedidoUrgente.find(query)
            .populate('clienteId', '_id nome foto avatarUrl cidade estado')
            .populate('propostas.profissionalId', '_id nome foto avatarUrl atuacao cidade estado gamificacao mediaAvaliacao totalAvaliacoes')
            .sort({ createdAt: -1 })
            .exec();

        console.log(`📦 API /api/pedidos-urgentes/meus - Cliente ${clienteId}: ${pedidos.length} pedidos encontrados`);
        if (pedidos.length > 0) {
            pedidos.forEach(p => {
                const propostasAceitas = (p.propostas || []).filter(prop => prop.status === 'aceita' || prop.status === 'aceito' || prop.status === 'em_andamento');
                console.log(`  - Pedido ${p._id}: status=${p.status}, dataExpiracao=${p.dataExpiracao}, servico=${p.servico}, propostasAceitas=${propostasAceitas.length}, totalPropostas=${(p.propostas || []).length}`);
                if (propostasAceitas.length > 0) {
                    console.log(`    ✓ Propostas aceitas: ${propostasAceitas.map(prop => `${prop._id} (status: ${prop.status})`).join(', ')}`);
                }
            });
        }

        const agora = new Date();
        const pedidosAtivos = [];
        const pedidosExpirados = [];

        pedidos.forEach(p => {
            const expirado = p.dataExpiracao && p.dataExpiracao <= agora && p.status === 'aberto';
            const plain = p.toObject();
            plain.expirado = expirado;
            if (expirado) {
                pedidosExpirados.push(plain);
            } else {
                pedidosAtivos.push(plain);
            }
        });

        console.log(`📦 API /api/pedidos-urgentes/meus - Ativos: ${pedidosAtivos.length}, Expirados: ${pedidosExpirados.length}`);

        res.json({ success: true, pedidos, pedidosAtivos, pedidosExpirados });
    } catch (error) {
        console.error('Erro ao buscar pedidos urgentes do cliente:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Rotas de Vagas-Relâmpago REMOVIDAS - funcionalidade descontinuada

// 🆕 NOVO: Rotas de Times Locais (COMPATIBILIDADE - mantido para não quebrar código existente)
// Criar Time de Projeto - 🆕 ATUALIZADO: Permite profissionais também
app.post('/api/times-projeto', authMiddleware, async (req, res) => {
    try {
        const { titulo, descricao, localizacao, profissionaisNecessarios } = req.body;
        const criadorId = req.user.id;
        
        // Valida se todos os profissionais têm valor base ou "A Combinar"
        if (!profissionaisNecessarios || profissionaisNecessarios.length === 0) {
            return res.status(400).json({ success: false, message: 'É necessário adicionar pelo menos um profissional.' });
        }
        
        for (const prof of profissionaisNecessarios) {
            const aCombinar = prof.aCombinar || false;
            if (!aCombinar && (!prof.valorBase || prof.valorBase <= 0)) {
                return res.status(400).json({ success: false, message: `Valor base é obrigatório e deve ser maior que zero para o profissional "${prof.tipo}" ou marque "A Combinar".` });
            }
        }
        
        const criador = await User.findById(criadorId);
        if (!criador) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        // Garante que cada profissional tenha valorBase como número ou null
        const profissionaisComValor = profissionaisNecessarios.map(prof => ({
            tipo: prof.tipo,
            quantidade: parseInt(prof.quantidade) || 1,
            valorBase: prof.aCombinar ? null : parseFloat(prof.valorBase),
            aCombinar: prof.aCombinar || false
        }));
        
        const novoTime = new TimeProjeto({
            clienteId: criadorId, // Mantém compatibilidade, mas agora pode ser profissional também
            titulo,
            descricao,
            localizacao,
            profissionaisNecessarios: profissionaisComValor
        });
        
        await novoTime.save();
        
        res.status(201).json({ success: true, message: 'Time de projeto criado com sucesso!', time: novoTime });
    } catch (error) {
        console.error('Erro ao criar time de projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar Times de Projeto (por cidade) - 🆕 ATUALIZADO: Busca flexível
app.get('/api/times-projeto', authMiddleware, async (req, res) => {
    try {
        const { cidade, status = 'aberto' } = req.query;
        const userId = req.user.id;

        // Busca equipes ocultas do usuário
        const user = await User.findById(userId).select('equipesConcluidasOcultas');
        const equipesOcultas = user?.equipesConcluidasOcultas || [];
        const equipesOcultasIds = equipesOcultas.map(id => id.toString());

        // Por padrão, só mostra times abertos (não concluídos)
        let query = { status: status === 'concluido' ? 'concluido' : 'aberto' };
        
        // Se for buscar concluídas, filtra as ocultas
        if (status === 'concluido' && equipesOcultasIds.length > 0) {
            query._id = { $nin: equipesOcultas };
        }
        
        if (cidade) {
            // 🆕 Busca flexível (sem acento, case-insensitive)
            const normalizeString = (str) => {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            };
            const cidadeNormalizada = normalizeString(cidade);

            // Busca todos os times e filtra
            let todosTimes = await TimeProjeto.find({ status }).exec();
            
            // Filtra equipes ocultas se for concluído
            if (status === 'concluido' && equipesOcultasIds.length > 0) {
                todosTimes = todosTimes.filter(time => {
                    const timeId = time._id.toString();
                    return !equipesOcultasIds.includes(timeId);
                });
            }
            
            const timesFiltrados = todosTimes.filter(time => {
                if (!time.localizacao || !time.localizacao.cidade) return false;
                return normalizeString(time.localizacao.cidade).includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(normalizeString(time.localizacao.cidade));
            });

            await TimeProjeto.populate(timesFiltrados, [
                { path: 'clienteId', select: 'nome foto avatarUrl cidade estado' },
                { path: 'candidatos.profissionalId', select: 'nome foto avatarUrl atuacao' }
            ]);

            return res.json({ success: true, times: timesFiltrados });
        }

        const times = await TimeProjeto.find(query)
            .populate('clienteId', 'nome foto avatarUrl cidade estado')
            .populate('candidatos.profissionalId', 'nome foto avatarUrl atuacao cidade estado')
            .sort({ createdAt: -1 })
            .exec();

        res.json({ success: true, times });
    } catch (error) {
        console.error('Erro ao buscar times de projeto:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Ocultar equipe concluída (apenas para o usuário, não deleta do banco)
// IMPORTANTE: Esta rota deve vir ANTES da rota /:timeId para funcionar corretamente
app.post('/api/times-projeto/:timeId/ocultar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const userId = req.user.id;

        console.log(`[OCULTAR] Ocultando equipe - TimeId: ${timeId}, UserId: ${userId}`);

        const time = await TimeProjeto.findById(timeId);
        if (!time) {
            return res.status(404).json({ success: false, message: 'Equipe não encontrada.' });
        }

        // Verifica se a equipe está concluída
        if (time.status !== 'concluido') {
            return res.status(400).json({ success: false, message: 'Apenas equipes concluídas podem ser ocultadas.' });
        }

        // Adiciona a equipe à lista de ocultas do usuário
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        // Verifica se já está oculta
        const timeIdObj = new mongoose.Types.ObjectId(timeId);
        if (!user.equipesConcluidasOcultas) {
            user.equipesConcluidasOcultas = [];
        }

        const jaOculta = user.equipesConcluidasOcultas.some(id => id.toString() === timeId);
        if (!jaOculta) {
            user.equipesConcluidasOcultas.push(timeIdObj);
            await user.save();
            console.log(`[OCULTAR] Equipe ocultada com sucesso - TimeId: ${timeId}`);
        }

        res.json({ success: true, message: 'Equipe ocultada com sucesso!' });
    } catch (error) {
        console.error('Erro ao ocultar equipe:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar um Time de Projeto específico por ID
app.get('/api/times-projeto/:timeId', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        
        const time = await TimeProjeto.findById(timeId)
            .populate('clienteId', 'nome foto avatarUrl telefone')
            .populate('candidatos.profissionalId', 'nome foto avatarUrl atuacao');
        
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }
        
        res.json({ success: true, time });
    } catch (error) {
        console.error('Erro ao buscar time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Candidatar-se a um Time de Projeto
app.post('/api/times-projeto/:timeId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const { tipo } = req.body;
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const time = await TimeProjeto.findById(timeId).populate('clienteId', 'nome');
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }
        
        if (time.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este projeto não está mais aceitando candidatos.' });
        }
        
        // Verifica se já se candidatou para este tipo de profissional específico
        const jaCandidatou = time.candidatos.some(
            c => c.profissionalId.toString() === profissionalId && c.status === 'pendente' && c.tipo === tipo
        );
        
        if (jaCandidatou) {
            return res.status(400).json({ success: false, message: `Você já se candidatou como "${tipo}" a este projeto.` });
        }
        
        // Encontra o valor base do tipo de profissional específico
        const profissionalNecessario = time.profissionaisNecessarios.find(p => p.tipo === tipo);
        
        if (!profissionalNecessario) {
            return res.status(400).json({ success: false, message: `Tipo de profissional "${tipo}" não encontrado neste projeto.` });
        }
        
        const aCombinar = profissionalNecessario.aCombinar || !profissionalNecessario.valorBase;
        const valorBase = profissionalNecessario.valorBase || 0;
        
        if (aCombinar) {
            return res.status(400).json({ success: false, message: `Este profissional está marcado como "A Combinar". Por favor, envie uma proposta com seu valor.` });
        }
        
        // Aceita o valor base - Cria candidatura pendente de confirmação do perfil
        const novoCandidato = {
            profissionalId,
            tipo: tipo || profissional.atuacao,
            status: 'pendente', // Fica pendente até o cliente confirmar o perfil
            valor: valorBase,
            tipoCandidatura: 'aceite'
        };
        
        time.candidatos.push(novoCandidato);
        await time.save();
        
        // Pega o ID do candidato recém-criado
        const candidatoId = time.candidatos[time.candidatos.length - 1]._id.toString();
        
        // Cria notificação para o usuário CONFIRMAR O PERFIL (não aceita direto)
        try {
            let clienteId;
            if (time.clienteId && typeof time.clienteId === 'object' && time.clienteId._id) {
                clienteId = time.clienteId._id.toString();
            } else if (time.clienteId) {
                clienteId = time.clienteId.toString();
            } else {
                throw new Error('clienteId não encontrado no time');
            }
            
            if (clienteId !== profissionalId.toString()) {
                const nomeProfissional = profissional.nome || 'Um profissional';
                const tituloNotificacao = 'Confirme o perfil do candidato';
                const mensagemNotificacao = `${nomeProfissional} aceitou o valor de R$ ${valorBase.toFixed(2)}/dia para ${tipo || 'profissional'} na equipe "${time.titulo}". Confirme o perfil para aceitar.`;
                
                console.log('📢 Criando notificação de confirmação de perfil:', {
                    clienteId,
                    tipo: 'confirmar_perfil_time',
                    timeId: time._id.toString(),
                    candidatoId,
                    profissionalId: profissionalId.toString()
                });
                
                const notificacaoCriada = await criarNotificacao(
                    clienteId,
                    'confirmar_perfil_time', // Nova notificação para confirmar perfil
                    tituloNotificacao,
                    mensagemNotificacao,
                    {
                        timeId: time._id.toString(),
                        candidatoId: candidatoId, // ID específico do candidato
                        profissionalId: profissionalId.toString(),
                        profissionalNome: nomeProfissional,
                        tipoProfissional: tipo,
                        valorAceito: valorBase
                    },
                    null
                );
                
                if (notificacaoCriada) {
                    console.log('✅ Notificação de confirmação de perfil criada com sucesso:', notificacaoCriada._id);
                } else {
                    console.error('❌ Falha ao criar notificação de confirmação de perfil - criarNotificacao retornou null');
                }
            } else {
                console.log('⚠️ Profissional é o próprio cliente, não criando notificação');
            }
        } catch (notifError) {
            console.error('❌ Erro ao criar notificação de confirmação de perfil:', notifError);
            console.error('Stack trace:', notifError.stack);
        }
        
        res.json({ success: true, message: 'Candidatura realizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao candidatar-se:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Enviar contraproposta para um Time de Projeto
app.post('/api/times-projeto/:timeId/contraproposta', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const { tipo, valor, justificativa } = req.body;
        const profissionalId = req.user.id;
        
        if (!valor || valor <= 0) {
            return res.status(400).json({ success: false, message: 'Valor da contraproposta é obrigatório e deve ser maior que zero.' });
        }
        
        if (!justificativa || justificativa.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Justificativa é obrigatória.' });
        }
        
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        const time = await TimeProjeto.findById(timeId).populate('clienteId', 'nome');
        if (!time) {
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }
        
        if (time.status !== 'aberto') {
            return res.status(400).json({ success: false, message: 'Este projeto não está mais aceitando candidatos.' });
        }
        
        // Verifica se já se candidatou para este tipo de profissional específico
        const jaCandidatou = time.candidatos.some(
            c => c.profissionalId.toString() === profissionalId && c.status === 'pendente' && c.tipo === tipo
        );
        
        if (jaCandidatou) {
            return res.status(400).json({ success: false, message: `Você já se candidatou como "${tipo}" a este projeto.` });
        }
        
        // Verifica se o tipo de profissional existe no projeto
        const profissionalNecessario = time.profissionaisNecessarios.find(p => p.tipo === tipo);
        if (!profissionalNecessario) {
            return res.status(400).json({ success: false, message: `Tipo de profissional "${tipo}" não encontrado neste projeto.` });
        }
        
        // Adiciona contraproposta - APENAS cria notificação de contraproposta (não candidatura)
        const novaContraproposta = {
            profissionalId,
            tipo: tipo || profissional.atuacao,
            status: 'pendente',
            valor: parseFloat(valor),
            justificativa: justificativa.trim(),
            tipoCandidatura: 'contraproposta'
        };
        
        time.candidatos.push(novaContraproposta);
        await time.save();
        
        // Pega o ID do candidato recém-criado
        const candidatoId = time.candidatos[time.candidatos.length - 1]._id.toString();
        
        // Cria APENAS notificação de contraproposta (não candidatura)
        try {
            let clienteId;
            if (time.clienteId && typeof time.clienteId === 'object' && time.clienteId._id) {
                clienteId = time.clienteId._id.toString();
            } else if (time.clienteId) {
                clienteId = time.clienteId.toString();
            } else {
                throw new Error('clienteId não encontrado no time');
            }
            
            if (clienteId !== profissionalId.toString()) {
                const nomeProfissional = profissional.nome || 'Um profissional';
                const tituloNotificacao = 'Nova contraproposta na sua equipe';
                const mensagemNotificacao = `${nomeProfissional} enviou uma contraproposta de R$ ${parseFloat(valor).toFixed(2)}/dia para o tipo "${tipo}" na equipe "${time.titulo}"`;
                
                await criarNotificacao(
                    clienteId,
                    'contraproposta_time', // APENAS contraproposta_time, não candidatura_time
                    tituloNotificacao,
                    mensagemNotificacao,
                    {
                        timeId: time._id.toString(),
                        candidatoId: candidatoId, // ID específico do candidato
                        profissionalId: profissionalId.toString(),
                        profissionalNome: nomeProfissional,
                        tipoProfissional: tipo,
                        valorProposto: parseFloat(valor),
                        justificativa: justificativa.trim()
                    },
                    null
                );
            }
        } catch (notifError) {
            console.error('Erro ao criar notificação de contraproposta:', notifError);
        }
        
        res.json({ success: true, message: 'Contraproposta enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar contraproposta:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Cancelar candidatura em Time de Projeto
app.delete('/api/times-projeto/:timeId/candidatar', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const profissionalId = req.user.id;

        console.log(`[DELETE] Cancelando candidatura - TimeId: ${timeId}, ProfissionalId: ${profissionalId}`);

        const time = await TimeProjeto.findById(timeId);
        if (!time) {
            console.log(`[DELETE] Time não encontrado: ${timeId}`);
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }

        // Remove a candidatura do profissional (remove qualquer candidatura, não apenas pendente)
        const candidatoIndex = time.candidatos.findIndex(
            c => c.profissionalId.toString() === profissionalId
        );

        if (candidatoIndex === -1) {
            console.log(`[DELETE] Candidatura não encontrada para profissional ${profissionalId}`);
            return res.status(400).json({ success: false, message: 'Você não possui candidatura neste projeto.' });
        }

        // Remove a candidatura
        const candidatoRemovido = time.candidatos.splice(candidatoIndex, 1)[0];
        await time.save();

        console.log(`[DELETE] Candidatura removida com sucesso - Tipo: ${candidatoRemovido.tipo}, Status: ${candidatoRemovido.status}`);

        res.json({ success: true, message: 'Candidatura cancelada com sucesso!' });
    } catch (error) {
        console.error('Erro ao cancelar candidatura:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Deletar time de projeto (apenas o criador pode deletar)
app.delete('/api/times-projeto/:timeId', authMiddleware, async (req, res) => {
    try {
        const { timeId } = req.params;
        const userId = req.user.id;

        console.log(`[DELETE] Deletando time - TimeId: ${timeId}, UserId: ${userId}`);

        const time = await TimeProjeto.findById(timeId).populate('clienteId');
        if (!time) {
            console.log(`[DELETE] Time não encontrado: ${timeId}`);
            return res.status(404).json({ success: false, message: 'Time de projeto não encontrado.' });
        }

        // Verifica se o usuário é o criador do time
        const criadorId = time.clienteId?._id?.toString() || time.clienteId?.toString() || time.clienteId;
        if (criadorId !== userId) {
            console.log(`[DELETE] Acesso negado - UserId: ${userId}, CriadorId: ${criadorId}`);
            return res.status(403).json({ success: false, message: 'Apenas o criador do time pode deletá-lo.' });
        }

        // Deleta o time
        await TimeProjeto.findByIdAndDelete(timeId);

        console.log(`[DELETE] Time deletado com sucesso - TimeId: ${timeId}`);

        res.json({ success: true, message: 'Time deletado com sucesso!' });
    } catch (error) {
        console.error('Erro ao deletar time:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Aceitar/Recusar candidato em Time de Projeto
app.put('/api/times-projeto/:timeId/candidatos/:candidatoId', authMiddleware, async (req, res) => {
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
            return res.status(403).json({ success: false, message: 'Apenas o dono do projeto pode aceitar/recusar candidatos.' });
        }

        const candidatoIndex = time.candidatos.findIndex(c => c._id.toString() === candidatoId);
        if (candidatoIndex === -1) {
            return res.status(404).json({ success: false, message: 'Candidato não encontrado.' });
        }

        if (acao === 'aceitar') {
            const candidato = time.candidatos[candidatoIndex];
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
            
            // Cria notificação para o profissional que foi aceito
            try {
                const profissionalId = candidato.profissionalId;
                
                // Busca dados do profissional e do cliente
                const profissional = await User.findById(profissionalId).select('nome');
                const cliente = await User.findById(time.clienteId).select('nome telefone');
                
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
                                return enderecoParts.length > 0 ? enderecoParts.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()
                        },
                        null
                    );
                }
            } catch (notifError) {
                console.error('Erro ao criar notificação de proposta aceita:', notifError);
            }
        } else if (acao === 'recusar') {
            // Salva informações do candidato antes de remover
            const candidatoRecusado = time.candidatos[candidatoIndex];
            const profissionalIdRecusado = candidatoRecusado.profissionalId;
            
            // Cria notificação para o profissional que foi recusado
            try {
                if (profissionalIdRecusado) {
                    const profissionalRecusado = await User.findById(profissionalIdRecusado).select('nome');
                    const nomeProfissional = profissionalRecusado?.nome || 'Você';
                    const cliente = await User.findById(time.clienteId).select('nome');
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
        res.json({ success: true, message: `Candidato ${acao === 'aceitar' ? 'aceito' : 'recusado'} com sucesso!` });
    } catch (error) {
        console.error('Erro ao processar candidato:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

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
                
                // Busca dados do profissional e do cliente
                const profissional = await User.findById(profissionalId).select('nome');
                const cliente = await User.findById(time.clienteId).select('nome telefone');
                
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
                                return enderecoParts.length > 0 ? enderecoParts.join(', ') : `${time.localizacao.bairro}, ${time.localizacao.cidade} - ${time.localizacao.estado}`;
                            })()
                        },
                        null
                    );
                }
            } catch (notifError) {
                console.error('Erro ao criar notificação de proposta aceita:', notifError);
            }
        } else if (acao === 'recusar') {
            // Salva informações do candidato antes de remover
            const candidatoRecusado = time.candidatos[candidatoIndex];
            const profissionalIdRecusado = candidatoRecusado.profissionalId;
            
            // Cria notificação para o profissional que foi recusado
            try {
                if (profissionalIdRecusado) {
                    const profissionalRecusado = await User.findById(profissionalIdRecusado).select('nome');
                    const nomeProfissional = profissionalRecusado?.nome || 'Você';
                    const cliente = await User.findById(time.clienteId).select('nome');
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

// 🆕 NOVO: Rotas de Agendador Helpy
// Definir horários disponíveis
app.post('/api/agenda/horarios', authMiddleware, async (req, res) => {
    try {
        const { horarios } = req.body; // Array de {diaSemana, horaInicio, horaFim}
        const profissionalId = req.user.id;
        
        const profissional = await User.findById(profissionalId);
        if (!profissional) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
        
        // Remove horários antigos
        await HorarioDisponivel.deleteMany({ profissionalId });
        
        // Adiciona novos horários
        const novosHorarios = horarios.map(h => ({
            profissionalId,
            diaSemana: h.diaSemana,
            horaInicio: h.horaInicio,
            horaFim: h.horaFim,
            disponivel: true
        }));
        
        await HorarioDisponivel.insertMany(novosHorarios);
        
        res.json({ success: true, message: 'Horários atualizados com sucesso!' });
    } catch (error) {
        console.error('Erro ao definir horários:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Buscar horários disponíveis de um profissional
app.get('/api/agenda/:profissionalId/horarios', authMiddleware, async (req, res) => {
    try {
        const { profissionalId } = req.params;
        const horarios = await HorarioDisponivel.find({ profissionalId, disponivel: true }).exec();
        res.json({ success: true, horarios });
    } catch (error) {
        console.error('Erro ao buscar horários:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Criar agendamento
app.post('/api/agenda/agendamento', authMiddleware, async (req, res) => {
    try {
        const { profissionalId, dataHora, servico, observacoes, endereco } = req.body;
        const clienteId = req.user.id;
        
        const novoAgendamento = new Agendamento({
            profissionalId,
            clienteId,
            dataHora: new Date(dataHora),
            servico,
            observacoes,
            endereco,
            status: 'pendente'
        });
        
        await novoAgendamento.save();
        
        res.status(201).json({ success: true, message: 'Agendamento criado com sucesso!', agendamento: novoAgendamento });
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// Listar agendamentos do profissional
app.get('/api/agenda/profissional', authMiddleware, async (req, res) => {
    try {
        const profissionalId = req.user.id;
        const agendamentos = await Agendamento.find({ profissionalId })
            .populate('clienteId', 'nome foto avatarUrl telefone')
            .sort({ dataHora: 1 })
            .exec();
        
        res.json({ success: true, agendamentos });
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
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
        const pedidos = await PedidoUrgente.find({
            status: { $in: ['aberto', 'em_andamento'] },
            propostas: {
                $elemMatch: {
                    profissionalId: profissionalId,
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
        const pedidos = await PedidoUrgente.find({
            status: { $in: ['cancelado', 'concluido'] },
            propostas: {
                $elemMatch: {
                    profissionalId: profissionalId,
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
        const propostaAceita = pedido.propostas.id(pedido.propostaSelecionada);
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
        
        const notificacoes = await Notificacao.find(query)
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
            { disputaId: disputa._id, pagamentoId },
            '/disputas'
        );
        
        res.status(201).json({ success: true, message: 'Disputa criada com sucesso!', disputa });
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
        
        // Busca dados agregados
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
        
        // Agrupa por cliente
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
    
    // Garante que sempre retorna JSON
    if (!res.headersSent) {
        // Se for um erro de validação do Mongoose
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Erro de validação',
                errors: Object.values(err.errors).map(e => e.message)
            });
        }
        
        // Se for um erro de autenticação
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }
        
        // Se for um erro do multer (upload de arquivo)
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'Arquivo muito grande. O tamanho máximo permitido é 10MB.'
            });
        }
        
        // Erro padrão
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
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  
  // Inicializa serviços antes de iniciar o servidor
  initializeServices().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      if (process.env.DOMINIO) {
        console.log(`🌐 Domínio: ${process.env.DOMINIO}`);
      }
    });
  }).catch((error) => {
    console.error('❌ Erro ao inicializar serviços:', error);
    process.exit(1);
  });
}