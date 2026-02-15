import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { uploadManager, type UploadManagerSnapshot } from '@/lib/uploadManager';

const UploadManagerContext = createContext<typeof uploadManager | null>(null);

export const UploadManagerProvider = ({ children }: { children: ReactNode }) => {
  return (
    <UploadManagerContext.Provider value={uploadManager}>
      {children}
    </UploadManagerContext.Provider>
  );
};

export function useUploadManager() {
  const manager = useContext(UploadManagerContext);
  if (!manager) throw new Error('useUploadManager must be used within UploadManagerProvider');

  const snapshot = useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.getSnapshot()
  );

  return { manager, snapshot };
}
