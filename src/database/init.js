import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../../data/factchecker.db');

// Créer le dossier data s'il n'existe pas
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Activer les foreign keys
db.pragma('foreign_keys = ON');

// Table des vidéos TikTok extraites
db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT UNIQUE NOT NULL,
        url TEXT NOT NULL,
        author TEXT,
        title TEXT,
        description TEXT,
        thumbnail_url TEXT,
        download_url TEXT,
        duration INTEGER,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Table des vérifications Vera
db.exec(`
    CREATE TABLE IF NOT EXISTS verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        vera_request_id TEXT,
        status TEXT NOT NULL,
        score REAL,
        verdict TEXT,
        flags TEXT,
        sources TEXT,
        explanation TEXT,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    )
`);

// Table des comptes surveillés
db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        telegram_user_id INTEGER NOT NULL,
        last_check_at DATETIME,
        last_video_id TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Table des logs de monitoring
db.exec(`
    CREATE TABLE IF NOT EXISTS monitoring_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        videos_found INTEGER DEFAULT 0,
        new_videos INTEGER DEFAULT 0,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES monitored_accounts(id) ON DELETE CASCADE
    )
`);

// Table des utilisateurs Telegram (pour rate limiting et stats)
db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        requests_count INTEGER DEFAULT 0,
        last_request_at DATETIME,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Index pour performances
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
    CREATE INDEX IF NOT EXISTS idx_videos_author ON videos(author);
    CREATE INDEX IF NOT EXISTS idx_verifications_video_id ON verifications(video_id);
    CREATE INDEX IF NOT EXISTS idx_monitored_accounts_username ON monitored_accounts(username);
    CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
`);

console.log('✅ Base de données initialisée avec succès !');
console.log(`📁 Fichier : ${DB_PATH}`);

export default db;
