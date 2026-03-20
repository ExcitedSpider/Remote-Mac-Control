import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Execute a command with sudo.
 * The server process must either run as root or have NOPASSWD sudo
 * configured for these specific commands.
 */
async function sudoExec(cmd, args) {
  try {
    const { stdout, stderr } = await execFileAsync("sudo", [cmd, ...args], {
      timeout: 10_000,
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.stderr?.trim() || err.message,
    };
  }
}

// --- SSH (Remote Login) ---

export async function getSSHStatus() {
  try {
    const { stdout } = await execFileAsync("sudo", [
      "systemsetup",
      "-getremotelogin",
    ]);
    const on = /on/i.test(stdout);
    return { enabled: on, raw: stdout.trim() };
  } catch (err) {
    return { enabled: false, error: err.message };
  }
}

export async function setSSH(enable) {
  const flag = enable ? "on" : "off";
  // -f flag forces off without confirmation prompt
  const args = enable
    ? ["systemsetup", "-setremotelogin", flag]
    : ["systemsetup", "-f", "-setremotelogin", flag];
  return sudoExec(args[0], args.slice(1));
}

// --- File Sharing (SMB) ---

const SMB_PLIST = "/System/Library/LaunchDaemons/com.apple.smbd.plist";

export async function getFileSharingStatus() {
  try {
    const { stdout } = await execFileAsync("sudo", [
      "launchctl",
      "list",
      "com.apple.smbd",
    ]);
    // If the command succeeds, the service is loaded
    return { enabled: true, raw: stdout.trim() };
  } catch {
    return { enabled: false };
  }
}

export async function setFileSharing(enable) {
  const action = enable ? "load" : "unload";
  return sudoExec("launchctl", [action, "-w", SMB_PLIST]);
}

// --- Combined status ---

export async function getAllStatus() {
  const [ssh, fileSharing] = await Promise.all([
    getSSHStatus(),
    getFileSharingStatus(),
  ]);
  return { ssh, fileSharing };
}
