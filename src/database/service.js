import db from './init.js';

class DatabaseService {
    // ========== VIDÉOS ==========
    
    createVideo(videoData) {
        const stmt = db.prepare(`
            INSERT INTO videos (
                video_id, url, author, title, description, 
                thumbnail_url, download_url, duration,
                likes, comments, shares, views
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        try {
            const info = stmt.run(
                videoData.video_id,
                videoData.url,
                videoData.author,
                videoData.title,
                videoData.description,
                videoData.thumbnail_url,
                videoData.download_url,
                videoData.duration || 0,
                videoData.likes || 0,
                videoData.comments || 0,
                videoData.shares || 0,
                videoData.views || 0
            );
            return info.lastInsertRowid;
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                // Vidéo déjà existante, retourner son ID
                const existing = this.getVideoByVideoId(videoData.video_id);
                return existing ? existing.id : null;
            }
            throw error;
        }
    }
    
    getVideoById(id) {
        const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
        return stmt.get(id);
    }
    
    getVideoByVideoId(videoId) {
        const stmt = db.prepare('SELECT * FROM videos WHERE video_id = ?');
        return stmt.get(videoId);
    }
    
    getVideosByAuthor(author, limit = 50) {
        const stmt = db.prepare(`
            SELECT * FROM videos 
            WHERE author = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(author, limit);
    }
    
    // ========== VÉRIFICATIONS ==========
    
    createVerification(verificationData) {
        const stmt = db.prepare(`
            INSERT INTO verifications (
                video_id, vera_request_id, status, score, 
                verdict, flags, sources, explanation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            verificationData.video_id,
            verificationData.vera_request_id,
            verificationData.status,
            verificationData.score,
            verificationData.verdict,
            JSON.stringify(verificationData.flags || []),
            JSON.stringify(verificationData.sources || []),
            verificationData.explanation
        );
        
        return info.lastInsertRowid;
    }
    
    getVerificationsByVideoId(videoId) {
        const stmt = db.prepare(`
            SELECT * FROM verifications 
            WHERE video_id = ? 
            ORDER BY verified_at DESC
        `);
        const results = stmt.all(videoId);
        
        // Parser les JSON
        return results.map(v => ({
            ...v,
            flags: JSON.parse(v.flags || '[]'),
            sources: JSON.parse(v.sources || '[]')
        }));
    }
    
    getLatestVerification(videoId) {
        const stmt = db.prepare(`
            SELECT * FROM verifications 
            WHERE video_id = ? 
            ORDER BY verified_at DESC 
            LIMIT 1
        `);
        const result = stmt.get(videoId);
        
        if (result) {
            result.flags = JSON.parse(result.flags || '[]');
            result.sources = JSON.parse(result.sources || '[]');
        }
        
        return result;
    }
    
    // ========== COMPTES SURVEILLÉS ==========
    
    createMonitoredAccount(username, telegramUserId) {
        const stmt = db.prepare(`
            INSERT INTO monitored_accounts (username, telegram_user_id)
            VALUES (?, ?)
        `);
        
        try {
            const info = stmt.run(username, telegramUserId);
            return info.lastInsertRowid;
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return null; // Compte déjà surveillé
            }
            throw error;
        }
    }
    
    getMonitoredAccount(username) {
        const stmt = db.prepare('SELECT * FROM monitored_accounts WHERE username = ?');
        return stmt.get(username);
    }
    
    getAllActiveMonitoredAccounts() {
        const stmt = db.prepare(`
            SELECT * FROM monitored_accounts 
            WHERE status = 'active'
            ORDER BY last_check_at ASC
        `);
        return stmt.all();
    }
    
    updateMonitoredAccountCheck(username, lastVideoId) {
        const stmt = db.prepare(`
            UPDATE monitored_accounts 
            SET last_check_at = CURRENT_TIMESTAMP, 
                last_video_id = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
        `);
        return stmt.run(lastVideoId, username);
    }
    
    stopMonitoredAccount(username) {
        const stmt = db.prepare(`
            UPDATE monitored_accounts 
            SET status = 'inactive',
                updated_at = CURRENT_TIMESTAMP
            WHERE username = ?
        `);
        return stmt.run(username);
    }
    
    getMonitoredAccountsByUser(telegramUserId) {
        const stmt = db.prepare(`
            SELECT * FROM monitored_accounts 
            WHERE telegram_user_id = ? AND status = 'active'
            ORDER BY created_at DESC
        `);
        return stmt.all(telegramUserId);
    }
    
    // ========== LOGS DE MONITORING ==========
    
    createMonitoringLog(accountId, action, videosFound, newVideos, details) {
        const stmt = db.prepare(`
            INSERT INTO monitoring_logs (
                account_id, action, videos_found, new_videos, details
            ) VALUES (?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            accountId,
            action,
            videosFound,
            newVideos,
            JSON.stringify(details || {})
        );
        
        return info.lastInsertRowid;
    }
    
    getMonitoringLogs(accountId, limit = 20) {
        const stmt = db.prepare(`
            SELECT * FROM monitoring_logs 
            WHERE account_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        `);
        return stmt.all(accountId, limit);
    }
    
    // ========== UTILISATEURS TELEGRAM ==========
    
    createOrUpdateTelegramUser(userData) {
        const stmt = db.prepare(`
            INSERT INTO telegram_users (telegram_id, username, first_name, last_name)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(telegram_id) DO UPDATE SET
                username = excluded.username,
                first_name = excluded.first_name,
                last_name = excluded.last_name
        `);
        
        return stmt.run(
            userData.telegram_id,
            userData.username,
            userData.first_name,
            userData.last_name
        );
    }
    
    incrementUserRequests(telegramId) {
        const stmt = db.prepare(`
            UPDATE telegram_users 
            SET requests_count = requests_count + 1,
                last_request_at = CURRENT_TIMESTAMP
            WHERE telegram_id = ?
        `);
        return stmt.run(telegramId);
    }
    
    getTelegramUser(telegramId) {
        const stmt = db.prepare('SELECT * FROM telegram_users WHERE telegram_id = ?');
        return stmt.get(telegramId);
    }
    
    // ========== STATISTIQUES ==========
    
    getUserStats(telegramId) {
        const user = this.getTelegramUser(telegramId);
        const monitoredAccounts = this.getMonitoredAccountsByUser(telegramId);
        
        const totalVideosStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM videos v
            JOIN verifications vr ON v.id = vr.video_id
            WHERE v.author IN (
                SELECT username FROM monitored_accounts WHERE telegram_user_id = ?
            )
        `);
        const totalVideos = totalVideosStmt.get(telegramId);
        
        return {
            requests: user ? user.requests_count : 0,
            monitored_accounts: monitoredAccounts.length,
            verified_videos: totalVideos.count,
            joined_at: user ? user.joined_at : null
        };
    }
    
    getGlobalStats() {
        const stats = {};
        
        const videosStmt = db.prepare('SELECT COUNT(*) as count FROM videos');
        stats.total_videos = videosStmt.get().count;
        
        const verificationsStmt = db.prepare('SELECT COUNT(*) as count FROM verifications');
        stats.total_verifications = verificationsStmt.get().count;
        
        const accountsStmt = db.prepare(`
            SELECT COUNT(*) as count 
            FROM monitored_accounts 
            WHERE status = 'active'
        `);
        stats.active_accounts = accountsStmt.get().count;
        
        const usersStmt = db.prepare('SELECT COUNT(*) as count FROM telegram_users');
        stats.total_users = usersStmt.get().count;
        
        return stats;
    }
    
    // ========== NETTOYAGE ==========
    
    cleanOldData(daysOld = 30) {
        const stmt = db.prepare(`
            DELETE FROM videos 
            WHERE id NOT IN (
                SELECT video_id FROM verifications
            )
            AND created_at < datetime('now', '-' || ? || ' days')
        `);
        
        const info = stmt.run(daysOld);
        return info.changes;
    }
}

export default new DatabaseService();
