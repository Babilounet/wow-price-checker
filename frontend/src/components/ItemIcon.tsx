interface ItemIconProps {
  itemId?: number;
  name?: string;
  quality?: string;
  iconUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const qualityColors: Record<string, string> = {
  POOR: '#9d9d9d',
  COMMON: '#ffffff',
  UNCOMMON: '#1eff00',
  RARE: '#0070dd',
  EPIC: '#a335ee',
  LEGENDARY: '#ff8000',
};

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export default function ItemIcon({
  itemId,
  name,
  quality = 'COMMON',
  iconUrl,
  size = 'md',
  showTooltip = true
}: ItemIconProps) {
  const borderColor = qualityColors[quality] || qualityColors.COMMON;

  // Display icon with optional Wowhead tooltip
  const iconElement = (
    <div
      className={`${sizeClasses[size]} relative rounded border-2 bg-gray-800 flex items-center justify-center overflow-hidden`}
      style={{ borderColor }}
      title={!showTooltip ? name : undefined}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={name || `Item ${itemId}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to placeholder on error
            e.currentTarget.style.display = 'none';
            const span = document.createElement('span');
            span.className = 'text-gray-500 text-xs';
            span.textContent = '?';
            e.currentTarget.parentElement!.appendChild(span);
          }}
        />
      ) : (
        <span className="text-gray-500 text-xs">?</span>
      )}
    </div>
  );

  // Wrap in Wowhead link for tooltip if enabled
  if (itemId && showTooltip) {
    return (
      <a
        href={`https://fr.wowhead.com/classic/item=${itemId}`}
        data-wowhead={`item=${itemId}&domain=fr`}
        className="block"
      >
        {iconElement}
      </a>
    );
  }

  return iconElement;
}
