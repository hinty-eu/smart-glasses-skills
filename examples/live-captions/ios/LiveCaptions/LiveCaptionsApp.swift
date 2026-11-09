import SwiftUI
import UIKit

@main
struct LiveCaptionsApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @StateObject private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      ContentView(model: model)
    }
  }
}

/// Up to iOS 26 the system connects the external-display scene by itself; this hands it our delegate.
/// From iOS 27 the scene arrives only through the accessory registered by ExternalAccessoryHost.
final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
    if connectingSceneSession.role == .windowExternalDisplayNonInteractive {
      configuration.delegateClass = ExternalSceneDelegate.self
    }
    // unverified: SwiftUI keeps driving the main window scene when its configuration has no delegate class
    return configuration
  }
}
