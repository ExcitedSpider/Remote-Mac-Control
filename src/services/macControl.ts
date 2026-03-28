import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
}

interface ServiceStatus {
  enabled: boolean;
  raw?: string;
  error?: string;
}

/**
 * Execute a command with sudo.
 * The server process must either run as root or have NOPASSWD sudo
 * configured for these specific commands.
 */
async function sudoExec(cmd: string, args: string[]): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync("/usr/bin/sudo", [cmd, ...args], {
      timeout: 10_000,
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message: string };
    return {
      success: false,
      error: execErr.stderr?.trim() || execErr.message,
    };
  }
}

// --- SSH (Remote Login) ---

export async function getSSHStatus(): Promise<ServiceStatus> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/sudo", [
      "/usr/sbin/systemsetup",
      "-getremotelogin",
    ]);
    const on = /on/i.test(stdout);
    return { enabled: on, raw: stdout.trim() };
  } catch (err: unknown) {
    return { enabled: false, error: (err as Error).message };
  }
}

export async function setSSH(enable: boolean): Promise<CommandResult> {
  const flag = enable ? "on" : "off";
  // -f flag forces off without confirmation prompt
  const args = enable
    ? ["/usr/sbin/systemsetup", "-setremotelogin", flag]
    : ["/usr/sbin/systemsetup", "-f", "-setremotelogin", flag];
  return sudoExec(args[0], args.slice(1));
}

// --- File Sharing (SMB) ---

const SMB_PLIST = "/System/Library/LaunchDaemons/com.apple.smbd.plist";

export async function getFileSharingStatus(): Promise<ServiceStatus> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/sudo", [
      "/bin/launchctl",
      "list",
      "com.apple.smbd",
    ]);
    // If the command succeeds, the service is loaded
    return { enabled: true, raw: stdout.trim() };
  } catch {
    return { enabled: false };
  }
}

export async function setFileSharing(enable: boolean): Promise<CommandResult> {
  const action = enable ? "load" : "unload";
  return sudoExec("/bin/launchctl", [action, "-w", SMB_PLIST]);
}

// --- Combined status ---

export interface AllStatus {
  ssh: ServiceStatus;
  fileSharing: ServiceStatus;
}

export async function getAllStatus(): Promise<AllStatus> {
  const [ssh, fileSharing] = await Promise.all([
    getSSHStatus(),
    getFileSharingStatus(),
  ]);
  return { ssh, fileSharing };
}
