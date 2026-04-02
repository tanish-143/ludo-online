# Online Multiplayer Ludo

A browser-based multiplayer Ludo game with a Node.js server.

## Features

- 2 to 4 players per room
- Room creation and join by room code
- Real-time updates via Server-Sent Events (SSE)
- Server-authoritative game logic:
  - turn order
  - dice roll and legal moves
  - token spawning on six
  - home lane progression
  - captures (except on safe cells)
  - extra turn on six
  - three consecutive sixes skip rule
  - winner ranking and game end

## Local Run

1. Open terminal in this folder.
2. Start server:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000`.

## Permanent Public Deploy (Oracle Always Free VPS)

This gives you a stable public URL for players from any location.

### 1) Create VPS

Create an Oracle Cloud Always Free Ubuntu VM and assign a **Reserved Public IP**.

### 2) Open network ports in OCI

In the VM VCN security list (or NSG), allow inbound:

- TCP `22` (SSH)
- TCP `80` (HTTP)

### 3) Push this project to GitHub

From your local machine:

```bash
git init
git add .
git commit -m "Initial ludo server"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### 4) SSH to VPS and bootstrap

```bash
ssh ubuntu@<YOUR_PUBLIC_IP>
```

Then run:

```bash
sudo apt-get update
sudo apt-get install -y git
git clone https://github.com/<your-user>/<your-repo>.git /opt/ludo-online
cd /opt/ludo-online
chmod +x deploy/ubuntu/*.sh
./deploy/ubuntu/bootstrap.sh
./deploy/ubuntu/deploy.sh https://github.com/<your-user>/<your-repo>.git
./deploy/ubuntu/configure-nginx.sh <YOUR_PUBLIC_IP>
```

### 5) Share link

Share:

```text
http://<YOUR_PUBLIC_IP>
```

### 6) Update app later

On VPS:

```bash
cd /opt/ludo-online
git pull --ff-only
./deploy/ubuntu/deploy.sh
```

## Optional: Add HTTPS with a domain

If you point a domain to your VPS, install TLS cert:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## API Summary

- `POST /api/create-room` `{ name }`
- `POST /api/join-room` `{ roomCode, name }`
- `POST /api/start-game` `{ roomCode, playerId }`
- `POST /api/roll` `{ roomCode, playerId }`
- `POST /api/move` `{ roomCode, playerId, tokenIndex }`
- `GET /api/state?roomCode=...&playerId=...`
- `GET /api/events?roomCode=...&playerId=...` (SSE)
