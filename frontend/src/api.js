export async function fetchStatus() {
  const res = await fetch("/api/status");
  if (res.status === 401) return { authenticated: false };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { authenticated: true, data: await res.json() };
}

export async function login(password) {
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Wrong password");
  return true;
}

export async function logout() {
  await fetch("/logout", { method: "POST" });
}

export async function toggleService(endpoint, enable) {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enable }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
