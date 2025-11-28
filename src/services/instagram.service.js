import axios from 'axios';

class InstagramService {
    constructor() {
        this.apiKey = process.env.RAPIDAPI_KEY;
        // Utiliser Instagram Best Experience API
        this.apiHost = 'instagram-best-experience.p.rapidapi.com';
        
        this.client = axios.create({
            baseURL: `https://${this.apiHost}`,
            headers: {
                'x-rapidapi-key': this.apiKey,
                'x-rapidapi-host': this.apiHost
            },
            timeout: 30000
        });
    }
    
    /**
     * Extraire un post Instagram par URL
     */
    async extractPost(url) {
        try {
            console.log(`📥 Extraction post Instagram : ${url}`);
            
            // Extraire le shortcode depuis l'URL
            const shortcode = this.extractShortcodeFromUrl(url);
            
            if (!shortcode) {
                throw new Error('URL invalide - impossible d\'extraire le shortcode');
            }
            
            // Utiliser l'endpoint "/post" qui accepte le shortcode
            const response = await this.client.get('/post', {
                params: { shortcode: shortcode }
            });
            
            if (!response.data) {
                throw new Error('Réponse API invalide ou post introuvable');
            }
            
            return this.normalizePostData(response.data, shortcode, url);
            
        } catch (error) {
            console.error(`❌ Erreur extraction Instagram:`, error.message);
            
            if (error.response) {
                if (error.response.status === 404) {
                    throw new Error('Post Instagram introuvable ou privé');
                }
                if (error.response.status === 429) {
                    throw new Error('Limite API atteinte - réessayez dans quelques instants');
                }
            }
            
            throw error;
        }
    }
    
    /**
     * Normaliser les données d'un post Instagram
     */
    normalizePostData(postData, shortcode, url) {
        // Adapter selon la structure de Instagram Best Experience API
        const caption = postData.caption?.text || postData.title || '';
        const isVideo = postData.media_type === 2 || postData.product_type === 'igtv' || postData.product_type === 'clips';
        
        return {
            post_id: postData.pk || postData.id || shortcode,
            shortcode: postData.code || shortcode,
            url: url,
            author: postData.user?.username || 'Inconnu',
            author_id: postData.user?.pk || '',
            author_verified: postData.user?.is_verified || false,
            caption: caption,
            type: isVideo ? 'video' : 'photo',
            is_video: isVideo,
            thumbnail_url: postData.image_versions2?.candidates?.[0]?.url || '',
            video_url: postData.video_versions?.[0]?.url || '',
            images: postData.carousel_media?.map(m => m.image_versions2?.candidates?.[0]?.url) || 
                    [postData.image_versions2?.candidates?.[0]?.url].filter(Boolean),
            likes: postData.like_count || 0,
            comments: postData.comment_count || 0,
            views: postData.video_view_count || postData.view_count || postData.play_count || 0,
            created_at: postData.taken_at ? new Date(postData.taken_at * 1000).toISOString() : new Date().toISOString(),
            location: postData.location?.name || null,
            hashtags: this.extractHashtags(caption),
            mentions: this.extractMentions(caption)
        };
    }
    
    /**
     * Extraire le shortcode depuis l'URL Instagram
     */
    extractShortcodeFromUrl(url) {
        // Formats supportés:
        // https://www.instagram.com/p/SHORTCODE/
        // https://www.instagram.com/reel/SHORTCODE/
        // https://instagram.com/p/SHORTCODE/
        
        const patterns = [
            /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
            /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
            /instagram\.com\/tv\/([A-Za-z0-9_-]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        
        return null;
    }
    
    /**
     * Extraire les hashtags d'un texte
     */
    extractHashtags(text) {
        const hashtagPattern = /#[\w\u00C0-\u017F]+/g;
        const matches = text.match(hashtagPattern) || [];
        return matches.map(tag => tag.substring(1));
    }
    
    /**
     * Extraire les mentions d'un texte
     */
    extractMentions(text) {
        const mentionPattern = /@[\w\u00C0-\u017F.]+/g;
        const matches = text.match(mentionPattern) || [];
        return matches.map(mention => mention.substring(1));
    }
    
    /**
     * Vérifier si une URL est une URL Instagram
     */
    isInstagramUrl(url) {
        return /instagram\.com\/(p|reel|tv)\//.test(url);
    }
}

export default new InstagramService();
