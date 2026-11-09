---
type: llm
weight: 1
---

You are grading an answer to a developer who wants live captions on Vuzix Z100 glasses from an iPhone app, with Swift code for the glasses part and the speech recognition part. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Uses Vuzix's iOS `UltraliteSDK` (Swift Package Manager or CocoaPods; latest 1.9.0, released 2025-03-17; iOS 14 or later). Source: https://github.com/Vuzix/UltraliteSDK-releases-iOS and its releases page (checked 2026-11-08).
2. Says the Z100 has no microphone (and no speaker), so audio is captured with the iPhone's microphone. Sources: the Z100 product page lists only a display, a tap sensor and Bluetooth LE (https://www.vuzix.com/products/z100-smart-glasses, archived 2026-07-10, the live site rate-limited us); the SDK documentation has no audio API (https://vuzix.github.io/UltraliteSDK-releases-iOS/documentation/ultralitesdk/, checked 2026-11-08).
3. Links the glasses inside the app (`UltraliteManager.shared`, `link(device:callback:)` or the provided `UltralitePickerController`), and notes that each iOS app must link once or the connected state never becomes true. Source: https://support.vuzix.com/docs/display-process (2024-01-09, checked 2026-11-08) and the DocC reference above.
4. Requests control of the display before drawing (`requestControl(layout:...)`) and releases it (`releaseControl()`) when done; control always goes to the last app that requests it. Source: display-process page and DocC above.
5. Uses a layout suited to continuous captions, such as `ScrollLayout.LiveText` (DocC: "an effect similar to closed captioning"), or `sendText` with its own trimming. Not notifications as the main channel. Source: DocC above.
6. Designs for the display: 640x480, monochrome green, right eye only; short lines, few lines. Sources: display-process page; product page above.
7. Speech: uses Apple's Speech framework (`SFSpeechRecognizer` with `SFSpeechAudioBufferRecognitionRequest`, `shouldReportPartialResults`) fed from an `AVAudioEngine` input node tap, or `SpeechAnalyzer` with `SpeechTranscriber` on iOS 26 and later. Sources: https://developer.apple.com/documentation/speech/sfspeechrecognizer , https://developer.apple.com/documentation/speech/speechanalyzer , https://developer.apple.com/documentation/avfaudio/avaudionode/installtap(onbus:buffersize:format:block:) (checked 2026-11-08).
8. Permissions: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` with `SFSpeechRecognizer.requestAuthorization`, and `NSBluetoothAlwaysUsageDescription` for the Bluetooth link. Half a point if one of the three is missing. Sources: Apple pages above; https://developer.apple.com/documentation/bundleresources/information-property-list/nsbluetoothalwaysusagedescription (checked 2026-11-09).
9. Handles long sessions: Apple says to "Plan for a one-minute limit on audio duration" for `SFSpeechRecognizer`, so the answer restarts recognition requests in a loop, or uses on-device recognition (`requiresOnDeviceRecognition` when `supportsOnDeviceRecognition` is true) or `SpeechAnalyzer`. Source: https://developer.apple.com/documentation/speech/sfspeechrecognizer (checked 2026-11-09).
10. Partial vs final results: partial text replaces the current line and is committed on the final result; sends to the glasses are throttled. Engineering item; give the point for any sound approach.
11. Background: if captions must keep running with the phone locked, adds the `audio` background mode (recording) and `bluetooth-central` (Bluetooth accessory). Source: https://developer.apple.com/documentation/xcode/configuring-background-execution-modes (checked 2026-11-08).
12. Testing: no Vuzix simulator or emulator exists for the Z100 (none found as of 2026-11-08), so the glasses side sits behind a protocol with a fake for tests, and the real link needs hardware.
13. Distribution and licence: ships as a normal App Store app; the SDK is under Vuzix's proprietary licence, which forbids copying or redistributing the SDK (the sample apps are BSD-3-Clause). Source: https://www.vuzix.com/pages/vuzix%C2%AE-software-development-kit-license-and-confidentiality-agreement (dated 2023-07-24, s3.3, checked 2026-11-08).

## Critical errors (any one fails the case)

- Says the Z100 has a microphone or speaker the app can use.
- Says the iPhone app needs an SDK or app that does not exist for iOS, or says the Z100 has no iOS SDK.
- Presents API names that do not exist as Vuzix API. Real iOS names include `UltraliteManager.shared`, `currentDevice`, `isLinked`, `startScan(callback:)`, `link(device:callback:)`, `UltralitePickerController`, `requestControl(layout:timeout:hideStatusBar:showTapAnimation:maxNumTaps:autoReleaseControlOnDisplayTimeout:)`, `releaseControl()`, `sendText(text:)`, `sendNotification(title:message:)`, `canvas`, `ScrollLayout.LiveText`, `Notification.Name.tap`. There is no `setMaxNumTaps`. Code marked as unverified is not an error.
- Pastes a long block that it says is copied from Vuzix's samples or SDK files.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. If you mark a critical error, name it and quote the sentence from the answer. Compute the percent: points earned divided by 13, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
