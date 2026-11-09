---
type: llm
weight: 1
---

You are grading an answer to a developer who wants backend-generated text cards on Meta Ray-Ban Display glasses and plans to launch to all users next month on Android and iPhone. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them. Doc pages are under https://wearables.developer.meta.com/docs/develop/ unless a full URL is given.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Names the two ways to put content on Meta Ray-Ban Display: the Wearables Device Access Toolkit (DAT) Display capability used from a phone app, or a Web App (an HTTPS page that runs on the glasses). Sources: `dat/display-overview/` (updated 2026-11-05) and `webapps/setup/` (updated 2026-10-29), checked 2026-11-08.
2. Says clearly that publishing DAT integrations to all users is not open yet, so a general launch next month is not realistic. Source: Meta's answer of 2026-11-05 in https://github.com/meta/meta-wearables-dat-android/discussions/229 ("Publishing DAT integrations to all users isn't open yet, and right now there's no public application or review process for early access"), checked 2026-11-08.
3. Explains what is possible today: Developer Mode for development, and one private, invite-only release channel named Beta for invited testers (tester limit shown in the channel's Users tab). Source: `dat/set-up-release-channels/` (updated 2026-09-24, checked 2026-11-08).
4. Mentions that Meta's terms require an Integration Review approval before an integration is generally released. Source: https://wearables.developer.meta.com/terms section 4 (last updated 2025-10-06, checked 2026-11-08).
5. iPhone: says a DAT app cannot go on the App Store today because Meta cannot issue MFi PPIDs to third parties; TestFlight plus a release channel works. Source: https://github.com/meta/meta-wearables-dat-ios/discussions/313 (2026-09-28, checked 2026-11-08).
6. Web Apps: developer preview; wearers add the app through an install link or QR code and Developer Mode in the Meta AI app (the add screen labels it "unverified"); there is no public submission yet ("we'll share how to submit your experience soon"). Sources: `webapps/setup/`; https://developers.meta.com/wearables/explore (checked 2026-11-08). Half a point if it only says "developer preview".
7. Countries: Meta Ray-Ban Display is sold and supported only in the US, Canada, the UK, France, Germany and Italy. Source: https://www.meta.com/help/ai-glasses/4961066940605960/ (checked 2026-11-08).
8. Technical shape of DAT Display: a 600x600 display; the phone app sends a layout (FlexBox, Text, Image, Button and similar components) over Bluetooth, and each send replaces what is shown. Source: `dat/display-overview/`.
9. Data flow is right for each path: backend -> phone app -> DAT Display, or backend -> Web App over `fetch` or WebSocket from the glasses. Engineering item.
10. Requirements: DAT 1.0.1 needs the Meta AI app V292 or later and glasses firmware V128 or later; Android 10+ or iOS 17.2+. Sources: `dat/version-dependencies/` (updated 2026-10-20) and `dat/getting-started-toolkit/` (updated 2026-10-29), checked 2026-11-08. Half a point for "needs recent Meta AI app and firmware" without versions.
11. Android setup: Maven Central artifacts `com.meta.wearable:mwdat-core` and `com.meta.wearable:mwdat-display` (1.0.1), and the manifest meta-data `com.meta.wearable.mwdat.APPLICATION_ID` (0 in Developer Mode). Source: `dat/build-integration-android/` (updated 2026-10-29); Maven Central metadata (1.0.1, 2026-10-09), checked 2026-11-08.
12. Proposes a realistic plan: a tester beta now, a fallback for everyone else (phone screen, other glasses or audio), and launching on Meta Display only when publishing opens. Judgement item.

## Critical errors (any one fails the case)

- Says or implies the DAT integration or the Web App can be released to all users next month (on Google Play, the App Store or a Meta store) without the caveats above.
- Says Web Apps can be submitted to a public Meta store today.
- Says Meta Ray-Ban Display is sold worldwide or in all of the user's markets without checking.
- Presents DAT API names that do not exist as real API (for example `Wearables.showText`, `DisplayManager.publish`). Code marked as unverified is not an error.
- Pastes a long block that it says is copied from Meta's samples or docs.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 12, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
