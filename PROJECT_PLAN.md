# WoW Price Checker - Plan de développement

**Dernière mise à jour**: 2025-11-19
**Statut actuel**: Phase 1 - Setup initial

---

## 🎯 Objectif du projet

Alternative à TSM (TradeSkillMaster) avec :
- ✅ Prix plus à jour (snapshots horaires directs Blizzard API)
- ✅ Filtrage statistique des prix aberrants (gold sellers)
- ✅ Communication temps réel addon ↔ app (pixel manipulation)

---

## 📊 Stack technique choisie

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + Vite + TypeScript
- **Addon WoW**: Lua (pixel manipulation pour temps réel)
- **Base de données**: PostgreSQL (historique) + Redis (cache)
- **API externe**: Blizzard Battle.net API (OAuth 2.0)

---

## 📋 Plan de développement (checklist)

### Phase 1: Setup & Infrastructure ⏳ EN COURS
- [ ] 1.1 - Créer structure de dossiers (backend, frontend, addon)
- [ ] 1.2 - Setup backend Node.js/TypeScript + configuration
- [ ] 1.3 - Setup frontend React/Vite + configuration
- [ ] 1.4 - Créer addon WoW de base (.toc + structure)
- [ ] 1.5 - Configuration Docker (PostgreSQL + Redis)
- [ ] 1.6 - Variables d'environnement (.env.example)

**Livrable**: Projet structuré, dépendances installées, configs OK

---

### Phase 2: Authentification Blizzard
- [ ] 2.1 - Créer application sur https://develop.battle.net/
- [ ] 2.2 - Implémenter OAuth 2.0 (client credentials flow)
- [ ] 2.3 - Système de refresh token automatique
- [ ] 2.4 - Middleware Express pour auth
- [ ] 2.5 - Tests d'authentification (Postman/curl)

**Livrable**: Backend authentifié, peut appeler l'API Blizzard

---

### Phase 3: Récupération données Auction House
- [ ] 3.1 - Service API Blizzard (typescript client)
- [ ] 3.2 - Endpoint `/auctions/:realmId` (fetch data)
- [ ] 3.3 - Cache Redis (5-10min TTL)
- [ ] 3.4 - Rate limiting (36k req/h, 100 req/s)
- [ ] 3.5 - Job scheduler (fetch automatique toutes les heures)
- [ ] 3.6 - Stockage historique PostgreSQL

**Livrable**: Backend récupère et stocke les données AH

---

### Phase 4: Algorithme de filtrage des prix
- [ ] 4.1 - Implémentation IQR (Interquartile Range)
- [ ] 4.2 - Détection outliers (Q1 - 1.5*IQR, Q3 + 1.5*IQR)
- [ ] 4.3 - Calculs statistiques (médiane, moyenne, min/max filtrés)
- [ ] 4.4 - Endpoint `/prices/:itemId` (prix analysés)
- [ ] 4.5 - Tests unitaires algorithme
- [ ] 4.6 - Graphiques de distribution (optionnel)

**Livrable**: API retourne prix filtrés et stats

---

### Phase 5: Addon WoW - Scanner d'inventaire
- [ ] 5.1 - Scanner bags (GetContainerNumSlots, GetContainerItemInfo)
- [ ] 5.2 - Scanner bank (GetNumBankSlots)
- [ ] 5.3 - Extraction item IDs + quantités
- [ ] 5.4 - Structure de données Lua (table)
- [ ] 5.5 - Slash commands (/wpc scan, /wpc show)
- [ ] 5.6 - Debug UI (frame pour affichage)

**Livrable**: Addon scan l'inventaire du joueur

---

### Phase 6: Communication Pixel Manipulation 🚀 COMPLEXE
- [ ] 6.1 - Recherche méthode encodage (RGB → binary data)
- [ ] 6.2 - Addon: Encoder données → pixels (1x1 frame)
- [ ] 6.3 - Addon: Afficher frame invisible (off-screen)
- [ ] 6.4 - Desktop app: Screen capture (node-screenshots)
- [ ] 6.5 - Desktop app: Décodage pixels → JSON
- [ ] 6.6 - Tests communication bout-en-bout
- [ ] 6.7 - Optimisation fréquence refresh (1-5 sec)

**Livrable**: Addon envoie données en temps réel à l'app

---

### Phase 7: Frontend React
- [ ] 7.1 - Design UI/UX (wireframes)
- [ ] 7.2 - Page inventaire (liste items + prix)
- [ ] 7.3 - Graphiques prix (recharts/visx)
- [ ] 7.4 - Filtres/recherche items
- [ ] 7.5 - Settings (realm, character)
- [ ] 7.6 - WebSocket pour updates temps réel
- [ ] 7.7 - Responsive design

**Livrable**: Interface web fonctionnelle

---

### Phase 8: Optimisations & Production
- [ ] 8.1 - Caching intelligent (stratégie multi-niveaux)
- [ ] 8.2 - Compression API responses (gzip)
- [ ] 8.3 - Logging (Winston/Pino)
- [ ] 8.4 - Monitoring (health checks)
- [ ] 8.5 - CI/CD (GitHub Actions)
- [ ] 8.6 - Docker Compose production
- [ ] 8.7 - Documentation utilisateur

**Livrable**: App prête pour déploiement

---

### Phase 9: Features avancées (Post-MVP)
- [ ] 9.1 - Alertes prix (notifications)
- [ ] 9.2 - Suggestions craft profitables
- [ ] 9.3 - Multi-personnages
- [ ] 9.4 - Export CSV/Excel
- [ ] 9.5 - Mode "dark" UI
- [ ] 9.6 - Machine Learning (prédiction tendances)

---

## 🔄 Point de reprise rapide

### Si interruption, reprendre ici :
```
1. Lire ce fichier (PROJECT_PLAN.md)
2. Vérifier dernière case cochée [x]
3. Consulter ARCHITECTURE.md pour contexte technique
4. Continuer à la prochaine tâche [ ]
```

### Commandes utiles pour contexte :
```bash
# Voir statut git
git status

# Voir structure projet
tree -L 2 -I node_modules

# Voir derniers commits
git log --oneline -5

# Tester backend
cd backend && npm run dev

# Tester frontend
cd frontend && npm run dev
```

---

## 📝 Notes de développement

### Contraintes API Blizzard
- **Rate limit**: 36,000 req/h (100 req/s)
- **Snapshots AH**: Mis à jour 1x/heure
- **Auth**: OAuth 2.0, token dans header `Authorization: Bearer`

### Contraintes Addon WoW
- **Pas de HTTP** direct en Lua
- **Pixel manipulation**: Seule méthode temps réel sans /reload
- **Limitations API**: Certaines fonctions désactivées en combat

### Algorithme filtrage prix (IQR)
```
1. Trier prix croissants
2. Q1 = 25e percentile, Q3 = 75e percentile
3. IQR = Q3 - Q1
4. Exclure si: prix < Q1 - 1.5*IQR OU prix > Q3 + 1.5*IQR
5. Calculer stats sur données filtrées
```

---

## 🐛 Problèmes connus / TODO
- [ ] Vérifier si Blizzard API nécessite client secret rotation
- [ ] Tester performance pixel manipulation (latence ?)
- [ ] Définir stratégie backup données historiques

---

## 📚 Ressources utiles

- [Blizzard API Docs](https://community.developer.battle.net/documentation/world-of-warcraft)
- [WoW Addon API](https://wowpedia.fandom.com/wiki/World_of_Warcraft_API)
- [OAuth 2.0 Guide](https://community.developer.battle.net/documentation/guides/using-oauth)
- [IQR Outlier Detection](https://en.wikipedia.org/wiki/Interquartile_range)

---

**Prochaine étape**: Phase 1.1 - Créer structure de dossiers
