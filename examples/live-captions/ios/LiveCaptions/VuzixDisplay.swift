import CoreBluetooth
import UIKit
import UltraliteSDK

/// Rung 1: Vuzix Z100 through the Vuzix Ultralite SDK for iOS 1.9.0 (Swift package
/// github.com/Vuzix/UltraliteSDK-releases-iOS). Vuzix Connect is optional on iOS: the SDK talks CoreBluetooth itself,
/// and every app links the glasses once with the SDK's own picker.
///
/// To draw, the app takes control of the display (the last app to ask wins), picks the text layout and sends text.
/// Taps: 1 = repeat, 2 = skip (maxNumTaps 2: every extra tap count makes the glasses wait longer before reporting a
/// tap; hide stays on the phone and the 30 s display timeout blanks the glasses). iOS refuses requestControl while the app is in the background, and there
/// is no public "control lost" signal, so control is requested on connect (a user action) and on return to foreground.
@MainActor
final class VuzixDisplay: GlassesDisplay {
  let id = "vuzix"
  // Estimate: MentraOS measured about 42 Latin characters per line in this text layout (community, unverified by us);
  // 36 leaves 15 percent slack. Three lines stay glanceable in front of one eye.
  let budget = LineBudget(lines: 3, cols: 36, minInterval: 0.3)

  private weak var host: DisplayHost?
  private var wanted = false
  private var hasControl = false
  private var lines: [String] = []
  private var linkedListener: BondListener<Bool>?
  private var connectedListener: BondListener<Bool>?
  private var boundDevice: Ultralite?
  private var observers: [NSObjectProtocol] = []
  private var lastTapAt: TimeInterval = 0

  init(host: DisplayHost) { self.host = host }

  func connect() {
    if CBManager.authorization == .denied || CBManager.authorization == .restricted {
      host?.onStatus(id, "allow Bluetooth for this app in Settings")
      return
    }
    wanted = true
    observe()
    // The first touch of UltraliteManager starts CoreBluetooth and restores a pair linked earlier
    _ = UltraliteManager.shared
    host?.onStatus(id, "looking for linked glasses")
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 800_000_000)  // unverified: how long the restore takes is not documented
      self?.evaluate()
    }
  }

  private func evaluate() {
    guard wanted else { return }
    guard let device = UltraliteManager.shared.currentDevice else {
      presentPicker()
      return
    }
    bind(device)
    if device.isConnected.value { takeControl(device) } else { host?.onStatus(id, "waiting for the glasses") }
  }

  private func presentPicker() {
    guard let presenter = Self.topViewController() else { return }
    host?.onStatus(id, "pick your glasses")
    // The SDK's picker scans, lets the user choose the Z100 and links it to this app (once per install)
    let picker = UltralitePickerController { [weak self] in
      Task { @MainActor [weak self] in self?.pickerClosed() }
    }
    presenter.present(picker, animated: true)
    if linkedListener == nil {
      let listener = BondListener<Bool>(listener: { [weak self] linked in
        Task { @MainActor [weak self] in if linked { self?.pickerClosed() } }
      })
      linkedListener = listener  // Bindable does not retain its listeners
      UltraliteManager.shared.isLinked.bind(listener: listener, shouldFire: false)
    }
  }

  private func pickerClosed() {
    guard wanted else { return }
    guard let device = UltraliteManager.shared.currentDevice else {
      host?.onStatus(id, "no glasses linked")
      return
    }
    bind(device)
    if device.isConnected.value { takeControl(device) }
  }

  private func bind(_ device: Ultralite) {
    if boundDevice === device { return }
    if let old = boundDevice, let l = connectedListener { old.isConnected.unbind(listener: l) }
    // The SDK does not document the callback thread, so hop to the main actor
    let listener = BondListener<Bool>(listener: { [weak self] connected in
      Task { @MainActor [weak self] in self?.connectedChanged(connected) }
    })
    connectedListener = listener
    boundDevice = device
    device.isConnected.bind(listener: listener, shouldFire: false)
  }

  private func connectedChanged(_ connected: Bool) {
    guard wanted, let device = boundDevice else { return }
    if connected {
      takeControl(device)
    } else {
      hasControl = false
      host?.onStatus(id, "glasses disconnected")
    }
  }

  private func takeControl(_ device: Ultralite) {
    guard wanted, !hasControl else { return }
    if UIApplication.shared.applicationState == .background {
      host?.onStatus(id, "open the app to take the display")
      return
    }
    // Text at the bottom, display sleeps after 30 s without a draw, status bar hidden, 1 and 2 taps
    hasControl = device.requestControl(
      layout: .textBottomLeftAlign, timeout: 30, hideStatusBar: true, showTapAnimation: false, maxNumTaps: 2,
      autoReleaseControlOnDisplayTimeout: false)
    host?.onStatus(id, hasControl ? "connected" : "control refused")
    draw()
  }

  func show(_ lines: [String]) {
    self.lines = lines
    draw()
  }

  private func draw() {
    guard hasControl, let device = boundDevice else { return }
    device.screenOn()
    // unverified: line breaks in sendText come from community code; the SDK docs do not mention them.
    let text = lines.joined(separator: "\n")
    device.sendText(text: text.isEmpty ? " " : text)
  }

  func clear() {
    lines = []
    guard hasControl, let device = boundDevice else { return }
    device.sendText(text: " ")
    device.screenOff()  // saves battery; the next draw turns it on
  }

  func disconnect() {
    wanted = false
    lines = []
    if hasControl { boundDevice?.releaseControl() }  // else the last caption can stay on the glasses
    hasControl = false
    if let device = boundDevice, let l = connectedListener { device.isConnected.unbind(listener: l) }
    if let l = linkedListener { UltraliteManager.shared.isLinked.unbind(listener: l) }
    boundDevice = nil
    connectedListener = nil
    linkedListener = nil
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
    host?.onStatus(id, "disconnected")
  }

  private func observe() {
    guard observers.isEmpty else { return }
    let center = NotificationCenter.default
    observers.append(
      center.addObserver(forName: Notification.Name.tap, object: nil, queue: .main) { [weak self] note in
        let count = Self.tapCount(note)
        Task { @MainActor [weak self] in self?.onTap(count) }
      })
    observers.append(
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) {
        [weak self] _ in
        // Back in the foreground: control may have been dropped silently, ask again once
        Task { @MainActor [weak self] in
          guard let self, self.wanted, let device = self.boundDevice, device.isConnected.value else { return }
          self.hasControl = false
          self.takeControl(device)
        }
      })
  }

  private func onTap(_ count: Int) {
    let now = ProcessInfo.processInfo.systemUptime
    guard hasControl, now - lastTapAt >= 0.3 else { return }  // taps can be reported twice
    lastTapAt = now
    switch count {
    case 1: host?.onAction(.repeatCaption)
    case 2: host?.onAction(.skip)
    default: break
    }
  }

  /// userInfo["tap"] holds the count; the wrapper type is not documented, so accept the usual number types.
  nonisolated private static func tapCount(_ note: Notification) -> Int {
    switch note.userInfo?["tap"] {
    case let v as Int64: return Int(v)
    case let v as Int: return v
    case let v as NSNumber: return v.intValue
    default: return 0
    }
  }

  static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive && $0.session.role == .windowApplication }
    var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
    while let presented = top?.presentedViewController { top = presented }
    return top
  }
}
