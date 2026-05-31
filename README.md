# streamx-deploy
### Deploy StreamX addons to any platform — free

```
npm install -g streamx-deploy
streamx-deploy init
streamx-deploy deploy
```

---

## Supported Platforms

| Platform | Cost | Deploy Time | Always-On | HTTPS |
|----------|------|-------------|-----------|-------|
| **Cloudflare Workers** | Free (100k req/day) | 30s | ✅ | ✅ Auto |
| **Vercel** | Free (100GB/month) | 1min | ✅ | ✅ Auto |
| **Render** | Free (sleeps 15min) | 2min | ⚠️ | ✅ Auto |
| **Railway** | $5 credit/month | 2min | ✅ | ✅ Auto |
| **Docker/VPS** | Your server cost | 5min | ✅ | Manual Caddy |

**Recommended:**
- Low traffic addon → **Cloudflare Workers** (fastest + free)
- Node.js addon, always-on free → **Vercel**
- Full control, power user → **Docker/VPS**

---

## Quick Start

```bash
# Install globally
npm install -g streamx-deploy

# 1. Create new addon project
streamx-deploy init
# → prompts: name, addon ID, platform choice

# 2. Edit your logic
cd my-addon
# → edit src/index.js → fill in getStreams() function

# 3. Test locally
streamx-deploy test

# 4. Deploy
streamx-deploy deploy

# 5. Validate live endpoint
streamx-deploy validate https://my-addon.workers.dev/manifest.json

# 6. Submit to StreamX community registry
streamx-deploy publish
```

---

## Commands

```
streamx-deploy init                    scaffold new addon project
streamx-deploy deploy                  deploy (interactive platform choice)
streamx-deploy deploy -p cloudflare    deploy to specific platform
streamx-deploy test                    test endpoints locally
streamx-deploy test -p 8080 -i tt0068646
streamx-deploy validate [url]          validate a live addon
streamx-deploy publish                 submit to registry
streamx-deploy logs                    tail platform logs
streamx-deploy info                    show current project config
```

---

## Platform-Specific Setup

### Cloudflare Workers
```bash
npm install -g wrangler
wrangler login
# → edit wrangler.toml: set name and [vars]
streamx-deploy deploy -p cloudflare
```
**GitHub auto-deploy secrets needed:**
- `CF_API_TOKEN` — Cloudflare API token (Workers:Edit)
- `CF_ACCOUNT_ID` — Your Cloudflare account ID

### Vercel
```bash
npm install -g vercel
vercel login
streamx-deploy deploy -p vercel
```
**GitHub auto-deploy secrets needed:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Render
Render deploys automatically when you push to GitHub:
1. Create account at render.com
2. New Web Service → Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node src/index.js`
5. Add env vars in Render dashboard

**GitHub auto-deploy secrets needed:**
- `RENDER_DEPLOY_HOOK_URL` — From Render service → Settings → Deploy Hook

### Railway
```bash
npm install -g @railway/cli
railway login
railway init
streamx-deploy deploy -p railway
```
**GitHub auto-deploy secrets needed:**
- `RAILWAY_TOKEN`
- `RAILWAY_SERVICE_ID`

### Docker / VPS
```bash
# Build image
streamx-deploy deploy -p docker

# Push to Docker Hub
docker tag streamx-addon:latest YOUR_USER/streamx-addon:latest
docker push YOUR_USER/streamx-addon:latest

# On your VPS
docker compose up -d
```
**GitHub auto-deploy secrets needed:**
- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

---

## Project Structure

After `streamx-deploy init`, your project looks like:

```
my-addon/
├── src/
│   └── index.js          ← YOUR LOGIC HERE (edit getStreams())
├── package.json
├── manifest.json         ← addon metadata
├── .streamx-deploy.json  ← deployment config (auto-generated)
├── .env.example          ← API keys template
├── wrangler.toml         ← (cloudflare only)
├── vercel.json           ← (vercel only)
├── Dockerfile            ← (docker only)
├── docker-compose.yml    ← (docker only)
└── .github/
    └── workflows/
        └── deploy.yml    ← auto-deploy on git push
```

---

## getStreams() Reference

```js
// movie  → type='movie',  imdbId='tt1234567', season=undefined, episode=undefined
// series → type='series', imdbId='tt1234567', season='1',       episode='3'
async function getStreams(type, imdbId, season, episode, env) {
  return [
    {
      url:         'https://...',          // required: direct video URL
      name:        '1080p',               // shown in StreamX source list
      description: 'MySite | FHD',        // subtitle under name
      // optional:
      behaviorHints: {
        notWebReady: true,               // set if URL needs auth headers
        proxyHeaders: {
          request: { 'Referer': 'https://mysite.xyz' }
        }
      },
      subtitles: [                       // optional: embedded subtitles
        { url: 'https://...sub.srt', lang: 'en' }
      ]
    }
  ]
}
```

---

## Deploying addon to multiple platforms

You can deploy the same addon to multiple platforms:

```bash
streamx-deploy deploy -p cloudflare   # primary
streamx-deploy deploy -p vercel       # backup
```

Use the same manifest ID — StreamX registry stores one URL per addon.
Publish the most reliable one (usually Cloudflare Workers).

---

## Note on hosting costs

**You are responsible for your hosting.** StreamX provides this tool free.
All listed platforms have free tiers sufficient for most addons.
Cloudflare Workers is recommended — genuinely free with no credit card.
