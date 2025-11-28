# TikTok Fact-Checker Bot - Guide de Démarrage Rapide

## 📋 Prérequis

- Node.js 18+ installé
- Redis installé et en cours d'exécution (pour les files d'attente)
- Un bot Telegram créé via [@BotFather](https://t.me/botfather)
- Clé RapidAPI pour "TikTok video no watermark2"
- (Optionnel) Clé API Vera AI

## 🚀 Installation

### 1. Installer les dépendances

```bash
cd c:\Users\bourh\tiktok-factchecker-bot
npm install
```

### 2. Configurer les variables d'environnement

Copiez `.env.example` vers `.env` :

```bash
cp .env.example .env
```

Puis éditez `.env` avec vos valeurs :

```env
# Configuration Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Configuration RapidAPI (TikTok)
RAPIDAPI_KEY=58e5d9576fmshc44ab9c98b8aeaap13fb03jsn6b5292d93042
RAPIDAPI_HOST=tiktok-video-no-watermark2.p.rapidapi.com

# Configuration Vera AI (optionnel - mode démo si absent)
VERA_API_KEY=votre_cle_vera_api
VERA_API_ENDPOINT=https://api.vera.ai/v1

# Base de données
DATABASE_PATH=./data/factchecker.db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Initialiser la base de données

```bash
npm run db:init
```

### 4. Démarrer Redis

#### Windows avec WSL :
```bash
wsl redis-server
```

#### Windows avec Redis natif :
```bash
redis-server
```

### 5. Démarrer le bot

```bash
npm start
```

Ou en mode développement (auto-reload) :
```bash
npm run dev
```

## 📱 Utilisation du Bot Telegram

### Commandes disponibles

- `/start` - Démarrer et voir le guide
- `/help` - Afficher l'aide détaillée
- `/check [url]` - Vérifier une vidéo TikTok
- `/monitor @username` - Surveiller un compte TikTok
- `/stop @username` - Arrêter la surveillance d'un compte
- `/list` - Voir vos comptes surveillés
- `/stats` - Voir vos statistiques

### Exemples d'utilisation

**Vérifier une vidéo :**
```
/check https://www.tiktok.com/@user/video/1234567890
```

**Surveiller un compte :**
```
/monitor @username
```

**Arrêter la surveillance :**
```
/stop @username
```

## 🏗️ Architecture

```
src/
├── index.js                  # Point d'entrée principal
├── bot/
│   └── telegram.js          # Service bot Telegram
├── services/
│   ├── tiktok.service.js   # Extraction vidéos TikTok
│   ├── vera.service.js     # Vérification Vera AI
│   └── monitoring.service.js # Surveillance et files d'attente
└── database/
    ├── init.js             # Initialisation DB
    └── service.js          # Requêtes DB
```

## 🔧 Configuration

### Créer un Bot Telegram

1. Ouvrir [@BotFather](https://t.me/botfather) sur Telegram
2. Envoyer `/newbot`
3. Suivre les instructions
4. Copier le token fourni dans `.env`

### Obtenir une clé RapidAPI

1. Créer un compte sur [RapidAPI](https://rapidapi.com/)
2. S'abonner à l'API "TikTok video no watermark2"
3. Copier la clé API dans `.env`

### Obtenir une clé Vera AI

1. Contacter Vera AI pour obtenir une clé
2. Ajouter la clé dans `.env`
3. Si absent, le bot fonctionnera en mode démo

## 📊 Base de données

Le bot utilise SQLite3 avec les tables suivantes :

- `videos` - Vidéos TikTok extraites
- `verifications` - Résultats de vérifications Vera
- `monitored_accounts` - Comptes TikTok surveillés
- `monitoring_logs` - Logs de surveillance
- `telegram_users` - Utilisateurs du bot

## 🔄 Surveillance automatique

Le bot vérifie tous les comptes surveillés toutes les **5 minutes**.

Pour chaque compte :
1. Récupère les dernières vidéos
2. Compare avec la dernière vidéo connue
3. Vérifie les nouvelles vidéos avec Vera AI
4. Envoie une notification Telegram

## 🐛 Débogage

### Vérifier que Redis fonctionne

```bash
redis-cli ping
# Devrait retourner: PONG
```

### Voir les logs en temps réel

```bash
npm run dev
```

### Vérifier la base de données

```bash
sqlite3 data/factchecker.db
sqlite> SELECT COUNT(*) FROM videos;
sqlite> .exit
```

## 📦 Intégration dans une autre application

Le bot est conçu pour être modulaire. Les services peuvent être importés indépendamment :

```javascript
import tiktokService from './src/services/tiktok.service.js';
import veraService from './src/services/vera.service.js';

// Extraire une vidéo
const video = await tiktokService.extractVideo(url);

// Vérifier avec Vera
const verification = await veraService.checkVideo(video);
```

## ⚠️ Limites et considérations

- **Rate limits RapidAPI** : Respecter les limites de votre plan
- **Rate limits Telegram** : Max 30 messages/seconde
- **Surveillance** : Max 10 comptes par utilisateur
- **Base de données** : Nettoyer régulièrement les anciennes données

## 🔒 Sécurité

- Ne jamais commiter le fichier `.env`
- Garder les clés API secrètes
- Utiliser HTTPS pour les webhooks en production
- Implémenter un rate limiting côté utilisateur

## 📝 Logs

Les logs sont affichés dans la console avec des emojis :
- ✅ Succès
- ❌ Erreur
- ⚠️ Avertissement
- 🔍 Vérification en cours
- 📥 Extraction
- 👀 Surveillance

## 🚀 Déploiement en production

### Avec PM2

```bash
npm install -g pm2
pm2 start src/index.js --name tiktok-factchecker
pm2 save
pm2 startup
```

### Variables d'environnement production

```env
NODE_ENV=production
LOG_LEVEL=error
```

## 📞 Support

Pour toute question ou problème :
1. Vérifier les logs
2. Consulter la documentation
3. Vérifier que toutes les variables d'environnement sont configurées

---

**Version** : 1.0.0  
**Dernière mise à jour** : 2024
