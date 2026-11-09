import AVFoundation

/// Rung 5: voice in the ear. Final captions are read with AVSpeechSynthesizer; with Bluetooth glasses or earbuds
/// connected, the playback category routes the audio to them (A2DP), so this works on audio-only pairs such as
/// Ray-Ban Meta. A pair connected for calls only (HFP) needs the play-and-record category instead.
///
/// Audio session: playback + spokenAudio, ducking other audio while a caption is read and pausing spoken audio such as
/// podcasts; deactivated with notifyOthersOnDeactivation so music comes back. With the `audio` background mode the
/// app keeps running while it speaks; between captions iOS may still suspend it (unverified).
/// Trade-off: both options imply mixWithOthers, so this app never becomes Now Playing and taps on audio glasses keep
/// controlling the user's music instead of reaching MPRemoteCommandCenter. Input for this target stays on the phone.
@MainActor
final class SpeechDisplay: NSObject, GlassesDisplay, AVSpeechSynthesizerDelegate {
  let id = "speech"
  let budget = LineBudget(lines: 1, cols: 80, partials: false)
  private weak var host: DisplayHost?
  private let synthesizer = AVSpeechSynthesizer()
  private var pending = 0

  init(host: DisplayHost) {
    self.host = host
    super.init()
    synthesizer.delegate = self
  }

  func connect() {
    do {
      try AVAudioSession.sharedInstance().setCategory(
        .playback, mode: .spokenAudio, options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
      host?.onStatus(id, "ready, connect Bluetooth glasses or earbuds")
    } catch {
      host?.onStatus(id, "audio session failed: \(error.localizedDescription)")
    }
  }

  func show(_ lines: [String]) {}  // nothing to draw

  func onFinal(_ text: String) {
    guard !text.isEmpty else { return }
    if pending == 0 { try? AVAudioSession.sharedInstance().setActive(true) }
    pending += 1
    // The default voice follows the phone's language; set utterance.voice to match the caption language
    synthesizer.speak(AVSpeechUtterance(string: text))
  }

  /// Skip and hide stop the current sentence and drop the queue.
  func clear() {
    _ = synthesizer.stopSpeaking(at: .immediate)
    pending = 0
    deactivate()
  }

  func disconnect() {
    clear()
    host?.onStatus(id, "disconnected")
  }

  private func finished() {
    pending = max(0, pending - 1)
    if pending == 0 { deactivate() }
  }

  private func deactivate() {
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    Task { @MainActor [weak self] in self?.finished() }
  }

  nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    Task { @MainActor [weak self] in self?.finished() }
  }
}
