import * as jose from "jose";

const CERTS_URL_SUFFIX = "/cdn-cgi/access/certs";
let cachedJWKS = null;
let cacheExpiry = 0;

/**
 * Fetches and caches Cloudflare Access public keys.
 */
async function getJWKS(teamDomain) {
  const now = Date.now();
  if (cachedJWKS && now < cacheExpiry) return cachedJWKS;

  const certsUrl = `https://${teamDomain}${CERTS_URL_SUFFIX}`;
  cachedJWKS = jose.createRemoteJWKSet(new URL(certsUrl));
  cacheExpiry = now + 5 * 60 * 1000; // cache for 5 minutes
  return cachedJWKS;
}

/**
 * Express middleware that validates Cloudflare Access JWT.
 *
 * Expects env vars:
 *   CF_TEAM_DOMAIN  – e.g. "myteam.cloudflareaccess.com"
 *   CF_AUD          – the Application ID from Access (used as JWT audience)
 *
 * Set CF_ACCESS_ENABLED=false to bypass (for local dev).
 */
export function cloudflareAccess() {
  return async (req, res, next) => {
    // Allow bypassing for local development
    if (process.env.CF_ACCESS_ENABLED === "false") {
      req.cfAccess = { bypassed: true };
      return next();
    }

    const teamDomain = process.env.CF_TEAM_DOMAIN;
    const audience = process.env.CF_AUD;

    if (!teamDomain || !audience) {
      console.error(
        "CF_TEAM_DOMAIN and CF_AUD must be set (or set CF_ACCESS_ENABLED=false to bypass)"
      );
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const token =
      req.headers["cf-access-jwt-assertion"] ||
      req.cookies?.CF_Authorization;

    if (!token) {
      return res
        .status(403)
        .json({ error: "Missing Cloudflare Access token" });
    }

    try {
      const JWKS = await getJWKS(teamDomain);
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: `https://${teamDomain}`,
        audience,
      });

      req.cfAccess = {
        email: payload.email,
        identity: payload,
      };
      next();
    } catch (err) {
      console.error("CF Access JWT validation failed:", err.message);
      return res.status(403).json({ error: "Invalid access token" });
    }
  };
}
