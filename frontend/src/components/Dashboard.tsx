import { useState } from "react";
import { toggleService, fetchStatus } from "../api";
import type { AllStatus } from "../types";
import useSystemMetrics from "../hooks/useSystemMetrics";
import SystemMetrics from "./SystemMetrics";
import ServiceToggle from "./ServiceToggle";
import StatusBar from "./StatusBar";

interface DashboardProps {
  status: AllStatus;
  onStatusChange: (status: AllStatus) => void;
  onLogout: () => void;
}

export default function Dashboard({ status, onStatusChange, onLogout }: DashboardProps) {
  const { metrics, history, wsStatus } = useSystemMetrics(true);
  const [statusMsg, setStatusMsg] = useState({ message: "Connected", type: "success" });
  const [busy, setBusy] = useState(false);

  const handleToggle = async (endpoint: string, label: string, enable: boolean) => {
    setBusy(true);
    setStatusMsg({ message: "Updating...", type: "" });
    try {
      const data = await toggleService(endpoint, enable);
      onStatusChange(data.status);
      setStatusMsg({
        message: `${label} ${enable ? "enabled" : "disabled"}`,
        type: data.result.success ? "success" : "error",
      });
    } catch (err: unknown) {
      setStatusMsg({ message: `Error: ${(err as Error).message}`, type: "error" });
      try {
        const result = await fetchStatus();
        if (result.authenticated) onStatusChange(result.data!);
      } catch {}
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <button className="btn-logout" onClick={onLogout}>Logout</button>
      <div className="dashboard-layout">
      <div className="container">
        <div className="header">
          <h1>Mac Remote Control</h1>
        </div>

        <ServiceToggle
          label="SSH (Remote Login)"
          description="Opens port 22 for SSH access"
          checked={status.ssh.enabled}
          disabled={busy}
          onChange={(enable) => handleToggle("ssh", "SSH", enable)}
        />

        <ServiceToggle
          label="File Sharing (SMB)"
          description="Enables network filesystem access"
          checked={status.fileSharing.enabled}
          disabled={busy}
          onChange={(enable) => handleToggle("file-sharing", "File Sharing", enable)}
        />

        <StatusBar message={statusMsg.message} type={statusMsg.type} />
      </div>

      <SystemMetrics metrics={metrics} wsStatus={wsStatus} history={history} />
    </div>
    </div>
  );
}
