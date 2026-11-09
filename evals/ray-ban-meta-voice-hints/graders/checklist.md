---
type: llm
weight: 1
---

You are grading an answer to a developer whose Android app records a conversation with the phone's microphone, generates short hints, and wants the hints spoken through Ray-Ban Meta glasses (no display) while recording continues. Grade only what the answer says; do not penalise extra correct detail, hedging, or notes that something is unverified. Facts below were checked against official sources on the date given; the answer does not need to cite them.

## Checklist (1 point each, 0.5 for partial, 0 if missing or wrong)

1. Says Ray-Ban Meta glasses (other than Meta Ray-Ban Display) have no display, so the only way to reach the wearer is audio through the open-ear speakers. Source: https://wearables.developer.meta.com/docs/develop/dat/getting-started-toolkit/ (updated 2026-10-29, calls them "displayless glasses"), checked 2026-11-08.
2. Plays hints with standard Android text-to-speech (`TextToSpeech.speak(text, queueMode, params, utteranceId)`) or normal audio playback, routed by the OS to the glasses over Bluetooth A2DP; no Meta SDK is needed for playback. Sources: https://developer.android.com/reference/android/speech/tts/TextToSpeech (updated 2026-08-03); https://wearables.developer.meta.com/docs/develop/dat/microphones-and-speakers/ (updated 2026-10-12, A2DP is "Output only", used for "Music, media playback, TTS"), checked 2026-11-08.
3. Explains why the glasses' own microphone is a trap here: A2DP and HFP are mutually exclusive; "activating HFP switches the glasses away from A2DP, and audio output drops to mono voice quality (16 kHz or 8 kHz)". Source: Meta microphones and speakers page above.
4. Records from the phone's built-in microphone explicitly, for example `AudioRecord.setPreferredDevice()` with an `AudioDeviceInfo` of type `TYPE_BUILTIN_MIC`, using `MediaRecorder.AudioSource.MIC` or `VOICE_RECOGNITION`. Sources: https://developer.android.com/reference/android/media/AudioRecord and https://developer.android.com/reference/android/media/AudioDeviceInfo (checked 2026-11-08). Half a point for "use the phone mic" without the routing call.
5. Does not call `setCommunicationDevice()`, `startBluetoothSco()` or `setMode(MODE_IN_COMMUNICATION)`, because these move audio to the Bluetooth headset profile; Android says `setMode` "should only be used by applications that replace the platform-wide management of audio settings or the main telephony application". Source: https://developer.android.com/reference/android/media/AudioManager (updated 2026-08-28, checked 2026-11-08).
6. Uses `QUEUE_FLUSH` (or stops the current utterance) so a new hint replaces a stale one, and keeps hints short. Source: TextToSpeech reference ("all entries in the playback queue ... are dropped and replaced by the new entry").
7. Sets audio attributes for the speech (for example `setAudioAttributes` with a speech content type and an assistant or navigation-guidance usage) and requests transient audio focus with ducking (`AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`), which does not stop the recording. Source: https://developer.android.com/media/optimize/audio-focus (updated 2026-10-28, checked 2026-11-08). Half a point for one of the two.
8. Handles echo: the spoken hint from open-ear speakers can reach the phone mic and get transcribed; the answer ignores or tags transcripts while a hint is playing, or uses an echo-cancelled source. Engineering item.
9. Background recording: on Android 14 and later, recording while the app is not visible needs a foreground service of type `microphone` (with `FOREGROUND_SERVICE_MICROPHONE` and `RECORD_AUDIO`), and that service cannot be started from the background. Source: https://developer.android.com/develop/background-work/services/fgs/service-types (updated 2026-10-28, checked 2026-11-08). Half a point for "use a foreground service" without the type.
10. Mic sharing: only one ordinary app can capture at a time ("Two ordinary apps can never capture audio at the same time"), so a call or the Meta AI assistant can silence the recording; the app should detect and recover. Source: https://developer.android.com/media/platform/sharing-audio-input (updated 2026-10-28, checked 2026-11-08).
11. Says Meta's Device Access Toolkit is not needed for this, and if it mentions DAT, notes that publishing DAT integrations to all users is not open yet. Source: https://github.com/meta/meta-wearables-dat-android/discussions/229 (Meta, 2026-11-05, checked 2026-11-08).
12. Privacy: open-ear speakers can be overheard, so hints should not contain sensitive data. Engineering item.

## Critical errors (any one fails the case)

- Recommends recording through the glasses' microphone (SCO/HFP, `setCommunicationDevice`, `startBluetoothSco`) while playing hints, without explaining that this drops output to mono voice quality and switches away from A2DP.
- Says Ray-Ban Meta has a display or that text can be shown on these glasses.
- Says a Meta SDK is required to play audio on the glasses, or presents a DAT audio-output API that does not exist.
- Says two ordinary apps can record from the microphone at the same time by default.
- Presents Android API names that do not exist (for example `AudioManager.setA2dpOnly`, `TextToSpeech.speakToBluetooth`). Code marked as unverified is not an error.

## Scoring

List each item with its score (1, 0.5 or 0) and one short reason, then list any critical error you found. Compute the percent: points earned divided by 12, times 100. Report the percent.

PASS if the percent is at least 70 and no critical error is present.
FAIL if the percent is below 70 or any critical error is present.
