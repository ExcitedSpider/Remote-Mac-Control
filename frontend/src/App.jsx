import { useState, useEffect, useCallback } from "react";
import { fetchStatus, login, logout } from "./api.js";
import LoginPage from "./components/LoginPage.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [authState, setAuthState] = useState("loading");
  const [status, setStatus] = useState(null);

  const checkAuth = useCallback(async () => {
    setAuthState("loading");
    try {
      const result = await fetchStatus();
      if (result.authenticated) {
        setStatus(result.data);
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
      }
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (password) => {
    await login(password);
    await checkAuth();
  };

  const handleLogout = async () => {
    await logout();
    setAuthState("unauthenticated");
    setStatus(null);
  };

  if (authState === "loading") {
    return (
      <div className="container">
        <div className="status-bar">Loading...</div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      status={status}
      onStatusChange={setStatus}
      onLogout={handleLogout}
    />
  );
}
