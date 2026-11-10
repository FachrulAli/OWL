import { useEffect, useRef, useState } from "react";
import { WS_URL } from "./api";
import { MODE, engine } from "./demo";

export interface LiveMsg { kind: string; data: any; }

// WebSocket hook with auto-reconnect; keeps the last N live messages.
// In demo mode (no backend reachable) it reads the in-browser engine feed.
export function useLive(limit = 60) {
  const [feed, setFeed] = useState<LiveMsg[]>([]);
  const [connected, setConnected] = useState(false);
  const [tick, setTick] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      if (MODE.demo) return; // backend already known unreachable
      let ws: WebSocket;
      try { ws = new WebSocket(WS_URL); } catch { return; }
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); if (!closed && !MODE.demo) retry = setTimeout(connect, 2000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as LiveMsg;
          setFeed((f) => [msg, ...f].slice(0, limit));
          setTick((t) => t + 1);
        } catch { /* ignore */ }
      };
    };
    connect();

    // demo poll: once MODE.demo flips on (set by the api layer), mirror the
    // engine feed and report a live connection.
    const poll = setInterval(() => {
      if (MODE.demo) {
        setConnected(true);
        setFeed(engine.feed.slice(0, limit));
        setTick((t) => t + 1);
      }
    }, 1200);

    return () => { closed = true; clearTimeout(retry); clearInterval(poll); wsRef.current?.close(); };
  }, [limit]);

  return { feed, connected, tick };
}
