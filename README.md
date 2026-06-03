# streamx-deploy
### Deploy StreamX/Stremio addons anywhere — one bash script, zero dependencies

```bash
curl -sSL https://aeoncorex-lab.github.io/streamx-deploy/install.sh | bash
```

---

## Why bash?

- Works on **every** Unix/Linux/macOS/WSL system out of the box
- No Node.js, Python, or runtime installation needed
- Single file — download once, run forever
- Tested on: Ubuntu, Debian, Alpine, Arch, macOS, Android Termux, Raspberry Pi

---

## Install

```bash
# One-line install (recommended)
curl -sSL https://aeoncorex-lab.github.io/streamx-deploy/install.sh | bash

# Manual install
curl -sSL https://aeoncorex-lab.github.io/streamx-deploy/streamx-deploy \
  -o /usr/local/bin/streamx-deploy
chmod +x /usr/local/bin/streamx-deploy

# Windows (WSL / Git Bash)
curl -sSL https://aeoncorex-lab.github.io/streamx-deploy/streamx-deploy \
  -o ~/bin/streamx-deploy
chmod +x ~/bin/streamx-deploy
```

---

## Supported Platforms

| Platform | Cost | Always-on | HTTPS | CLI |
|----------|------|-----------|-------|-----|
| **Cloudflare Workers** | Free (100k req/day) | ✅ | ✅ auto | `wrangler` |
| **Vercel** | Free (100GB/mo) | ✅ | ✅ auto | `vercel` |
| **Netlify Functions** | Free (125k req/mo) | ✅ | ✅ auto | `netlify` |
| **Render** | Free (sleeps 15min) | ⚠️ | ✅ auto | git push |
| **Fly.io** | Free tier | ✅ | ✅ auto | `flyctl` |
| **Railway** | $5 credit/month | ✅ | ✅ auto | `railway` |
| **Docker / VPS** | Your server | ✅ | Manual Caddy | `docker` + `ssh` |
| **Cherry Servers** | Your server | ✅ | Manual Caddy | `docker` + `ssh` |
| **Any VPS (SSH)** | Your server | ✅ | Manual Caddy | `docker` + `ssh` |

**Recommendation:** Cloudflare Workers for most addons — genuinely free, global CDN, zero cold starts.

---

## Quick Start

```bash
# 1. Create addon project (interactive)
streamx-deploy new
#  → prompts: name, addon ID, target platform
#  → generates: src/index.js, manifest.json, platform config, GitHub Actions

# 2. Edit your logic
cd my-addon
# Edit src/index.js → fill in getStreams() function

# 3. Test locally (needs Node.js, Bun, or Deno)
streamx-deploy test

# 4. Deploy
streamx-deploy deploy

# 5. Validate live endpoint
streamx-deploy validate https://my-addon.workers.dev/manifest.json

# 6. Register to StreamX community catalog
streamx-deploy register
```

---

## Commands

```
streamx-deploy new              Scaffold new addon project
streamx-deploy deploy           Deploy (uses platform from .streamx-deploy.json)
streamx-deploy deploy -p cf     Force platform: cf|cloudflare|vercel|render|railway|
                                                  netlify|fly|docker|vps
streamx-deploy test             Test local endpoints (port 7070)
streamx-deploy test 8080        Test on custom port
streamx-deploy validate <url>   Validate a live addon manifest URL
streamx-deploy register         Submit to StreamX community registry
streamx-deploy platforms        Show all platforms + installation status
streamx-deploy update           Update streamx-deploy to latest version
streamx-deploy version          Show version
```

---

## Project structure (after `streamx-deploy new`)

```
my-addon/
├── src/
│   └── index.js              ← YOUR LOGIC (edit getStreams())
├── manifest.json             ← addon metadata
├── package.json
├── .streamx-deploy.json      ← deployment config (auto-managed)
├── .env.example              ← API key template
├── .gitignore
│
├── wrangler.toml             ← (Cloudflare only)
├── vercel.json               ← (Vercel only)
├── netlify.toml              ← (Netlify only)
├── fly.toml                  ← (Fly.io only)
├── Dockerfile                ← (Docker/VPS only)
├── docker-compose.yml        ← (Docker/VPS only)
├── Caddyfile                 ← (VPS HTTPS template)
│
└── .github/
    └── workflows/
        └── deploy.yml        ← auto-deploy on git push
```

---

## getStreams() API

```js
// Called for each stream request
// type    = 'movie' | 'series'
// imdbId  = 'tt1234567'
// season  = '1'    (series only, undefined for movies)
// episode = '3'    (series only)
async function getStreams(type, imdbId, season, episode) {
  return [
    {
      url:         'https://...',       // required: direct video URL
      name:        '1080p FHD',         // shown in StreamX source list
      description: 'MySite | Server1',  // subtitle under name
      // optional fields:
      subtitles: [{ url: 'https://...sub.srt', lang: 'en' }],
      behaviorHints: {
        notWebReady: true,
        proxyHeaders: { request: { 'Referer': 'https://mysite.xyz' } }
      }
    }
  ]
}
```

---

## Platform-specific setup

### Cloudflare Workers
```bash
npm install -g wrangler
wrangler login
# GitHub Actions secrets: CF_API_TOKEN, CF_ACCOUNT_ID
```

### Vercel
```bash
npm install -g vercel
vercel login
# GitHub Actions secrets: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID
```

### Render
Connect GitHub repo at render.com → New Web Service. Auto-deploys on push.
```bash
# GitHub Actions secrets: RENDER_DEPLOY_HOOK
```

### Railway
```bash
npm install -g @railway/cli
railway login && railway init
# GitHub Actions secrets: RAILWAY_TOKEN, RAILWAY_SERVICE
```

### Netlify
```bash
npm install -g netlify-cli
netlify login
```

### Fly.io
```bash
curl -L https://fly.io/install.sh | sh
flyctl auth login && flyctl launch
# GitHub Actions secrets: FLY_API_TOKEN
```

### Docker / VPS / Cherry Servers
```bash
# Install Docker on your server:
curl -fsSL https://get.docker.com | sh

# Clone and run:
git clone https://github.com/YOUR_USER/my-addon
cd my-addon
docker compose up -d

# For HTTPS, add Caddy:
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d
# GitHub Actions secrets: DOCKERHUB_USER, DOCKERHUB_TOKEN, VPS_HOST, VPS_USER, VPS_SSH_KEY
```

---

## Environment variables / API keys

```bash
# Cloudflare Workers (never in code)
wrangler secret put MY_API_KEY

# Vercel
vercel env add MY_API_KEY

# Railway
railway variables set MY_API_KEY=value

# Render
# Set in Render dashboard → Environment

# Docker/VPS — use .env file (never commit)
echo "MY_API_KEY=value" >> .env
```

---

## Registry submission rules

To get listed in the StreamX addon catalog:

1. Addon must respond 24/7 — **health-checked every 6 hours**
2. `/manifest.json` must return valid JSON with required fields
3. `/stream/{type}/{id}.json` must return `{ streams: [] }`
4. ID must follow format: `community.authorname.addonname`
5. Must use **HTTPS** (not HTTP)
6. NSFW content: set `"nsfw": true` in flags
7. **3 consecutive health failures → auto-removed** from catalog

After merge: your addon appears on the catalog website immediately.

---

## Stremio compatibility

Your addon is **fully Stremio-compatible**. The protocol is identical.
Users can install it in both StreamX and Stremio using the same URL.
