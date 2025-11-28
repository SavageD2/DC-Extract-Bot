import axios from 'axios';

class TikTokService {
    constructor() {
        this.apiKey = process.env.RAPIDAPI_KEY;
        this.apiHost = process.env.RAPIDAPI_HOST || 'tiktok-video-no-watermark2.p.rapidapi.com';
        this.baseURL = `https://${this.apiHost}`;
        
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'X-RapidAPI-Key': this.apiKey,
                'X-RapidAPI-Host': this.apiHost
            },
            timeout: 30000
        });
    }
    
    /**
     * Extraire une vidéo TikTok par URL
     */
    async extractVideo(url) {
        try {
            console.log(`📥 Extraction vidéo : ${url}`);
            
            // Extraire le username et l'ID de la vidéo depuis l'URL
            const videoId = this.extractVideoIdFromUrl(url);
            const usernameMatch = url.match(/@([^/]+)/);
            const username = usernameMatch ? usernameMatch[1] : null;
            
            if (!videoId) {
                throw new Error('URL invalide - impossible d\'extraire l\'ID de la vidéo');
            }
            
            // Essayer d'abord l'endpoint /video/details qui fonctionne le mieux
            try {
                const response = await this.client.get('/video/details', {
                    params: { video_id: videoId }
                });
                
                if (response.data && response.data.details) {
                    const videoData = response.data.details;
                    const stats = videoData.statistics || {};
                    const author = videoData.author || {};
                    
                    return {
                        video_id: videoData.video_id,
                        url: url,
                        author: author.uniqueId || author.author_name || username || 'Inconnu',
                        title: videoData.description || '',
                        description: videoData.description || '',
                        thumbnail_url: videoData.cover || videoData.avatar_thumb || '',
                        download_url: videoData.unwatermarked_download_url || videoData.download_url || '',
                        duration: videoData.duration || 0,
                        likes: stats.number_of_hearts || 0,
                        comments: stats.number_of_comments || 0,
                        shares: stats.number_of_reposts || 0,
                        saves: stats.number_of_saves || 0,
                        views: stats.number_of_plays || 0,
                        music: null,
                        hashtags: this.extractHashtags(videoData.description || ''),
                        created_at: videoData.create_time ? new Date(parseInt(videoData.create_time) * 1000).toISOString() : new Date().toISOString(),
                        author_verified: author.verified || false,
                        author_signature: author.signature || ''
                    };
                }
            } catch (directError) {
                // Si l'endpoint /video/details échoue, essayer le fallback /user/videos
                console.log(`⚠️ Endpoint /video/details échoué, tentative avec /user/videos...`);
                
                if (!username) {
                    throw new Error('Impossible d\'extraire le username pour le fallback');
                }
                
                const response = await this.client.get('/user/videos', {
                    params: { username }
                });
                
                if (!response.data || !response.data.videos) {
                    throw new Error('Vidéo non trouvée via les deux méthodes');
                }
                
                const videoData = response.data.videos.find(v => v.video_id === videoId);
                
                if (!videoData) {
                    throw new Error(`Vidéo ${videoId} non trouvée. Elle peut être privée, supprimée, ou trop ancienne (plus de 30 vidéos).`);
                }
                
                const stats = videoData.statistics || {};
                
                return {
                    video_id: videoData.video_id,
                    url: url,
                    author: videoData.author || username,
                    title: videoData.description || '',
                    description: videoData.description || '',
                    thumbnail_url: videoData.cover || '',
                    download_url: videoData.unwatermarked_download_url || videoData.download_url || '',
                    duration: videoData.duration || 0,
                    likes: stats.number_of_hearts || 0,
                    comments: stats.number_of_comments || 0,
                    shares: stats.number_of_reposts || 0,
                    saves: stats.number_of_saves || 0,
                    views: stats.number_of_plays || 0,
                    music: null,
                    hashtags: this.extractHashtags(videoData.description || ''),
                    created_at: videoData.create_time ? new Date(parseInt(videoData.create_time) * 1000).toISOString() : new Date().toISOString(),
                    author_verified: false,
                    author_signature: ''
                };
            }
        } catch (error) {
            console.error(`❌ Erreur extraction TikTok:`, error.message);
            throw error;
        }
    }

    /**
     * Extraire les hashtags d'une description
     */
    extractHashtags(description) {
        const hashtagPattern = /#[\w\u00C0-\u017F]+/g;
        const matches = description.match(hashtagPattern) || [];
        return matches.map(tag => tag.substring(1)); // Enlever le #
    }
    
    /**
     * Extraire les vidéos d'un utilisateur TikTok
     */
    async extractUserVideos(username, maxCount = 10) {
        try {
            console.log(`📥 Extraction vidéos de @${username}`);
            
            // D'abord récupérer les infos du user pour avoir son user_id
            const userInfo = await this.getUserInfo(username);
            
            if (!userInfo || !userInfo.user_id) {
                throw new Error('Utilisateur introuvable');
            }
            
            const response = await this.client.get('/user/posts', {
                params: {
                    unique_id: username,
                    count: Math.min(maxCount, 30) // API limit
                }
            });
            
            if (!response.data || !response.data.data || !response.data.data.videos) {
                throw new Error('Aucune vidéo trouvée pour cet utilisateur');
            }
            
            const videos = response.data.data.videos;
            
            // Normaliser chaque vidéo
            return videos.slice(0, maxCount).map(video => ({
                video_id: video.video_id || video.aweme_id,
                url: `https://www.tiktok.com/@${username}/video/${video.video_id || video.aweme_id}`,
                author: username,
                title: video.title || '',
                description: video.desc || '',
                thumbnail_url: video.cover || video.dynamic_cover || '',
                download_url: video.play || video.download_addr || '',
                duration: video.duration || 0,
                likes: video.digg_count || 0,
                comments: video.comment_count || 0,
                shares: video.share_count || 0,
                views: video.play_count || 0,
                created_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : new Date().toISOString()
            }));
            
        } catch (error) {
            console.error(`❌ Erreur extraction utilisateur @${username}:`, error.message);
            
            if (error.response) {
                if (error.response.status === 429) {
                    throw new Error('Limite de requêtes API atteinte. Veuillez réessayer dans quelques minutes.');
                }
                if (error.response.status === 404) {
                    throw new Error(`Utilisateur @${username} introuvable.`);
                }
                throw new Error(`Erreur API: ${error.response.status}`);
            }
            
            throw error;
        }
    }
    
    /**
     * Récupérer les informations d'un utilisateur TikTok
     */
    async getUserInfo(username) {
        try {
            const response = await this.client.get('/user/info', {
                params: { unique_id: username }
            });
            
            if (!response.data || !response.data.data) {
                throw new Error('Utilisateur introuvable');
            }
            
            const user = response.data.data.user;
            
            return {
                user_id: user.uid || user.id,
                username: user.unique_id || username,
                nickname: user.nickname,
                avatar: user.avatar_larger || user.avatar_medium || user.avatar_thumb,
                bio: user.signature,
                verified: user.verified || false,
                follower_count: user.follower_count || 0,
                following_count: user.following_count || 0,
                video_count: user.aweme_count || 0,
                likes_count: user.total_favorited || 0
            };
            
        } catch (error) {
            console.error(`❌ Erreur récupération info utilisateur @${username}:`, error.message);
            
            if (error.response?.status === 429) {
                throw new Error('Limite de requêtes API atteinte.');
            }
            
            throw error;
        }
    }
    
    /**
     * Extraire l'ID d'une vidéo depuis son URL
     */
    extractVideoIdFromUrl(url) {
        const patterns = [
            /\/video\/(\d+)/,
            /\/v\/(\d+)/,
            /tiktok\.com\/.*?\/(\d+)/,
            /vm\.tiktok\.com\/([A-Za-z0-9]+)/
        ];
        
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }
    
    /**
     * Extraire les hashtags d'une description
     */
    extractHashtags(text) {
        const hashtagPattern = /#[\w]+/g;
        const matches = text.match(hashtagPattern);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    }
    
    /**
     * Valider une URL TikTok
     */
    isValidTikTokUrl(url) {
        const patterns = [
            /tiktok\.com\/@[\w.-]+\/video\/\d+/,
            /tiktok\.com\/.*?\/video\/\d+/,
            /vm\.tiktok\.com\/[A-Za-z0-9]+/,
            /vt\.tiktok\.com\/[A-Za-z0-9]+/
        ];
        
        return patterns.some(pattern => pattern.test(url));
    }
    
    /**
     * Vérifier si une URL est une URL TikTok
     */
    isTikTokUrl(url) {
        return /tiktok\.com/.test(url);
    }
    
    /**
     * Normaliser une URL TikTok (résoudre les liens courts)
     */
    async resolveShortUrl(shortUrl) {
        try {
            // Suivre les redirections pour obtenir l'URL complète
            const response = await axios.get(shortUrl, {
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });
            
            return response.request.res.responseUrl || shortUrl;
            
        } catch (error) {
            console.warn('⚠️ Impossible de résoudre l\'URL courte:', error.message);
            return shortUrl;
        }
    }
}

export default new TikTokService();
