// streamx-deploy/src/commands/test.js
import chalk from 'chalk'
import ora   from 'ora'
import axios from 'axios'
import { execSync, spawn } from 'child_process'
import fs   from 'fs-extra'

export async function cmdTest(options = {}) {
  const port   = options.port || 7070
  const testId = options.id   || 'tt0068646'
  const base   = `http://127.0.0.1:${port}`

  console.log(chalk.cyan(`\n🧪 Testing addon on port ${port}\n`))

  // Detect entry file
  const entry = detectEntry()
  if (!entry) {
    console.log(chalk.red('Cannot find addon entry file. Expected: src/index.js, index.js, or worker.js'))
    return
  }

  // Start the server
  const child = spawn('node', [entry], {
    env:   { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.on('data', d => process.stdout.write(chalk.gray(d.toString())))
  child.stderr.on('data', d => process.stderr.write(chalk.red(d.toString())))

  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 2000))

  const results = []
  let allPassed = true

  // ── Test 1: manifest.json ──────────────────────────────────────────────────
  results.push(await runTest('manifest.json', async () => {
    const { data } = await axios.get(`${base}/manifest.json`, { timeout: 5000 })
    if (!data.id)        throw new Error('Missing manifest.id')
    if (!data.name)      throw new Error('Missing manifest.name')
    if (!data.version)   throw new Error('Missing manifest.version')
    if (!Array.isArray(data.resources)) throw new Error('Missing manifest.resources')
    if (!Array.isArray(data.types))     throw new Error('Missing manifest.types')
    return `${data.name} v${data.version} · resources: ${data.resources.join(', ')}`
  }))

  // ── Test 2: /stream ────────────────────────────────────────────────────────
  let manifest = null
  try {
    manifest = (await axios.get(`${base}/manifest.json`, { timeout: 5000 })).data
  } catch {}

  const hasStream = manifest?.resources?.includes('stream')
  const testType  = manifest?.types?.includes('movie') ? 'movie' : manifest?.types?.[0]

  if (hasStream && testType) {
    const seriesId = `${testId}:1:1`
    const streamId = manifest.types.includes('series') && testType === 'series'
      ? seriesId : testId

    results.push(await runTest(`/stream/${testType}/${streamId}.json`, async () => {
      const { data } = await axios.get(
        `${base}/stream/${testType}/${encodeURIComponent(streamId)}.json`,
        { timeout: 10_000 }
      )
      if (!Array.isArray(data.streams)) throw new Error('Response missing { streams: [] }')
      const hasUrl = data.streams.some(s => s.url?.startsWith('http'))
      return `${data.streams.length} streams${hasUrl ? ' ✓ has .url' : ' ⚠ no .url (may be torrent-only)'}`
    }))
  }

  // ── Test 3: /subtitles (if supported) ─────────────────────────────────────
  if (manifest?.resources?.includes('subtitles') && testType) {
    results.push(await runTest(`/subtitles/${testType}/${testId}.json`, async () => {
      const { data } = await axios.get(
        `${base}/subtitles/${testType}/${testId}.json`,
        { timeout: 10_000 }
      )
      if (!Array.isArray(data.subtitles)) throw new Error('Response missing { subtitles: [] }')
      return `${data.subtitles.length} subtitles`
    }))
  }

  // ── Test 4: /catalog (if supported) ───────────────────────────────────────
  const cat = manifest?.catalogs?.[0]
  if (cat) {
    results.push(await runTest(`/catalog/${cat.type}/${cat.id}.json`, async () => {
      const { data } = await axios.get(
        `${base}/catalog/${cat.type}/${cat.id}.json`,
        { timeout: 10_000 }
      )
      if (!Array.isArray(data.metas)) throw new Error('Response missing { metas: [] }')
      return `${data.metas.length} items`
    }))
  }

  // ── Test 5: CORS headers ──────────────────────────────────────────────────
  results.push(await runTest('CORS headers', async () => {
    const { headers } = await axios.options(`${base}/manifest.json`, { timeout: 5000 })
    const origin = headers['access-control-allow-origin']
    if (!origin) throw new Error('Missing Access-Control-Allow-Origin header')
    return `Access-Control-Allow-Origin: ${origin}`
  }))

  // ── Print summary ─────────────────────────────────────────────────────────
  child.kill()
  console.log('')

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  console.log(chalk.bold(`Results: ${chalk.green(passed + ' passed')}  ${failed > 0 ? chalk.red(failed + ' failed') : ''}  / ${results.length} total`))

  if (failed > 0) {
    console.log(chalk.yellow('\n⚠ Fix the failing tests before deploying.'))
    process.exitCode = 1
  } else {
    console.log(chalk.green('\n✅ All tests passed! Ready to deploy:'))
    console.log(chalk.white('  streamx-deploy deploy'))
  }
}

async function runTest(name, fn) {
  const spin = ora(`  ${name}`).start()
  try {
    const detail = await fn()
    spin.succeed(chalk.green(`  ${name}`) + (detail ? chalk.gray(`  →  ${detail}`) : ''))
    return { name, ok: true }
  } catch (e) {
    spin.fail(chalk.red(`  ${name}  →  ${e.message}`))
    return { name, ok: false, error: e.message }
  }
}

function detectEntry() {
  for (const f of ['src/index.js', 'src/worker.js', 'index.js', 'worker.js', 'app.js']) {
    if (fs.existsSync(f)) return f
  }
  const pkg = fs.existsSync('package.json') ? fs.readJsonSync('package.json') : null
  return pkg?.main || null
}
