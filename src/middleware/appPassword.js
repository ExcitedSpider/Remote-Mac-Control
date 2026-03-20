import crypto from "node:crypto";
import { log } from "../logger.js";

const COOKIE_NAME = "my-remote-auth";
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory set of valid session tokens
const validTokens = new Map();

function generateToken() {
  const token = crypto.randomBytes(32).toString("hex");
  validTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function isValidToken(token) {
  const expiry = validTokens.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    validTokens.delete(token);
    return false;
  }
  return true;
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.split("=");
    cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

export function appPassword() {
  const password = process.env.APP_PASSWORD;

  return (req, res, next) => {
    if (!password) return next();

    // Logout endpoint
    if (req.method === "POST" && req.path === "/logout") {
      const cookies = parseCookies(req.headers.cookie);
      validTokens.delete(cookies[COOKIE_NAME]);
      log.info(`LOGOUT from ${req.ip}`);
      res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`
      );
      if (req.headers.accept?.includes("text/html")) {
        res.setHeader("Location", "/");
        return res.status(302).end();
      }
      return res.json({ ok: true });
    }

    // Login endpoint
    if (req.method === "POST" && req.path === "/login") {
      const { password: submitted } = req.body || {};
      const submittedBuf = Buffer.from(submitted || "");
      const passwordBuf = Buffer.from(password);
      if (
        submittedBuf.length === passwordBuf.length &&
        crypto.timingSafeEqual(submittedBuf, passwordBuf)
      ) {
        const token = generateToken();
        res.setHeader(
          "Set-Cookie",
          `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TOKEN_TTL / 1000}`
        );
        log.info(`LOGIN SUCCESS from ${req.ip}`);
        return res.json({ ok: true });
      }
      log.warn(`LOGIN FAILED from ${req.ip}`);
      return res.status(401).json({ error: "Wrong password" });
    }

    // Check session cookie
    const cookies = parseCookies(req.headers.cookie);
    if (isValidToken(cookies[COOKIE_NAME])) {
      return next();
    }

    // Serve login page for browser requests
    if (req.headers.accept?.includes("text/html")) {
      return res.send(loginPage());
    }

    return res.status(401).json({ error: "Authentication required" });
  };
}

function loginPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — Mac Remote Control</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .login-box {
      background: #16213e;
      border-radius: 16px;
      padding: 40px;
      width: 340px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 { text-align: center; margin-bottom: 24px; font-size: 1.2em; }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #333;
      border-radius: 8px;
      background: #1a1a2e;
      color: #eee;
      font-size: 1em;
      margin-bottom: 16px;
      outline: none;
    }
    input:focus { border-color: #0f9d58; }
    button {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      background: #0f9d58;
      color: #fff;
      font-size: 1em;
      cursor: pointer;
    }
    button:hover { background: #0b7a42; }
    .error { color: #f44; text-align: center; margin-top: 12px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>Mac Remote Control</h1>
    <form id="login-form">
      <input type="password" id="password" placeholder="Password" autofocus>
      <button type="submit">Login</button>
      <div class="error" id="error"></div>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('password').value;
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        document.getElementById('error').textContent = 'Wrong password';
      }
    });
  </script>
</body>
</html>`;
}
