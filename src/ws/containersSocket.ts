import type http from "node:http";
import type https from "node:https";
import { WebSocketServer, WebSocket } from "ws";
import { parseCookies, isValidToken, COOKIE_NAME } from "../middleware/appPassword.js";
import { listContainersWithStats } from "../services/containers.js";
import { log } from "../logger.js";

const BROADCAST_INTERVAL = 2000;

export function setupContainersWebSocket(httpServer: http.Server | https.Server) {
  const wss = new WebSocketServer({ noServer: true });
  let broadcastTimer: ReturnType<typeof setInterval> | null = null;

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws/containers") return;

    const password = process.env.APP_PASSWORD;
    if (password) {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[COOKIE_NAME];

      if (!isValidToken(token)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  async function broadcast() {
    try {
      const data = JSON.stringify(await listContainersWithStats());
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
    } catch (err) {
      log.error(`Container stats broadcast failed: ${(err as Error).message}`);
    }
  }

  function startBroadcast() {
    if (!broadcastTimer) {
      broadcastTimer = setInterval(broadcast, BROADCAST_INTERVAL);
      log.info("Container stats broadcast started");
    }
  }

  function stopBroadcast() {
    if (broadcastTimer && wss.clients.size === 0) {
      clearInterval(broadcastTimer);
      broadcastTimer = null;
      log.info("Container stats broadcast stopped (no clients)");
    }
  }

  wss.on("connection", async (ws) => {
    log.info(`Container stats WebSocket client connected (total: ${wss.clients.size})`);

    try {
      const initial = JSON.stringify(await listContainersWithStats());
      ws.send(initial);
    } catch (err) {
      log.error(`Container stats initial send failed: ${(err as Error).message}`);
    }

    startBroadcast();

    ws.on("close", () => {
      log.info(`Container stats WebSocket client disconnected (total: ${wss.clients.size})`);
      stopBroadcast();
    });
  });

  return wss;
}
