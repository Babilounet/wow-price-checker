import { useState, useEffect } from 'react';
import ItemIcon from './ItemIcon';

interface SearchResult {
  item_id: number;
  name: string;
  quality: string;
  icon_url: string;
}

interface ItemSearchAutocompleteProps {
  onSelect: (itemId: number) => void;
  placeholder?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function ItemSearchAutocomplete({
  onSelect,
  placeholder = "Rechercher un item..."
}: ItemSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/items/search?q=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();
        if (data.success) {
          setResults(data.data.items);
          setShowDropdown(true);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (itemId: number) => {
    setQuery('');
    setShowDropdown(false);
    onSelect(itemId);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        placeholder={placeholder}
        className="input-field w-full"
      />

      {isLoading && (
        <div className="absolute right-3 top-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.item_id}
              onClick={() => handleSelect(item.item_id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 transition-colors text-left"
            >
              <ItemIcon
                itemId={item.item_id}
                name={item.name}
                quality={item.quality}
                iconUrl={item.icon_url}
                size="sm"
                showTooltip={false}
              />
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-gray-400">ID: {item.item_id}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showDropdown && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg p-4 text-gray-400 text-center">
          Aucun résultat trouvé
        </div>
      )}
    </div>
  );
}
