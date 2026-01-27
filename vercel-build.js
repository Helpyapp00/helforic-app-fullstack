#!/usr/bin/env node
/**
 * Script de build para Vercel
 * Garante que o Sharp seja instalado corretamente para Linux x64
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Iniciando build para Vercel...');

try {
    // Passo 1: Instalar todas as dependências (já feito pelo installCommand)
    // O Vercel já executa npm install antes do buildCommand
    console.log('📦 Dependências já instaladas pelo Vercel...');
    
    // Passo 2: Tentar reconstruir Sharp para Linux x64
    console.log('🔧 Reconstruindo Sharp para Linux x64...');
    try {
        execSync('npm rebuild sharp --platform=linux --arch=x64', { stdio: 'inherit' });
        console.log('✅ Sharp reconstruído com sucesso!');
    } catch (rebuildError) {
        console.warn('⚠️ Rebuild falhou, tentando instalação forçada...');
        try {
            // Remove Sharp se existir (compatível com Windows e Linux)
            const sharpPath = path.join(__dirname, 'node_modules', 'sharp');
            if (fs.existsSync(sharpPath)) {
                console.log('🗑️ Removendo Sharp antigo...');
                fs.rmSync(sharpPath, { recursive: true, force: true });
            }
            
            // Instala Sharp novamente com flags específicas
            console.log('📥 Reinstalando Sharp...');
            execSync('npm install sharp@latest --no-save --force', { stdio: 'inherit' });
            
            // Tenta reconstruir novamente
            console.log('🔧 Tentando reconstruir Sharp...');
            execSync('npm rebuild sharp', { stdio: 'inherit' });
            console.log('✅ Sharp reinstalado!');
        } catch (installError) {
            console.warn('⚠️ Instalação forçada falhou. Sistema funcionará com fallback.');
            console.warn('   O Sharp não estará disponível, mas o sistema continuará funcionando.');
        }
    }
    
    console.log('✅ Build completo!');
} catch (error) {
    console.error('❌ Erro durante o build:', error.message);
    console.warn('⚠️ Continuando sem Sharp - sistema funcionará com fallback');
    process.exit(0); // Não falha o build se Sharp não instalar
}

