import SwiftUI
import UIKit

/// The targets of the display-text ladder available on iPhone, best rung first.
/// Rokid's iOS SDK (CocoaPods `RGCxrClient`) needs Rokid's private specs repository and a registered Rokid developer
/// account, and Meta DAT for iOS has its own official agent skill, so neither is part of this minimal target.
enum Target: String, CaseIterable, Identifiable {
  case phone, vuzix, external, notification, speech
  var id: String { rawValue }

  var title: String {
    switch self {
    case .phone: return "Phone preview only (no glasses)"
    case .vuzix: return "Vuzix Z100 (Ultralite SDK)"
    case .external: return "USB-C display glasses (external screen)"
    case .notification: return "Notification mirrored by the glasses app"
    case .speech: return "Voice in the ear (text-to-speech)"
    }
  }
}

@MainActor
final class AppModel: ObservableObject, DisplayHost {
  @Published var server = UserDefaults.standard.string(forKey: "server") ?? ""
  @Published var room = UserDefaults.standard.string(forKey: "room") ?? ""
  @Published var target: Target = .phone { didSet { if running { controller.setDisplay(display(for: target)) } } }
  @Published private(set) var running = false
  @Published private(set) var socketState = "disconnected"
  @Published private(set) var displayState = "not started"
  @Published private(set) var preview = ""

  private let controller = CaptionController()
  private var displays: [Target: GlassesDisplay] = [:]

  init() {
    controller.onPreview = { [weak self] lines, hidden in self?.preview = hidden ? "(hidden)" : lines.joined(separator: "\n") }
    controller.onSocketState = { [weak self] state in self?.socketState = state }
  }

  func toggle() {
    if running {
      controller.stop()
      running = false
      UIApplication.shared.isIdleTimerDisabled = false
      return
    }
    let code = room.trimmingCharacters(in: .whitespaces).uppercased()
    guard !server.isEmpty, code.count == 6 else {
      socketState = "enter the address and the 6-character room code the server printed"
      return
    }
    UserDefaults.standard.set(server, forKey: "server")
    UserDefaults.standard.set(code, forKey: "room")
    running = true
    UIApplication.shared.isIdleTimerDisabled = true
    controller.start(server: server, room: code, target: display(for: target))
  }

  func act(_ action: InputAction) { controller.onAction(action) }

  private func display(for t: Target) -> GlassesDisplay {
    if let d = displays[t] { return d }
    let d: GlassesDisplay
    switch t {
    case .phone: d = PhonePreviewDisplay(host: self)
    case .vuzix: d = VuzixDisplay(host: self)
    case .external: d = ExternalDisplay(host: self)
    case .notification: d = NotificationDisplay(host: self)
    case .speech: d = SpeechDisplay(host: self)
    }
    displays[t] = d
    return d
  }

  // DisplayHost
  func onStatus(_ displayId: String, _ status: String) { displayState = "\(displayId): \(status)" }
  func onAction(_ action: InputAction) { controller.onAction(action) }
}

struct ContentView: View {
  @ObservedObject var model: AppModel

  var body: some View {
    Form {
      Section("Caption server") {
        TextField("192.168.1.20:8787", text: $model.server)
          .keyboardType(.URL)
          .textInputAutocapitalization(.never)
          .autocorrectionDisabled()
        TextField("Room code, e.g. K7QM2X", text: $model.room)
          .textInputAutocapitalization(.characters)
          .autocorrectionDisabled()
      }
      Section("Glasses") {
        Picker("Target", selection: $model.target) {
          ForEach(Target.allCases) { Text($0.title).tag($0) }
        }
        Button(model.running ? "Disconnect" : "Connect") { model.toggle() }
        Text("Server: \(model.socketState)").font(.footnote)
        Text("Glasses: \(model.displayState)").font(.footnote)
      }
      Section("Sent to the glasses") {
        Text(model.preview.isEmpty ? " " : model.preview)
          .font(.system(.body, design: .monospaced))
          .foregroundStyle(.green)
          .frame(maxWidth: .infinity, minHeight: 72, alignment: .bottomLeading)
          .padding(8)
          .background(Color.black)
        HStack {
          ForEach(InputAction.allCases, id: \.self) { action in
            Button(action.title) { model.act(action) }.buttonStyle(.bordered)
          }
        }
      }
    }
    // iOS 27+: offers the external-display scene while the external target is on (no effect on earlier versions)
    .background(ExternalAccessoryHost(enabled: model.running && model.target == .external).frame(width: 0, height: 0))
  }
}
