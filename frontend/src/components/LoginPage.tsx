import { useState, type FormEvent } from "react";

interface LoginPageProps {
  onLogin: (password: string) => Promise<void>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(password);
    } catch {
      setError("Wrong password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-box">
      <h1>Mac Remote Control</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          disabled={submitting}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
        {error && <div className="login-error">{error}</div>}
      </form>
    </div>
  );
}
