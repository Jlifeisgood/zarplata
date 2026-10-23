"use strict";
/* Зарплата — расчёт НДФЛ, ИНПС, ЕСП. Все данные хранятся только на телефоне. */
const A = window.Android;
const C = window.Calc;
const KEY = "zarplata.v1";
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_G = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/* ---------- утилиты ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const pct = n => String(n).replace(".", ",") + "%";
const pad = n => String(n).padStart(2, "0");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const curYm = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const addYm = (ym, d) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + d; return Math.floor(t / 12) + "-" + pad((t % 12) + 1); };
const ymLabel = ym => { const [y, m] = ym.split("-").map(Number); return MONTHS[m - 1] + " " + y; };
const fullName = e => [e.last, e.first, e.mid].filter(Boolean).join(" ");
const shortName = e => e.last + " " + (e.first ? e.first[0] + "." : "") + (e.mid ? e.mid[0] + "." : "");
const initials = e => ((e.last || "?")[0] + (e.first || "")[0]).toUpperCase();
const parseAmt = v => Number(String(v || "").replace(/\D/g, "")) || 0;
const RULES_YEAR = 2026; // год, по правилам которого считает приложение (проект нового НК пока не действует)
const yearNote = ym => Number(ym.slice(0, 4)) > RULES_YEAR
  ? '<div class="alert warn">Правила на ' + ym.slice(0, 4) + ' год ещё не утверждены — расчёт идёт по правилам ' + RULES_YEAR + ' года.</div>' : "";
const ICON = {
  left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  team: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.6a3.2 3.2 0 0 1 0 5.8M18 14.8c1.9.7 3 2.4 3 5.2"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v8h14v-8"/></svg>'
};

/* ---------- данные ---------- */
function blank() {
  return { v: 1, setup: false, theme: "auto", company: { name: "", inn: "", split: false }, rules: Object.assign({}, C.DEFAULT_RULES), emps: [], months: {} };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1 && Array.isArray(s.emps)) {
      s.rules = Object.assign({}, C.DEFAULT_RULES, s.rules);
      if (s.rules.mrot === 1271000) s.rules.mrot = C.DEFAULT_RULES.mrot; // МРОТ вырос с 01.09.2026
      s.company = Object.assign({ name: "", inn: "", split: false }, s.company);
      s.months = s.months || {};
      return s;
    }
  } catch (e) { }
  return blank();
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Не удалось сохранить данные"); } }

const rulesFor = ym => (S.months[ym] && S.months[ym].rules) || S.rules;
const empActive = (e, ym) => e.from <= ym && (!e.to || ym <= e.to);
function entryFor(e, ym) {
  const m = S.months[ym] && S.months[ym].e && S.months[ym].e[e.id];
  return {
    amount: m && m.amount != null ? m.amount : e.amount,
    mode: (m && m.mode) || e.mode,
    type: (m && m.type) || e.type,
    dept: (m && m.dept) || e.dept,
    skip: !!(m && m.skip),
    custom: !!m
  };
}
/* Прошлые месяцы «замораживаем» перед изменением ставок или суммы по умолчанию: задним числом ничего не пересчитывается. */
function freezePast() {
  const cur = curYm();
  let min = null;
  S.emps.forEach(e => { if (!min || e.from < min) min = e.from; });
  if (!min) return;
  if (min < addYm(cur, -120)) min = addYm(cur, -120);
  for (let ym = min; ym < cur; ym = addYm(ym, 1)) {
    const m = S.months[ym] || (S.months[ym] = {});
    if (!m.rules) m.rules = Object.assign({}, S.rules);
    if (!m.e) m.e = {};
    S.emps.forEach(e => {
      if (empActive(e, ym) && !m.e[e.id]) m.e[e.id] = { amount: e.amount, mode: e.mode, type: e.type, dept: e.dept };
    });
  }
}
function calcEntry(e, ym) {
  const en = entryFor(e, ym);
  const r = C.calc({ amount: en.amount, mode: en.mode, type: en.type }, rulesFor(ym));
  return { en, r };
}
const ZERO = () => ({ gross: 0, pit: 0, inps: 0, pitBudget: 0, esp: 0, net: 0, cost: 0 });
const KEYS = Object.keys(ZERO());
function addTo(t, r) { KEYS.forEach(k => { t[k] += r[k] || 0; }); return t; }
function sumList(list) { const t = ZERO(); list.forEach(r => addTo(t, r)); return t; }

/* ---------- состояние интерфейса ---------- */
const ui = { tab: "pay", ym: curYm(), filter: "all", kind: "reg", per: "month", repYm: curYm(), showOld: false };
let D = null; // черновик открытой шторки

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600);
}
function openSheet(html) {
  const s = $("#sheet");
  s.innerHTML = '<div class="grab"></div>' + html;
  s.scrollTop = 0;
  requestAnimationFrame(() => { s.classList.add("on"); $("#backdrop").classList.add("on"); });
}
function closeSheet() { $("#sheet").classList.remove("on"); $("#backdrop").classList.remove("on"); D = null; }
const sheetOpen = () => $("#sheet").classList.contains("on");
window.handleBack = () => {
  if (sheetOpen()) { closeSheet(); return true; }
  if (S.setup && ui.tab !== "pay") { setTab("pay"); return true; }
  return false;
};
function confirmBox(msg) { return window.confirm(msg); }

/* ---------- общие блоки ---------- */
function breakdown(r, rules, type) {
  const inside = rules.inpsInsidePit;
  const rt = C.rates(rules, type), espR = rt.esp;
  let h = '<div class="calc">';
  h += '<div class="l"><span>Начислено</span><b class="num">' + fmt(r.gross) + '</b></div>';
  h += '<div class="l"><span>НДФЛ ' + pct(rt.pit) + (rules.itpark && type !== "gph" ? " (IT Park)" : "") + '</span><span class="num">− ' + fmt(r.pit) + '</span></div>';
  if (r.inps > 0 && !inside) h += '<div class="l"><span>ИНПС ' + pct(rules.inps) + '</span><span class="num">− ' + fmt(r.inps) + '</span></div>';
  h += '<div class="l t"><span>На руки</span><span class="num">' + fmt(r.net) + '</span></div>';
  h += '</div><div class="calc">';
  if (r.inps > 0 && inside) h += '<div class="l"><span>ИНПС ' + pct(rules.inps) + ' (из НДФЛ)</span><span class="num">' + fmt(r.inps) + '</span></div>';
  h += '<div class="l"><span>НДФЛ в бюджет</span><span class="num">' + fmt(r.pitBudget) + '</span></div>';
  h += '<div class="l"><span>Соцналог (ЕСП) ' + pct(espR) + ', за счёт работодателя</span><span class="num">' + fmt(r.esp) + '</span></div>';
  h += '<div class="l t"><span>Расход компании</span><span class="num">' + fmt(r.cost) + '</span></div>';
  h += '</div>';
  return h;
}
const seg = (k, val, opts, act) => '<div class="seg">' + opts.map(o =>
  '<button type="button" data-act="' + (act || "seg") + '" data-k="' + k + '" data-v="' + o[0] + '" class="' + (val === o[0] ? "on" : "") + '">' + o[1] + '</button>').join("") + '</div>';
const sw = (act, k, on, t, d) => '<button type="button" class="sw ' + (on ? "on" : "") + '" data-act="' + act + '" data-k="' + k + '"><span class="grow"><div class="t">' + t + '</div>' + (d ? '<div class="d">' + d + '</div>' : "") + '</span><i></i></button>';
const deptName = d => d === "prod" ? "Производство" : "АУП";
function empty(icon, title, text, btn) {
  return '<div class="empty"><div class="ill">' + icon + '</div><h3>' + title + '</h3><p>' + text + '</p>' + (btn || "") + '</div>';
}

/* ---------- каркас ---------- */
function setTab(t) { ui.tab = t; render(); window.scrollTo(0, 0); }
function render() {
  document.body.classList.toggle("wel-on", !S.setup);
  applyTheme();
  const app = $("#app");
  if (!S.setup) { app.innerHTML = welcome(); return; }
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === ui.tab));
  app.innerHTML = ({ pay: viewPay, team: viewTeam, rep: viewRep, set: viewSet })[ui.tab]();
}
function applyTheme() {
  const r = document.documentElement;
  if (S.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", S.theme);
  try {
    if (A && A.setBars) {
      const dark = S.theme === "dark" || (S.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      A.setBars(getComputedStyle(document.body).backgroundColor, dark);
    }
  } catch (e) { }
}

/* ---------- приветствие ---------- */
function welcome() {
  return '<div class="wel"><div class="logo">' + ICON.wallet + '</div><h1>Зарплата</h1>' +
    '<p>Считает НДФЛ, ИНПС и ЕСП, показывает сумму «на руки» и готовит отчёты. Данные хранятся только на вашем телефоне.</p>' +
    '<label class="f"><span>Название компании</span><input class="in" id="w-name" placeholder="Например, ООО «Ромашка»" autocomplete="off"></label>' +
    '<label class="f"><span>ИНН (по желанию)</span><input class="in" id="w-inn" inputmode="numeric" maxlength="9" placeholder="9 цифр"></label>' +
    sw("swd", "split", D && D.split, "Есть производство", "Разделять сотрудников на АУП и производство") +
    '<div class="stack"><button class="btn" data-act="start">Начать</button><button class="btn ghost" data-act="demo">Посмотреть на примере</button></div></div>';
}

/* ---------- вкладка «Зарплата» ---------- */
function monthRows(ym) {
  return S.emps.filter(e => empActive(e, ym)).map(e => { const x = calcEntry(e, ym); return { e, en: x.en, r: x.r }; })
    .sort((a, b) => (a.en.dept === b.en.dept ? 0 : a.en.dept === "aup" ? -1 : 1) || a.e.last.localeCompare(b.e.last, "ru"));
}
function payItem(x) {
  const { e, en, r } = x;
  const t = en.type === "gph" ? '<span class="badge warn">ГПХ</span>' : "";
  const sub = en.skip ? "не начисляется в этом месяце" : (e.pos ? esc(e.pos) + " · " : "") + "начислено " + fmt(r.gross);
  return '<button class="item ' + (en.skip ? "off" : "") + '" data-act="openPay" data-id="' + e.id + '"><div class="av ' + (S.company.split ? en.dept : "") + '">' + esc(initials(e)) + '</div>' +
    '<div class="grow"><div class="nm">' + esc(shortName(e)) + t + (en.custom && !en.skip ? '<span class="badge">изменено</span>' : "") + '</div><div class="sb">' + sub + '</div></div>' +
    '<div class="r"><b class="num">' + (en.skip ? "—" : fmt(r.net)) + '</b><span>на руки</span></div></button>';
}
function viewPay() {
  const ym = ui.ym, rows = monthRows(ym), live = rows.filter(x => !x.en.skip);
  let h = '<div class="top"><h1>Зарплата</h1><div class="sub">' + esc(S.company.name || "Мои сотрудники") + '</div></div><div class="page">';
  h += '<div class="month"><button class="ib" data-act="ym" data-d="-1" aria-label="Предыдущий месяц">' + ICON.left + '</button><div class="m">' + ymLabel(ym) +
    (ym === curYm() ? "<small>текущий месяц</small>" : "") + '</div><button class="ib" data-act="ym" data-d="1" aria-label="Следующий месяц">' + ICON.right + '</button></div>';
  h += yearNote(ym);
  if (!S.emps.length) {
    return h + empty(ICON.team, "Пока никого нет", "Добавьте сотрудника — укажите ФИО и начисление, остальное посчитается само.",
      '<button class="btn" data-act="newEmp">' + ICON.plus + 'Добавить сотрудника</button>') + "</div>";
  }
  if (!rows.length) return h + empty(ICON.team, "В этом месяце никого", "Все сотрудники работают в другие месяцы.", "") + "</div>";
  let list = rows;
  if (S.company.split && ui.filter !== "all") list = rows.filter(x => x.en.dept === ui.filter);
  const T = sumList(list.filter(x => !x.en.skip).map(x => x.r));
  h += '<div class="hero"><div class="lbl">К выплате на руки · ' + (list.filter(x => !x.en.skip).length) + ' чел.</div><div class="big num">' + fmt(T.net) + '<small>сум</small></div>' +
    '<div class="grid"><div>Начислено<b class="num">' + fmt(T.gross) + '</b></div><div>НДФЛ<b class="num">' + fmt(T.pit) + '</b></div>' +
    '<div>ИНПС<b class="num">' + fmt(T.inps) + '</b></div><div>ЕСП (работодатель)<b class="num">' + fmt(T.esp) + '</b></div></div>' +
    '<div class="cost">Всего расход компании: <b class="num">' + fmt(T.cost) + '</b> сум</div></div>';
  if (S.company.split) {
    h += '<div class="sec"></div>' + seg("filter", ui.filter, [["all", "Все"], ["aup", "АУП"], ["prod", "Производство"]], "filter");
  }
  h += '<div class="sec">Сотрудники<span class="tag">нажмите, чтобы изменить сумму</span></div>';
  if (S.company.split && ui.filter === "all") {
    ["aup", "prod"].forEach(d => {
      const g = rows.filter(x => x.en.dept === d);
      if (!g.length) return;
      const gt = sumList(g.filter(x => !x.en.skip).map(x => x.r));
      h += '<div class="sec" style="margin-top:14px"><span>' + deptName(d) + " · " + g.length + '</span><span class="tag num">' + fmt(gt.net) + ' на руки</span></div><div class="card">' + g.map(payItem).join("") + "</div>";
    });
  } else h += '<div class="card">' + list.map(payItem).join("") + "</div>";
  return h + "</div>";
}

function openPay(id) {
  const e = S.emps.find(x => x.id === id); if (!e) return;
  const en = entryFor(e, ui.ym);
  D = { kind: "pay", id, mode: en.mode, skip: en.skip, amt: en.amount };
  openSheet('<h2>' + esc(fullName(e)) + '</h2><p class="sub">' + ymLabel(ui.ym) + (en.type === "gph" ? " · договор ГПХ" : "") + '</p>' +
    seg("mode", D.mode, [["gross", "Начислено"], ["net", "На руки"]]) +
    '<div style="height:12px"></div><label class="f"><span>' + (D.mode === "net" ? "Сумма на руки" : "Сумма начисления") + '</span><input class="in amt" id="f-amt" inputmode="numeric" value="' + (en.amount ? fmt(en.amount) : "") + '" autocomplete="off"></label>' +
    '<div id="prev"></div>' +
    '<div class="btns"><button class="btn" data-act="savePay">Сохранить</button></div>' +
    '<div class="btns"><button class="btn sec2" data-act="slip">' + ICON.share + 'Расчётный листок</button></div>' +
    '<div class="btns">' + '<button class="btn ghost" data-act="skipPay">' + (en.skip ? "Начислять в этом месяце" : "Не начислять в этом месяце") + '</button>' +
    (en.custom ? '<button class="btn ghost" data-act="resetPay">Вернуть стандартную</button>' : "") + '</div>');
  updPreview();
}
function curDraftEmp() { return S.emps.find(x => x.id === (D && D.id)); }
function updPreview() {
  const el = $("#prev"); if (!el || !D) return;
  const amt = parseAmt($("#f-amt").value);
  let type, rules = S.rules, hint = "";
  if (D.kind === "pay") { const e = curDraftEmp(); type = entryFor(e, ui.ym).type; rules = rulesFor(ui.ym); }
  else type = D.type;
  const r = C.calc({ amount: amt, mode: D.mode, type }, rules);
  if (amt > 0 && type === "trud" && r.gross < rules.mrot) hint = '<div class="hint warn">Начисление меньше МРОТ (' + fmt(rules.mrot) + ' сум). Для полной ставки это недопустимо; при неполной ставке — нормально.</div>';
  el.innerHTML = amt > 0 ? breakdown(r, rules, type) + hint : '<div class="hint">Введите сумму — ниже появится расчёт.</div>';
}
function savePay() {
  const e = curDraftEmp(), amt = parseAmt($("#f-amt").value);
  if (!e) return;
  if (!(amt > 0) && !D.skip) { $("#f-amt").classList.add("bad"); toast("Введите сумму"); return; }
  const m = S.months[ui.ym] || (S.months[ui.ym] = {});
  m.e = m.e || {};
  const base = entryFor(e, ui.ym);
  m.e[e.id] = { amount: amt || base.amount, mode: D.mode, type: base.type, dept: base.dept, skip: D.skip || undefined };
  save(); closeSheet(); render(); toast("Сохранено");
}
function payslip(e) {
  const { en, r } = calcEntry(e, ui.ym), R = rulesFor(ui.ym);
  const L = ["Расчётный листок", S.company.name ? "Компания: " + S.company.name : "", "Сотрудник: " + fullName(e), "Период: " + ymLabel(ui.ym), "",
    "Начислено: " + fmt(r.gross) + " сум", "НДФЛ " + pct(C.rates(R, en.type).pit) + ": " + fmt(r.pit) + " сум"];
  if (r.inps) L.push("ИНПС " + pct(R.inps) + (R.inpsInsidePit ? " (входит в НДФЛ)" : "") + ": " + fmt(r.inps) + " сум");
  L.push("К выплате на руки: " + fmt(r.net) + " сум");
  return L.filter(x => x !== "" || true).join("\n");
}

/* ---------- вкладка «Сотрудники» ---------- */
function empItem(e) {
  const cur = curYm(), ym = e.to && e.to < cur ? e.to : cur, en = entryFor(e, ym);
  const type = en.type === "gph" ? '<span class="badge warn">ГПХ</span>' : "";
  const off = e.to && e.to < cur;
  const sub = [e.pos, S.company.split ? deptName(e.dept) : "", e.pinfl ? "" : "нет ПИНФЛ"].filter(Boolean).join(" · ");
  return '<button class="item ' + (off ? "off" : "") + '" data-act="openEmp" data-id="' + e.id + '"><div class="av ' + (S.company.split ? e.dept : "") + '">' + esc(initials(e)) + '</div>' +
    '<div class="grow"><div class="nm">' + esc(fullName(e)) + type + '</div><div class="sb">' + esc(sub || "—") + '</div></div>' +
    '<div class="r"><b class="num">' + fmt(en.amount) + '</b><span>' + (en.mode === "net" ? "на руки" : "начислено") + '</span></div></button>';
}
function viewTeam() {
  const cur = curYm();
  const act = S.emps.filter(e => !e.to || e.to >= cur), old = S.emps.filter(e => e.to && e.to < cur);
  const byName = (a, b) => a.last.localeCompare(b.last, "ru");
  let h = '<div class="top"><h1>Сотрудники</h1><div class="sub">' + act.length + ' работает' + (old.length ? ", " + old.length + " уволено" : "") + '</div></div><div class="page">';
  if (!S.emps.length) return h + empty(ICON.team, "Добавьте первого сотрудника", "Фамилия, имя и сумма — этого достаточно. ПИНФЛ можно добавить позже.",
    '<button class="btn" data-act="newEmp">' + ICON.plus + 'Добавить сотрудника</button>') + "</div>";
  if (S.company.split) {
    ["aup", "prod"].forEach(d => {
      const g = act.filter(e => e.dept === d).sort(byName);
      if (g.length) h += '<div class="sec"><span>' + deptName(d) + " · " + g.length + '</span></div><div class="card">' + g.map(empItem).join("") + "</div>";
    });
  } else h += '<div class="sec" style="margin-top:10px"></div><div class="card">' + act.sort(byName).map(empItem).join("") + "</div>";
  if (old.length) {
    h += '<div class="sec"><span>Уволенные · ' + old.length + '</span><button class="tag" style="color:var(--pri)" data-act="toggleOld">' + (ui.showOld ? "скрыть" : "показать") + '</button></div>';
    if (ui.showOld) h += '<div class="card">' + old.sort(byName).map(empItem).join("") + "</div>";
  }
  return h + '</div><button class="btn fab" data-act="newEmp">' + ICON.plus + 'Сотрудник</button>';
}
function openEmp(id) {
  const e = id ? S.emps.find(x => x.id === id) : null;
  D = e ? { kind: "emp", id, type: e.type, mode: e.mode, dept: e.dept, touchedMode: true }
        : { kind: "emp", id: null, type: "trud", mode: "gross", dept: "aup", touchedMode: false };
  const v = e || { last: "", first: "", mid: "", pinfl: "", pos: "", amount: 0, from: ui.ym, to: "" };
  openSheet('<h2>' + (e ? "Сотрудник" : "Новый сотрудник") + '</h2><p class="sub">' + (e ? "Изменения суммы действуют с текущего месяца, прошлые месяцы не пересчитываются." : "Заполните основное — остальное можно добавить позже.") + '</p>' +
    '<label class="f"><span>Фамилия *</span><input class="in" id="f-last" value="' + esc(v.last) + '" autocomplete="off"></label>' +
    '<div class="two"><label class="f"><span>Имя *</span><input class="in" id="f-first" value="' + esc(v.first) + '" autocomplete="off"></label>' +
    '<label class="f"><span>Отчество</span><input class="in" id="f-mid" value="' + esc(v.mid) + '" autocomplete="off"></label></div>' +
    '<label class="f"><span>ПИНФЛ (14 цифр)</span><input class="in" id="f-pinfl" inputmode="numeric" maxlength="14" value="' + esc(v.pinfl) + '" placeholder="нужен для отчёта по НДФЛ"></label>' +
    '<label class="f"><span>Должность</span><input class="in" id="f-pos" value="' + esc(v.pos) + '" autocomplete="off"></label>' +
    (S.company.split ? '<div class="f"><span>Отдел</span>' + seg("dept", D.dept, [["aup", "АУП"], ["prod", "Производство"]]) + '</div>' : "") +
    '<div class="f"><span>Договор</span>' + seg("type", D.type, [["trud", "Трудовой"], ["gph", "ГПХ"]]) + '</div>' +
    '<div class="f"><span>Как вводите сумму</span>' + seg("mode", D.mode, [["gross", "Начислено"], ["net", "На руки (обратный расчёт)"]]) + '</div>' +
    '<label class="f"><span id="amt-l">' + (D.mode === "net" ? "Сумма на руки в месяц" : "Начисление в месяц") + ' *</span><input class="in amt" id="f-amt" inputmode="numeric" value="' + (v.amount ? fmt(v.amount) : "") + '" autocomplete="off"></label>' +
    '<div id="prev"></div>' +
    '<div class="two"><label class="f"><span>Работает с</span><input class="in" type="month" id="f-from" value="' + esc(v.from) + '"></label>' +
    '<label class="f"><span>Последний месяц</span><input class="in" type="month" id="f-to" value="' + esc(v.to || "") + '"></label></div>' +
    (e ? '<div class="hint">«Последний месяц» заполняйте при увольнении — дальше начисления не будет.</div>' : "") +
    '<div class="stack"><button class="btn" data-act="saveEmp">Сохранить</button>' +
    (e ? '<button class="btn bad" data-act="delEmp">Удалить сотрудника</button>' : "") + '</div>');
  updPreview();
}
function saveEmp() {
  const g = id => $("#" + id).value.trim();
  const last = g("f-last"), first = g("f-first"), amt = parseAmt($("#f-amt").value), pinfl = g("f-pinfl").replace(/\D/g, "");
  let bad = false;
  [["f-last", !last], ["f-first", !first], ["f-amt", !(amt > 0)], ["f-pinfl", pinfl && pinfl.length !== 14]].forEach(([id, b]) => { $("#" + id).classList.toggle("bad", !!b); bad = bad || !!b; });
  if (bad) { toast(pinfl && pinfl.length !== 14 ? "ПИНФЛ — ровно 14 цифр" : "Заполните отмеченные поля"); return; }
  const from = g("f-from") || ui.ym, to = g("f-to");
  if (to && to < from) { toast("Последний месяц раньше начала работы"); return; }
  const data = { last, first, mid: g("f-mid"), pinfl, pos: g("f-pos"), dept: S.company.split ? D.dept : "aup", type: D.type, mode: D.mode, amount: amt, from, to: to || "" };
  if (D.id) {
    const e = S.emps.find(x => x.id === D.id);
    if (e.amount !== amt || e.mode !== D.mode || e.type !== D.type || e.dept !== data.dept) freezePast();
    Object.assign(e, data);
  } else S.emps.push(Object.assign({ id: uid() }, data));
  save(); closeSheet(); render(); toast("Сохранено");
}

/* ---------- отчёты ---------- */
function repMonths() {
  const [y, m] = ui.repYm.split("-").map(Number);
  if (ui.per === "month") return [ui.repYm];
  if (ui.per === "quarter") { const q = Math.floor((m - 1) / 3); return [0, 1, 2].map(i => y + "-" + pad(q * 3 + i + 1)); }
  return Array.from({ length: 12 }, (_, i) => y + "-" + pad(i + 1));
}
function repLabel() {
  const [y, m] = ui.repYm.split("-").map(Number);
  if (ui.per === "month") return ymLabel(ui.repYm);
  if (ui.per === "quarter") return ["I", "II", "III", "IV"][Math.floor((m - 1) / 3)] + " квартал " + y;
  return y + " год";
}
function aggregate(months) {
  const map = new Map();
  months.forEach(ym => S.emps.forEach(e => {
    if (!empActive(e, ym)) return;
    const { en, r } = calcEntry(e, ym);
    if (en.skip || r.gross <= 0) return;
    let x = map.get(e.id);
    if (!x) map.set(e.id, x = Object.assign({ e, n: 0 }, ZERO()));
    addTo(x, r); x.n++; x.type = en.type; x.dept = en.dept;
  }));
  const rows = [...map.values()].sort((a, b) => (a.dept === b.dept ? 0 : a.dept === "aup" ? -1 : 1) || a.e.last.localeCompare(b.e.last, "ru"));
  return { rows, tot: sumList(rows) };
}
/* Одна сборка и для экрана, и для Excel. Ячейка: строка или число. */
function buildReport(kind, agg, scr) {
  const nm = x => scr ? shortName(x.e) : fullName(x.e);
  const split = S.company.split, out = { head: [], body: [], num: [] };
  const grp =(t) => out.body.push({ t: "grp", cells: [t] });
  const groups = () => split ? ["aup", "prod"].map(d => [d, agg.rows.filter(x => x.dept === d)]).filter(g => g[1].length) : [[null, agg.rows]];
  if (kind === "reg") {
    out.head = ["Сотрудник", "Начислено", "НДФЛ", "ИНПС", "На руки", "ЕСП"];
    const line = x => [nm(x), x.gross, x.pit, x.inps, x.net, x.esp];
    groups().forEach(([d, rows]) => {
      if (d) grp(deptName(d));
      rows.forEach(x => out.body.push({ t: "row", cells: line(x) }));
      if (d) { const t = sumList(rows); out.body.push({ t: "sub", cells: ["Итого " + deptName(d), t.gross, t.pit, t.inps, t.net, t.esp] }); }
    });
    const t = agg.tot; out.body.push({ t: "tot", cells: ["ИТОГО", t.gross, t.pit, t.inps, t.net, t.esp] });
  } else if (kind === "tax") {
    out.head = ["Сотрудник", "ПИНФЛ", "Договор", "Доход", "НДФЛ", "ИНПС", "НДФЛ в бюджет", "ЕСП"];
    const line = x => [nm(x), x.e.pinfl || "нет данных", x.type === "gph" ? "ГПХ" : "Трудовой", x.gross, x.pit, x.inps, x.pitBudget, x.esp];
    groups().forEach(([d, rows]) => {
      if (d) grp(deptName(d));
      rows.forEach(x => out.body.push({ t: "row", cells: line(x) }));
      if (d) { const t = sumList(rows); out.body.push({ t: "sub", cells: ["Итого " + deptName(d), "", "", t.gross, t.pit, t.inps, t.pitBudget, t.esp] }); }
    });
    const t = agg.tot; out.body.push({ t: "tot", cells: ["ИТОГО", "", "", t.gross, t.pit, t.inps, t.pitBudget, t.esp] });
  } else {
    out.head = ["", "Чел.", "Начислено", "НДФЛ", "ИНПС", "ЕСП", "На руки", "Расход"];
    const line = (name, rows) => { const t = sumList(rows); return [name, rows.length, t.gross, t.pit, t.inps, t.esp, t.net, t.cost]; };
    if (split) { grp("По отделам"); groups().forEach(([d, rows]) => out.body.push({ t: "row", cells: line(deptName(d), rows) })); }
    grp("По видам договора");
    const tr = agg.rows.filter(x => x.type !== "gph"), gp = agg.rows.filter(x => x.type === "gph");
    if (tr.length) out.body.push({ t: "row", cells: line("Трудовые", tr) });
    if (gp.length) out.body.push({ t: "row", cells: line("ГПХ", gp) });
    out.body.push({ t: "tot", cells: line("ВСЕГО", agg.rows) });
  }
  return out;
}
function tableHtml(rep) {
  const cell = (v, first) => typeof v === "number" ? "<td class='num'>" + fmt(v) + "</td>" : "<td class='" + (first ? "l" : "l") + "'" + (v === "нет данных" ? " style='color:var(--bad)'" : "") + ">" + esc(v) + "</td>";
  let h = '<div class="tw"><table><thead><tr>' + rep.head.map((c, i) => "<th class='" + (i ? "" : "l") + "'>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>";
  rep.body.forEach(r => {
    if (r.t === "grp") h += "<tr class='grp'><td colspan='" + rep.head.length + "'>" + esc(r.cells[0]) + "</td></tr>";
    else h += "<tr class='" + r.t + "'>" + r.cells.map((v, i) => cell(v, i === 0)).join("") + "</tr>";
  });
  return h + "</tbody></table></div>";
}
function viewRep() {
  const months = repMonths(), agg = aggregate(months), rep = buildReport(ui.kind, agg, true);
  let h = '<div class="top"><h1>Отчёты</h1><div class="sub">' + esc(S.company.name || "") + '</div></div><div class="page">';
  h += '<div class="chips">' + [["reg", "Ведомость"], ["tax", "НДФЛ и взносы"], ["sum", "Свод"]].map(k => '<button class="chip ' + (ui.kind === k[0] ? "on" : "") + '" data-act="kind" data-v="' + k[0] + '">' + k[1] + '</button>').join("") + '</div>';
  h += seg("per", ui.per, [["month", "Месяц"], ["quarter", "Квартал"], ["year", "Год"]], "per");
  h += '<div class="month"><button class="ib" data-act="repNav" data-d="-1">' + ICON.left + '</button><div class="m">' + repLabel() + '</div><button class="ib" data-act="repNav" data-d="1">' + ICON.right + '</button></div>';
  h += yearNote(ui.repYm);
  if (!agg.rows.length) return h + empty(ICON.file, "Нет данных за период", "Добавьте сотрудников и начисления — отчёт соберётся сам.", "") + "</div>";
  const noPin = agg.rows.filter(x => !x.e.pinfl).length;
  if (ui.kind === "tax" && noPin) h += '<div class="alert warn">У ' + noPin + ' сотр. не указан ПИНФЛ — без него отчёт по НДФЛ не подать. Добавьте в разделе «Сотрудники».</div>';
  h += '<div class="hint" style="margin:0 2px 8px">Таблицу можно листать вбок →</div>' + tableHtml(rep);
  const t = agg.tot;
  h += '<div class="sec">К перечислению за период</div><div class="pay"><div>НДФЛ в бюджет<b class="num">' + fmt(t.pitBudget) + '</b></div><div>ИНПС<b class="num">' + fmt(t.inps) + '</b></div><div>ЕСП<b class="num">' + fmt(t.esp) + '</b></div></div>';
  h += '<div class="btns"><button class="btn" data-act="xlsx">' + ICON.file + 'Excel</button><button class="btn sec2" data-act="repText">' + ICON.share + 'Текстом</button></div>';
  h += '<div class="note"><b>Справочно.</b> Приложение готовит цифры для сверки; отчётность подаётся и корректируется в личном кабинете my.soliq.uz (по НК: ежемесячно, до 15 числа следующего месяца; итог за год — до 15 февраля). Ставки проверьте в «Настройки → Правила».</div>';
  return h + "</div>";
}
function repTitle() { return (S.company.name ? S.company.name + " — " : "") + repLabel(); }
function exportXlsx() {
  const agg = aggregate(repMonths());
  if (!agg.rows.length) { toast("Нет данных за период"); return; }
  const wb = XLSX.utils.book_new();
  [["reg", "Ведомость"], ["tax", "НДФЛ"], ["sum", "Свод"]].forEach(([k, name]) => {
    const rep = buildReport(k, agg, false);
    const aoa = [[S.company.name || "Организация"], ["ИНН: " + (S.company.inn || "—")], [name + " · " + repLabel()], [], rep.head];
    rep.body.forEach(r => aoa.push(r.t === "grp" ? [r.cells[0]] : r.cells));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = rep.head.map((h, i) => ({ wch: i === 0 ? 34 : i === 1 && k === "tax" ? 18 : 15 }));
    Object.keys(ws).forEach(a => { if (a[0] !== "!" && typeof ws[a].v === "number") ws[a].z = "#,##0"; });
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
  const fname = "Зарплата_" + repLabel().replace(/\s+/g, "_") + ".xlsx";
  sendFile(fname, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b64);
}
function repText() {
  const agg = aggregate(repMonths()), t = agg.tot, R = rulesFor(ui.repYm);
  const L = [repTitle(), "Сотрудников: " + agg.rows.length, "", "Начислено: " + fmt(t.gross), "НДФЛ" + (R.itpark ? "" : " " + pct(R.pit)) + ": " + fmt(t.pit)];
  if (t.inps) L.push("ИНПС " + pct(R.inps) + ": " + fmt(t.inps));
  L.push("На руки: " + fmt(t.net), "", "К перечислению:", "НДФЛ в бюджет: " + fmt(t.pitBudget), "ИНПС: " + fmt(t.inps), "ЕСП: " + fmt(t.esp), "", "Расход компании: " + fmt(t.cost));
  shareText(repTitle(), L.join("\n"));
}

/* ---------- настройки ---------- */
function viewSet() {
  const R = S.rules;
  let h = '<div class="top"><h1>Настройки</h1></div><div class="page"><div class="sec" style="margin-top:10px">Компания</div>';
  h += '<label class="f"><span>Название</span><input class="in" id="c-name" value="' + esc(S.company.name) + '" autocomplete="off"></label>' +
    '<label class="f"><span>ИНН</span><input class="in" id="c-inn" inputmode="numeric" maxlength="9" value="' + esc(S.company.inn) + '"></label>' +
    sw("swc", "split", S.company.split, "Есть производство", "Делить сотрудников и отчёты на АУП и производство") +
    sw("swr", "budget", R.budget, "Бюджетная организация", "ЕСП по повышенной ставке " + pct(R.espBudget)) +
    sw("swr", "itpark", R.itpark, "Резидент IT Park", "Трудовые договоры: НДФЛ " + pct(R.pitIt) + ", ЕСП " + pct(R.espIt) + ". ГПХ — по обычным ставкам");
  h += '<div class="sec">Правила ' + RULES_YEAR + ' года</div><button class="item card" data-act="rates" style="border:0"><div class="grow"><div class="nm">НДФЛ ' + pct(R.itpark ? R.pitIt : R.pit) + ' · ИНПС ' + pct(R.inps) + ' · ЕСП ' + pct(R.itpark ? R.espIt : R.budget ? R.espBudget : R.esp) + (R.itpark ? ' · IT Park' : '') + '</div>' +
    '<div class="sb">ИНПС ' + (R.inpsInsidePit ? "засчитывается в НДФЛ" : "удерживается сверху") + ' · нажмите, чтобы изменить</div></div>' + ICON.right.replace("<svg", '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"') + '</button>';
  h += '<div class="sec">Оформление</div>' + seg("theme", S.theme, [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], "theme");
  h += '<div class="sec">Данные</div><div class="stack" style="margin-top:0"><button class="btn sec2" data-act="backup">Сохранить резервную копию</button><button class="btn sec2" data-act="restore">Восстановить из копии</button>' +
    '<button class="btn bad" data-act="wipe">Стереть все данные</button></div><input type="file" id="restore-file" accept=".json,application/json" hidden>';
  h += '<div class="note"><b>Зарплата ' + (A && A.appVersion ? A.appVersion() : "dev") + '</b><br>Данные хранятся только на этом телефоне, приложение не выходит в интернет. Делайте резервную копию — при очистке данных приложения записи пропадут. Расчёты справочные: сверяйте ставки с Налоговым кодексом.</div></div>';
  return h;
}
function openRates() {
  const R = S.rules;
  D = { kind: "rates", inside: R.inpsInsidePit, gph: R.inpsGph };
  const f = (id, label, v, extra) => '<label class="f"><span>' + label + '</span><input class="in" id="' + id + '" inputmode="decimal" value="' + String(v).replace(".", ",") + '"></label>';
  openSheet('<h2>Правила ' + RULES_YEAR + ' года</h2><p class="sub">Поменялся закон — поправьте здесь. Действует с текущего месяца, прошлые месяцы не пересчитываются.</p>' +
    '<div class="note" style="margin:0 0 14px">Проект нового Налогового кодекса (ЕСП → «социальный налог», отмена 25% для бюджетных, новые сроки) пока не вступил в силу — в расчёте не учтён.</div>' +
    '<div class="two">' + f("r-pit", "НДФЛ, %", R.pit) + f("r-inps", "ИНПС, %", R.inps) + '</div><div class="two">' + f("r-esp", "ЕСП, %", R.esp) + f("r-espb", "ЕСП бюджет, %", R.espBudget) + '</div>' +
    '<div class="sec" style="margin-top:4px">Резидент IT Park (трудовые договоры)</div><div class="two">' + f("r-pitit", "НДФЛ, %", R.pitIt) + f("r-espit", "ЕСП, %", R.espIt) + '</div>' +
    f("r-mrot", "МРОТ, сум (для подсказки)", R.mrot) +
    sw("swd", "inside", D.inside, "ИНПС входит в НДФЛ", "На руки = начислено − НДФЛ. Выключите, если ИНПС удерживается сверху НДФЛ") +
    sw("swd", "gph", D.gph, "Удерживать ИНПС с ГПХ", "Обычно ИНПС только по трудовым договорам") +
    '<div class="stack"><button class="btn" data-act="saveRates">Сохранить</button><button class="btn ghost" data-act="resetRates">Вернуть стандартные</button></div>');
}
function saveRates() {
  const n = id => Number(String($("#" + id).value).replace(",", ".").replace(/\s/g, ""));
  const v = { pit: n("r-pit"), inps: n("r-inps"), esp: n("r-esp"), espBudget: n("r-espb"), pitIt: n("r-pitit"), espIt: n("r-espit"), mrot: n("r-mrot") };
  if (Object.values(v).some(x => !isFinite(x) || x < 0) || v.pit >= 100 || v.pitIt >= 100) { toast("Проверьте числа"); return; }
  freezePast();
  Object.assign(S.rules, v, { inpsInsidePit: D.inside, inpsGph: D.gph });
  save(); closeSheet(); render(); toast("Ставки сохранены");
}

/* ---------- файлы ---------- */
const toB64 = s => btoa(unescape(encodeURIComponent(s)));
function sendFile(name, mime, b64, noShare) {
  if (A && A.saveFile) {
    const r = String(A.saveFile(name, mime, b64));
    if (!r.startsWith("ok:")) { toast("Не удалось сохранить файл"); return; }
    toast("Сохранено в «Загрузки»: " + name);
    if (!noShare && A.shareFile) A.shareFile(r.slice(3), mime, name);
  } else { // проверка в браузере
    const a = document.createElement("a");
    a.href = "data:" + mime + ";base64," + b64; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
}
function shareText(title, text) {
  if (A && A.shareText) A.shareText(title, text);
  else if (navigator.clipboard) { navigator.clipboard.writeText(text); toast("Скопировано"); }
}
function backup() {
  const d = new Date();
  sendFile("zarplata-backup-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json", "application/json", toB64(JSON.stringify(S)), false);
}
function restoreFrom(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const s = JSON.parse(rd.result);
      if (!s || s.v !== 1 || !Array.isArray(s.emps)) throw 0;
      if (!confirmBox("Заменить текущие данные копией (" + s.emps.length + " сотр.)?")) return;
      S = s; S.rules = Object.assign({}, C.DEFAULT_RULES, S.rules); S.months = S.months || {}; S.setup = true;
      save(); render(); toast("Данные восстановлены");
    } catch (e) { toast("Это не файл резервной копии"); }
  };
  rd.readAsText(file);
}

/* ---------- демо ---------- */
function demo() {
  S = blank(); S.setup = true; S.company = { name: "ООО «Пример»", inn: "", split: true };
  const f = ui.ym;
  const e = (last, first, mid, pos, dept, type, mode, amount, pinfl) => S.emps.push({ id: uid(), last, first, mid, pos, dept, type, mode, amount, pinfl, from: f, to: "" });
  e("Каримов", "Азиз", "Рахимович", "Директор", "aup", "trud", "gross", 12000000, "31205880012345");
  e("Юсупова", "Малика", "Олеговна", "Бухгалтер", "aup", "trud", "gross", 6500000, "42308900023456");
  e("Рахмонов", "Бобур", "Шухратович", "Начальник цеха", "prod", "trud", "gross", 8000000, "");
  e("Исмоилов", "Тимур", "", "Оператор станка", "prod", "trud", "gross", 4200000, "");
  e("Петров", "Сергей", "Иванович", "Консультант", "aup", "gph", "net", 3000000, "");
  save(); ui.tab = "pay"; render();
}

/* ---------- события ---------- */
const ACT = {
  tab: t => setTab(t.dataset.tab),
  ym: t => { ui.ym = addYm(ui.ym, +t.dataset.d); render(); },
  filter: t => { ui.filter = t.dataset.v; render(); },
  openPay: t => openPay(t.dataset.id),
  newEmp: () => openEmp(null),
  openEmp: t => openEmp(t.dataset.id),
  toggleOld: () => { ui.showOld = !ui.showOld; render(); },
  seg: t => {
    const k = t.dataset.k;
    D[k] = t.dataset.v;
    if (k === "mode") D.touchedMode = true;
    if (k === "type" && !D.touchedMode) D.mode = t.dataset.v === "gph" ? "net" : "gross";
    t.parentNode.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === t));
    document.querySelectorAll('#sheet [data-k="mode"]').forEach(b => b.classList.toggle("on", b.dataset.v === D.mode));
    const l = $("#amt-l");
    if (l) l.textContent = (D.mode === "net" ? "Сумма на руки в месяц" : "Начисление в месяц") + " *";
    if (D.kind === "pay") { const f = document.querySelector("#sheet .f>span"); if (f) f.textContent = D.mode === "net" ? "Сумма на руки" : "Сумма начисления"; }
    updPreview();
  },
  swd: t => { // переключатель в черновике
    const k = t.dataset.k; D = D || {};
    D[k] = !D[k]; t.classList.toggle("on", D[k]);
  },
  swc: t => { S.company[t.dataset.k] = !S.company[t.dataset.k]; save(); render(); },
  swr: t => { freezePast(); S.rules[t.dataset.k] = !S.rules[t.dataset.k]; save(); render(); },
  start: () => {
    S.company.name = $("#w-name").value.trim(); S.company.inn = $("#w-inn").value.replace(/\D/g, "");
    S.company.split = !!(D && D.split); S.setup = true; D = null; save(); ui.tab = "pay"; render();
  },
  demo: () => demo(),
  savePay, saveEmp,
  skipPay: () => {
    const e = curDraftEmp(), m = S.months[ui.ym] || (S.months[ui.ym] = {}), b = entryFor(e, ui.ym);
    m.e = m.e || {};
    const skip = !b.skip;
    if (!skip && b.amount === e.amount && b.mode === e.mode && b.type === e.type && b.dept === e.dept) delete m.e[e.id];
    else m.e[e.id] = { amount: b.amount, mode: b.mode, type: b.type, dept: b.dept, skip: skip || undefined };
    save(); closeSheet(); render();
  },
  resetPay: () => { const m = S.months[ui.ym]; if (m && m.e) delete m.e[D.id]; save(); closeSheet(); render(); toast("Возвращена стандартная сумма"); },
  slip: () => { const e = curDraftEmp(); if (e) shareText("Расчётный листок", payslip(e)); },
  delEmp: () => {
    const e = S.emps.find(x => x.id === D.id);
    if (!confirmBox("Удалить «" + fullName(e) + "» вместе с историей начислений? Для увольнения лучше указать «Последний месяц».")) return;
    S.emps = S.emps.filter(x => x.id !== e.id);
    Object.values(S.months).forEach(m => { if (m.e) delete m.e[e.id]; });
    save(); closeSheet(); render(); toast("Удалено");
  },
  kind: t => { ui.kind = t.dataset.v; render(); },
  per: t => { ui.per = t.dataset.v; render(); },
  repNav: t => { ui.repYm = addYm(ui.repYm, +t.dataset.d * (ui.per === "month" ? 1 : ui.per === "quarter" ? 3 : 12)); render(); },
  xlsx: exportXlsx, repText,
  theme: t => { S.theme = t.dataset.v; save(); render(); },
  rates: openRates, saveRates,
  resetRates: () => { freezePast(); const b = S.rules.budget, it = S.rules.itpark; S.rules = Object.assign({}, C.DEFAULT_RULES, { budget: b, itpark: it }); save(); closeSheet(); render(); toast("Стандартные ставки"); },
  backup, restore: () => $("#restore-file").click(),
  wipe: () => {
    if (!confirmBox("Стереть всех сотрудников и все начисления? Это нельзя отменить.")) return;
    if (!confirmBox("Точно стереть? Сначала можно сохранить резервную копию.")) return;
    S = blank(); save(); D = { split: false }; ui.tab = "pay"; render();
  }
};
document.addEventListener("click", ev => {
  if (ev.target.id === "backdrop") { closeSheet(); return; }
  const t = ev.target.closest("[data-act]");
  if (t && ACT[t.dataset.act]) ACT[t.dataset.act](t, ev);
});
$("#nav").addEventListener("click", ev => { const b = ev.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.id === "f-amt") {
    const d = el.value.replace(/\D/g, ""); el.value = d ? fmt(+d) : ""; el.classList.remove("bad"); updPreview();
  } else if (el.id === "f-pinfl" || el.id === "w-inn" || el.id === "c-inn") el.value = el.value.replace(/\D/g, "");
  else if (el.id === "c-name") { S.company.name = el.value; save(); }
  if (el.id === "c-inn") { S.company.inn = el.value; save(); }
  if (el.classList.contains("bad")) el.classList.remove("bad");
});
document.addEventListener("change", ev => { if (ev.target.id === "restore-file" && ev.target.files[0]) { restoreFrom(ev.target.files[0]); ev.target.value = ""; } });
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && sheetOpen()) closeSheet(); });

D = { split: false };
render();
window.__dbg = { S: () => S, ui, ACT };
