import UIKit
import WebKit

/// Окно приложения: тот же веб-интерфейс, что в Android-версии (папка web в приложении), и мост window.Android
/// (см. Bridge.swift) — сохранение файлов, «Поделиться», напоминания, цвет строки состояния.
final class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    private var web: WKWebView!
    private var statusStyle: UIStatusBarStyle = .default

    override var preferredStatusBarStyle: UIStatusBarStyle { statusStyle }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(named: "LaunchBg") ?? .systemBackground

        let content = WKUserContentController()
        content.add(self, name: "app")
        content.addUserScript(WKUserScript(source: Bridge.script(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.dataDetectorTypes = []

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.contentInsetAdjustmentBehavior = .never   // отступы под «чёлку» и полоску «домой» делает сама страница (env(safe-area-inset-*))
        web.scrollView.bounces = false
        web.allowsLinkPreview = false
        web.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        loadApp()
    }

    private func loadApp() {
        guard let dir = Bundle.main.url(forResource: "web", withExtension: nil) else { return }
        web.loadFileURL(dir.appendingPathComponent("index.html"), allowingReadAccessTo: dir)
    }

    // MARK: - сообщения от страницы

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let cmd = m["cmd"] as? String else { return }
        switch cmd {
        case "store":
            if let key = m["k"] as? String { Store.shared.set(key, m["v"] as? String) }
        case "saveFile":
            saveFile(name: m["name"] as? String ?? "file", base64: m["b64"] as? String ?? "")
        case "shareFile":
            if let name = m["name"] as? String { share([Files.url(for: name)]) }
        case "shareText":
            share([m["text"] as? String ?? ""])
        case "setBars":
            setBars(color: m["color"] as? String ?? "", dark: m["dark"] as? Bool ?? false)
        case "setReminders":
            let on = m["on"] as? Bool ?? false
            Reminders.setEnabled(on) { [weak self] granted in
                guard on, !granted else { return }
                self?.web.evaluateJavaScript("window.Android && (window.Android._rem = false); window.nativeRemOff && window.nativeRemOff();", completionHandler: nil)
                self?.toast("Уведомления запрещены. Разрешите их: Настройки iPhone → Уведомления → Зарплата")
            }
        case "setLang":
            UserDefaults.standard.set(m["lang"] as? String == "uz" ? "uz" : "ru", forKey: "lang")
            Reminders.refresh()
        default:
            break
        }
    }

    /// Файл кладём в папку приложения (видна в «Файлах»: На iPhone → Зарплата), как Android кладёт в «Загрузки».
    private func saveFile(name: String, base64: String) {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
            toast("Не удалось сохранить файл")
            return
        }
        do {
            try data.write(to: Files.url(for: name), options: .atomic)
        } catch {
            toast("Не удалось сохранить файл")
        }
    }

    private func share(_ items: [Any]) {
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {   // iPad: окно без стрелки по центру снизу
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 120, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        topController().present(sheet, animated: true)
    }

    /// color — "rgb(r, g, b)" фона страницы; dark — тёмная тема (светлые значки в строке состояния).
    private func setBars(color: String, dark: Bool) {
        let n = color.components(separatedBy: CharacterSet(charactersIn: "0123456789.").inverted).compactMap { Double($0) }
        if n.count >= 3 { view.backgroundColor = UIColor(red: n[0] / 255, green: n[1] / 255, blue: n[2] / 255, alpha: 1) }
        statusStyle = dark ? .lightContent : .darkContent
        setNeedsStatusBarAppearanceUpdate()
    }

    private func toast(_ text: String) {
        web.evaluateJavaScript("window.nativeToast && window.nativeToast(\(Bridge.jsString(text)));", completionHandler: nil)
    }

    private func topController() -> UIViewController {
        var c: UIViewController = self
        while let p = c.presentedViewController { c = p }
        return c
    }

    private var isUz: Bool { UserDefaults.standard.string(forKey: "lang") == "uz" }

    // MARK: - alert / confirm страницы (без этого WKWebView молча отвечает «Отмена»)

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        topController().present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: isUz ? "Bekor qilish" : "Отмена", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        topController().present(a, animated: true)
    }

    // MARK: - ссылки наружу открываем в Safari

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let scheme = url.scheme?.lowercased(), ["http", "https", "mailto", "tel"].contains(scheme) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadApp()
    }
}

enum Files {
    static func url(for name: String) -> URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|")).joined(separator: "_")
        return dir.appendingPathComponent(safe.isEmpty ? "file" : safe)
    }
}
