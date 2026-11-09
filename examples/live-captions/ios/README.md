# Live captions: native iOS target

Verification: `docs-only` (2026-11-08). Written against Apple's documentation and the Vuzix Ultralite iOS API
reference, never compiled: the maintainers write this on Windows. The `examples` workflow builds it on macOS once the
repository is public; until a green run exists, treat every line here as unverified.

A minimal SwiftUI app with the same shape as the Android target: one `GlassesDisplay` protocol
(`connect`, `show(_ lines:)`, `onFinal`, `clear`, `disconnect`), the shared actions `repeat` / `skip` / `hide`,
`CaptionLines` for line fitting (same algorithm and behaviour as Android, including `"repeat":true` captions shown
again without a duplicate line), `CaptionController` for throttling and actions, and `CaptionSocket` on
`URLSessionWebSocketTask` for the server protocol.

## Targets

| Rung | Type | How text gets there | Wearer needs | Input |
|---|---|---|---|---|
| - | `PhonePreviewDisplay` | Phone screen only | nothing | phone buttons |
| 1 | `VuzixDisplay` | Ultralite SDK 1.9.0 (Swift package), `requestControl(layout: .textBottomLeftAlign, ...)`, `sendText(text:)` | Z100 linked once through the SDK's picker | 1 tap repeat, 2 skip (`maxNumTaps` 2); hide on the phone |
| 3 | `ExternalDisplay` | A window on the `windowExternalDisplayNonInteractive` scene | iPhone with USB-C and display glasses, or AirPlay | none |
| 4 | `NotificationDisplay` | A new local notification per final caption, at most one every 2.5 s, the last 3 kept | glasses app that mirrors notifications, this app allowed there | notification actions |
| 5 | `SpeechDisplay` | `AVSpeechSynthesizer`, session `.playback` + `.spokenAudio`, ducking others | any Bluetooth audio | phone buttons |

Not here: Rokid's iOS SDK (CocoaPods `RGCxrClient`) needs Rokid's private specs repository, and the CXR-L docs ask
for a registered Rokid developer account (as of 2026-11-08; one community project reports it worked without one,
unverified). Meta DAT for iOS is best followed with Meta's official agent skills (`npx skills add
meta/meta-wearables-dat-ios`, or as Meta's README documents for Claude Code:
`claude plugin marketplace add facebook/meta-wearables-dat-ios`, then
`claude plugin install mwdat-ios@mwdat-ios-marketplace`; read 2026-11-08).

## Build

Requirements: macOS with Xcode, [XcodeGen](https://github.com/yonaskolb/XcodeGen) 2.46 or later. The project file is
generated from `project.yml` and not committed.

```sh
xcodegen generate
open LiveCaptions.xcodeproj        # pick your team under Signing, run on an iPhone
# or without signing, as the CI does:
xcodebuild -project LiveCaptions.xcodeproj -scheme LiveCaptions -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

The Vuzix SDK comes as a binary Swift package from `https://github.com/Vuzix/UltraliteSDK-releases-iOS`, pinned to
1.9.0 (tag `v1.9.0`, iOS 14+; CocoaPods `pod 'UltraliteSDK'` and a plain XCFramework are the other documented options).
Using it means accepting the
[Vuzix SDK licence](https://www.vuzix.com/pages/vuzix%C2%AE-software-development-kit-license-and-confidentiality-agreement).

## Run

Start the server from `examples/live-captions` with `node server/server.mjs --demo`, enter `<computer-ip>:8787` and
the 6-character room code, pick a target, Connect. `Info.plist` sets `NSAllowsLocalNetworking` (from iOS 17 ATS
blocks plain connections to IP addresses without it) and the local network usage text; use `wss://` outside your LAN.

## Platform limits to know before you pick a target

- Background: iOS suspends a backgrounded app within seconds, which also stops the WebSocket. The `audio` background
  mode keeps the app alive while it is speaking; between captions it may still be suspended (unverified). Plan on the
  app being in the foreground for every target except speech.
- External display: up to iOS 26 the system connects the external-display scene by itself, and `AppDelegate` returns
  `ExternalSceneDelegate` for that role. From iOS 27 the scene connects only after a view controller registers a scene
  accessory (`UISceneAccessory.externalNonInteractive(sceneConfiguration:)` + `registerSceneAccessory(_:)`, see Apple's
  [Presenting content on a connected display](https://developer.apple.com/documentation/uikit/presenting-content-on-a-connected-display)).
  `ExternalAccessoryHost` does that behind `#if compiler(>=6.4)` so the file still builds with the iOS 26 SDK; the
  compiler version check is an assumption about which Xcode ships the iOS 27 SDK. A window is attached only while
  the external target is selected, so the glasses mirror the phone otherwise. The content shows only while the app is
  in the foreground.
- Vuzix: `requestControl` is refused while the app is in the background and iOS offers no public "control lost"
  signal, so the target asks again when the app becomes active. Control goes to the last app that asks; always call
  `releaseControl()` when done. Whether `sendText` honours line breaks is unverified.
- Notifications: without a `UNUserNotificationCenterDelegate` returning `.banner` / `.list`, iOS hides notifications
  while the app is in the foreground, and then the glasses get nothing. How long the glasses show one and how much
  text fits is up to each glasses app (unverified). The target posts a new request per caption instead of replacing
  one, because no brand documents whether a replaced notification is forwarded again.
- Speech: `.playback` follows the Bluetooth media route (A2DP). A pair connected for calls only (HFP) needs the
  play-and-record category with Bluetooth HFP allowed, which lowers audio quality.

## Files

```
project.yml                       XcodeGen spec, Swift package UltraliteSDK 1.9.0
LiveCaptions/Info.plist           ATS local networking, Bluetooth text, vuzixconnect scheme, background modes
LiveCaptions/LiveCaptionsApp.swift   App + AppDelegate (external-display scene up to iOS 26)
LiveCaptions/ContentView.swift    AppModel (DisplayHost) and the one screen
LiveCaptions/CaptionSocket.swift, CaptionController.swift, CaptionLines.swift, GlassesDisplay.swift
LiveCaptions/VuzixDisplay.swift, ExternalDisplay.swift, NotificationDisplay.swift, SpeechDisplay.swift
```
