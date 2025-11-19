import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import type { PriceStatistics } from '../types';
import { formatPrice, formatNumber } from '../utils/formatPrice';
import PriceChart from '../components/PriceChart';
import { useSettings } from '../context/SettingsContext';

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { realmId } = useSettings();
  const [priceStats, setPriceStats] = useState<PriceStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;

    const fetchPrices = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.getPriceStats(realmId, parseInt(itemId));
        setPriceStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [itemId, realmId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-400">Loading price data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card bg-red-900/20 border-red-600/50">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <Link to="/search" className="btn-secondary">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  if (!priceStats) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-xl font-bold mb-2">No Data Available</h2>
          <p className="text-gray-400 mb-4">
            This item is not currently on the auction house.
          </p>
          <Link to="/search" className="btn-secondary">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/search" className="text-blue-400 hover:underline text-sm mb-2 block">
            ← Back to Search
          </Link>
          <h1 className="text-3xl font-bold">Item ID: {itemId}</h1>
          <p className="text-gray-400">Realm: {priceStats.realmId}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Last Updated</p>
          <p className="text-gray-300">{new Date(priceStats.timestamp).toLocaleString()}</p>
        </div>
      </div>

      {/* Main Price Card */}
      <div className="card bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-600/30">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">Market Value (IQR Filtered)</p>
          <p className="text-5xl font-bold text-blue-400 mb-1">
            {formatPrice(priceStats.marketValue)}
          </p>
          <p className="text-gray-500 text-sm">per item</p>
        </div>
      </div>

      {/* Price Stats Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Median Price"
          value={formatPrice(priceStats.median)}
          description="50th percentile"
        />
        <StatCard
          label="Mean Price"
          value={formatPrice(priceStats.mean)}
          description="Average price"
        />
        <StatCard
          label="Min Buyout"
          value={formatPrice(priceStats.minBuyout)}
          description="Cheapest available"
          highlight="green"
        />
      </div>

      {/* Price Range */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Price Range (Outliers Removed)</h3>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <p className="text-sm text-gray-400 mb-1">Minimum</p>
            <p className="text-lg font-semibold text-green-400">{formatPrice(priceStats.min)}</p>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-gradient-to-r from-green-600 via-yellow-600 to-red-600 rounded"></div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-sm text-gray-400 mb-1">Maximum</p>
            <p className="text-lg font-semibold text-red-400">{formatPrice(priceStats.max)}</p>
          </div>
        </div>
      </div>

      {/* Auction Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Auction Statistics</h3>
          <div className="space-y-2">
            <StatRow label="Total Auctions" value={formatNumber(priceStats.totalAuctions)} />
            <StatRow label="Total Quantity" value={formatNumber(priceStats.totalQuantity)} />
            <StatRow
              label="Outliers Removed"
              value={`${priceStats.outliersRemoved} (${priceStats.outlierPercentage}%)`}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-3">IQR Statistics</h3>
          <div className="space-y-2">
            <StatRow label="Q1 (25th percentile)" value={formatPrice(priceStats.q1)} />
            <StatRow label="Q3 (75th percentile)" value={formatPrice(priceStats.q3)} />
            <StatRow label="IQR (Q3 - Q1)" value={formatPrice(priceStats.iqr)} />
          </div>
        </div>
      </div>

      {/* Price Distribution Chart */}
      <PriceChart priceStats={priceStats} />

      {/* Info Box */}
      <div className="card bg-blue-900/10 border-blue-600/30">
        <h3 className="font-semibold mb-2">About IQR Filtering</h3>
        <p className="text-sm text-gray-300">
          This price analysis uses the <strong>Interquartile Range (IQR)</strong> method to filter
          out aberrant prices (like gold seller listings). Prices outside of Q1 - 1.5×IQR and Q3 +
          1.5×IQR are considered outliers and excluded from statistics.
        </p>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  highlight?: 'green' | 'red';
}

function StatCard({ label, value, description, highlight }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold mb-1 ${highlight === 'green'
          ? 'text-green-400'
          : highlight === 'red'
            ? 'text-red-400'
            : 'text-white'
          }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

interface StatRowProps {
  label: string;
  value: string;
}

function StatRow({ label, value }: StatRowProps) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
