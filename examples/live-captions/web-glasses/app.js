// Live captions for a glasses browser (Meta Ray-Ban Display Web App, Chrome on INMO Air3, a browser sideloaded on
// RayNeo X3 Pro) or any second screen.
// Protocol: ../README.md. No build step, no dependencies: serve this folder over HTTPS (glasses) or open it from the
// example server at http://HOST:8787/ (it serves this folder).
//
// URL parameters: ?room=CODE  ?server=https://captions.example.com  ?lines=4 (0 = as many as fit)  ?size=40 (px)
//                 ?http=1 (skip the WebSocket, poll GET /latest)  ?buttons=0 (no on-screen buttons, keys map directly)
// Input: the captions screen has Repeat, Skip and Hide buttons. The glasses' spatial navigation moves focus between
// them with the arrow keys and Enter presses the focused one (Meta's guidance: let the browser own directional focus
// and activation; https://wearables.developer.meta.com/docs/develop/webapps/build/input-and-navigation/). So with
// buttons this page handles no arrow or Enter keys itself. With ?buttons=0 nothing is focusable, and the keys map
// directly: Enter = repeat, ArrowDown/ArrowRight = skip, ArrowUp/ArrowLeft = hide. Back leaves the room (Meta calls
// history.back(); Escape on a desktop) and is never trapped.
import { applyMessage, applySnapshot, columns, createState, layout } from './fit.js'
import { CaptionLink } from './link.js'

const q = new URLSearchParams(location.search)
const $ = id => document.getElementById(id)
const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const store = {
  get: k => {
    try {
      return localStorage.getItem(k) || ''
    } catch {
      return ''
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      // storage can be full or disabled; the URL parameters still work
    }
  },
}
const sameOrigin = /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:8787'
const cfg = {
  server: (q.get('server') || store.get('captions.server') || sameOrigin).replace(/\/+$/, ''),
  room: normCode(q.get('room') || store.get('captions.room')),
  // Four lines by default: a full screen of text in front of one eye is tiring to read
  lines: q.has('lines') ? Number(q.get('lines')) || 0 : 4,
  forceHttp: q.get('http') === '1',
  buttons: q.get('buttons') !== '0',
}
$('controls').hidden = !cfg.buttons
if (Number(q.get('size')) > 0) document.documentElement.style.setProperty('--cap-size', Number(q.get('size')) + 'px')

const state = createState()
let screen = 'entry'
let linkStatus = 'connecting'
let flashText = ''
let flashTimer = 0

// ------------------------------------------------------------------ connection (link.js: WebSocket, GET /latest fallback)

const link = new CaptionLink({
  message: m => applyMessage(state, m) && render(),
  snapshot: m => applySnapshot(state, m) && render(),
  status: s => {
    if (s === 'wrong-code') return showEntry('Wrong room code. Check the code the server printed.')
    linkStatus = s
    renderStatus()
  },
  open: l => {
    const m = metrics()
    l.send({ type: 'hello', target: 'web', lines: m.lines, cols: m.cols })
  },
}, { forceHttp: cfg.forceHttp })

// ------------------------------------------------------------------ rendering

let metricsCache = null
function metrics() {
  if (metricsCache) return metricsCache
  const box = $('cap')
  const cs = getComputedStyle(box)
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.22
  const width = Math.max(40, box.clientWidth - 4) // a few px of slack for rounding between canvas and layout
  const fit = Math.max(1, Math.floor(box.clientHeight / lineH))
  const widths = new Map()
  const measure = s => {
    let w = widths.get(s)
    if (w === undefined) {
      w = ctx.measureText(s).width
      if (widths.size > 4000) widths.clear()
      widths.set(s, w)
    }
    return w
  }
  metricsCache = { width, lines: cfg.lines ? Math.min(cfg.lines, fit) : fit, measure, cols: columns(width, measure) }
  return metricsCache
}

function render() {
  if (screen !== 'captions') return
  const m = metrics()
  const lines = layout(state, { maxWidth: m.width, maxLines: m.lines, measure: m.measure })
  $('cap').replaceChildren(
    ...lines.map(l => {
      const d = document.createElement('div')
      d.className = l.partial ? 'line partial' : 'line'
      d.dir = 'auto' // Arabic and Hebrew lines run right to left
      d.textContent = l.text
      return d
    }),
  )
}

function renderStatus() {
  const label = { connecting: 'connecting', live: link.mode === 'http' ? 'live (HTTP)' : 'live', offline: 'offline, retrying' }[linkStatus] || linkStatus
  $('status').textContent = flashText || `${linkStatus === 'live' ? '●' : '○'} ${cfg.room}  ${label}`
}

function flash(text) {
  flashText = text
  renderStatus()
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashText = ''
    renderStatus()
  }, 1200)
}

window.addEventListener('resize', () => {
  metricsCache = null
  render()
})
document.fonts?.ready.then(() => {
  metricsCache = null
  render()
})

// ------------------------------------------------------------------ screens and input

function showEntry(error = '') {
  link.stop()
  screen = 'entry'
  $('captions').hidden = true
  $('entry').hidden = false
  $('code').value = cfg.room
  $('server').value = cfg.server
  $('error').textContent = error
}

function showCaptions() {
  screen = 'captions'
  $('entry').hidden = true
  $('captions').hidden = false
  metricsCache = null
  Object.assign(state, createState())
  render()
  renderStatus()
  // Focus the first button so Enter works at once; spatial navigation takes it from there
  if (cfg.buttons) $('repeat').focus({ preventScroll: true })
  link.start(cfg.server, cfg.room)
}

$('entry').addEventListener('submit', e => {
  e.preventDefault()
  const room = normCode($('code').value)
  if (room.length < 4) {
    $('error').textContent = 'Enter the room code the server printed.'
    return
  }
  cfg.room = room
  cfg.server = ($('server').value.trim() || sameOrigin).replace(/\/+$/, '')
  store.set('captions.room', cfg.room)
  store.set('captions.server', cfg.server)
  history.pushState({ screen: 'captions' }, '')
  showCaptions()
})

// Back on Meta Ray-Ban Display is history.back(), never a key: leave the room and show the entry screen
window.addEventListener('popstate', e => {
  if (e.state?.screen === 'captions' && cfg.room) showCaptions()
  else showEntry()
})

// Letter shortcuts for a desktop keyboard; glasses never send them, so they cannot fight spatial navigation
const LETTER_ACTIONS = { r: 'repeat', s: 'skip', h: 'hide' }
// Only without buttons: nothing is focusable, so these keys replace no browser behaviour except scrolling
const DIRECT_ACTIONS = { Enter: 'repeat', ' ': 'repeat', ArrowDown: 'skip', ArrowRight: 'skip', ArrowUp: 'hide', ArrowLeft: 'hide' }
document.addEventListener('keydown', e => {
  if (screen !== 'captions' || e.defaultPrevented || e.repeat) return
  if (e.key === 'Escape') {
    e.preventDefault()
    history.back()
    return
  }
  const action = LETTER_ACTIONS[e.key] || (cfg.buttons ? null : DIRECT_ACTIONS[e.key])
  if (!action) return // with buttons, arrows and Enter stay with the browser: focus moves, Enter clicks
  e.preventDefault()
  doAction(action)
})
for (const id of ['repeat', 'skip', 'hide']) $(id).addEventListener('click', () => doAction(id)) // Enter, pinch, tap
$('cap').addEventListener('click', () => doAction('repeat')) // touch screens and mice

function doAction(action) {
  link.action(action)
  if (action === 'hide' && applyMessage(state, { type: 'clear' })) render() // do not wait for the server's clear
  flash({ repeat: 'Repeat', skip: 'Skip', hide: 'Hidden' }[action])
}

document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && link.wake())
window.addEventListener('online', () => link.wake())

// Start: straight into the captions when the URL or storage has a room code
history.replaceState({ screen: 'entry' }, '')
if (cfg.room && q.get('room')) {
  history.pushState({ screen: 'captions' }, '')
  showCaptions()
} else {
  showEntry()
}
