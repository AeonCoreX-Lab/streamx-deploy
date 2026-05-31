// streamx-deploy/src/commands/validate.js
import chalk from 'chalk'
import ora   from 'ora'
import axios from 'axios'
import fs    from 'fs-extra'

export async function cmdValidate(url) {
  // Use URL from args, or from project config, or prompt
  if (!url) {
    const cfg = fs.existsSync('.streamx-deploy.json') ? fs.readJsonSync('.streamx-deploy.json') : null
    url = cfg?.deployedUrl
  }
  if (!url) {
    console.log(chalk.red('Provide a URL: streamx-deploy validate https://my-addon.workers.dev'))
    return
  }

  const manifestUrl = url.endsWith('/manifest.json') ? url : `${url.replace(/\/$/, '')}/manifest.json`
  console.log(chalk.cyan(`\n🔍 Validating: ${manifestUrl}\n`))

  let passed = 0, failed = 0

  async function check(label, fn) {
    const spin = ora(`  ${label}`).start()
    try {
      const result = await fn()
      spin.succeed(chalk.green(`  ${label}`) + (result ? chalk.gray(`  →  ${result}`) : ''))
      passed++
    } catch (e) {
      spin.fail(chalk.red(`  ${label}  →  ${e.message}`))
      failed++
    }
  }

  // 1. HTTPS
  await check('Uses HTTPS', async () => {
    if (!manifestUrl.startsWith('https://')) throw new Error('HTTP not allowed — must use HTTPS')
    return 'ok'
  })

  // 2. Manifest reachable
  let manifest = null
  await check('manifest.json reachable', async () => {
    const { data } = await axios.get(manifestUrl, { timeout: 10_000 })
    manifest = data
    return `HTTP 200`
  })

  if (manifest) {
    // 3. Required fields
    await check('manifest.id present',       async () => { if (!manifest.id)        throw new Error('Missing id')        ; return manifest.id })
    await check('manifest.name present',     async () => { if (!manifest.name)      throw new Error('Missing name')      ; return manifest.name })
    await check('manifest.version present',  async () => { if (!manifest.version)   throw new Error('Missing version')   ; return manifest.version })
    await check('manifest.resources valid',  async () => { if (!manifest.resources?.length) throw new Error('Empty resources'); return manifest.resources.join(', ') })
    await check('manifest.types valid',      async () => { if (!manifest.types?.length)     throw new Error('Empty types')    ; return manifest.types.join(', ') })

    // 4. ID format
    await check('ID format community.*.*',   async () => {
      if (!/^community\.[a-z0-9_-]+\.[a-z0-9_-]+$/.test(manifest.id))
        throw new Error(`Expected community.author.name, got: ${manifest.id}`)
      return 'valid'
    })

    // 5. Stream test
    const hasStream = manifest.resources.includes('stream')
    const testType  = manifest.types?.includes('movie') ? 'movie' : manifest.types?.[0]
    if (hasStream && testType) {
      const base   = manifestUrl.replace('/manifest.json', '')
      const testId = 'tt0068646'
      await check(`/stream/${testType}/${testId}.json`, async () => {
        const { data } = await axios.get(`${base}/stream/${testType}/${testId}.json`, { timeout: 12_000 })
        if (!Array.isArray(data.streams)) throw new Error('Missing { streams: [] }')
        return `${data.streams.length} streams`
      })
    }

    // 6. CORS
    await check('CORS headers', async () => {
      const { headers } = await axios.options(manifestUrl, { timeout: 5000 })
      if (!headers['access-control-allow-origin']) throw new Error('Missing CORS header')
      return headers['access-control-allow-origin']
    })
  }

  console.log(`\n${chalk.bold(`Results: ${chalk.green(passed + ' passed')}  ${failed > 0 ? chalk.red(failed + ' failed') : ''}`)}\n`)
  if (failed > 0) process.exitCode = 1
}

// ── publish.js ────────────────────────────────────────────────────────────────
export async function cmdPublish(options) {
  let url = options?.url

  if (!url) {
    const cfg = fs.existsSync('.streamx-deploy.json') ? fs.readJsonSync('.streamx-deploy.json') : null
    url = cfg?.deployedUrl
  }
  if (!url) {
    console.log(chalk.red('No deployed URL found. Deploy first: streamx-deploy deploy'))
    return
  }

  const manifestUrl = url.endsWith('/manifest.json') ? url : `${url.replace(/\/$/, '')}/manifest.json`

  // Fetch manifest
  let manifest
  try {
    manifest = (await axios.get(manifestUrl, { timeout: 10_000 })).data
  } catch (e) {
    console.log(chalk.red(`Cannot reach ${manifestUrl}: ${e.message}`))
    return
  }

  // Build registry entry
  const entry = {
    manifest: {
      id:          manifest.id,
      version:     manifest.version,
      name:        manifest.name,
      description: manifest.description || '',
      logo:        manifest.logo        || '',
      types:       manifest.types       || [],
      resources:   manifest.resources   || [],
      idPrefixes:  manifest.idPrefixes  || ['tt'],
      catalogs:    manifest.catalogs    || [],
    },
    transportUrl: manifestUrl,
    kind:  'HTTP_ENDPOINT',
    flags: { official: false, verified: false, nsfw: false }
  }

  console.log(chalk.cyan('\n📦 Your registry entry:\n'))
  console.log(chalk.white(JSON.stringify(entry, null, 2)))

  const REGISTRY_URL = 'https://github.com/YOUR_GITHUB_USERNAME/streamx-registry'
  const prUrl = `${REGISTRY_URL}/compare/main...main?quick_pull=1` +
    `&title=${encodeURIComponent(`[Addon] ${manifest.name}`)}` +
    `&body=${encodeURIComponent('## Addon Submission\n\n```json\n' + JSON.stringify(entry, null, 2) + '\n```')}`

  console.log(chalk.cyan('\n📤 To submit to StreamX Community Registry:\n'))
  console.log('  1. Fork the registry repo')
  console.log('  2. Add the JSON above to registry.json')
  console.log('  3. Open a Pull Request — the bot will auto-validate')
  console.log('')
  console.log(chalk.white(`  Registry: ${REGISTRY_URL}`))
  console.log(chalk.gray(`\n  Or use this pre-filled PR link:\n  ${prUrl}`))
}
