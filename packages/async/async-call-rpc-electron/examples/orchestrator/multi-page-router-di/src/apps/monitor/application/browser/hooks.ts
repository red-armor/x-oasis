import { useEffect, useRef, useState } from 'react';
import {
  client,
  pageletClient,
} from '@/apps/main/application/browser/rpc-clients';
import { MonitorSnapshot } from '@/apps/monitor/application/common';

export function useMonitorSnapshots() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stateUnsub: { unsubscribe: () => void } | null = null;

    const subscribe = async () => {
      if (cancelled || subscribedRef.current) return;
      subscribedRef.current = true;

      try {
        const snap = await pageletClient.callMonitorGetSnapshot();
        if (!cancelled && snap) {
          setSnapshot(snap);
          setUpdatedAt(Date.now());
        }
      } catch {}

      try {
        if (cancelled) return;
        const result = pageletClient.onMonitorPerformanceUpdate(
          (snap: MonitorSnapshot) => {
            if (!cancelled) {
              setSnapshot(snap);
              setUpdatedAt(Date.now());
            }
          }
        );
        const unsub =
          typeof result === 'function'
            ? result
            : result?.unsubscribe
            ? result.unsubscribe.bind(result)
            : () => {};
        if (!cancelled) {
          unsubRef.current = unsub;
        } else {
          unsub();
        }
      } catch {}
    };

    const checkAndSubscribe = async () => {
      try {
        const status = await client.getStatus();
        if (status?.isReady || status?.state === 'READY') {
          subscribe();
          return;
        }
      } catch {}

      try {
        stateUnsub = client.onStateChange((event: any) => {
          if (
            (event?.state === 'READY' || event?.isReady) &&
            !cancelled &&
            !subscribedRef.current
          ) {
            subscribe();
            if (stateUnsub) {
              stateUnsub.unsubscribe();
              stateUnsub = null;
            }
          }
        });
      } catch {}
    };

    checkAndSubscribe();

    return () => {
      cancelled = true;
      subscribedRef.current = false;
      stateUnsub?.unsubscribe();
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  return { snapshot, updatedAt };
}

export function useSnapshotHistory(
  snapshot: MonitorSnapshot | null,
  limit = 60
) {
  const ref = useRef<MonitorSnapshot[]>([]);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (!snapshot) return;
    const last = ref.current[ref.current.length - 1];
    if (last && last.timestamp === snapshot.timestamp) return;
    const next = ref.current.concat(snapshot);
    if (next.length > limit) next.splice(0, next.length - limit);
    ref.current = next;
    setVersion((v) => v + 1);
  }, [snapshot, limit]);

  return ref.current;
}

export function useNowTick(intervalMs = 1000) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
