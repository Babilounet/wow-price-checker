# WoW Price Checker - Backend API

Backend service for WoW Price Checker using Blizzard Battle.net API.

## Features

- OAuth 2.0 authentication with Blizzard API
- Auction house data fetching and caching
- Price analysis with outlier detection (IQR method)
- Redis caching for performance
- TypeScript for type safety
- Comprehensive logging with Winston

## Prerequisites

- Node.js >= 18
- Redis server
- Blizzard API credentials ([Get them here](https://develop.battle.net/))

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` and add your Blizzard API credentials:

```env
BLIZZARD_CLIENT_ID=your_client_id
BLIZZARD_CLIENT_SECRET=your_client_secret
```

## Development

```bash
npm run dev
```

Server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run lint:fix` - Fix linting issues
- `npm run format` - Format code with Prettier

## API Endpoints

### Health Check

```
GET /api/v1/health
```

### Auctions

```
GET /api/v1/auctions/:realmId
GET /api/v1/auctions/:realmId/prices/:itemId
POST /api/v1/auctions/:realmId/prices/bulk
```

### Items

```
GET /api/v1/items/:itemId
GET /api/v1/items/:itemId/media
```

## Project Structure

```
src/
├── api/
│   └── routes/         # API route handlers
├── auth/               # Blizzard OAuth service
├── config/             # Configuration & env validation
├── services/           # Business logic services
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
│   ├── logger.ts       # Winston logger
│   └── priceAnalysis.ts # Price statistics & IQR
└── index.ts            # Application entry point
```

## Price Analysis Algorithm

The backend uses the **Interquartile Range (IQR)** method to filter outliers:

1. Calculate Q1 (25th percentile) and Q3 (75th percentile)
2. Calculate IQR = Q3 - Q1
3. Remove values < Q1 - 1.5×IQR or > Q3 + 1.5×IQR
4. Calculate statistics on filtered data

This effectively removes gold seller prices and other anomalies.

## Rate Limiting

Blizzard API limits:
- 36,000 requests per hour
- 100 requests per second

The backend handles rate limiting automatically with Redis caching.

## License

MIT
