# WoW Price Checker

Alternative to TradeSkillMaster (TSM) with better price accuracy and outlier filtering. Track your WoW inventory in real-time and get accurate Auction House prices using Blizzard's official API.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![WoW](https://img.shields.io/badge/WoW-11.0.2-orange.svg)

## Why This Project?

TradeSkillMaster (TSM) has some limitations:
- Prices not always up-to-date (limited by API call frequency)
- Gold seller prices create huge price gaps
- No filtering of aberrant values

**WoW Price Checker** solves these issues:
- Direct hourly snapshots from Blizzard API
- Statistical outlier detection (IQR method)
- Real-time inventory tracking via pixel manipulation
- No `/reload` required

## Features

- **Real-time Inventory Sync**: Addon sends data via pixel encoding
- **Smart Price Analysis**: IQR-based outlier filtering removes gold seller prices
- **Accurate Pricing**: Direct Blizzard API snapshots (updated hourly)
- **Multi-realm Support**: Track prices across different servers
- **Historical Data**: Price trends and market analysis
- **REST API**: Build your own tools on top

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  WoW Addon  │ ──────▶ │  Desktop App │ ──────▶ │  Backend    │
│  (Lua)      │ pixels  │  (Electron)  │  HTTP   │  (Node.js)  │
└─────────────┘         └──────────────┘         └──────┬──────┘
                                                          │
                        ┌─────────────────────────────────┤
                        │                                 │
                   ┌────▼────┐                      ┌─────▼─────┐
                   │  Redis  │                      │ PostgreSQL│
                   │  Cache  │                      │  History  │
                   └─────────┘                      └───────────┘
```

## Tech Stack

### Backend
- **Node.js** + TypeScript + Express
- **PostgreSQL** - Historical data
- **Redis** - Caching layer
- **Blizzard API** - OAuth 2.0

### Frontend
- **React 19** + TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization

### Addon
- **Lua** - WoW addon language
- **Pixel Manipulation** - Real-time data transmission

## Quick Start

### Prerequisites

- Node.js >= 18
- Docker & Docker Compose
- Blizzard API credentials ([Get them here](https://develop.battle.net/))

### 1. Clone Repository

```bash
git clone https://github.com/Babilounet/wow-price-checker.git
cd wow-price-checker
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Blizzard API credentials:

```env
BLIZZARD_CLIENT_ID=your_client_id_here
BLIZZARD_CLIENT_SECRET=your_client_secret_here
```

### 3. Start Development Environment

```bash
make dev
```

Or manually:

```bash
docker-compose up -d
```

### 4. Install Addon

Copy the addon to your WoW directory:

```bash
cp -r addon/ "World of Warcraft/_retail_/Interface/AddOns/WowPriceChecker/"
```

Restart WoW or type `/reload`

## Services

After running `make dev`, you'll have:

- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Project Structure

```
wow-price-checker/
├── backend/              # Node.js API
│   ├── src/
│   │   ├── api/          # Routes
│   │   ├── auth/         # Blizzard OAuth
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Price analysis (IQR)
│   │   └── types/        # TypeScript types
│   └── sql/              # Database schema
│
├── frontend/             # React app
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── services/     # API client
│   │   └── utils/        # Helpers
│   └── ...
│
├── addon/                # WoW Lua addon
│   ├── Core.lua
│   ├── ItemScanner.lua
│   ├── PixelEncoder.lua
│   └── WowPriceChecker.toc
│
├── docs/                 # Documentation
├── docker-compose.yml    # Docker services
└── Makefile              # Development commands
```

## Usage

### Addon Commands

```
/wpc scan      - Manually scan inventory
/wpc show      - Display inventory in chat
/wpc toggle    - Enable/disable pixel encoding
/wpc debug     - Toggle debug mode
```

### API Examples

Get price statistics for an item:

```bash
curl http://localhost:3000/api/v1/auctions/3681/prices/171828
```

Response:

```json
{
  "success": true,
  "data": {
    "itemId": 171828,
    "realmId": 3681,
    "median": 125000,
    "mean": 127500,
    "min": 95000,
    "max": 180000,
    "marketValue": 126500,
    "minBuyout": 95000,
    "outliersRemoved": 5,
    "outlierPercentage": 8
  }
}
```

## Price Analysis Algorithm

Uses **Interquartile Range (IQR)** to filter outliers:

1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
2. Calculate IQR = Q3 - Q1
3. Remove prices < Q1 - 1.5×IQR or > Q3 + 1.5×IQR
4. Compute statistics on filtered data

This effectively removes gold seller prices and anomalies.

## Development

### Install Dependencies

```bash
make install
```

### Start Services

```bash
make dev
```

### View Logs

```bash
make logs
make logs-backend
make logs-frontend
```

### Run Tests

```bash
make test
```

### Stop Services

```bash
make stop
```

## Deployment

### 🐳 Self-Hosted Production (Recommended)

Deploy on your own server with Docker in 3 commands:

```bash
# 1. Configure
cp .env.prod.example .env
nano .env  # Add Blizzard API credentials

# 2. Deploy
make deploy

# 3. Access
# Application: http://your-server
# API: http://your-server/api/v1
```

**Complete guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)

**Features**:
- ✅ Fully Dockerized (portable deployment)
- ✅ Nginx reverse proxy with rate limiting
- ✅ SSL/TLS with Let's Encrypt (auto-renewal)
- ✅ Automated backups (PostgreSQL)
- ✅ Health checks and monitoring
- ✅ Production-optimized (non-root containers, security headers)

**Requirements**:
- Ubuntu/Debian server (2 CPU, 4GB RAM)
- Docker + Docker Compose
- Domain name (optional, for SSL)

### ☁️ Other Hosting Options

See [HOSTING.md](HOSTING.md) for alternatives:

- VPS (Hetzner, DigitalOcean) - ~10€/month
- Cloud (Railway, Render) - ~25€/month
- Raspberry Pi - Free

## Roadmap

See [PROJECT_PLAN.md](PROJECT_PLAN.md) for detailed development plan.

### Phase 1 - MVP ✅ COMPLETED
- [x] Backend API with Blizzard auth
- [x] Price analysis with IQR
- [x] Frontend React app
- [x] WoW addon with pixel encoding
- [x] Docker development environment
- [x] Production deployment setup (Docker + Nginx)
- [x] SSL/TLS support (Let's Encrypt)
- [x] Automated backups & restore

### Phase 2 - Enhancement
- [ ] Desktop Electron app
- [ ] Full pixel encoding/decoding
- [ ] WebSocket real-time updates
- [ ] Price history charts

### Phase 3 - Advanced
- [ ] Price alerts/notifications
- [ ] Crafting profit calculator
- [ ] Multi-character support
- [ ] Machine learning price predictions

## API Rate Limits

Blizzard API limits:
- **36,000 requests/hour**
- **100 requests/second**

The backend handles caching automatically to stay within limits.

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Self-hosted production deployment guide
- **[PROJECT_PLAN.md](PROJECT_PLAN.md)** - Development roadmap (9 phases)
- [HOSTING.md](HOSTING.md) - Hosting options comparison
- [backend/README.md](backend/README.md) - Backend API documentation
- [frontend/README.md](frontend/README.md) - Frontend application
- [addon/README.md](addon/README.md) - WoW addon guide

## License

MIT License - see [LICENSE](LICENSE) file

## Credits

Created by **babilounet** (babilounet@gmail.com)

## Support

- Issues: https://github.com/Babilounet/wow-price-checker/issues
- Discussions: https://github.com/Babilounet/wow-price-checker/discussions

---

**Note**: This is an independent project and is not affiliated with Blizzard Entertainment or TradeSkillMaster.
