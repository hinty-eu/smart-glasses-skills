/**
 * Text for the G2 firmware font, measured with Even's own font tables (@evenrealities/pretext, MIT).
 * One font, one size, 27 px line height, proportional, left and top aligned. Characters the font lacks are dropped
 * by the firmware without a placeholder (Arabic, Hebrew, Thai and Indic scripts as of 2026-11-08), so we remove them
 * first and count them, which lets the UI say "some characters not shown" instead of showing half a sentence.
 */
import { getAdvW, getTextWidth, measureTextWrap } from '@evenrealities/pretext'
import { wrap } from '../../web-glasses/fit.js'

export const LINE_H = 27
const SPACE_W = Math.max(1, getTextWidth(' '))
const INVISIBLE = /[­​-‏⁠-⁤︀-️﻿]/

export function clean(input: string): { text: string; dropped: number } {
  let dropped = 0
  let out = ''
  const s = String(input ?? '')
    .normalize('NFC')
    .replace(/[  -   　\t\r\n]/g, ' ')
  for (const ch of s) {
    if (ch === ' ') out += ch
    else if (getAdvW(ch.codePointAt(0) as number) > 0) out += ch
    else if (!INVISIBLE.test(ch)) dropped++
  }
  return { text: out.replace(/ {2,}/g, ' ').trim(), dropped }
}

/** Word wrap with the firmware metrics; a few px of slack for rounding against the firmware's own wrap */
export function fitLines(text: string, innerW: number): string[] {
  return wrap(text, innerW - 6, getTextWidth)
}

/**
 * The newest `maxLines` lines as one container string. `bottom` pads with empty lines on top so the newest line sits
 * on the container's last line (subtitle style). Checked against the firmware wrap: if it would need more lines
 * (rounding), the oldest line goes.
 */
export function block(lines: string[], maxLines: number, innerW: number, align: 'top' | 'bottom'): string {
  let shown = lines.slice(-maxLines)
  // n line breaks make n + 1 lines: padding an empty block would overflow the container and show a scrollbar
  if (!shown.length) return ''
  for (;;) {
    const body = shown.join('\n')
    const out = align === 'bottom' ? '\n'.repeat(Math.max(0, maxLines - shown.length)) + body : body
    if (shown.length <= 1 || measureTextWrap(body, innerW).lineCount <= shown.length) return out
    shown = shown.slice(1)
  }
}

/** "left ............ right" on one line, right side cut first */
export function leftRight(left: string, right: string, innerW: number): string {
  const w = innerW - 6
  if (!right) return left
  let r = right
  while (r && getTextWidth(left) + 2 * SPACE_W + getTextWidth(r) > w) r = r.slice(0, -1)
  const gap = Math.floor((w - getTextWidth(left) - getTextWidth(r)) / SPACE_W)
  return left + ' '.repeat(Math.max(2, gap)) + r
}

/** UTF-8 bytes (menu labels are limited to 32; simulator 0.9.5 rejects container text over about 1000) */
export const utf8Len = (s: string): number => new TextEncoder().encode(s).length

/**
 * Keep the end of `s` within `max` UTF-8 bytes, never splitting a character. Safety net only: the boxes hold far less.
 * Simulator 0.9.5 returns false for a rebuild or upgrade over about 1000 bytes even under the 1000/2000 character
 * limits (checked 2026-11-09), and the hardware byte limit is not documented.
 */
export function tailBytes(s: string, max = 999): string {
  if (utf8Len(s) <= max) return s
  const chars = [...s]
  let i = chars.length
  let n = 0
  while (i > 0 && n + utf8Len(chars[i - 1]) <= max) n += utf8Len(chars[--i])
  return chars.slice(i).join('')
}
