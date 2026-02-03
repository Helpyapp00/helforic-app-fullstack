$path = 'c:\meu-app-fullstack\api\server.js'
$content = Get-Content -Raw -LiteralPath $path
$needle = "const Notificacao = mongoose.models.Notificacao || mongoose.model('Notificacao', notificacaoSchema);"
$insert = @'

const interesseUsuarioSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    termo: { type: String, index: true },
    score: { type: Number, default: 0 },
    lastSeenAt: { type: Date }
}, { timestamps: true, strict: false });

interesseUsuarioSchema.index({ userId: 1, termo: 1 }, { unique: true });

const InteresseUsuario = mongoose.models.InteresseUsuario || mongoose.model('InteresseUsuario', interesseUsuarioSchema);
'@
if ($content -notmatch [regex]::Escape($needle)) {
    throw "Linha alvo não encontrada: $needle"
}
if ($content -match "InteresseUsuario") {
    Write-Host "InteresseUsuario já existe. Nada a fazer."
    exit 0
}
$content = $content -replace [regex]::Escape($needle), ($needle + $insert)
Set-Content -LiteralPath $path -Value $content -NoNewline
Write-Host "InteresseUsuario inserido com sucesso."
