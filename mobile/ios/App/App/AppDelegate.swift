import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

import WebKit

private final class WeakCrmMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: CrmViewController?
    init(_ target: CrmViewController) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.handleNativeMessage(message)
    }
}

class CrmViewController: CAPBridgeViewController, UIDocumentPickerDelegate {
    private var temporaryExport: URL?

    override func capacitorDidLoad() {
        guard let webView = webView,
              let path = Bundle.main.url(forResource: "crm-mobile-bridge", withExtension: "js", subdirectory: "public"),
              let script = try? String(contentsOf: path, encoding: .utf8) else { return }
        let controller = webView.configuration.userContentController
        controller.add(WeakCrmMessageHandler(self), name: "fastonmedNative")
        controller.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
    }

    func handleNativeMessage(_ message: WKScriptMessage) {
        let origin = message.frameInfo.securityOrigin
        guard message.frameInfo.isMainFrame, origin.protocol == "https", origin.host == "crm.fastonmed.com",
              origin.port == 443 || origin.port == 0,
              let text = message.body as? String, text.utf8.count <= 28 * 1024 * 1024,
              let bytes = text.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: bytes) as? [String: String] else { return }
        if payload["action"] == "print", let webView = webView {
            let printer = UIPrintInteractionController.shared
            let info = UIPrintInfo(dictionary: nil)
            info.jobName = "FastonMed CRM"
            printer.printInfo = info
            printer.printFormatter = webView.viewPrintFormatter()
            printer.present(animated: true, completionHandler: nil)
        } else if payload["action"] == "save" {
            guard temporaryExport == nil, presentedViewController == nil,
                  let encoded = payload["data"], let data = Data(base64Encoded: encoded), data.count <= 20 * 1024 * 1024 else { return }
            let original = payload["name"] ?? "FastonMed-export"
            let name = String(original.map { $0 == "/" || $0 == "\\" || $0.isNewline ? "_" : $0 }.prefix(150))
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            let file = folder.appendingPathComponent(name.isEmpty ? "FastonMed-export" : name)
            do {
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                try data.write(to: file, options: .atomic)
                temporaryExport = folder
                let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
                picker.delegate = self
                present(picker, animated: true)
            } catch {
                try? FileManager.default.removeItem(at: folder)
                let alert = UIAlertController(title: "Unable to Save", message: "Please retry the export from the CRM.", preferredStyle: .alert)
                alert.addAction(UIAlertAction(title: "OK", style: .default))
                present(alert, animated: true)
            }
        }
    }

    private func clearTemporaryExport() {
        if let folder = temporaryExport { try? FileManager.default.removeItem(at: folder) }
        temporaryExport = nil
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { clearTemporaryExport() }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) { clearTemporaryExport() }
}
