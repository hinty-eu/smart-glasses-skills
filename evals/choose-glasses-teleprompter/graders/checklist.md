---
type: llm
weight: 1
---

You are grading an answer to a developer who must pick one pair of smart glasses for a teleprompter app that has to be released to the public this month and has to work with iPhone (Android optional). Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them. An answer that recommends a different target than the ones below can still score well if its reasons respect the two constraints and the facts.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Rules out Meta Ray-Ban Display for a public release this month: publishing DAT integrations to all users is not open (https://github.com/meta/meta-wearables-dat-android/discussions/229, Meta, 2026-11-05), DAT apps cannot go on the App Store because of MFi (https://github.com/meta/meta-wearables-dat-ios/discussions/313, 2026-09-28), and Web Apps have no public submission yet (https://developers.meta.com/wearables/explore). Checked 2026-11-08. Half a point if it rules Meta out with only one reason.
2. Treats Even Realities G2 as a candidate with the right facts: the app is a web plugin hosted by the Even app on iPhone and Android; the Even Hub store has a manual review against a fixed checklist; the review time is not published, so "this month" is a risk; no paid distribution yet. Sources: https://hub.evenrealities.com/docs/get-started/architecture , https://hub.evenrealities.com/docs/ship/app-submission (updated 2026-10-09), https://hub.evenrealities.com/docs/reference/faq (updated 2026-10-09), checked 2026-11-08.
3. Treats Vuzix Z100 as a candidate with the right facts: an iOS SDK (`UltraliteSDK`, iOS 14+) and an Android SDK; the app ships as an ordinary App Store app with no Vuzix store step documented. Source: https://github.com/Vuzix/UltraliteSDK-releases-iOS (checked 2026-11-08).
4. Flags Z100 hardware availability as a risk: launched in November 2024 at USD 499 (https://ir.vuzix.com/news-events/press-releases/detail/2104/vuzix-announces-general-availability-of-z100-smart-glasses), and the vuzix.com store showed both variants out of stock in an archived snapshot of 2026-07-10; current stock could not be confirmed on 2026-11-08. Half a point for a generic "check availability".
5. Considers USB-C display glasses (XREAL, VITURE and similar) used as an external display: needs an iPhone with DisplayPort over USB-C (iPhone 15 and later, not iPhone 16e or 17e, and iPhone Air has no DisplayPort out); the app shows its own content through an external-display scene; it ships as a normal App Store app with no vendor SDK. Sources: https://support.apple.com/en-us/105099 (published 2026-10-22), https://www.apple.com/iphone-air/specs/ , https://developer.apple.com/documentation/uikit/presenting-content-on-a-connected-display (checked 2026-11-08).
6. Mentions the iOS 27 change for external displays: the app gets the `windowExternalDisplayNonInteractive` scene only after it registers a scene accessory. Source: the Apple "Presenting content on a connected display" page above. Half a point if it mentions scenes without iOS 27.
7. Rokid: if mentioned, says the CXR-L iOS integration needs a registered Rokid developer account and bundle ID, so iPhone support involves a Rokid step. Source: Rokid CXR-L docs "iOS: SDK Integration" v1.2 (2026-09-08, https://developerdoc.rokid.com/sdk?lang=zh, checked 2026-11-08). Give the point if Rokid is not recommended for this brief, or is mentioned with this caveat.
8. Does not recommend a platform that cannot distribute today, or rules it out explicitly. MentraOS: "There is currently no way to distribute a miniapp built with the Miniapp SDK" (https://docs.mentraglass.com/app-devs/getting-started/distribution.md, checked 2026-11-09).
9. Teleprompter fit: needs a display (audio-only glasses such as Ray-Ban Meta are out), legible text and paging; notes display limits of the candidates (G2: 576x288 canvas, one firmware font, no font size control, https://hub.evenrealities.com/docs/build/display; Z100: 640x480 monochrome green, right eye only, https://support.vuzix.com/docs/display-process). Half a point without the display limits.
10. Input for advancing the script: G2 temple touchpads and R1 ring (https://hub.evenrealities.com/docs/build/device-apis); Z100 one to three taps anywhere on the frame (https://support.vuzix.com/docs/user-input); USB-C glasses offer no input to the app, so use the phone or a Bluetooth remote. Half a point for one brand.
11. Gives a clear, ranked recommendation tied to both constraints (public this month, iPhone), with a backup option. Judgement item.
12. Dates its claims or tells the team to re-check vendor status before committing, because platform rules and stock change. Judgement item.

## Critical errors (any one fails the case)

- Recommends Meta Ray-Ban Display (DAT or Web App) as shippable to the public this month.
- Recommends a MentraOS miniapp as shippable to the public now.
- Recommends audio-only glasses (Ray-Ban Meta without display, Oakley Meta) for a visual teleprompter without saying they have no display.
- Says Even G2 does not work with iPhone, or says the Z100 has no iOS SDK.
- Invents a vendor store, approval programme or SDK that does not exist.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 12, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
