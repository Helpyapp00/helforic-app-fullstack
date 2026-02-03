$path = 'c:\meu-app-fullstack\api\server.js'
$content = Get-Content -Raw -LiteralPath $path

$anchor = "app.get('/api/cidades', authMiddleware, async (req, res) => {"
$helperBlock = @'
const INTERESSE_KEYWORDS_BASE = [
    'pintura',
    'lanche',
    'lanchonete',
    'conserto',
    'servico',
    'serviço',
    'trabalho',
    'realizado',
    'novo',
    'projeto'
];

function normalizeKeyword(value) {
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

function calcularBoostTemporal(tipoUsuario) {
    const hora = new Date().getHours();
    const isNoturno = hora >= 18 || hora < 6;
    if (isNoturno && tipoUsuario === 'empresa') return 600;
    if (!isNoturno && tipoUsuario !== 'empresa') return 600;
    return 0;
}
'@

if ($content -notmatch [regex]::Escape($anchor)) {
    throw "Âncora de cidades não encontrada."
}

if ($content -notmatch 'INTERESSE_KEYWORDS_BASE') {
    $content = $content -replace [regex]::Escape($anchor), ($helperBlock + "`r`n" + $anchor)
}

$content = $content -replace "populate\('userId', 'nome foto avatarUrl tipo cidade estado'\)", "populate('userId', 'nome foto avatarUrl tipo cidade estado telefone endereco mediaAvaliacao totalAvaliacoes gamificacao')"

$postsBlock = @'
app.get('/api/posts', authMiddleware, async (req, res) => {
    try {
        const posts = await Postagem.find()
            .sort({ createdAt: -1 })
            .populate('userId', 'nome foto avatarUrl tipo cidade estado telefone endereco mediaAvaliacao totalAvaliacoes gamificacao')
            .populate({
                path: 'comments.userId',
                select: 'nome foto avatarUrl'
            })
            .populate({
                path: 'comments.replies.userId',
                select: 'nome foto avatarUrl'
            })
            .exec();

        const interesses = await InteresseUsuario.find({ userId: req.user.id })
            .sort({ score: -1 })
            .limit(30)
            .lean();

        const interesseSet = new Set((interesses || []).map(i => normalizeKeyword(i.termo)).filter(Boolean));

        const postsOrdenados = posts.map((post) => {
            const texto = post?.content || '';
            const normalized = normalizeKeyword(texto);
            let interesseScore = 0;
            if (normalized && interesseSet.size > 0) {
                interesseSet.forEach((termo) => {
                    if (termo && normalized.includes(termo)) interesseScore += 350;
                });
            }

            const tempoScore = new Date(post.createdAt || Date.now()).getTime();
            const boostTemporal = calcularBoostTemporal(post?.userId?.tipo || 'usuario');

            return {
                post,
                score: tempoScore + interesseScore + boostTemporal
            };
        });

        postsOrdenados.sort((a, b) => b.score - a.score);

        res.json(postsOrdenados.map(item => item.post));
    } catch (error) {
        console.error('Erro ao buscar postagens:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
'@

$content = [regex]::Replace(
    $content,
    "app.get\('/api/posts',[\s\S]*?\n}\);",
    $postsBlock,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
)

if ($content -notmatch "/api/interesses/registrar") {
    $endpoint = @'

app.post('/api/interesses/registrar', authMiddleware, async (req, res) => {
    try {
        const { texto } = req.body || {};
        const userId = req.user.id;
        const keywords = extractInterestKeywords(texto);

        if (!keywords.length) {
            return res.json({ success: true, saved: 0 });
        }

        const bulkOps = keywords.map((termo) => ({
            updateOne: {
                filter: { userId, termo },
                update: {
                    $set: { lastSeenAt: new Date() },
                    $inc: { score: 1 }
                },
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
'@
    $content = $content -replace "app.get\('/api/user-posts/:userId',[\s\S]*?\n}\);", ('$0' + $endpoint)
}

Set-Content -LiteralPath $path -Value $content -NoNewline
Write-Host "Feed atualizado (ranking/interesses)."
