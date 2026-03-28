import { Router } from "express";
import {
  getAllStatus,
  setSSH,
  setFileSharing,
} from "../services/macControl.js";
import { log } from "../logger.js";

const router = Router();

// GET /api/status — current state of all services
router.get("/status", async (req, res) => {
  try {
    const status = await getAllStatus();
    res.json(status);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/ssh { enable: true|false }
router.post("/ssh", async (req, res) => {
  const { enable } = req.body as { enable: unknown };
  if (typeof enable !== "boolean") {
    res.status(400).json({ error: '"enable" must be a boolean' });
    return;
  }
  log.warn(`SSH ${enable ? "ENABLE" : "DISABLE"} requested from ${req.clientIp}`);
  const result = await setSSH(enable);
  log.warn(`SSH ${enable ? "ENABLE" : "DISABLE"} result: ${result.success ? "success" : result.error}`);
  const status = await getAllStatus();
  res.json({ result, status });
});

// POST /api/file-sharing { enable: true|false }
router.post("/file-sharing", async (req, res) => {
  const { enable } = req.body as { enable: unknown };
  if (typeof enable !== "boolean") {
    res.status(400).json({ error: '"enable" must be a boolean' });
    return;
  }
  log.warn(`FILE SHARING ${enable ? "ENABLE" : "DISABLE"} requested from ${req.clientIp}`);
  const result = await setFileSharing(enable);
  log.warn(`FILE SHARING ${enable ? "ENABLE" : "DISABLE"} result: ${result.success ? "success" : result.error}`);
  const status = await getAllStatus();
  res.json({ result, status });
});

export default router;
