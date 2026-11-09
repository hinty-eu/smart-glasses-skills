# Live captions example

One small Node server produces caption text. Every target connects to it with the same protocol and shows the text
its own way, so you can compare brands side by side and copy only the part you need.

```
 text source                      server/server.mjs                         targets (each fits its own display)
 --demo script        ──┐                                        ┌── web-glasses/   rung 2: glasses browser, second screen
 /mic (Web Speech)    ──┼─►  caption state  ─►  /ws?room=CODE  ──┼── even-hub/      rung 1: Even Realities G2 plugin
 --stt <adapter>      ──┘    seq, partial,      GET /latest      ├── android/       rungs 1, 3, 4, 5 (Rokid, Vuzix, Meta, USB-C, ...)
   (PCM from /mic or stdin)  final, clear                        └── ios/           rungs 1, 3, 4, 5 (Vuzix, external display, ...)
```

The rung numbers are the display-text ladder from `skills/smart-glasses/SKILL.md`: 1 vendor SDK, 2 web app on the
glasses, 3 USB-C display glasses as an external display, 4 phone notification mirrored by the glasses' app, 5 voice in
the ear. The decisions behind this design are in `skills/smart-glasses-live-captions/`.

## Quick start

```sh
cd server && npm install
node server.mjs --demo            # prints a 6-character room code, for example K7MPQ4
node check.mjs K7MPQ4             # protocol checker: prints the stream and tests GET /latest
```

Then open `http://localhost:8787/?room=K7MPQ4` in any browser (the server also serves `web-glasses/`), or start one of
the targets below.

## Targets

Verification levels: `hardware` (ran on the glasses), `simulator` (ran in the vendor's official simulator),
`browser` (ran in a desktop browser), `compiles` (builds, never ran), `docs-only` (written from documentation).
Nothing in this folder has run on glasses yet.

| Target | Folder | Ladder rung | Verified | Date | What was checked |
|---|---|---|---|---|---|
| Server | `server/` | - | ran locally (Node 22) | 2026-11-08 | `--demo` stream with `check.mjs`; actions, `/latest`, `POST /action`, `POST /source`, wrong code; `--stt deepgram` with a WAV on stdin and with `/mic?pcm=1` in Chromium (fake microphone) |
| Web page | `web-glasses/` | 2 | `browser` | 2026-11-08, buttons 2026-11-09 | headless Chromium at 600x600 and 390x300: entry form, WebSocket, `?http=1` polling, Back, wrong code, lines fit; on 2026-11-09 with `--enable-spatial-navigation`: arrows move focus between the buttons, Enter presses the focused one once, a repeat adds no duplicate line, `?buttons=0` maps keys directly; `node fit.test.mjs`. Not run in the Meta simulator or on glasses |
| Even Realities G2 | `even-hub/` | 1 | `simulator` | 2026-11-09 | official Even Hub simulator 0.9.5 (npm; Even's simulator page still names v0.9.3) through its automation API, 15 of 15 checks (`npm run test:sim`): captions over WebSocket and over HTTP polling, tap, swipes, menu, double tap, and the optional phone-microphone mode (PCM frames reach a sink server as binary WebSocket frames). `evenhub pack` accepts `app.json` |
| Android (Rokid, Vuzix, Meta, USB-C, notification, voice) | `android/` | 1, 3, 4, 5 | see `android/README.md` | 2026-11-08 | written in parallel against this protocol |
| iOS (Vuzix, external display, notification, voice) | `ios/` | 1, 3, 4, 5 | `compiles` (CI, unsigned) | 2026-11-09 | builds on macOS in the `examples` workflow |

## Protocol

Everything below the "Optional" line is an extension of the base protocol; a target that ignores it still works.

**Room code.** The server prints a 6-character code from `A-Z` and `2-9` without the look-alikes `I L O 0 1`. Clients
send it with every connection. Accept it case-insensitively and strip separators (`k7m-pq4` is `K7MPQ4`). The code keeps
strangers on the same network out of a demo; it is not authentication.

**WebSocket** `ws://HOST:PORT/ws?room=CODE` (`wss://` behind HTTPS).

Server to client:

```json
{"type":"caption","seq":12,"text":"we can meet at four","final":false}
{"type":"clear"}
```

- `seq` grows by one with every caption message. Ignore a caption whose `seq` is not higher than the last one you
  applied: after a reconnect the server replays recent lines with their original `seq`.
- `text` of a partial (`final:false`) is the whole sentence recognised so far, not a delta. It replaces the previous
  partial. `final:true` commits the sentence; the next partial starts a new line. An empty final means "drop the
  partial".
- `clear` empties the screen (sent when someone hides the captions, and when the demo script loops).

Client to server (all optional):

```json
{"type":"hello","target":"rokid","lines":3,"cols":22}
{"type":"action","action":"repeat"}
```

`action` is `repeat`, `skip` or `hide`, the three shared actions every target maps its gestures to. The server
answers them for everyone in the room: `repeat` re-sends the last final line as a new caption (new `seq`) with
`"repeat":true` and drops any partial, `skip` commits the visible part of the current sentence and drops the rest of
it (in `--demo` it jumps to the next line), `hide` broadcasts `clear`. A client that sends `repeat` waits for that echo
instead of repeating locally, so the line is shown and spoken once; it repeats locally only while disconnected.

Source page to server: `{"type":"source","text":"...","final":true}` (same partial and final rules as captions).

**HTTP fallback** for WebViews where the WebSocket never opens: `GET /latest?room=CODE` returns the newest message
(a caption or `{"type":"clear"}`). Poll it every 0.5 to 1 s.

Optional, added by this server and used by the targets in this folder:

| Extension | Meaning |
|---|---|
| close code `4403` / HTTP `403` | wrong room code; show an error instead of retrying |
| `"repeat": true` on a caption | "show this again": the last final line, sent for a `repeat` action. If it is already your newest final line, do not append it a second time; after a `clear` (hide) add it once. Un-hide the display, redraw even if nothing changed, and read it aloud again on speech targets. Clients that ignore the field show the line twice |
| `"recent": [{"seq","text"}]` in `GET /latest` | the last 20 final lines, so a polling client can rebuild the screen after missing messages |
| `POST /action?room=CODE` with `{"type":"action","action":"skip"}` | actions when only HTTP works |
| `POST /source?room=CODE` with `{"text":"...","final":true}` | inject text with curl or from another process |
| binary WebSocket frames | 16 kHz, 16-bit little-endian, mono PCM for the `--stt` adapter (from `/mic?pcm=1`, the Even Hub plugin's phone-microphone mode, or a glasses microphone); ignored in `--demo` and `--browser-mic` mode |
| `GET /health` | `{"ok":true,"mode":"demo","clients":1}` without a room code |
| `GET /` and other paths | the files of `web-glasses/`, so a phone or laptop on the same network can open the captions page |

CORS is open (`Access-Control-Allow-Origin: *`) because the Even WebView and pages on other origins poll `/latest`.

## Server

```sh
node server.mjs --demo                 # demo-script.txt on a loop: partial words, a revised word, finals, clear
node server.mjs --browser-mic          # open http://localhost:8787/mic?room=CODE in Chrome or Safari
node --env-file=.env server.mjs --stt deepgram          # then open /mic?room=CODE&pcm=1, or pipe audio:
ffmpeg -loglevel quiet -f dshow -i audio="Microphone" -ac 1 -ar 16000 -f s16le - | node --env-file=.env server.mjs --stt deepgram
node server.mjs --demo --room K7MPQ4   # fixed code (or ROOM=K7MPQ4), useful for a bookmarked glasses URL
PORT=8790 node server.mjs --demo       # another port; --host 127.0.0.1 to stay off the network
```

On macOS use `-f avfoundation -i ":0"` and on Linux `-f pulse -i default` instead of the `dshow` input. A WAV file on
stdin works too (`node server.mjs --stt deepgram < talk.wav`): the server skips the header and paces the audio to real
time, so a file behaves like a microphone.

**STT adapters.** `--stt NAME` loads `server/stt/NAME.mjs`, which exports one function:

```js
export function createStt({ env, language, sampleRate, onText, onError, log }) {
  // open the provider's streaming connection with a key from env
  return {
    write(pcm) {},  // Buffer of 16-bit little-endian mono PCM at sampleRate (16000)
    close() {},
  }
}
// call onText(wholeSentenceSoFar, false) for partial results and onText(sentence, true) when it ends
```

`stt/deepgram.mjs` is the one example (Deepgram v1 listen WebSocket, Nova-3, key in `DEEPGRAM_API_KEY`). To add a
provider, copy it and change the URL, the auth header and the result parsing; `references/stt-options.md` in the
skill lists the endpoints and message names of the main providers. Keys stay on the server: never ship a provider key
to a glasses client; if a browser must talk to the provider directly, use the provider's short-lived token.

## Run the web target (rung 2)

- **Second screen or desktop test:** `http://SERVER:8787/?room=CODE`. Parameters: `lines=4` (0 = as many as fit),
  `size=40` (font px), `http=1` (skip the WebSocket), `server=https://...` when the page is hosted elsewhere.
  The captions screen has Repeat, Skip and Hide buttons: arrow keys move focus between them (the browser's spatial
  navigation, as Meta asks) and Enter presses the focused one; clicking the captions repeats. `buttons=0` hides the
  buttons and maps keys directly (Enter = repeat, ArrowDown or ArrowRight = skip, ArrowUp or ArrowLeft = hide) for
  screens with nothing focusable. Back (Escape on a desktop) leaves the room; the page never traps it.
- **Meta Ray-Ban Display Web App:** the glasses load HTTPS URLs only, so put the server behind an HTTPS tunnel or
  reverse proxy (Cloudflare Tunnel, ngrok, Caddy) and use `wss://`. With Developer Mode on in the Meta AI app, add the
  URL `https://YOUR-HOST/?room=CODE` as a web app, or build an install link
  `fb-viewapp://web_app_deep_link?appName=Live%20captions&appUrl=` + the URL encoded with `encodeURIComponent` and show
  it as a QR code. Start the server with `--room` so the URL stays valid. The Neural Band and touchpad send the arrow
  and Enter keys, which move focus between the buttons and press them; Back calls `history.back()`. Setup and limits: https://wearables.developer.meta.com/docs/develop/webapps
  (checked 2026-11-08; publishing to all users was not open yet).
- **Standalone Android glasses:** open the same HTTPS URL in Chrome on INMO Air3, or in a browser you sideload on
  RayNeo X3 Pro (it has no confirmed built-in browser; the community TapLink X3 is one option).

## Run the Even Realities G2 target (rung 1)

```sh
cd even-hub && npm install
cp .env.example .env               # optional: default server baked into the build
npm run dev                        # Vite on :5173
npx evenhub-simulator "http://localhost:5173/?server=http://localhost:8787&room=CODE"
npm run test:sim                   # Node 22+: starts its own server, builds, runs the simulator, 15 checks
```

- The plugin imports `../web-glasses/fit.js` and `link.js` (the same caption state, word wrap and connection code as
  the web target). Copy those two files along if you move the folder.
- **Optional phone-microphone mode** (off by default): tick "Send the phone microphone" on the plugin's phone page,
  or add `&mic=phone` to the simulator URL, and start the server with `--stt NAME`. The plugin opens the phone
  microphone through the Even app (`audioControl(true, AudioInputSource.Phone)`, permission `phone-microphone` in
  `app.json`) and sends each PCM frame (16 kHz, s16le, mono) as a binary WebSocket frame; the server feeds them to its
  STT adapter, which holds the key, and the captions come back on the same socket. No second app is involved. It
  needs the WebSocket (over HTTP polling the microphone stays off), and the glasses show "mic: no audio" when frames
  stop. For the wearer's own voice, switch to `AudioInputSource.Glasses` and declare `g2-microphone` instead.
  Simulator 0.9.5 accepts the phone source only after the startup page exists and feeds the PC's default microphone
  tagged as `glasses` (our run, 2026-11-09); `SKIP_MIC=1 npm run test:sim` skips that pass on a machine without one.
- Text updates send only `containerID`, `containerName` and `content`, which replaces the whole text, and every
  container stays under 999 UTF-8 bytes (simulator 0.9.5 rejects more, whatever the character count).
- On real glasses: sideload with `npx evenhub qr --url http://YOUR-LAN-IP:5173` (debug only), or build and pack:
  put your server's exact `https://` and `wss://` origins in `app.json` > `permissions` > `network` > `whitelist`
  (no wildcards; the Even app blocks anything else), set `VITE_SERVER_URL`, then `npm run build && npm run pack`.
  The server must also answer CORS, which this one does. Never commit the `.ehpk` or `node_modules`. Store review
  wants a privacy policy that covers every permission: cover `phone-microphone`, or delete that entry and the
  microphone code if you do not ship the mode.
- The wearer types the server and room code on the plugin's phone page in the Even app. Glasses input: tap = repeat,
  swipe down = skip, swipe up or hold = hide, double tap = exit dialog; the system menu has Repeat, Skip, Hide.
- What the simulator does not show: BLE timing, the real font rendering and brightness levels, the R1 ring, WebView
  suspension when the phone locks, permissions, and the real phone microphone path. The official skill covers the platform:
  `npx skills add even-realities/everything-evenhub`.

## Run the Android and iOS targets

See `android/README.md` and `ios/README.md`. Both speak this protocol and keep their own line fitting per display.

## Security

The room code is a convenience, not access control. For anything beyond a demo on your own network: serve over
HTTPS/WSS, require a real token, rate-limit `/latest`, and do not log caption text. Captions are a transcript of other
people talking; tell them, and follow the recording-consent law where you use it.
