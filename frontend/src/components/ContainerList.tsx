import { useState, useEffect, useCallback } from "react";
import { fetchContainers } from "../api";
import type { ContainerInfo } from "../types";

const POLL_INTERVAL = 10_000;

function formatName(names: string[]): string {
  const name = names[0] || "";
  return name.startsWith("/") ? name.slice(1) : name;
}

function shortenImage(image: string): string {
  // Strip "localhost/" prefix common in podman
  const stripped = image.replace(/^localhost\//, "");
  // If it's a long hash-like image, truncate
  if (stripped.length > 50) return stripped.slice(0, 47) + "...";
  return stripped;
}

function formatAge(created: number): string {
  const seconds = Math.floor(Date.now() / 1000 - created);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ContainerList() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchContainers();
      setContainers(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="containers-panel">
      <div className="header">
        <h1>Containers</h1>
        <span className="container-count">{containers.length} running</span>
      </div>

      {loading && <div className="metric-card metric-placeholder">Loading containers...</div>}

      {error && <div className="container-error">Failed to load: {error}</div>}

      {!loading && !error && containers.length === 0 && (
        <div className="metric-card metric-placeholder">No running containers</div>
      )}

      {containers.length > 0 && (
        <div className="container-list">
          {containers.map((c) => (
            <div key={c.Id} className="container-row">
              <div className="container-main">
                <span className={`container-state container-state-${c.State}`} />
                <span className="container-name">{formatName(c.Names)}</span>
              </div>
              <div className="container-details">
                <span className="container-image" title={c.Image}>{shortenImage(c.Image)}</span>
                <span className="container-status">{c.Status || formatAge(c.Created)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
