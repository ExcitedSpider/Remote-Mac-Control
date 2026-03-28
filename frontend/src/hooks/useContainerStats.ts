import { useState, useEffect, useRef, useCallback } from "react";
import type { ContainerWithStats } from "../types";

type WsStatus = "disconnected" | "connecting" | "connected";

export default function useContainerStats(enabled: boolean) {
  const [containers, setContainers] = useState<ContainerWithStats[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ContainerWithStats[] = JSON.parse(event.data);
      setContainers(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/containers`);
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

  return { containers, wsStatus };
}
