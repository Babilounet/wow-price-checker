import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../utils/formatPrice';

// Popular Classic Anniversary items for quick access
const POPULAR_ITEMS = [
  { id: 2589, name: 'Linen Cloth' },
  { id: 2592, name: 'Wool Cloth' },
  { id: 4338, name: 'Mageweave Cloth' },
  { id: 14047, name: 'Runecloth' },
  { id: 12359, name: 'Thorium Bar' },
  { id: 12364, name: 'Huge Emerald' },
  { id: 12800, name: 'Azerothian Diamond' },
  { id: 13467, name: 'Ichor of Undeath' },
];

export default function SearchPage() {
  const [itemId, setItemId] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemId.trim()) {
      navigate(`/item/${itemId.trim()}`);
    }
  };

  const handleQuickSearch = (id: number) => {
    navigate(`/item/${id}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Search Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-3">Search Items</h1>
        <p className="text-gray-400">
          Enter an item ID to view current auction house prices
        </p>
      </div>

      {/* Search Form */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="itemId" className="block text-sm font-medium mb-2">
              Item ID
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                id="itemId"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder="e.g., 2589 (Linen Cloth)"
                className="input flex-1 text-lg"
                autoFocus
              />
              <button type="submit" className="btn-primary px-8">
                Search
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Tip: Find item IDs on{' '}
              <a
                href="https://classic.wowhead.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                Wowhead Classic
              </a>
            </p>
          </div>
        </form>
      </div>

      {/* Popular Items */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Popular Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {POPULAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleQuickSearch(item.id)}
              className="card hover:border-blue-600 transition-colors text-left p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="text-sm text-gray-400">ID: {item.id}</p>
                </div>
                <span className="text-blue-400">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* How to Find Item ID */}
      <div className="card bg-gray-800/50">
        <h3 className="font-semibold mb-3">How to Find an Item ID</h3>
        <ol className="space-y-2 text-gray-300 text-sm">
          <li>
            <strong className="text-white">1.</strong> Go to{' '}
            <a
              href="https://classic.wowhead.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Wowhead Classic
            </a>
          </li>
          <li>
            <strong className="text-white">2.</strong> Search for your item
          </li>
          <li>
            <strong className="text-white">3.</strong> Look at the URL:{' '}
            <code className="bg-gray-900 px-2 py-1 rounded">
              classic.wowhead.com/item=<span className="text-green-400">2589</span>
            </code>
          </li>
          <li>
            <strong className="text-white">4.</strong> The number after <code>item=</code> is the
            item ID
          </li>
        </ol>
      </div>
    </div>
  );
}
