import UserNotifications

/// Rung 4: a local notification that the glasses' companion app mirrors (on iPhone most glasses apps read
/// notifications through Apple's ANCS, so they see what reaches Notification Center). No SDK. Each final caption is a
/// new notification request (a new identifier), at most one every 2.5 s with the newest text winning; only the last
/// `keep` stay delivered, older ones are removed. Repeat / Skip / Hide are notification actions.
///
/// Why a new identifier instead of replacing one: no brand documents whether a replaced notification is forwarded
/// again, while a new notification is the event every mirroring app is built for (the same rule as the Android target).
///
/// Honest limits (unverified per brand): the wearer must allow this app in the glasses app; the glasses app decides
/// how long a notification stays and how much text fits. iOS suspends a backgrounded app within seconds, so captions
/// stop arriving unless the app stays in the foreground (or keeps an audio session playing, see SpeechDisplay).
@MainActor
final class NotificationDisplay: NSObject, GlassesDisplay, UNUserNotificationCenterDelegate {
  let id = "notification"
  let budget = LineBudget(lines: 2, cols: 40, partials: false)
  private weak var host: DisplayHost?
  private var allowed = false
  private static let category = "captions"
  private static let keep = 3
  private static let minGap: TimeInterval = 2.5
  private var serial = 0
  private var posted: [String] = []
  private var lastPostAt: TimeInterval = 0
  private var waiting: [String]?
  private var timer: Task<Void, Never>?

  init(host: DisplayHost) { self.host = host }

  func connect() {
    let center = UNUserNotificationCenter.current()
    center.delegate = self
    let actions = InputAction.allCases.map { UNNotificationAction(identifier: $0.rawValue, title: $0.title, options: []) }
    center.setNotificationCategories([
      UNNotificationCategory(identifier: Self.category, actions: actions, intentIdentifiers: [], options: [])
    ])
    // Alerts only: a sound for every caption would be unbearable
    center.requestAuthorization(options: [.alert]) { granted, _ in
      Task { @MainActor [weak self] in
        guard let self else { return }
        self.allowed = granted
        self.host?.onStatus(
          self.id, granted ? "ready, allow this app in your glasses app's notification settings" : "notifications are off")
      }
    }
  }

  func show(_ lines: [String]) {
    guard allowed, !lines.isEmpty else { return }
    let wait = lastPostAt + Self.minGap - ProcessInfo.processInfo.systemUptime
    if wait > 0 {
      // Glasses show one notification at a time for a few seconds: keep only the newest text for the next slot
      if waiting == nil {
        timer = Task { @MainActor [weak self] in
          try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
          guard !Task.isCancelled, let self, let next = self.waiting else { return }
          self.waiting = nil
          self.post(next)
        }
      }
      waiting = lines
      return
    }
    post(lines)
  }

  private func post(_ lines: [String]) {
    lastPostAt = ProcessInfo.processInfo.systemUptime
    serial += 1
    let identifier = "caption-\(serial)"
    let content = UNMutableNotificationContent()
    content.title = "Live captions"
    content.body = lines.joined(separator: " ")
    content.categoryIdentifier = Self.category
    content.threadIdentifier = Self.category
    content.interruptionLevel = .active
    let center = UNUserNotificationCenter.current()
    center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: nil))
    posted.append(identifier)
    if posted.count > Self.keep {
      let old = Array(posted.prefix(posted.count - Self.keep))
      posted.removeFirst(old.count)
      center.removeDeliveredNotifications(withIdentifiers: old)
    }
  }

  func clear() {
    timer?.cancel()
    timer = nil
    waiting = nil
    UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: posted)
    posted.removeAll()
  }

  func disconnect() {
    clear()
    host?.onStatus(id, "disconnected")
  }

  // Without this, iOS does not show (or forward) notifications while the app is in the foreground
  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list])
  }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if let action = InputAction(rawValue: response.actionIdentifier) {
      Task { @MainActor [weak self] in self?.host?.onAction(action) }
    }
    completionHandler()
  }
}
