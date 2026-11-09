import SwiftUI
import UIKit

/// Rung 3: USB-C display glasses (XREAL, VITURE, RayNeo Air) on an iPhone with USB-C, or an AirPlay screen, used as an
/// external display. No SDK. iOS mirrors the phone until the app attaches a window to the scene with the role
/// `windowExternalDisplayNonInteractive`; then that window fills the glasses.
///
/// How the app gets that scene (Apple, "Presenting content on a connected display", checked 2026-11-08):
/// - up to iOS 26 the system connects it automatically and AppDelegate returns ExternalSceneDelegate for the role;
/// - from iOS 27 it connects only after a view controller registers a scene accessory (ExternalAccessoryHost below).
/// The card shows only while this app is in the foreground. These glasses send no input; use the phone or notification.
@MainActor
final class ExternalDisplay: GlassesDisplay {
  let id = "external"
  // About 34 bold characters fit across 76% of a 16:9 display at 7% of its height; longer lines are truncated
  let budget = LineBudget(lines: 3, cols: 34)
  private weak var host: DisplayHost?

  init(host: DisplayHost) { self.host = host }

  func connect() {
    let screen = ExternalScreen.shared
    screen.onChange = { [weak self] attached in
      guard let self else { return }
      self.host?.onStatus(self.id, attached ? "showing on the external display" : "plug in USB-C display glasses")
    }
    screen.enabled = true
  }

  func show(_ lines: [String]) { ExternalScreen.shared.lines = lines }

  func clear() { ExternalScreen.shared.lines = [] }

  func disconnect() {
    ExternalScreen.shared.enabled = false
    ExternalScreen.shared.lines = []
    ExternalScreen.shared.onChange = nil
    host?.onStatus(id, "disconnected")
  }
}

/// Owns the window on the external scene. A window is attached only while the external target is selected, so
/// the glasses keep mirroring the phone otherwise.
@MainActor
final class ExternalScreen {
  static let shared = ExternalScreen()

  var enabled = false { didSet { update() } }
  var lines: [String] = [] { didSet { controller?.render(lines) } }
  var onChange: ((Bool) -> Void)?

  fileprivate var scene: UIWindowScene? { didSet { update() } }
  private var window: UIWindow?
  private var controller: ExternalCaptionViewController?

  private func update() {
    if enabled, let scene {
      if window?.windowScene !== scene {
        let vc = ExternalCaptionViewController(rows: 3)
        let w = UIWindow(windowScene: scene)
        w.rootViewController = vc
        w.isHidden = false
        window = w
        controller = vc
        vc.render(lines)
      }
      onChange?(true)
    } else {
      // Dropping the window gives the screen back to mirroring
      window?.isHidden = true
      window?.windowScene = nil
      window = nil
      controller = nil
      onChange?(false)
    }
  }
}

/// Scene delegate for the noninteractive external-display scene (both ways of getting it).
final class ExternalSceneDelegate: UIResponder, UIWindowSceneDelegate {
  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
    guard let ws = scene as? UIWindowScene else { return }
    ExternalScreen.shared.scene = ws
  }

  func sceneDidDisconnect(_ scene: UIScene) {
    if ExternalScreen.shared.scene === scene { ExternalScreen.shared.scene = nil }
  }
}

/// White text on black at the bottom: black is see-through on these optics, and the middle stays free.
final class ExternalCaptionViewController: UIViewController {
  private let rows: Int
  private var labels: [UILabel] = []
  private let stack = UIStackView()

  init(rows: Int) {
    self.rows = rows
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("not used") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .black
    stack.axis = .vertical
    stack.isLayoutMarginsRelativeArrangement = true
    stack.translatesAutoresizingMaskIntoConstraints = false
    for _ in 0..<rows {
      let label = UILabel()
      label.textColor = .white
      label.numberOfLines = 1
      label.lineBreakMode = .byTruncatingTail  // lines arrive pre-wrapped; never let one push the others away
      labels.append(label)
      stack.addArrangedSubview(label)
    }
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      stack.bottomAnchor.constraint(equalTo: view.bottomAnchor),
    ])
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    // Sizes follow the glasses' resolution, not the phone's
    let size = view.bounds.size
    for label in labels { label.font = .boldSystemFont(ofSize: max(16, size.height * 0.07)) }
    stack.layoutMargins = UIEdgeInsets(
      top: 0, left: size.width * 0.12, bottom: size.height * 0.08, right: size.width * 0.12)
  }

  func render(_ lines: [String]) {
    loadViewIfNeeded()
    let offset = rows - lines.count  // short text on the bottom rows
    for (i, label) in labels.enumerated() {
      let j = i - offset
      label.text = j >= 0 && j < lines.count ? lines[j] : " "
    }
  }
}

/// iOS 27+: registers the external-display scene accessory while the external target is on. Put it in the main view.
struct ExternalAccessoryHost: UIViewControllerRepresentable {
  var enabled: Bool

  func makeUIViewController(context: Context) -> AccessoryViewController { AccessoryViewController() }

  func updateUIViewController(_ vc: AccessoryViewController, context: Context) { vc.setEnabled(enabled) }

  final class AccessoryViewController: UIViewController {
    #if compiler(>=6.4)  // unverified: assumes the iOS 27 SDK ships with Swift 6.4 or later
      private var registration: AnyObject?
    #endif

    func setEnabled(_ on: Bool) {
      #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
          if on, registration == nil {
            let configuration = UISceneConfiguration()  // as in Apple's iOS 27 example
            configuration.delegateClass = ExternalSceneDelegate.self
            registration = registerSceneAccessory(UISceneAccessory.externalNonInteractive(sceneConfiguration: configuration))
          } else if !on, let r = registration as? UISceneAccessoryRegistration {
            unregisterSceneAccessory(r)
            registration = nil
          }
        }
      #endif
    }
  }
}
