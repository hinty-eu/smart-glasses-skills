#!/usr/bin/env node
// Live captions example server: the single text source for every glasses target in ../.
// Protocol and how to run each target: ../README.md. Node 20+, one dependency (ws).
//
//   node server.mjs --demo                    scripted captions on a loop, no keys, no microphone
//   node server.mjs --browser-mic             serves /mic, a page that sends Web Speech API results
//   node server.mjs --stt deepgram            streaming STT; audio from /mic?pcm=1 or 16 kHz s16le mono on stdin
//   options: --room CODE (or ROOM env) fixes the room code, PORT env (default 8787), --host 0.0.0.0
import { createServer } from 'node:http'
import { randomInt } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB_DIR = resolve(HERE, '../web-glasses')
const args = process.argv.slice(2)
const has = name => args.includes(name)
const opt = name => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}

const PORT = Number(process.env.PORT || 8787)
const HOST = opt('--host') || '0.0.0.0'
const STT = opt('--stt')
const MIC = has('--browser-mic')
const DEMO = has('--demo') || (!MIC && !STT)
const RECENT_MAX = 20 // final lines kept for clients that connect later or poll /latest
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I, L, O, 0, 1

/** "k7m-pq4" -> "K7MPQ4": people type codes in lower case and with separators */
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const ROOM = normCode(opt('--room') || process.env.ROOM) || Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
if (has('--help')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n'))
  process.exit(0)
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a)

// ------------------------------------------------------------------ caption state

let seq = 0
let last = { type: 'clear' } // newest message sent to clients (what GET /latest returns)
let pending = null // current partial caption, replaced until a final arrives
let lastFinal = null // survives "hide" so "repeat" can bring the line back
const recent = [] // [{ seq, text }] newest last, cleared by "hide"
const clients = new Set()

/** One line of plain text: no control characters, single spaces */
const clean = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()

function broadcast(msg) {
  const data = JSON.stringify(msg)
  for (const c of clients) if (c.ws.readyState === 1) c.ws.send(data)
}

/** Partial results carry the whole current sentence (not a delta) and replace the previous partial */
function caption(text, final, extra = {}) {
  text = clean(text)
  if (!final && !text) return
  const msg = { type: 'caption', seq: ++seq, text, final: !!final, ...extra }
  last = msg
  if (final) {
    pending = null
    if (text && !extra.repeat) {
      lastFinal = msg
      recent.push({ seq: msg.seq, text })
      if (recent.length > RECENT_MAX) recent.shift()
    }
  } else {
    pending = msg
  }
  broadcast(msg)
}

function clearAll() {
  pending = null
  recent.length = 0
  last = { type: 'clear' }
  broadcast(last)
}

// ------------------------------------------------------------------ text sources

let externalAt = 0 // last time a /mic page, POST /source or STT produced text (pauses the demo)
let skipUntilFinal = false
let source = { skip() {} }

/** Text from the browser mic page, POST /source or an STT adapter */
function fromSource(text, final) {
  externalAt = Date.now()
  if (skipUntilFinal) {
    // "skip" committed the visible part; drop the rest of that sentence
    if (final) skipUntilFinal = false
    return
  }
  caption(text, final)
}

function onAction(action, from) {
  log(`action ${action} from ${from}`)
  if (action === 'hide') return clearAll()
  if (action === 'repeat') {
    if (lastFinal) caption(lastFinal.text, true, { repeat: true })
    return
  }
  if (action === 'skip') {
    if (DEMO && Date.now() - externalAt > 10000) return source.skip()
    if (pending) {
      caption(pending.text, true)
      skipUntilFinal = true
    }
  }
}

function demoSource() {
  const file = join(HERE, 'demo-script.txt')
  const lines = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
  let skip = false
  let wake = null
  const nap = ms =>
    new Promise(r => {
      const t = setTimeout(r, ms)
      wake = () => {
        clearTimeout(t)
        r()
      }
    })
  const tokens = line => line.split(' ').map(w => (w.match(/^\{([^|}]*)\|([^}]*)\}(.*)$/) || [null, null, w, '']).slice(1))
  async function run() {
    for (;;) {
      for (const line of lines) {
        const t = tokens(line) // [first | null, final, trailing punctuation]
        // Partial after word i: a revised word keeps its first guess for two more words
        const shown = i => t.slice(0, i + 1).map(([first, fin, tail], j) => (first !== null && i - j < 2 ? first : fin) + tail).join(' ')
        const corrected = n => t.slice(0, n).map(([, fin, tail]) => fin + tail).join(' ')
        skip = false
        let i = 0
        for (; i < t.length && !skip; i++) {
          while (Date.now() - externalAt < 10000) await nap(1000) // a live source is talking
          caption(shown(i), false)
          await nap(230 + randomInt(170)) // about 3 words per second
        }
        // "skip" commits the words shown so far and moves to the next line
        if (i > 0) caption(corrected(skip ? i : t.length), true)
        await nap(skip ? 600 : 1400)
      }
      await nap(3000)
      clearAll()
      await nap(1500)
    }
  }
  void run()
  log(`demo: ${lines.length} lines from demo-script.txt`)
  return {
    skip() {
      skip = true
      wake?.()
    },
  }
}

async function sttSource(name) {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('bad --stt name')
  const path = join(HERE, 'stt', name + '.mjs')
  if (!existsSync(path)) throw new Error(`no adapter stt/${name}.mjs`)
  const { createStt } = await import(new URL('stt/' + name + '.mjs', import.meta.url))
  const stt = createStt({
    env: process.env,
    language: process.env.STT_LANGUAGE || 'en',
    sampleRate: 16000,
    onText: (text, final) => fromSource(text, final),
    onError: e => log(`stt ${name}: ${e.message || e}`),
    log: m => log(`stt ${name}: ${m}`),
  })
  // Audio on stdin (ffmpeg, arecord, a WAV file): paced to real time so a file behaves like a microphone
  if (!process.stdin.isTTY) {
    const BYTES_PER_S = 32000
    const queue = []
    let head = Buffer.alloc(0)
    let started = 0
    let sent = 0
    let ended = false
    process.stdin.on('data', chunk => {
      if (head !== null) {
        head = Buffer.concat([head, chunk])
        if (head.length < 64 && head.subarray(0, 4).toString() === 'RIFF') return
        if (head.subarray(0, 4).toString() === 'RIFF') {
          const at = head.indexOf('data', 12)
          head = at > 0 ? head.subarray(at + 8) : head.subarray(44) // skip the WAV header
        }
        chunk = head
        head = null
      }
      for (let o = 0; o < chunk.length; o += 3200) queue.push(chunk.subarray(o, o + 3200))
    })
    process.stdin.on('end', () => (ended = true))
    const timer = setInterval(() => {
      if (!queue.length) {
        if (ended) {
          clearInterval(timer)
          log('stdin: end of audio')
        }
        return
      }
      if (!started) started = Date.now()
      const allowed = ((Date.now() - started) / 1000) * BYTES_PER_S + 3200
      while (queue.length && sent < allowed) {
        const b = queue.shift()
        sent += b.length
        stt.write(b)
      }
    }, 20)
    log('stt: reading 16 kHz s16le mono PCM from stdin')
  }
  return { skip() {}, write: b => stt.write(b), close: () => stt.close() }
}

// ------------------------------------------------------------------ HTTP

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const CORS = {
  'Access-Control-Allow-Origin': '*', // the Even WebView and pages on other origins poll /latest
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { ...CORS, 'Content-Type': type })
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

function readJson(req) {
  return new Promise(resolveBody => {
    let s = ''
    req.on('data', d => {
      s += d
      if (s.length > 16384) req.destroy()
    })
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(s || '{}'))
      } catch {
        resolveBody(null)
      }
    })
  })
}

function serveFile(res, root, rel) {
  const file = resolve(root, '.' + sep + rel)
  if (!file.startsWith(root + sep) && file !== root) return send(res, 404, { error: 'not found' })
  let path = file
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html')
  if (!existsSync(path)) return send(res, 404, { error: 'not found' })
  send(res, 200, readFileSync(path), TYPES[extname(path)] || 'application/octet-stream')
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x')
  const room = normCode(url.searchParams.get('room'))
  if (req.method === 'OPTIONS') return send(res, 204, '')
  if (url.pathname === '/health') return send(res, 200, { ok: true, mode: STT ? 'stt' : MIC ? 'browser-mic' : 'demo', clients: clients.size })
  if (url.pathname === '/latest' || url.pathname === '/action' || url.pathname === '/source') {
    if (room !== ROOM) return send(res, 403, { error: 'wrong room code' })
    if (url.pathname === '/latest') return send(res, 200, { ...last, recent })
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
    const body = await readJson(req)
    if (!body) return send(res, 400, { error: 'bad JSON' })
    if (url.pathname === '/action') {
      if (!['repeat', 'skip', 'hide'].includes(body.action)) return send(res, 400, { error: 'unknown action' })
      onAction(body.action, 'http')
    } else {
      fromSource(body.text, body.final !== false)
    }
    return send(res, 200, { ok: true })
  }
  if (url.pathname === '/mic') {
    if (!MIC && !STT) return send(res, 404, { error: 'start the server with --browser-mic or --stt' }, 'application/json')
    return serveFile(res, HERE, 'mic.html')
  }
  // Everything else: the web-glasses target, so a second screen can open http://HOST:PORT/
  if (req.method === 'GET') return serveFile(res, WEB_DIR, decodeURIComponent(url.pathname))
  send(res, 404, { error: 'not found' })
})

// ------------------------------------------------------------------ WebSocket /ws?room=CODE

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 })
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', 'http://x')
  if (url.pathname !== '/ws') return socket.destroy()
  wss.handleUpgrade(req, socket, head, ws => {
    if (normCode(url.searchParams.get('room')) !== ROOM) return ws.close(4403, 'wrong room code')
    const client = { ws, target: 'unknown', lines: 0, cols: 0, ip: req.socket.remoteAddress }
    clients.add(client)
    log(`client connected (${clients.size}) from ${client.ip}`)
    // Bring a new screen up to date: recent final lines with their original seq, then the current partial
    for (const r of recent) ws.send(JSON.stringify({ type: 'caption', seq: r.seq, text: r.text, final: true }))
    if (pending) ws.send(JSON.stringify(pending))
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Optional: raw 16 kHz s16le mono PCM for the STT adapter (from /mic?pcm=1 or a glasses microphone)
        if (source.write) source.write(Buffer.from(data))
        return
      }
      let m
      try {
        m = JSON.parse(String(data))
      } catch {
        return
      }
      if (m.type === 'hello') {
        client.target = String(m.target || 'unknown').slice(0, 32)
        client.lines = Number(m.lines) || 0
        client.cols = Number(m.cols) || 0
        log(`hello from ${client.target}: ${client.lines} lines x ${client.cols} columns`)
      } else if (m.type === 'action' && ['repeat', 'skip', 'hide'].includes(m.action)) {
        onAction(m.action, client.target)
      } else if (m.type === 'source') {
        fromSource(m.text, m.final !== false)
      }
    })
    ws.on('close', () => {
      clients.delete(client)
      log(`${client.target} disconnected (${clients.size})`)
    })
    ws.on('error', () => {})
  })
})

// Keep idle connections alive through proxies and tunnels
setInterval(() => {
  for (const c of clients) if (c.ws.readyState === 1) c.ws.ping()
}, 25000).unref()

// ------------------------------------------------------------------ start

try {
  if (STT) source = await sttSource(STT)
  else if (DEMO) source = demoSource()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

server.listen(PORT, HOST, () => {
  const mode = STT ? `stt (${STT})` : MIC ? 'browser microphone' : 'demo script'
  console.log(`\nLive captions server on port ${PORT}, source: ${mode}`)
  console.log(`\n  Room code: ${ROOM}\n`)
  console.log(`  Glasses page:  http://localhost:${PORT}/?room=${ROOM}`)
  console.log(`  WebSocket:     ws://localhost:${PORT}/ws?room=${ROOM}`)
  console.log(`  HTTP fallback: http://localhost:${PORT}/latest?room=${ROOM}`)
  if (MIC) console.log(`  Microphone:    http://localhost:${PORT}/mic?room=${ROOM}  (Chrome or Safari)`)
  if (STT) console.log(`  Microphone:    http://localhost:${PORT}/mic?room=${ROOM}&pcm=1  (streams PCM to ${STT})`)
  console.log('')
})

function shutdown() {
  source.close?.()
  for (const c of clients) c.ws.close(1001, 'server stopping')
  server.close()
  setTimeout(() => process.exit(0), 300).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
