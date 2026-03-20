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

    // Let unauthenticated browser requests through to serve the SPA
    if (req.headers.accept?.includes("text/html")) {
      return next();
    }

    return res.status(401).json({ error: "Authentication required" });
  };
}
