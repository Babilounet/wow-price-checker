import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatPrice } from '../utils/formatPrice';
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

export default function PriceHistoryChart({ history, itemName }: PriceHistoryChartProps) {
  const chartData = history.map(h => ({
    date: formatDateShort(h.scan_timestamp),
    normalPrice: h.normal_price / 10000, // Convert to gold
    dealPrice: h.deal_price ? h.deal_price / 10000 : null,
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
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            formatter={(value: number) => `${value.toFixed(2)}g`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="normalPrice"
            stroke="#10b981"
            strokeWidth={2}
            name="Prix Normal"
            dot={{ fill: '#10b981' }}
          />
          <Line
            type="monotone"
            dataKey="dealPrice"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Deal"
            dot={{ fill: '#3b82f6' }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-400">
        {history.length} scans enregistrés
      </div>
    </div>
  );
}
