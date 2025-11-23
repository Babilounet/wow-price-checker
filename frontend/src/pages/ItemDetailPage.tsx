import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { formatPrice, formatNumber } from '../utils/formatPrice';
import { formatDate, formatDateTime } from '../utils/formatDate';
import ItemIcon from '../components/ItemIcon';
import PriceClusterCard from '../components/PriceClusterCard';
import PriceHistoryChart from '../components/PriceHistoryChart';

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itemId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [itemData, historyData] = await Promise.all([
          apiClient.getItemWithPricing(parseInt(itemId)),
          apiClient.getItemHistory(parseInt(itemId), 30)
        ]);
        setData(itemData);
        setHistory(historyData.history || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch item data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [itemId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="mt-4 text-gray-400">Chargement des données...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card bg-red-900/20 border-red-600/50">
          <h2 className="text-xl font-bold text-red-400 mb-2">Erreur de chargement</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <Link to="/search" className="btn-secondary">
            ← Retour à la recherche
          </Link>
        </div>
      </div>
    );
  }

  if (!data || !data.item) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-xl font-bold mb-2">Aucune donnée disponible</h2>
          <p className="text-gray-400 mb-4">
            Cet item n'est pas actuellement disponible ou n'a pas encore été scanné.
          </p>
          <Link to="/search" className="btn-secondary">
            ← Retour à la recherche
          </Link>
        </div>
      </div>
    );
  }

  const { item, pricing, recentAuctions } = data;
  const normalCluster = pricing?.clusters?.find((c: any) => c.type === 'normal');
  const dealCluster = pricing?.clusters?.find((c: any) => c.type === 'deal');
  const aberrants = pricing?.aberrants || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/search" className="text-blue-400 hover:underline text-sm mb-2 block">
            ← Retour à la recherche
          </Link>
          <div className="flex items-center gap-4">
            <ItemIcon
              itemId={item.item_id}
              name={item.name}
              quality={item.quality}
              iconUrl={item.icon_url}
              size="lg"
            />
            <div>
              <h1 className="text-3xl font-bold">
                <a
                  href={`https://fr.wowhead.com/classic/item=${itemId}`}
                  data-wowhead={`item=${itemId}&domain=fr`}
                  className="text-white hover:text-blue-300"
                >
                  {item.name || `Item #${itemId}`}
                </a>
              </h1>
              <p className="text-gray-400">ID: {itemId}</p>
              <p className="text-xs text-gray-500 mt-2">
                Passez la souris sur le nom pour voir les détails complets (stats, effets, etc.)
              </p>
            </div>
          </div>
        </div>
        {pricing?.lastScan && (
          <div className="text-right">
            <p className="text-sm text-gray-500">Dernière mise à jour</p>
            <p className="text-gray-300">{formatDateTime(pricing.lastScan)}</p>
          </div>
        )}
      </div>

      {/* Price Clusters */}
      {(normalCluster || dealCluster) && (
        <div className="grid md:grid-cols-2 gap-4">
          {normalCluster && (
            <PriceClusterCard
              type="normal"
              price={normalCluster.centerPrice}
              auctionCount={normalCluster.auctionCount}
              label="Prix du marché"
              percentage={(normalCluster.auctionCount / pricing.sampleSize) * 100}
            />
          )}
          {dealCluster && (
            <PriceClusterCard
              type="deal"
              price={dealCluster.centerPrice}
              auctionCount={dealCluster.auctionCount}
              label="Prix réduit"
              percentage={(dealCluster.auctionCount / pricing.sampleSize) * 100}
            />
          )}
        </div>
      )}

      {/* Aberrant Prices Warning */}
      {aberrants.length > 0 && (
        <div className="card bg-red-900/20 border-red-600/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-bold text-red-400 mb-2">Prix suspects détectés</h3>
              <p className="text-gray-300 text-sm mb-2">
                {aberrants.length} enchère{aberrants.length > 1 ? 's' : ''} avec des prix aberrants
                {aberrants.length > 1 ? ' ont été' : ' a été'} détecté{aberrants.length > 1 ? 's' : ''}.
                Ces prix sont probablement des erreurs ou des tentatives de manipulation du marché.
              </p>
              <div className="flex gap-3 flex-wrap">
                {aberrants.slice(0, 5).map((price: number, i: number) => (
                  <span key={i} className="px-2 py-1 bg-red-900/30 rounded text-sm font-mono">
                    {formatPrice(price)}
                  </span>
                ))}
                {aberrants.length > 5 && (
                  <span className="px-2 py-1 text-gray-400 text-sm">
                    +{aberrants.length - 5} autres
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price History Chart */}
      {history.length > 0 && (
        <PriceHistoryChart history={history} itemName={item.name} />
      )}

      {/* Statistics Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard
          label="Médiane"
          value={formatPrice(pricing?.medianPrice || 0)}
          description="50e percentile"
        />
        <StatCard
          label="Moyenne"
          value={formatPrice(pricing?.meanPrice || 0)}
          description="Prix moyen"
        />
        <StatCard
          label="Minimum"
          value={formatPrice(pricing?.minPrice || 0)}
          description="Prix le plus bas"
          highlight="green"
        />
        <StatCard
          label="Maximum"
          value={formatPrice(pricing?.maxPrice || 0)}
          description="Prix le plus haut"
          highlight="red"
        />
      </div>

      {/* Recent Auctions */}
      {recentAuctions && recentAuctions.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Enchères récentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Prix unitaire</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Quantité</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Total</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAuctions.slice(0, 10).map((auction: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 px-3 font-mono">{formatPrice(auction.unit_price)}</td>
                    <td className="py-2 px-3">{auction.quantity}</td>
                    <td className="py-2 px-3 font-mono">{formatPrice(auction.unit_price * auction.quantity)}</td>
                    <td className="py-2 px-3 text-gray-400 text-sm">
                      {formatDate(auction.auction_timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recentAuctions.length > 10 && (
            <p className="text-sm text-gray-500 mt-3">
              Affichage de 10 enchères sur {recentAuctions.length}
            </p>
          )}
        </div>
      )}

      {/* Cluster Details */}
      {pricing?.clusters && pricing.clusters.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Détails des clusters de prix</h3>
          <div className="space-y-3">
            {pricing.clusters.map((cluster: any, i: number) => (
              <div key={i} className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      cluster.type === 'normal' ? 'bg-green-600' :
                      cluster.type === 'deal' ? 'bg-blue-600' :
                      'bg-red-600'
                    }`}>
                      {cluster.type === 'normal' ? 'Normal' : cluster.type === 'deal' ? 'Deal' : 'Suspect'}
                    </span>
                    <span className="font-bold">{formatPrice(cluster.centerPrice)}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Confiance</div>
                    <div className="font-semibold">{(cluster.confidence * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Enchères:</span>
                    <span className="ml-2 font-semibold">{cluster.auctionCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Min:</span>
                    <span className="ml-2 font-mono">{formatPrice(cluster.minPrice)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max:</span>
                    <span className="ml-2 font-mono">{formatPrice(cluster.maxPrice)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="card bg-blue-900/10 border-blue-600/30">
        <h3 className="font-semibold mb-2">À propos de l'analyse des prix</h3>
        <p className="text-sm text-gray-300">
          Cette analyse utilise un <strong>algorithme de clustering DBSCAN</strong> pour détecter
          automatiquement les groupes de prix. Les prix normaux représentent le marché habituel,
          les deals sont des opportunités d'achat, et les prix aberrants sont probablement des erreurs
          ou des tentatives de manipulation.
        </p>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  highlight?: 'green' | 'red';
}

function StatCard({ label, value, description, highlight }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p
        className={`text-2xl font-bold mb-1 ${
          highlight === 'green'
            ? 'text-green-400'
            : highlight === 'red'
              ? 'text-red-400'
              : 'text-white'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
