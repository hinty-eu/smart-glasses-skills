// Unit test for fit.js without a browser: node fit.test.mjs
import assert from 'node:assert/strict'
import { applyMessage, applySnapshot, createState, layout, wrap } from './fit.js'

const mono = s => [...s].length // 1 unit per character: a monospace budget of N columns

// wrap: words, long words, no leading spaces, CJK without spaces
assert.deepEqual(wrap('the quick brown fox jumps', 10, mono), ['the quick', 'brown fox', 'jumps'])
assert.deepEqual(wrap('  supercalifragilistic  ok ', 8, mono), ['supercal', 'ifragili', 'stic ok'])
assert.deepEqual(wrap('', 10, mono), [])
for (const l of wrap('今日はとても良い天気ですね。散歩に行きましょう。', 6, mono)) assert.ok(mono(l) <= 6, l)
assert.equal(wrap('今日はとても良い天気ですね。', 6, mono).join(''), '今日はとても良い天気ですね。')

// state: partial replaces, final commits, replays and repeats do not duplicate
const st = createState()
assert.ok(applyMessage(st, { type: 'caption', seq: 1, text: 'hello', final: false }))
assert.ok(applyMessage(st, { type: 'caption', seq: 2, text: 'hello there', final: false }))
assert.equal(st.partial, 'hello there')
assert.ok(applyMessage(st, { type: 'caption', seq: 3, text: 'Hello there.', final: true }))
assert.deepEqual([st.finals, st.partial], [['Hello there.'], ''])
assert.equal(applyMessage(st, { type: 'caption', seq: 3, text: 'Hello there.', final: true }), false, 'replay ignored')
applyMessage(st, { type: 'caption', seq: 4, text: 'Hello there.', final: true, repeat: true })
assert.equal(st.finals.length, 1, 'repeat of the last line is not added twice')
applyMessage(st, { type: 'caption', seq: 5, text: 'and more words', final: false })

// layout: finals then the partial, newest at the bottom, cut to maxLines
const lines = layout(st, { maxWidth: 8, maxLines: 3, measure: mono })
assert.deepEqual(lines, [
  { text: 'there.', partial: false },
  { text: 'and more', partial: true },
  { text: 'words', partial: true },
])
assert.ok(applyMessage(st, { type: 'clear' }))
assert.deepEqual(layout(st, { maxWidth: 8, maxLines: 3, measure: mono }), [])

// snapshot from GET /latest: recent[] is the truth, the newest partial is shown, repeat after hide is shown
const sn = createState()
assert.ok(applySnapshot(sn, { type: 'caption', seq: 9, text: 'two thr', final: false, recent: [{ seq: 7, text: 'one' }] }))
assert.deepEqual([sn.finals, sn.partial, sn.seq], [['one'], 'two thr', 9])
assert.equal(applySnapshot(sn, { type: 'caption', seq: 9, text: 'two thr', final: false, recent: [] }), false, 'same seq: no redraw')
assert.ok(applySnapshot(sn, { type: 'caption', seq: 12, text: 'one', final: true, repeat: true, recent: [] }))
assert.deepEqual(sn.finals, ['one'])
assert.ok(applySnapshot(sn, { type: 'clear', recent: [] }))
assert.deepEqual([sn.finals, sn.partial], [[], ''])

console.log('fit.test.mjs: all passed')
