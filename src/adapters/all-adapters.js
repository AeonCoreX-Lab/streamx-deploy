// streamx-deploy/src/adapters/cloudflare.js
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from 'child_process'
import chalk from 'chalk'

export async function preCheck(cfg) {
  try {
    execSync('wrangler --version', { stdio: 'ignore' })
  } catch {
    console.log(chalk.red('Wrangler not found.'))
    console.log(chalk.white('Install: npm install -g wrangler && wrangler login'))
    return false
  }
  // Check wrangler.toml exists
  const fs = await import('fs-extra')
  if (!fs.default.existsSync('wrangler.toml')) {
    console.log(chalk.red('wrangler.toml not found in project root.'))
    return false
  }
  return true
}

export async function deploy(cfg, options, onProgress) {
  const env  = options.prod ? '--env production' : ''
  onProgress('Deploying to Cloudflare Workers...')
  const out = execSync(`wrangler deploy ${env} --no-bundle 2>&1`, { encoding: 'utf-8' })

  // Extract deployed URL from wrangler output
  const match = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/)
  const url   = match?.[0] ?? ''

  if (!url) {
    // Try reading from wrangler.toml
    const fs     = await import('fs-extra')
    const toml   = fs.default.readFileSync('wrangler.toml', 'utf-8')
    const name   = toml.match(/^name\s*=\s*"([^"]+)"/m)?.[1]
    const sub    = execSync('wrangler whoami 2>&1').toString().match(/workers\.dev domain: ([^\s]+)/)?.[1]
    return sub ? `https://${name}.${sub}.workers.dev` : 'https://your-worker.workers.dev'
  }
  return url
}

export function tailLogs(cfg) {
  const name = cfg.addonId?.split('.').pop() ?? 'addon'
  execSync(`wrangler tail ${name}`, { stdio: 'inherit' })
}

// ─────────────────────────────────────────────────────────────────────────────
// streamx-deploy/src/adapters/vercel.js
// ─────────────────────────────────────────────────────────────────────────────
export const vercel = {
  async preCheck(cfg) {
    try { execSync('vercel --version', { stdio: 'ignore' }) }
    catch {
      console.log(chalk.red('Vercel CLI not found.'))
      console.log(chalk.white('Install: npm install -g vercel && vercel login'))
      return false
    }
    return true
  },

  async deploy(cfg, options, onProgress) {
    const prod = options.prod ? '--prod' : ''
    onProgress('Deploying to Vercel...')
    const out = execSync(`vercel ${prod} --yes 2>&1`, { encoding: 'utf-8' })
    const match = out.match(/https:\/\/[^\s]+\.vercel\.app/)
    return match?.[0] ?? 'https://your-project.vercel.app'
  },

  tailLogs(cfg) {
    execSync('vercel logs --follow', { stdio: 'inherit' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// streamx-deploy/src/adapters/render.js
// ─────────────────────────────────────────────────────────────────────────────
export const render = {
  async preCheck(cfg) {
    // Render deploys via git push — check render.yaml exists
    const fs = await import('fs-extra')
    if (!fs.default.existsSync('render.yaml')) {
      console.log(chalk.yellow('render.yaml not found — creating one...'))
      const yaml = `services:
  - type: web
    name: ${cfg.addonId?.split('.').pop() ?? 'streamx-addon'}
    env: node
    buildCommand: npm install
    startCommand: node src/index.js
    envVars:
      - key: PORT
        value: 10000
      - key: ADDON_ID
        value: ${cfg.addonId ?? 'community.my.addon'}
      - key: ADDON_NAME
        value: ${cfg.addonName ?? 'My Addon'}
`
      fs.default.writeFileSync('render.yaml', yaml)
      console.log(chalk.green('Created render.yaml'))
    }
    console.log(chalk.cyan('\nRender deploys via git push.'))
    console.log('1. Push this repo to GitHub')
    console.log('2. Go to https://render.com → New Web Service → Connect your repo')
    console.log('3. Render will auto-deploy on every git push')
    return false  // No CLI deploy — manual GitHub connection
  },

  async deploy(cfg, options, onProgress) {
    throw Object.assign(new Error('Use git push to deploy to Render'),
      { hint: 'Connect your GitHub repo at render.com → New Web Service' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// streamx-deploy/src/adapters/railway.js
// ─────────────────────────────────────────────────────────────────────────────
export const railway = {
  async preCheck(cfg) {
    try { execSync('railway --version', { stdio: 'ignore' }) }
    catch {
      console.log(chalk.red('Railway CLI not found.'))
      console.log(chalk.white('Install: npm install -g @railway/cli && railway login'))
      return false
    }
    return true
  },

  async deploy(cfg, options, onProgress) {
    onProgress('Deploying to Railway...')
    execSync('railway up --detach', { stdio: 'inherit' })
    const out = execSync('railway domain 2>&1', { encoding: 'utf-8' })
    const match = out.match(/https:\/\/[^\s]+\.railway\.app/)
    return match?.[0] ?? 'https://your-service.railway.app'
  },

  tailLogs(cfg) {
    execSync('railway logs --follow', { stdio: 'inherit' })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// streamx-deploy/src/adapters/docker.js
// ─────────────────────────────────────────────────────────────────────────────
export const docker = {
  async preCheck(cfg) {
    try { execSync('docker --version', { stdio: 'ignore' }) }
    catch {
      console.log(chalk.red('Docker not found. Install Docker first.'))
      return false
    }

    const fs = await import('fs-extra')
    if (!fs.default.existsSync('Dockerfile')) {
      console.log(chalk.yellow('Dockerfile not found — creating one...'))
      const dockerfile = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 7000
ENV PORT=7000
CMD ["node", "src/index.js"]
`
      fs.default.writeFileSync('Dockerfile', dockerfile)

      const dockerignore = `node_modules\n.git\n.env\n*.zip\n`
      fs.default.writeFileSync('.dockerignore', dockerignore)

      console.log(chalk.green('Created Dockerfile + .dockerignore'))
    }
    return true
  },

  async deploy(cfg, options, onProgress) {
    const name = cfg.addonId?.split('.').pop() ?? 'streamx-addon'
    const tag  = `${name}:latest`

    onProgress('Building Docker image...')
    execSync(`docker build -t ${tag} .`, { stdio: 'inherit' })

    console.log(chalk.cyan('\n🐳 Docker image built: ' + tag))
    console.log('\nTo run locally:')
    console.log(chalk.white(`  docker run -p 7000:7000 ${tag}`))
    console.log('\nTo push to Docker Hub:')
    console.log(chalk.white(`  docker tag ${tag} YOUR_DOCKERHUB_USERNAME/${name}:latest`))
    console.log(chalk.white(`  docker push YOUR_DOCKERHUB_USERNAME/${name}:latest`))
    console.log('\nTo deploy on VPS (SSH into server, then):')
    console.log(chalk.white(`  docker pull YOUR_DOCKERHUB_USERNAME/${name}:latest`))
    console.log(chalk.white(`  docker run -d -p 80:7000 --restart unless-stopped YOUR_DOCKERHUB_USERNAME/${name}:latest`))
    console.log('\nFor HTTPS on VPS, use Caddy or nginx with certbot.')
    console.log(chalk.gray('\nCaddy config example (put in /etc/caddy/Caddyfile):'))
    console.log(chalk.gray('  your-domain.com { reverse_proxy localhost:7000 }'))

    return 'http://your-vps-ip:7000'
  },

  tailLogs(cfg) {
    const name = cfg.addonId?.split('.').pop() ?? 'streamx-addon'
    execSync(`docker logs -f $(docker ps -q --filter ancestor=${name}:latest)`, { stdio: 'inherit' })
  }
}
