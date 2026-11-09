// End-to-end test in the official Even Hub simulator, driven through its automation API.
//   npm install && npm run test:sim          (Node 22+: uses the built-in WebSocket client)
// Starts the example server (--demo) on PORT_SERVER (default 8797), builds the plugin in sim mode, serves it with
// vite preview on 5180, starts the simulator with --automation-port 9898, then checks what the glasses show (from the
// "[captions] frame ..." console lines of the sim build) and that gestures reach the server as actions.
// Then repeats the core checks with ?http=1 (GET /latest polling instead of the WebSocket).
// Results and glasses screenshots go to results/ (git-ignored). Everything it starts is stopped at the end.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const OUT = join(root, 'results')
const PORT = Number(process.env.PORT_SERVER || 8797)
const ROOM = 'SIMT42'
const SERVER = `http://127.0.0.1:${PORT}`
const SIM = 'http://127.0.0.1:9898'
const PAGE = `http://127.0.0.1:5180/?server=${encodeURIComponent(SERVER)}&room=${ROOM}`
mkdirSync(OUT, { recursive: true })

// The live box shows a status message instead of captions until text arrives
const CAPTION = String.raw`(?!Connecting|Waiting|Open this|No connection|Wrong)\S`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const procs = []
const node = (args, opts = {}) => {
  const p = spawn(process.execPath, args, { cwd: root, stdio: 'ignore', ...opts })
  procs.push(p)
  return p
}
const results = []
let failed = 0
function step(name, ok, extra = '') {
  results.push({ name, ok, extra })
  if (!ok) failed++
  console.log(ok ? 'PASS' : 'FAIL', name, extra ? String(extra).slice(0, 200) : '')
}
async function waitHttp(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fetch(url).then(r => r.ok, () => false)) return true
    await sleep(300)
  }
  throw new Error('no answer from ' + url)
}

// ------------------------------------------------------------ simulator automation API

let consoleId = -1
let seen = []
async function pullConsole() {
  const r = await fetch(`${SIM}/api/console${consoleId >= 0 ? '?since_id=' + consoleId : ''}`).then(r => r.json())
  for (const e of r.entries || []) {
    if (e.id <= consoleId) continue
    consoleId = e.id
    seen.push(e.message)
  }
}
async function waitLog(re, ms = 15000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    await pullConsole()
    const i = seen.findIndex(m => re.test(m))
    if (i >= 0) {
      const m = seen[i]
      seen = seen.slice(i + 1)
      return m
    }
    await sleep(200)
  }
  throw new Error('timeout waiting for ' + re)
}
const input = async action => {
  await fetch(`${SIM}/api/input`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
  await sleep(200)
}
async function shot(name) {
  await sleep(500) // debounce (120 ms) + bridge round trip
  const buf = Buffer.from(await (await fetch(`${SIM}/api/screenshot/glasses`)).arrayBuffer())
  writeFileSync(join(OUT, name + '.png'), buf)
}
function startSim(url) {
  spawnSync('taskkill', ['/IM', 'evenhub-simulator.exe', '/F'], { stdio: 'ignore' }) // Windows; harmless elsewhere
  const bin = join(root, 'node_modules/@evenrealities/evenhub-simulator/bin/index.js')
  node([bin, url, '--automation-port', '9898', '--no-glow'], { cwd: OUT })
  consoleId = -1
  seen = []
  return waitHttp(`${SIM}/api/ping`, 30000)
}

// ------------------------------------------------------------ observer: a plain protocol client on the server

const observed = []
function observe() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?room=${ROOM}`)
  ws.addEventListener('message', e => observed.push(JSON.parse(String(e.data))))
  return new Promise(r => ws.addEventListener('open', () => r(ws)))
}
async function waitObserved(pred, ms = 5000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const i = observed.findIndex(pred)
    if (i >= 0) return observed.splice(0, i + 1).pop()
    await sleep(100)
  }
  throw new Error('observer: nothing matched')
}

// ------------------------------------------------------------ run

async function check(name, fn) {
  try {
    const extra = await fn()
    step(name, true, extra)
  } catch (e) {
    step(name, false, e.message)
  }
}

try {
  node(['../server/server.mjs', '--demo', '--room', ROOM], { env: { ...process.env, PORT: String(PORT) } })
  await waitHttp(`${SERVER}/health`, 10000)
  const vite = join(root, 'node_modules/vite/bin/vite.js')
  const b = spawnSync(process.execPath, [vite, 'build', '--mode', 'sim'], { cwd: root, stdio: 'ignore' })
  if (b.status !== 0) throw new Error('vite build failed')
  node([vite, 'preview', '--port', '5180', '--strictPort'])
  await waitHttp('http://127.0.0.1:5180/', 15000)
  const obs = await observe()

  // ---- WebSocket pass
  await startSim(PAGE)
  await check('[ws] plugin starts with the simulator bridge', () => waitLog(/\[captions\] start .*"host":true/, 20000))
  await check('[ws] connects over WebSocket', () => waitLog(/\[captions\] link ws/, 15000))
  await check('[ws] partial captions reach the live box', () => waitLog(new RegExp(String.raw`\[captions\] frame [^|]*\|[^|]*\| ` + CAPTION), 15000))
  // A frame with older lines (dim, history) above the current sentence (bright, live)
  await check('[ws] history and live boxes both filled', () => waitLog(/\[captions\] frame [^|]*\| \S[^|]*\| \S+ \S+ \S+ \S+ \S+/, 40000))
  await shot('even-live-captions')
  await check('[ws] tap = repeat reaches the server', async () => {
    observed.length = 0
    await input('click')
    await waitLog(/\[captions\] action repeat via ws/, 4000)
    return (await waitObserved(m => m.repeat === true)).text
  })
  await check('[ws] swipe down = skip commits the sentence', async () => {
    observed.length = 0
    await input('down')
    await waitLog(/\[captions\] action skip via ws/, 4000)
    return (await waitObserved(m => m.type === 'caption' && m.final)).text
  })
  await check('[ws] swipe up = hide clears every screen', async () => {
    observed.length = 0
    await input('up')
    await waitLog(/\[captions\] action hide via ws/, 4000)
    await waitObserved(m => m.type === 'clear')
  })
  await check('[ws] system menu item 1 = repeat', async () => {
    await input('context_menu')
    await sleep(600)
    await input('click')
    return waitLog(/\[captions\] menu 1/, 4000)
  })
  await check('[ws] double tap asks to exit', async () => {
    await sleep(800)
    await input('double_click')
    return waitLog(/\[captions\] gesture DOUBLE_CLICK_EVENT/, 4000)
  })

  // ---- HTTP fallback pass
  await startSim(PAGE + '&http=1')
  await check('[http] polls GET /latest', () => waitLog(/\[captions\] link http/, 20000))
  await check('[http] captions arrive by polling', () => waitLog(new RegExp(String.raw`\[captions\] frame [^|]*HTTP[^|]*\|[^|]*\| ` + CAPTION), 20000))
  await shot('even-live-captions-http')
  await check('[http] tap = repeat goes over POST /action', async () => {
    observed.length = 0
    await input('click')
    await waitLog(/\[captions\] action repeat via http/, 4000)
    return (await waitObserved(m => m.repeat === true)).text
  })
  obs.close()
} catch (e) {
  step('run', false, e.message)
} finally {
  spawnSync('taskkill', ['/IM', 'evenhub-simulator.exe', '/F'], { stdio: 'ignore' })
  for (const p of procs) p.kill()
}
writeFileSync(join(OUT, 'sim-test.json'), JSON.stringify({ at: new Date().toISOString(), failed, results }, null, 2))
console.log(failed ? `${failed} failed` : 'all passed', '->', join(OUT, 'sim-test.json'))
process.exit(failed ? 1 : 0)
