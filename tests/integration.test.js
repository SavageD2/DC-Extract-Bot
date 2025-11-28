import tiktokService from '../services/tiktok.service.js';
import veraService from '../services/vera.service.js';
import dbService from '../database/service.js';

// Test d'extraction vidéo
async function testVideoExtraction() {
    console.log('\n🧪 Test 1: Extraction d\'une vidéo TikTok\n');
    
    try {
        const testUrl = 'https://www.tiktok.com/@test/video/1234567890';
        console.log(`URL de test: ${testUrl}`);
        
        const video = await tiktokService.extractVideo(testUrl);
        
        console.log('✅ Extraction réussie:');
        console.log(`   Video ID: ${video.video_id}`);
        console.log(`   Auteur: @${video.author}`);
        console.log(`   Titre: ${video.title || 'N/A'}`);
        console.log(`   Likes: ${video.likes?.toLocaleString() || 0}`);
        console.log(`   Vues: ${video.views?.toLocaleString() || 0}`);
        
        return video;
        
    } catch (error) {
        console.error('❌ Erreur extraction:', error.message);
        throw error;
    }
}

// Test de vérification Vera
async function testVeraCheck(videoData) {
    console.log('\n🧪 Test 2: Vérification Vera AI\n');
    
    try {
        const verification = await veraService.checkVideo(videoData);
        
        console.log('✅ Vérification réussie:');
        console.log(`   Score: ${Math.round(verification.score * 100)}%`);
        console.log(`   Verdict: ${verification.verdict}`);
        console.log(`   Flags: ${verification.flags.length}`);
        console.log(`   Statut: ${verification.status}`);
        
        return verification;
        
    } catch (error) {
        console.error('❌ Erreur vérification:', error.message);
        throw error;
    }
}

// Test de base de données
async function testDatabase(videoData, verificationData) {
    console.log('\n🧪 Test 3: Opérations base de données\n');
    
    try {
        // Créer une vidéo
        const videoId = dbService.createVideo(videoData);
        console.log(`✅ Vidéo créée avec ID: ${videoId}`);
        
        // Créer une vérification
        const verificationId = dbService.createVerification({
            video_id: videoId,
            vera_request_id: verificationData.request_id,
            status: verificationData.status,
            score: verificationData.score,
            verdict: verificationData.verdict,
            flags: verificationData.flags,
            sources: verificationData.sources || [],
            explanation: verificationData.explanation
        });
        console.log(`✅ Vérification créée avec ID: ${verificationId}`);
        
        // Récupérer les stats
        const stats = dbService.getGlobalStats();
        console.log('\n📊 Statistiques globales:');
        console.log(`   Total vidéos: ${stats.total_videos}`);
        console.log(`   Total vérifications: ${stats.total_verifications}`);
        console.log(`   Comptes surveillés: ${stats.active_accounts}`);
        console.log(`   Utilisateurs: ${stats.total_users}`);
        
        return { videoId, verificationId };
        
    } catch (error) {
        console.error('❌ Erreur base de données:', error.message);
        throw error;
    }
}

// Test de surveillance
async function testMonitoring() {
    console.log('\n🧪 Test 4: Système de surveillance\n');
    
    try {
        const testUsername = 'testuser';
        const testTelegramId = 123456789;
        
        // Créer un compte surveillé
        const accountId = dbService.createMonitoredAccount(testUsername, testTelegramId);
        
        if (accountId) {
            console.log(`✅ Compte @${testUsername} ajouté à la surveillance (ID: ${accountId})`);
            
            // Récupérer le compte
            const account = dbService.getMonitoredAccount(testUsername);
            console.log(`   Statut: ${account.status}`);
            console.log(`   Créé: ${account.created_at}`);
            
            // Arrêter la surveillance
            dbService.stopMonitoredAccount(testUsername);
            console.log(`✅ Surveillance de @${testUsername} arrêtée`);
        } else {
            console.log(`ℹ️ Compte @${testUsername} déjà surveillé`);
        }
        
        return accountId;
        
    } catch (error) {
        console.error('❌ Erreur surveillance:', error.message);
        throw error;
    }
}

// Test de formatage Telegram
async function testTelegramFormatting(verificationData) {
    console.log('\n🧪 Test 5: Formatage message Telegram\n');
    
    try {
        const message = veraService.formatForTelegram(verificationData);
        
        console.log('✅ Message formaté:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        return message;
        
    } catch (error) {
        console.error('❌ Erreur formatage:', error.message);
        throw error;
    }
}

// Exécuter tous les tests
async function runAllTests() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 TESTS BOT TIKTOK FACT-CHECKER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Test 1: Extraction
        const videoData = await testVideoExtraction();
        
        // Test 2: Vérification Vera
        const verificationData = await testVeraCheck(videoData);
        
        // Test 3: Base de données
        await testDatabase(videoData, verificationData);
        
        // Test 4: Surveillance
        await testMonitoring();
        
        // Test 5: Formatage Telegram
        await testTelegramFormatting(verificationData);
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TOUS LES TESTS RÉUSSIS !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ÉCHEC DES TESTS');
        console.error(`Erreur: ${error.message}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        process.exit(1);
    }
}

// Point d'entrée
import 'dotenv/config';
runAllTests();
