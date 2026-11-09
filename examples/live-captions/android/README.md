# Live captions: native Android target

Verification: `compiles` (2026-11-08). Both flavors build with Gradle 9.8.1, AGP 9.5.1 and JDK 17, and the
line-fitting unit tests pass. Nothing here has run on glasses yet.

One Kotlin app (single Activity, plain Views, no Compose) that connects to the example server, lets you pick a target
and shows the captions through one interface:

```kotlin
interface GlassesDisplay {
    val id: String; val budget: LineBudget          // budget = lines x cols the target can show
    fun connect(); fun show(lines: List<String>); fun onFinal(text: String) {}; fun clear(); fun disconnect()
}
enum class InputAction { REPEAT, SKIP, HIDE }       // every target maps its gestures to these
```

`CaptionLines` turns the stream into lines for a budget (partials replace the last line until final, finished lines
never move, a caption marked `"repeat":true` is shown again without being added twice), `CaptionController`
throttles partial updates per target and applies the actions, `CaptionSocket` speaks the server protocol
(`ws://HOST:PORT/ws?room=CODE`, hello, caption, clear, action) and reconnects with backoff. While connected, a repeat
goes through the server, which sends the last line back to every screen in the room; offline it repeats locally.

## Targets (the display-text ladder)

| Rung | Class | How text gets there | Wearer needs | Input from the glasses |
|---|---|---|---|---|
| - | `PhonePreviewDisplay` | Phone screen only, for testing without hardware | nothing | phone buttons |
| 1 | `RokidDisplay` | Rokid CXR-L `com.rokid.cxr:client-l:1.1.2`, CUSTOM_VIEW session, `customViewUpdate` | Hi Rokid app, glasses connected in it, one approval | none (taps on a custom view do not reach the phone) |
| 1 | `VuzixDisplay` | Vuzix Ultralite `com.vuzix:ultralite-sdk-android:1.9`, text layout, `sendText` | Vuzix Connect app with the Z100 paired | 1 tap repeat, 2 skip (`maxNumTaps` 2); hide on the phone |
| 1 | `MetaDisplay` (`meta` flavor) | Meta DAT `mwdat-core` + `mwdat-display` 1.0.1, `sendContent` | Meta AI app, Developer Mode, Meta Ray-Ban Display | on-screen Repeat / Hide buttons |
| 3 | `PresentationDisplay` | `android.app.Presentation` on the external display | USB-C display glasses (DisplayPort Alt Mode) | none |
| 4 | `NotificationDisplay` | A new notification per final caption, at most one every 2.5 s, the last 3 kept | glasses app that mirrors notifications, this app allowed there | notification buttons |
| 5 | `SpeechDisplay` | `TextToSpeech`, media usage, transient ducking focus | any Bluetooth audio (glasses or earbuds) | phone buttons |

Rung 2 (a web app on the glasses) is the `web-glasses` example next to this folder.

minSdk is 31 (Android 12): the Vuzix README asks for Android 12+ (its AAR declares 30), Rokid needs 28, Meta 29, and
from Android 12 a `Presentation` has its own window context, so it can be created from the application context.

## Build

Requirements: JDK 17, Android SDK platform 36. The Gradle wrapper jar is not committed (this repository holds no
binaries), so either open this folder in Android Studio, which reads `gradle/wrapper/gradle-wrapper.properties`, or
create the wrapper once with any Gradle install:

```sh
gradle wrapper --gradle-version 9.8.1
./gradlew assembleStandardDebug testStandardDebugUnitTest
# APK: app/build/outputs/apk/standard/debug/app-standard-debug.apk
```

The `examples` workflow builds the same APK and attaches it as the artifact `live-captions-android-debug`, so a tester
can install it without a toolchain. The APK bundles the Rokid and Vuzix SDKs under their vendors' terms.

All dependencies resolve without credentials (checked 2026-11-08): Google and Maven Central, Rokid's Maven
(`https://maven.rokid.com/repository/maven-public/`, restricted to the `com.rokid.cxr` group) and JitPack (restricted to
`com.vuzix`). Pin `client-l` to 1.1.2: the 1.2.X-SNAPSHOT on Rokid's Maven needs a newer Hi Rokid app. JitPack knows
the Vuzix tag `1.9`, not `1.9.0`.

## Run

1. Start the server from `examples/live-captions`: `node server/server.mjs --demo`. It prints a 6-character room code.
2. Phone and computer on the same Wi-Fi. Enter `<computer-ip>:8787` (or `10.0.2.2:8787` in the emulator) and the code.
3. Pick a target and press Connect. The black box shows exactly what is sent to the glasses.

The app uses plain `ws://` on your LAN, so the manifest allows cleartext traffic; use `wss://` for anything else.
Everything lives in the Activity: captions stop when it is destroyed. A production app moves `CaptionController` into a
foreground service so captions keep flowing with the screen off.

Without hardware: the phone preview target; for `PresentationDisplay`, add a secondary display to a running emulator
(Extended controls > Displays) or turn on Developer options > Simulate secondary displays; for `SpeechDisplay`, any
Bluetooth earbuds. Rokid's SDK ships ARM code only, so the Rokid target refuses to start on an x86 emulator.

## Meta flavor

```sh
./gradlew assembleMetaDebug   # Developer Mode build, application id dev.smartglasses.livecaptions.meta
./gradlew assembleMetaRelease -PmwdatApplicationId=<id> -PmwdatClientToken=<token>   # values from the Wearables Developer Center
```

Since 2026-09-15 the toolkit is on Maven Central and needs no GitHub token
([README](https://github.com/meta/meta-wearables-dat-android)). It stays a separate flavor because it is a developer
preview under the [Meta Wearables Developer Terms](https://wearables.developer.meta.com/terms), it needs registration in
the Meta AI app, and its AARs carry Kotlin 2.2 metadata (AGP 9's built-in Kotlin is new enough; older Kotlin is not).
Turn on Developer Mode in the Meta AI app before the first connect. The flavor opts out of the toolkit's analytics and
crash reporting in `src/meta/AndroidManifest.xml`. For deeper DAT work install Meta's own agent skills
(`npx skills add meta/meta-wearables-dat-android`, or as Meta's README documents for Claude Code:
`claude plugin marketplace add facebook/meta-wearables-dat-android`, then
`claude plugin install mwdat-android@mwdat-android-marketplace`; the `facebook/` path redirects to `meta/`).

## Pitfalls

- Meta: grant `BLUETOOTH_CONNECT` and `BLUETOOTH_SCAN` before `Wearables.initialize`. Developers report that an early
  initialize leaves the glasses link `DISCONNECTED` for the life of the process, and that a missing `BLUETOOTH_SCAN`
  shows up as a silent `NO_ELIGIBLE_DEVICE`
  ([issue 177](https://github.com/meta/meta-wearables-dat-android/issues/177),
  [issue 175](https://github.com/meta/meta-wearables-dat-android/issues/175)). `MetaDat` defers initialize for that reason.
- Rokid: Hi Rokid shows a one-time "unverified app" confirmation, and community reports say `customViewUpdate` can
  return success without redrawing on some Global builds; if text goes stale, close and reopen the session.
  The SDK's consumer R8 rules strip `Log.d` and `Log.v` from the whole app in minified builds, so log with `Log.i`.
- Vuzix: control of the display goes to the last app that asks. Do not request it back in a loop, and always call
  `releaseControl()` when done, or the last caption can stay on the glasses.
- Presentation: never call `window.setType()` on it (Android 12+ throws `InvalidDisplayException`). While the phone is
  locked the system shows its own lock-screen presentation on external displays.
- Notifications: the wearer must allow this app in the glasses app. How long a notification stays and how much text
  fits is up to that app (unverified per brand). The target posts a new notification per caption instead of updating
  one, because no brand documents how it forwards updates; see `notification-glasses.md` in the `smart-glasses` skill.
- Speech: media usage follows the Bluetooth media route; a pair that is connected for calls only (HFP) will not get it.

## Files

```
settings.gradle.kts, build.gradle.kts, gradle.properties, gradle/wrapper/gradle-wrapper.properties
app/build.gradle.kts                    flavors standard (default) and meta, dependencies
app/src/main/kotlin/.../                MainActivity, CaptionSocket, CaptionController, CaptionLines, GlassesDisplay,
                                        RokidDisplay, VuzixDisplay, PresentationDisplay, NotificationDisplay, SpeechDisplay
app/src/standard/kotlin/.../Flavor.kt   no Meta
app/src/meta/                           Flavor.kt (MetaDat), MetaDisplay.kt, AndroidManifest.xml
app/src/test/kotlin/.../CaptionLinesTest.kt
```

Vendor SDK terms: [Vuzix SDK licence](https://www.vuzix.com/pages/vuzix%C2%AE-software-development-kit-license-and-confidentiality-agreement),
[Meta Wearables Developer Terms](https://wearables.developer.meta.com/terms), Rokid publishes no licence for CXR-L
([SDK page](https://developerdoc.rokid.com/sdk?lang=zh)). The calls in this folder are written from the public API
reference, not copied from vendor samples.
