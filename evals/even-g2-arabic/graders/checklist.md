---
type: llm
weight: 1
---

You are grading an answer to a developer whose Even Realities G2 app shows short server messages, where Arabic text does not appear on the glasses while English works. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Explains that the G2 renders text with a single font built into the firmware, with no font selection and no size control, and that "Characters outside the font set are silently dropped." Source: https://hub.evenrealities.com/docs/build/display (updated 2026-10-09, checked 2026-11-08).
2. Says Arabic glyphs are not in that font, so the empty display is expected behaviour, not a bug in the app. Source: community probe on simulator 0.9.5 in https://github.com/even-realities/everything-evenhub/issues/37 (open, checked 2026-11-08; the official docs do not list scripts). Half a point if it only suspects a font problem.
3. Says the app cannot ship its own font. Source: FAQ "Can I use my own font? No." https://hub.evenrealities.com/docs/reference/faq (updated 2026-10-09, checked 2026-11-08).
4. Notes that right-to-left layout and Arabic letter shaping are not documented for text containers (nothing in the docs as of 2026-11-08), so even with glyphs the text would need shaping and reordering.
5. Proposes the workaround: render the Arabic text to a bitmap in the plugin's WebView (for example a Canvas, which applies the browser's shaping and right-to-left order) and send it to an image container with `updateImageRawData`. Sources: display page above; issue #37 calls rendered images "the current workaround".
6. States the image container limits: up to 288 x 144 px per container, at most 4 image containers per page, 4-bit greyscale. Source: display page above. Half a point for one or two of the three.
7. Respects the image rules: the image container starts empty and cannot be filled during `createStartUpPageContainer`; no concurrent image sends; await each `updateImageRawData`. Source: display page above.
8. Uses an accepted data format: `updateImageRawData` takes `number[]`, `Uint8Array`, `ArrayBuffer` or base64; the official image template passes encoded PNG or JPEG bytes and the SDK converts them to 4-bit greyscale. Sources: display page above; https://github.com/even-realities/evenhub-templates (image template, checked 2026-11-08).
9. Keeps one event-capturing text container on the page (for example a full-screen text container with `content: ' '` and `isEventCapture: 1` behind the image), because exactly one container must capture input. Source: display page above.
10. Sets expectations on speed: a full-screen image refresh takes around 800 ms and image sends are paced at 100 ms, so images suit short messages, not fast live text. Source: display page and FAQ above.
11. Keeps the fast text path for supported scripts: detects Arabic (or any unsupported characters) and only renders those messages as images. Engineering item.
12. Says to verify on real glasses, because the simulator "is not a hardware emulator" and font rendering may differ. Source: https://hub.evenrealities.com/docs/test/simulator (updated 2026-08-29, checked 2026-11-08).

## Critical errors (any one fails the case)

- Says Arabic in a text container can be fixed by changing the text encoding, installing or uploading a font to the glasses, or setting a language or direction option on the container. (Using a web font inside the WebView to draw the text into a canvas image is correct, not this error.)
- Presents an SDK method that does not exist (for example `setFont`, `setTextDirection`, `rtl: true` on `TextContainerProperty`). Real names include `TextContainerProperty`, `ImageContainerProperty`, `createStartUpPageContainer`, `rebuildPageContainer`, `textContainerUpgrade`, `updateImageRawData`, `ImageRawDataUpdate`. Code marked as unverified is not an error.
- Recommends image containers larger than 288 x 144 px or more than 4 per page as if that worked.
- Pastes a long block that it says is copied from a vendor template.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. If you mark a critical error, name it and quote the sentence from the answer. Compute the percent: points earned divided by 12, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
