import { formatPrice } from '../utils/formatPrice';

interface PriceClusterCardProps {
  type: 'normal' | 'deal' | 'aberrant';
  price: number;
  auctionCount: number;
  label: string;
  percentage?: number;
}

const typeStyles = {
  normal: {
    bg: 'bg-green-900/30',
    border: 'border-green-600/50',
    icon: '✓',
    badge: 'Prix Normal'
  },
  deal: {
    bg: 'bg-blue-900/30',
    border: 'border-blue-600/50',
    icon: '💰',
    badge: 'Deal!'
  },
  aberrant: {
    bg: 'bg-red-900/30',
    border: 'border-red-600/50',
    icon: '⚠️',
    badge: 'Suspect'
  }
};

export default function PriceClusterCard({
  type,
  price,
  auctionCount,
  label,
  percentage
}: PriceClusterCardProps) {
  const style = typeStyles[type];

  return (
    <div className={`card ${style.bg} ${style.border}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-xs px-2 py-1 rounded bg-gray-800/50">{style.badge}</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl">{style.icon}</span>
        <span className="text-3xl font-bold">{formatPrice(price)}</span>
      </div>

      <div className="text-sm text-gray-400">
        {auctionCount} enchères{percentage && ` (${percentage.toFixed(1)}%)`}
      </div>
    </div>
  );
}
