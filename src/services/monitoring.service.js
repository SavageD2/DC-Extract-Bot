import tiktokService from './tiktok.service.js';
import veraService from './vera.service.js';
import dbService from '../database/service.js';

class MonitoringService {
    constructor() {
        this.isRunning = false;
        this.monitoringInterval = null;
    }
    
    async processVideoCheck(data) {
        const { url, chatId, userId } = data;
        try {
            console.log(`í´ Traitement vÃ©rification: ${url}`);
            const videoData = await tiktokService.extractVideo(url);
            const videoId = dbService.createVideo(videoData);
            const verificationResult = await veraService.checkVideo(videoData);
            dbService.createVerification({
                video_id: videoId,
                vera_request_id: verificationResult.request_id,
                status: verificationResult.status,
                score: verificationResult.score,
                verdict: verificationResult.verdict,
                flags: verificationResult.flags,
                sources: verificationResult.sources,
                explanation: verificationResult.explanation
            });
            return { success: true, videoData, verificationResult };
        } catch (error) {
            console.error('âŒ Erreur processVideoCheck:', error.message);
            throw error;
        }
    }
    
    async addVideoCheck(url, chatId, userId) {
        return await this.processVideoCheck({ url, chatId, userId });
    }
    
    async startPeriodicMonitoring() {
        console.log('â° Surveillance pÃ©riodique activÃ©e (mode simplifiÃ©)');
    }
    
    stopPeriodicMonitoring() {
        console.log('í»‘ Surveillance pÃ©riodique arrÃªtÃ©e');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default new MonitoringService();
