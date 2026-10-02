import { useEffect, useState } from 'react';
import { useRealtime } from '../../features/realtime/RealtimeProvider';
import { useNow } from '../../ui/useNow';
import { connectionKind, shouldShowOfflineBanner, type ConnectionKind } from './connectionState';
import { useOnlineStatus } from './useOnlineStatus';

export function useConnection(): { kind: ConnectionKind; showBanner: boolean } {
  const online = useOnlineStatus();
  const { status } = useRealtime();
  const kind = connectionKind(online, status);
  const [notLiveSince, setNotLiveSince] = useState<number | null>(null);
  const now = useNow(1_000);

  useEffect(() => {
    setNotLiveSince((previous) => (kind === 'live' ? null : (previous ?? Date.now())));
  }, [kind]);

  return { kind, showBanner: shouldShowOfflineBanner({ online, kind, notLiveSince, now: now.getTime() }) };
}
