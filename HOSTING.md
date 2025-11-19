# Hébergement - Infrastructure requise

**Dernière mise à jour**: 2025-11-19

---

## 🏗️ Architecture de déploiement

```
┌─────────────────────────────────────────────────┐
│              UTILISATEUR LOCAL                  │
│  ┌──────────────┐         ┌─────────────────┐  │
│  │  WoW Client  │ ──────▶ │  Desktop App    │  │
│  │  + Addon     │  pixels │  (Electron)     │  │
│  └──────────────┘         └────────┬────────┘  │
│                                     │ HTTPS     │
└─────────────────────────────────────┼───────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────┐
│              SERVEUR CLOUD                      │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Load Balancer / Reverse Proxy    │  │
│  │              (Nginx/Caddy)               │  │
│  └────────┬─────────────────────────────────┘  │
│           │                                     │
│  ┌────────▼─────────┐      ┌────────────────┐  │
│  │  Backend API     │      │  Frontend SPA  │  │
│  │  (Node.js)       │      │  (React build) │  │
│  │  - Express       │      │                │  │
│  │  - WebSocket     │      └────────────────┘  │
│  └────────┬─────────┘                           │
│           │                                     │
│  ┌────────▼─────────┐      ┌────────────────┐  │
│  │  PostgreSQL      │      │  Redis Cache   │  │
│  │  (historique)    │      │  (hot data)    │  │
│  └──────────────────┘      └────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Cron Jobs / Scheduler            │  │
│  │  - Fetch AH data (hourly)                │  │
│  │  - Cleanup old data (daily)              │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Blizzard API   │
            │  (external)     │
            └─────────────────┘
```

---

## 💰 Options d'hébergement (comparatif)

### Option 1: VPS Traditionnel (RECOMMANDÉ pour démarrer) ⭐

**Providers**:
- **Hetzner** (meilleur rapport qualité/prix EU)
  - CPX21: 3 vCPU, 4GB RAM, 80GB SSD → **~7€/mois**
  - CPX31: 4 vCPU, 8GB RAM, 160GB SSD → **~13€/mois**
- **DigitalOcean**
  - Droplet 2GB → **12$/mois**
  - Droplet 4GB → **24$/mois**
- **Scaleway**
  - DEV1-M: 3 vCPU, 4GB RAM → **~11€/mois**

**Avantages**:
- Prix fixe prévisible
- Contrôle total
- Bon pour prototypage
- Facile à gérer

**Inconvénients**:
- Scalabilité manuelle
- Gestion serveur (updates, sécurité)

**Coût total mensuel**: **~15-20€**
- VPS: 7-13€
- Domaine: 1€/mois (10€/an)
- Backup S3: 2-5€
- **Total**: ~15-20€/mois

---

### Option 2: Cloud Managé (pour scaling futur)

**Providers**:
- **Vercel** (frontend uniquement) → Gratuit (hobby)
- **Railway.app** (backend + DB tout-en-un)
  - Hobby: 5$/mois de crédit gratuit
  - Developer: 20$/mois
- **Render.com**
  - Web service: 7$/mois/instance
  - PostgreSQL: 7$/mois
  - Redis: 10$/mois
- **Fly.io**
  - Pay-as-you-go (gratuit jusqu'à ~5$/mois)

**Coût total mensuel**: **~25-50$/mois** (si trafic modéré)

**Avantages**:
- Zero-ops (pas de gestion serveur)
- Auto-scaling
- CI/CD intégré
- Gratuit en dev

**Inconvénients**:
- Plus cher à long terme
- Moins de contrôle

---

### Option 3: Self-Hosted (gratuit mais demande machine 24/7)

**Chez vous**:
- Raspberry Pi 4 (8GB) ou mini-PC
- Connexion stable + IP fixe/DynDNS
- Router avec port forwarding

**Coût total**: **~0€/mois** (électricité ~5€/mois)

**Avantages**:
- Gratuit long terme
- Contrôle total
- Bon pour apprendre

**Inconvénients**:
- Dépend de votre connexion
- Sécurité à gérer vous-même
- Pas de garantie uptime

---

## 🗄️ Besoins en stockage

### Base de données PostgreSQL
```
Estimation données:
- ~200 realms EU/US
- ~50,000 items actifs AH par realm
- Snapshot horaire = 24/jour
- Rétention 30 jours historique

Calcul:
- 1 auction = ~100 bytes (itemId, price, quantity, timestamp)
- 50k auctions × 100 bytes = 5 MB/snapshot
- 5 MB × 24 snapshots × 30 jours = 3.6 GB/realm/mois
- 3.6 GB × 5 realms suivis = ~18 GB/mois

TOTAL: ~20-50 GB pour DB (avec indexes)
```

### Redis Cache
```
- Hot data: ~500 MB - 2 GB
- Items populaires + prix récents
- TTL 5-10 minutes
```

### Espace disque total recommandé: **100 GB minimum**

---

## 🔧 Services requis

### 1. Serveur Web/API (Node.js)
- **CPU**: 2-4 vCPU
- **RAM**: 2-4 GB
- **Bande passante**: ~500 GB/mois (si 1000 users actifs)

### 2. Base de données PostgreSQL
- **RAM**: 2 GB minimum (4 GB recommandé)
- **Stockage**: 50-100 GB SSD

### 3. Cache Redis
- **RAM**: 512 MB - 2 GB
- **Persistance**: Optionnelle (RDB snapshots)

### 4. Reverse Proxy (Nginx/Caddy)
- **RAM**: 256 MB
- **SSL**: Let's Encrypt (gratuit)

### 5. Monitoring (optionnel mais recommandé)
- **Prometheus + Grafana** ou **Uptime Kuma**
- **RAM**: ~512 MB

---

## 📦 Configuration Docker Compose recommandée

### VPS unique (tout-en-un)
```yaml
services:
  nginx:        # Reverse proxy
  backend:      # Node.js API
  frontend:     # React build (nginx)
  postgres:     # Database
  redis:        # Cache
  scheduler:    # Cron jobs (node-cron)
  monitoring:   # Uptime Kuma (optionnel)
```

**Ressources totales**:
- CPU: 3-4 vCPU
- RAM: 4-6 GB
- Stockage: 80-100 GB

➡️ **Hetzner CPX21** (7€/mois) suffit pour démarrer !

---

## 🌐 Domaine & DNS

### Nom de domaine
- **Gandi**: ~12€/an (.com/.net)
- **Cloudflare Registrar**: ~10€/an
- **OVH**: ~8€/an (.fr)

### DNS + CDN (optionnel)
- **Cloudflare**: Gratuit (CDN + DDoS protection)
- **Cloudflare Tunnel**: Gratuit (alternative à IP publique)

### Exemple DNS:
```
api.wowpricecheck.com   → Backend API
app.wowpricecheck.com   → Frontend React
```

---

## 🔐 Sécurité & Backups

### SSL/TLS
- **Let's Encrypt** (gratuit, auto-renew avec Caddy)

### Firewall
- Ouvrir uniquement: 80 (HTTP), 443 (HTTPS), 22 (SSH - IP whitelisting)

### Backups base de données
- **Automated dumps**: pg_dump quotidien
- **Storage**: S3/Backblaze B2 (~2€/mois pour 50GB)
- **Rétention**: 7 jours rolling + 1 snapshot mensuel

### Secrets management
- Variables d'environnement (Docker secrets)
- Blizzard API keys **jamais** dans le code

---

## 📊 Estimation coûts TOTAL

### Setup minimal (Phase MVP)
| Service | Provider | Coût |
|---------|----------|------|
| VPS (4GB RAM) | Hetzner CPX21 | 7€/mois |
| Domaine | Gandi | 1€/mois |
| Backup S3 | Backblaze B2 | 2€/mois |
| **TOTAL** | | **~10€/mois** |

### Setup scaling (1000+ users)
| Service | Provider | Coût |
|---------|----------|------|
| VPS (8GB RAM) | Hetzner CPX31 | 13€/mois |
| DB managée | Railway/Render | 7€/mois |
| Redis managé | Upstash | 5€/mois |
| CDN | Cloudflare | Gratuit |
| Monitoring | Grafana Cloud | Gratuit (tier free) |
| Backup S3 | Backblaze B2 | 5€/mois |
| **TOTAL** | | **~30€/mois** |

---

## 🚀 Checklist déploiement

### Pré-déploiement
- [ ] Créer compte Blizzard Developer (API keys)
- [ ] Acheter domaine (wowpricecheck.com ?)
- [ ] Créer compte VPS (Hetzner/DO)
- [ ] Setup DNS (Cloudflare recommandé)

### Déploiement
- [ ] Provisionner VPS (Ubuntu 22.04 LTS)
- [ ] Installer Docker + Docker Compose
- [ ] Clone repo GitHub
- [ ] Configurer .env (secrets)
- [ ] `docker-compose up -d`
- [ ] Setup SSL (Caddy auto ou certbot)
- [ ] Configurer firewall (ufw)

### Post-déploiement
- [ ] Tests smoke (endpoints API)
- [ ] Setup monitoring (Uptime Kuma)
- [ ] Configurer backups automatiques
- [ ] Documentation utilisateur
- [ ] Release addon WoW sur CurseForge/GitHub

---

## 🆓 Option GRATUITE (pour tester)

### Stack 100% gratuit:
1. **Backend API**: Railway.app (5$/mois gratuit)
2. **Frontend**: Vercel/Netlify (gratuit)
3. **DB**: Supabase PostgreSQL (500MB gratuit)
4. **Redis**: Upstash (10k commands/day gratuit)
5. **Domaine**: Freenom .tk/.ml (gratuit mais limité)

**Limitations**:
- Pas de custom domain pro
- Limites trafic strictes
- Pas de support
- OK pour beta/testing

---

## 📝 Recommandation finale

### Phase 1 (MVP - 3 premiers mois):
➡️ **Hetzner CPX21** (7€/mois) + Domaine Gandi (1€/mois)
- **Total**: ~10€/mois
- Suffisant pour 100-500 utilisateurs
- Facile à upgrader

### Phase 2 (Production - après beta):
➡️ **Hetzner CPX31** (13€/mois) + Services managés
- **Total**: ~30€/mois
- Supporte 1000+ utilisateurs
- Meilleure résilience

### Phase 3 (Si succès):
➡️ Migration vers cloud managé (Railway/Render)
- Auto-scaling
- Zero-ops
- ~50-100€/mois selon trafic

---

**Question**: Voulez-vous commencer avec la stack gratuite pour tester, ou directement VPS Hetzner pour avoir quelque chose de solide ?
