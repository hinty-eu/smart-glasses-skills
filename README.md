# Smart Glasses Skills

> **Preview.** This repository is being built in the open. v1.0 is planned for 25 November 2026.

Agent skills that teach coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI) how to build apps for smart
glasses from every major brand: pick a target, get text onto the display, handle input and audio, test without the
hardware, and check what you can actually publish today.

```bash
npx skills add hinty-eu/smart-glasses-skills
```

<details>
<summary>Claude Code plugin</summary>

```
/plugin install smart-glasses-skills --marketplace hinty-eu/smart-glasses-skills
```

</details>

## Platforms

<!-- platforms:start columns=display,text,publish -->
| Glasses | Display | Text from your app | Publish to everyone today | Checked |
|---|---|---|---|---|
| Even Realities G2 | 576x288 canvas, 16 levels of green, both eyes [O](https://hub.evenrealities.com/docs/build/display) | Even Hub plugin: web app run by the Even phone app [O](https://hub.evenrealities.com/docs/get-started/architecture) | Yes, Even Hub store, manual review, no paid apps yet [O](https://hub.evenrealities.com/docs/reference/faq) | 2026-11-08 |
| Meta Ray-Ban Display + Neural Band | 600x600, full colour, right eye only, ~20 deg FOV [P](https://roadtovr.com/meta-ray-ban-smart-glasses-display-price-release-date-specs/) | DAT Display API from a phone app, or a Web App [O](https://wearables.developer.meta.com/docs/develop/dat/display-overview/) | No: DAT Beta channel testers only; Web Apps via Dev Mode [O](https://github.com/meta/meta-wearables-dat-android/discussions/229) | 2026-11-08 |
| Rokid Glasses | Monochrome green micro-LED, both eyes, ~480 px wide [P](https://www.tomsguide.com/computing/smart-glasses/rokid-glasses-review) | CXR-L custom view from your phone app, or notifications [O](https://developerdoc.rokid.com/sdk?lang=zh) | Yes, your own store listing; no Rokid review in the docs [O](https://developerdoc.rokid.com/sdk?lang=zh) | 2026-11-08 |
| Vuzix Z100 | 640x480, monochrome green, right eye [O](https://www.vuzix.com/products/z100-smart-glasses) | Ultralite SDK in your phone app, or mirrored notifications [O](https://github.com/Vuzix/ultralite-sdk-android) | Yes, as a normal app on Google Play or the App Store [S](https://extentos.com/docs/ecosystem/platforms/vuzix) | 2026-11-08 |
| Ray-Ban Meta, Oakley Meta, Ray-Ban Meta Audio | None (open-ear speakers, mics; camera except Audio) [O](https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/) | None; voice in the ear (TTS over Bluetooth A2DP) [O](https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/) | Bluetooth audio app: yes; DAT: Beta channel testers only [O](https://github.com/meta/meta-wearables-dat-android/discussions/229) | 2026-11-08 |
| USB-C display glasses (XREAL, VITURE, RayNeo Air) | External monitor over USB-C DP Alt Mode, tinted [O](https://tutorials.xreal.com/docs/glasses/one-series/first-use/connect-device) | Android Presentation, iOS external display scene [O](https://developer.android.com/reference/android/app/Presentation) | Yes, your normal app store listing, no vendor step [O](https://www.rayneo.com/pages/product-compatibilities) | 2026-11-08 |
| Standalone Android glasses (RayNeo X3 Pro, INMO Air3) | X3 Pro 640x480 colour, both eyes; Air3 1080p [O](https://rayneo.gitbook.io/rayneo-devdoc/x-xi-lie/she-ji-gui-fan.md) | Web page in a browser on the glasses, or your APK [O](https://rayneo.gitbook.io/rayneo-devdoc/x-xi-lie/she-bei-jie-shao) | RayNeo: sideload via ADB; Air3: Google Play [O](https://rayneo.gitbook.io/rayneo-devdoc/chang-jian-wen-ti/adb-tiao-shi/adb-zhi-ling.md) | 2026-11-08 |
| Any display glasses via phone notifications (no SDK) | Title plus 1-3 lines for a few seconds, per brand [?](https://support.evenrealities.com/hc/en-us/articles/14274501482639-Notifications) | Post a normal notification; companion app mirrors it [O](https://developer.android.com/develop/xr/jetpack-xr-sdk/glasses/notifications/behavior) | Yes, no approval; user enables your app per brand [O](https://developer.android.com/develop/xr/jetpack-xr-sdk/glasses/notifications/behavior) | 2026-11-08 |
| Android XR display and audio glasses | Display glasses: none on sale yet [P](https://developer.android.com/develop/xr/devices) | Projected activity + Compose Glimmer (alpha) [O](https://developer.android.com/jetpack/androidx/releases/xr-glimmer) | Audio glasses: Google Play; display: not yet [O](https://developer.android.com/develop/xr/package-and-distribute) | 2026-11-08 |
| MentraOS (Even G1/G2, Vuzix Z100, Mentra Live) | Per glasses; design for 500x220 text [O](https://docs.mentraglass.com/app-devs/core-concepts/display/layouts.md) | Miniapp: session.display.render (beta SDK) [O](https://docs.mentraglass.com/app-devs/core-concepts/display/layouts.md) | No: miniapps cannot be distributed yet [O](https://docs.mentraglass.com/app-devs/getting-started/distribution.md) | 2026-11-08 |
| Brilliant Labs Halo (and Frame) | Halo: colour, 256x256 round area; Frame 640x400 [O](https://docs.brilliant.xyz/llms-full.txt) | Lua sent over BLE from your host app [O](https://docs.brilliant.xyz/llms-full.txt) | Yes, ship your own host app; no store [O](https://docs.brilliant.xyz/llms-full.txt) | 2026-11-08 |
| Snap Specs (Spectacles) | Standalone AR, both eyes; Specs not shipping yet [O](https://www.specs.com/smart-glasses/specs-27) | Lens in Lens Studio 5.24 (TypeScript, Text) [O](https://ar.snap.com/download) | Snap review 2-3 days; no Experimental APIs [O](https://developers.snap.com/spectacles/get-started/start-building/publishing-lens) | 2026-11-08 |
<!-- platforms:end -->

## What these skills do, send and download

The skills are plain Markdown files that your agent reads. They do not run code on install, send data anywhere or
download anything. The examples in `examples/` are small apps you build yourself; each one says what it connects to.

## Who maintains this

Built and maintained by the team behind [Hinty Voice Assistant](https://www.hinty.eu/assistant/smart-glasses?utm_source=github&utm_medium=readme&utm_campaign=smart-glasses-skills).
Vendor names are used only to identify products; see [TRADEMARKS.md](TRADEMARKS.md).

## License

Code and skills: [Apache-2.0](LICENSE). Data in `data/`: [CC BY 4.0](LICENSE-DATA).
