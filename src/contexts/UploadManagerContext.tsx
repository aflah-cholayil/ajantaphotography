import { createContext, useContext, useCallback, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { uploadManager, type UploadManagerSnapshot } from '@/lib/uploadManager';

const UploadManagerContext = createContext<typeof uploadManager | null>(null);

export const UploadManagerProvider = ({ children }: { children: ReactNode }) => {
  return (
    <UploadManagerContext.Provider value={uploadManager}>
      {children}
    </UploadManagerContext.Provider>
  );
};

// Stable snapshot cache to avoid infinite re-renders with useSyncExternalStore
let cachedSnapshot: UploadManagerSnapshot = uploadManager.getSnapshot();
let snapshotVersion = 0;

uploadManager.subscribe(() => {
  snapshotVersion++;
  cachedSnapshot = uploadManager.getSnapshot();
});

function getSnapshot(): UploadManagerSnapshot {
  return cachedSnapshot;
}

export function useUploadManager() {
  const manager = useContext(UploadManagerContext);
  if (!manager) throw new Error('useUploadManager must be used within UploadManagerProvider');

  const subscribe = useCallback((cb: () => void) => manager.subscribe(cb), [manager]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  return { manager, snapshot };
}
