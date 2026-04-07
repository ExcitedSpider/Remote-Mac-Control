import { useState, useEffect } from "react";
import { fetchTunnelHealth } from "../api";
import type { TunnelHealth } from "../types";

export default function useTunnelHealth(enabled: boolean) {
  const [health, setHealth] = useState<TunnelHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchTunnelHealth();
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const timer = setInterval(poll, 10_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return { health, loading, error };
}
