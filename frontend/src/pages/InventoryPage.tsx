import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import ItemIcon from '../components/ItemIcon';
import { formatPrice } from '../utils/formatPrice';
import { formatDateTime } from '../utils/formatDate';

export default function InventoryPage() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'quantity'>('value');

  const CHARACTER_NAME = 'Babss'; // TODO: Get from settings or env

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setIsLoading(true);
        const [inventoryData, valueData] = await Promise.all([
          apiClient.getInventory(CHARACTER_NAME),
          apiClient.getInventoryValue(CHARACTER_NAME)
        ]);

        setInventory(inventoryData.items);
        setTotalValue(valueData.totalValue);
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, []);

  const sortedInventory = [...inventory].sort((a, b) => {
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
            <div className="text-gray-400 text-sm">Valeur totale</div>
            <div className="text-3xl font-bold text-yellow-400">{formatPrice(totalValue)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm">Items</div>
            <div className="text-3xl font-bold">{inventory.length}</div>
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

      {/* Inventory Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedInventory.map((item) => (
          <button
            key={item.item_id}
            onClick={() => navigate(`/item/${item.item_id}`)}
            className="card hover:border-blue-600/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <ItemIcon
                itemId={item.item_id}
                name={item.name}
                quality={item.quality}
                iconUrl={item.icon_url}
                size="md"
              />
              <div className="flex-1">
                <div className="font-semibold">
                  <a
                    href={`https://fr.wowhead.com/classic/item=${item.item_id}`}
                    data-wowhead={`item=${item.item_id}&domain=fr`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-white hover:text-blue-300"
                  >
                    {item.name || `Item #${item.item_id}`}
                  </a>
                </div>
                <div className="text-sm text-gray-400">x{item.quantity}</div>
              </div>
            </div>

            {item.market_value && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Prix unitaire:</span>
                  <span className="font-mono">{formatPrice(item.market_value)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-400">Total:</span>
                  <span className="font-mono text-yellow-400">
                    {formatPrice(item.market_value * item.quantity)}
                  </span>
                </div>
              </div>
            )}

            {!item.market_value && (
              <div className="text-sm text-gray-500 italic">Prix non disponible</div>
            )}
          </button>
        ))}
      </div>

      {inventory.length === 0 && (
        <div className="card text-center text-gray-400 py-12">
          Aucun item dans l'inventaire
        </div>
      )}
    </div>
  );
}
