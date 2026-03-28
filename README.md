# my-remote

Web server for remotely controlling macOS services (SSH, File Sharing), protected by Cloudflare Access.

## Prerequisites

- Node.js 18+ (with `tsx` for TypeScript execution)
- macOS
- `cloudflared` CLI (for Cloudflare Tunnel)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Grant passwordless sudo and Full Disk Access

The server needs to run `systemsetup` and `launchctl` as root. This script creates a sudoers entry scoped to only those specific commands:

```bash
sudo bash setup-sudoers.sh
```

Toggling SSH (Remote Login) also requires **Full Disk Access** for the Node.js binary. Go to **System Settings > Privacy & Security > Full Disk Access** and add `/opt/homebrew/bin/node` (press Cmd+Shift+G in the file picker to enter the path).

### 3. Configure Cloudflare Access

Create a tunnel and add a DNS route:

```bash
cloudflared tunnel create my-remote
cloudflared tunnel route dns my-remote remote.yourdomain.com
```

In the [Cloudflare Zero Trust dashboard](https://one.dash.cloudflare.com/):

1. Go to **Access > Applications > Add an application**
2. Set the application domain to `remote.yourdomain.com`
3. Add an access policy (e.g. allow specific emails, IdP groups)
4. Copy the **Application ID** (this is the JWT audience value)

### 4. Create config files

Copy and edit the templates:

```bash
cp .env.example .env
cp cloudflared-config.example.yml cloudflared-config.yml
```

Edit `.env`:

```
PORT=3000
USE_HTTPS=false
APP_PASSWORD=your-secret-password
CF_ACCESS_ENABLED=true
CF_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_AUD=your-application-id
```

Edit `cloudflared-config.yml` — replace `<TUNNEL_ID>` with your tunnel ID and set your hostname:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: remote.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### 5. Install as a launchd service

The server runs as a launchd agent that auto-restarts on crash and logs output to `logs/`.

```bash
cp com.my-remote.server.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.my-remote.server.plist
```

Start the tunnel separately:

```bash
cloudflared tunnel --config ./cloudflared-config.yml run my-remote
```

Manage the service:

```bash
# Stop
launchctl bootout gui/$(id -u)/com.my-remote.server

# Start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.my-remote.server.plist

# Check status
launchctl list | grep my-remote

# View logs
tail -f logs/server.log logs/server.error.log
```

### Local development

`npm run dev` starts both the Express backend (via `tsx`) and the Vite dev server with hot-reload. Auth is disabled by default via `local.env`:

```
PORT=3001          # Backend port
USE_HTTPS=false
APP_PASSWORD=      # Empty = no password required
CF_ACCESS_ENABLED=false
```

The Vite dev server runs on `http://localhost:5173` and proxies API/WebSocket requests to the backend. It reads `PORT` from `local.env` automatically so the proxy target stays in sync.

```bash
npm run dev           # Start both backend + Vite dev server
npm run dev:backend   # Backend only
npm run dev:frontend  # Vite dev server only
npm run typecheck     # Run TypeScript type checking (backend + frontend)
```

## API

| Method | Path               | Body                | Description            |
|--------|--------------------|---------------------|------------------------|
| GET    | `/api/status`      | —                   | Get SSH & File Sharing status |
| POST   | `/api/ssh`         | `{"enable": true}`  | Toggle SSH (Remote Login)     |
| POST   | `/api/file-sharing` | `{"enable": true}` | Toggle File Sharing (SMB)     |

All routes are protected by two layers of auth:

1. **Cloudflare Access** — JWT validation (bypass with `CF_ACCESS_ENABLED=false`)
2. **App password** — set via `APP_PASSWORD` in `.env` (omit to disable)

## Why `USE_HTTPS=false`?

The connection chain is fully encrypted without local HTTPS:

```
Browser → (HTTPS) → Cloudflare Edge → (encrypted tunnel) → cloudflared → (HTTP) → localhost
```

The last hop from `cloudflared` to the server is on localhost and never leaves the machine, so there's nothing to intercept. Running HTTPS locally with a self-signed cert just adds complexity (cert generation, `noTLSVerify` in tunnel config) for no security benefit.

If you need direct HTTPS access without cloudflared, generate self-signed certs with `npm run generate-certs` and set `USE_HTTPS=true`.

## Web UI

Open your Cloudflare hostname in a browser. The UI provides toggle switches for SSH and File Sharing.
