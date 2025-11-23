import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import ItemIcon from '../components/ItemIcon';
import PriceDisplay from '../components/PriceDisplay';
import { formatDateTime } from '../utils/formatDate';

interface InventoryItem {
  item_id: number;
  name: string;
  quality: string;
  icon_url: string;
  quantity: number;
  market_value: number;
  last_seen: string;
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [ignoredItems, setIgnoredItems] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'quantity'>('value');

  const CHARACTER_NAME = 'Babss'; // TODO: Get from settings or env

  // Load ignored items from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ignoredItems');
    if (saved) {
      setIgnoredItems(new Set(JSON.parse(saved)));
    }
  }, []);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setIsLoading(true);
        const [inventoryData] = await Promise.all([
          apiClient.getInventory(CHARACTER_NAME)
        ]);

        setInventory(inventoryData.items);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, []);

  // Refresh Wowhead tooltips when inventory changes
  useEffect(() => {
    if (!isLoading && inventory.length > 0) {
      const timer = setTimeout(() => {
        if (window.$WowheadPower) {
          window.$WowheadPower.refreshLinks();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [inventory, isLoading]);

  const toggleIgnore = (itemId: number) => {
    const newIgnored = new Set(ignoredItems);
    if (newIgnored.has(itemId)) {
      newIgnored.delete(itemId);
    } else {
      newIgnored.add(itemId);
    }
    setIgnoredItems(newIgnored);
    localStorage.setItem('ignoredItems', JSON.stringify([...newIgnored]));
  };

  const valuedItems = inventory.filter(item => !ignoredItems.has(item.item_id));
  const ignoredItemsList = inventory.filter(item => ignoredItems.has(item.item_id));

  const sortItems = (items: InventoryItem[]) => {
    return [...items].sort((a, b) => {
      switch (sortBy) {
        case 'value':
          return ((b.market_value || 0) * b.quantity) - ((a.market_value || 0) * a.quantity);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'quantity':
          return b.quantity - a.quantity;
        default:
          return 0;
      }
    });
  };

  const sortedValuedItems = sortItems(valuedItems);
  const sortedIgnoredItems = sortItems(ignoredItemsList);

  const totalValue = valuedItems.reduce((sum, item) =>
    sum + (item.market_value || 0) * item.quantity, 0
  );

  if (isLoading) {
    return <div className="text-center py-20">Chargement de l'inventaire...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-br from-purple-900/30 to-blue-900/30">
        <h1 className="text-3xl font-bold mb-4">Inventaire de {CHARACTER_NAME}</h1>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-gray-400 text-sm">Valeur totale estimée</div>
            <div className="text-2xl font-bold">
              <PriceDisplay copper={totalValue} />
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Items valorisés</div>
            <div className="text-2xl font-bold">{valuedItems.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Dernière mise à jour</div>
            <div className="text-sm font-mono">
              {formatDateTime(inventory[0]?.last_seen)}
            </div>
          </div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-3">
        <span className="text-gray-400">Trier par:</span>
        <button
          onClick={() => setSortBy('value')}
          className={`px-3 py-1 rounded ${sortBy === 'value' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Valeur
        </button>
        <button
          onClick={() => setSortBy('name')}
          className={`px-3 py-1 rounded ${sortBy === 'name' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Nom
        </button>
        <button
          onClick={() => setSortBy('quantity')}
          className={`px-3 py-1 rounded ${sortBy === 'quantity' ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          Quantité
        </button>
      </div>

      {/* Valued Items Table */}
      {sortedValuedItems.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Items valorisés</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="pb-2 pl-2">Item</th>
                  <th className="pb-2 text-center">Qté</th>
                  <th className="pb-2 text-right">Prix unitaire</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedValuedItems.map((item) => (
                  <tr
                    key={item.item_id}
                    className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors group"
                  >
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-3">
                        <ItemIcon
                          itemId={item.item_id}
                          name={item.name}
                          quality={item.quality}
                          iconUrl={item.icon_url}
                          size="sm"
                        />
                        <div>
                          <div className="font-medium">
                            <a
                              href={`https://fr.wowhead.com/classic/item=${item.item_id}`}
                              data-wowhead={`item=${item.item_id}&domain=fr.classic`}
                              className="text-white hover:text-blue-300"
                            >
                              {item.name || `Item #${item.item_id}`}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-center text-gray-300">
                      x{item.quantity}
                    </td>
                    <td className="py-2 text-right">
                      {item.market_value ? (
                        <PriceDisplay copper={item.market_value} />
                      ) : (
                        <span className="text-gray-500 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold">
                      {item.market_value ? (
                        <PriceDisplay copper={item.market_value * item.quantity} />
                      ) : (
                        <span className="text-gray-500 text-sm">N/A</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => navigate(`/item/${item.item_id}`)}
                          className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                          title="Voir les détails"
                        >
                          Détails
                        </button>
                        <button
                          onClick={() => toggleIgnore(item.item_id)}
                          className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                          title="Ignorer cet item"
                        >
                          Ignorer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ignored Items */}
      {sortedIgnoredItems.length > 0 && (
        <div className="card bg-gray-900/50">
          <h2 className="text-xl font-semibold mb-3 text-gray-400">
            Items ignorés ({sortedIgnoredItems.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full opacity-60">
              <thead>
                <tr className="border-b border-gray-800 text-left text-sm text-gray-500">
                  <th className="pb-2 pl-2">Item</th>
                  <th className="pb-2 text-center">Qté</th>
                  <th className="pb-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedIgnoredItems.map((item) => (
                  <tr
                    key={item.item_id}
                    className="border-b border-gray-900 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-3">
                        <ItemIcon
                          itemId={item.item_id}
                          name={item.name}
                          quality={item.quality}
                          iconUrl={item.icon_url}
                          size="sm"
                        />
                        <div>
                          <div className="font-medium text-gray-400">
                            <a
                              href={`https://fr.wowhead.com/classic/item=${item.item_id}`}
                              data-wowhead={`item=${item.item_id}&domain=fr.classic`}
                              className="text-gray-400 hover:text-blue-300"
                            >
                              {item.name || `Item #${item.item_id}`}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 text-center text-gray-500">
                      x{item.quantity}
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => toggleIgnore(item.item_id)}
                        className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                        title="Ne plus ignorer"
                      >
                        Restaurer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inventory.length === 0 && (
        <div className="card text-center text-gray-400 py-12">
          Aucun item dans l'inventaire
        </div>
      )}
    </div>
  );
}
