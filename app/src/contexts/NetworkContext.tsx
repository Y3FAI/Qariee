import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Network from 'expo-network';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOffline: boolean;
  networkType: Network.NetworkStateType | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [networkType, setNetworkType] = useState<Network.NetworkStateType | null>(null);

  useEffect(() => {
    // Get initial network state
    const getInitialNetworkState = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        setIsConnected(state.isConnected ?? false);
        setIsInternetReachable(state.isInternetReachable ?? null);
        setNetworkType(state.type ?? null);
      } catch (error) {
        console.error('Error getting network state:', error);
      }
    };

    getInitialNetworkState();

    // Subscribe to network state changes
    const subscription = Network.addNetworkStateListener((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? null);
      setNetworkType(state.type ?? null);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Device is offline if not connected OR internet is not explicitly reachable
  // (treat null/unknown as offline to handle Android limitations)
  const isOffline = !isConnected || isInternetReachable !== true;

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        isOffline,
        networkType,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
