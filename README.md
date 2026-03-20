# my-remote

HTTPS web server for remotely controlling macOS services (SSH, File Sharing), protected by Cloudflare Access.

## Prerequisites

- Node.js 18+
- macOS
- `cloudflared` CLI (for Cloudflare Tunnel)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Grant passwordless sudo

The server needs to run `systemsetup` and `launchctl` as root. This script creates a sudoers entry scoped to only those specific commands:

```bash
sudo bash setup-sudoers.sh
```

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

### 4. Create `.env`

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
USE_HTTPS=false
CF_ACCESS_ENABLED=true
CF_TEAM_DOMAIN=yourteam.cloudflareaccess.com
CF_AUD=your-application-audience-tag
```

### 5. Start the server

```bash
node server.js
cloudflared tunnel run --url http://localhost:3000 my-remote
```

For local development (no HTTPS, no auth):

```bash
npm run dev
```

## API

| Method | Path               | Body                | Description            |
|--------|--------------------|---------------------|------------------------|
| GET    | `/api/status`      | —                   | Get SSH & File Sharing status |
| POST   | `/api/ssh`         | `{"enable": true}`  | Toggle SSH (Remote Login)     |
| POST   | `/api/file-sharing` | `{"enable": true}` | Toggle File Sharing (SMB)     |

All `/api` routes require a valid Cloudflare Access JWT (unless `CF_ACCESS_ENABLED=false`).

## Why `USE_HTTPS=false`?

The connection chain is fully encrypted without local HTTPS:

```
Browser → (HTTPS) → Cloudflare Edge → (encrypted tunnel) → cloudflared → (HTTP) → localhost
```

The last hop from `cloudflared` to the server is on localhost and never leaves the machine, so there's nothing to intercept. Running HTTPS locally with a self-signed cert just adds complexity (cert generation, `noTLSVerify` in tunnel config) for no security benefit.

If you need direct HTTPS access without cloudflared, generate self-signed certs with `npm run generate-certs` and set `USE_HTTPS=true`.

## Web UI

Open your Cloudflare hostname in a browser. The UI provides toggle switches for SSH and File Sharing.
