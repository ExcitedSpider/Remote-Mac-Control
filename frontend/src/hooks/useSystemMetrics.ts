import { useState, useEffect, useRef, useCallback } from "react";
import type { SystemMetricsData, MetricsHistoryEntry } from "../types";

const MAX_HISTORY = 30;

type WsStatus = "disconnected" | "connecting" | "connected";

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export default function useSystemMetrics(enabled: boolean) {
  const [metrics, setMetrics] = useState<SystemMetricsData | null>(null);
  const [history, setHistory] = useState<MetricsHistoryEntry[]>([]);
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data: SystemMetricsData = JSON.parse(event.data);
      setMetrics(data);
      setHistory((prev) => {
        const entry: MetricsHistoryEntry = {
          time: formatTime(new Date()),
          cpu: data.cpu.usagePercent,
          memory: data.memory.usagePercent,
        };
        const next = [...prev, entry];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/metrics`);
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

  return { metrics, history, wsStatus };
}
