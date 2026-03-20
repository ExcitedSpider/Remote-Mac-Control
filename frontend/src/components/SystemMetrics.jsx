import MetricsChart from "./MetricsChart.jsx";

export default function SystemMetrics({ metrics, wsStatus, history }) {
  const connected = wsStatus === "connected";

  return (
    <div className="system-metrics">
      <div className="system-metrics-header">
        <span>System Metrics</span>
        <span className={`ws-indicator ${connected ? "ws-connected" : ""}`} title={wsStatus} />
      </div>

      {!metrics || metrics.cpu.usagePercent === null ? (
        <div className="metric-card metric-placeholder">Collecting metrics...</div>
      ) : (
        <>
          <div className="metric-cards">
            <div className="metric-card">
              <div className="metric-label">CPU</div>
              <div className="metric-value">{metrics.cpu.usagePercent}%</div>
              <div className="metric-bar">
                <div className="metric-bar-fill" style={{ width: `${metrics.cpu.usagePercent}%` }} />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Memory</div>
              <div className="metric-value">{metrics.memory.usagePercent}%</div>
              <div className="metric-bar">
                <div className="metric-bar-fill" style={{ width: `${metrics.memory.usagePercent}%` }} />
              </div>
            </div>
          </div>
          {history.length > 0 && <MetricsChart history={history} />}
        </>
      )}
    </div>
  );
}
