/**
 * G2 display (576x288, SDK text containers only). Three containers that never change position:
 *   status   one dim line on top; it is the event-capture container, and one line never overflows, so the firmware
 *            never scrolls it and every swipe reaches the app
 *   history  older lines, dim (brightness 2), bottom aligned
 *   live     the sentence being spoken, bright (brightness 4)
 *
 * Rules learned the hard way (see skills/smart-glasses-live-captions/references/line-fitting.md):
 * - createStartUpPageContainer exactly once (latch the call, not the success); later changes use
 *   textContainerUpgrade, which does not flicker; rebuildPageContainer only to recover a lost page.
 * - One write at a time: concurrent bridge calls are reported to break the BLE link. Debounce 120 ms like the
 *   official asr template, then send only the containers whose text changed.
 */
import {
  CreateStartUpPageContainer,
  MenuContainerProperty,
  MenuItemProperty,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { LINE_H, utf8Len } from './text'

export interface Box {
  id: number
  name: string // max 16 characters, unique per page
  x: number
  y: number
  w: number
  h: number
  pad: number
  color: number // text brightness 0-4
  capture?: boolean
}

export const STATUS: Box = { id: 1, name: 'status', x: 0, y: 0, w: 576, h: 32, pad: 2, color: 2, capture: true }
export const HISTORY: Box = { id: 2, name: 'history', x: 0, y: 32, w: 576, h: 140, pad: 4, color: 2 }
export const LIVE: Box = { id: 3, name: 'live', x: 0, y: 172, w: 576, h: 116, pad: 4, color: 4 }
export const BOXES = [STATUS, HISTORY, LIVE]

export const inner = (b: Box) => ({ w: b.w - 2 * b.pad, lines: Math.max(1, Math.floor((b.h - 2 * b.pad) / LINE_H)) })

export type Frame = Record<string, string>

export const MENU = [
  { id: 1, label: 'Repeat' },
  { id: 2, label: 'Skip' },
  { id: 3, label: 'Hide' },
]

const DEBOUNCE_MS = 120
const CALL_TIMEOUT_MS = 6000

function timeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(what + ' timed out')), ms)
    p.then(
      v => {
        clearTimeout(t)
        resolve(v)
      },
      e => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export class Glasses {
  private want: Frame | null = null
  private shown = new Map<string, string>()
  private pageUp = false
  private startupCalled = false
  private forceAll = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private again = false
  private stopped = false
  private fails = 0

  constructor(private readonly bridge: EvenAppBridge | null) {}

  show(f: Frame) {
    this.want = f
    this.schedule()
  }

  /** Send every container again (back in front, glasses reconnected) */
  repaint() {
    this.forceAll = true
    this.schedule()
  }

  /** The plugin is exiting: no more bridge calls */
  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
  }

  private schedule() {
    if (!this.bridge || this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.run(), DEBOUNCE_MS)
  }

  private async run() {
    if (this.running) {
      this.again = true
      return
    }
    this.running = true
    try {
      do {
        this.again = false
        if (this.want && !this.stopped) await this.apply(this.want)
      } while (this.again && !this.stopped)
    } finally {
      this.running = false
    }
  }

  private page(f: Frame) {
    const textObject = BOXES.map(
      b =>
        new TextContainerProperty({
          xPosition: b.x,
          yPosition: b.y,
          width: b.w,
          height: b.h,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: b.pad,
          containerID: b.id,
          containerName: b.name,
          isEventCapture: b.capture ? 1 : 0,
          textColor: b.color,
          content: (f[b.name] || '').slice(0, 999), // create and rebuild accept up to 1000 characters
        }),
    )
    const menuObject = new MenuContainerProperty({ menuItems: MENU.map(m => new MenuItemProperty({ itemID: m.id, itemName: m.label })) })
    return { containerTotalNum: textObject.length, textObject, menuObject }
  }

  private async apply(f: Frame) {
    const bridge = this.bridge as EvenAppBridge
    if (!this.pageUp) {
      let ok = false
      try {
        if (!this.startupCalled) {
          this.startupCalled = true // a second create is rejected by the host, so latch the call itself
          const r = await timeout(bridge.createStartUpPageContainer(new CreateStartUpPageContainer(this.page(f))), CALL_TIMEOUT_MS, 'create')
          ok = r === StartUpPageCreateResult.success
        }
        if (!ok) ok = await timeout(bridge.rebuildPageContainer(new RebuildPageContainer(this.page(f))), CALL_TIMEOUT_MS, 'rebuild')
      } catch (e) {
        console.warn('[captions] page call failed', (e as Error).message)
      }
      if (ok) {
        this.pageUp = true
        this.fails = 0
        this.forceAll = false
        this.shown = new Map(BOXES.map(b => [b.name, f[b.name] || '']))
      } else {
        // Glasses not reachable right now: back off (1.5 s to 30 s) to spare the BLE link
        this.fails++
        setTimeout(() => this.schedule(), Math.min(30000, 1500 * 2 ** Math.min(this.fails - 1, 5)))
      }
      return
    }
    const force = this.forceAll
    this.forceAll = false
    for (const b of BOXES) {
      const next = f[b.name] || ''
      const prev = this.shown.get(b.name) ?? ''
      if (!force && next === prev) continue
      let ok = false
      try {
        ok = await timeout(
          bridge.textContainerUpgrade(
            new TextContainerUpgrade({
              containerID: b.id,
              containerName: b.name, // must match the container's name and ID, or the call silently does nothing
              content: next.slice(0, 1999),
              // replace the whole old text: offset 0, length in bytes of the longer of old and new
              contentOffset: 0,
              contentLength: Math.max(utf8Len(prev), utf8Len(next)),
            }),
          ),
          CALL_TIMEOUT_MS,
          'upgrade',
        )
      } catch (e) {
        console.warn('[captions] upgrade failed', (e as Error).message)
      }
      if (!ok) {
        // Page lost (plugin was in the background, glasses reconnected): build it again on the next pass
        this.pageUp = false
        this.again = true
        return
      }
      this.shown.set(b.name, next)
      if (this.want !== f) return // a newer frame is waiting; the loop picks it up
    }
  }
}
