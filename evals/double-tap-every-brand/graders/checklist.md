---
type: llm
weight: 1
---

You are grading an answer to a developer who wants "double tap = repeat the last caption" in a captions app on Even Realities G2, Vuzix Z100, Rokid Glasses and Meta Ray-Ban Display, and asks whether it is possible on all four. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Even G2: a double tap from the temple touchpads or the R1 ring arrives through `onEvenHubEvent` as `OsEventTypeList.DOUBLE_CLICK_EVENT`. Source: https://hub.evenrealities.com/docs/build/device-apis (updated 2026-08-29, checked 2026-11-08); SDK 0.0.16 typings.
2. Even G2: on the root page a double tap must call `bridge.shutDownPageContainer(1)` (system exit dialog), and apps that do something else on a root-page double tap are rejected in review. So "repeat" needs another gesture there (single tap, swipe, long press or a contextual menu item). Source: https://hub.evenrealities.com/docs/ship/app-submission (updated 2026-10-09, checked 2026-11-08).
3. Even G2: reads every event envelope (taps can arrive in `sysEvent`, and a single tap may come without an `eventType`). Source: community reports https://github.com/even-realities/everything-evenhub/issues/30 and /31 (open, checked 2026-11-08). Half a point for "check sysEvent too".
4. Vuzix Z100: taps are counted anywhere on the frame (single, double or triple; no left or right, no swipes), so a double tap is a tap count of 2. Source: https://support.vuzix.com/docs/user-input (2024-01-09, checked 2026-11-08).
5. Vuzix Z100: taps are reported only after the app takes control and sets the maximum tap count (iOS `requestControl(... maxNumTaps:)`, Android the max-taps argument of `setLayout`); the default 0 reports no taps. Sources: https://vuzix.github.io/UltraliteSDK-releases-iOS/documentation/ultralitesdk/ ; https://github.com/Vuzix/UltraliteSDK-releases-iOS/issues/4 (Vuzix, May 2025); https://vuzix.github.io/ultralite-sdk-android/javadoc/ (checked 2026-11-08). Half a point if control is mentioned but not the tap count setting.
6. Rokid: a phone app with a `CUSTOM_VIEW` session does not receive touchpad events. Temple key and touchpad events (including `DOUBLE_CLICK`) are system broadcasts to glasses-side apps, so a double tap needs a glasses-side app (`CUSTOM_APP` session with the CXR-S SDK) that forwards the event to the phone (`sendMessage("rk_custom_key", ...)` arriving in `onCustomCmdResult`). Source: Rokid CXR-L docs "Glasses Keys and System Broadcasts" v1.2 (2026-09-08), https://developerdoc.rokid.com/sdk?lang=zh , checked 2026-11-08. Half a point for "needs a glasses-side app" without the mechanism.
7. Meta Ray-Ban Display with DAT Display: there is no double-tap event for display content; the app gets `onClick` on buttons it sends (pinch on the Neural Band or a touchpad tap), and Back ends the display session. Sources: https://wearables.developer.meta.com/docs/develop/dat/display-android/ (updated 2026-11-05), checked 2026-11-08.
8. Meta: the raw `Inputs` capability, where "A double tap on the touchpad arrives as `Select`", is beta and not for production. Source: https://wearables.developer.meta.com/docs/develop/dat/inputs/ (updated 2026-11-06, checked 2026-11-08).
9. Meta Web Apps (if mentioned): the page receives only `keydown` for `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` and `Enter`, with no double-tap event, so "repeat" is a focusable button. Source: https://wearables.developer.meta.com/docs/develop/webapps/build/input-and-navigation/ (updated 2026-09-27, checked 2026-11-08). Give the point if Web Apps are not discussed but item 7 is right.
10. Proposes one shared "repeat" action with a per-device mapping and a visible alternative where a double tap is not available (on-screen button on Meta, phone button for Rokid, another gesture on the G2 root page). Engineering item.
11. Answers the question directly: a uniform double tap is not possible on all four, and says which ones and why. Judgement item tied to items 2, 6 and 7.

## Critical errors (any one fails the case)

- Says a uniform double-tap API exists on all four.
- Says a Rokid phone app with a custom view receives taps, or that a Meta Display app receives double taps from the Neural Band without the beta caveat.
- Recommends mapping the G2 root-page double tap to "repeat" as fine for store review.
- Presents API names that do not exist (for example `onDoubleTap` on any of these SDKs, `setMaxNumTaps` on Vuzix, `bridge.onGesture`). Real names include `onEvenHubEvent`, `OsEventTypeList.DOUBLE_CLICK_EVENT`, `shutDownPageContainer`, Vuzix `requestControl`, `Notification.Name.tap`, `EventListener.onTap(int)`, Rokid `onCustomCmdResult`, Meta `onClick`. Code marked as unverified is not an error.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 11, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
