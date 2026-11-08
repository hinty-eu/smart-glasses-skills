# Vuzix Z100 (Vuzix Ultralite SDK)

Last checked: 2026-11-08. Verification: docs-only (no hardware test yet). Depth: the `smart-glasses-vuzix` skill.

## At a glance
- Display: 640x480, monochrome green (4 levels, black = see-through), right eye only, about 30 degrees.
- How your app puts text on it: rung 1 (Ultralite SDK from your phone app) and rung 4 (phone notifications mirrored
  by Vuzix Connect). No web app, no external display mode.
- Input: 1, 2 or 3 taps anywhere on the frame (no left/right, no swipes), plus power-button events.
- Microphone for your app: none. Use the phone microphone.
- Speaker: none. Speak through the phone or Bluetooth earbuds (rung 5 only off the glasses).
- Phones / where your code runs: your phone app. Android 12+ with the Vuzix Connect app; iOS 14+ (also watchOS 9+,
  macOS 11+), where your app links the glasses itself.
- Publishing to everyone today: yes, as an ordinary app on Google Play or the App Store; Vuzix runs no store or review
  for Z100 apps (as of 2026-11-08, [Extentos](https://extentos.com/docs/ecosystem/platforms/vuzix)).
- Test without hardware: no simulator. Fake the SDK behind your own interface.
- Official agent skill: none (none found on skills.sh as of 2026-11-08). Use `smart-glasses-vuzix` from this repo.

## Getting text on the display
1. **Ultralite SDK, with control** (best): `requestControl`, then the text layout + `sendText`, the canvas (7 text
   blocks) or `LiveText` for captions. Control is last-requester-wins; release it when done.
2. **Ultralite SDK notifications** (`sendNotification`): no control needed, coexists with other apps, only peeks while
   another app holds the display.
3. **Phone notification** with no SDK: Vuzix Connect mirrors it.

SDK: Android `com.vuzix:ultralite-sdk-android:1.9` (JitPack), iOS `UltraliteSDK` 1.9.0 (SPM, CocoaPods). Both
unchanged since March 2025. Minimal code for both platforms: `smart-glasses-vuzix` SKILL.md.

## Input
Taps need control and `maxNumTaps` 1-3 (default 0 reports nothing); more taps means more delay. Map 1 tap to
`repeat`, 2 taps to `skip`. Expect occasional false taps when the wearer adjusts the frame.

## Audio
Nothing on the glasses: no microphone, no speaker, no camera, no audio API in the SDK. Captions and assistants
capture audio on the phone.

## Testing without hardware
No Vuzix simulator or emulator. On Android without Vuzix Connect `isAvailable()` stays `false`; the iOS XCFramework
runs in the iOS Simulator but connects to nothing.

## Publishing and distribution
- Licence: proprietary [Vuzix SDK License and Confidentiality Agreement](https://www.vuzix.com/pages/vuzix%C2%AE-software-development-kit-license-and-confidentiality-agreement),
  accepted by using the SDK; royalty-free; no redistribution or reverse engineering; military, defence, law enforcement
  and first-responder apps need written consent; no use of Vuzix marks.
- Hardware: USD 499 at launch (2024-11-20). Availability on vuzix.com is unclear: Extentos reported it unlisted as of
  2026-07-30; we could not confirm on 2026-11-08. Mentra's Mach1 is the same hardware.
- Alternative path: MentraOS supports the Z100, but its Miniapp SDK is beta and miniapps cannot be distributed in
  MentraOS 3.0 ([Mentra docs](https://docs.mentraglass.com/app-devs/getting-started/overview), 2026-11-08).

## Pitfalls
- iOS: each app must link the glasses once, or `isConnected` never turns true
  ([Vuzix](https://support.vuzix.com/docs/display-process)).
- iOS: no public "control lost" event; control in the background is undocumented.
- Taps silently off until `maxNumTaps` is set ([iOS #4](https://github.com/Vuzix/UltraliteSDK-releases-iOS/issues/4)).
- Notifications only show the title while another app holds the display
  ([Android #1](https://github.com/Vuzix/ultralite-sdk-android/issues/1)).
- Forgetting `commit()` after canvas changes.

## Official resources
- Android SDK: https://github.com/Vuzix/ultralite-sdk-android, Javadoc: https://vuzix.github.io/ultralite-sdk-android/javadoc
- iOS SDK: https://github.com/Vuzix/UltraliteSDK-releases-iOS, DocC: https://vuzix.github.io/UltraliteSDK-releases-iOS/documentation/ultralitesdk/
- Samples (BSD-3-Clause): https://github.com/Vuzix/ultralite-sdk-android-sample, https://github.com/Vuzix/ultralite-sdk-ios-sample
- Developer docs: https://support.vuzix.com/docs/z100-software-integration
- Vuzix Connect: https://play.google.com/store/apps/details?id=com.vuzix.connect, https://apps.apple.com/us/app/vuzix-connect/id6467056741
