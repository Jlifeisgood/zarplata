/* Доступы и облако. Директор и бухгалтер работают со всеми данными компании: они целиком лежат в companies/<cid>/blob/* и синхронизируются между устройствами.
   Сотрудник данных компании не получает: приложение директора считает ему готовый листок и публикует в payslips/<cid>_<id сотрудника>, правила Firestore отдают его только этому сотруднику.
   Загружается до app.js: функции и данные приложения (S, REG, save, render…) берутся в момент вызова. */
const Team = (() => {
  const W = Cloud.W;
  const CHUNK = 300000;   // знаков в одном документе: предел Firestore — 1 МБ, кириллица занимает 2 байта
  const ME = "zarplata.me", EMP = "zarplata.emp", PUB = cid => "zarplata.pub." + cid;
  const rd = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const wr = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

  let me = rd(ME);        // { mode: "staff" | "employee", list, cid, emp, name, company }
  let emp = rd(EMP) || {}; // кабинет сотрудника: { slip, reqs, at }
  const view = { tab: "slips", open: null, tabYm: null };
  const setMe = m => { me = m; wr(ME, m); };

  const employeeMode = () => Cloud.configured() && !!Cloud.session() && !!me && me.mode === "employee";
  const entry = () => REG.list.find(x => x.id === REG.active);
  const linked = () => { const c = entry(); return c && c.cloud ? c : null; };
  const isOwner = c => c && c.cloud && c.cloud.role === "owner";
  const isStaffRole = r => r === "owner" || r === "admin";

  const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const randStr = (len, abc) => { let s = ""; for (let i = 0; i < len; i++) s += abc[rnd(abc.length)]; return s; };
  const newId = () => randStr(20, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  const makePass = () => randStr(8, "abcdefghjkmnpqrstuvwxyz23456789");
  const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h" };
  const makeLogin = name => (String(name || "").toLowerCase().split("").map(ch => TR[ch] !== undefined ? TR[ch] : ch).join("").replace(/[^a-z0-9]/g, "").slice(0, 12) || "user") + (10 + rnd(990));
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36) + "." + s.length; };
  const nowIso = () => new Date().toISOString();

  /* Перерисовать, если человек ничего не вводит и шторка не открыта */
  function softRender() {
    const a = document.activeElement;
    if (sheetOpen() || (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.nodeName))) return;
    render();
  }
  function report(e, quiet) {
    if (e && e.code === "SESSION_EXPIRED") { setMe(null); toast(Cloud.errText(e)); render(); return; }
    if (quiet && e && e.code === "NETWORK") return;
    toast(Cloud.errText(e));
  }
  /* Обработчик кнопки с запросом к серверу: без повторных нажатий, ошибка — сообщением */
  let busy = false;
  const act = fn => async (t, ev) => {
    if (busy) return;
    busy = true;
    if (t && t.classList) t.classList.add("busy");
    try { await fn(t, ev); } catch (e) { report(e); }
    finally { busy = false; if (t && t.classList) t.classList.remove("busy"); }
  };

  /* ---------- синхронизация данных компании ---------- */
  const lastRaw = {};
  let timer = null, flushing = false, again = false;
  let syncError = "", syncedAt = 0;

  function onSave() {
    if (typeof REG === "undefined" || employeeMode()) return;
    const c = entry();
    if (!c || !c.cloud) return;
    let raw = null;
    try { raw = localStorage.getItem(CO_KEY(c.id)); } catch (e) { }
    if (raw === lastRaw[c.id]) return;
    lastRaw[c.id] = raw;
    c.cloud.dirty = true;
    lsSet(REG_KEY, REG);
    schedule();
  }
  function schedule(ms) {
    if (!Cloud.session()) return;
    clearTimeout(timer);
    timer = setTimeout(flush, ms === undefined ? 1500 : ms);
  }
  async function flush() {
    if (flushing) { again = true; return; }
    flushing = true;
    try {
      for (const c of REG.list.filter(x => x.cloud && x.cloud.dirty)) await push(c);
      const a = linked();
      if (a) await publish(a);
      syncError = ""; syncedAt = Date.now();
    } catch (e) {
      syncError = Cloud.errText(e);
      report(e, true);
    } finally {
      flushing = false;
      if (again) { again = false; schedule(300); }
    }
  }
  function split(raw) {
    const parts = [];
    for (let i = 0; i < raw.length; i += CHUNK) parts.push(raw.slice(i, i + CHUNK));
    return parts.length ? parts : [""];
  }
  async function push(c) {
    const raw = localStorage.getItem(CO_KEY(c.id));
    if (!raw) return;
    const cid = c.cloud.cid, rev = (c.cloud.rev || 0) + 1, parts = split(raw);
    const pre = c.cloud.ut ? { updateTime: c.cloud.ut } : { exists: true };
    const writes = [W.set("companies/" + cid, { owner: c.cloud.owner, name: c.name || "", rev, parts: parts.length, updated: nowIso(), by: Cloud.session().uid }, pre)];
    parts.forEach((data, i) => writes.push(W.set("companies/" + cid + "/blob/" + i, { rev, data })));
    for (let i = parts.length; i < (c.cloud.parts || 0); i++) writes.push(W.del("companies/" + cid + "/blob/" + i));
    let r;
    try {
      r = await Cloud.commit(writes);
    } catch (e) {
      if (e.code === "FAILED_PRECONDITION" || e.code === "ABORTED" || e.code === "NOT_FOUND") { await conflict(c); return; }
      throw e;
    }
    c.cloud.rev = rev; c.cloud.parts = parts.length; c.cloud.ut = r.writeResults[0].updateTime;
    let cur = null;
    try { cur = localStorage.getItem(CO_KEY(c.id)); } catch (e) { }
    c.cloud.dirty = cur !== raw;       // пока шла отправка, могли внести новые правки
    lsSet(REG_KEY, REG);
  }
  async function conflict(c) {
    const head = await Cloud.get("companies/" + c.cloud.cid);
    if (!head) { gone(c); return; }
    if (confirmBox("Другое устройство уже изменило данные компании «" + coLabel(c) + "». Нажмите OK, чтобы загрузить их версию (ваши последние изменения пропадут), или Отмена — чтобы записать вашу версию поверх.")) {
      c.cloud.dirty = false;
      await pullData(c, head);
    } else {
      Object.assign(c.cloud, { ut: head.updateTime, rev: head.data.rev, parts: head.data.parts, owner: head.data.owner, dirty: true });
      await push(c);
    }
  }
  async function pull(c) {
    const head = await Cloud.get("companies/" + c.cloud.cid);
    if (!head) { gone(c); return; }
    c.cloud.owner = head.data.owner;
    if ((head.data.rev || 0) <= (c.cloud.rev || 0)) { lsSet(REG_KEY, REG); return; }
    if (c.cloud.dirty) { await conflict(c); return; }
    await pullData(c, head);
  }
  async function pullData(c, head) {
    const cid = c.cloud.cid;
    for (let attempt = 0; attempt < 3; attempt++) {
      const parts = (await Cloud.list("companies/" + cid + "/blob")).filter(p => p.data.rev === head.data.rev).sort((a, b) => +a.id - +b.id);
      if (parts.length !== head.data.parts) {   // пока читали, другое устройство записало новую версию
        head = await Cloud.get("companies/" + cid);
        if (!head) { gone(c); return; }
        continue;
      }
      const raw = parts.map(p => p.data.data).join("");
      let s = null;
      try { s = normalize(JSON.parse(raw)); } catch (e) { }
      if (!s) throw new Cloud.CloudError("BAD_DATA");
      localStorage.setItem(CO_KEY(c.id), raw);
      lastRaw[c.id] = raw;
      c.name = s.company.name;
      Object.assign(c.cloud, { rev: head.data.rev, ut: head.updateTime, parts: head.data.parts, owner: head.data.owner, dirty: false });
      lsSet(REG_KEY, REG);
      if (c.id === REG.active) { S = s; softRender(); toast("Данные обновлены с сервера"); }
      return;
    }
    throw new Cloud.CloudError("BAD_DATA");
  }
  /* Компании больше нет в облаке или доступ отозван: у бухгалтера локальная копия удаляется, у директора остаётся как обычная компания на телефоне */
  function gone(c) {
    if (c.cloud.role === "owner") {
      delete c.cloud;
      lsSet(REG_KEY, REG);
      toast("Компания «" + coLabel(c) + "» больше не в облаке, данные остались на телефоне");
    } else removeLocal(c);
  }
  function removeLocal(c) {
    try { localStorage.removeItem(CO_KEY(c.id)); } catch (e) { }
    REG.list = REG.list.filter(x => x.id !== c.id);
    if (!REG.list.length) { const id = uid(); REG.list.push({ id, name: "" }); REG.active = id; S = blank(); D = { split: false }; }
    else if (REG.active === c.id) { REG.active = REG.list[0].id; S = normalize(lsGet(CO_KEY(REG.active))) || blank(); }
    lsSet(CO_KEY(REG.active), S);
    lsSet(REG_KEY, REG);
  }
  function attach(m) {
    if (REG.list.length === 1 && !S.setup && !REG.list[0].cloud) {   // пустая компания первого запуска не нужна
      try { localStorage.removeItem(CO_KEY(REG.list[0].id)); } catch (e) { }
      REG.list = [];
    }
    const c = { id: uid(), name: m.companyName || "", cloud: { cid: m.company, role: m.role, owner: "", rev: 0, ut: null, parts: 0, dirty: false } };
    REG.list.push(c);
    if (!REG.list.some(x => x.id === REG.active) || !S.setup) { REG.active = c.id; S = blank(); }
    lsSet(REG_KEY, REG);
    return c;
  }

  /* ---------- участники и заявления ---------- */
  const memCache = {}, reqCache = {};
  async function membersOf(cid, force) {
    if (!memCache[cid] || force) memCache[cid] = (await Cloud.query("members", "company", cid)).map(d => Object.assign({ docId: d.id }, d.data));
    return memCache[cid];
  }
  async function loadReqs(cid) {
    const was = (reqCache[cid] || []).filter(r => r.data.status === "new").length;
    reqCache[cid] = await Cloud.query("requests", "company", cid);
    if (reqCache[cid].filter(r => r.data.status === "new").length !== was) softRender();
  }
  const newReqs = () => { const c = linked(); return c ? (reqCache[c.cloud.cid] || []).filter(r => r.data.status === "new").length : 0; };

  /* ---------- листок сотрудника ---------- */
  const GRID = { work: "w", off: "o", abs: "a", unp: "u", trip: "t", vac: "v", sick: "s", out: "x" };
  function slipMonth(e, ym) {
    const { en, r, x } = calcEntry(e, ym);
    if (en.skip) return null;
    const p = payInfo(e, ym), R = rulesEff(ym);
    const o = {
      ym, type: en.type, gross: r.gross, pit: r.pit, inps: r.inps, inside: !!R.inpsInsidePit, net: r.net, exempt: r.exempt,
      labor: C.r2(r.gross - x.extra - x.sick - x.aid - x.prem), prem: x.prem, vac: x.extra, sick: x.sick, aid: x.aid,
      ded: p.ded, due: p.due, paid: p.paid, left: p.left,
      deds: (S.deds || []).filter(d => d.emp === e.id && d.ym === ym).map(d => ({ kind: d.kind, amount: d.amount, note: d.note || "" })),
      pays: (S.pays || []).filter(q => q.emp === e.id && q.ym === ym).map(q => ({ kind: q.kind, amount: q.amount, date: q.date || "" }))
    };
    if (en.type !== "gph") {
      const di = dayInfo(e, ym), last = +monthEnd(ym).slice(8), on = hrsOn(e), hours = on ? [] : null;
      let grid = "";
      for (let d = 1; d <= last; d++) {
        const ds = ym + "-" + pad(d), st = tabState(e, ds);
        grid += GRID[st] || "w";
        if (on) { const rec = hoursRec(e, ds); hours.push(st === "work" ? (rec ? rec.h : planOf(e, ds)) : 0); }
      }
      o.tab = { W: di.W, paid: Math.max(0, di.worked - di.abs), hrs: on, grid, hours };
      if (on) {
        const h = hoursPremium(e, ym);
        if (h.hi) o.over = { ot: h.hi.ot1 + h.hi.ot2, wk: h.hi.wk, night: h.hi.night, otPay: h.ot, wkPay: h.wk, nightPay: h.night };
      }
    }
    return o;
  }
  const dayCount = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
  /* Остаток отпуска, примерно: дни в году × отработанное время минус отгулянные календарные дни, плюс поправка из карточки */
  function leaveInfo(e) {
    const hire = e.hire || e.from + "-01", today = todayIso(), end = e.fire && e.fire < today ? e.fire : today;
    if (hire > end) return null;
    const per = e.leave || 21, wm = HR.workMonths(hire, end), r1 = x => Math.round(x * 10) / 10;
    const earned = per * wm.years + per / 12 * wm.months;
    const used = (S.events || []).filter(ev => ev.emp === e.id && ev.type === "vac").reduce((s, ev) => s + dayCount(ev.from, ev.to), 0);
    return { per, earned: r1(earned), used, adj: e.leaveAdj || 0, left: r1(earned - used + (e.leaveAdj || 0)) };
  }
  function buildSlip(e) {
    const cur = curYm(), months = [];
    let ym = e.to && e.to < cur ? e.to : cur;
    const start = e.from > addYm(cur, -23) ? e.from : addYm(cur, -23);
    for (; ym >= start; ym = addYm(ym, -1)) {
      if (!empActive(e, ym)) continue;
      const m = slipMonth(e, ym);
      if (m) months.push(m);
    }
    const events = (S.events || []).filter(ev => ev.emp === e.id).map(ev => ({ type: ev.type, from: ev.from, to: ev.to, amount: ev.amount, payYm: ev.payYm })).sort((a, b) => (a.from < b.from ? 1 : -1));
    return { v: 1, company: S.company.name || "", name: fullName(e), pos: e.pos || "", hire: e.hire || e.from + "-01", fire: e.fire || "", months, events, leave: e.type === "gph" ? null : leaveInfo(e) };
  }
  async function publish(c, force) {
    const cid = c.cloud.cid, emps = (await membersOf(cid)).filter(m => m.role === "employee");
    const pub = rd(PUB(cid)) || {}, todo = [];
    emps.forEach(m => {
      const e = S.emps.find(x => x.id === m.emp);
      if (!e) return;
      const json = JSON.stringify(buildSlip(e)), h = hash(json + m.uid);
      if (!force && pub[m.emp] === h) return;
      todo.push({ w: W.set("payslips/" + cid + "_" + m.emp, { company: cid, emp: m.emp, uid: m.uid, name: fullName(e), data: json, updated: nowIso() }), emp: m.emp, h });
    });
    for (let i = 0; i < todo.length; i += 10) {
      const part = todo.slice(i, i + 10);
      await Cloud.commit(part.map(x => x.w));
      part.forEach(x => { pub[x.emp] = x.h; });
      wr(PUB(cid), pub);
    }
  }

  /* ---------- общая синхронизация ---------- */
  let lastSync = 0;
  async function syncStaff() {
    const s = Cloud.session();
    if (!s) return;
    const staff = (await Cloud.query("members", "uid", s.uid)).map(d => d.data).filter(m => isStaffRole(m.role));
    REG.list.filter(c => c.cloud && !staff.some(m => m.company === c.cloud.cid)).forEach(gone);
    for (const m of staff) {
      let c = REG.list.find(x => x.cloud && x.cloud.cid === m.company);
      if (!c) c = attach(m);
      c.cloud.role = m.role;
      await pull(c);
    }
    const a = linked();
    if (a) { await membersOf(a.cloud.cid, true); await loadReqs(a.cloud.cid); }
    await flush();
    softRender();
  }
  async function syncEmployee() {
    const s = Cloud.session();
    if (!s) return;
    const list = (await Cloud.query("members", "uid", s.uid)).map(d => d.data).filter(m => m.role === "employee");
    if (!list.length) {
      Cloud.signOut(); setMe(null); emp = {}; wr(EMP, null);
      toast("Доступ отозван директором");
      render();
      return;
    }
    const m = list.find(x => x.company === me.cid) || list[0];
    setMe({ mode: "employee", list, cid: m.company, emp: m.emp, name: m.name, company: m.companyName });
    let slip = null;
    try {
      const d = await Cloud.get("payslips/" + m.company + "_" + m.emp);
      if (d) slip = JSON.parse(d.data.data);
    } catch (e) {
      if (e.code !== "PERMISSION_DENIED") throw e;   // листка ещё нет: на несуществующий документ правила отвечают «нет прав»
    }
    const reqs = (await Cloud.query("requests", "uid", s.uid)).filter(r => r.data.company === m.company)
      .sort((a, b) => (a.data.created < b.data.created ? 1 : -1)).map(r => Object.assign({ id: r.id }, r.data));
    emp = { slip, reqs, at: Date.now() };
    wr(EMP, emp);
    softRender();
  }
  async function syncNow() {
    lastSync = Date.now();
    try { if (employeeMode()) await syncEmployee(); else await syncStaff(); }
    catch (e) { syncError = Cloud.errText(e); report(e, true); }
  }
  function resume(force) {
    if (!Cloud.session() || (!force && Date.now() - lastSync < 20000)) return;
    syncNow();
  }
  function start() {
    if (!Cloud.configured()) return;
    REG.list.forEach(c => { if (c.cloud) { try { lastRaw[c.id] = localStorage.getItem(CO_KEY(c.id)); } catch (e) { } } });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resume(); });
    window.addEventListener("online", () => resume(true));
    if (Cloud.session()) syncNow();
  }
  async function onSwitch() {
    const a = linked();
    if (!a || !Cloud.session()) return;
    try { await pull(a); await membersOf(a.cloud.cid, true); await loadReqs(a.cloud.cid); await flush(); softRender(); }
    catch (e) { report(e, true); }
  }

  /* ---------- вход ---------- */
  function openLogin() {
    D = { kind: "login" };
    openSheet('<h2>Вход</h2><p class="sub">Директор — по e-mail, сотрудник и бухгалтер — по логину, который выдал директор.</p>' +
      '<label class="f"><span>Логин или e-mail</span><input class="in" id="l-login" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
      '<label class="f"><span>Пароль</span><input class="in" id="l-pass" type="password" autocomplete="current-password"></label>' +
      '<div class="stack"><button class="btn" data-act="teamDoLogin">Войти</button><button class="btn ghost" data-act="teamReset">Забыли пароль?</button><button class="btn ghost" data-act="teamSignup">Я директор, аккаунта ещё нет</button></div>');
  }
  function openSignup() {
    D = { kind: "signup" };
    openSheet('<h2>Аккаунт директора</h2><p class="sub">Нужен, чтобы выдавать доступ сотрудникам и работать с разных устройств. На e-mail придёт письмо, если забудете пароль.</p>' +
      '<label class="f"><span>E-mail</span><input class="in" id="l-login" type="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false"></label>' +
      '<label class="f"><span>Пароль (не меньше 6 символов)</span><input class="in" id="l-pass" type="password" autocomplete="new-password"></label>' +
      '<label class="f"><span>Пароль ещё раз</span><input class="in" id="l-pass2" type="password" autocomplete="new-password"></label>' +
      '<div class="stack"><button class="btn" data-act="teamDoSignup">Создать аккаунт</button></div>');
  }
  async function afterLogin() {
    const s = Cloud.session(), list = (await Cloud.query("members", "uid", s.uid)).map(d => d.data);
    const staff = list.filter(m => isStaffRole(m.role)), emps = list.filter(m => m.role === "employee");
    if (!staff.length && emps.length) {
      setMe({ mode: "employee", list: emps, cid: emps[0].company, emp: emps[0].emp, name: emps[0].name, company: emps[0].companyName });
      view.tab = "slips"; view.open = null; view.tabYm = null;
      closeSheet(); render(); window.scrollTo(0, 0);
      await syncEmployee();
      return;
    }
    if (!staff.length && Cloud.isLogin(s.email)) {  // логин без записи о доступе: директор отозвал доступ
      Cloud.signOut();
      throw new Cloud.CloudError("NO_ACCESS");
    }
    setMe({ mode: "staff" });
    closeSheet();
    await syncStaff();
    render();
  }
  async function doLogin() {
    const login = $("#l-login").value.trim(), pass = $("#l-pass").value;
    if (!login || !pass) { toast("Введите логин и пароль"); return; }
    await Cloud.signIn(login, pass);
    await afterLogin();
    toast("Вы вошли");
  }
  async function doSignup() {
    const email = $("#l-login").value.trim(), pass = $("#l-pass").value;
    if (!email.includes("@")) { toast("Проверьте e-mail"); return; }
    if (pass.length < 6) { toast("Слишком короткий пароль: нужно не меньше 6 символов"); return; }
    if (pass !== $("#l-pass2").value) { toast("Пароли не совпадают"); return; }
    await Cloud.signUp(email, pass);
    setMe({ mode: "staff" });
    closeSheet(); render();
    toast("Аккаунт создан");
  }
  async function doReset() {
    const login = $("#l-login").value.trim();
    if (!login.includes("@")) { toast("Сотруднику новый доступ выдаёт директор. Директор: введите e-mail."); return; }
    await Cloud.resetEmail(login);
    toast("Письмо для смены пароля отправлено на " + login);
  }
  async function signOutAll() {
    if (!confirmBox("Выйти из аккаунта?")) return;
    if (!employeeMode()) { try { await flush(); } catch (e) { } }
    REG.list.filter(c => c.cloud && c.cloud.role !== "owner").forEach(removeLocal);
    Cloud.signOut(); setMe(null); emp = {}; wr(EMP, null);
    closeSheet(); render(); window.scrollTo(0, 0);
  }
  function openPassword() {
    D = { kind: "pass" };
    openSheet('<h2>Новый пароль</h2><label class="f"><span>Пароль (не меньше 6 символов)</span><input class="in" id="l-pass" type="password" autocomplete="new-password"></label>' +
      '<label class="f"><span>Ещё раз</span><input class="in" id="l-pass2" type="password" autocomplete="new-password"></label>' +
      '<div class="stack"><button class="btn" data-act="teamSavePass">Сохранить</button></div>');
  }
  async function savePassword() {
    const p = $("#l-pass").value;
    if (p.length < 6) { toast("Слишком короткий пароль: нужно не меньше 6 символов"); return; }
    if (p !== $("#l-pass2").value) { toast("Пароли не совпадают"); return; }
    await Cloud.changePassword(p);
    closeSheet(); toast("Пароль изменён");
  }

  /* ---------- настройки директора ---------- */
  function settingsBlock() {
    if (!Cloud.configured()) return "";
    let h = '<div class="sec">Доступ сотрудников и облако</div>';
    const s = Cloud.session();
    if (!s) {
      return h + '<div class="hint" style="margin-top:0">Директор видит всё, а сотрудник входит по своему логину и видит только свои листки, выплаты, табель и заявления.</div>' +
        '<div class="btns"><button class="btn sec2" data-act="teamLogin">Войти</button><button class="btn sec2" data-act="teamSignup">Создать аккаунт</button></div>';
    }
    const c = entry(), who = Cloud.shownLogin(s.email);
    h += '<div class="hint" style="margin-top:0">Вы вошли: <b>' + esc(who) + '</b></div>';
    if (c && c.cloud) {
      h += '<div class="note" style="margin-top:0">' + (c.cloud.role === "owner" ? "Вы директор этой компании. " : "Вы бухгалтер этой компании. ") +
        (syncError ? "Не отправлено: " + esc(syncError) : c.cloud.dirty ? "Есть изменения, ещё не отправленные на сервер." : "Все изменения на сервере.") + '</div>' +
        '<div class="stack"><button class="btn sec2" data-act="teamAccess">Доступы сотрудников</button>' +
        '<button class="btn sec2" data-act="teamReqs">Заявления' + (newReqs() ? " (новых: " + newReqs() + ")" : "") + '</button>' +
        (isOwner(c) ? '<button class="btn ghost" data-act="teamUnlink">Отключить компанию от облака</button>' : "") + '</div>';
    } else if (S.setup) {
      h += '<div class="stack"><button class="btn sec2" data-act="teamLink">Подключить «' + esc(coLabel({ name: S.company.name })) + '» к облаку</button></div>';
    }
    return h + '<div class="btns"><button class="btn ghost" data-act="teamPass">Сменить пароль</button><button class="btn ghost" data-act="teamOut">Выйти</button></div>';
  }
  const welcomeBtn = () => Cloud.configured() ? '<button class="btn ghost" data-act="teamLogin">У меня есть логин: войти</button>' : "";
  const payBanner = () => { const n = newReqs(); return n ? '<button class="alert warn" style="width:100%;border:0;text-align:left;font:inherit" data-act="teamReqs">Заявления сотрудников, новых: ' + n + '</button>' : ""; };

  async function linkCompany() {
    const c = entry(), s = Cloud.session();
    if (!confirmBox("Данные компании будут храниться на серверах Google за пределами Узбекистана. По ст. 27¹ закона о персональных данных это допускается при выполнении её условий, отвечает за это компания. Подключить?")) return;
    const cid = newId(), name = S.company.name || "";
    await Cloud.commit([W.set("companies/" + cid, { owner: s.uid, name, rev: 0, parts: 0, updated: nowIso(), by: s.uid }, { exists: false })]);
    await Cloud.commit([W.set("members/" + s.uid + "_" + cid, { uid: s.uid, company: cid, role: "owner", emp: "", name: s.email, login: Cloud.shownLogin(s.email), companyName: name })]);
    c.cloud = { cid, role: "owner", owner: s.uid, rev: 0, ut: null, parts: 0, dirty: true };
    lsSet(CO_KEY(c.id), S);
    lastRaw[c.id] = localStorage.getItem(CO_KEY(c.id));
    lsSet(REG_KEY, REG);
    await push(c);
    memCache[cid] = null;
    render();
    toast("Компания в облаке. Теперь можно выдавать доступы.");
  }
  async function unlinkCompany() {
    const c = linked();
    if (!c || !isOwner(c)) return;
    if (!confirmBox("Отключить компанию от облака? Данные на сервере удалятся, доступы сотрудников перестанут работать. На этом телефоне всё останется.")) return;
    const cid = c.cloud.cid, inBatches = async list => { for (let i = 0; i < list.length; i += 10) await Cloud.commit(list.slice(i, i + 10)); };
    const members = await Cloud.query("members", "company", cid);
    await inBatches((await Cloud.query("requests", "company", cid)).map(d => W.del("requests/" + d.id)));
    await inBatches((await Cloud.query("payslips", "company", cid)).map(d => W.del("payslips/" + d.id)));
    await inBatches((await Cloud.list("companies/" + cid + "/blob")).map(d => W.del("companies/" + cid + "/blob/" + d.id)));
    await inBatches(members.filter(d => d.data.role !== "owner").map(d => W.del("members/" + d.id)));
    await Cloud.commit([W.del("companies/" + cid)]);
    await Cloud.commit(members.filter(d => d.data.role === "owner").map(d => W.del("members/" + d.id)));
    delete c.cloud;
    wr(PUB(cid), null);
    lsSet(REG_KEY, REG);
    render();
    toast("Компания отключена от облака");
  }

  /* ---------- доступы ---------- */
  async function openAccess() {
    const c = linked();
    if (!c) return;
    const list = await membersOf(c.cloud.cid, true);
    D = { kind: "access" };
    const emps = S.emps.filter(e => !e.to || e.to >= curYm()).slice().sort((a, b) => a.last.localeCompare(b.last, "ru"));
    const admins = list.filter(m => m.role === "admin");
    let h = '<h2>Доступы</h2><p class="sub">Сотрудник видит только свои листки, выплаты, табель и заявления. Бухгалтер работает со всеми данными компании.</p>';
    h += '<div class="sec" style="margin-top:0">Сотрудники</div>';
    h += emps.length ? '<div class="card">' + emps.map(e => {
      const m = list.find(x => x.role === "employee" && x.emp === e.id);
      return '<button class="item" data-act="teamEmpAcc" data-id="' + e.id + '"><div class="av ' + (m ? "" : "off") + '" style="' + (m ? "" : "background:var(--line);color:var(--mute)") + '">' + esc(initials(e)) + '</div>' +
        '<div class="grow"><div class="nm">' + esc(shortName(e)) + '</div><div class="sb">' + (m ? "логин: " + esc(m.login) : "нет доступа") + '</div></div>' +
        (m ? '<span class="badge ok">есть</span>' : '<span class="badge">выдать</span>') + '</button>';
    }).join("") + '</div>' : '<div class="hint">Сначала добавьте сотрудников.</div>';
    if (isOwner(c)) {
      h += '<div class="sec">Бухгалтеры</div>';
      if (admins.length) h += '<div class="card">' + admins.map(m => '<div class="item"><div class="grow"><div class="nm">' + esc(m.name) + '</div><div class="sb">логин: ' + esc(m.login) + '</div></div>' +
        '<button class="ib" data-act="teamDelAdmin" data-id="' + esc(m.docId) + '" aria-label="Удалить" style="color:var(--bad)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>').join("") + '</div>';
      h += '<div class="stack"><button class="btn sec2" data-act="teamAddAdmin">Добавить бухгалтера</button></div>';
    }
    openSheet(h);
  }
  function openEmpAccess(id) {
    const c = linked(), e = S.emps.find(x => x.id === id);
    if (!c || !e) return;
    const m = (memCache[c.cloud.cid] || []).find(x => x.role === "employee" && x.emp === id);
    if (!m) { return grant(e); }
    D = { kind: "empacc", id };
    openSheet('<h2>' + esc(fullName(e)) + '</h2><p class="sub">Логин: <b>' + esc(m.login) + '</b>. Пароль знает только сотрудник.</p>' +
      '<div class="stack"><button class="btn sec2" data-act="teamRenew" data-id="' + id + '">Новый логин и пароль</button><button class="btn bad" data-act="teamRevoke" data-id="' + id + '">Отозвать доступ</button>' +
      '<button class="btn ghost" data-act="teamAccess">Назад</button></div>');
  }
  /* Учётная запись с логином по фамилии: если такой логин занят, пробуем другой */
  async function createAccount(name) {
    for (let i = 0; ; i++) {
      const login = makeLogin(name), password = makePass();
      try { const u = await Cloud.createUser(login, password); return { uid: u.uid, login, password }; }
      catch (e) { if (e.code !== "EMAIL_EXISTS" || i >= 4) throw e; }
    }
  }
  async function grant(e) {
    const c = linked(), cid = c.cloud.cid;
    const acc = await createAccount(e.last);
    await Cloud.commit([W.set("members/" + acc.uid + "_" + cid, { uid: acc.uid, company: cid, role: "employee", emp: e.id, name: fullName(e), login: acc.login, companyName: S.company.name || "" })]);
    await membersOf(cid, true);
    await publish(c, true);
    showCreds(fullName(e), acc);
  }
  async function revokeMember(c, m) {
    const cid = c.cloud.cid;
    if (m.role === "employee") {
      try { await Cloud.commit([W.del("payslips/" + cid + "_" + m.emp)]); }
      catch (err) { if (err.code !== "PERMISSION_DENIED") throw err; }   // листка могло ещё не быть
      const pub = rd(PUB(cid)) || {};
      delete pub[m.emp];
      wr(PUB(cid), pub);
    }
    await Cloud.commit([W.del("members/" + m.docId)]);
    await membersOf(cid, true);
  }
  function showCreds(name, acc) {
    D = { kind: "creds", name, login: acc.login, password: acc.password };
    openSheet('<h2>Доступ выдан</h2><p class="sub">' + esc(name) + '</p><div class="calc"><div class="l"><span>Логин</span><b class="num">' + esc(acc.login) + '</b></div><div class="l"><span>Пароль</span><b class="num">' + esc(acc.password) + '</b></div></div>' +
      '<div class="alert warn">Пароль показывается один раз. Отправьте его сотруднику сейчас, он сможет сменить его в приложении.</div>' +
      '<div class="stack"><button class="btn" data-act="teamShare">' + ICON.share + 'Отправить</button><button class="btn ghost" data-act="teamAccess">К списку доступов</button></div>');
  }
  function shareCreds() {
    const url = Cloud.appUrl();
    shareText("Вход в «Зарплату»", "Доступ к приложению «Зарплата»\n" + (url ? "Открыть: " + url + "\n" : "") + "Логин: " + D.login + "\nПароль: " + D.password + "\nПароль можно сменить в приложении: раздел «Ещё».");
  }
  function openAddAdmin() {
    D = { kind: "addadmin" };
    openSheet('<h2>Бухгалтер</h2><p class="sub">Сможет считать зарплату, вести сотрудников и готовить отчёты. Добавлять бухгалтеров и отключать компанию может только директор.</p>' +
      '<label class="f"><span>ФИО *</span><input class="in" id="a-name" autocomplete="off"></label>' +
      '<div class="stack"><button class="btn" data-act="teamSaveAdmin">Выдать доступ</button></div>');
  }
  async function saveAdmin() {
    const c = linked(), name = $("#a-name").value.trim(), cid = c.cloud.cid;
    if (!name) { $("#a-name").classList.add("bad"); toast("Введите ФИО"); return; }
    const acc = await createAccount(name.split(/\s+/)[0]);
    await Cloud.commit([W.set("members/" + acc.uid + "_" + cid, { uid: acc.uid, company: cid, role: "admin", emp: "", name, login: acc.login, companyName: S.company.name || "" })]);
    await membersOf(cid, true);
    showCreds(name, acc);
  }

  /* ---------- заявления: директор ---------- */
  const REQ_TYPES = [["vac", "Отпуск"], ["sick", "Больничный"], ["other", "Другое"]];
  const reqType = t => (REQ_TYPES.find(x => x[0] === t) || REQ_TYPES[2])[1];
  const reqDates = d => d.from ? isoToDmy(d.from) + (d.to && d.to !== d.from ? " – " + isoToDmy(d.to) : "") : "";
  const reqStatus = s => s === "approved" ? '<span class="badge ok">одобрено</span>' : s === "rejected" ? '<span class="badge bad">отклонено</span>' : '<span class="badge warn">на рассмотрении</span>';
  async function openReqs() {
    const c = linked();
    if (!c) return;
    await loadReqs(c.cloud.cid);
    D = { kind: "reqs" };
    const list = (reqCache[c.cloud.cid] || []).slice().sort((a, b) => ((a.data.status === "new") !== (b.data.status === "new") ? (a.data.status === "new" ? -1 : 1) : (a.data.created < b.data.created ? 1 : -1)));
    let h = '<h2>Заявления</h2><p class="sub">Сотрудник увидит ваш ответ у себя в приложении.</p>';
    h += list.length ? list.map(r => {
      const d = r.data;
      return '<div class="card" style="margin-bottom:10px"><div class="item"><div class="grow"><div class="nm">' + esc(d.name) + '</div><div class="sb">' + esc(reqType(d.type)) + (reqDates(d) ? " · " + esc(reqDates(d)) : "") + '</div>' +
        (d.note ? '<div class="sb" style="white-space:normal">' + esc(d.note) + '</div>' : "") + '</div>' + reqStatus(d.status) + '</div>' +
        (d.status === "new" ? '<div class="btns" style="padding:0 12px 12px;margin-top:0"><button class="btn sec2" data-act="teamAnswer" data-id="' + r.id + '" data-v="approved">Одобрить</button><button class="btn ghost" data-act="teamAnswer" data-id="' + r.id + '" data-v="rejected">Отклонить</button></div>' : "") + '</div>';
    }).join("") : '<div class="hint">Заявлений пока нет.</div>';
    openSheet(h);
  }
  async function answer(t) {
    const c = linked(), r = (reqCache[c.cloud.cid] || []).find(x => x.id === t.dataset.id), status = t.dataset.v;
    if (!r) return;
    await Cloud.commit([W.set("requests/" + r.id, Object.assign({}, r.data, { status, answered: nowIso(), by: Cloud.session().uid }))]);
    r.data.status = status;
    const e = S.emps.find(x => x.id === r.data.emp), d = r.data;
    if (status === "approved" && e && d.from && (d.type === "vac" || d.type === "sick") && e.type !== "gph" &&
        confirmBox(d.type === "vac" ? "Одобрено. Сразу посчитать отпускные?" : "Одобрено. Сразу посчитать больничный?")) {
      D = { id: e.id };
      if (d.type === "vac") {
        openVac();
        $("#v-start").value = isoToDmy(d.from);
        if (d.to) $("#v-days").value = dayCount(d.from, d.to);
      } else {
        openSick();
        $("#s-from").value = isoToDmy(d.from);
        $("#s-to").value = isoToDmy(d.to || d.from);
      }
      updHr();
      softRender();
      return;
    }
    await openReqs();
    softRender();
    toast(status === "approved" ? "Одобрено" : "Отклонено");
  }

  /* ---------- кабинет сотрудника ---------- */
  const line = (a, b, t) => '<div class="l' + (t ? " t" : "") + '"><span>' + a + '</span><span class="num">' + b + '</span></div>';
  /* Директор мог не отмечать выплаты: тогда «не выплачено» сбивало бы с толку. Считаем, что учёт идёт с месяца первой отмеченной выплаты. */
  const payTracked = m => {
    const paid = ((emp.slip && emp.slip.months) || []).filter(x => x.paid > 0).map(x => x.ym).sort();
    return paid.length > 0 && m.ym >= paid[0];
  };
  function monthDetails(m) {
    let h = '<div class="calc" style="margin:0 12px 12px">';
    if (m.vac || m.sick || m.aid || m.prem) {
      h += line("Оплата труда", fmt(m.labor));
      if (m.prem) h += line("Доплаты за часы", fmt(m.prem));
      if (m.vac) h += line("Отпускные", fmt(m.vac));
      if (m.sick) h += line("Больничный", fmt(m.sick));
      if (m.aid) h += line("Материальная помощь", fmt(m.aid));
    }
    h += line("Начислено", '<b>' + fmt(m.gross) + '</b>');
    if (m.exempt > 0) h += line("Не облагается", fmt(m.exempt));
    h += line("НДФЛ", "− " + fmt(m.pit));
    if (m.inps > 0) h += line(m.inside ? "ИНПС (из НДФЛ)" : "ИНПС", (m.inside ? "" : "− ") + fmt(m.inps));
    h += line("На руки", fmt(m.net), true) + '</div><div class="calc" style="margin:0 12px 12px">';
    (m.deds || []).forEach(d => { h += line("Удержание: " + esc(dedKind(d.kind).toLowerCase()) + (d.note ? " (" + esc(d.note) + ")" : ""), "− " + fmt(d.amount)); });
    if (m.ded && payTracked(m)) h += line("К выплате", fmt(m.due));
    (m.pays || []).forEach(p => { h += line(esc(payKind(p.kind)) + (p.date ? " · " + esc(isoToDmy(p.date)) : ""), fmt(p.amount)); });
    if (payTracked(m)) h += line("Выплачено", fmt(m.paid)) + line(m.left < 0 ? "Выплачено лишнего" : "Осталось выплатить", fmt(Math.abs(m.left)), true);
    else h += line("К выплате", fmt(m.due), true);
    h += '</div>';
    if (m.ym === curYm()) h += '<div class="hint" style="margin:0 12px 12px">Текущий месяц: суммы ещё могут измениться.</div>';
    return h;
  }
  function viewSlips() {
    const slip = emp.slip;
    if (!slip || !slip.months || !slip.months.length) return empty(ICON.file, "Начислений пока нет", "Они появятся здесь, когда директор рассчитает зарплату.", '<button class="btn sec2" data-act="empRefresh">Обновить</button>');
    const top = slip.months[0];
    let h = '<div class="hero"><div class="lbl">На руки за ' + esc(ymLabel(top.ym).toLowerCase()) + '</div><div class="big num">' + fmt(top.net) + '<small>сум</small></div>' +
      '<div class="grid"><div>Начислено<b class="num">' + fmt(top.gross) + '</b></div><div>НДФЛ<b class="num">' + fmt(top.pit) + '</b></div>' +
      (payTracked(top) ? '<div>Выплачено<b class="num">' + fmt(top.paid) + '</b></div><div>Осталось<b class="num">' + fmt(Math.max(0, top.left)) + '</b></div>' : "") + '</div></div>';
    h += '<div class="sec">По месяцам<span class="tag">нажмите, чтобы раскрыть</span></div><div class="card">';
    slip.months.forEach(m => {
      const st = payTracked(m) && m.due > 0 ? (m.left <= 0 ? "выплачено" : m.paid > 0 ? "осталось " + fmt(m.left) : "не выплачено") : (m.ym === curYm() ? "текущий месяц" : "");
      h += '<button class="item" data-act="empOpen" data-ym="' + m.ym + '"><div class="grow"><div class="nm">' + esc(ymLabel(m.ym)) + '</div><div class="sb">' + st + '</div></div><div class="r"><b class="num">' + fmt(m.net) + '</b><span>на руки</span></div></button>';
      if (view.open === m.ym) h += monthDetails(m);
    });
    return h + '</div>';
  }
  const TD = { w: "work", o: "off", a: "abs", u: "unp", t: "trip", v: "vac", s: "sick", x: "out" };
  const TD_LAB = { a: "П", u: "Б", t: "К", v: "О", s: "Бл" };
  function viewTabel() {
    const slip = emp.slip, months = slip && slip.months ? slip.months.filter(m => m.tab) : [];
    let h = "";
    if (months.length) {
      const i = Math.max(0, months.findIndex(m => m.ym === view.tabYm)), m = months[i], t = m.tab, ym = m.ym;
      h += '<div class="month"><button class="ib" data-act="empYm" data-d="1" aria-label="Предыдущий месяц"' + (i >= months.length - 1 ? " disabled" : "") + '>' + ICON.left + '</button><div class="m">' + esc(ymLabel(ym)) + '</div>' +
        '<button class="ib" data-act="empYm" data-d="-1" aria-label="Следующий месяц"' + (i <= 0 ? " disabled" : "") + '>' + ICON.right + '</button></div>';
      const lead = (new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1, 1).getDay() + 6) % 7;
      h += '<div class="tgrid">' + DOW.map(x => '<div class="th">' + x + '</div>').join("") + '<div></div>'.repeat(lead);
      t.grid.split("").forEach((c, d) => {
        const lab = t.hours && c === "w" ? fmtH(t.hours[d]) : (TD_LAB[c] || "");
        h += '<div class="td ' + TD[c] + '"><b>' + (d + 1) + '</b><i>' + lab + '</i></div>';
      });
      h += '</div><div class="tlegend"><span class="td abs">П</span> прогул <span class="td unp">Б</span> за свой счёт <span class="td trip">К</span> командировка <span class="td vac">О</span> отпуск <span class="td sick">Бл</span> больничный</div>';
      h += '<div class="calc">' + line(t.hrs ? "Норма часов" : "Рабочих дней по графику", t.hrs ? fmtH(t.W) + " ч" : t.W) + line("Оплачивается", t.hrs ? fmtH(t.paid) + " ч" : t.paid + " дн.", true);
      if (m.over) {
        if (m.over.ot) h += line("Сверхурочные", fmtH(m.over.ot) + " ч · " + fmt(m.over.otPay));
        if (m.over.wk) h += line("В выходные и праздники", fmtH(m.over.wk) + " ч · " + fmt(m.over.wkPay));
        if (m.over.night) h += line("Ночные", fmtH(m.over.night) + " ч · " + fmt(m.over.nightPay));
      }
      h += '</div>';
    } else h += empty(ICON.file, "Табеля пока нет", "Он появится здесь, когда директор рассчитает зарплату.", "");
    const L = slip && slip.leave;
    if (L) {
      h += '<div class="sec">Отпуск</div><div class="calc">' + line("Положено в год", L.per + " дн.") + line("Накоплено", String(L.earned).replace(".", ",") + " дн.") + line("Использовано", L.used + " дн.") +
        (L.adj ? line("Поправка", (L.adj > 0 ? "+" : "") + L.adj + " дн.") : "") + line("Остаток", String(L.left).replace(".", ",") + " дн.", true) + '</div><div class="hint">Примерный расчёт по дате приёма. Точный остаток уточняйте у директора.</div>';
    }
    const ev = slip && slip.events || [];
    if (ev.length) h += '<div class="sec">Отпуска и больничные</div><div class="card">' + ev.map(x => '<div class="item"><div class="grow"><div class="nm">' + esc(evTitle(x)) + '</div><div class="sb">' + fmt(x.amount) + ' сум · ' + esc(ymLabel(x.payYm)) + '</div></div></div>').join("") + '</div>';
    return h;
  }
  function viewRequests() {
    const list = emp.reqs || [];
    let h = '<div class="stack" style="margin-top:0"><button class="btn" data-act="empNew">' + ICON.plus + 'Новое заявление</button></div>';
    if (list.length) {
      h += '<div class="sec">Мои заявления</div><div class="card">' + list.map(r => '<div class="item"><div class="grow"><div class="nm">' + esc(reqType(r.type)) + reqStatus(r.status) + '</div><div class="sb">' + esc(reqDates(r)) + '</div>' +
        (r.note ? '<div class="sb" style="white-space:normal">' + esc(r.note) + '</div>' : "") + '</div>' +
        (r.status === "new" ? '<button class="ib" data-act="empDel" data-id="' + r.id + '" aria-label="Отозвать" style="color:var(--bad)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' : "") + '</div>').join("") + '</div>';
    } else h += '<div class="hint">Здесь можно попросить отпуск, сообщить о больничном или написать директору.</div>';
    return h;
  }
  function viewMore() {
    let h = apkBanner();
    if (me.list && me.list.length > 1) h += '<div class="sec" style="margin-top:0">Компания</div><div class="card">' + me.list.map(m => '<button class="item" data-act="empCo" data-id="' + esc(m.company) + '"><div class="grow"><div class="nm">' + esc(m.companyName || "Без названия") + '</div></div>' + (m.company === me.cid ? '<span class="badge ok">✓</span>' : "") + '</button>').join("") + '</div>';
    h += '<div class="sec"' + (me.list && me.list.length > 1 ? "" : ' style="margin-top:0"') + '>Язык / Til</div>' + seg("lang", REG.lang || "ru", [["ru", "Русский"], ["uz", "O'zbekcha"]], "lang");
    h += '<div class="sec">Оформление</div>' + seg("theme", REG.theme, [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], "theme");
    const s = Cloud.session();
    h += '<div class="sec">Аккаунт</div><div class="hint" style="margin-top:0">Логин: <b>' + esc(s ? Cloud.shownLogin(s.email) : "") + '</b></div>' +
      '<div class="stack"><button class="btn sec2" data-act="teamPass">Сменить пароль</button><button class="btn sec2" data-act="empRefresh">Обновить данные</button><button class="btn bad" data-act="teamOut">Выйти</button></div>';
    if (emp.at) { const d = new Date(emp.at); h += '<div class="hint">Обновлено: ' + pad(d.getDate()) + "." + pad(d.getMonth() + 1) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + '</div>'; }
    return h;
  }
  function employeeView() {
    const name = (emp.slip && emp.slip.name) || me.name || "", co = (emp.slip && emp.slip.company) || me.company || "";
    let h = '<div class="top"><h1>Мой кабинет</h1><div class="sub">' + esc(name) + (co ? " · " + esc(co) : "") + '</div></div><div class="page"><div style="margin:10px 0 14px">' +
      seg("tab", view.tab, [["slips", "Листки"], ["tabel", "Табель"], ["reqs", "Заявления"], ["more", "Ещё"]], "empTab") + '</div>';
    h += ({ slips: viewSlips, tabel: viewTabel, reqs: viewRequests, more: viewMore })[view.tab]();
    return h + '</div>';
  }
  function openNewReq() {
    D = { kind: "empreq", type: "vac" };
    openSheet('<h2>Новое заявление</h2><p class="sub">Директор увидит его в приложении и ответит.</p>' +
      '<div class="f"><span>Что нужно</span>' + seg("type", "vac", REQ_TYPES) + '</div>' +
      '<div class="two">' + dateField("q-from", "", "С какого числа") + dateField("q-to", "", "По какое число") + '</div>' +
      '<label class="f"><span>Комментарий</span><input class="in" id="q-note" maxlength="500" autocomplete="off"></label>' +
      '<div class="stack"><button class="btn" data-act="empSend">Отправить</button></div>');
  }
  async function sendReq() {
    const fromRaw = $("#q-from").value.trim(), toRaw = $("#q-to").value.trim(), from = parseDmy(fromRaw), to = parseDmy(toRaw), note = $("#q-note").value.trim();
    if ((fromRaw && !from) || (toRaw && !to)) { toast("Дата в формате дд.мм.гггг"); return; }
    if (D.type !== "other" && !from) { $("#q-from").classList.add("bad"); toast("Укажите дату"); return; }
    if (D.type === "other" && !note) { $("#q-note").classList.add("bad"); toast("Напишите, что нужно"); return; }
    if (from && to && to < from) { toast("Дата окончания раньше начала"); return; }
    const s = Cloud.session(), id = newId();
    await Cloud.commit([W.set("requests/" + id, { company: me.cid, emp: me.emp, uid: s.uid, name: (emp.slip && emp.slip.name) || me.name || "", type: D.type, from: from || "", to: to || from || "", note, status: "new", created: nowIso() }, { exists: false })]);
    closeSheet();
    await syncEmployee();
    render();
    toast("Заявление отправлено");
  }

  const actions = {
    teamLogin: openLogin, teamSignup: openSignup,
    teamDoLogin: act(doLogin), teamDoSignup: act(doSignup), teamReset: act(doReset),
    teamOut: act(signOutAll), teamPass: openPassword, teamSavePass: act(savePassword),
    teamLink: act(linkCompany), teamUnlink: act(unlinkCompany),
    teamAccess: act(openAccess),
    teamEmpAcc: act(t => openEmpAccess(t.dataset.id)),
    teamRenew: act(async t => {
      const c = linked(), e = S.emps.find(x => x.id === t.dataset.id), m = memCache[c.cloud.cid].find(x => x.role === "employee" && x.emp === t.dataset.id);
      if (!confirmBox("Старый логин перестанет работать. Выдать новый?")) return;
      await revokeMember(c, m);
      await grant(e);
    }),
    teamRevoke: act(async t => {
      const c = linked(), m = memCache[c.cloud.cid].find(x => x.role === "employee" && x.emp === t.dataset.id);
      if (!confirmBox("Отозвать доступ? Сотрудник больше не сможет войти и увидеть свои данные.")) return;
      await revokeMember(c, m);
      await openAccess();
      toast("Доступ отозван");
    }),
    teamShare: shareCreds,
    teamAddAdmin: openAddAdmin, teamSaveAdmin: act(saveAdmin),
    teamDelAdmin: act(async t => {
      const c = linked(), m = memCache[c.cloud.cid].find(x => x.docId === t.dataset.id);
      if (!confirmBox("Отозвать доступ бухгалтера «" + m.name + "»?")) return;
      await revokeMember(c, m);
      await openAccess();
    }),
    teamReqs: act(openReqs), teamAnswer: act(answer),
    empTab: t => { view.tab = t.dataset.v; render(); window.scrollTo(0, 0); },
    empOpen: t => { view.open = view.open === t.dataset.ym ? null : t.dataset.ym; render(); },
    empYm: t => {
      const months = (emp.slip && emp.slip.months || []).filter(m => m.tab), i = Math.max(0, months.findIndex(m => m.ym === view.tabYm)), n = months[i + +t.dataset.d];
      if (n) { view.tabYm = n.ym; render(); }
    },
    empNew: openNewReq, empSend: act(sendReq),
    empDel: act(async t => {
      if (!confirmBox("Отозвать заявление?")) return;
      await Cloud.commit([W.del("requests/" + t.dataset.id)]);
      await syncEmployee();
      render();
    }),
    empRefresh: act(async () => { await syncEmployee(); render(); toast("Данные обновлены"); }),
    empCo: act(async t => {
      setMe(Object.assign({}, me, { cid: t.dataset.id }));
      view.open = null; view.tabYm = null;
      await syncEmployee();
      render();
    })
  };

  /* Сотрудника удалили из компании — его доступ больше не нужен */
  async function onEmpDeleted(id) {
    const c = linked();
    if (!c || !Cloud.session()) return;
    try {
      const m = (await membersOf(c.cloud.cid, true)).find(x => x.role === "employee" && x.emp === id);
      if (m) await revokeMember(c, m);
    } catch (e) { report(e, true); }
  }
  function forgetOnWipe() { Cloud.signOut(); setMe(null); emp = {}; wr(EMP, null); }

  return { buildSlip, employeeMode, employeeView, settingsBlock, welcomeBtn, payBanner, actions, onSave, onSwitch, onEmpDeleted, forgetOnWipe, start, linked,
    syncNow, flush };   // syncNow и flush нужны автотесту
})();
