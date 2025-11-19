import type { PriceStatistics } from '../types';

interface PriceChartProps {
  priceStats: PriceStatistics;
}

export default function PriceChart({ priceStats }: PriceChartProps) {
  // Simple visualization using CSS (recharts can be added later)
  const { min, q1, median, q3, max, minBuyout, marketValue } = priceStats;

  // Normalize values for display (0-100 scale)
  const range = max - min || 1;
  const normalize = (value: number) => ((value - min) / range) * 100;

  return (
    <div className="card">
      <h3 className="text-xl font-semibold mb-6">Price Distribution</h3>

      {/* Visual Distribution */}
      <div className="relative h-32 bg-gray-900 rounded-lg p-4">
        {/* Box plot style visualization */}
        <div className="relative h-full">
          {/* Whisker line */}
          <div
            className="absolute top-1/2 h-0.5 bg-gray-600"
            style={{
              left: `${normalize(min)}%`,
              width: `${normalize(max) - normalize(min)}%`,
            }}
          ></div>

          {/* Box (IQR) */}
          <div
            className="absolute top-1/4 h-1/2 bg-blue-600/30 border-2 border-blue-600 rounded"
            style={{
              left: `${normalize(q1)}%`,
              width: `${normalize(q3) - normalize(q1)}%`,
            }}
          >
            {/* Median line */}
            <div
              className="absolute top-0 h-full w-0.5 bg-yellow-400"
              style={{
                left: `${((median - q1) / (q3 - q1)) * 100}%`,
              }}
            ></div>
          </div>

          {/* Min marker */}
          <div
            className="absolute top-0 w-1 h-full bg-green-500"
            style={{ left: `${normalize(min)}%` }}
          ></div>

          {/* Max marker */}
          <div
            className="absolute top-0 w-1 h-full bg-red-500"
            style={{ left: `${normalize(max)}%` }}
          ></div>

          {/* Market Value marker */}
          <div
            className="absolute top-0 w-1 h-full bg-purple-500"
            style={{ left: `${normalize(marketValue)}%` }}
          ></div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <LegendItem color="bg-green-500" label="Min" value={min} />
        <LegendItem color="bg-blue-600" label="Q1-Q3 (IQR)" value={`${q1} - ${q3}`} />
        <LegendItem color="bg-yellow-400" label="Median" value={median} />
        <LegendItem color="bg-red-500" label="Max" value={max} />
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        The box represents the interquartile range (middle 50% of prices). Outliers are not shown.
      </div>
    </div>
  );
}

interface LegendItemProps {
  color: string;
  label: string;
  value: number | string;
}

function LegendItem({ color, label, value }: LegendItemProps) {
  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 ${color} rounded`}></div>
      <div>
        <p className="text-gray-400 text-xs">{label}</p>
        <p className="font-mono text-xs">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}
