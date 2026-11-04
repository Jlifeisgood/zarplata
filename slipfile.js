/* Листок-файл: один самодостаточный HTML-файл для сотрудника (расчётные листки по месяцам, табель, остаток отпуска).
   Директор отправляет его сам (Telegram, WhatsApp, почта), сотрудник открывает в браузере телефона без установки и без интернета.
   Данные уходят только тому, кому директор отправил файл; на серверах ничего не хранится. */
window.SlipFile = (() => {
  /* Рисует страницу из данных листка (Team.buildSlip). Функция целиком вставляется в файл, поэтому не использует ничего снаружи. */
  function page(data) {
    var MN = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    var DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    var LAB = { a: "П", u: "Б", t: "К", v: "О", s: "Бл" }, CLS = { w: "work", o: "off", a: "abs", u: "unp", t: "trip", v: "vac", s: "sick", x: "out" };
    var DK = { alimony: "алименты", loan: "ссуда / долг", fine: "штраф", other: "другое" }, PK = { advance: "Аванс", salary: "Зарплата", other: "Другое" };
    var open = null, tabYm = null, tab = "slips";
    function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function fmt(n) {
      var x = Math.round(n * 100) / 100, neg = x < 0, p = Math.abs(x).toFixed(2).split("."), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      return (neg ? "−" : "") + i + (p[1] === "00" ? "" : "," + p[1]);
    }
    function fh(x) { return String(Math.round(x * 100) / 100).replace(".", ","); }
    function ymName(ym) { return MN[+ym.slice(5) - 1] + " " + ym.slice(0, 4); }
    function dmy(s) { return s ? s.slice(8) + "." + s.slice(5, 7) + "." + s.slice(0, 4) : ""; }
    function row(a, b, t) { return '<div class="l' + (t ? " t" : "") + '"><span>' + a + '</span><b>' + b + "</b></div>"; }
    var months = data.months || [];
    var tracked = months.some(function (m) { return m.paid > 0; });
    var firstPaid = months.filter(function (m) { return m.paid > 0; }).map(function (m) { return m.ym; }).sort()[0];
    function isTracked(m) { return !!firstPaid && m.ym >= firstPaid; }
    function details(m) {
      var h = '<div class="box">';
      if (m.vac || m.sick || m.aid || m.prem) {
        h += row("Оплата труда", fmt(m.labor));
        if (m.prem) h += row("Доплаты за часы", fmt(m.prem));
        if (m.vac) h += row("Отпускные", fmt(m.vac));
        if (m.sick) h += row("Больничный", fmt(m.sick));
        if (m.aid) h += row("Материальная помощь", fmt(m.aid));
      }
      h += row("Начислено", fmt(m.gross));
      if (m.exempt > 0) h += row("Не облагается", fmt(m.exempt));
      h += row("НДФЛ", "− " + fmt(m.pit));
      if (m.inps > 0) h += row(m.inside ? "ИНПС (из НДФЛ)" : "ИНПС", (m.inside ? "" : "− ") + fmt(m.inps));
      h += row("На руки", fmt(m.net), 1) + "</div>";
      var p = "";
      (m.deds || []).forEach(function (d) { p += row("Удержание: " + esc(DK[d.kind] || d.kind) + (d.note ? " (" + esc(d.note) + ")" : ""), "− " + fmt(d.amount)); });
      if (isTracked(m)) {
        if (m.ded) p += row("К выплате", fmt(m.due));
        (m.pays || []).forEach(function (q) { p += row(esc(PK[q.kind] || q.kind) + (q.date ? " · " + dmy(q.date) : ""), fmt(q.amount)); });
        p += row("Выплачено", fmt(m.paid)) + row(m.left < 0 ? "Выплачено лишнего" : "Осталось выплатить", fmt(Math.abs(m.left)), 1);
      } else p += row("К выплате", fmt(m.due), 1);
      return h + '<div class="box">' + p + "</div>";
    }
    function slips() {
      if (!months.length) return '<p class="mute">Начислений пока нет.</p>';
      var t = months[0], h = '<div class="hero"><div>На руки за ' + esc(ymName(t.ym).toLowerCase()) + '</div><div class="big">' + fmt(t.net) + ' <small>сум</small></div><div class="g"><div>Начислено<b>' + fmt(t.gross) + "</b></div><div>НДФЛ<b>" + fmt(t.pit) + "</b></div>" +
        (isTracked(t) ? "<div>Выплачено<b>" + fmt(t.paid) + "</b></div><div>Осталось<b>" + fmt(Math.max(0, t.left)) + "</b></div>" : "") + "</div></div><h3>По месяцам</h3>";
      months.forEach(function (m) {
        var st = isTracked(m) && m.due > 0 ? (m.left <= 0 ? "выплачено" : m.paid > 0 ? "осталось " + fmt(m.left) : "не выплачено") : "";
        h += '<button class="it" data-ym="' + m.ym + '"><span><b>' + esc(ymName(m.ym)) + '</b><i>' + st + "</i></span><b>" + fmt(m.net) + "</b></button>" + (open === m.ym ? details(m) : "");
      });
      return h;
    }
    function tabel() {
      var ms = months.filter(function (m) { return m.tab; });
      var h = "";
      if (ms.length) {
        var i = Math.max(0, ms.findIndex(function (m) { return m.ym === tabYm; })), m = ms[i], t = m.tab;
        h += '<div class="nav"><button data-d="1"' + (i >= ms.length - 1 ? " disabled" : "") + '>‹</button><b>' + esc(ymName(m.ym)) + '</b><button data-d="-1"' + (i <= 0 ? " disabled" : "") + '>›</button></div>';
        var lead = (new Date(+m.ym.slice(0, 4), +m.ym.slice(5) - 1, 1).getDay() + 6) % 7;
        h += '<div class="grid">' + DOW.map(function (x) { return '<div class="th">' + x + "</div>"; }).join("") + "<div></div>".repeat(lead);
        t.grid.split("").forEach(function (c, d) { h += '<div class="td ' + CLS[c] + '"><b>' + (d + 1) + "</b><i>" + (t.hours && c === "w" ? fh(t.hours[d]) : (LAB[c] || "")) + "</i></div>"; });
        h += '</div><p class="mute">П прогул · Б за свой счёт · К командировка · О отпуск · Бл больничный</p>';
        h += '<div class="box">' + row(t.hrs ? "Норма часов" : "Рабочих дней по графику", t.hrs ? fh(t.W) + " ч" : t.W) + row("Оплачивается", t.hrs ? fh(t.paid) + " ч" : t.paid + " дн.", 1);
        if (m.over) {
          if (m.over.ot) h += row("Сверхурочные", fh(m.over.ot) + " ч · " + fmt(m.over.otPay));
          if (m.over.wk) h += row("В выходные и праздники", fh(m.over.wk) + " ч · " + fmt(m.over.wkPay));
          if (m.over.night) h += row("Ночные", fh(m.over.night) + " ч · " + fmt(m.over.nightPay));
        }
        h += "</div>";
      } else h += '<p class="mute">Табеля пока нет.</p>';
      var L = data.leave;
      if (L) h += "<h3>Отпуск</h3>" + '<div class="box">' + row("Положено в год", L.per + " дн.") + row("Накоплено", String(L.earned).replace(".", ",") + " дн.") + row("Использовано", L.used + " дн.") + (L.adj ? row("Поправка", (L.adj > 0 ? "+" : "") + L.adj + " дн.") : "") + row("Остаток", String(L.left).replace(".", ",") + " дн.", 1) + '</div><p class="mute">Примерный расчёт по дате приёма. Точный остаток уточняйте у директора.</p>';
      var ev = data.events || [];
      if (ev.length) h += "<h3>Отпуска и больничные</h3>" + '<div class="box">' + ev.map(function (x) { return row((x.type === "vac" ? "Отпуск " : x.type === "sick" ? "Больничный " : "Расчёт при увольнении ") + dmy(x.from) + (x.to !== x.from ? " – " + dmy(x.to) : ""), fmt(x.amount)); }).join("") + "</div>";
      return h;
    }
    function draw() {
      var el = document.getElementById("app");
      el.innerHTML = '<h1>' + esc(data.name) + '</h1><p class="mute">' + esc(data.company) + (data.pos ? " · " + esc(data.pos) : "") + '</p><div class="seg"><button data-tab="slips" class="' + (tab === "slips" ? "on" : "") + '">Листки</button><button data-tab="tabel" class="' + (tab === "tabel" ? "on" : "") + '">Табель и отпуск</button></div>' +
        (tab === "slips" ? slips() : tabel()) + '<p class="mute foot">Файл подготовлен ' + esc(data.made) + ". Данные действительны на эту дату, актуальный файл пришлёт директор.</p>";
      el.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; draw(); }; });
      el.querySelectorAll("[data-ym]").forEach(function (b) { b.onclick = function () { open = open === b.dataset.ym ? null : b.dataset.ym; draw(); }; });
      el.querySelectorAll("[data-d]").forEach(function (b) {
        b.onclick = function () {
          var ms = months.filter(function (m) { return m.tab; }), i = Math.max(0, ms.findIndex(function (m) { return m.ym === tabYm; })), n = ms[i + +b.dataset.d];
          if (n) { tabYm = n.ym; draw(); }
        };
      });
    }
    draw();
  }

  const CSS = ':root{--bg:#f4f6fb;--card:#fff;--ink:#14182b;--mute:#6b7390;--line:#e6e9f2;--pri:#4f46e5;--soft:#eceefd;--bad:#c62f48;--badbg:#fce8eb;--warn:#a15c07;--warnbg:#fdf0dc;--ok:#13795b;--okbg:#e2f4ee}' +
    '@media(prefers-color-scheme:dark){:root{--bg:#0e1020;--card:#181b30;--ink:#eceefb;--mute:#9aa1c4;--line:#272b47;--pri:#8f88ff;--soft:#23274a;--bad:#ff8a9d;--badbg:#3a1d27;--warn:#f0b35a;--warnbg:#3a2d17;--ok:#5fd3ab;--okbg:#17352c}}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:16px;max-width:560px;margin:0 auto}h1{font-size:24px;margin:8px 0 2px}h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mute);margin:22px 4px 8px}' +
    '.mute{color:var(--mute);font-size:14px;margin:4px 0 12px}.foot{margin-top:24px;text-align:center;font-size:12px}.seg{display:flex;background:var(--soft);border-radius:14px;padding:4px;gap:4px;margin:12px 0 16px}.seg button{flex:1;border:0;background:none;color:var(--mute);font:inherit;font-weight:600;padding:10px;border-radius:11px}.seg .on{background:var(--card);color:var(--pri)}' +
    '.hero{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:20px;padding:16px}.big{font-size:32px;font-weight:750;margin:2px 0 10px}.big small{font-size:15px;opacity:.8}.g{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;border-top:1px solid rgba(255,255,255,.3);padding-top:10px;font-size:12px}.g b{display:block;font-size:16px}' +
    '.it{display:flex;justify-content:space-between;gap:10px;width:100%;text-align:left;border:0;background:var(--card);color:var(--ink);font:inherit;padding:14px;border-radius:14px;margin-bottom:6px}.it span{display:flex;flex-direction:column}.it i{font-style:normal;font-size:13px;color:var(--mute)}' +
    '.box{background:var(--card);border-radius:14px;padding:6px 14px;margin:0 0 8px}.l{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}.l:last-child{border-bottom:0}.l b{white-space:nowrap}.l.t{font-weight:700}.l span{color:var(--mute)}.l.t span{color:var(--ink)}' +
    '.nav{display:flex;align-items:center;justify-content:space-between;background:var(--card);border-radius:14px;padding:6px;margin-bottom:10px}.nav button{border:0;background:none;color:var(--pri);font-size:26px;width:44px;height:40px}.nav button:disabled{opacity:.25}' +
    '.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}.th{text-align:center;font-size:12px;color:var(--mute);font-weight:600}.td{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:46px;border-radius:11px;background:var(--card)}.td b{font-size:14px;line-height:1.1}.td i{font-style:normal;font-size:11px;font-weight:700;min-height:12px}' +
    '.td.off,.td.out{background:none;color:var(--mute);opacity:.5}.td.abs{background:var(--badbg);color:var(--bad)}.td.unp{background:var(--warnbg);color:var(--warn)}.td.trip{background:var(--okbg);color:var(--ok)}.td.vac{background:var(--soft);color:var(--pri)}.td.sick{background:var(--badbg);color:var(--bad)}';

  /** HTML-файл для сотрудника из данных листка */
  function html(slip, made) {
    const data = Object.assign({}, slip, { made });
    // «<» и разделители строк JS в тексте экранируем, чтобы данные нельзя было принять за разметку
    const json = JSON.stringify(data).replace(new RegExp("[<" + String.fromCharCode(8232, 8233) + "]", "g"), function (c) { return String.fromCharCode(92) + "u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4); });
    return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      String(slip.name).replace(/[<>&"]/g, "") + ' — расчётные листки</title><style>' + CSS + '</style></head><body><div id="app"></div><script>(' + page.toString() + ')(' + json + ');<\/script></body></html>';
  }
  return { html, page };
})();
