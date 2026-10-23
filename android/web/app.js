"use strict";
/* Зарплата — расчёт НДФЛ, ИНПС, ЕСП. Все данные хранятся только на телефоне. */
const A = window.Android;
const C = window.Calc;
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_G = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

/* ---------- утилиты ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const pct = n => String(n).replace(".", ",") + "%";
const pad = n => String(n).padStart(2, "0");
/* Даты вводятся руками как дд.мм.гггг (цифровая клавиатура): системный календарь в WebView открывается не везде */
const todayIso = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
const isoToDmy = s => s ? s.split("-").reverse().join(".") : "";
const fmtDmy = s => { const d = String(s).replace(/\D/g, "").slice(0, 8); return d.length > 4 ? d.slice(0, 2) + "." + d.slice(2, 4) + "." + d.slice(4) : d.length > 2 ? d.slice(0, 2) + "." + d.slice(2) : d; };
function parseDmy(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || "").trim());
  if (!m) return "";
  const d = +m[1], mo = +m[2], y = +m[3], dt = new Date(y, mo - 1, d);
  if (y < 2000 || y > 2100 || dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "";
  return y + "-" + pad(mo) + "-" + pad(d);
}
const dateField = (id, iso, label) => '<label class="f"><span>' + label + '</span><input class="in dmy" id="' + id + '" inputmode="numeric" maxlength="10" placeholder="дд.мм.гггг" value="' + esc(isoToDmy(iso)) + '" autocomplete="off"></label>';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const curYm = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1); };
const addYm = (ym, d) => { const [y, m] = ym.split("-").map(Number); const t = y * 12 + (m - 1) + d; return Math.floor(t / 12) + "-" + pad((t % 12) + 1); };
const ymLabel = ym => { const [y, m] = ym.split("-").map(Number); return MONTHS[m - 1] + " " + y; };
const fullName = e => [e.last, e.first, e.mid].filter(Boolean).join(" ");
const shortName = e => e.last + " " + (e.first ? e.first[0] + "." : "") + (e.mid ? e.mid[0] + "." : "");
const initials = e => ((e.last || "?")[0] + (e.first || "")[0]).toUpperCase();
const parseAmt = v => Number(String(v || "").replace(/\D/g, "")) || 0;
const RULES_YEAR = 2026; // год, по правилам которого считает приложение (проект нового НК пока не действует)
const yearNote = ym => (Number(ym.slice(0, 4)) > RULES_YEAR
  ? '<div class="alert warn">Правила на ' + ym.slice(0, 4) + ' год ещё не утверждены — расчёт идёт по правилам ' + RULES_YEAR + ' года.</div>' : "") +
  (S.rules.itpark && ym >= "2028-01" ? '<div class="alert warn">Льготы резидентов IT Park по УП-5099 действуют до 01.01.2028 — проверьте режим на этот период.</div>' : "");
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
/* Компаний может быть несколько: у каждой свои сотрудники, начисления и правила (ключ zarplata.c.<id>);
   список компаний, активная и тема — в общем реестре (zarplata.reg). S — данные активной компании. */
const REG_KEY = "zarplata.reg", CO_KEY = id => "zarplata.c." + id;
function blank() {
  return { v: 1, rv: 2, setup: false, company: { name: "", inn: "", split: false }, rules: Object.assign({}, C.DEFAULT_RULES, { holExtra: [] }), emps: [], months: {}, events: [] };
}
function normalize(s) {
  if (!s || s.v !== 1 || !Array.isArray(s.emps)) return null;
  s.rules = Object.assign({}, C.DEFAULT_RULES, s.rules);
  if (s.rules.mrot === 1271000) s.rules.mrot = C.DEFAULT_RULES.mrot; // МРОТ вырос с 01.09.2026
  s.company = Object.assign({ name: "", inn: "", split: false }, s.company);
  s.months = s.months || {};
  s.events = s.events || [];                       // отпуска и больничные: { id, emp, type: 'vac'|'sick', from, to, payYm, amount, ... }
  s.rules.holExtra = s.rules.holExtra || [];
  if (s.rules.benId === "103847") s.rules.benId = ""; // 103847 — ID льготы IT Park, а не ст. 380
  if (!s.rv) { // v2: ИНПС и с ГПХ (ПП-4086 п. 5 — все доходы, облагаемые НДФЛ)
    s.rv = 2; s.rules.inpsGph = true;
    Object.values(s.months).forEach(m => { if (m.rules) m.rules.inpsGph = true; });
  }
  return s;
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function loadReg() {
  let reg = lsGet(REG_KEY);
  if (reg && Array.isArray(reg.list) && reg.list.length) {
    if (!reg.list.some(c => c.id === reg.active)) reg.active = reg.list[0].id;
    return reg;
  }
  // первый запуск или обновление со старой версии (одна компания в zarplata.v1)
  const old = lsGet("zarplata.v1"), first = normalize(old) || blank(), id = "c1";
  lsSet(CO_KEY(id), first);
  reg = { v: 1, active: id, list: [{ id, name: first.company.name }], theme: (old && old.theme) || "auto" };
  lsSet(REG_KEY, reg);
  return reg;
}
let REG = loadReg();
let S = normalize(lsGet(CO_KEY(REG.active))) || blank();
function save() {
  const c = REG.list.find(x => x.id === REG.active);
  if (c) c.name = S.company.name;
  if (!lsSet(CO_KEY(REG.active), S) || !lsSet(REG_KEY, REG)) toast("Не удалось сохранить данные");
}
const coLabel = c => c.name || "Без названия";
const coPrefix = () => (S.company.name || "").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

const rulesFor = ym => (S.months[ym] && S.months[ym].rules) || S.rules;
const empActive = (e, ym) => e.from <= ym && (!e.to || ym <= e.to);
/* Рабочие дни месяца по графику сотрудника: всего (W), отработано в рамках приёма/увольнения, не отработано из-за отпуска и больничного.
   frac < 1 — неполный месяц: оклад начисляется пропорционально рабочим дням (ТК РУз), если сумму за месяц не задали вручную. */
const empWd = e => (e.wd === 6 ? 6 : 5);
const monthEnd = ym => ym + "-" + pad(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate());
function dayInfo(e, ym) {
  const wd = empWd(e), ex = S.rules.holExtra || [], ms = ym + "-01", me = monthEnd(ym);
  const W = HR.workDays(ym, wd, ex);
  const hire = e.hire || (e.from + "-01");
  const from = hire > ms ? hire : ms, to = e.fire && e.fire < me ? e.fire : me;
  const worked = from > to ? 0 : HR.workDays(ym, wd, ex, from, to);
  let abs = 0;
  (S.events || []).forEach(ev => {
    if (ev.emp !== e.id) return;
    const a = ev.from > from ? ev.from : from, b = ev.to < to ? ev.to : to;
    if (a <= b) abs += HR.workDays(ym, wd, ex, a, b);
  });
  const frac = W ? Math.max(0, Math.min(1, (worked - abs) / W)) : 1;
  return { W, worked, abs, frac };
}
function entryFor(e, ym) {
  const m = S.months[ym] && S.months[ym].e && S.months[ym].e[e.id];
  const type = (m && m.type) || e.type;
  const explicit = !!(m && !m.fz && m.amount != null);      // сумму за месяц ввели вручную — пропорцию не применяем
  const base = m && m.amount != null ? m.amount : e.amount;
  let amount = base, di = null;
  if (!explicit && type !== "gph") { di = dayInfo(e, ym); if (di.frac < 1) amount = C.r0(base * di.frac); }
  return {
    amount, base,
    mode: (m && m.mode) || e.mode,
    type,
    dept: (m && m.dept) || e.dept,
    ben: m && m.ben != null ? m.ben : (e.ben || ""),
    skip: !!(m && m.skip),
    custom: !!m && !m.fz,
    day: di && di.frac < 1 ? di : null
  };
}
/* МРОТ на месяц: до 01.09.2026 действовал прежний (УП-91: 1 271 000), если пользователь не менял значение вручную */
const mrotFor = (ym, R) => (R.mrot === C.DEFAULT_RULES.mrot && ym < "2026-09") ? 1271000 : R.mrot;
/* Резидентство IT Park: льгота по месяцам. Дата включения в реестр — 1-е число: льгота с этого месяца; иначе со следующего месяца
   (льготы применяются с 1-го числа месяца, следующего за включением в реестр). «По» — включительно по месяц этой даты. Хранится вне снимков ставок. */
function itActive(ym) {
  const c = S.rules;
  if (!c.itpark) return false;
  if (c.itFrom) { const f = c.itFrom.slice(0, 7); if (ym < (c.itFrom.slice(8) === "01" ? f : addYm(f, 1))) return false; }
  if (c.itTo && ym > c.itTo.slice(0, 7)) return false;
  return true;
}
const rulesEff = ym => Object.assign({}, rulesFor(ym), { mrot: mrotFor(ym, rulesFor(ym)), itpark: itActive(ym) });
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
      if (empActive(e, ym) && !m.e[e.id]) m.e[e.id] = { amount: e.amount, mode: e.mode, type: e.type, dept: e.dept, ben: e.ben || "", fz: true };
    });
  }
}
/* Отпускные (оплата труда) и больничные за счёт работодателя, начисленные в месяце ym */
function evExtras(e, ym) {
  let extra = 0, sick = 0;
  (S.events || []).forEach(ev => { if (ev.emp === e.id && ev.payYm === ym) { if (ev.type === "vac") extra += ev.amount; else sick += ev.amount; } });
  return { extra, sick };
}
function calcEntry(e, ym) {
  const en = entryFor(e, ym), x = evExtras(e, ym);
  const r = C.calc({ amount: en.amount, mode: en.mode, type: en.type, benefit: Number(en.ben) || 0, extra: x.extra, sick: x.sick }, rulesEff(ym));
  return { en, r, x };
}
/* Средняя месячная зарплата за 12 календарных месяцев перед месяцем startIso (ТК ст. 257): оплата труда без отпускных и пособий,
   неполные месяцы — пропорционально отработанным дням. Нет истории — оклад по умолчанию. */
function avgMonthly(e, startIso) {
  const ym0 = startIso.slice(0, 7);
  let tot = 0, eq = 0;
  for (let i = 1; i <= 12; i++) {
    const ym = addYm(ym0, -i);
    if (!empActive(e, ym)) continue;
    const { en, r, x } = calcEntry(e, ym), di = dayInfo(e, ym);
    if (en.skip || !di.worked) continue;
    tot += r.gross - x.extra - x.sick;
    eq += di.W ? Math.max(0, di.worked - di.abs) / di.W : 1;
  }
  if (eq > 0 && tot > 0) return C.r0(tot / eq);
  return C.calc({ amount: e.amount, mode: e.mode, type: e.type }, rulesEff(ym0)).gross;
}
const ZERO = () => ({ gross: 0, sick: 0, sickPit: 0, sickInps: 0, exempt: 0, itExempt: 0, pit: 0, inps: 0, pitBudget: 0, esp: 0, net: 0, cost: 0 });
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
function breakdown(r, rules, type, x) {
  const inside = rules.inpsInsidePit;
  const rt = C.rates(rules, type), espR = rt.esp;
  x = x || { extra: 0, sick: 0 };
  let h = '<div class="calc">';
  if (x.extra || x.sick) {
    h += '<div class="l"><span>Оплата труда за месяц</span><span class="num">' + fmt(r.gross - x.extra - x.sick) + '</span></div>';
    if (x.extra) h += '<div class="l"><span>Отпускные</span><span class="num">' + fmt(x.extra) + '</span></div>';
    if (x.sick) h += '<div class="l"><span>Больничный (за счёт работодателя)</span><span class="num">' + fmt(x.sick) + '</span></div>';
  }
  h += '<div class="l"><span>Начислено</span><b class="num">' + fmt(r.gross) + '</b></div>';
  if (r.exempt > 0) h += '<div class="l"><span>Не облагается (ст. 380 НК)</span><span class="num">' + fmt(r.exempt) + '</span></div>';
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
  if (REG.theme === "auto") r.removeAttribute("data-theme"); else r.setAttribute("data-theme", REG.theme);
  try {
    if (A && A.setBars) {
      const dark = REG.theme === "dark" || (REG.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
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
  return S.emps.filter(e => empActive(e, ym)).map(e => { const c = calcEntry(e, ym); return { e, en: c.en, r: c.r, x: c.x }; })
    .sort((a, b) => (a.en.dept === b.en.dept ? 0 : a.en.dept === "aup" ? -1 : 1) || a.e.last.localeCompare(b.e.last, "ru"));
}
function payItem(x) {
  const { e, en, r } = x;
  const t = en.type === "gph" ? '<span class="badge warn">ГПХ</span>' : "";
  const part = en.day ? "неполный месяц: " + Math.max(0, en.day.worked - en.day.abs) + " из " + en.day.W + " раб. дн." : "";
  const sub = en.skip ? "не начисляется в этом месяце" : (part || (e.pos ? esc(e.pos) + " · " : "") + "начислено " + fmt(r.gross)) + (x.x.extra ? " · отпускные" : "") + (x.x.sick ? " · больничный" : "");
  return '<button class="item ' + (en.skip ? "off" : "") + '" data-act="openPay" data-id="' + e.id + '"><div class="av ' + (S.company.split ? en.dept : "") + '">' + esc(initials(e)) + '</div>' +
    '<div class="grow"><div class="nm">' + esc(shortName(e)) + t + (en.custom && !en.skip ? '<span class="badge">изменено</span>' : en.day && !en.skip ? '<span class="badge warn">неполный</span>' : "") + '</div><div class="sb">' + sub + '</div></div>' +
    '<div class="r"><b class="num">' + (en.skip ? "—" : fmt(r.net)) + '</b><span>на руки</span></div></button>';
}
function viewPay() {
  const ym = ui.ym, rows = monthRows(ym), live = rows.filter(x => !x.en.skip);
  let h = '<div class="top"><h1>Зарплата</h1><div class="sub">' + coChip() + '</div></div><div class="page">';
  h += '<div class="month"><button class="ib" data-act="ym" data-d="-1" aria-label="Предыдущий месяц">' + ICON.left + '</button><div class="m">' + ymLabel(ym) +
    (ym === curYm() ? "<small>текущий месяц</small>" : "") + '</div><button class="ib" data-act="ym" data-d="1" aria-label="Следующий месяц">' + ICON.right + '</button></div>';
  h += yearNote(ym) + (ym === curYm() && S.emps.length ? deadlineNote() : "");
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

/* Срок отчёта по НДФЛ и соцналогу — 15 число следующего месяца (ст. 389, 407 НК); за год — 15 февраля. Подсказка за 7 дней до срока. */
function deadlineNote() {
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(now.getFullYear(), now.getMonth() + (now.getDate() > 15 ? 1 : 0), 15);
  const days = Math.round((due - today) / 864e5);
  if (days > 7) return "";
  const rep = new Date(due.getFullYear(), due.getMonth() - 1, 1);
  const yearly = due.getMonth() === 1 ? " Годовой отчёт за " + (due.getFullYear() - 1) + " год — тоже до 15 февраля." : "";
  return '<div class="alert warn">' + (days === 0 ? "Сегодня последний день: " : "Осталось " + days + " дн.: ") + "отчёт по НДФЛ и соцналогу за " + MONTHS[rep.getMonth()].toLowerCase() + " " + rep.getFullYear() + " и уплата (до 15 числа)." + yearly + "</div>";
}
const remOn = () => ui.rem !== undefined ? ui.rem : (A && A.remindersOn ? A.remindersOn() : (() => { try { return localStorage.getItem("zarplata.rem") === "1"; } catch (e) { return false; } })());

function openPay(id) {
  const e = S.emps.find(x => x.id === id); if (!e) return;
  const en = entryFor(e, ui.ym);
  D = { kind: "pay", id, mode: en.mode, skip: en.skip, amt: en.amount };
  openSheet('<h2>' + esc(fullName(e)) + '</h2><p class="sub">' + ymLabel(ui.ym) + (en.type === "gph" ? " · договор ГПХ" : "") + '</p>' +
    seg("mode", D.mode, [["gross", "Начислено"], ["net", "На руки"]]) +
    '<div style="height:12px"></div><label class="f"><span>' + (D.mode === "net" ? "Сумма на руки" : "Сумма начисления") + '</span><input class="in amt" id="f-amt" inputmode="numeric" value="' + (en.amount ? fmt(en.amount) : "") + '" autocomplete="off"></label>' +
    '<div id="prev"></div>' +
    (en.day ? '<div class="hint">Неполный месяц: оклад пересчитан на ' + Math.max(0, en.day.worked - en.day.abs) + ' из ' + en.day.W + ' рабочих дней (по графику ' + empWd(e) + '-дневной недели, праздники не считаются). Введите сумму вручную, если нужно иначе.</div>' : "") +
    '<div class="btns"><button class="btn" data-act="savePay">Сохранить</button></div>' +
    '<div class="btns"><button class="btn sec2" data-act="slip">' + ICON.share + 'Расчётный листок</button></div>' +
    evBlock(e) +
    '<div class="btns">' + '<button class="btn ghost" data-act="skipPay">' + (en.skip ? "Начислять в этом месяце" : "Не начислять в этом месяце") + '</button>' +
    (en.custom ? '<button class="btn ghost" data-act="resetPay">Вернуть стандартную</button>' : "") + '</div>');
  updPreview();
}
function curDraftEmp() { return S.emps.find(x => x.id === (D && D.id)); }
function updPreview() {
  const el = $("#prev"); if (!el || !D) return;
  const amt = parseAmt($("#f-amt").value);
  let type, ben, rules, hint = "";
  let x = { extra: 0, sick: 0 };
  if (D.kind === "pay") { const e = curDraftEmp(), en = entryFor(e, ui.ym); type = en.type; ben = en.ben; rules = rulesEff(ui.ym); x = evExtras(e, ui.ym); }
  else { type = D.type; ben = $("#f-ben") ? $("#f-ben").value : ""; rules = rulesEff(curYm()); }
  const r = C.calc({ amount: amt, mode: D.mode, type, benefit: Number(ben) || 0, extra: x.extra, sick: x.sick }, rules);
  if (amt > 0 && type === "trud" && r.gross - x.extra - x.sick < rules.mrot && !(D.kind === "pay" && entryFor(curDraftEmp(), ui.ym).day)) hint = '<div class="hint warn">Начисление меньше МРОТ (' + fmt(rules.mrot) + ' сум). Для полной ставки это недопустимо; при неполной ставке — нормально.</div>';
  el.innerHTML = amt > 0 ? breakdown(r, rules, type, x) + hint : '<div class="hint">Введите сумму — ниже появится расчёт.</div>';
}
function savePay() {
  const e = curDraftEmp(), amt = parseAmt($("#f-amt").value);
  if (!e) return;
  if (!(amt > 0) && !D.skip) { $("#f-amt").classList.add("bad"); toast("Введите сумму"); return; }
  const m = S.months[ui.ym] || (S.months[ui.ym] = {});
  m.e = m.e || {};
  const base = entryFor(e, ui.ym);
  if (!base.custom && amt === base.amount && D.mode === base.mode && !D.skip) { closeSheet(); return; }   // ничего не меняли — пропорция остаётся
  m.e[e.id] = { amount: amt || base.amount, mode: D.mode, type: base.type, dept: base.dept, ben: base.ben, skip: D.skip || undefined };
  save(); closeSheet(); render(); toast("Сохранено");
}
function payslip(e) {
  const { en, r, x } = calcEntry(e, ui.ym), R = rulesEff(ui.ym);
  const L = ["Расчётный листок", S.company.name ? "Компания: " + S.company.name : "", "Сотрудник: " + fullName(e), "Период: " + ymLabel(ui.ym), ""];
  if (x.extra || x.sick) {
    L.push("Оплата труда: " + fmt(r.gross - x.extra - x.sick) + " сум");
    if (x.extra) L.push("Отпускные: " + fmt(x.extra) + " сум");
    if (x.sick) L.push("Больничный (за счёт работодателя): " + fmt(x.sick) + " сум");
  }
  L.push("Начислено: " + fmt(r.gross) + " сум", "НДФЛ " + pct(C.rates(R, en.type).pit) + ": " + fmt(r.pit) + " сум");
  if (r.inps) L.push("ИНПС " + pct(R.inps) + (R.inpsInsidePit ? " (входит в НДФЛ)" : "") + ": " + fmt(r.inps) + " сум");
  L.push("К выплате на руки: " + fmt(r.net) + " сум");
  return L.filter(x => x !== "" || true).join("\n");
}

/* ---------- отпуска и больничные ---------- */
const evTitle = ev => (ev.type === "vac" ? "Отпуск " : "Больничный ") + isoToDmy(ev.from) + " – " + isoToDmy(ev.to);
function evBlock(e) {
  const ms = ui.ym + "-01", me = monthEnd(ui.ym);
  const list = (S.events || []).filter(ev => ev.emp === e.id && ((ev.from <= me && ev.to >= ms) || ev.payYm === ui.ym));
  let h = '<div class="sec" style="margin-top:18px">Отпуск и больничный</div>';
  if (list.length) h += '<div class="card">' + list.map(ev => '<div class="item"><div class="grow"><div class="nm">' + esc(evTitle(ev)) + '</div><div class="sb">' +
    (ev.type === "vac" ? "отпускные " : "за счёт работодателя ") + fmt(ev.amount) + " · начислено в " + esc(ymLabel(ev.payYm)) + '</div></div>' +
    '<button class="ib" data-act="delEv" data-id="' + ev.id + '" aria-label="Удалить" style="color:var(--bad)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>').join("") + "</div>";
  if (entryFor(e, ui.ym).type === "gph") return h + '<div class="hint">Для договора ГПХ отпуск и больничный не начисляются.</div>';
  return h + '<div class="btns"><button class="btn sec2" data-act="vac">Отпускные…</button><button class="btn sec2" data-act="sick">Больничный…</button></div>';
}
function openVac() {
  const e = curDraftEmp(); if (!e) return;
  const start = ui.ym === curYm() ? todayIso() : ui.ym + "-01";
  D = { kind: "vac", id: e.id, avgTouched: false, avgYm: start.slice(0, 7) };
  openSheet('<h2>Отпускные</h2><p class="sub">' + esc(fullName(e)) + '</p>' +
    dateField("v-start", start, "Первый день отпуска") +
    '<label class="f"><span>Календарных дней отпуска</span><input class="in" id="v-days" inputmode="numeric" value="21" autocomplete="off"></label>' +
    '<label class="f"><span>Средняя месячная зарплата, сум</span><input class="in" id="v-avg" inputmode="numeric" value="' + fmt(avgMonthly(e, start)) + '" autocomplete="off"></label>' +
    '<div class="hint">Посчитана за 12 месяцев до месяца отпуска из начислений в приложении (ТК, ст. 257); можно изменить.</div>' +
    '<div id="hr-prev"></div><div class="stack"><button class="btn" data-act="saveVac">Добавить в начисления</button></div>');
  updHr();
}
function prevSickDays(e, from) { // календарных дней больничных в том же году до этого листка
  const y = from.slice(0, 4); let n = 0;
  (S.events || []).forEach(ev => {
    if (ev.emp !== e.id || ev.type !== "sick" || ev.to >= from) return;
    const a = ev.from > y + "-01-01" ? ev.from : y + "-01-01", b = ev.to < y + "-12-31" ? ev.to : y + "-12-31";
    if (a <= b) n += Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
  });
  return n;
}
function openSick() {
  const e = curDraftEmp(); if (!e) return;
  const d = ui.ym === curYm() ? todayIso() : ui.ym + "-01";
  D = { kind: "sick", id: e.id, long: "0", bonus: false, avgTouched: false, avgYm: d.slice(0, 7) };
  openSheet('<h2>Больничный</h2><p class="sub">' + esc(fullName(e)) + '</p>' +
    '<div class="two">' + dateField("s-from", d, "Начало листка") + dateField("s-to", d, "Конец листка") + '</div>' +
    '<div class="f"><span>Страховой стаж</span>' + seg("long", D.long, [["0", "6 мес – 8 лет (60%)"], ["1", "Более 8 лет (80%)"]]) + '</div>' +
    sw("swd", "bonus", false, "+20 п.п. к коэффициенту", "Инвалид I–II группы, 4+ детей до 18 лет или ребёнок-инвалид в семье") +
    '<label class="f"><span>Средняя месячная зарплата, сум</span><input class="in" id="s-avg" inputmode="numeric" value="' + fmt(avgMonthly(e, d)) + '" autocomplete="off"></label>' +
    '<div id="hr-prev"></div><div class="stack"><button class="btn" data-act="saveSick">Добавить в начисления</button></div>');
  updHr();
}
function updHr() {
  const el = $("#hr-prev"); if (!el || !D || (D.kind !== "vac" && D.kind !== "sick")) return;
  const e = curDraftEmp(), ex = S.rules.holExtra || [], line = (a, b, t) => '<div class="l' + (t ? " t" : "") + '"><span>' + a + '</span><span class="num">' + b + '</span></div>';
  D.res = null;
  if (D.kind === "vac") {
    const start = parseDmy($("#v-start").value), days = parseAmt($("#v-days").value);
    if (start && !D.avgTouched && D.avgYm !== start.slice(0, 7)) { D.avgYm = start.slice(0, 7); $("#v-avg").value = fmt(avgMonthly(e, start)); }
    const avg = parseAmt($("#v-avg").value);
    if (!start || !(days > 0) || !(avg > 0)) { el.innerHTML = '<div class="hint">Укажите дату начала, дни и среднюю зарплату.</div>'; return; }
    const v = HR.vacation({ start, days, avg, extra: ex });
    D.res = { start, v, avg };
    el.innerHTML = '<div class="calc">' + line("Отпуск", isoToDmy(start) + " – " + isoToDmy(v.end)) + line("Воскресенья (не оплачиваются)", v.sun) + line("Праздничные дни (не оплачиваются)", v.hol) +
      line("Оплачиваемых дней", v.paid) + line("Средний дневной заработок (÷ 25,3)", fmt(v.daily)) + line("Отпускные", fmt(v.pay), 1) + '</div>' +
      '<div class="hint">Начислятся в ' + esc(ymLabel(start.slice(0, 7)).toLowerCase()) + ' (НДФЛ, ИНПС и соцналог — как с зарплаты); оклад за дни отпуска в месяце уменьшится сам.</div>';
    return;
  }
  const from = parseDmy($("#s-from").value), to = parseDmy($("#s-to").value);
  if (from && !D.avgTouched && D.avgYm !== from.slice(0, 7)) { D.avgYm = from.slice(0, 7); $("#s-avg").value = fmt(avgMonthly(e, from)); }
  const avg = parseAmt($("#s-avg").value);
  if (!from || !to || to < from || !(avg > 0)) { el.innerHTML = '<div class="hint">Укажите даты листка (дд.мм.гггг) и среднюю зарплату.</div>'; return; }
  if (from < "2026-07-01") { el.innerHTML = '<div class="alert warn">Новый порядок больничных действует с 01.07.2026. За более ранние даты расчёт здесь не ведётся.</div>'; return; }
  const rules = rulesEff(from.slice(0, 7));
  const s = HR.sick({ from, to, avg, mrot: rules.mrot, long: D.long === "1", bonus: !!D.bonus, prevDays: prevSickDays(e, from), extra: ex });
  D.res = { from, to, s, avg };
  el.innerHTML = '<div class="calc">' + line("Листок", s.days + " дн.") + line("Коэффициент стажа", Math.round(s.base * 100) + "%") +
    line("Средняя зарплата в расчёте" + (s.capped ? " (предел 10 МРОТ)" : ""), fmt(s.avgUsed)) +
    line("Пособие за весь период", fmt(s.total)) + line("За счёт работодателя (" + s.empDays + " дн.)", fmt(s.employer), 1) + line("За счёт Фонда соцстрахования (" + s.fundDays + " дн.)", fmt(s.fund)) + '</div>' +
    '<div class="hint">Воскресенья и праздники не оплачиваются (' + s.skipped + ' дн.). Первые 5 календарных дней в году платит работодатель, дальше — Фонд напрямую сотруднику. Свыше 77 дней в году коэффициент меньше на 10 п.п., оплата — не более 182 дней в году.</div>' +
    '<div class="hint">Часть работодателя начислится в ' + esc(ymLabel(to.slice(0, 7)).toLowerCase()) + ': НДФЛ и ИНПС — да, соцналог — нет. В приложение 4 она не попадает (это не оплата труда) — отразите отдельно.</div>';
}
function saveEvent() {
  if (!D || !D.res) { toast("Заполните поля"); return; }
  const id = D.id, ev = D.kind === "vac"
    ? { id: uid(), emp: id, type: "vac", from: D.res.start, to: D.res.v.end, payYm: D.res.start.slice(0, 7), amount: D.res.v.pay, avg: D.res.avg }
    : { id: uid(), emp: id, type: "sick", from: D.res.from, to: D.res.to, payYm: D.res.to.slice(0, 7), amount: D.res.s.employer, total: D.res.s.total, avg: D.res.avg };
  S.events.push(ev); save(); render();
  ui.ym = ev.type === "vac" ? ui.ym : ui.ym; openPay(id); toast("Добавлено в начисления");
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
  let h = '<div class="top"><h1>Сотрудники</h1><div class="sub">' + coChip() + ' · ' + act.length + ' работает' + (old.length ? ", " + old.length + " уволено" : "") + '</div></div><div class="page">';
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
  D = e ? { kind: "emp", id, type: e.type, mode: e.mode, dept: e.dept, res: e.res || "1", ck: e.ck || "1", wd: String(e.wd || 5), touchedMode: true }
        : { kind: "emp", id: null, type: "trud", mode: "gross", dept: "aup", res: "1", ck: "1", wd: String(S.company.wd || 5), touchedMode: false };
  const v = e || { last: "", first: "", mid: "", pinfl: "", pos: "", amount: 0, from: ui.ym, to: "" };
  openSheet('<h2>' + (e ? "Сотрудник" : "Новый сотрудник") + '</h2><p class="sub">' + (e ? "Изменения суммы действуют с текущего месяца, прошлые месяцы не пересчитываются." : "Заполните основное — остальное можно добавить позже.") + '</p>' +
    '<label class="f"><span>Фамилия *</span><input class="in" id="f-last" value="' + esc(v.last) + '" autocomplete="off"></label>' +
    '<div class="two"><label class="f"><span>Имя *</span><input class="in" id="f-first" value="' + esc(v.first) + '" autocomplete="off"></label>' +
    '<label class="f"><span>Отчество</span><input class="in" id="f-mid" value="' + esc(v.mid) + '" autocomplete="off"></label></div>' +
    '<label class="f"><span>ПИНФЛ (14 цифр)</span><input class="in" id="f-pinfl" inputmode="numeric" maxlength="14" value="' + esc(v.pinfl) + '" placeholder="нужен для отчёта по НДФЛ"></label>' +
    '<label class="f"><span>Должность</span><input class="in" id="f-pos" value="' + esc(v.pos) + '" autocomplete="off"></label>' +
    (S.company.split ? '<div class="f"><span>Отдел</span>' + seg("dept", D.dept, [["aup", "АУП"], ["prod", "Производство"]]) + '</div>' : "") +
    '<div class="f"><span>Договор</span>' + seg("type", D.type, [["trud", "Трудовой"], ["gph", "ГПХ"]]) + '</div>' +
    '<div class="f"><span>График работы</span>' + seg("wd", D.wd, [["5", "5-дневка"], ["6", "6-дневка"]]) + '</div>' +
    '<div class="hint">Нужен для неполного месяца, отпуска и больничного: считаются только рабочие дни по графику (5 — пн–пт, 6 — пн–сб).</div>' +
    '<label class="f"><span>Льгота по доходу (ст. 380 НК)</span><select class="in" id="f-ben">' +
      [["", "Нет"], ["1.41", "1,41 МРОТ — ветераны, инвалиды войны, одинокие матери и др."], ["3", "3 МРОТ — инвалиды с детства, I–II группы"]]
        .map(o => '<option value="' + o[0] + '"' + ((v.ben || "") === o[0] ? " selected" : "") + '>' + o[1] + '</option>').join("") + '</select></label>' +
    '<div class="hint">Только трудовой договор по основному месту работы; нужны документы, подтверждающие льготу.</div>' +
    '<div class="f"><span>Как вводите сумму</span>' + seg("mode", D.mode, [["gross", "Начислено"], ["net", "На руки (обратный расчёт)"]]) + '</div>' +
    '<label class="f"><span id="amt-l">' + (D.mode === "net" ? "Сумма на руки в месяц" : "Начисление в месяц") + ' *</span><input class="in amt" id="f-amt" inputmode="numeric" value="' + (v.amount ? fmt(v.amount) : "") + '" autocomplete="off"></label>' +
    '<div id="prev"></div>' +
    '<div class="two">' + dateField("f-hire", v.hire || (e ? v.from + "-01" : (ui.ym === curYm() ? todayIso() : ui.ym + "-01")), "Дата принятия *") +
    dateField("f-to", v.fire || (v.to ? v.to + "-" + pad(new Date(+v.to.slice(0, 4), +v.to.slice(5), 0).getDate()) : ""), "Дата увольнения") + '</div>' +
    (e ? '<div class="hint">Дату увольнения заполняйте, когда сотрудник уходит — начисления будут по месяц увольнения включительно.</div>' : "") +
    '<details class="more"><summary>Для отчёта в налоговую</summary><div class="f"><span>Статус</span>' + seg("res", D.res, [["1", "Резидент"], ["2", "Нерезидент"]]) + '</div>' +
    '<div class="f"><span>Форма контракта (для трудовых)</span>' + seg("ck", D.ck, [["1", "Основной"], ["2", "Совместитель"], ["5", "Надомник"]]) + '</div>' +
    '<label class="f"><span>Рабочее время, ставок (1; 0,5; 0,25…)</span><input class="in" id="f-rate" inputmode="decimal" value="' + String(v.rate || 1).replace(".", ",") + '"></label>' +
    '<label class="f"><span>Рабочее место</span><select class="in" id="f-seat">' +
      [["1", "Постоянное"], ["2", "За счёт вакансий на 01.01.2025"], ["3", "Вновь созданное в текущем году"], ["4", "Сезонное"], ["5", "Надомник"]]
        .map(o => '<option value="' + o[0] + '"' + (String(v.seat || 1) === o[0] ? " selected" : "") + '>' + o[1] + '</option>').join("") + '</select></label>' +
    dateField("f-wp", v.wp || "", "Дата создания рабочего места") +
    '<div class="hint" style="margin-top:-6px">Если создано до 2025 года, в файле будет 01.01.2025 (так требует шаблон). Пусто — первое число месяца приёма.</div>' +
    '<label class="f"><span>Номер льготы (ID) из кабинета — если есть льгота ст. 380</span><input class="in" id="f-benid" value="' + esc(v.benId || "") + '" placeholder="по умолчанию ' + esc(S.rules.benId || "—") + '" autocomplete="off"></label></details>' +
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
  const hire = parseDmy($("#f-hire").value), fire = parseDmy($("#f-to").value), wp = parseDmy($("#f-wp").value);
  const badDate = [["f-hire", !hire], ["f-to", $("#f-to").value.trim() && !fire], ["f-wp", $("#f-wp").value.trim() && !wp]];
  badDate.forEach(([id, b]) => $("#" + id).classList.toggle("bad", !!b));
  if (badDate.some(x => x[1])) { toast(!hire ? "Укажите дату принятия: дд.мм.гггг" : "Дата в формате дд.мм.гггг"); return; }
  const from = hire.slice(0, 7), to = fire ? fire.slice(0, 7) : "";
  if (fire && fire < hire) { toast("Дата увольнения раньше даты принятия"); return; }
  const rate = Number(g("f-rate").replace(",", ".")) || 1;
  const data = { last, first, mid: g("f-mid"), pinfl, pos: g("f-pos"), dept: S.company.split ? D.dept : "aup", type: D.type, mode: D.mode, amount: amt, from, hire, to, fire, res: D.res, rate, wd: Number(D.wd) === 6 ? 6 : 5,
    ben: D.type === "gph" ? "" : $("#f-ben").value, benId: g("f-benid"), ck: D.ck, seat: Number($("#f-seat").value) || 1, wp };
  if (D.id) {
    const e = S.emps.find(x => x.id === D.id);
    if (e.amount !== amt || e.mode !== D.mode || e.type !== D.type || e.dept !== data.dept || (e.ben || "") !== data.ben) freezePast();
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
    addTo(x, r); x.n++; x.type = en.type; x.dept = en.dept; x.ben = en.ben;
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
    else h += "<tr class='" + (r.t === "row" ? "" : r.t) + "'>" + r.cells.map((v, i) => cell(v, i === 0)).join("") + "</tr>";
  });
  return h + "</tbody></table></div>";
}
function viewRep() {
  const months = repMonths(), agg = aggregate(months), rep = buildReport(ui.kind, agg, true);
  let h = '<div class="top"><h1>Отчёты</h1><div class="sub">' + coChip() + '</div></div><div class="page">';
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
  h += '<div class="btns"><button class="btn" data-act="xlsx">' + ICON.file + 'Excel</button><button class="btn sec2" data-act="repText">' + ICON.share + 'Текстом</button></div>' +
    '<div class="btns"><button class="btn sec2" data-act="soliq">' + ICON.file + 'Файл для my.soliq.uz (приложение 4)</button></div>' +
    '<div class="hint" style="margin:8px 2px 0">Графы 11 и 13 — нарастающим итогом с января (или с даты принятия) по выбранный месяц. Если в прошлых месяцах начисляли по-другому, поправьте суммы в этих месяцах на вкладке «Зарплата».</div>';
  h += '<div class="note"><b>Справочно.</b> Приложение готовит цифры для сверки; отчётность подаётся и корректируется в личном кабинете my.soliq.uz (по НК: ежемесячно, до 15 числа следующего месяца; итог за год — до 15 февраля). Ставки проверьте в «Настройки → Правила».</div>';
  return h + "</div>";
}
function repTitle() { return (S.company.name ? S.company.name + " — " : "") + repLabel(); }
function exportXlsx() {
  const agg = aggregate(repMonths());
  if (!agg.rows.length) { toast("Нет данных за период"); return; }
  const t = agg.tot, d = new Date();
  const cfg = {
    reg: { name: "Ведомость", title: "Расчётная ведомость", widths: [36, 17, 15, 13, 17, 15] },
    tax: { name: "НДФЛ", title: "НДФЛ, ИНПС и соцналог по сотрудникам", widths: [36, 19, 13, 17, 15, 13, 17, 15], center: [1, 2] },
    sum: { name: "Свод", title: "Свод по отделам и договорам", widths: [34, 9, 17, 15, 13, 15, 17, 17], center: [1],
      footerTitle: "К перечислению и выплате за период",
      footer: [["НДФЛ в бюджет", t.pitBudget], ["ИНПС (на накопительные счета)", t.inps], ["Соцналог (ЕСП)", t.esp], ["Выплатить сотрудникам (на руки)", t.net]] }
  };
  const b64 = window.buildReportXlsx({
    company: S.company.name || "Организация", inn: "ИНН: " + (S.company.inn || "—"), period: repLabel(),
    note: "Сформировано в приложении «Зарплата» " + pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + ". Данные справочные — сверяйте с личным кабинетом my.soliq.uz."
  }, ["reg", "tax", "sum"].map(k => Object.assign({}, cfg[k], buildReport(k, agg, false))));
  const fname = (coPrefix() || "Зарплата") + "_" + repLabel().replace(/\s+/g, "_") + ".xlsx";
  sendFile(fname, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b64);
}
/* Приложение 4 к расчёту НДФЛ и соцналога (шаблон 11101_20 из my.soliq.uz): данные с 15-й строки, нарастающим итогом с начала года */
function exportSoliq() {
  const last = repMonths().slice(-1)[0], yr = last.slice(0, 4);
  const cum = aggregate(Array.from({ length: +last.slice(5) }, (_, i) => yr + "-" + pad(i + 1)));
  if (!cum.rows.length) { toast("Нет данных за период"); return; }
  const mon = new Map(aggregate([last]).rows.map(x => [x.e.id, x]));
  // дата создания рабочего места: введённая вручную, иначе дата принятия; всё, что раньше 2025 года, — 01.01.2025 (требование шаблона)
  const created = e => { const d = e.wp || e.hire || e.from + "-01"; return d >= "2025-01-01" ? d.split("-").reverse().join(".") : "01.01.2025"; };
  // льготы: каждая занимает тройку граф (номер льготы, совокупный необлагаемый доход, в т.ч. за период), начиная с графы 15 (P)
  const rows = cum.rows.filter(x => x.gross - x.sick > 0).map((x, i) => {
    const e = x.e, m = mon.get(e.id) || ZERO(), gph = x.type === "gph";
    const row = [i + 1, fullName(e), e.pos || null, e.pinfl || null, created(e), Number(e.res || 1), e.to && e.to <= last ? 2 : 1,
      gph ? 3 : Number(e.ck || 1), gph ? null : (e.rate || 1), gph ? null : Number(e.seat || 1), x.gross - x.sick, m.gross - m.sick, x.pit - x.sickPit, m.pit - m.sickPit];   // пособие по ВН — не оплата труда, в приложение 4 не входит
    const slots = [];
    if (!gph && x.itExempt > 0) slots.push([S.rules.benIdIt || null, x.itExempt, m.itExempt]);
    if (!gph && x.exempt > 0) slots.push([e.benId || S.rules.benId || null, x.exempt, m.exempt]);
    slots.forEach(s => row.push(s[0], s[1], s[2]));
    return row;
  });
  const noPin = cum.rows.filter(x => !x.e.pinfl).length;
  const noBenId = cum.rows.filter(x => x.type !== "gph" && x.exempt > 0 && !x.e.benId && !S.rules.benId).length;
  if (noBenId) setTimeout(() => toast("Льгота ст. 380: впишите номер льготы из кабинета (карточка сотрудника)"), 4200);
  sendFile((coPrefix() ? coPrefix() + "_" : "") + "Прил4_11101_20_" + ymLabel(last).replace(/\s+/g, "_") + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    window.fillTemplate(rows));
  if (noPin) setTimeout(() => toast("У " + noPin + " сотр. нет ПИНФЛ — допишите в файле или в приложении"), 1800);
}
function repText() {
  const agg = aggregate(repMonths()), t = agg.tot, R = rulesEff(ui.repYm);
  const L = [repTitle(), "Сотрудников: " + agg.rows.length, "", "Начислено: " + fmt(t.gross), "НДФЛ" + (S.rules.itpark ? "" : " " + pct(R.pit)) + ": " + fmt(t.pit)];
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
    '<div class="f"><span>График работы в компании</span>' + seg("cwd", String(S.company.wd || 5), [["5", "5-дневка"], ["6", "6-дневка"]], "cwd") + '</div>' +
    '<div class="hint" style="margin-top:-6px">Для новых сотрудников; у каждого сотрудника график можно поменять в его карточке.</div>' +
    sw("swr", "budget", R.budget, "Бюджетная организация", "ЕСП по повышенной ставке " + pct(R.espBudget)) +
    sw("swr", "itpark", R.itpark, "Резидент IT Park", "Трудовые договоры: НДФЛ " + pct(R.pitIt) + ", ЕСП " + pct(R.espIt) + ". ГПХ — по обычным ставкам. Действует до 01.01.2028 (УП-5099, п. 5 и 8)") +
    (R.itpark ? '<div class="two">' + dateField("c-itfrom", R.itFrom, "Включён в реестр IT Park") + dateField("c-itto", R.itTo, "Статус до (если утрачен)") + '</div>' +
      '<div class="hint">Льгота считается по месяцам: если дата — 1-е число, то с этого месяца, иначе со следующего (льготы действуют с 1-го числа месяца, следующего за включением в реестр). Пусто — льгота для всех месяцев.</div>' : "");
  h += '<div class="sec">Правила ' + RULES_YEAR + ' года</div><button class="item card" data-act="rates" style="border:0"><div class="grow"><div class="nm">НДФЛ ' + pct(R.itpark ? R.pitIt : R.pit) + ' · ИНПС ' + pct(R.inps) + ' · ЕСП ' + pct(R.itpark ? R.espIt : R.budget ? R.espBudget : R.esp) + (R.itpark ? ' · IT Park' : '') + '</div>' +
    '<div class="sb">ИНПС ' + (R.inpsInsidePit ? "засчитывается в НДФЛ" : "удерживается сверху") + ' · нажмите, чтобы изменить</div></div>' + ICON.right.replace("<svg", '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"') + '</button>';
  h += '<div class="sec">Напоминания</div>' + sw("rem", "rem", remOn(), "О сроках отчёта", "12 и 15 числа в 09:00: НДФЛ и соцналог — до 15 числа, годовой отчёт — до 15 февраля");
  h += '<div class="sec">Оформление</div>' + seg("theme", REG.theme, [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], "theme");
  h += '<div class="sec">Данные</div><div class="stack" style="margin-top:0"><button class="btn sec2" data-act="backup">Сохранить резервную копию</button><button class="btn sec2" data-act="restore">Восстановить из копии</button>' +
    '<button class="btn sec2" data-act="companies">Компании (' + REG.list.length + '): сменить или добавить</button>' +
    '<button class="btn bad" data-act="delCo">Удалить эту компанию</button>' +
    '<button class="btn bad" data-act="wipe">' + (REG.list.length > 1 ? "Стереть все компании и данные" : "Стереть все данные") + '</button></div><input type="file" id="restore-file" accept=".json,application/json" hidden>';
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
    f("r-mrot", "МРОТ, сум (для подсказки и льготы ст. 380)", R.mrot) +
    '<label class="f"><span>Доп. праздничные дни (дд.мм.гггг через запятую)</span><input class="in" id="r-hol" value="' + esc((R.holExtra || []).map(isoToDmy).join(", ")) + '" placeholder="например, дни Хайита по постановлению" autocomplete="off"></label>' +
    '<div class="hint">Уже учтены 1 января, 8 марта, 21 марта, 9 мая, 1 сентября, 1 октября, 8 декабря. Дни Хайита и переносы добавьте здесь — они не считаются рабочими.</div>' +
    '<label class="f"><span>ID льготы НДФЛ: IT Park (для файла в кабинет)</span><input class="in" id="r-benidit" value="' + esc(R.benIdIt || "") + '"></label>' +
    '<label class="f"><span>ID льготы НДФЛ: ст. 380 по умолчанию (если не указан у сотрудника)</span><input class="in" id="r-benid" value="' + esc(R.benId || "") + '"></label>' +
    sw("swd", "inside", D.inside, "ИНПС входит в НДФЛ", "На руки = начислено − НДФЛ. Выключите, если ИНПС удерживается сверху НДФЛ") +
    sw("swd", "gph", D.gph, "Удерживать ИНПС с ГПХ", "По ПП-4086 (п. 5) — 0,1% от всех доходов, облагаемых НДФЛ, в том числе по ГПХ") +
    '<div class="stack"><button class="btn" data-act="saveRates">Сохранить</button><button class="btn ghost" data-act="resetRates">Вернуть стандартные</button></div>');
}
function saveRates() {
  const n = id => Number(String($("#" + id).value).replace(",", ".").replace(/\s/g, ""));
  const v = { pit: n("r-pit"), inps: n("r-inps"), esp: n("r-esp"), espBudget: n("r-espb"), pitIt: n("r-pitit"), espIt: n("r-espit"), mrot: n("r-mrot") };
  if (Object.values(v).some(x => !isFinite(x) || x < 0) || v.pit >= 100 || v.pitIt >= 100) { toast("Проверьте числа"); return; }
  const hol = $("#r-hol").value.split(/[,;\s]+/).filter(Boolean).map(parseDmy);
  if (hol.some(x => !x)) { toast("Праздничные дни: дд.мм.гггг через запятую"); return; }
  freezePast();
  Object.assign(S.rules, v, { inpsInsidePit: D.inside, inpsGph: D.gph, benId: $("#r-benid").value.trim(), benIdIt: $("#r-benidit").value.trim(), holExtra: [...new Set(hol)].sort() });
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
/* Резервная копия: все компании в одном файле (v2). Файл старой версии (одна компания, v1) восстанавливается как новая компания. */
function backup() {
  save();
  const d = new Date(), companies = {};
  REG.list.forEach(c => { companies[c.id] = c.id === REG.active ? S : lsGet(CO_KEY(c.id)); });
  sendFile("zarplata-backup-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + ".json", "application/json",
    toB64(JSON.stringify({ v: 2, reg: REG, companies })), false);
}
function restoreFrom(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const s = JSON.parse(rd.result);
      if (s && s.v === 2 && s.reg && s.companies) {
        const list = (s.reg.list || []).filter(c => normalize(s.companies[c.id]));
        if (!list.length) throw 0;
        if (!confirmBox("Заменить все данные копией (компаний: " + list.length + ")?")) return;
        const theme = REG.theme;
        REG.list.forEach(c => { try { localStorage.removeItem(CO_KEY(c.id)); } catch (e) { } });
        list.forEach(c => lsSet(CO_KEY(c.id), normalize(s.companies[c.id])));
        REG = { v: 1, active: list.some(c => c.id === s.reg.active) ? s.reg.active : list[0].id, list: list.map(c => ({ id: c.id, name: c.name || "" })), theme };
        S = normalize(lsGet(CO_KEY(REG.active)));
        save(); closeSheet(); render(); toast("Данные восстановлены");
        return;
      }
      const one = normalize(s);
      if (!one) throw 0;
      if (!confirmBox("Добавить компанию «" + (one.company.name || "без названия") + "» (" + one.emps.length + " сотр.) из копии?")) return;
      save(); one.setup = true;
      const id = uid(); REG.list.push({ id, name: one.company.name }); REG.active = id; S = one; save();
      closeSheet(); render(); toast("Компания добавлена");
    } catch (e) { toast("Это не файл резервной копии"); }
  };
  rd.readAsText(file);
}

/* ---------- компании ---------- */
const chevron = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const coChip = () => '<button class="co" data-act="companies">' + esc(coLabel({ name: S.company.name })) + (REG.list.length > 1 ? ' <span class="n">' + REG.list.length + '</span>' : "") + chevron + '</button>';
function openCompanies() {
  D = { kind: "co" };
  openSheet('<h2>Компании</h2><p class="sub">У каждой компании свои сотрудники, начисления и правила.</p>' +
    '<div class="card">' + REG.list.map(c => '<button class="item" data-act="switchCo" data-id="' + c.id + '"><div class="av ' + (c.id === REG.active ? "" : "off") + '" style="' + (c.id === REG.active ? "" : "background:var(--line);color:var(--mute)") + '">' +
      esc((coLabel(c)[0] || "?").toUpperCase()) + '</div><div class="grow"><div class="nm">' + esc(coLabel(c)) + '</div><div class="sb">' + (c.id === REG.active ? "открыта сейчас" : "нажмите, чтобы открыть") + '</div></div>' +
      (c.id === REG.active ? '<span class="badge ok">✓</span>' : "") + '</button>').join("") + '</div>' +
    '<div class="stack"><button class="btn" data-act="newCo">' + ICON.plus + 'Добавить компанию</button></div>');
}
function switchCompany(id) {
  if (id === REG.active) { closeSheet(); return; }
  save(); REG.active = id;
  S = normalize(lsGet(CO_KEY(id))) || blank();
  save(); ui.filter = "all"; ui.showOld = false; D = null;
  closeSheet(); render(); window.scrollTo(0, 0); toast("Открыта: " + coLabel({ name: S.company.name }));
}
function openNewCo() {
  D = { kind: "newco", split: false };
  openSheet('<h2>Новая компания</h2><p class="sub">Сотрудников можно добавить после создания.</p>' +
    '<label class="f"><span>Название *</span><input class="in" id="n-name" placeholder="Например, ООО «Ромашка»" autocomplete="off"></label>' +
    '<label class="f"><span>ИНН (по желанию)</span><input class="in" id="n-inn" inputmode="numeric" maxlength="9" placeholder="9 цифр"></label>' +
    sw("swd", "split", false, "Есть производство", "Разделять сотрудников на АУП и производство") +
    '<div class="stack"><button class="btn" data-act="createCo">Создать</button></div>');
}
function createCompany() {
  const name = $("#n-name").value.trim();
  if (!name) { $("#n-name").classList.add("bad"); toast("Введите название"); return; }
  save();
  const s = blank(); s.setup = true; s.company = { name, inn: $("#n-inn").value.replace(/\D/g, ""), split: !!D.split };
  const id = uid(); REG.list.push({ id, name }); REG.active = id; S = s; save();
  ui.tab = "pay"; ui.filter = "all"; closeSheet(); render(); window.scrollTo(0, 0); toast("Компания создана");
}
function deleteCompany() {
  const name = coLabel({ name: S.company.name });
  if (!confirmBox("Удалить компанию «" + name + "» со всеми сотрудниками и начислениями? Это нельзя отменить.")) return;
  if (!confirmBox("Точно удалить «" + name + "»? Сначала можно сохранить резервную копию.")) return;
  try { localStorage.removeItem(CO_KEY(REG.active)); } catch (e) { }
  REG.list = REG.list.filter(c => c.id !== REG.active);
  if (!REG.list.length) { const id = uid(); REG.list.push({ id, name: "" }); REG.active = id; S = blank(); D = { split: false }; }
  else { REG.active = REG.list[0].id; S = normalize(lsGet(CO_KEY(REG.active))) || blank(); }
  save(); ui.tab = "pay"; ui.filter = "all"; render(); window.scrollTo(0, 0); toast("Компания удалена");
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
    updPreview(); updHr();
  },
  swd: t => { // переключатель в черновике
    const k = t.dataset.k; D = D || {};
    D[k] = !D[k]; t.classList.toggle("on", D[k]); updHr();
  },
  swc: t => { S.company[t.dataset.k] = !S.company[t.dataset.k]; save(); render(); },
  swr: t => { if (t.dataset.k !== "itpark") freezePast(); S.rules[t.dataset.k] = !S.rules[t.dataset.k]; save(); render(); },
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
    if (!skip && !b.custom && b.base === e.amount && b.mode === e.mode && b.type === e.type && b.dept === e.dept && (b.ben || "") === (e.ben || "")) delete m.e[e.id];
    else m.e[e.id] = { amount: b.base, mode: b.mode, type: b.type, dept: b.dept, ben: b.ben, skip: skip || undefined, fz: b.custom ? undefined : true };
    save(); closeSheet(); render();
  },
  vac: openVac, sick: openSick, saveVac: saveEvent, saveSick: saveEvent,
  delEv: t => {
    if (!confirmBox("Удалить эту запись об отпуске/больничном из начислений?")) return;
    const id = D && D.id;
    S.events = S.events.filter(ev => ev.id !== t.dataset.id); save(); render(); if (id) openPay(id);
  },
  resetPay: () => { const m = S.months[ui.ym]; if (m && m.e) delete m.e[D.id]; save(); closeSheet(); render(); toast("Возвращена стандартная сумма"); },
  slip: () => { const e = curDraftEmp(); if (e) shareText("Расчётный листок", payslip(e)); },
  delEmp: () => {
    const e = S.emps.find(x => x.id === D.id);
    if (!confirmBox("Удалить «" + fullName(e) + "» вместе с историей начислений? Для увольнения лучше указать «Последний месяц».")) return;
    S.emps = S.emps.filter(x => x.id !== e.id);
    S.events = (S.events || []).filter(ev => ev.emp !== e.id);
    Object.values(S.months).forEach(m => { if (m.e) delete m.e[e.id]; });
    save(); closeSheet(); render(); toast("Удалено");
  },
  kind: t => { ui.kind = t.dataset.v; render(); },
  per: t => { ui.per = t.dataset.v; render(); },
  repNav: t => { ui.repYm = addYm(ui.repYm, +t.dataset.d * (ui.per === "month" ? 1 : ui.per === "quarter" ? 3 : 12)); render(); },
  xlsx: exportXlsx, repText, soliq: exportSoliq,
  theme: t => { REG.theme = t.dataset.v; save(); render(); },
  rates: openRates, saveRates,
  resetRates: () => { freezePast(); const b = S.rules.budget, it = S.rules.itpark, f = S.rules.itFrom, t = S.rules.itTo; S.rules = Object.assign({}, C.DEFAULT_RULES, { budget: b, itpark: it, itFrom: f, itTo: t }); save(); closeSheet(); render(); toast("Стандартные ставки"); },
  backup, restore: () => $("#restore-file").click(),
  cwd: t => {
    S.company.wd = Number(t.dataset.v) === 6 ? 6 : 5;
    if (S.emps.length && confirmBox("Применить график " + S.company.wd + "-дневной недели ко всем сотрудникам?")) S.emps.forEach(e => { e.wd = S.company.wd; });
    save(); render();
  },
  rem: () => {
    const on = !remOn(); ui.rem = on;
    if (A && A.setReminders) A.setReminders(on); else { try { localStorage.setItem("zarplata.rem", on ? "1" : "0"); } catch (e) { } }
    render(); toast(on ? "Напоминания включены" : "Напоминания выключены");
  },
  companies: openCompanies, switchCo: t => switchCompany(t.dataset.id), newCo: openNewCo, createCo: createCompany, delCo: deleteCompany,
  wipe: () => {
    if (!confirmBox("Стереть ВСЕ компании, сотрудников и начисления? Это нельзя отменить.")) return;
    if (!confirmBox("Точно стереть всё? Сначала можно сохранить резервную копию.")) return;
    REG.list.forEach(c => { try { localStorage.removeItem(CO_KEY(c.id)); } catch (e) { } });
    const id = uid(), theme = REG.theme;
    REG = { v: 1, active: id, list: [{ id, name: "" }], theme };
    S = blank(); save(); D = { split: false }; ui.tab = "pay"; ui.filter = "all"; render();
  }
};
document.addEventListener("click", ev => {
  if (ev.target.id === "backdrop") { closeSheet(); return; }
  const t = ev.target.closest("[data-act]");
  if (t && ACT[t.dataset.act]) ACT[t.dataset.act](t, ev);
});
$("#nav").addEventListener("click", ev => { const b = ev.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });
function applyItDate(el) {
  const key = el.id === "c-itfrom" ? "itFrom" : "itTo", raw = el.value.trim(), iso = parseDmy(raw);
  if (raw && !iso) return;                 // дата ещё вводится или неверная
  S.rules[key] = iso;
  if (S.rules.itFrom && S.rules.itTo && S.rules.itTo < S.rules.itFrom) { S.rules.itTo = ""; el.value = ""; toast("«До» раньше даты включения — очищено"); }
  save();
}
document.addEventListener("input", ev => {
  const el = ev.target;
  if (el.classList.contains("dmy")) { el.value = fmtDmy(el.value); if (el.id === "c-itfrom" || el.id === "c-itto") applyItDate(el); }
  if (el.id === "v-days" || el.id === "v-avg" || el.id === "s-avg") { const d = el.value.replace(/\D/g, ""); el.value = d ? fmt(+d) : ""; if (el.id !== "v-days") D.avgTouched = true; }
  if (["v-start", "v-days", "v-avg", "s-from", "s-to", "s-avg"].includes(el.id)) updHr();
  if (el.id === "f-amt") {
    const d = el.value.replace(/\D/g, ""); el.value = d ? fmt(+d) : ""; el.classList.remove("bad"); updPreview();
  } else if (el.id === "f-ben") updPreview();
  else if (el.id === "f-pinfl" || el.id === "w-inn" || el.id === "c-inn" || el.id === "n-inn") el.value = el.value.replace(/\D/g, "");
  else if (el.id === "c-name") { S.company.name = el.value; save(); }
  if (el.id === "c-inn") { S.company.inn = el.value; save(); }
  if (el.classList.contains("bad")) el.classList.remove("bad");
});
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.id === "restore-file" && el.files[0]) { restoreFrom(el.files[0]); el.value = ""; }
  else if (el.id === "c-itfrom" || el.id === "c-itto") { applyItDate(el); if (el.value.trim() && !parseDmy(el.value)) toast("Дата в формате дд.мм.гггг"); }
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && sheetOpen()) closeSheet(); });

D = { split: false };
render();
window.__dbg = { S: () => S, ui, ACT };
