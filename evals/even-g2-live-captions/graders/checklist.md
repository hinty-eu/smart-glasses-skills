---
type: llm
weight: 1
---

You are grading an answer to a developer who wants a live captions app for Even Realities G2 glasses, with the architecture and the key glasses-side code in TypeScript. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Says the app is an Even Hub plugin: a web app that runs in a WebView inside the Even Realities phone app and drives the glasses through the SDK bridge; no app logic runs on the glasses. Source: https://hub.evenrealities.com/docs/get-started/architecture (updated 2026-06-11, checked 2026-11-08).
2. Uses the official SDK package `@evenrealities/even_hub_sdk` and waits for the bridge (`waitForEvenAppBridge`) before calling it. Source: https://hub.evenrealities.com/docs/build/device-apis (updated 2026-08-29); npm 0.0.16, published 2026-09-24 (checked 2026-11-08).
3. Creates the page once with `createStartUpPageContainer` and updates the caption with `textContainerUpgrade`, not by rebuilding the page for every caption. Source: https://hub.evenrealities.com/docs/build/page-lifecycle (updated 2026-08-25, checked 2026-11-08).
4. Respects the display model: a text container with absolute position and size on the 576x288 canvas, and exactly one container with `isEventCapture: 1`. Source: https://hub.evenrealities.com/docs/build/display (updated 2026-10-09, checked 2026-11-08).
5. Captures audio with `audioControl(true, ...)` and reads frames from `audioEvent.audioPcm` as PCM 16 kHz, signed 16-bit little-endian, mono. Source: https://hub.evenrealities.com/docs/build/device-apis (checked 2026-11-08).
6. States that the SDK has no speech-to-text, so the PCM must go to a speech-to-text service (own server or provider) and the text comes back to the plugin. Source: device APIs page above; open request https://github.com/even-realities/everything-evenhub/issues/9 (checked 2026-11-08).
7. Keeps speech-to-text provider keys out of the plugin bundle (server-side proxy or short-lived tokens). Source: https://hub.evenrealities.com/docs/ship/app-submission "Never bundle secrets or API keys into the .ehpk" (updated 2026-10-09, checked 2026-11-08).
8. Chooses the microphone on purpose: glasses mic (`AudioInputSource.Glasses`, permission `g2-microphone`) or phone mic (`AudioInputSource.Phone`, permission `phone-microphone`), and declares the matching permission in `app.json`. Half a point if it uses one mic correctly but ignores the permission. Source: device APIs page and https://hub.evenrealities.com/docs/ship/packaging (updated 2026-08-29, checked 2026-11-08).
9. Declares the backend origin (including the `wss://` origin if it uses WebSockets) in the `app.json` `network` permission whitelist, and notes that CORS still applies. Source: https://hub.evenrealities.com/docs/build/networking (updated 2026-06-11, checked 2026-11-08).
10. Handles text length: trims the caption to the last lines that fit instead of appending forever (documented limits: 1,000 characters on create, 2,000 on `textContainerUpgrade`; a full-screen container holds roughly 400-500 characters). Source: display page above.
11. Coalesces updates: partial results replace the current line, at most one update in flight, stale partials dropped. Engineering item, no vendor source; give the point for any sound throttling or debouncing.
12. Mentions testing with the official simulator (`@evenrealities/evenhub-simulator`) and that it is not a hardware emulator (BLE timing and real-device quirks are not reproduced), so latency must be checked on real glasses. Source: https://hub.evenrealities.com/docs/test/simulator (updated 2026-08-29, checked 2026-11-08).
13. Mentions that on the root page a double tap must call `shutDownPageContainer(1)` (system exit dialog) to pass store review. Source: https://hub.evenrealities.com/docs/ship/app-submission (updated 2026-10-09, checked 2026-11-08).

## Critical errors (any one fails the case)

- Says app code runs on the glasses, or connects to the G2 directly over Web Bluetooth or raw BLE instead of the Even Hub bridge.
- Says the SDK or the glasses give plugins built-in speech-to-text.
- Says the G2 has a speaker or plays audio on the glasses (official: "No camera, no speaker on the glasses", https://hub.evenrealities.com/docs/get-started/overview, checked 2026-11-08).
- Presents an SDK method that does not exist as Even Hub API (for example `bridge.showText`, `bridge.startSpeechRecognition`, `glasses.display.render`). Real names include `waitForEvenAppBridge`, `createStartUpPageContainer`, `textContainerUpgrade`, `rebuildPageContainer`, `updateImageRawData`, `shutDownPageContainer`, `onEvenHubEvent`, `audioControl`, `TextContainerProperty`, `CreateStartUpPageContainer`, `TextContainerUpgrade`, `AudioInputSource`, `OsEventTypeList`.
- Recommends putting a provider's secret API key directly in the plugin code.
- Pastes a long block that it says is copied from a vendor sample or template.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 13, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
