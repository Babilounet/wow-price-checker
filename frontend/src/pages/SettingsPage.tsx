import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';

// Common Classic realms
const COMMON_REALMS = [
  { id: 4408, name: 'Crusader Strike' },
  { id: 4715, name: 'Lone Wolf' },
  { id: 4742, name: 'Wild Growth' },
  { id: 5143, name: 'Living Flame' },
  { id: 3681, name: 'Test Realm' }, // Example realm for testing
];

const REGIONS = [
  { code: 'us', name: 'Americas' },
  { code: 'eu', name: 'Europe' },
  { code: 'kr', name: 'Korea' },
  { code: 'tw', name: 'Taiwan' },
];

export default function SettingsPage() {
  const { realmId, region, setRealmId, setRegion } = useSettings();
  const [selectedRealm, setSelectedRealm] = useState(realmId);
  const [selectedRegion, setSelectedRegion] = useState(region);
  const [customRealmId, setCustomRealmId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setSelectedRealm(realmId);
    setSelectedRegion(region);
  }, [realmId, region]);

  const handleSave = () => {
    const finalRealmId = customRealmId ? parseInt(customRealmId, 10) : selectedRealm;

    if (isNaN(finalRealmId)) {
      alert('Invalid Realm ID');
      return;
    }

    setRealmId(finalRealmId);
    setRegion(selectedRegion);
    setSaveSuccess(true);

    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Configure your preferences</p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="card bg-green-900/20 border-green-600/50">
          <p className="text-green-400">✓ Settings saved successfully!</p>
        </div>
      )}

      {/* Current Settings */}
      <div className="card bg-blue-900/20 border-blue-600/30">
        <h3 className="font-semibold mb-2">Current Settings</h3>
        <div className="text-sm text-gray-300 space-y-1">
          <p><strong>Realm ID:</strong> {realmId}</p>
          <p><strong>Region:</strong> {region.toUpperCase()}</p>
        </div>
      </div>

      {/* Region Selection */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Region Selection</h2>
        <div>
          <label className="block text-sm font-medium mb-2">Choose Your Region</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="input w-full"
          >
            {REGIONS.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Realm Selection */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Realm Selection</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Choose Your Realm</label>
            <select
              value={selectedRealm}
              onChange={(e) => {
                setSelectedRealm(parseInt(e.target.value));
                setCustomRealmId('');
              }}
              className="input w-full"
            >
              {COMMON_REALMS.map((realm) => (
                <option key={realm.id} value={realm.id}>
                  {realm.name} (ID: {realm.id})
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <label className="block text-sm font-medium mb-2">Or Enter Custom Realm ID</label>
            <input
              type="text"
              value={customRealmId}
              onChange={(e) => setCustomRealmId(e.target.value)}
              placeholder="e.g., 3681"
              className="input w-full"
            />
            <p className="text-xs text-gray-500 mt-2">
              Find your realm ID on{' '}
              <a
                href="https://www.wowprogress.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                WoWProgress
              </a>
            </p>
          </div>

          <button onClick={handleSave} className="btn-primary w-full">
            Save Settings
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card bg-gray-800/50">
        <h3 className="font-semibold mb-3">About WoW Price Checker</h3>
        <div className="space-y-2 text-sm text-gray-300">
          <p>
            <strong>Version:</strong> 1.0.0
          </p>
          <p>
            <strong>API:</strong> Blizzard Battle.net Game Data API
          </p>
          <p>
            <strong>Update Frequency:</strong> Hourly snapshots
          </p>
          <p>
            <strong>Algorithm:</strong> IQR-based outlier detection
          </p>
        </div>
      </div>

      {/* Help */}
      <div className="card border-blue-600/30">
        <h3 className="font-semibold mb-3">Need Help?</h3>
        <div className="space-y-3 text-sm">
          <a
            href="https://github.com/Babilounet/wow-price-checker"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-blue-400 hover:underline"
          >
            📖 View Documentation on GitHub
          </a>
          <a
            href="https://github.com/Babilounet/wow-price-checker/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-blue-400 hover:underline"
          >
            🐛 Report an Issue
          </a>
          <a
            href="/api/v1/health"
            target="_blank"
            className="block text-blue-400 hover:underline"
          >
            🔧 Check API Status
          </a>
        </div>
      </div>
    </div>
  );
}
