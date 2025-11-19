# WoW Price Checker - Guide de Déploiement Self-Hosted

Ce guide explique comment déployer **WoW Price Checker** sur votre propre serveur en utilisant Docker.

## 📋 Prérequis

### Serveur
- Ubuntu 20.04+ / Debian 11+ (ou autre distribution Linux)
- 2 CPU cores minimum (4 recommandé)
- 4 GB RAM minimum (8 GB recommandé)
- 50 GB d'espace disque
- Connexion Internet stable

### Logiciels
- Docker 20.10+
- Docker Compose 2.0+
- Git

### Réseau
- Port 80 (HTTP) ouvert
- Port 443 (HTTPS) ouvert si SSL
- Nom de domaine (optionnel mais recommandé pour SSL)

### Blizzard API
- Compte Blizzard Developer
- Client ID et Client Secret

---

## 🚀 Installation Rapide

### 1. Installer Docker

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Se déconnecter et reconnecter pour appliquer les changements
```

### 2. Cloner le Projet

```bash
git clone https://github.com/Babilounet/wow-price-checker.git
cd wow-price-checker
```

### 3. Configurer l'Environnement

```bash
# Copier le fichier d'exemple
cp .env.prod.example .env

# Éditer la configuration
nano .env
```

**Configuration minimale requise** :

```env
# Base de données PostgreSQL
POSTGRES_PASSWORD=VotreMotDePasseSecurise123!

# Redis
REDIS_PASSWORD=VotreMotDePasseRedis456!

# Blizzard API (OBLIGATOIRE)
BLIZZARD_CLIENT_ID=votre_client_id_ici
BLIZZARD_CLIENT_SECRET=votre_client_secret_ici
BLIZZARD_REGION=eu
```

### 4. Déployer

```bash
# Lancer le script de déploiement
./scripts/deploy.sh
```

Le script va :
- ✅ Vérifier la configuration
- ✅ Construire les images Docker
- ✅ Démarrer tous les services
- ✅ Vérifier l'état de santé

### 5. Vérifier

```bash
# Vérifier que tous les services sont up
docker-compose -f docker-compose.prod.yml ps

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs -f

# Tester l'API
curl http://localhost/api/v1/health
```

L'application devrait être accessible sur :
- **Frontend** : http://votre-serveur
- **API** : http://votre-serveur/api/v1

---

## 🔐 Configuration SSL/TLS (Recommandé)

### Prérequis
- Nom de domaine pointant vers votre serveur
- Ports 80 et 443 ouverts

### 1. Obtenir un Certificat SSL

```bash
./scripts/ssl-setup.sh votre-domaine.com votre-email@example.com
```

### 2. Activer HTTPS dans Nginx

Éditer `nginx/conf.d/default.conf` :

```bash
nano nginx/conf.d/default.conf
```

Décommenter le bloc HTTPS et mettre à jour `server_name` :

```nginx
server {
    listen 443 ssl http2;
    server_name votre-domaine.com;  # ← Changer ici

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # ... reste de la configuration
}
```

### 3. Redémarrer Nginx

```bash
docker-compose -f docker-compose.prod.yml restart nginx
```

### 4. Configurer le Renouvellement Automatique

Ajouter à crontab :

```bash
crontab -e
```

Ajouter cette ligne :

```
0 3 * * * /chemin/vers/wow-price-checker/scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1
```

---

## 💾 Sauvegardes

### Backup Manuel

```bash
./scripts/backup.sh
```

Les backups sont stockés dans `backups/` avec format : `wpc_backup_YYYYMMDD_HHMMSS.sql.gz`

### Backup Automatique

Ajouter à crontab :

```bash
crontab -e
```

Ajouter :

```
# Backup quotidien à 2h du matin
0 2 * * * /chemin/vers/wow-price-checker/scripts/backup.sh >> /var/log/wpc-backup.log 2>&1
```

### Restaurer un Backup

```bash
./scripts/restore.sh backups/wpc_backup_20250119_140000.sql.gz
```

---

## 📊 Monitoring et Maintenance

### Voir les Logs

```bash
# Tous les logs
docker-compose -f docker-compose.prod.yml logs -f

# Backend seulement
docker-compose -f docker-compose.prod.yml logs -f backend

# Nginx seulement
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Vérifier l'État des Services

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Redémarrer un Service

```bash
# Redémarrer le backend
docker-compose -f docker-compose.prod.yml restart backend

# Redémarrer tout
docker-compose -f docker-compose.prod.yml restart
```

### Mettre à Jour

```bash
# Récupérer les dernières modifications
git pull

# Redéployer
./scripts/deploy.sh
```

### Nettoyer les Anciennes Images

```bash
docker image prune -a
docker volume prune
```

---

## 🔧 Configuration Avancée

### Rate Limiting

Éditer `nginx/nginx.conf` pour ajuster les limites :

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=30r/m;
```

### PostgreSQL Performance

Pour améliorer les performances, éditer `docker-compose.prod.yml` :

```yaml
command:
  - "postgres"
  - "-c"
  - "max_connections=200"
  - "-c"
  - "shared_buffers=512MB"  # Augmenter pour plus de RAM
  - "-c"
  - "effective_cache_size=2GB"  # 25% de RAM totale
```

### Redis Cache Size

```yaml
command: >
  redis-server
  --maxmemory 1gb  # Augmenter selon RAM disponible
  --maxmemory-policy allkeys-lru
```

### Activer le Job de Fetch Automatique

⚠️ Consomme des quotas API Blizzard (36k req/h)

Dans `.env` :

```env
ENABLE_AH_FETCH_JOB=true
AH_FETCH_CRON="0 * * * *"  # Chaque heure
```

Redémarrer :

```bash
docker-compose -f docker-compose.prod.yml restart backend
```

---

## 🐛 Troubleshooting

### Services ne démarrent pas

```bash
# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs

# Vérifier les ressources
docker stats
free -h
df -h
```

### Base de données ne se connecte pas

```bash
# Vérifier que PostgreSQL est healthy
docker-compose -f docker-compose.prod.yml ps postgres

# Tester la connexion
docker exec -it wpc-postgres psql -U postgres -d wow_price_checker
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que le backend répond
docker exec -it wpc-backend wget -O- http://localhost:3000/api/v1/health

# Redémarrer nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Manque d'espace disque

```bash
# Nettoyer les logs Docker
docker system prune -a --volumes

# Supprimer les vieux backups
find backups/ -name "*.sql.gz" -mtime +30 -delete
```

### Erreur API Blizzard 401

```bash
# Vérifier les credentials
docker exec -it wpc-backend env | grep BLIZZARD

# Tester l'authentification
docker exec -it wpc-backend node -e "
const axios = require('axios');
axios.post('https://oauth.battle.net/token',
  'grant_type=client_credentials',
  {auth: {username: process.env.BLIZZARD_CLIENT_ID, password: process.env.BLIZZARD_CLIENT_SECRET}}
).then(r => console.log('✅ OK')).catch(e => console.log('❌', e.message))
"
```

---

## 📈 Optimisation Performance

### Activer le Cache Nginx

Décommenter dans `nginx/conf.d/default.conf` :

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    add_header X-Cache-Status $upstream_cache_status;
    # ...
}
```

### Optimiser PostgreSQL Indexes

Connectez-vous à la DB :

```bash
docker exec -it wpc-postgres psql -U postgres -d wow_price_checker
```

Analyser les requêtes lentes :

```sql
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;
```

### Monitoring avec Uptime Kuma (optionnel)

```bash
docker run -d --restart=always \
  -p 3005:3001 \
  -v uptime-kuma:/app/data \
  --name uptime-kuma \
  louislam/uptime-kuma:1
```

Accès : http://votre-serveur:3005

---

## 🔄 Migration vers un Nouveau Serveur

### 1. Sur l'Ancien Serveur

```bash
# Backup complet
./scripts/backup.sh

# Copier le backup et la configuration
scp backups/wpc_backup_*.sql.gz user@nouveau-serveur:/tmp/
scp .env user@nouveau-serveur:/tmp/
```

### 2. Sur le Nouveau Serveur

```bash
# Installer et configurer
git clone https://github.com/Babilounet/wow-price-checker.git
cd wow-price-checker
cp /tmp/.env .
./scripts/deploy.sh

# Restaurer les données
./scripts/restore.sh /tmp/wpc_backup_*.sql.gz
```

---

## 📞 Support

- **Issues** : https://github.com/Babilounet/wow-price-checker/issues
- **Documentation** : README.md, PROJECT_PLAN.md, HOSTING.md

---

## 📝 Checklist de Déploiement

- [ ] Docker et Docker Compose installés
- [ ] Repository cloné
- [ ] `.env` configuré avec credentials Blizzard
- [ ] Mot de passe PostgreSQL changé
- [ ] Services démarrés (`./scripts/deploy.sh`)
- [ ] API accessible (test `/api/v1/health`)
- [ ] Frontend accessible
- [ ] SSL configuré (si domaine)
- [ ] Backups automatiques configurés (crontab)
- [ ] Monitoring en place

---

**Temps de déploiement estimé** : 15-30 minutes

**Besoin d'aide ?** Consultez les logs ou ouvrez une issue sur GitHub.
