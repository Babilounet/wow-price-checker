import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Settings {
  realmId: number;
  region: string;
}

interface SettingsContextType extends Settings {
  setRealmId: (id: number) => void;
  setRegion: (region: string) => void;
}

const DEFAULT_SETTINGS: Settings = {
  realmId: 3681, // Default to Test Realm
  region: 'eu',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [realmId, setRealmIdState] = useState<number>(() => {
    const saved = localStorage.getItem('wpc_realm_id');
    return saved ? parseInt(saved, 10) : DEFAULT_SETTINGS.realmId;
  });

  const [region, setRegionState] = useState<string>(() => {
    const saved = localStorage.getItem('wpc_region');
    return saved || DEFAULT_SETTINGS.region;
  });

  useEffect(() => {
    localStorage.setItem('wpc_realm_id', realmId.toString());
  }, [realmId]);

  useEffect(() => {
    localStorage.setItem('wpc_region', region);
  }, [region]);

  const setRealmId = (id: number) => {
    setRealmIdState(id);
  };

  const setRegion = (r: string) => {
    setRegionState(r);
  };

  return (
    <SettingsContext.Provider value={{ realmId, region, setRealmId, setRegion }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
