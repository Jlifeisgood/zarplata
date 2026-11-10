/* Кадровые расчёты: рабочие дни, отпускные, пособие по временной нетрудоспособности. Без зависимостей от интерфейса (тесты — dev-test.html).
   Источники: ТК РУз ст. 233, 257 (отпускные, делитель 25,3, воскресенья и праздники не оплачиваются);
   Положение о порядке назначения и выплаты пособий по ВН (приложение 4 к ПКМ № 796 от 17.12.2025), п. 16–20:
   пособие = средняя месячная ÷ 25,3 × коэффициент стажа × дни; воскресенья и праздники не считаются;
   первые 5 календарных дней в году платит работодатель, с 6-го — Фонд; свыше 77 дней в году коэффициент −10 п.п.; не более 182 дней в году. */
(function (root) {
  var DIV = 25.3; // среднемесячное число рабочих дней
  var r2 = function (x) { return Math.round(x * 100 + 1e-7) / 100; }; // суммы — с точностью до тийина
  var pad = function (n) { return String(n).padStart(2, "0"); };
  // нерабочие праздничные дни (ТК ст. 208), которые не меняются по годам; дни Хайита и переносы добавляются вручную
  var FIXED = ["01-01", "03-08", "03-21", "05-09", "09-01", "10-01", "12-08"];
  var iso = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var toDate = function (s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); };
  var addDays = function (s, n) { var d = toDate(s); d.setDate(d.getDate() + n); return iso(d); };
  var isSunday = function (s) { return toDate(s).getDay() === 0; };
  var isHoliday = function (s, extra) { return FIXED.indexOf(s.slice(5)) >= 0 || (extra || []).indexOf(s) >= 0; };
  /** рабочий день по графику: wd = 5 (пн–пт) или 6 (пн–сб), без воскресений и праздников */
  function isWorkDay(s, wd, extra) {
    var dow = toDate(s).getDay();
    if (dow === 0 || (wd === 5 && dow === 6)) return false;
    return !isHoliday(s, extra);
  }
  /** рабочих дней в месяце ym в пределах [from, to] (ISO, необязательно) */
  function workDays(ym, wd, extra, from, to) {
    var last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), n = 0;
    for (var d = 1; d <= last; d++) {
      var s = ym + "-" + pad(d);
      if ((from && s < from) || (to && s > to)) continue;
      if (isWorkDay(s, wd, extra)) n++;
    }
    return n;
  }
  function eachDay(from, to, fn) { for (var s = from; s <= to; s = addDays(s, 1)) fn(s); }

  /** Отпускные: avg — средняя месячная зарплата, days — календарных дней отпуска, start — первый день (ISO) */
  function vacation(o) {
    var end = addDays(o.start, o.days - 1), sun = 0, hol = 0;
    eachDay(o.start, end, function (s) { if (isSunday(s)) sun++; else if (isHoliday(s, o.extra)) hol++; });
    var paid = o.days - sun - hol, daily = o.avg / DIV;
    return { end: end, sun: sun, hol: hol, paid: paid, daily: daily, pay: r2(daily * paid) };
  }

  /**
   * Пособие по ВН. o: { from, to, avg, mrot, long (стаж 97+ мес → 80%, иначе 60%), bonus (+20 п.п.), prevDays, extra }
   * prevDays — календарных дней нетрудоспособности, уже оформленных в том же календарном году до этого листка.
   */
  function sick(o) {
    var cap = 10 * o.mrot, a = Math.min(o.avg, cap), base = (o.long ? 0.8 : 0.6) + (o.bonus ? 0.2 : 0);
    var k = o.prevDays || 0, year = o.from.slice(0, 4), emp = 0, fund = 0, empDays = 0, fundDays = 0, skipped = 0, over = 0;
    eachDay(o.from, o.to, function (s) {
      if (s.slice(0, 4) !== year) { year = s.slice(0, 4); k = 0; }
      k++;
      if (k > 182) { over++; return; }
      if (isSunday(s) || isHoliday(s, o.extra)) { skipped++; return; }
      var coef = k > 77 ? base - 0.1 : base, v = a / DIV * coef;
      if (k <= 5) { emp += v; empDays++; } else { fund += v; fundDays++; }
    });
    return {
      base: base, capped: o.avg > cap, avgUsed: a, employer: r2(emp), fund: r2(fund), empDays: empDays, fundDays: fundDays,
      skipped: skipped, over: over, total: r2(r2(emp) + r2(fund)),
      days: Math.round((toDate(o.to) - toDate(o.from)) / 86400000) + 1
    };
  }

  /** Прибавляет n месяцев к дате (ISO); если в месяце нет такого числа — последний день месяца */
  function addMonths(s, n) {
    var d = toDate(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  }
  var diffDays = function (a, b) { return Math.round((toDate(b) - toDate(a)) / 86400000); };
  /** Полные месяцы работы в последнем рабочем году (ТК ст. 223–224): остаток 15 дней и более считается за месяц, менее — нет */
  function workMonths(hire, fire) {
    var y = 0;
    while (addMonths(hire, 12 * (y + 1)) <= addDays(fire, 1)) y++;
    var start = addMonths(hire, 12 * y), m = 0;
    while (addDays(addMonths(start, m + 1), -1) <= fire) m++;
    var rest = diffDays(addMonths(start, m), fire) + 1;
    if (rest >= 15) m++;
    return { years: y, start: start, months: Math.min(m, 12), rest: rest };
  }
  /**
   * Компенсация за неиспользованный отпуск при увольнении (ТК ст. 234, 223, 224):
   * o: { hire, fire, leave (дней отпуска в году), used (уже использовано в этом рабочем году), prev (неиспользованные дни прошлых лет), avg }
   * Дни за текущий год = leave / 12 × полные месяцы (дробная часть от 0,5 — вверх); воскресенья не оплачиваются.
   */
  function compensation(o) {
    var wm = workMonths(o.hire, o.fire), raw = o.leave / 12 * wm.months;
    var earned = Math.floor(raw) + (raw - Math.floor(raw) >= 0.5 ? 1 : 0);
    var days = (o.prev || 0) + earned - (o.used || 0), n = Math.abs(days);
    var sun = Math.floor(n / 7), paid = n - sun;
    return { months: wm.months, rest: wm.rest, start: wm.start, earned: earned, days: days, sun: sun, paid: paid, pay: (days < 0 ? -1 : 1) * r2(o.avg / DIV * paid) };
  }

  /**
   * Учёт по часам. hrs — часы по дням недели [пн … вс]. Накануне праздничного дня смена короче на 1 час (ТК ст. 187), в праздник — 0.
   */
  function planHours(s, hrs, extra, preHol) {
    if (isHoliday(s, extra)) return 0;
    var h = +hrs[(toDate(s).getDay() + 6) % 7] || 0;
    if (h > 0 && preHol && isHoliday(addDays(s, 1), extra)) h = Math.max(0, h - 1);
    return h;
  }
  /**
   * Часы месяца. o: { ym, hrs, extra, preHol, from, to, day(s) → { st: 'work'|'abs'|'unp'|'trip'|'vac'|'sick', h, n } | null }
   * h — фактически отработано (нет записи → по графику), n — из них ночных (22:00–06:00).
   * norm — норма за весь месяц, plan — по графику в пределах [from, to], lost — не оплачивается (прогул, за свой счёт, отпуск и больничный
   * оплачиваются отдельно, недоработка), ot1/ot2 — сверхурочные: первые 2 часа дня и остальные (ст. 262), wk — часы в выходные и праздники (ст. 263), night — ночные (ст. 264).
   */
  function hoursMonth(o) {
    var last = new Date(+o.ym.slice(0, 4), +o.ym.slice(5, 7), 0).getDate(), t = { norm: 0, plan: 0, lost: 0, ot1: 0, ot2: 0, wk: 0, night: 0 };
    for (var d = 1; d <= last; d++) {
      var s = o.ym + "-" + pad(d), p = planHours(s, o.hrs, o.extra, o.preHol);
      t.norm += p;
      if ((o.from && s < o.from) || (o.to && s > o.to)) continue;
      t.plan += p;
      var r = o.day ? o.day(s) : null, st = (r && r.st) || "work";
      if (st === "abs" || st === "unp" || st === "vac" || st === "sick") { t.lost += p; continue; }
      var h = st !== "trip" && r && r.h != null ? r.h : p;
      if (p > 0) {
        if (h < p) t.lost += p - h;
        else if (h > p) { var x = h - p; t.ot1 += Math.min(x, 2); t.ot2 += Math.max(0, x - 2); }
      } else t.wk += h;
      if (r && r.n) t.night += Math.min(r.n, h);
    }
    return t;
  }
  /**
   * Доплаты по часам (в суммах, сверх основной оплаты). rate — часовая ставка; hourly — оплата за час: часы в выходной оплачиваются
   * в двойном размере (ст. 263), для окладника — одинарная ставка сверх оклада. Сверхурочные (в норму не входят): первые 2 часа ×1,5,
   * дальше ×2 (ст. 262); ночные — +0,5 ставки за каждый час (ст. 264).
   */
  function hoursPay(h, rate, hourly) {
    var ot = rate * (1.5 * h.ot1 + 2 * h.ot2), wk = rate * (hourly ? 2 : 1) * h.wk, night = rate * 0.5 * h.night;
    return { ot: r2(ot), wk: r2(wk), night: r2(night), total: r2(r2(ot) + r2(wk) + r2(night)) };
  }

  var api = { planHours: planHours, hoursMonth: hoursMonth, hoursPay: hoursPay, addMonths: addMonths, workMonths: workMonths, compensation: compensation, DIV: DIV, FIXED: FIXED, addDays: addDays, isSunday: isSunday, isHoliday: isHoliday, isWorkDay: isWorkDay, workDays: workDays, eachDay: eachDay, vacation: vacation, sick: sick };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.HR = api;
})(typeof window !== "undefined" ? window : this);
