// Streaming speech-to-text adapter for Deepgram (v1 listen WebSocket, Nova-3 by default).
// API: https://developers.deepgram.com/reference/speech-to-text/listen-streaming (checked 2026-11-08)
// Key from the environment only: DEEPGRAM_API_KEY. Optional DEEPGRAM_MODEL (default nova-3).
//
// Adapter interface (every file in stt/ exports the same function, see ../../README.md):
//   createStt({ env, language, sampleRate, onText(text, final), onError(err), log(msg) })
//     -> { write(pcm: Buffer), close() }
// `write` takes 16-bit little-endian mono PCM at `sampleRate`. `onText` gets the whole current sentence:
// final=false replaces the previous partial, final=true commits it.
import WebSocket from 'ws'

export function createStt({ env, language = 'en', sampleRate = 16000, onText, onError = () => {}, log = () => {} }) {
  const key = env.DEEPGRAM_API_KEY
  if (!key) throw new Error('DEEPGRAM_API_KEY is not set (see .env.example)')
  const params = new URLSearchParams({
    model: env.DEEPGRAM_MODEL || 'nova-3',
    language, // "multi" switches Nova-3 to code-switching between its multilingual languages
    encoding: 'linear16',
    sample_rate: String(sampleRate),
    channels: '1',
    interim_results: 'true', // partial results
    smart_format: 'true', // punctuation, numbers
    endpointing: '300', // ms of silence that ends a sentence (speech_final)
    utterance_end_ms: '1000', // backup end-of-sentence signal when noise keeps endpointing from firing
  })

  let ws = null
  let open = false
  let closed = false
  let retries = 0
  let queue = [] // audio sent while (re)connecting, capped
  let done = '' // finalized segments of the current sentence
  let lastAudio = 0

  const flush = () => {
    if (done) onText(done, true)
    done = ''
  }

  function connect() {
    ws = new WebSocket('wss://api.deepgram.com/v1/listen?' + params, { headers: { Authorization: 'Token ' + key } })
    ws.on('open', () => {
      open = true
      retries = 0
      log('connected')
      for (const b of queue) ws.send(b)
      queue = []
    })
    ws.on('message', data => {
      let m
      try {
        m = JSON.parse(String(data))
      } catch {
        return
      }
      if (m.type === 'UtteranceEnd') return flush()
      if (m.type !== 'Results') return
      const text = m.channel?.alternatives?.[0]?.transcript || ''
      if (m.is_final) {
        // is_final closes one segment; a sentence can span several segments until speech_final
        if (text) done = done ? done + ' ' + text : text
        if (m.speech_final || done.length > 200) flush()
        else if (done) onText(done, false)
      } else {
        const whole = done && text ? done + ' ' + text : done || text
        if (whole) onText(whole, false)
      }
    })
    ws.on('error', e => onError(e))
    ws.on('close', code => {
      open = false
      flush()
      if (closed) return
      const wait = Math.min(15000, 1000 * 2 ** retries++)
      log(`closed (${code}), reconnecting in ${wait} ms`)
      setTimeout(() => !closed && connect(), wait)
    })
  }

  // Deepgram closes the stream after about 10 s without audio; KeepAlive holds it open during silence
  const keepAlive = setInterval(() => {
    if (open && Date.now() - lastAudio > 5000) ws.send(JSON.stringify({ type: 'KeepAlive' }))
  }, 4000)

  connect()
  return {
    write(pcm) {
      lastAudio = Date.now()
      if (open) ws.send(pcm)
      else if (queue.length < 100) queue.push(pcm) // about 10 s at 100 ms frames
    },
    close() {
      closed = true
      clearInterval(keepAlive)
      if (open) ws.send(JSON.stringify({ type: 'CloseStream' }))
      setTimeout(() => ws?.close(), 500)
    },
  }
}
