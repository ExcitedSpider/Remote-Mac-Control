import { useState, useEffect, useRef, useCallback } from "react";

const MAX_HISTORY = 30;

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour12: false });
}

export default function useSystemMetrics(enabled) {
  const [metrics, setMetrics] = useState(null);
  const [history, setHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      setMetrics(data);
      setHistory((prev) => {
        const entry = {
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
      clearTimeout(reconnectTimer.current);
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
