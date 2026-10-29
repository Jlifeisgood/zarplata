import Foundation

/// Скрипт, который подключается до загрузки страницы.
/// 1) Данные приложения живут в localStorage страницы; каждую запись дублируем в файл приложения (Store) и восстанавливаем
///    из него недостающие ключи при запуске — так записи переживают очистку данных WebKit и попадают в резервную копию iPhone.
/// 2) Объект window.Android с теми же методами, что у Android-версии (MainActivity.Bridge), поэтому app.js не меняется.
///    saveFile / remindersOn / appVersion там синхронные — здесь отвечаем сразу, а работу делает приложение по сообщению.
enum Bridge {
    static func script() -> String {
        let info = Bundle.main.infoDictionary ?? [:]
        let version = "\(info["CFBundleShortVersionString"] as? String ?? "1.0") (\(info["CFBundleVersion"] as? String ?? "1"))"
        return """
        (function () {
          var post = function (m) { try { window.webkit.messageHandlers.app.postMessage(m); } catch (e) { } };
          var saved = \(Store.shared.json);
          var ls = null;
          try { ls = window.localStorage; } catch (e) { }
          if (ls) {
            try { Object.keys(saved).forEach(function (k) { if (ls.getItem(k) === null) ls.setItem(k, saved[k]); }); } catch (e) { }
            var set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
            Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === ls) post({ cmd: "store", k: String(k), v: String(v) }); };
            Storage.prototype.removeItem = function (k) { rm.call(this, k); if (this === ls) post({ cmd: "store", k: String(k), v: null }); };
            try { for (var i = 0; i < ls.length; i++) { var key = ls.key(i); post({ cmd: "store", k: key, v: ls.getItem(key) }); } } catch (e) { }
          }
          window.Android = {
            platform: "ios",
            _rem: \(Reminders.enabled ? "true" : "false"),
            saveFile: function (name, mime, b64) { post({ cmd: "saveFile", name: String(name), b64: String(b64) }); return "ok:" + name; },
            shareFile: function (uri) { post({ cmd: "shareFile", name: String(uri) }); },
            shareText: function (title, text) { post({ cmd: "shareText", title: String(title), text: String(text) }); },
            setBars: function (color, dark) { post({ cmd: "setBars", color: String(color), dark: !!dark }); },
            setReminders: function (on) { window.Android._rem = !!on; post({ cmd: "setReminders", on: !!on }); },
            remindersOn: function () { return !!window.Android._rem; },
            setLang: function (l) { post({ cmd: "setLang", lang: String(l) }); },
            appVersion: function () { return \(jsString(version)); }
          };
        })();
        """
    }

    /// Строка как JS-литерал (через JSON — кавычки и переводы строк экранируются).
    static func jsString(_ s: String) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed), let t = String(data: d, encoding: .utf8) else { return "\"\"" }
        return t
    }
}

/// Копия localStorage страницы в файле Application Support/zarplata-data.json (входит в резервную копию iPhone).
final class Store {
    static let shared = Store()
    private var data: [String: String] = [:]
    private let file: URL
    private var pending: DispatchWorkItem?

    private init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        file = dir.appendingPathComponent("zarplata-data.json")
        if let d = try? Data(contentsOf: file), let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: String] { data = o }
    }

    var json: String {
        guard let d = try? JSONSerialization.data(withJSONObject: data), let s = String(data: d, encoding: .utf8) else { return "{}" }
        return s
    }

    func set(_ key: String, _ value: String?) {
        if data[key] == value { return }
        if let v = value { data[key] = v } else { data.removeValue(forKey: key) }
        pending?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.flush() }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: work)
    }

    func flush() {
        pending?.cancel()
        pending = nil
        guard let d = try? JSONSerialization.data(withJSONObject: data) else { return }
        try? d.write(to: file, options: .atomic)
    }
}
