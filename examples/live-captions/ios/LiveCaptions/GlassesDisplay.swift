import Foundation

/// How much text a target can show. The caption stream is fitted to it on the phone.
/// `partials = false`: the target only gets final captions (notifications and speech would spam otherwise).
/// `minInterval` throttles partial updates for Bluetooth links.
struct LineBudget: Equatable {
  var lines: Int
  var cols: Int
  var partials = true
  var minInterval: TimeInterval = 0
}

/// The shared input actions. Every target maps its own gestures (taps, buttons, notification actions) to these.
enum InputAction: String, CaseIterable {
  /// Show (or say) the current caption again.
  case repeatCaption = "repeat"
  /// Drop what is shown now and wait for the next caption.
  case skip
  /// Blank the display until the next repeat or hide.
  case hide

  var title: String {
    switch self {
    case .repeatCaption: return "Repeat"
    case .skip: return "Skip"
    case .hide: return "Hide"
    }
  }
}

/// What a display needs from the app around it.
@MainActor
protocol DisplayHost: AnyObject {
  func onStatus(_ displayId: String, _ status: String)
  func onAction(_ action: InputAction)
}

/// One rung of the display-text ladder. The rest of the app never knows which glasses it drives.
@MainActor
protocol GlassesDisplay: AnyObject {
  /// Sent to the server in the hello message, e.g. "vuzix".
  var id: String { get }
  var budget: LineBudget { get }
  /// Ask for whatever is needed (permission, pairing, a display) and start. Progress goes to `DisplayHost.onStatus`.
  func connect()
  /// Replace what the wearer sees with these lines (already wrapped to `budget`).
  func show(_ lines: [String])
  /// Each final caption once, unwrapped. Targets that speak use it; drawing targets ignore it.
  func onFinal(_ text: String)
  /// Blank the display or stop talking, but stay connected.
  func clear()
  /// Give the display back and release everything.
  func disconnect()
}

extension GlassesDisplay {
  func onFinal(_ text: String) {}
}

/// For testing without hardware: the preview in ContentView is the only output.
@MainActor
final class PhonePreviewDisplay: GlassesDisplay {
  let id = "phone"
  let budget = LineBudget(lines: 3, cols: 32)
  private weak var host: DisplayHost?

  init(host: DisplayHost) { self.host = host }

  func connect() { host?.onStatus(id, "ready (phone preview only)") }
  func show(_ lines: [String]) {}
  func clear() {}
  func disconnect() {}
}
