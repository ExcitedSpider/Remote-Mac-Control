import type http from "node:http";
import type https from "node:https";
import { WebSocketServer, WebSocket } from "ws";
import { parseCookies, isValidToken, COOKIE_NAME } from "../middleware/appPassword.js";
import { getSystemMetrics } from "../services/systemMetrics.js";
import { log } from "../logger.js";

const BROADCAST_INTERVAL = 2000;

export function setupMetricsWebSocket(httpServer: http.Server | https.Server) {
  const wss = new WebSocketServer({ noServer: true });
  let broadcastTimer: ReturnType<typeof setInterval> | null = null;

  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url !== "/ws/metrics") {
      socket.destroy();
      return;
    }

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

  function broadcast() {
    const data = JSON.stringify(getSystemMetrics());
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  function startBroadcast() {
    if (!broadcastTimer) {
      broadcastTimer = setInterval(broadcast, BROADCAST_INTERVAL);
      log.info("Metrics broadcast started");
    }
  }

  function stopBroadcast() {
    if (broadcastTimer && wss.clients.size === 0) {
      clearInterval(broadcastTimer);
      broadcastTimer = null;
      log.info("Metrics broadcast stopped (no clients)");
    }
  }

  wss.on("connection", (ws) => {
    log.info(`Metrics WebSocket client connected (total: ${wss.clients.size})`);

    // Send initial metrics immediately
    const initial = JSON.stringify(getSystemMetrics());
    ws.send(initial);

    startBroadcast();

    ws.on("close", () => {
      log.info(`Metrics WebSocket client disconnected (total: ${wss.clients.size})`);
      stopBroadcast();
    });
  });

  return wss;
}
