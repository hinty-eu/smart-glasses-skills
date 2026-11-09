---
type: llm
weight: 1
---

You are grading an answer to a developer whose Android app uses Meta's Wearables Device Access Toolkit (DAT) for Meta Ray-Ban Display, where creating a session fails with `NO_ELIGIBLE_DEVICE` on one phone and an update-required error on another. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them. Doc pages are under https://wearables.developer.meta.com/docs/ unless a full URL is given.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Explains `NO_ELIGIBLE_DEVICE`: no connected and compatible device matched the device selector. So it checks the selector (for example a display-capable filter) against the glasses actually connected, and that the glasses are a Meta Ray-Ban Display (other Ray-Ban Meta models are displayless and cannot use Display). Sources: `reference/android/dat/1.0/com_meta_wearable_dat_core_types_devicesessionerror` and `develop/dat/getting-started-toolkit/` (updated 2026-10-29), checked 2026-11-08.
2. Android permissions: requests `BLUETOOTH_CONNECT` and also the `BLUETOOTH_SCAN` ("Nearby devices") runtime permission. Meta's answer: "BLUETOOTH_CONNECT alone isn't enough." Source: https://github.com/meta/meta-wearables-dat-android/issues/144 (2026-07-20, checked 2026-11-08).
3. Names the real error `DAT_APP_ON_THE_GLASSES_UPDATE_REQUIRED` and its documented fix: update from the App Connections page in the Meta AI app. Source: the DeviceSessionError reference above. Half a point if it handles "an update error" correctly without the exact name.
4. Notes that in DAT 1.0.x this error can also fire when the glasses fail to start the DAT app, so updating may not help. Recovery: check `Wearables.isDevMode` at the moment of failure, do not call `startRegistration()` again when already registered, force-stop and relaunch, try Meta's unmodified sample app, toggle Developer Mode and reinstall. Source: https://github.com/meta/meta-wearables-dat-android/issues/192 (2026-09-29, checked 2026-11-08). Half a point for two of these steps.
5. Version checks: DAT 1.0.1 needs the Meta AI app V292 or later and glasses firmware V128 or later; Android 10+. Source: `develop/dat/version-dependencies/` (updated 2026-10-20, checked 2026-11-08). Half a point without the numbers.
6. Registration: Developer Mode on in the Meta AI app (tap App Version five times) for an unpublished app, registration completed before creating a session, and for Beta builds the tester invited to the release channel. Sources: `develop/dat/display-overview/` (updated 2026-11-05) and `develop/dat/set-up-release-channels/` (updated 2026-09-24).
7. Manifest: `com.meta.wearable.mwdat.APPLICATION_ID` and `CLIENT_TOKEN` set to `0` in Developer Mode, or the Developer Center values for release-channel builds. Source: `develop/dat/build-integration-android/` (updated 2026-10-29, checked 2026-11-08).
8. Device state: glasses worn, awake, charged and connected in the Meta AI app when the session is created. Source: the fix steps in `develop/dat/display-overview/` include wearing the glasses.
9. Separates the other version errors: `INSUFFICIENT_SDK_VERSION` is terminal and needs a new app build; `DWA_OUT_OF_STU_RANGE` only warns and the session continues. Source: `develop/dat/version-dependencies/`. Half a point for naming one.
10. Debugging method: compares the two phones (permissions granted, Meta AI app version, firmware, Developer Mode state), reads the session's error stream or logs, and collects full logcat for a Meta GitHub issue. Engineering item, partly from issue #192.
11. Gives an ordered checklist the developer can run, rather than a list of guesses. Judgement item.

## Critical errors (any one fails the case)

- Says the error means the app must first be published or approved in a Meta store.
- Says DAT works with non-Meta glasses or with any Bluetooth device.
- Presents a fix that relies on an API or setting that does not exist (for example `Wearables.forceUpdate()`, `DeviceSelector.ANY_DEVICE`). Code marked as unverified is not an error.
- Pastes a long block that it says is copied from Meta's samples or docs.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 11, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
