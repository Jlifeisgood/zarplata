import Foundation
import UserNotifications

/// Напоминания о сроках отчёта, как в Android (Reminders.java): 12-го (за 3 дня) и 15-го числа в 09:00, в тексте — отчётный месяц,
/// в феврале — ещё про годовой отчёт. iOS не повторяет уведомление с разным текстом, поэтому ставим конкретные даты на год вперёд
/// и продлеваем их при каждом открытии приложения.
enum Reminders {
    private static let monthsRu = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"]
    private static let monthsUz = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"]

    static var enabled: Bool { UserDefaults.standard.bool(forKey: "reminders") }

    /// done(false) — пользователь запретил уведомления; тогда напоминания выключаются.
    static func setEnabled(_ on: Bool, done: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        guard on else {
            UserDefaults.standard.set(false, forKey: "reminders")
            center.removeAllPendingNotificationRequests()
            done(true)
            return
        }
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async {
                UserDefaults.standard.set(granted, forKey: "reminders")
                if granted { schedule() }
                done(granted)
            }
        }
    }

    static func refresh() {
        guard enabled else { return }
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
            DispatchQueue.main.async { schedule() }
        }
    }

    private static func schedule() {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        let uz = UserDefaults.standard.string(forKey: "lang") == "uz"
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        let start = cal.date(from: cal.dateComponents([.year, .month], from: now)) ?? now
        for i in 0..<13 {
            guard let month = cal.date(byAdding: .month, value: i, to: start) else { continue }
            let y = cal.component(.year, from: month), m = cal.component(.month, from: month)
            let py = m == 1 ? y - 1 : y, pm = m == 1 ? 12 : m - 1   // отчёт сдаётся за прошлый месяц
            let period = (uz ? monthsUz : monthsRu)[pm - 1] + " \(py)"
            for day in [12, 15] {
                var when = DateComponents()
                when.year = y; when.month = m; when.day = day; when.hour = 9; when.minute = 0
                guard let fire = cal.date(from: when), fire > now else { continue }
                let c = UNMutableNotificationContent()
                if uz {
                    c.title = day == 15 ? "Bugun hisobot topshirish muddati" : "Hisobot topshirishga 3 kun qoldi"
                    c.body = "JShDS va ijtimoiy soliq, \(period): hisobotni topshiring va 15-sanagacha to'lang." + (m == 2 ? " Yillik hisobot (\(y - 1)) ni unutmang." : "")
                } else {
                    c.title = day == 15 ? "Сегодня срок сдачи отчёта" : "Через 3 дня срок сдачи отчёта"
                    c.body = "НДФЛ и соцналог за \(period): сдать отчёт и заплатить до 15 числа." + (m == 2 ? " Не забудьте годовой отчёт за \(y - 1) год." : "")
                }
                c.sound = .default
                let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: false)
                center.add(UNNotificationRequest(identifier: "deadline-\(y)-\(m)-\(day)", content: c, trigger: trigger))
            }
        }
    }
}
