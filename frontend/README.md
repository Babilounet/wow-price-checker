# WoW Price Checker - Frontend

React + TypeScript frontend for WoW Price Checker.

## Features

- Real-time inventory display
- Price statistics with outlier detection
- Interactive charts
- Responsive design with Tailwind CSS
- WebSocket support for live updates

## Prerequisites

- Node.js >= 18
- Backend API running

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

2. Edit `.env` to point to your backend:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

## Development

```bash
npm run dev
```

App will be available at `http://localhost:5173`

## Build

```bash
npm run build
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Recharts** - Charts
- **Axios** - HTTP client
- **Lucide React** - Icons

## Project Structure

```
src/
├── components/       # React components
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── services/         # API services
├── types/            # TypeScript types
├── utils/            # Utility functions
└── App.tsx           # Main app component
```

## License

MIT
