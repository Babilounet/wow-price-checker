import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import PriceDisplay from './PriceDisplay';
import { formatDateShort } from '../utils/formatDate';

interface PriceHistoryData {
  scan_timestamp: string;
  normal_price: number;
  deal_price: number | null;
  sample_size: number;
}

interface PriceHistoryChartProps {
  history: PriceHistoryData[];
  itemName?: string;
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded p-3 shadow-lg">
        <p className="text-gray-300 text-sm mb-2">{label}</p>
        {payload.map((entry, index) => {
          // Convert from gold back to copper for PriceDisplay
          const copperValue = Math.round((entry.value as number) * 10000);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: entry.color }}></div>
              <span className="text-gray-400">{entry.name}:</span>
              <PriceDisplay copper={copperValue} />
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

export default function PriceHistoryChart({ history, itemName }: PriceHistoryChartProps) {
  const chartData = history.map(h => ({
    date: formatDateShort(h.scan_timestamp) || 'N/A',
    normalGold: h.normal_price / 10000, // For display in gold
    dealGold: h.deal_price ? h.deal_price / 10000 : null,
    sampleSize: h.sample_size
  })).reverse(); // Chronological order

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">
        Évolution des prix {itemName && `- ${itemName}`}
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" label={{ value: 'Prix (or)', angle: -90, position: 'insideLeft' }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="normalGold"
            stroke="#10b981"
            strokeWidth={2}
            name="Prix Normal"
            dot={{ fill: '#10b981' }}
          />
          <Line
            type="monotone"
            dataKey="dealGold"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Deal"
            dot={{ fill: '#3b82f6' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-400">
        {history.length} scan{history.length > 1 ? 's' : ''} enregistré{history.length > 1 ? 's' : ''}
      </div>
    </div>
  );
}
