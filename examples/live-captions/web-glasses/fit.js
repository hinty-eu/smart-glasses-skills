// Caption state and line fitting, shared by the web target and its Node test (no DOM here).
// Protocol: ../README.md. The same rules are written out in skills/smart-glasses-live-captions/references/line-fitting.md.

/** @typedef {{ finals: string[], partial: string, seq: number }} CaptionState */

export function createState() {
  return { finals: [], partial: '', seq: 0 }
}

const MAX_FINALS = 30

/**
 * Applies one server message. Returns true when the screen must be redrawn.
 * - partial (final:false): replaces the current partial line (its text is the whole sentence so far)
 * - final: commits the sentence; an empty final just drops the partial
 * - repeat:true (optional field): the server re-sent the last line; do not add it twice
 * - seq: messages at or below the last seen seq are replays after a reconnect and are ignored
 */
export function applyMessage(st, m) {
  if (!m || typeof m !== 'object') return false
  if (m.type === 'clear') {
    const had = st.finals.length > 0 || st.partial !== ''
    st.finals = []
    st.partial = ''
    return had
  }
  if (m.type !== 'caption' || typeof m.seq !== 'number' || m.seq <= st.seq) return false
  st.seq = m.seq
  const text = String(m.text || '').trim()
  if (!m.final) {
    st.partial = text
    return true
  }
  st.partial = ''
  if (text && !(m.repeat && st.finals[st.finals.length - 1] === text)) {
    st.finals.push(text)
    if (st.finals.length > MAX_FINALS) st.finals.shift()
  }
  return true
}

/** GET /latest returns the newest message plus `recent` (the server's final lines): take it as the whole truth */
export function applySnapshot(st, latest) {
  if (!latest || typeof latest !== 'object') return false
  if (latest.type === 'caption' && latest.seq === st.seq) return false
  const before = JSON.stringify(st)
  st.finals = Array.isArray(latest.recent) ? latest.recent.map(r => String(r.text || '')).filter(Boolean).slice(-MAX_FINALS) : st.finals
  const text = latest.type === 'caption' ? String(latest.text || '').trim() : ''
  st.partial = latest.type === 'caption' && !latest.final ? text : ''
  // a repeated line is not in `recent` (for example right after "hide"), so add it
  if (latest.type === 'caption' && latest.final && text && st.finals[st.finals.length - 1] !== text) st.finals.push(text)
  if (latest.type === 'caption') st.seq = Math.max(st.seq, latest.seq)
  else st.finals = []
  return JSON.stringify(st) !== before
}

// Break opportunities: Intl.Segmenter finds word boundaries in scripts without spaces (Chinese, Japanese, Thai)
const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null
const pieces = text => (segmenter ? Array.from(segmenter.segment(text), s => s.segment) : text.split(/(\s+)/).filter(Boolean))
const isSpace = s => /^\s+$/.test(s)

/**
 * Greedy word wrap with a real width function: `measure(str)` returns the rendered width in the same unit as
 * `maxWidth` (pixels from canvas measureText, font tables, or 1 per character for a monospace budget).
 * Words longer than a line are broken between characters.
 */
export function wrap(text, maxWidth, measure) {
  const out = []
  let line = ''
  const push = () => {
    const t = line.trim()
    if (t) out.push(t)
    line = ''
  }
  for (const piece of pieces(String(text).replace(/\s+/g, ' ').trim())) {
    if (!line && isSpace(piece)) continue
    const next = line + piece
    if (measure(next.trimEnd()) <= maxWidth) {
      line = next
      continue
    }
    if (isSpace(piece)) {
      push()
      continue
    }
    if (line.trim()) push()
    if (measure(piece) <= maxWidth) {
      line = piece
      continue
    }
    for (const ch of piece) {
      if (line && measure(line + ch) > maxWidth) push()
      line += ch
    }
  }
  push()
  return out
}

/**
 * The lines to show, newest at the bottom: committed sentences first, then the partial sentence.
 * Each final sentence starts on its own line, so a partial never shares a line with older text and
 * replacing it never moves the lines above.
 */
export function layout(st, { maxWidth, maxLines, measure }) {
  const lines = []
  for (const f of st.finals) for (const l of wrap(f, maxWidth, measure)) lines.push({ text: l, partial: false })
  if (st.partial) for (const l of wrap(st.partial, maxWidth, measure)) lines.push({ text: l, partial: true })
  return lines.slice(-Math.max(1, maxLines))
}

/** Rough column count for the optional {"type":"hello"} message */
export function columns(maxWidth, measure) {
  const sample = 'the quick brown fox jumps over a lazy dog'
  return Math.max(1, Math.floor((maxWidth / measure(sample)) * sample.length))
}
