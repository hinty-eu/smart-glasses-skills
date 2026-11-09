---
type: llm
weight: 1
---

You are grading an answer to a developer whose Android app receives short text from a server over a WebSocket and wants it shown on Rokid Glasses, with Kotlin code. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

Rokid's CXR-L documentation is a JavaScript portal; its entry point is https://developerdoc.rokid.com/sdk?lang=zh (English pages load from the same portal). Page names and versions are given below.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Uses Rokid's phone-side CXR-L SDK, Maven artifact `com.rokid.cxr:client-l` (current release 1.1.2), from Rokid's own repository `https://maven.rokid.com/repository/maven-public/`, with `minSdk` 28 or higher. Sources: https://maven.rokid.com/repository/maven-public/com/rokid/cxr/client-l/maven-metadata.xml (release 1.1.2, checked 2026-11-09); CXR-L docs "SDK Integration" v1.3 (2026-09-08, checked 2026-11-08). Half a point if it names CXR-L but gets the repository or coordinates wrong.
2. Explains that the app does not talk to the glasses directly: your app -> CXR-L SDK -> Rokid's companion app (Rokid AI App in mainland China, Hi Rokid overseas) -> glasses. The companion app must be installed and connected to the glasses. Source: CXR-L docs "Introduction" v1.3 and "Authentication" v1.3 (2026-09-08, checked 2026-11-08).
3. Includes the authorisation step: the user approves the app in the companion app (`CxrSessionManager.requestAuthorization(...)` returns a token that is used to connect). Source: "Authentication" v1.3.
4. Keeps the WebSocket to the server in the phone app and forwards text to the glasses; the glasses do not fetch from the server themselves. Source: "Introduction" v1.3 (the chain above).
5. Uses a `CUSTOM_VIEW` session: an initial layout described as JSON in the session config, then incremental text changes with `customViewUpdate(updateJson)` targeting a node `id`. Source: "Glasses Custom View" v1.6 (2026-09-08, checked 2026-11-08).
6. Says a glasses-side APK (`CUSTOM_APP` session plus the CXR-S SDK) is not needed just to display text. Source: "Introduction" v1.3 decision guide (`CUSTOM_VIEW` needs no glasses-side APK).
7. Calls capability APIs only after the session reaches Started (states Idle, Starting, Started, Paused, Terminating; callbacks through `ISessionLifecycleCbk`). Source: "Introduction" v1.3 and "Connection and Session" v1.3 (2026-09-08).
8. Handles Paused and resume: the session pauses while the Rokid assistant runs or Bluetooth drops (`onSessionPaused`, `onSessionResumed`), and the app re-sends the current text after resume and re-authorises when the token is invalid. Source: "Connection and Session" v1.3.
9. Sends only the latest text (coalesces bursts) and keeps lines short for a small monochrome green display. Engineering item; give the point for any sound throttling.
10. Notes that glasses touchpad events do not reach a phone app with a custom view: key and touchpad events are system broadcasts to glasses-side apps, so controls should live on the phone. Source: "Glasses Keys and System Broadcasts" v1.2 (2026-09-08, checked 2026-11-08).
11. Testing: says there is no official CXR-L simulator (none found in the docs as of 2026-11-08) and suggests putting the glasses behind an interface with a fake for tests.
12. Licence awareness: the CXR-L POM has no licence element and Rokid publishes no licence for it, so depend on the Maven artifact and do not copy SDK files or samples into the project. Source: https://maven.rokid.com/repository/maven-public/com/rokid/cxr/client-l/1.1.2/client-l-1.1.2.pom (checked 2026-11-09). Half a point for "check the licence" without the specifics.
13. Mentions a no-SDK fallback for occasional messages: a normal phone notification, which the Rokid app mirrors to the glasses. Press-level source only: https://www.pickr.com.au/reviews/2026/rokid-glasses/ (checked 2026-11-09).

## Critical errors (any one fails the case)

- Says you must build an app that runs on the glasses just to show text, or that the phone app should talk to the glasses over raw Bluetooth without Rokid's companion app.
- Recommends CXR-M as the SDK for this app. Official: CXR-M is available only through Rokid's business team and "is not publicly available on the developer site" (https://developerdoc.rokid.com/sdk?lang=zh, checked 2026-11-08).
- Says the SDK is on Maven Central. (`mavenCentral()` for other dependencies is fine.)
- Says touchpad taps on the glasses arrive in the phone app's custom view.
- Presents API names that do not exist as Rokid API. Real names include `CxrSessionManager.getInstance`, `CxrSessionManager.requestAuthorization`, `parseAuthorizationResult`, `CxrSessionManager.isRokidAppInstalled`, `CxrSessionManager.checkRokidAppCompatibility`, `RokidAppStatus.Compatible`, `GlassPermission.MEDIA`, `SessionConfig`, `AiInterceptMode.ALLOW_WITH_PAUSE`, `SessionTimeouts`, `create(config)`, `connect(token)`, `close()`, `customViewUpdate`, `addLifecycleCallback`, `removeLifecycleCallback`, `ISessionLifecycleCbk`, `onConnectResult`, `onSessionPaused`, `onSessionResumed`, `onSessionTerminating`, `onSessionClosed`, `PausedReason`, `CloseReason.LINK_LOST`, `CloseReason.CHAIN_TORN`, `SessionState.Started`, `SessionErrorCode.NOT_AUTHENTICATED`, `SessionErrorCode.TOKEN_EXPIRED`, `startAudioStream` (verified against the client-l 1.1.2 public signatures on 2026-11-09). A name missing from this list is not automatically invented; only count it as invented if it contradicts the official docs. Code marked as unverified or pseudo-code is not an error.
- Pastes a long block that it says is copied from Rokid's samples or docs.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. If you mark a critical error, name it and quote the sentence from the answer. Compute the percent: points earned divided by 13, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
