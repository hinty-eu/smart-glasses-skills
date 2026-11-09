# Choosing which glasses to target

Read this before writing code, when the developer has not yet decided which glasses (or which rung of the
display-text ladder) to build for.

Last checked: 2026-11-08. Verification: docs-only (no hardware test yet). Platform facts come from the brand files in
[brands/](brands/); prices are press figures and change often; market numbers are dated where they appear.

## Ask the developer these questions first

Ask all of them in one message and wait for the answers. Each answer removes options.

1. **Phone platform:** Android, iOS, both, or no phone (an app that runs on the glasses)?
2. **Display or voice:** must the wearer read text, or is a short spoken line in the ear enough?
3. **Microphone:** whose voice do you capture? The wearer's (commands, dictation) suits a glasses mic; other people
   (captions, translation) usually suits the phone mic.
4. **Who installs it:** everyone through a public store now, invited testers, or only the developer?
5. **Countries:** where do the users live?
6. **Hardware budget:** can the developer buy one or more pairs, and at what price?
7. **Input:** none, two or three actions (repeat, skip, hide), or menus and navigation?
8. **Languages:** any non-Latin scripts (Arabic, Hebrew, Thai, Indic, CJK) or right-to-left text?

## Decision tree

Rung names are those of [display-text-ladder.md](display-text-ladder.md): 1 vendor SDK, 2 web app on the glasses,
3 USB-C external display, 4 mirrored phone notification, 5 voice in the ear.

```text
Must the wearer read text?
  no  -> rung 5: TTS on the phone over Bluetooth. Works on Ray-Ban Meta, Oakley Meta, Android XR audio glasses,
         Rokid, Halo and any earbuds. Normal store listing. See brands/meta-audio-glasses.md
  yes -> Must it reach the public now (not only testers)?
    yes -> Which phone?
      Android -> rung 1: Rokid CXR-L, Vuzix Ultralite, Even Hub plugin (store review, free apps only)
                 rung 3: USB-C display glasses with Presentation
                 rung 4: notifications for every other brand that mirrors them
      iOS     -> rung 1: Even Hub plugin, Vuzix Ultralite iOS; Rokid iOS (private pods, docs ask for a Rokid
                 developer account; unverified)
                 rung 3: external display scene (iPhone 15 or newer with USB-C video, not 16e, 17e, Air)
                 rung 4: notifications (ANCS)
      none    -> INMO Air3 app on Google Play (global version), or a Brilliant Labs Halo host app
    no (testers or developer only) -> also Meta Ray-Ban Display (DAT Beta channel, or a Web App in Developer
         Mode), MentraOS miniapps, Android XR display glasses (emulator only, none on sale), Snap Specs (not shipping)
  Then filter:
    glasses mic needed     -> Even G2, Rokid (CXR-L), Halo, Android XR (HFP). Not Vuzix Z100, not Meta Web Apps.
                              Meta DAT: HFP ends the Display session (as of 2026-11-08, fix "at a later date").
    non-Latin or RTL text  -> avoid Even G2 for Arabic, Hebrew, Thai, Devanagari and Halo for anything but ASCII;
                              phone-rendered paths (Vuzix LiveText, USB-C, bitmaps) handle any script
    input on the glasses   -> Even G2 (taps, swipes, ring) or Vuzix (1-3 taps); Rokid custom views get no taps;
                              USB-C and notifications get none (use the phone)
    Meta Ray-Ban Display   -> only US, CA, UK, FR, DE, IT
```

Default when the developer has no strong preference: build the ladder, not one brand. Rung 1 for the one or two
SDK brands the users actually own, rung 4 and rung 5 as fallbacks behind the same interface
([display-text-ladder.md](display-text-ladder.md)). One phone app then reaches almost every pair that is sold.

## Comparison

As of 2026-11-08. "Public" means anyone can install it from a store today.

| Target | Rungs | Phones | Glasses mic for you | Input reaching your app | Public today | Hardware price (press) | Test without hardware |
|---|---|---|---|---|---|---|---|
| [Even Realities G2](brands/even-g2.md) | 1, 4 | Android, iOS (Even app WebView) | Yes, 16 kHz PCM | Taps, swipes, long press, R1 ring | Yes, Even Hub review, free only | USD 599, R1 ring USD 249 | Official simulator |
| [Rokid Glasses](brands/rokid.md) | 1, 4, 5 | Android; iOS (unverified) | Yes, 16 kHz PCM | Lifecycle events only in custom views | Yes, your own listing | USD 499 at 2025 launch | Fake the session |
| [Vuzix Z100](brands/vuzix-z100.md) | 1, 4 | Android 12+, iOS 14+ | None | 1-3 frame taps | Yes, your own listing | USD 499 at launch (2024); sale unclear | Fake the SDK |
| [Meta Ray-Ban Display](brands/meta-display.md) | 1, 2, 5 | Android 10+, iOS 17.2+; Web Apps on the glasses | DAT HFP ends Display; Web Apps none | Buttons and focus (band, touchpad); Web: arrow keys, Enter | No: Beta testers, Developer Mode | USD 799 with Neural Band (US) | MockDeviceKit, Chrome extension |
| [Ray-Ban Meta, Oakley Meta](brands/meta-audio-glasses.md) | 5 | Any (Bluetooth) | HFP, wearer only | Media keys (unverified) | Yes, plain Bluetooth app | Gen 3 USD 449, Gen 2 USD 379 | Any Bluetooth headset |
| [USB-C display glasses](brands/usb-c-displays.md) | 3 | Android with DP out, iPhone 15+ | Varies, use phone | None | Yes, your own listing | About USD 400-650 | Emulator secondary display |
| [Any glasses via notifications](brands/notification-glasses.md) | 4 | Android, iOS | No | Dismiss | Yes, user enables your app | n/a | Android XR emulator only |
| [Android XR glasses](brands/android-xr.md) | 1, 4, 5 | Android | Yes, HFP 16 kHz | Touchpad, camera button | Audio glasses yes; display no | Not checked | Android Studio Canary emulator |
| [RayNeo X3 Pro, INMO Air3](brands/standalone-android-glasses.md) | 2, native | Run on the glasses | Android audio APIs (unverified) | Temple touchpad | Air3 on Google Play; RayNeo sideload | Not checked | 640x480 emulator profile |
| [Brilliant Labs Halo](brands/brilliant-labs.md) | 1 | Any BLE host | Yes, 2 mics | Button, IMU taps | Yes, your host app | USD 299-399 (unverified) | halo-emulator |
| [MentraOS](brands/mentra.md) | 1, 4 | Android, iOS (Mentra app) | Yes | Taps, swipes per glasses | No distribution yet | Mentra Live USD 449 | Runs, draws nothing |
| [Snap Specs](brands/snap-spectacles.md) | 1 | Run on the glasses | Yes, ASR module | Pinch, voice | Snap review, but not shipping | From USD 2,195 (pre-order) | Lens Studio Preview |

Price sources (read 2026-11-08): Even G2 [Tom's Guide](https://www.tomsguide.com/computing/smart-glasses/even-realities-g2-smart-glasses-review),
R1 [Hypebeast](https://hypebeast.com/2025/11/even-realities-unveils-g2-smart-glasses-and-r1-smart-ring), Meta
Ray-Ban Display [Neowin](https://www.neowin.net/amp/meta-launches-ray-ban-display-glasses-and-neural-band-for-799/)
(UK GBP 749, France EUR 899 per regional press), Rokid [LEDinside, 2025-09-05](https://ledinside.com/news/2025/9/2025_09_05_02),
Ray-Ban Meta [MIXED](https://mixed-news.com/en/ray-ban-meta-gen-3-449-nine-hours-action-button/), USB-C from vendor
and deal coverage such as [Notebookcheck](https://www.notebookcheck.com/Viture-Luma-Kompakte-Brillen-ab-399-Dollar-koennen-je-nach-Anwendung-auch-eine-Apple-Vision-Pro-Alternative-sein.1055407.0.html)
(prices disagree between sources). The rest come from the brand files.

## If you need to ship to the public this month

As of 2026-11-08 (November 2026):

- **Ships without any vendor gate:** an ordinary Android or iOS app with rung 3 (USB-C display glasses), rung 4
  (notifications mirrored by Even, Rokid, Vuzix, RayNeo, INMO Go3, Halliday and Android XR) and rung 5 (voice on
  Ray-Ban Meta and any Bluetooth audio). Add rung 1 for Rokid (CXR-L, no Rokid review in the docs) and Vuzix Z100
  (no Vuzix store or review). Store review time is the only delay.
- **Possible, plan for review:** an Even Hub plugin. Manual review, free apps only, review time not published, no
  rollback. Submit early in the month and expect a second round; read the review checklist in
  [brands/even-g2.md](brands/even-g2.md#publishing-and-distribution).
- **Possible, few users yet:** Android XR audio glasses through Google Play; Warby Parker pre-orders open on
  2026-11-12 with delivery in the holiday season ([9to5Google, 2026-11-05](https://9to5google.com/2026/11/05/android-xr-glasses-pre-order/)).
- **Not possible this month:** Meta DAT and Meta Web Apps for the public ("Publishing DAT integrations to all users
  isn't open yet", Meta staff, 2026-11-05), MentraOS miniapps (no distribution), Android XR display glasses (not on
  sale, publishing "stay tuned"), Snap Specs (not shipping yet).

For store and review details, see [publishing.md](publishing.md).

## If you want the biggest audience

- **Most owners wear glasses without a display.** Counterpoint, 2026-09-21: display-less models were 96% of AI
  glasses shipped in H1 2026, and Meta had 94% of that segment
  ([Counterpoint](https://counterpointresearch.com/en/insights/global-ai-glasses-shipments-surge-263-percent-yoy-with-display-less-ai-glasses)).
  So rung 5 (voice through Ray-Ban Meta and Oakley Meta, sold in 35 and 31 countries) reaches by far the most
  people, and it needs no Meta SDK.
- **Display glasses are a small, split market.** In the same half year China took 45% of display ("AR and AI")
  shipments and North America about 41% (Counterpoint, same page). Rokid claims 41% of the display segment (Rokid
  press release, 2026-09-29; Counterpoint has not published that table). Meta Ray-Ban Display is sold in six
  countries and cannot be published to yet.
- **Answer:** one phone app with rung 5 for audio glasses, rung 4 for every display pair, and rung 1 for Even G2,
  Rokid and Vuzix where the user has them. Add Meta DAT behind a feature flag for testers so it is ready when
  publishing opens.

## Budget

- **No hardware at all:** you can still build and test Even Hub (official simulator), Meta DAT Display (MockDeviceKit
  and the Chrome extension), Android XR glasses and their notification bridge (emulator), and USB-C displays
  (emulator secondary display, iOS Simulator). Rokid and Vuzix have no simulator: fake them behind the interface.
  See [testing-without-hardware.md](testing-without-hardware.md).
- **One pair for a display product:** Even G2 or Rokid Glasses. Both can be published to today, both have a
  microphone for your app, both launched under USD 600. Vuzix Z100 is in the same price class but has no microphone
  and its retail availability is unclear.
- **Audio product:** any Ray-Ban Meta pair; a normal Bluetooth headset reproduces most audio routing first.

## Cross-brand libraries and the ecosystem map

- **`hkust-spark/xg-glass-sdk`** (Apache-2.0, [GitHub](https://github.com/hkust-spark/xg-glass-sdk), read 2026-11-08)
  wraps camera video, microphone audio, display output and audio output behind one API: Kotlin on Android (Maven
  Central, minSdk 28), a Swift package for a subset on iOS, a Python CLI with a `--sim` mode. Adapters: RayNeo (X2
  validated, X3 Pro untested), INMO Air3 and Even G1 (validation pending), Rokid, Brilliant Labs Frame, Omi Glass,
  Meta as a later validation target. It helps when you need camera and microphone on several of those brands with
  one code path. It does not cover Even G2 or Vuzix Z100, and it does not change any vendor's publishing rules.
- **Extentos `smart-glasses-ecosystem`** ([GitHub](https://github.com/extentos/smart-glasses-ecosystem), CC BY 4.0):
  a dated capability map of 36 platforms and 142 device models with sources per cell, last updated 2026-08-24.
  Use it to check a brand this repo does not cover. Extentos sells its own SDK and says so in the README.

## Related
- [display-text-ladder.md](display-text-ladder.md) for the interface and runtime fallback.
- [input.md](input.md), [ui-small-screens.md](ui-small-screens.md), [audio-routing.md](audio-routing.md).
- [platforms.md](platforms.md) for the generated one-table summary.
