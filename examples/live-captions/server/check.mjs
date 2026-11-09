#!/usr/bin/env node
// Protocol checker: connects like a glasses target, prints what arrives and verifies the main rules.
//   node check.mjs CODE [seconds] [http://localhost:8787]
// Exit code 0 when the stream and GET /latest behave as ../README.md describes.
import WebSocket from 'ws'

const [code, secs = '12', base = 'http://localhost:8787'] = process.argv.slice(2)
if (!code) {
  console.error('usage: node check.mjs ROOM_CODE [seconds] [server URL]')
  process.exit(2)
}
const problems = []
const seen = { partial: 0, final: 0, clear: 0, revised: 0 }
let lastSeq = 0
let prevPartial = ''

// 1. A wrong code must be refused
const refused = await new Promise(done => {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws?room=WRONG0')
  ws.on('close', c => done(c))
  ws.on('error', () => done(-1))
})
if (refused !== 4403) problems.push(`wrong room code closed with ${refused}, expected 4403`)
const bad = await fetch(base + '/latest?room=WRONG0')
if (bad.status !== 403) problems.push(`GET /latest with a wrong code returned ${bad.status}, expected 403`)

// 2. Stream: seq grows, partial text is the whole sentence, finals commit it
const ws = new WebSocket(base.replace(/^http/, 'ws') + '/ws?room=' + encodeURIComponent(code))
ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', target: 'check', lines: 3, cols: 30 })))
ws.on('message', data => {
  const m = JSON.parse(String(data))
  if (m.type === 'clear') {
    seen.clear++
    console.log('clear')
    return
  }
  if (m.type !== 'caption') return problems.push('unknown message type ' + m.type)
  if (typeof m.seq !== 'number' || typeof m.text !== 'string' || typeof m.final !== 'boolean') problems.push('bad caption ' + data)
  if (m.seq <= lastSeq) problems.push(`seq went from ${lastSeq} to ${m.seq}`)
  lastSeq = m.seq
  if (m.final) {
    seen.final++
    prevPartial = ''
  } else {
    seen.partial++
    // a revision: the new partial is not just the old one with words added
    if (prevPartial && !m.text.startsWith(prevPartial.split(' ').slice(0, -1).join(' '))) seen.revised++
    prevPartial = m.text
  }
  console.log(`${String(m.seq).padStart(4)} ${m.final ? 'FINAL  ' : 'partial'} ${m.repeat ? '(repeat) ' : ''}${m.text}`)
})
ws.on('close', c => c !== 1000 && c !== 1005 && problems.push('socket closed with ' + c))

await new Promise(r => setTimeout(r, Number(secs) * 1000))

// 3. HTTP fallback returns the newest message plus the recent final lines
const latest = await fetch(base + '/latest?room=' + encodeURIComponent(code)).then(r => r.json())
console.log('GET /latest ->', JSON.stringify(latest).slice(0, 200))
if (!['caption', 'clear'].includes(latest.type)) problems.push('GET /latest returned ' + JSON.stringify(latest))
if (latest.type === 'caption' && latest.seq !== lastSeq) problems.push(`/latest seq ${latest.seq} != stream seq ${lastSeq}`)
if (!Array.isArray(latest.recent)) problems.push('/latest has no recent[]')
ws.close(1000)

console.log('\nseen:', JSON.stringify(seen))
if (!seen.partial) problems.push('no partial captions')
if (!seen.final) problems.push('no final captions')
if (problems.length) {
  console.log('PROBLEMS:\n - ' + problems.join('\n - '))
  process.exit(1)
}
console.log('OK')
