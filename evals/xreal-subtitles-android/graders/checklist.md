---
type: llm
weight: 1
---

You are grading an answer to a developer who wants an Android app to show subtitles on XREAL One glasses while the phone keeps its own UI, with code, and asks what changes on iPhone. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Explains that XREAL One connects over USB-C and works as an external display (DisplayPort Alt Mode), so the phone's port must support DP video output. Source: https://tutorials.xreal.com/docs/glasses/one-series/first-use/connect-device ("your device interface must support the DP video output protocol"), checked 2026-11-08.
2. Android: uses `android.app.Presentation` on a display from `DisplayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)` (or `MediaRouter`), so the phone keeps its own activity UI. Source: https://developer.android.com/reference/android/app/Presentation (checked 2026-11-08).
3. Handles connect and disconnect with `DisplayManager.DisplayListener` (`onDisplayAdded`, `onDisplayRemoved`, `onDisplayChanged`), knowing that a Presentation is automatically cancelled when its display is removed. Sources: Presentation reference above; https://developer.android.com/reference/android/hardware/display/DisplayManager.DisplayListener (checked 2026-11-08).
4. Does not set a window type on the Presentation: from Android 12 the Presentation creates its own window context and `Window#setType` leads to `WindowManager.InvalidDisplayException` on `show()`. Source: Presentation reference above. Give the point if the code simply never calls `setType`, half a point if it calls it only below Android 12.
5. Says no XREAL SDK is needed for a 2D subtitle window: the XREAL SDK is a Unity XR plugin for spatial apps, and a plain Presentation works on the external display. Source: https://docs.xreal.com/ (SDK 3.1.0, "operates under the Unity XR Plugin umbrella"), checked 2026-11-08.
6. Designs for optical see-through: black is transparent on these glasses ("Black = Transparent"), so subtitles use bright text on a black background and stay out of the centre of view. Source: https://docs.xreal.com/Design%20Guide/Display (checked 2026-11-08).
7. Notes that screen stabilisation (3DoF anchor versus follow mode) is handled by the glasses' X1 chip and user settings, not by the app. Sources: https://docs.xreal.com/XREALDevices/XREAL%20Glasses ; https://www.xreal.com/one-pro (checked 2026-11-08). Half a point for a vague mention.
8. Testing without glasses: Android developer option "Simulate secondary displays" or the emulator's extended controls (Displays). Sources: https://developer.android.com/studio/debug/dev-options (updated 2026-10-28), https://developer.android.com/studio/run/emulator-extended-controls (checked 2026-11-08).
9. Phone compatibility: not every Android phone outputs video over USB-C; XREAL says the port must support DP video output and to ask the phone maker if unsure. Source: XREAL tutorial above.
10. iPhone hardware: needs an iPhone with DisplayPort over USB-C, which Apple lists as iPhone 15 and later except iPhone 16e and 17e; iPhone Air has no DisplayPort output. Sources: https://support.apple.com/en-us/105099 (published 2026-10-22), https://www.apple.com/iphone-air/specs/ (checked 2026-11-08). Half a point for "iPhone 15 or later" without the exceptions.
11. iPhone software: by default the system mirrors the screen; to show different content the app provides a scene with the session role `windowExternalDisplayNonInteractive` (UIKit scene life cycle). Source: https://developer.apple.com/documentation/uikit/presenting-content-on-a-connected-display (checked 2026-11-08).
12. Mentions the iOS 27 change: the app receives that external-display scene only after it registers a scene accessory (`UIViewController.registerSceneAccessory(_:)` with `UISceneAccessory.externalNonInteractive(sceneConfiguration:userInfo:)`). Source: Apple page above. Half a point for "registration is needed on iOS 27" without names.
13. Notes that Apple will require the UIScene life cycle ("In the next major release following iOS 26, UIScene lifecycle will be required when building with the latest SDK"), so the older `UIScreen.screens` approach is not the way for a new app. Source: https://developer.apple.com/documentation/technotes/tn3187-migrating-to-the-uikit-scene-based-life-cycle (checked 2026-11-08).

## Critical errors (any one fails the case)

- Says the XREAL SDK or Unity is required to show a 2D subtitle window.
- Proposes only screen mirroring, which cannot show different content on the glasses and the phone.
- Says any iPhone (including Lightning models or iPhone 16e) can drive the glasses as an external display.
- Presents API names that do not exist as Android, Apple or XREAL API (for example `XrealDisplay.show()`, `DisplayManager.getGlassesDisplay()`). Code marked as unverified is not an error.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. If you mark a critical error, name it and quote the sentence from the answer. Compute the percent: points earned divided by 13, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
