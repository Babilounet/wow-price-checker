import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface IngestionStatus {
  itemsTracked: number;
  totalAuctions: number;
  realms: Array<{ name: string; region: string }>;
  lastUpdate: string;
}

export default function HomePage() {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/ingest/status`);
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Failed to trigger refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          WoW Price Checker
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Accurate Auction House prices for Classic Anniversary
        </p>
        <Link to="/search" className="btn-primary text-lg px-8 py-3 inline-block">
          Start Searching Items
        </Link>
      </div>

      {/* Database Status */}
      {!isLoading && status && (
        <div className="card bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-600/30">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Database Status</h2>
            <button
              onClick={triggerRefresh}
              disabled={isRefreshing}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh Data'}
            </button>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Items Tracked</div>
              <div className="text-3xl font-bold text-green-400">{status.itemsTracked.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Total Auctions</div>
              <div className="text-3xl font-bold text-blue-400">{status.totalAuctions.toLocaleString()}</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Realm</div>
              <div className="text-xl font-bold text-purple-400">
                {status.realms[0]?.name || 'N/A'} ({status.realms[0]?.region.toUpperCase()})
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-gray-400 text-sm mb-1">Last Update</div>
              <div className="text-sm font-mono text-yellow-400">
                {status.lastUpdate ? new Date(status.lastUpdate).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          title="Smart Price Analysis"
          description="IQR-based outlier filtering removes gold seller prices automatically"
          icon="📊"
        />
        <FeatureCard
          title="Real-time Data"
          description="Direct hourly snapshots from Blizzard API, always up-to-date"
          icon="⚡"
        />
        <FeatureCard
          title="Accurate Statistics"
          description="Median, mean, min, max with outliers removed for better accuracy"
          icon="🎯"
        />
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="space-y-4 text-gray-300">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">1️⃣</span>
            <div>
              <h3 className="font-semibold text-white">Search for Items</h3>
              <p>Enter item name or ID to find prices</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">2️⃣</span>
            <div>
              <h3 className="font-semibold text-white">View Filtered Prices</h3>
              <p>See market value with outliers removed (no more gold seller prices!)</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <span className="text-2xl">3️⃣</span>
            <div>
              <h3 className="font-semibold text-white">Make Informed Decisions</h3>
              <p>Use accurate statistics to buy low and sell high</p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison with TSM */}
      <div className="card bg-gradient-to-br from-gray-800 to-gray-900">
        <h2 className="text-2xl font-bold mb-4">Why Better Than TSM?</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-green-400 mb-2">✅ WoW Price Checker</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• Direct Blizzard API (hourly snapshots)</li>
              <li>• Statistical outlier filtering (IQR method)</li>
              <li>• Gold seller prices removed</li>
              <li>• Open source & self-hosted</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-orange-400 mb-2">⚠️ TradeSkillMaster</h3>
            <ul className="space-y-1 text-gray-300">
              <li>• Aggregated data (not always current)</li>
              <li>• Includes aberrant prices</li>
              <li>• Large price gaps</li>
              <li>• Closed source</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="text-center card bg-blue-600/10 border-blue-600/30">
        <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
        <p className="text-gray-300 mb-6">
          Search for any Classic Anniversary item and see accurate prices right now
        </p>
        <Link to="/search" className="btn-primary">
          Search Items Now
        </Link>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="card hover:border-blue-600/50 transition-colors">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}
