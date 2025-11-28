import axios from 'axios';

class VeraService {
    constructor() {
        this.apiKey = process.env.VERA_API_KEY;
        this.apiEndpoint = process.env.VERA_API_URL || 'https://feat-api-partner---api-ksrn3vjgma-od.a.run.app/api/v1';
        
        this.client = axios.create({
            baseURL: this.apiEndpoint,
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 120000 // 2 minutes pour les analyses longues
        });
    }
    
    /**
     * Vérifier le contenu d'une vidéo TikTok, Instagram ou YouTube
     * @param {Object} contentData - Données du contenu extrait
     * @param {string} platform - Plateforme: 'tiktok', 'instagram', 'youtube'
     */
    async checkVideo(contentData, platform = 'tiktok') {
        try {
            if (!this.apiKey || this.apiKey === 'your_vera_api_key_here') {
                throw new Error('VERA_API_KEY non configurée. Veuillez configurer une clé API Vera dans le fichier .env');
            }
            
            // Normaliser le nom de plateforme
            const platformName = platform === 'tiktok' ? 'TikTok' : 
                                platform === 'instagram' ? 'Instagram' : 
                                platform === 'youtube' ? 'YouTube' : 'Unknown';
            
            const contentId = contentData.video_id || contentData.post_id || contentData.shortcode;
            
            console.log(`🔍 Vérification Vera pour ${platformName} ${contentId}`);
            
            // Préparer les médias à envoyer
            const mediaUrls = [];
            
            // Ajouter la vidéo
            if (contentData.download_url || contentData.video_url) {
                mediaUrls.push({
                    type: 'video',
                    url: contentData.download_url || contentData.video_url
                });
            }
            
            // Ajouter les images (Instagram peut avoir plusieurs images)
            if (contentData.images && contentData.images.length > 0) {
                contentData.images.forEach(imgUrl => {
                    if (imgUrl) {
                        mediaUrls.push({
                            type: 'image',
                            url: imgUrl
                        });
                    }
                });
            } else if (contentData.thumbnail_url) {
                mediaUrls.push({
                    type: 'image',
                    url: contentData.thumbnail_url
                });
            }
            
            // Construire la query pour Vera avec contexte et médias
            const description = contentData.description || contentData.caption || '';
            const hashtags = Array.isArray(contentData.hashtags) ? contentData.hashtags : [];
            const title = contentData.title || '';
            
            // Afficher les URLs dans les logs pour debug
            console.log('📦 Médias à analyser:', mediaUrls);
            
            const query = `Analyse ce contenu ${platformName} et vérifie son authenticité:

${title ? `📌 TITRE: ${title}\n` : ''}
${mediaUrls.find(m => m.type === 'video') ? `📹 VIDÉO À ANALYSER: ${mediaUrls.find(m => m.type === 'video').url}\n` : ''}
${mediaUrls.filter(m => m.type === 'image').map((m, i) => `🖼️ IMAGE ${i+1} À ANALYSER: ${m.url}`).join('\n')}

⚠️ IMPORTANT: Utilise les outils Vera.ai pour analyser directement les médias (vidéo et images) ci-dessus:
- Video Deepfake Detection → analyse la vidéo pour détecter les deepfakes
- Synthetic Image Detection → analyse les images pour détecter si elles sont générées par IA
- Image Forgery and Localization → détecte les manipulations dans les images
- Synthetic Speech Detection → analyse l'audio pour détecter les voix synthétiques
- TruFor → analyse forensique complète des médias

📝 CONTEXTE:
Plateforme: ${platformName}
Auteur: @${contentData.author}
Description: ${description}
Hashtags: ${hashtags.join(', ')}

📊 MÉTRIQUES:
- ${(contentData.views || 0).toLocaleString()} vues
- ${(contentData.likes || 0).toLocaleString()} likes  
- ${(contentData.comments || 0).toLocaleString()} commentaires
${contentData.shares ? `- ${contentData.shares.toLocaleString()} partages` : ''}

🎯 ANALYSE REQUISE:
1. Utilise tes outils pour analyser les URLs de médias ci-dessus
2. Authenticité vidéo/image (deepfake, manipulation)
3. Vérification des claims factuels dans le contenu
4. Détection de désinformation
5. Évaluation crédibilité globale

Réponds avec un verdict: VERIFIED, MOSTLY_TRUE, MIXED, MOSTLY_FALSE, ou FALSE
Et explique ton raisonnement avec les preuves de tes outils.`;

            const payload = {
                userId: `${platformName.toLowerCase()}_bot_${Date.now()}`,
                query: query,
                metadata: {
                    source: platformName.toLowerCase(),
                    content_id: contentId,
                    author: contentData.author,
                    media_urls: mediaUrls
                }
            };
            
            // Vera envoie une réponse en streaming (text/plain)
            // Il faut récupérer tout le texte avant de parser
            const response = await this.client.post('/chat', payload, {
                responseType: 'text',
                timeout: 120000 // 2 minutes pour laisser le temps à Vera d'analyser
            });
            
            if (!response.data) {
                throw new Error('Réponse Vera API invalide');
            }
            
            // La réponse est du texte brut en streaming
            const fullResponse = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            
            return this.parseVeraResponse({ response: fullResponse }, contentData);
            
        } catch (error) {
            console.error('❌ Erreur Vera API:', error.message);
            throw error;
        }
    }
    
    
    /**
     * Parser la réponse de Vera
     */
    parseVeraResponse(veraData, videoData) {
        // La réponse de Vera contient l'analyse textuelle complète
        const response = veraData.response || veraData.answer || veraData.message || veraData || '';
        
        // Si c'est un string direct (streaming), l'utiliser
        const analysisText = typeof response === 'string' ? response : JSON.stringify(response);
        
        // Analyser le texte pour extraire un score et verdict
        let score = 70; // Score par défaut
        let verdict = 'MIXED';
        const flags = [];
        let summary = '';
        
        const lowerResponse = analysisText.toLowerCase();
        
        // Détecter d'abord si Vera ne peut PAS analyser
        if (lowerResponse.includes('ne suis pas capable') || 
            lowerResponse.includes('cannot analyze') ||
            lowerResponse.includes('ne peux pas analyser') ||
            lowerResponse.includes('unable to') ||
            (lowerResponse.includes('pas capable') && lowerResponse.includes('analyser'))) {
            score = 0;
            verdict = 'MIXED';
            summary = '⚠️ Vera ne peut pas analyser ce contenu multimédia';
            flags.push({ type: 'warning', message: 'Analyse multimédia non disponible' });
        }
        // Détecter si l'analyse est incomplète (streaming en cours)
        else if (lowerResponse.includes('un moment') || 
            lowerResponse.includes('veuillez patienter') ||
            (lowerResponse.includes('je vais') && lowerResponse.length < 200)) {
            score = 50;
            verdict = 'MIXED';
            summary = '⏳ Analyse incomplète - réessayez dans quelques instants';
            flags.push({ type: 'warning', message: 'Réponse partielle reçue' });
        }
        // Détecter contenu généré par IA
        else if (lowerResponse.includes('généré par ia') || 
                 lowerResponse.includes('generated by ai') ||
                 lowerResponse.includes('synthétique détecté') ||
                 lowerResponse.includes('synthetic detected') ||
                 lowerResponse.includes('contenu artificiel') ||
                 lowerResponse.includes('ai-generated')) {
            score = 35;
            verdict = 'MOSTLY_FALSE';
            summary = 'Contenu généré par IA détecté';
            flags.push({ type: 'warning', message: 'Contenu IA détecté' });
        }
        // Détecter les confirmations POSITIVES (mais seulement si contexte positif)
        else if ((lowerResponse.includes('confirme') || 
            lowerResponse.includes('véridique') || 
            lowerResponse.includes('exact') ||
            lowerResponse.includes('correct')) &&
            !lowerResponse.includes('ne confirme pas') &&
            !lowerResponse.includes('pas confirmé')) {
            score = 85;
            verdict = 'VERIFIED';
            summary = 'Contenu vérifié et authentique';
        }
        // Puis les NEGATIONS fortes
        else if (lowerResponse.includes('faux') || 
                 lowerResponse.includes('false') || 
                 lowerResponse.includes('désinformation') ||
                 lowerResponse.includes('mensonge')) {
            score = 25;
            verdict = 'FALSE';
            summary = 'Contenu identifié comme faux ou désinformation';
            flags.push({ type: 'danger', message: 'Désinformation détectée' });
        }
        // Contenu trompeur/manipulé (mais seulement si pas de confirmation positive avant)
        else if (lowerResponse.includes('trompeur') || 
                 lowerResponse.includes('misleading') || 
                 lowerResponse.includes('manipulé')) {
            score = 40;
            verdict = 'MOSTLY_FALSE';
            summary = 'Contenu potentiellement trompeur ou manipulé';
            flags.push({ type: 'warning', message: 'Contenu potentiellement trompeur' });
        }
        // Authentique/vérifié
        else if (lowerResponse.includes('vérifié') || 
                 lowerResponse.includes('verified') || 
                 lowerResponse.includes('authentique')) {
            score = 85;
            verdict = 'VERIFIED';
            summary = 'Contenu vérifié et authentique';
        }
        // Probable/plutôt vrai
        else if (lowerResponse.includes('probable') || 
                 lowerResponse.includes('likely') || 
                 lowerResponse.includes('plutôt vrai')) {
            score = 65;
            verdict = 'MOSTLY_TRUE';
            summary = 'Contenu probablement véridique';
        }
        // Défaut pour contenu narratif (contes, fables)
        else if (lowerResponse.includes('histoire') || 
                 lowerResponse.includes('conte') || 
                 lowerResponse.includes('fable') ||
                 lowerResponse.includes('fiction')) {
            score = 50;
            verdict = 'MIXED';
            summary = 'Contenu narratif/divertissement - non factuel';
        }
        else {
            summary = 'Analyse en cours - résultat non concluant';
        }
        
        // Détecter les outils utilisés par Vera
        const toolsUsed = [];
        if (lowerResponse.includes('deepfake')) toolsUsed.push('Détection deepfake');
        if (lowerResponse.includes('synthetic') || lowerResponse.includes('synthétique')) toolsUsed.push('Détection contenu IA');
        if (lowerResponse.includes('forgery') || lowerResponse.includes('manipulation')) toolsUsed.push('Analyse forensique');
        if (lowerResponse.includes('speech') || lowerResponse.includes('voix')) toolsUsed.push('Analyse audio');
        
        return {
            request_id: veraData.conversationId || `vera_${Date.now()}`,
            status: 'completed',
            score: score,
            verdict: verdict,
            summary: summary,
            flags: flags,
            sources: veraData.sources || [],
            explanation: analysisText,
            toolsUsed: toolsUsed,
            confidence: 0.8
        };
    }
    
    /**
     * Extraire le contenu textuel d'une vidéo pour analyse
     */
    extractTextContent(videoData) {
        const parts = [];
        
        if (videoData.title) parts.push(videoData.title);
        if (videoData.description) parts.push(videoData.description);
        if (videoData.hashtags && videoData.hashtags.length > 0) {
            parts.push(`Hashtags: ${videoData.hashtags.join(', ')}`);
        }
        
        return parts.join('\n\n');
    }
}

export default new VeraService();
