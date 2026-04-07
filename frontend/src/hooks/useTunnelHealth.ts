import { useState, useEffect, useRef, useCallback } from "react";
import type { TunnelHealth } from "../types";

type WsStatus = "disconnected" | "connecting" | "connected";

export default function useTunnelHealth(enabled: boolean) {
  const [health, setHealth] = useState<TunnelHealth | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: TunnelHealth = JSON.parse(event.data);
      setHealth(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/tunnel`);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => setWsStatus("connected");
      ws.onmessage = handleMessage;

      ws.onclose = () => {
        setWsStatus("disconnected");
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus("disconnected");
    };
  }, [enabled, handleMessage]);

  return { health, wsStatus };
}
