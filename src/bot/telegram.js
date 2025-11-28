import TelegramBot from 'node-telegram-bot-api';
import tiktokService from '../services/tiktok.service.js';
import instagramService from '../services/instagram.service.js';
import youtubeService from '../services/youtube.service.js';
import veraService from '../services/vera.service.js';
import dbService from '../database/service.js';

class TelegramBotService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.bot = null;
        this.isRunning = false;
    }
    
    /**
     * Démarrer le bot
     */
    start() {
        if (!this.token) {
            throw new Error('TELEGRAM_BOT_TOKEN non configuré');
        }
        
        this.bot = new TelegramBot(this.token, { polling: true });
        this.isRunning = true;
        
        this.setupHandlers();
        console.log('🤖 Bot Telegram démarré !');
    }
    
    /**
     * Configurer les handlers de commandes
     */
    setupHandlers() {
        // Commande /start
        this.bot.onText(/\/start/, async (msg) => {
            await this.handleStart(msg);
        });
        
        // Commande /help
        this.bot.onText(/\/help/, async (msg) => {
            await this.handleHelp(msg);
        });
        
        // Commande /check [url]
        this.bot.onText(/\/check (.+)/, async (msg, match) => {
            await this.handleCheck(msg, match[1]);
        });
        
        // Commande /monitor [username]
        this.bot.onText(/\/monitor (@?\w+)/, async (msg, match) => {
            await this.handleMonitor(msg, match[1]);
        });
        
        // Commande /stop [username]
        this.bot.onText(/\/stop (@?\w+)/, async (msg, match) => {
            await this.handleStopMonitor(msg, match[1]);
        });
        
        // Commande /list
        this.bot.onText(/\/list/, async (msg) => {
            await this.handleList(msg);
        });
        
        // Commande /stats
        this.bot.onText(/\/stats/, async (msg) => {
            await this.handleStats(msg);
        });
        
        // Gestion des erreurs
        this.bot.on('polling_error', (error) => {
            console.error('❌ Erreur polling Telegram:', error.message);
        });
        
        this.bot.on('error', (error) => {
            console.error('❌ Erreur bot Telegram:', error.message);
        });
    }
    
    /**
     * Handler /start
     */
    async handleStart(msg) {
        const chatId = msg.chat.id;
        const user = msg.from;
        
        // Enregistrer l'utilisateur
        dbService.createOrUpdateTelegramUser({
            telegram_id: user.id,
            username: user.username,
            first_name: user.first_name,
            last_name: user.last_name
        });
        
        const welcomeMessage = `
🎯 <b>Bienvenue sur TikTok Fact-Checker Bot !</b>

Je vous aide à vérifier la crédibilité des vidéos TikTok grâce à l'intelligence artificielle Vera.

<b>📋 Commandes disponibles :</b>

<b>/check [url]</b> - Vérifier une vidéo TikTok
<i>Exemple : /check https://tiktok.com/@user/video/123456</i>

<b>/monitor @username</b> - Surveiller un compte TikTok
<i>Les nouvelles vidéos seront vérifiées automatiquement</i>

<b>/stop @username</b> - Arrêter la surveillance d'un compte

<b>/list</b> - Voir vos comptes surveillés

<b>/stats</b> - Voir vos statistiques

<b>/help</b> - Afficher l'aide

🚀 Commencez dès maintenant avec /check !
        `;
        
        await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
    }
    
    /**
     * Handler /help
     */
    async handleHelp(msg) {
        const chatId = msg.chat.id;
        
        const helpMessage = `
📖 <b>Guide d'utilisation</b>

<b>1️⃣ Vérifier une vidéo</b>
Utilisez /check suivi de l'URL TikTok :
<code>/check https://tiktok.com/@user/video/123456</code>

Le bot va :
✓ Extraire la vidéo et ses métadonnées
✓ Analyser le contenu avec Vera AI
✓ Vous fournir un score de crédibilité
✓ Détecter les manipulations potentielles

<b>2️⃣ Surveiller un compte</b>
Utilisez /monitor pour vérifier automatiquement les nouvelles vidéos :
<code>/monitor @username</code>

<b>3️⃣ Arrêter la surveillance</b>
<code>/stop @username</code>

<b>4️⃣ Gérer vos surveillances</b>
• <code>/list</code> - Voir vos comptes surveillés
• <code>/stats</code> - Voir vos statistiques

<b>⚠️ Limites</b>
• API rate limits appliqués
• Max 10 comptes surveillés par utilisateur
• Vérification toutes les 5 minutes

Besoin d'aide ? Contactez le support.
        `;
        
        await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
    }
    
    /**
     * Handler /check [url]
     */
    async handleCheck(msg, url) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            // Enregistrer la requête
            dbService.incrementUserRequests(userId);
            
            // Valider l'URL (TikTok, Instagram ou YouTube)
            const isTikTok = tiktokService.isTikTokUrl(url);
            const isInstagram = instagramService.isInstagramUrl(url);
            const isYouTube = youtubeService.isYouTubeUrl(url);
            
            if (!isTikTok && !isInstagram && !isYouTube) {
                await this.bot.sendMessage(chatId, '❌ URL invalide. Veuillez fournir une URL TikTok, Instagram ou YouTube.', { parse_mode: 'HTML' });
                return;
            }
            
            // Message de progression
            const processingMsg = await this.bot.sendMessage(chatId, '⏳ Extraction du contenu en cours...', { parse_mode: 'HTML' });
            
            let contentData;
            let contentType;
            
            // Détecter le type de plateforme
            if (tiktokService.isTikTokUrl(url)) {
                contentData = await tiktokService.extractVideo(url);
                contentType = 'tiktok';
            } else if (instagramService.isInstagramUrl(url)) {
                contentData = await instagramService.extractPost(url);
                contentType = 'instagram';
            } else if (youtubeService.isYouTubeUrl(url)) {
                contentData = await youtubeService.extractVideo(url);
                contentType = 'youtube';
            } else {
                throw new Error('URL non supportée. Utilisez une URL TikTok, Instagram ou YouTube.');
            }
            
            await this.bot.editMessageText('🔍 Analyse par Vera AI en cours...', {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
            });
            
            // Sauvegarder dans la DB (normaliser les données)
            const videoId = dbService.createVideo({
                video_id: contentData.video_id || contentData.post_id || contentData.shortcode,
                url: contentData.url,
                author: contentData.author,
                title: contentData.title || contentData.caption || '',
                description: contentData.description || contentData.caption || '',
                thumbnail_url: contentData.thumbnail_url,
                download_url: contentData.download_url || contentData.video_url || contentData.images?.[0] || '',
                views: contentData.views || 0,
                likes: contentData.likes || 0,
                comments: contentData.comments || 0,
                shares: contentData.shares || 0,
                duration: contentData.duration || 0,
                hashtags: JSON.stringify(contentData.hashtags || []),
                created_at: contentData.created_at,
                platform: contentType
            });
            
            // Vérification Vera - passer explicitement la plateforme
            const verificationResult = await veraService.checkVideo(contentData, contentType);
            
            if (!verificationResult) {
                throw new Error('Impossible d\'obtenir une vérification de Vera AI');
            }
            
            // Sauvegarder la vérification
            dbService.createVerification({
                video_id: videoId,
                vera_request_id: verificationResult.request_id || 'unknown',
                status: verificationResult.status || 'error',
                score: verificationResult.score || 0,
                verdict: verificationResult.verdict || 'unknown',
                flags: verificationResult.flags || [],
                sources: verificationResult.sources || [],
                explanation: verificationResult.explanation || 'Aucune explication disponible'
            });
            
            // Supprimer le message de progression
            await this.bot.deleteMessage(chatId, processingMsg.message_id);
            
            // Envoyer le résultat
            const resultMessage = this.formatContentResult(contentData, verificationResult, contentType);
            
            await this.bot.sendMessage(chatId, resultMessage, { 
                parse_mode: 'HTML',
                disable_web_page_preview: false
            });
            
        } catch (error) {
            console.error('❌ Erreur /check:', error.message);
            await this.bot.sendMessage(chatId, `❌ Erreur : ${error.message}`, { parse_mode: 'HTML' });
        }
    }
    
    /**
     * Handler /monitor @username
     */
    async handleMonitor(msg, username) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            // Retirer le @ si présent
            username = username.replace('@', '');
            
            // Vérifier le nombre de surveillances actuelles
            const currentMonitored = dbService.getMonitoredAccountsByUser(userId);
            if (currentMonitored.length >= 10) {
                await this.bot.sendMessage(chatId, '⚠️ Limite atteinte : maximum 10 comptes surveillés par utilisateur.', { parse_mode: 'HTML' });
                return;
            }
            
            // Vérifier si le compte existe
            const processingMsg = await this.bot.sendMessage(chatId, `🔍 Vérification du compte @${username}...`, { parse_mode: 'HTML' });
            
            const userInfo = await tiktokService.getUserInfo(username);
            
            // Ajouter à la surveillance
            const accountId = dbService.createMonitoredAccount(username, userId);
            
            if (!accountId) {
                await this.bot.editMessageText(`ℹ️ Le compte @${username} est déjà surveillé.`, {
                    chat_id: chatId,
                    message_id: processingMsg.message_id,
                    parse_mode: 'HTML'
                });
                return;
            }
            
            const successMessage = `
✅ <b>Surveillance activée !</b>

👤 <b>${userInfo.nickname}</b> (@${username})
📊 ${userInfo.follower_count.toLocaleString()} abonnés
🎥 ${userInfo.video_count.toLocaleString()} vidéos

Les nouvelles vidéos seront vérifiées automatiquement toutes les 5 minutes.

Utilisez /stop @${username} pour arrêter la surveillance.
            `;
            
            await this.bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: processingMsg.message_id,
                parse_mode: 'HTML'
            });
            
        } catch (error) {
            console.error('❌ Erreur /monitor:', error.message);
            await this.bot.sendMessage(chatId, `❌ Erreur : ${error.message}`, { parse_mode: 'HTML' });
        }
    }
    
    /**
     * Handler /stop @username
     */
    async handleStopMonitor(msg, username) {
        const chatId = msg.chat.id;
        
        try {
            username = username.replace('@', '');
            
            const account = dbService.getMonitoredAccount(username);
            
            if (!account || account.status === 'inactive') {
                await this.bot.sendMessage(chatId, `ℹ️ Le compte @${username} n'est pas surveillé.`, { parse_mode: 'HTML' });
                return;
            }
            
            dbService.stopMonitoredAccount(username);
            
            await this.bot.sendMessage(chatId, `✅ Surveillance de @${username} arrêtée.`, { parse_mode: 'HTML' });
            
        } catch (error) {
            console.error('❌ Erreur /stop:', error.message);
            await this.bot.sendMessage(chatId, `❌ Erreur : ${error.message}`, { parse_mode: 'HTML' });
        }
    }
    
    /**
     * Handler /list
     */
    async handleList(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            const monitored = dbService.getMonitoredAccountsByUser(userId);
            
            if (monitored.length === 0) {
                await this.bot.sendMessage(chatId, 'ℹ️ Vous ne surveillez aucun compte pour le moment.\n\nUtilisez /monitor @username pour commencer.', { parse_mode: 'HTML' });
                return;
            }
            
            let message = `📋 <b>Vos comptes surveillés (${monitored.length}/10)</b>\n\n`;
            
            for (const account of monitored) {
                const lastCheck = account.last_check_at 
                    ? new Date(account.last_check_at).toLocaleString('fr-FR')
                    : 'Jamais';
                
                message += `👤 <b>@${account.username}</b>\n`;
                message += `   Dernière vérification : ${lastCheck}\n\n`;
            }
            
            message += `\nUtilisez /stop @username pour arrêter une surveillance.`;
            
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
        } catch (error) {
            console.error('❌ Erreur /list:', error.message);
            await this.bot.sendMessage(chatId, `❌ Erreur : ${error.message}`, { parse_mode: 'HTML' });
        }
    }
    
    /**
     * Handler /stats
     */
    async handleStats(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        
        try {
            const stats = dbService.getUserStats(userId);
            
            const message = `
📊 <b>Vos statistiques</b>

🔍 Vérifications effectuées : ${stats.requests}
👥 Comptes surveillés : ${stats.monitored_accounts}
🎥 Vidéos analysées : ${stats.verified_videos}
📅 Membre depuis : ${new Date(stats.joined_at).toLocaleDateString('fr-FR')}
            `;
            
            await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
            
        } catch (error) {
            console.error('❌ Erreur /stats:', error.message);
            await this.bot.sendMessage(chatId, `❌ Erreur : ${error.message}`, { parse_mode: 'HTML' });
        }
    }
    
    /**
     * Formater le résultat d'un contenu (TikTok, Instagram ou YouTube) pour Telegram
     */
    formatContentResult(contentData, verificationResult, platform = 'tiktok') {
        const platformEmoji = platform === 'instagram' ? '📷' : platform === 'youtube' ? '🎬' : '🎥';
        const platformName = platform === 'instagram' ? 'Instagram' : platform === 'youtube' ? 'YouTube' : 'TikTok';
        
        let message = `
${platformEmoji} <b>${contentData.title || contentData.caption?.substring(0, 50) || `Post ${platformName}`}</b>

👤 <b>Auteur :</b> @${contentData.author}
📝 ${(contentData.description || contentData.caption || 'Pas de description').substring(0, 100)}...

📊 <b>Statistiques :</b>
❤️ ${contentData.likes.toLocaleString()} likes
💬 ${contentData.comments.toLocaleString()} commentaires`;

        if (platform === 'tiktok') {
            message += `
🔄 ${contentData.shares.toLocaleString()} partages
👁️ ${contentData.views.toLocaleString()} vues`;
        } else {
            message += `
👁️ ${contentData.views > 0 ? contentData.views.toLocaleString() + ' vues' : 'Photo'}`;
        }

        message += `

━━━━━━━━━━━━━━━
        `;
        
        // Formatter le résultat de vérification
        const { score, verdict, summary, explanation, flags, toolsUsed } = verificationResult;
        
        const verdictEmojis = {
            'VERIFIED': '✅',
            'MOSTLY_TRUE': '☑️',
            'MIXED': '⚠️',
            'MOSTLY_FALSE': '❌',
            'FALSE': '🚫'
        };
        
        const verdictLabels = {
            'VERIFIED': 'Vérifié',
            'MOSTLY_TRUE': 'Plutôt vrai',
            'MIXED': 'Mixte',
            'MOSTLY_FALSE': 'Plutôt faux',
            'FALSE': 'Faux'
        };
        
        const emoji = verdictEmojis[verdict] || '❓';
        const label = verdictLabels[verdict] || verdict;
        
        message += `${emoji} <b>RÉSULTAT VERA</b>\n\n`;
        message += `🎯 <b>Verdict :</b> ${label}\n`;
        message += `📊 <b>Score :</b> ${score}/100\n`;
        
        if (summary) {
            message += `\n💡 ${summary}\n`;
        }
        
        if (toolsUsed && toolsUsed.length > 0) {
            message += `\n🔧 <b>Outils Vera utilisés :</b>\n`;
            toolsUsed.forEach(tool => {
                message += `  • ${tool}\n`;
            });
        }
        
        if (explanation) {
            message += `\n💬 <b>Analyse détaillée :</b>\n${explanation}\n`;
        }
        
        if (flags && flags.length > 0) {
            message += `\n⚠️ <b>Alertes :</b>\n`;
            flags.forEach(flag => {
                message += `  • ${flag.message}\n`;
            });
        }
        
        return message;
    }
    
    /**
     * Formater le résultat d'une vidéo pour Telegram (legacy - garde pour compatibilité)
     */
    formatVideoResult(videoData, verificationResult) {
        return this.formatContentResult(videoData, verificationResult, 'tiktok');
    }
    
    /**
     * Envoyer une notification pour une nouvelle vidéo vérifiée
     */
    async sendMonitoringNotification(chatId, username, videoData, verificationResult) {
        try {
            let message = `
🔔 <b>Nouvelle vidéo de @${username}</b>

${this.formatVideoResult(videoData, verificationResult)}
            `;
            
            await this.bot.sendMessage(chatId, message, { 
                parse_mode: 'HTML',
                disable_web_page_preview: false
            });
            
        } catch (error) {
            console.error('❌ Erreur envoi notification:', error.message);
        }
    }
    
    /**
     * Arrêter le bot
     */
    stop() {
        if (this.bot) {
            this.bot.stopPolling();
            this.isRunning = false;
            console.log('🛑 Bot Telegram arrêté');
        }
    }
}

export default new TelegramBotService();
