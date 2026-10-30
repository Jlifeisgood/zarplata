import Foundation
import CryptoKit

/// Автообновление, как в Android (Updater.java): новые файлы интерфейса скачиваются с сайта приложения, проверяются подписью
/// (update.json подписан ключом разработчика, в нём SHA-256 каждого файла) и загружаются вместо папки web из приложения.
/// Если новая версия не запустилась, приложение возвращается к последней рабочей.
enum Updater {
    /// Уровень нативной части: обновление с большим minApi требует сначала поставить новую сборку.
    static let api = 1
    private static let base = URL(string: "https://jlifeisgood.github.io/zarplata/")!
    private static let pubKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/1VvFtdkw7t6Wj8c9bfMzTNXAIBR3OvM7uTksVuaus9OiLB6Iv3azVv1lz8h+TmntxJsWTTa48E7cskpwbgqOg=="
    private static let checkEvery: TimeInterval = 6 * 3600

    private static var d: UserDefaults { .standard }
    private static var root: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("web", isDirectory: true)
    }
    private static func dir(_ v: Int) -> URL { root.appendingPathComponent(String(v), isDirectory: true) }
    private static var bundleDir: URL? { Bundle.main.url(forResource: "web", withExtension: nil) }
    private static func exists(_ u: URL) -> Bool { FileManager.default.fileExists(atPath: u.path) }

    private static var active: Int { d.integer(forKey: "webVer") }
    private static var serving = 0
    private static var okThisLoad = false
    private static var checking = false

    private static var bundled: Int {
        guard let dir = bundleDir, let data = try? Data(contentsOf: dir.appendingPathComponent("update.json")),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return 0 }
        return o["version"] as? Int ?? 0
    }
    /// Номер показанной версии интерфейса
    static var loaded: Int { serving != 0 ? serving : bundled }
    static var newerReady: Bool { active != serving }

    /// Перед загрузкой страницы: откуда её брать. Новая сборка отменяет более старое обновление.
    static func beginLoad() -> URL? {
        var v = active
        if v != 0 && (v <= bundled || !exists(dir(v))) {
            try? FileManager.default.removeItem(at: root)
            d.removeObject(forKey: "webVer")
            d.removeObject(forKey: "webGood")
            v = 0
        }
        serving = v
        okThisLoad = false
        return v != 0 ? dir(v) : bundleDir
    }
    /// Страница запустилась: версия рабочая, старые можно удалить.
    static func markGood() {
        okThisLoad = true
        guard serving != 0 else { return }
        d.set(serving, forKey: "webGood")
        let keep = [String(serving), String(active), "tmp"]
        for f in (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? [] where !keep.contains(f.lastPathComponent) {
            try? FileManager.default.removeItem(at: f)
        }
    }
    /// Новая версия не сообщила о запуске: откатываемся. true — страницу нужно загрузить заново.
    static func rollbackIfBad() -> Bool {
        let v = serving, good = d.integer(forKey: "webGood")
        guard v != 0, !okThisLoad, v != good else { return false }
        d.set(v, forKey: "webBad")
        if good != 0 && exists(dir(good)) { d.set(good, forKey: "webVer") } else { d.removeObject(forKey: "webVer") }
        try? FileManager.default.removeItem(at: dir(v))
        return true
    }

    /// Проверка в фоне, не чаще раза в 6 часов.
    static func check() {
        guard !checking, Date().timeIntervalSince1970 - d.double(forKey: "updChecked") >= checkEvery else { return }
        checking = true
        let current = max(active, bundled), bad = d.integer(forKey: "webBad"), previous = active == 0 ? bundleDir : dir(active)
        Task.detached {
            let version = try? await fetchAndInstall(current: current, bad: bad, previous: previous)
            await MainActor.run {
                checking = false
                guard let version = version else { return }   // нет сети или файлы ещё публикуются — попробуем в следующий раз
                d.set(Date().timeIntervalSince1970, forKey: "updChecked")
                if version != 0 { d.set(version, forKey: "webVer") }
            }
        }
    }

    /// Номер установленной версии или 0, если обновлять нечего.
    private static func fetchAndInstall(current: Int, bad: Int, previous: URL?) async throws -> Int {
        let stamp = String(Int(Date().timeIntervalSince1970))
        let manifest = try await get("update.json", query: "t=" + stamp), sig = try await get("update.sig", query: "t=" + stamp)
        guard verify(manifest, sig), let o = (try JSONSerialization.jsonObject(with: manifest)) as? [String: Any],
              let version = o["version"] as? Int, let files = o["files"] as? [String: String] else { throw URLError(.badServerResponse) }
        guard version > current, version > bad, (o["minApi"] as? Int ?? 1) <= api else { return 0 }
        let fm = FileManager.default, tmp = root.appendingPathComponent("tmp", isDirectory: true)
        try? fm.removeItem(at: tmp)
        try fm.createDirectory(at: tmp, withIntermediateDirectories: true)
        for (name, sha) in files {
            guard name.range(of: "^[A-Za-z0-9._-]+$", options: .regularExpression) != nil else { throw URLError(.badServerResponse) }
            let target = tmp.appendingPathComponent(name)
            if let old = previous?.appendingPathComponent(name), let data = try? Data(contentsOf: old), hex(data) == sha {
                try data.write(to: target)
                continue
            }
            let data = try await get(name, query: "v=" + String(version))
            guard hex(data) == sha else { throw URLError(.badServerResponse) }
            try data.write(to: target)
        }
        let final = dir(version)
        try? fm.removeItem(at: final)
        try fm.moveItem(at: tmp, to: final)
        return version
    }
    private static func get(_ name: String, query: String) async throws -> Data {
        var c = URLComponents(url: base.appendingPathComponent(name), resolvingAgainstBaseURL: false)!
        c.query = query
        let req = URLRequest(url: c.url!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        return data
    }
    private static func verify(_ data: Data, _ sig: Data) -> Bool {
        guard let der = Data(base64Encoded: pubKey), let key = try? P256.Signing.PublicKey(derRepresentation: der),
              let text = String(data: sig, encoding: .utf8), let sigDer = Data(base64Encoded: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              let s = try? P256.Signing.ECDSASignature(derRepresentation: sigDer) else { return false }
        return key.isValidSignature(s, for: data)
    }
    private static func hex(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
}
