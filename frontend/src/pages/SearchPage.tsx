import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ItemSearchAutocomplete from '../components/ItemSearchAutocomplete';

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

  // Refresh Wowhead tooltips on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.$WowheadPower) {
        window.$WowheadPower.refreshLinks();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemId.trim()) {
      navigate(`/item/${itemId.trim()}`);
    }
  };

  const handleAutocompleteSelect = (selectedItemId: number) => {
    navigate(`/item/${selectedItemId}`);
  };

  const handleQuickSearch = (id: number) => {
    navigate(`/item/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Rechercher un Item</h1>
        <p className="text-gray-400">
          Recherchez par nom ou entrez directement l'ID d'un item
        </p>
      </div>

      {/* Recherche par nom */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Recherche par nom</h2>
        <ItemSearchAutocomplete
          onSelect={handleAutocompleteSelect}
          placeholder="Ex: Thunderfury, Flask, Essence..."
        />
      </div>

      {/* Recherche par ID */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-3">Recherche par ID</h2>
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="number"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="Ex: 19019"
            className="input-field flex-1"
          />
          <button type="submit" className="btn-primary">
            Rechercher
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-2">
          Trouvez l'ID sur{' '}
          <a
            href="https://www.wowhead.com/classic"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Wowhead Classic
          </a>
        </p>
      </div>

      {/* Popular Items */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Items populaires</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {POPULAR_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleQuickSearch(item.id)}
              className="p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded transition-colors text-left flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">
                  <a
                    href={`https://fr.wowhead.com/classic/item=${item.id}`}
                    data-wowhead={`item=${item.id}&domain=fr.classic`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-white hover:text-blue-300"
                  >
                    {item.name}
                  </a>
                </div>
                <div className="text-sm text-gray-400">ID: {item.id}</div>
              </div>
              <span className="text-blue-400">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
