#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════
//  streamx-deploy  —  Deploy StreamX/Stremio addons anywhere
//
//  Commands:
//    init              → scaffold new addon project
//    deploy            → deploy to chosen platform (interactive)
//    deploy --platform cloudflare|vercel|render|railway|docker
//    test              → run endpoint tests locally
//    validate [url]    → validate a live addon URL
//    publish           → submit to StreamX community registry
//    logs              → tail logs from deployed addon
//    info              → show deployment info for current project
// ═════════════════════════════════════════════════════════════════════════════

import { program } from 'commander'
import chalk from 'chalk'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

import { cmdInit }     from './commands/init.js'
import { cmdDeploy }   from './commands/deploy.js'
import { cmdTest }     from './commands/test.js'
import { cmdValidate } from './commands/validate.js'
import { cmdPublish }  from './commands/publish.js'

// ── Version from package.json ─────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))

// ── Banner ────────────────────────────────────────────────────────────────────
if (process.argv.length < 3 || process.argv[2] === '--help') {
  console.log(chalk.cyan(`
  ╔══════════════════════════════════════╗
  ║      StreamX Deploy  v${pkg.version}          ║
  ║  Deploy addons to any platform free  ║
  ╚══════════════════════════════════════╝
`))
}

program
  .name('streamx-deploy')
  .version(pkg.version)
  .description('Deploy StreamX/Stremio addons to any hosting platform')

// ── streamx-deploy init ───────────────────────────────────────────────────────
program
  .command('init')
  .description('Scaffold a new StreamX addon project')
  .action(cmdInit)

// ── streamx-deploy deploy ─────────────────────────────────────────────────────
program
  .command('deploy')
  .description('Deploy addon to your chosen platform')
  .option('-p, --platform <platform>',
    'Platform: cloudflare | vercel | render | railway | docker')
  .option('-e, --env <key=value>',
    'Set environment variable (can be used multiple times)', collectEnv, {})
  .option('--prod', 'Deploy to production environment')
  .option('--no-verify', 'Skip live endpoint verification after deploy')
  .action(cmdDeploy)

// ── streamx-deploy test ───────────────────────────────────────────────────────
program
  .command('test')
  .description('Test addon endpoints locally')
  .option('-p, --port <number>', 'Port to start local server on', '7070')
  .option('-i, --id <imdbId>',   'IMDB ID for stream test', 'tt0068646')
  .action(cmdTest)

// ── streamx-deploy validate ───────────────────────────────────────────────────
program
  .command('validate [url]')
  .description('Validate a live addon manifest URL')
  .action(cmdValidate)

// ── streamx-deploy publish ────────────────────────────────────────────────────
program
  .command('publish')
  .description('Submit addon to StreamX community registry')
  .option('-u, --url <url>', 'Deployed addon manifest URL')
  .action(cmdPublish)

// ── streamx-deploy logs ───────────────────────────────────────────────────────
program
  .command('logs')
  .description('Tail logs from deployed addon')
  .action(async () => {
    const cfg = loadConfig()
    if (!cfg) return
    const { tailLogs } = await import(`./adapters/${cfg.platform}.js`)
    tailLogs(cfg)
  })

// ── streamx-deploy info ───────────────────────────────────────────────────────
program
  .command('info')
  .description('Show deployment info for current project')
  .action(async () => {
    const cfg = loadConfig()
    if (!cfg) { console.log(chalk.yellow('No .streamx-deploy.json found. Run: streamx-deploy init')); return }
    console.log(chalk.cyan('\nCurrent deployment config:'))
    console.log(chalk.white(JSON.stringify(cfg, null, 2)))
  })

program.parseAsync()

// ── Helpers ───────────────────────────────────────────────────────────────────
function collectEnv(val, prev) {
  const [k, v] = val.split('=')
  return { ...prev, [k]: v }
}

export function loadConfig() {
  const path = resolve('.streamx-deploy.json')
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8'))
}
