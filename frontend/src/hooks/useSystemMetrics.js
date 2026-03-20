import { useState, useEffect, useRef } from "react";

export default function useSystemMetrics(enabled) {
  const [metrics, setMetrics] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/metrics`);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => setWsStatus("connected");

      ws.onmessage = (event) => {
        try {
          setMetrics(JSON.parse(event.data));
        } catch {}
      };

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
  }, [enabled]);

  return { metrics, wsStatus };
}
