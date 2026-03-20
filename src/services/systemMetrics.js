import os from "node:os";
import { execSync } from "node:child_process";

let previousCpuTimes = null;

function getCpuTimes() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  for (const cpu of cpus) {
    const { user, nice, sys, idle, irq } = cpu.times;
    totalTick += user + nice + sys + idle + irq;
    totalIdle += idle;
  }
  return { idle: totalIdle, total: totalTick };
}

function getMemoryInfo() {
  const totalBytes = os.totalmem();
  const totalMB = Math.round(totalBytes / 1024 / 1024);

  // macOS: os.freemem() only reports truly free pages, ignoring
  // inactive/purgeable pages that the OS can reclaim instantly.
  // Use vm_stat for an accurate "used" figure matching Activity Monitor.
  if (process.platform === "darwin") {
    try {
      const output = execSync("vm_stat", { encoding: "utf8" });
      const pages = {};
      for (const line of output.split("\n")) {
        const match = line.match(/^(.+?):\s+([\d.]+)/);
        if (match) pages[match[1].trim()] = parseInt(match[2], 10);
      }
      // vm_stat reports page size in the first line
      const pageSizeMatch = output.match(/page size of (\d+) bytes/);
      const pageSize = pageSizeMatch ? parseInt(pageSizeMatch[1], 10) : 16384;

      // "Used" memory = active + wired (what apps are actually using)
      const active = (pages["Pages active"] || 0) * pageSize;
      const wired = (pages["Pages wired down"] || 0) * pageSize;
      const usedBytes = active + wired;
      const usedMB = Math.round(usedBytes / 1024 / 1024);

      return {
        totalMB,
        freeMB: totalMB - usedMB,
        usedMB,
        usagePercent: Math.round((usedBytes / totalBytes) * 1000) / 10,
      };
    } catch {}
  }

  // Fallback for non-macOS or if vm_stat fails
  const freeMem = os.freemem();
  const usedMem = totalBytes - freeMem;
  return {
    totalMB,
    freeMB: Math.round(freeMem / 1024 / 1024),
    usedMB: Math.round(usedMem / 1024 / 1024),
    usagePercent: Math.round((usedMem / totalBytes) * 1000) / 10,
  };
}

export function getSystemMetrics() {
  const currentCpuTimes = getCpuTimes();
  let cpuUsagePercent = null;

  if (previousCpuTimes) {
    const idleDelta = currentCpuTimes.idle - previousCpuTimes.idle;
    const totalDelta = currentCpuTimes.total - previousCpuTimes.total;
    cpuUsagePercent = totalDelta === 0 ? 0 : Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
  }

  previousCpuTimes = currentCpuTimes;

  return {
    cpu: {
      usagePercent: cpuUsagePercent,
      coreCount: os.cpus().length,
    },
    memory: getMemoryInfo(),
    timestamp: Date.now(),
  };
}
