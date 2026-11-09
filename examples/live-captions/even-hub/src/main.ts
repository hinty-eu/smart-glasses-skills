/**
 * Live captions on Even Realities G2 (Even Hub plugin).
 *
 * The plugin only displays. Captions come from the example server (../server): WebSocket first, GET /latest polling
 * when the WebSocket does not come up in the Even WebView. The room code and server address are typed on the
 * phone page (the plugin's WebView page inside the Even app), or passed as ?server=...&room=... in the simulator.
 *
 * Glasses input (temple touchpads or the R1 ring) -> shared actions:
 *   tap = repeat, swipe down = skip, swipe up or press and hold = hide, double tap = exit (system dialog).
 *   The system menu has Repeat, Skip, Hide.
 */
import {
  DeviceConnectType,
  OsEventTypeList,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { applyMessage, applySnapshot, columns, createState } from '../../web-glasses/fit.js'
import { CaptionLink } from '../../web-glasses/link.js'
import { BOXES, Glasses, HISTORY, LIVE, STATUS, inner, type Frame } from './glasses'
import { block, clean, fitLines, leftRight } from './text'
import { getTextWidth } from '@evenrealities/pretext'

type Action = 'repeat' | 'skip' | 'hide'
type Status = 'idle' | 'connecting' | 'live' | 'offline' | 'wrong-code'

const q = new URLSearchParams(location.search)
const DEBUG = import.meta.env.MODE !== 'production' || q.has('debug')
const log = (...a: unknown[]) => DEBUG && console.log('[captions] ' + a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
const normCode = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const sleep = (ms: number) => new Promise<null>(r => setTimeout(() => r(null), ms))
const within = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> => Promise.race([p.catch(() => fallback), sleep(ms).then(() => fallback)])

/** The Even bridge, or null in a plain browser (phone page preview only) */
async function connectBridge(): Promise<EvenAppBridge | null> {
  const bridge = await within(waitForEvenAppBridge(), 4000, null as EvenAppBridge | null)
  if (!bridge) return null
  if ((window as unknown as { flutter_inappwebview?: unknown }).flutter_inappwebview) return bridge
  // The simulator has no flutter_inappwebview: the bridge counts if the host answers a call
  return (await within(bridge.getDeviceInfo().then(() => true), 2500, false)) ? bridge : null
}

async function main() {
  const bridge = await connectBridge()
  const glasses = new Glasses(bridge)
  const state = createState()
  let status: Status = 'idle'
  let flash = ''
  let flashTimer: ReturnType<typeof setTimeout> | undefined

  // ------------------------------------------------------------ settings: URL (simulator) > Even storage > build default

  const kvGet = async (k: string): Promise<string> => {
    const v = bridge ? await within(bridge.getLocalStorage(k), 1500, '') : ''
    if (v) return v
    try {
      return localStorage.getItem(k) || ''
    } catch {
      return ''
    }
  }
  const kvSet = (k: string, v: string) => {
    if (bridge) void within(bridge.setLocalStorage(k, v), 3000, false) // survives a killed Android WebView
    try {
      localStorage.setItem(k, v)
    } catch {
      // ignore
    }
  }
  const cfg = {
    server: (q.get('server') || (await kvGet('captions.server')) || (import.meta.env.VITE_SERVER_URL as string | undefined) || '').replace(/\/+$/, ''),
    room: normCode(q.get('room') || (await kvGet('captions.room'))),
  }

  // ------------------------------------------------------------ render

  let lastLogged = ''
  function render() {
    const hw = inner(HISTORY)
    const lw = inner(LIVE)
    let dropped = 0
    const c = (s: string) => {
      const r = clean(s)
      dropped += r.dropped
      return r.text
    }
    const finals = state.finals.map(c).filter(Boolean)
    const partial = c(state.partial)
    // Subtitle style: the newest final stays bright in the live box until the next sentence starts
    const live = partial || finals[finals.length - 1] || ''
    const older = partial ? finals : finals.slice(0, -1)
    let message = ''
    if (!cfg.room || !cfg.server) message = 'Open this plugin on your phone and enter the server and room code.'
    else if (status === 'wrong-code') message = 'Wrong room code. Check it on your phone.'
    else if (!live && status === 'connecting') message = 'Connecting...'
    else if (!live && status === 'offline') message = 'No connection, retrying...'
    else if (!live) message = 'Waiting for speech...'
    const right =
      flash ||
      (dropped ? 'some characters not shown' : status === 'live' ? `● ${cfg.room}${link.mode === 'http' ? ' HTTP' : ''}` : status === 'offline' ? 'offline' : '')
    const frame: Frame = {
      status: leftRight('Live captions', right, inner(STATUS).w),
      history: message ? '' : block(older.flatMap(t => fitLines(t, hw.w)), hw.lines, hw.w, 'bottom'),
      live: block(fitLines(message || live, lw.w), lw.lines, lw.w, 'top'),
    }
    glasses.show(frame)
    mirror(frame)
    if (DEBUG) {
      // One line per new frame; scripts/sim-test.mjs reads these from the simulator console
      const line = BOXES.map(b => (frame[b.name] || '').replace(/\s+/g, ' ').trim()).join(' | ')
      if (line !== lastLogged) log('frame ' + line)
      lastLogged = line
    }
  }

  function showFlash(text: string) {
    flash = text
    clearTimeout(flashTimer)
    flashTimer = setTimeout(() => {
      flash = ''
      render()
    }, 1200)
    render()
  }

  // ------------------------------------------------------------ link to the caption server

  const link = new CaptionLink(
    {
      message: m => applyMessage(state, m) && render(),
      snapshot: m => applySnapshot(state, m) && render(),
      status: s => {
        if (s !== status) log('status', s)
        status = s
        render()
        phoneStatus()
      },
      open: l => {
        const lines = inner(HISTORY).lines + inner(LIVE).lines
        l.send({ type: 'hello', target: 'even-g2', lines, cols: columns(inner(LIVE).w - 6, getTextWidth) })
      },
    },
    { forceHttp: q.get('http') === '1', log: m => log(m) },
  )

  function connect() {
    if (!cfg.room || !cfg.server) {
      status = 'idle'
      render()
      return
    }
    Object.assign(state, createState())
    link.start(cfg.server, cfg.room)
  }

  function act(action: Action) {
    if (!link.isLive()) return showFlash('not connected')
    const via = link.action(action)
    log(`action ${action} via ${via}`)
    if (action === 'hide' && applyMessage(state, { type: 'clear' })) render() // do not wait for the server's clear
    showFlash({ repeat: 'Repeat', skip: 'Skip', hide: 'Hidden' }[action])
  }

  // ------------------------------------------------------------ glasses events

  let exitArmedAt = 0
  const exitArmed = () => exitArmedAt > 0 && Date.now() - exitArmedAt < 60000
  const lastAt = new Map<number, number>()

  /** CLICK_EVENT is 0 and is dropped on the wire: an event envelope without eventType is a tap */
  const typeOf = (env?: { eventType?: unknown }): OsEventTypeList | null => {
    if (!env) return null
    const t = env.eventType
    if (t === undefined || t === null) return OsEventTypeList.CLICK_EVENT
    if (typeof t === 'number') return t as OsEventTypeList
    return OsEventTypeList.fromJson(t) ?? null
  }
  const GESTURES = [
    OsEventTypeList.CLICK_EVENT,
    OsEventTypeList.DOUBLE_CLICK_EVENT,
    OsEventTypeList.LONG_PRESS_EVENT,
    OsEventTypeList.SCROLL_TOP_EVENT,
    OsEventTypeList.SCROLL_BOTTOM_EVENT,
  ]

  function onEvent(ev: EvenHubEvent) {
    if (ev.audioEvent) return
    if (ev.menuItemClickEvent) {
      const id = ev.menuItemClickEvent.itemID
      log('menu', id)
      if (id === 1) act('repeat')
      else if (id === 2) act('skip')
      else if (id === 3) act('hide')
      return
    }
    // Taps and double taps arrive as sysEvent, swipes as textEvent (on the capture container) or listEvent
    const types = [typeOf(ev.sysEvent), typeOf(ev.textEvent), typeOf(ev.listEvent)].filter((t): t is OsEventTypeList => t !== null)
    if (!types.length) return
    const has = (t: OsEventTypeList) => types.includes(t)
    const main = types.find(t => GESTURES.includes(t)) ?? types[0]
    if (main === OsEventTypeList.IMU_DATA_REPORT) return
    if (GESTURES.includes(main)) {
      // One gesture can arrive twice about 50-100 ms apart; swipes are throttled
      const now = Date.now()
      const gap = main === OsEventTypeList.SCROLL_TOP_EVENT || main === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 300 : 600
      if (now - (lastAt.get(main) || 0) < gap) return
      lastAt.set(main, now)
      log('gesture', OsEventTypeList[main])
    }
    if (has(OsEventTypeList.DOUBLE_CLICK_EVENT)) {
      // Double tap on the root page opens the system exit dialog (Even review checks this)
      exitArmedAt = Date.now()
      if (bridge) void bridge.shutDownPageContainer(1)
      return
    }
    if (has(OsEventTypeList.SYSTEM_EXIT_EVENT) || has(OsEventTypeList.ABNORMAL_EXIT_EVENT)) {
      log('exit')
      link.stop()
      glasses.stop()
      return
    }
    if (has(OsEventTypeList.FOREGROUND_ENTER_EVENT)) {
      if (exitArmed()) return // events are inverted while the exit dialog is up
      link.wake()
      glasses.repaint()
      return
    }
    if (has(OsEventTypeList.FOREGROUND_EXIT_EVENT)) {
      if (exitArmed()) {
        exitArmedAt = 0 // "No" in the exit dialog: still running, draw our page again
        glasses.repaint()
      }
      return
    }
    if (main === OsEventTypeList.CLICK_EVENT) return act('repeat')
    if (main === OsEventTypeList.SCROLL_BOTTOM_EVENT) return act('skip')
    if (main === OsEventTypeList.SCROLL_TOP_EVENT || main === OsEventTypeList.LONG_PRESS_EVENT) return act('hide')
  }

  if (bridge) {
    bridge.onEvenHubEvent(onEvent)
    let prev: string | null = null
    bridge.onDeviceStatusChanged(st => {
      const c = st?.connectType ?? null
      if (c === DeviceConnectType.Connected && prev && prev !== DeviceConnectType.Connected) glasses.repaint()
      prev = c
    })
  }

  // ------------------------------------------------------------ phone page (the WebView DOM, visible in the Even app)

  const $ = (id: string) => document.getElementById(id) as HTMLElement
  const serverInput = $('server') as HTMLInputElement
  const roomInput = $('room') as HTMLInputElement
  serverInput.value = cfg.server
  roomInput.value = cfg.room
  $('noBridge').hidden = !!bridge
  function phoneStatus() {
    $('status').textContent =
      { idle: 'Enter the server and room code', connecting: 'Connecting...', live: link.mode === 'http' ? 'Connected (HTTP polling)' : 'Connected', offline: 'No connection, retrying', 'wrong-code': 'Wrong room code' }[status]
  }
  function mirror(f: Frame) {
    $('mirror').textContent = BOXES.map(b => f[b.name] || '').join('\n')
  }
  ;($('form') as HTMLFormElement).addEventListener('submit', e => {
    e.preventDefault()
    cfg.server = serverInput.value.trim().replace(/\/+$/, '')
    cfg.room = normCode(roomInput.value)
    roomInput.value = cfg.room
    kvSet('captions.server', cfg.server)
    kvSet('captions.room', cfg.room)
    connect()
  })
  for (const a of ['repeat', 'skip', 'hide'] as const) $('b-' + a).addEventListener('click', () => act(a))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && link.wake())
  window.addEventListener('online', () => link.wake())

  log('start', { host: !!bridge, server: cfg.server || '-', room: cfg.room || '-' })
  phoneStatus()
  render() // first frame right away, so the glasses never stay black
  connect()
}

void main()
