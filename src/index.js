import 'dotenv/config';
import telegramBot from './bot/telegram.js';
import monitoringService from './services/monitoring.service.js';
import dbService from './database/service.js';

// Vérifier les variables d'environnement requises
function checkEnvironment() {
    const required = ['TELEGRAM_BOT_TOKEN', 'RAPIDAPI_KEY', 'RAPIDAPI_HOST'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ Variables d\'environnement manquantes:', missing.join(', '));
        console.error('💡 Copiez .env.example vers .env et configurez les valeurs');
        process.exit(1);
    }
    
    if (!process.env.VERA_API_KEY) {
        console.warn('⚠️ VERA_API_KEY non configurée - Mode démo activé');
    }
    
    console.log('✅ Configuration environnement OK');
}

// Démarrer l'application
async function start() {
    try {
        console.log('🚀 Démarrage TikTok Fact-Checker Bot...\n');
        
        // Vérifier l'environnement
        checkEnvironment();
        
        // Initialiser la base de données (déjà fait dans init.js)
        console.log('✅ Base de données prête\n');
        
        // Démarrer le bot Telegram
        telegramBot.start();
        console.log('✅ Bot Telegram actif\n');
        
        // Démarrer la surveillance périodique
        await monitoringService.startPeriodicMonitoring();
        console.log('✅ Surveillance périodique activée\n');
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 Bot opérationnel !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // Afficher les statistiques globales
        const stats = dbService.getGlobalStats();
        console.log('📊 Statistiques:');
        console.log(`   Vidéos : ${stats.total_videos}`);
        console.log(`   Vérifications : ${stats.total_verifications}`);
        console.log(`   Comptes surveillés : ${stats.active_accounts}`);
        console.log(`   Utilisateurs : ${stats.total_users}\n`);
        
    } catch (error) {
        console.error('❌ Erreur lors du démarrage:', error.message);
        process.exit(1);
    }
}

// Gestion de l'arrêt propre
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        console.log(`\n⚠️ Signal ${signal} reçu, arrêt en cours...`);
        
        try {
            // Arrêter le bot Telegram
            telegramBot.stop();
            
            // Arrêter la surveillance
            monitoringService.stopPeriodicMonitoring();
            
            console.log('✅ Arrêt propre effectué');
            process.exit(0);
        } catch (error) {
            console.error('❌ Erreur lors de l\'arrêt:', error.message);
            process.exit(1);
        }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Gestion des erreurs non catchées
    process.on('uncaughtException', (error) => {
        console.error('❌ Exception non catchée:', error);
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Promise rejection non gérée:', reason);
    });
}

// Point d'entrée
setupGracefulShutdown();
start();
