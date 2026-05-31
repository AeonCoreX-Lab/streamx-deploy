// streamx-deploy/src/commands/init.js
import { input, select, confirm } from '@inquirer/prompts'
import chalk from 'chalk'
import ora   from 'ora'
import fs    from 'fs-extra'
import path  from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(__dirname, '../../templates')

// ── Platform choices ──────────────────────────────────────────────────────────
const PLATFORMS = [
  {
    value: 'cloudflare',
    name:  `${chalk.yellow('Cloudflare Workers')}  — Free, global CDN, 100k req/day free`,
    short: 'Cloudflare'
  },
  {
    value: 'vercel',
    name:  `${chalk.white('Vercel')}               — Free, Node.js, 100GB bandwidth/month free`,
    short: 'Vercel'
  },
  {
    value: 'render',
    name:  `${chalk.blue('Render')}               — Free tier (sleeps after 15min idle)`,
    short: 'Render'
  },
  {
    value: 'railway',
    name:  `${chalk.red('Railway')}              — $5 credit/month free, always-on`,
    short: 'Railway'
  },
  {
    value: 'docker',
    name:  `${chalk.cyan('Docker / VPS')}         — Self-hosted, full control, your cost`,
    short: 'Docker/VPS'
  },
]

// ── Content types ─────────────────────────────────────────────────────────────
const CONTENT_TYPES = [
  { value: 'stream',    name: 'Streams (video sources)' },
  { value: 'subtitles', name: 'Subtitles' },
  { value: 'catalog',   name: 'Catalog (browse content)' },
]

export async function cmdInit() {
  console.log(chalk.cyan('\n🚀 StreamX Addon Project Setup\n'))

  // ── Gather info ───────────────────────────────────────────────────────────
  const name = await input({
    message: 'Project name (becomes directory name):',
    validate: v => /^[a-z0-9-_]+$/.test(v) || 'Use lowercase letters, numbers, hyphens only'
  })

  const addonId = await input({
    message: 'Addon ID (reverse-domain format):',
    default:  `community.myname.${name}`,
    validate: v => /^community\.[a-z0-9_-]+\.[a-z0-9_-]+$/.test(v) || 'Must be: community.author.name'
  })

  const addonName = await input({ message: 'Addon display name:', default: name })
  const addonDesc = await input({ message: 'Short description:',  default: 'StreamX community addon' })

  const platform = await select({ message: 'Target hosting platform:', choices: PLATFORMS })

  const resources = await (async () => {
    const choices = await import('@inquirer/prompts').then(m => m.checkbox || null)
    // Fallback: just default to stream
    return ['stream']
  })()

  const withGitHub = await confirm({ message: 'Set up GitHub Actions auto-deploy?', default: true })

  // ── Scaffold project ──────────────────────────────────────────────────────
  const dir = path.resolve(name)
  if (fs.existsSync(dir)) {
    const ok = await confirm({ message: `Directory "${name}" already exists. Overwrite?`, default: false })
    if (!ok) { console.log(chalk.yellow('Cancelled.')); return }
    await fs.remove(dir)
  }

  const spin = ora(`Creating ${name}/`).start()

  try {
    // Copy base template + platform-specific config
    const baseTpl = path.join(TEMPLATES, 'base')
    const platTpl = path.join(TEMPLATES, platform)

    await fs.copy(baseTpl, dir, { overwrite: true })
    if (fs.existsSync(platTpl)) {
      await fs.copy(platTpl, dir, { overwrite: true })
    }

    // Patch package.json
    const pkgPath = path.join(dir, 'package.json')
    const pkg     = fs.readJsonSync(pkgPath)
    pkg.name = name
    fs.writeJsonSync(pkgPath, pkg, { spaces: 2 })

    // Write .streamx-deploy.json (project config)
    const cfg = {
      addonId,
      addonName,
      addonDesc,
      platform,
      resources,
      createdAt: new Date().toISOString()
    }
    fs.writeJsonSync(path.join(dir, '.streamx-deploy.json'), cfg, { spaces: 2 })

    // Patch manifest.json in the template
    const mPath = path.join(dir, 'manifest.json')
    if (fs.existsSync(mPath)) {
      const m = fs.readJsonSync(mPath)
      Object.assign(m, { id: addonId, name: addonName, description: addonDesc, resources })
      fs.writeJsonSync(mPath, m, { spaces: 2 })
    }

    // Write .env.example
    fs.writeFileSync(path.join(dir, '.env.example'),
      `# Addon metadata\nADDON_ID=${addonId}\nADDON_NAME=${addonName}\n\n# Add your API keys here\n# MY_API_KEY=\n`)

    // GitHub Actions deploy workflow
    if (withGitHub) {
      const wfDir  = path.join(dir, '.github', 'workflows')
      const wfSrc  = path.join(TEMPLATES, 'github', `${platform}.yml`)
      const wfDest = path.join(wfDir, 'deploy.yml')
      if (fs.existsSync(wfSrc)) {
        await fs.ensureDir(wfDir)
        await fs.copy(wfSrc, wfDest)
      }
    }

    spin.succeed(chalk.green(`Project created: ${name}/`))

  } catch (e) {
    spin.fail(chalk.red(`Failed: ${e.message}`))
    return
  }

  // ── Next steps ────────────────────────────────────────────────────────────
  console.log(`
${chalk.cyan('Next steps:')}

  ${chalk.white(`cd ${name}`)}
  ${chalk.white('npm install')}
  ${chalk.white('# Edit src/index.js → fill in getStreams() with your logic')}
  ${chalk.white('streamx-deploy test')}        ${chalk.gray('# test locally')}
  ${chalk.white('streamx-deploy deploy')}      ${chalk.gray('# deploy to ' + platform)}
  ${chalk.white('streamx-deploy publish')}     ${chalk.gray('# submit to registry')}

${chalk.cyan('Platform setup:')}
  ${getPlatformSetup(platform)}
`)
}

function getPlatformSetup(platform) {
  const steps = {
    cloudflare: 'npm install -g wrangler && wrangler login',
    vercel:     'npm install -g vercel && vercel login',
    render:     'Connect GitHub repo at https://render.com → New Web Service',
    railway:    'npm install -g @railway/cli && railway login',
    docker:     'Make sure Docker + a VPS/server are ready',
  }
  return chalk.white(steps[platform] ?? '')
}
