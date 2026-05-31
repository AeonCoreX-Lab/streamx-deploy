// streamx-deploy/src/commands/deploy.js
import { select, confirm } from '@inquirer/prompts'
import chalk  from 'chalk'
import ora    from 'ora'
import fs     from 'fs-extra'
import path   from 'path'
import axios  from 'axios'

const PLATFORMS = ['cloudflare', 'vercel', 'render', 'railway', 'docker']

export async function cmdDeploy(options) {
  console.log(chalk.cyan('\n🚀 StreamX Deploy\n'))

  // Load project config
  const cfg = loadConfig()
  if (!cfg) {
    console.log(chalk.red('No .streamx-deploy.json found. Run: streamx-deploy init'))
    return
  }

  // Determine platform
  let platform = options.platform || cfg.platform
  if (!platform || !PLATFORMS.includes(platform)) {
    platform = await select({
      message: 'Choose hosting platform:',
      choices: [
        { value: 'cloudflare', name: '☁️  Cloudflare Workers  (free, global CDN)' },
        { value: 'vercel',     name: '▲  Vercel              (free, serverless)' },
        { value: 'render',     name: '⚙️  Render              (free tier)' },
        { value: 'railway',    name: '🚂 Railway             ($5 free credit/month)' },
        { value: 'docker',     name: '🐳 Docker / VPS        (self-hosted)' },
      ]
    })
  }

  // Load the platform adapter
  const adapterPath = new URL(`../adapters/${platform}.js`, import.meta.url)
  const adapter     = await import(adapterPath)

  // Pre-deploy check
  const preOk = await adapter.preCheck(cfg)
  if (!preOk) return

  // Deploy
  const spin = ora(`Deploying to ${platform}...`).start()
  let deployedUrl

  try {
    deployedUrl = await adapter.deploy(cfg, options, (msg) => { spin.text = msg })
    spin.succeed(chalk.green(`Deployed! → ${deployedUrl}`))
  } catch (e) {
    spin.fail(chalk.red(`Deploy failed: ${e.message}`))
    if (e.hint) console.log(chalk.yellow(`Hint: ${e.hint}`))
    return
  }

  // Save deployed URL back to config
  cfg.deployedUrl = deployedUrl
  cfg.platform    = platform
  cfg.deployedAt  = new Date().toISOString()
  fs.writeJsonSync('.streamx-deploy.json', cfg, { spaces: 2 })

  // Verify endpoint (unless --no-verify)
  if (options.verify !== false) {
    const vSpin = ora('Verifying live endpoint...').start()
    try {
      const manifestUrl = deployedUrl.endsWith('/manifest.json')
        ? deployedUrl
        : `${deployedUrl.replace(/\/$/, '')}/manifest.json`

      const res  = await axios.get(manifestUrl, { timeout: 15_000 })
      const data = res.data
      if (!data.id || !data.name) throw new Error('Invalid manifest shape')
      vSpin.succeed(chalk.green(`Live ✓  ${data.name} v${data.version}`))

      // Print install instructions
      printInstallGuide(manifestUrl, data)
    } catch (e) {
      vSpin.warn(chalk.yellow(`Verification failed: ${e.message}. Your addon may need a moment to start.`))
    }
  }
}

function printInstallGuide(manifestUrl, manifest) {
  console.log(`
${chalk.cyan('Install in StreamX:')}
  Settings → Addons → 🔗 → paste:
  ${chalk.white(manifestUrl)}

${chalk.cyan('Install deeplink:')}
  ${chalk.gray(`streamx://install-addon?url=${encodeURIComponent(manifestUrl)}`)}

${chalk.cyan('Submit to registry:')}
  ${chalk.white('streamx-deploy publish')}
`)
}

function loadConfig() {
  if (!fs.existsSync('.streamx-deploy.json')) return null
  return fs.readJsonSync('.streamx-deploy.json')
}
