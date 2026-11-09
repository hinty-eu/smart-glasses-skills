import Foundation

/// WebSocket client for the example server (`ws://HOST:PORT/ws?room=CODE`), built on URLSessionWebSocketTask.
/// Server to client: `{"type":"caption","seq":12,"text":"...","final":false}` and `{"type":"clear"}`. A caption with
/// `"repeat":true` is the last final line sent again because someone pressed repeat: show it again, do not add it twice.
/// Client to server: `{"type":"hello",...}` on every (re)connect and `{"type":"action","action":"repeat"}`.
/// Reconnects with backoff and sends a ping every 20 s (URLSession does not ping by itself).
@MainActor
final class CaptionSocket {
  enum Event {
    case state(String)
    /// After every successful (re)connect: sequence numbers start over.
    case open
    /// `isRepeat`: the server re-sent the last final line for a "repeat" action (`"repeat":true`).
    case caption(seq: Int, text: String, final: Bool, isRepeat: Bool)
    case clear
  }

  var onEvent: ((Event) -> Void)?

  private let events = SocketEvents()
  private lazy var session = URLSession(configuration: .default, delegate: events, delegateQueue: nil)
  private var task: URLSessionWebSocketTask?
  private var url: URL?
  private var hello: [String: Any] = [:]
  private var attempt = 0
  private var timers: [Task<Void, Never>] = []

  init() { events.owner = self }

  /// `server` is "192.168.1.20:8787" or a full ws:// or wss:// URL.
  func open(server: String, room: String, hello: [String: Any]) {
    close()
    url = Self.buildURL(server: server, room: room)
    self.hello = hello
    attempt = 0
    if url == nil { onEvent?(.state("invalid server address")) }
    connectNow()
  }

  /// Re-announce the target, e.g. after the user picked other glasses.
  func sendHello(_ hello: [String: Any]) {
    self.hello = hello
    send(hello)
  }

  func sendAction(_ action: InputAction) {
    send(["type": "action", "action": action.rawValue])
  }

  func close() {
    url = nil
    timers.forEach { $0.cancel() }
    timers.removeAll()
    task?.cancel(with: .normalClosure, reason: nil)
    task = nil
  }

  private func connectNow() {
    guard let url else { return }
    onEvent?(.state(attempt == 0 ? "connecting" : "reconnecting"))
    let t = session.webSocketTask(with: url)
    task = t
    t.resume()
    receive(t)
  }

  private func send(_ object: [String: Any]) {
    guard let t = task, let data = try? JSONSerialization.data(withJSONObject: object),
      let text = String(data: data, encoding: .utf8)
    else { return }
    t.send(.string(text)) { _ in }
  }

  private func receive(_ t: URLSessionWebSocketTask) {
    t.receive { [weak self] result in
      Task { @MainActor [weak self] in
        guard let self, t === self.task else { return }
        switch result {
        case .success(let message):
          self.handle(message)
          self.receive(t)
        case .failure:
          self.ended(t)
        }
      }
    }
  }

  private func handle(_ message: URLSessionWebSocketTask.Message) {
    let data: Data?
    switch message {
    case .string(let s): data = s.data(using: .utf8)
    case .data(let d): data = d
    @unknown default: data = nil
    }
    guard let data, let msg = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
    switch msg["type"] as? String {
    case "caption":
      onEvent?(
        .caption(
          seq: (msg["seq"] as? NSNumber)?.intValue ?? 0, text: msg["text"] as? String ?? "",
          final: (msg["final"] as? Bool) ?? false, isRepeat: (msg["repeat"] as? Bool) ?? false))
    case "clear":
      onEvent?(.clear)
    default:
      break
    }
  }

  fileprivate func opened(_ t: URLSessionTask) {
    guard t === task else { return }
    attempt = 0
    send(hello)
    onEvent?(.open)
    onEvent?(.state("connected"))
    timers.append(
      Task { [weak self] in
        while !Task.isCancelled {
          try? await Task.sleep(nanoseconds: 20_000_000_000)
          guard let self, let current = self.task, current === t else { return }
          current.sendPing { _ in }
        }
      })
  }

  fileprivate func ended(_ t: URLSessionTask) {
    guard t === task, url != nil else { return }
    task = nil
    timers.forEach { $0.cancel() }
    timers.removeAll()
    attempt += 1
    let delay = min(10, 1 << min(attempt - 1, 4))  // 1, 2, 4, 8, 10 s
    onEvent?(.state("offline, retry in \(delay) s"))
    timers.append(
      Task { [weak self] in
        try? await Task.sleep(nanoseconds: UInt64(delay) * 1_000_000_000)
        guard !Task.isCancelled else { return }
        self?.connectNow()
      })
  }

  static func buildURL(server: String, room: String) -> URL? {
    var base = server.trimmingCharacters(in: .whitespaces)
    while base.hasSuffix("/") { base.removeLast() }
    if !base.hasPrefix("ws://") && !base.hasPrefix("wss://") { base = "ws://" + base }
    let afterScheme = base.components(separatedBy: "://").last ?? ""
    if !afterScheme.contains("/") { base += "/ws" }
    return URL(string: base + "?room=" + room.trimmingCharacters(in: .whitespaces).uppercased())
  }
}

/// URLSession delegate callbacks arrive on a background queue; hop to the main actor.
private final class SocketEvents: NSObject, URLSessionWebSocketDelegate, @unchecked Sendable {
  weak var owner: CaptionSocket?

  func urlSession(
    _ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol selectedProtocol: String?
  ) {
    let owner = self.owner
    Task { @MainActor in owner?.opened(webSocketTask) }
  }

  func urlSession(
    _ session: URLSession, webSocketTask: URLSessionWebSocketTask,
    didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?
  ) {
    let owner = self.owner
    Task { @MainActor in owner?.ended(webSocketTask) }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    let owner = self.owner
    Task { @MainActor in owner?.ended(task) }
  }
}
