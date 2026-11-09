import Foundation

/// Glue between the caption stream and one GlassesDisplay: fits the text to the display's budget, throttles partial
/// results for slow links, and applies the shared input actions. Same behaviour as the Android target.
@MainActor
final class CaptionController {
  var onPreview: (([String], Bool) -> Void)?
  var onSocketState: ((String) -> Void)?

  private let socket = CaptionSocket()
  private var captions = CaptionLines()
  private var display: GlassesDisplay?
  private var shown: [String] = []
  private var lastPushAt: TimeInterval = 0
  private var hidden = false
  private var connected = false
  private var trailing: Task<Void, Never>?

  init() {
    socket.onEvent = { [weak self] event in self?.handle(event) }
  }

  func start(server: String, room: String, target: GlassesDisplay) {
    setDisplay(target)
    socket.open(server: server, room: room, hello: hello(target))
  }

  /// Swap glasses without dropping the connection.
  func setDisplay(_ target: GlassesDisplay) {
    if target === display { return }
    display?.disconnect()
    display = target
    shown = []
    target.connect()
    socket.sendHello(hello(target))
    push(force: true)
  }

  func stop() {
    socket.close()
    trailing?.cancel()
    display?.disconnect()
    display = nil
    shown = []
    connected = false
    onSocketState?("disconnected")
  }

  /// From any target's gestures, the notification buttons or the phone UI.
  func onAction(_ action: InputAction) {
    guard let d = display else { return }
    switch action {
    case .repeatCaption:
      hidden = false
      // While connected, the server answers with the last final marked "repeat" to every screen in the room, and
      // handle(.caption) shows and speaks it once. Without a server, repeat from here.
      if !connected {
        d.show(shown.isEmpty ? captions.fit(d.budget) : shown)
        if !captions.lastFinal.isEmpty { d.onFinal(captions.lastFinal) }
      }
    case .skip:
      captions.clear()
      shown = []
      d.clear()
    case .hide:
      hidden.toggle()
      // `shown` keeps following the stream while hidden, so un-hiding shows the current text at once
      if hidden { d.clear() } else if !shown.isEmpty { d.show(shown) }
    }
    onPreview?(shown, hidden)
    socket.sendAction(action)
  }

  private func handle(_ event: CaptionSocket.Event) {
    switch event {
    case .state(let s):
      connected = s == "connected"
      onSocketState?(s)
    case .open:
      captions.resetSequence()
    case .caption(let seq, let text, let final, let isRepeat):
      guard let d = display, captions.onCaption(seq: seq, text: text, final: final, isRepeat: isRepeat) else { return }
      if isRepeat { hidden = false }  // "show this again", whoever in the room asked for it
      if final && !hidden && !captions.lastFinal.isEmpty { d.onFinal(captions.lastFinal) }
      if !final && !d.budget.partials { return }
      push(force: final, redraw: isRepeat)
    case .clear:
      captions.clear()
      shown = []
      display?.clear()
      onPreview?(shown, hidden)
    }
  }

  /// `redraw` sends the lines even when they did not change (a repeat brings back text the glasses dropped).
  private func push(force: Bool, redraw: Bool = false) {
    guard let d = display else { return }
    let budget = d.budget
    let wait = lastPushAt + budget.minInterval - ProcessInfo.processInfo.systemUptime
    trailing?.cancel()
    if !force && wait > 0 {
      // Too soon for this link: send the newest text once the interval is over
      trailing = Task { [weak self] in
        try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        guard !Task.isCancelled else { return }
        self?.push(force: false)
      }
      return
    }
    let lines = captions.fit(budget)
    if lines == shown && !redraw { return }
    shown = lines
    onPreview?(lines, hidden)
    if hidden { return }
    lastPushAt = ProcessInfo.processInfo.systemUptime
    if lines.isEmpty { d.clear() } else { d.show(lines) }
  }

  private func hello(_ d: GlassesDisplay) -> [String: Any] {
    ["type": "hello", "target": d.id, "lines": d.budget.lines, "cols": d.budget.cols]
  }
}
