import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./api";

export interface LiveMsg { kind: string; data: any; }

// WebSocket hook with auto-reconnect; keeps the last N live messages.
export function useLive(limit = 60) {
  const [feed, setFeed] = useState<LiveMsg[]>([]);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0); // bumps on any message, for consumers to refetch
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as LiveMsg;
          setFeed((f) => [msg, ...f].slice(0, limit));
          setTick((t) => t + 1);
        } catch {
          /* ignore */
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [limit]);

  return { feed, connected, tick };
}
