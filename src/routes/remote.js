import { Router } from "express";
import {
  getAllStatus,
  setSSH,
  setFileSharing,
} from "../services/macControl.js";

const router = Router();

// GET /api/status — current state of all services
router.get("/status", async (req, res) => {
  try {
    const status = await getAllStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ssh { enable: true|false }
router.post("/ssh", async (req, res) => {
  const { enable } = req.body;
  if (typeof enable !== "boolean") {
    return res.status(400).json({ error: '"enable" must be a boolean' });
  }
  const result = await setSSH(enable);
  const status = await getAllStatus();
  res.json({ result, status });
});

// POST /api/file-sharing { enable: true|false }
router.post("/file-sharing", async (req, res) => {
  const { enable } = req.body;
  if (typeof enable !== "boolean") {
    return res.status(400).json({ error: '"enable" must be a boolean' });
  }
  const result = await setFileSharing(enable);
  const status = await getAllStatus();
  res.json({ result, status });
});

export default router;
