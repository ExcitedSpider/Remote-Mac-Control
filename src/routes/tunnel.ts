import { Router } from "express";
import { getTunnelHealth } from "../services/tunnelHealth.js";

const router = Router();

// GET /api/tunnel/health — cloudflared tunnel health status
router.get("/tunnel/health", async (_req, res) => {
  try {
    const health = await getTunnelHealth();
    res.json(health);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
