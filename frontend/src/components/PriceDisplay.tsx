interface PriceDisplayProps {
  copper: number;
  className?: string;
}

export default function PriceDisplay({ copper, className = '' }: PriceDisplayProps) {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperAmount = copper % 100;

  return (
    <span className={`font-mono ${className}`}>
      <span className="text-white">{gold.toLocaleString()}</span>
      <span className="text-yellow-400">g</span>
      {' '}
      <span className="text-white">{silver}</span>
      <span className="text-gray-300">s</span>
      {' '}
      <span className="text-white">{copperAmount}</span>
      <span className="text-orange-400">c</span>
    </span>
  );
}
