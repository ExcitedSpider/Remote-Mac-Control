import { Router } from "express";
import { listContainers } from "../services/containers.js";

const router = Router();

// GET /api/containers — list running podman containers
router.get("/containers", async (_req, res) => {
  try {
    const containers = await listContainers();
    res.json(containers);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
