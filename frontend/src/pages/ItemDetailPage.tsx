import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { formatNumber } from '../utils/formatPrice';
import { formatDate, formatDateTime } from '../utils/formatDate';
import ItemIcon from '../components/ItemIcon';
import PriceDisplay from '../components/PriceDisplay';
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

  // Refresh Wowhead tooltips when data changes
  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => {
        if (window.$WowheadPower) {
          window.$WowheadPower.refreshLinks();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, loading]);

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
                  data-wowhead={`item=${itemId}&domain=fr.classic`}
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

      {/* Price Clusters Cards */}
      {(normalCluster || dealCluster) && (
        <div className="grid md:grid-cols-2 gap-4">
          {normalCluster && (
            <div className="card bg-gradient-to-br from-green-900/30 to-green-800/20 border-green-600/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-green-400">Prix du marché</h3>
                <span className="px-2 py-1 bg-green-600 rounded text-xs font-semibold">NORMAL</span>
              </div>
              <div className="text-3xl font-bold mb-2">
                <PriceDisplay copper={normalCluster.centerPrice} />
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>{normalCluster.auctionCount} enchères</span>
                <span>{((normalCluster.auctionCount / pricing.sampleSize) * 100).toFixed(1)}% du marché</span>
              </div>
            </div>
          )}
          {dealCluster && (
            <div className="card bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-600/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-blue-400">Prix réduit</h3>
                <span className="px-2 py-1 bg-blue-600 rounded text-xs font-semibold">DEAL</span>
              </div>
              <div className="text-3xl font-bold mb-2">
                <PriceDisplay copper={dealCluster.centerPrice} />
              </div>
              <div className="flex justify-between text-sm text-gray-300">
                <span>{dealCluster.auctionCount} enchères</span>
                <span>{((dealCluster.auctionCount / pricing.sampleSize) * 100).toFixed(1)}% du marché</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aberrant Prices Warning */}
      {aberrants.length > 0 && (
        <div className="card bg-red-900/20 border-red-600/50">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-bold text-red-400 mb-2">Prix suspects détectés</h3>
              <p className="text-gray-300 text-sm mb-3">
                {aberrants.length} enchère{aberrants.length > 1 ? 's' : ''} avec des prix aberrants
                {aberrants.length > 1 ? ' ont été' : ' a été'} détecté{aberrants.length > 1 ? 's' : ''}.
                Ces prix sont probablement des erreurs ou des tentatives de manipulation du marché.
              </p>
              <div className="flex gap-3 flex-wrap">
                {aberrants.slice(0, 5).map((price: number, i: number) => (
                  <span key={i} className="px-2 py-1 bg-red-900/30 rounded">
                    <PriceDisplay copper={price} className="text-sm" />
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
          copper={pricing?.medianPrice || 0}
          description="50e percentile"
        />
        <StatCard
          label="Moyenne"
          copper={pricing?.meanPrice || 0}
          description="Prix moyen"
        />
        <StatCard
          label="Minimum"
          copper={pricing?.minPrice || 0}
          description="Prix le plus bas"
          highlight="green"
        />
        <StatCard
          label="Maximum"
          copper={pricing?.maxPrice || 0}
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
                <tr className="border-b border-gray-700 text-left text-sm text-gray-400">
                  <th className="py-2 px-3">Prix unitaire</th>
                  <th className="py-2 px-3">Quantité</th>
                  <th className="py-2 px-3">Total</th>
                  <th className="py-2 px-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAuctions.slice(0, 10).map((auction: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-2 px-3">
                      <PriceDisplay copper={auction.unit_price} />
                    </td>
                    <td className="py-2 px-3 text-gray-300">x{auction.quantity}</td>
                    <td className="py-2 px-3">
                      <PriceDisplay copper={auction.unit_price * auction.quantity} />
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-sm">
                      {auction.created_at ? formatDateTime(auction.created_at) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recentAuctions.length > 10 && (
            <p className="text-sm text-gray-500 mt-3">
              Affichage de 10 enchères sur {formatNumber(recentAuctions.length)}
            </p>
          )}
        </div>
      )}

      {/* Cluster Details */}
      {pricing?.clusters && pricing.clusters.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Analyse détaillée des clusters</h3>
          <div className="space-y-3">
            {pricing.clusters.map((cluster: any, i: number) => (
              <div key={i} className={`p-4 rounded-lg border ${
                cluster.type === 'normal' ? 'bg-green-900/20 border-green-600/30' :
                cluster.type === 'deal' ? 'bg-blue-900/20 border-blue-600/30' :
                'bg-red-900/20 border-red-600/30'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        cluster.type === 'normal' ? 'bg-green-600' :
                        cluster.type === 'deal' ? 'bg-blue-600' :
                        'bg-red-600'
                      }`}>
                        {cluster.type === 'normal' ? 'NORMAL' : cluster.type === 'deal' ? 'DEAL' : 'SUSPECT'}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {cluster.auctionCount} enchère{cluster.auctionCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-2xl font-bold">
                      <PriceDisplay copper={cluster.centerPrice} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">Confiance</div>
                    <div className="text-lg font-semibold">{(cluster.confidence * 100).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Prix min:</span>
                    <div className="font-semibold">
                      <PriceDisplay copper={cluster.minPrice} />
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Prix max:</span>
                    <div className="font-semibold">
                      <PriceDisplay copper={cluster.maxPrice} />
                    </div>
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
  copper: number;
  description: string;
  highlight?: 'green' | 'red';
}

function StatCard({ label, copper, description, highlight }: StatCardProps) {
  return (
    <div className="card">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <div className={`text-xl font-bold mb-1 ${
        highlight === 'green' ? 'text-green-400' :
        highlight === 'red' ? 'text-red-400' :
        ''
      }`}>
        <PriceDisplay copper={copper} />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
