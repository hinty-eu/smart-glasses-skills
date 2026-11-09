// Caption server client: WebSocket first, GET /latest polling when the WebSocket does not come up.
// Shared by the web target (app.js) and the Even Hub plugin (../even-hub/src/main.ts). Protocol: ../README.md.
//
// Why the fallback: some glasses WebViews (reported for the Even app on iOS) fail the WebSocket handshake while
// plain fetch works. After two failed attempts the client polls over HTTP and keeps retrying the socket slowly.

/**
 * @typedef {'connecting' | 'live' | 'offline' | 'wrong-code'} LinkStatus
 * @typedef {{
 *   message: (m: any) => void,
 *   snapshot: (latest: any) => void,
 *   status: (s: LinkStatus) => void,
 *   open?: (link: CaptionLink) => void,
 * }} LinkHandlers
 */

export class CaptionLink {
  /**
   * @param {LinkHandlers} handlers
   * @param {{ forceHttp?: boolean, pollMs?: number, log?: (msg: string) => void }} [options]
   */
  constructor(handlers, options = {}) {
    this.h = handlers
    this.forceHttp = !!options.forceHttp
    this.pollMs = options.pollMs || 700
    this.log = options.log || (() => {})
    /** @type {WebSocket | null} */
    this.ws = null
    /** @type {'ws' | 'http' | null} */
    this.mode = null
    this.server = ''
    this.room = ''
    this.fails = 0
    this.stopped = true
    this.polling = false
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this.retry = undefined
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this.pollTimer = undefined
  }

  /** @param {string} server e.g. https://captions.example.com  @param {string} room */
  start(server, room) {
    this.stop()
    this.server = server.replace(/\/+$/, '')
    this.room = room
    this.stopped = false
    this.fails = 0
    this.h.status('connecting')
    this.openWs()
  }

  stop() {
    this.stopped = true
    this.stopPolling()
    clearTimeout(this.retry)
    if (this.ws) {
      const ws = this.ws
      this.ws = null
      try {
        ws.close(1000)
      } catch {
        // already closed
      }
    }
  }

  /** Page visible again, app back in front, network back: retry now instead of waiting for the timer */
  wake() {
    if (this.stopped || (this.ws && this.ws.readyState === 1)) return
    clearTimeout(this.retry)
    this.openWs()
  }

  isLive() {
    return !this.stopped && ((this.ws !== null && this.ws.readyState === 1) || this.polling)
  }

  openWs() {
    if (this.forceHttp) return this.startPolling()
    /** @type {WebSocket} */
    let ws
    try {
      ws = new WebSocket(this.server.replace(/^http/, 'ws') + '/ws?room=' + encodeURIComponent(this.room))
    } catch {
      return this.wsFailed(false)
    }
    this.ws = ws
    let opened = false
    const openTimer = setTimeout(() => {
      if (!opened) ws.close()
    }, 6000)
    ws.onopen = () => {
      opened = true
      clearTimeout(openTimer)
      this.fails = 0
      this.stopPolling()
      this.mode = 'ws'
      this.log('link ws')
      this.h.status('live')
      this.h.open?.(this)
    }
    ws.onmessage = e => {
      let m
      try {
        m = JSON.parse(String(e.data))
      } catch {
        return
      }
      this.h.message(m)
    }
    ws.onerror = () => {}
    ws.onclose = e => {
      clearTimeout(openTimer)
      if (this.ws !== ws) return
      this.ws = null
      if (this.stopped) return
      if (e.code === 4403) {
        this.stop()
        this.h.status('wrong-code')
        return
      }
      this.wsFailed(opened)
    }
  }

  /** @param {boolean} wasOpen */
  wsFailed(wasOpen) {
    if (!wasOpen) this.fails++
    if (this.fails >= 2) this.startPolling()
    else this.h.status('offline')
    const wait = this.fails >= 2 ? 20000 : wasOpen ? 1000 : 3000
    clearTimeout(this.retry)
    this.retry = setTimeout(() => {
      if (!this.stopped) this.openWs()
    }, wait)
  }

  startPolling() {
    if (this.polling) return
    this.polling = true
    this.mode = 'http'
    this.log('link http')
    void this.poll()
  }

  stopPolling() {
    this.polling = false
    clearTimeout(this.pollTimer)
  }

  async poll() {
    if (!this.polling || this.stopped) return
    try {
      const r = await fetch(this.server + '/latest?room=' + encodeURIComponent(this.room), { cache: 'no-store' })
      if (r.status === 403) {
        this.stop()
        this.h.status('wrong-code')
        return
      }
      if (!r.ok) throw new Error('HTTP ' + r.status)
      this.h.snapshot(await r.json())
      this.h.status('live')
    } catch {
      this.h.status('offline')
    }
    if (!this.polling || this.stopped) return
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    this.pollTimer = setTimeout(() => void this.poll(), hidden ? 3000 : this.pollMs)
  }

  /** @param {object} obj  @returns {boolean} sent over the WebSocket */
  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj))
      return true
    }
    return false
  }

  /** Shared input actions: every target maps its gestures to these three. @param {'repeat' | 'skip' | 'hide'} action */
  action(action) {
    if (this.send({ type: 'action', action })) return 'ws'
    fetch(this.server + '/action?room=' + encodeURIComponent(this.room), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'action', action }),
    }).catch(() => {})
    return 'http'
  }
}
