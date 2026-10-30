/* Облако на Firebase без SDK (REST): вход по логину и паролю, хранилище Firestore. Кто что видит — см. firebase/firestore.rules.
   Проект задаётся в firebase-config.js; пока он не заполнен, приложение работает как раньше — только на телефоне. */
(function (root) {
  "use strict";
  let cfg = root.ZARPLATA_FIREBASE || null;
  // проверка на локальном эмуляторе: localStorage["zarplata.fbcfg"] = {"apiKey":"x","projectId":"demo-zarplata","emulator":"127.0.0.1"}
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      const o = JSON.parse(localStorage.getItem("zarplata.fbcfg") || "null");
      if (o) cfg = o;
    }
  } catch (e) { }

  const SESS = "zarplata.session";
  const configured = () => !!(cfg && cfg.apiKey && cfg.projectId);
  const emuHost = (port) => "http://" + cfg.emulator + ":" + port + "/";
  const authUrl = m => (cfg.emulator ? emuHost(9099) : "https://") + "identitytoolkit.googleapis.com/v1/accounts:" + m + "?key=" + encodeURIComponent(cfg.apiKey);
  const tokenUrl = () => (cfg.emulator ? emuHost(9099) : "https://") + "securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(cfg.apiKey);
  const fsBase = () => (cfg.emulator ? "http://" + cfg.emulator + ":8080" : "https://firestore.googleapis.com") + "/v1/projects/" + cfg.projectId + "/databases/(default)/documents";
  const docName = p => "projects/" + cfg.projectId + "/databases/(default)/documents/" + p;

  class CloudError extends Error {
    constructor(code, msg) { super(msg || code); this.code = code; }
  }
  /* kind: "auth" — код ошибки в тексте ("EMAIL_EXISTS : …"), "fs" — в status ("PERMISSION_DENIED") */
  async function http(url, opt, kind) {
    let res;
    try { res = await fetch(url, opt); } catch (e) { throw new CloudError("NETWORK"); }
    let body = null;
    try { body = await res.json(); } catch (e) { }
    if (!res.ok) {
      const err = (Array.isArray(body) ? body[0] : body || {}).error || {};
      const code = kind === "auth" ? String(err.message || "").split(/[\s:]/)[0] : err.status;
      throw new CloudError(code || "HTTP_" + res.status, err.message);
    }
    return body;
  }
  const postJson = o => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });

  /* ---------- вход ---------- */
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem(SESS) || "null"); } catch (e) { }
  function setSess(s) {
    sess = s;
    try { if (s) localStorage.setItem(SESS, JSON.stringify(s)); else localStorage.removeItem(SESS); } catch (e) { }
  }
  const session = () => sess;
  const fromAuth = r => ({ uid: r.localId, email: r.email, idToken: r.idToken, refreshToken: r.refreshToken, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 });
  // у сотрудника вместо e-mail короткий логин: он становится адресом в домене проекта, письма туда не отправляются
  const loginDomain = () => "@" + cfg.projectId + ".firebaseapp.com";
  const toEmail = login => { const s = String(login).trim().toLowerCase(); return s.includes("@") ? s : s + loginDomain(); };
  const isLogin = email => String(email || "").endsWith(loginDomain());
  const shownLogin = email => isLogin(email) ? email.slice(0, -loginDomain().length) : email;

  async function signIn(login, password) {
    const r = await http(authUrl("signInWithPassword"), postJson({ email: toEmail(login), password, returnSecureToken: true }), "auth");
    setSess(fromAuth(r));
    return sess;
  }
  async function signUp(email, password) {
    const r = await http(authUrl("signUp"), postJson({ email: toEmail(email), password, returnSecureToken: true }), "auth");
    setSess(fromAuth(r));
    return sess;
  }
  function signOut() { setSess(null); }
  /* Учётная запись для другого человека: текущий вход не меняется */
  async function createUser(login, password) {
    const r = await http(authUrl("signUp"), postJson({ email: toEmail(login), password, returnSecureToken: true }), "auth");
    return { uid: r.localId };
  }
  async function changePassword(password) {
    const r = await http(authUrl("update"), postJson({ idToken: await token(), password, returnSecureToken: true }), "auth");
    setSess(Object.assign({}, sess, { idToken: r.idToken, refreshToken: r.refreshToken, exp: Date.now() + (Number(r.expiresIn) || 3600) * 1000 }));
  }
  async function resetEmail(email) {
    await http(authUrl("sendOobCode"), postJson({ requestType: "PASSWORD_RESET", email: toEmail(email) }), "auth");
  }
  async function token() {
    if (!sess) throw new CloudError("SESSION_EXPIRED");
    if (Date.now() < sess.exp - 60000) return sess.idToken;
    let r;
    try {
      r = await http(tokenUrl(), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(sess.refreshToken) }, "auth");
    } catch (e) {
      if (e.code === "NETWORK") throw e;
      setSess(null);                       // доступ отозван или вход устарел
      throw new CloudError("SESSION_EXPIRED");
    }
    setSess(Object.assign({}, sess, { idToken: r.id_token, refreshToken: r.refresh_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 }));
    return sess.idToken;
  }

  /* ---------- Firestore ---------- */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === "boolean") return { booleanValue: v };
    if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === "string") return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    return { mapValue: { fields: encFields(v) } };
  }
  function encFields(o) { const f = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined) f[k] = enc(o[k]); }); return f; }
  function dec(x) {
    if ("stringValue" in x) return x.stringValue;
    if ("integerValue" in x) return Number(x.integerValue);
    if ("doubleValue" in x) return x.doubleValue;
    if ("booleanValue" in x) return x.booleanValue;
    if ("timestampValue" in x) return x.timestampValue;
    if ("arrayValue" in x) return (x.arrayValue.values || []).map(dec);
    if ("mapValue" in x) return decFields(x.mapValue.fields || {});
    return null;
  }
  function decFields(f) { const o = {}; Object.keys(f || {}).forEach(k => { o[k] = dec(f[k]); }); return o; }
  const decDoc = d => ({ id: d.name.split("/").pop(), updateTime: d.updateTime, data: decFields(d.fields) });

  async function authed(url, opt) {
    const t = await token();
    opt = opt || {};
    opt.headers = Object.assign({ Authorization: "Bearer " + t, "Content-Type": "application/json" }, opt.headers);
    return http(url, opt, "fs");
  }
  /* Документ или null, если его нет */
  async function get(path) {
    try { return decDoc(await authed(fsBase() + "/" + path)); }
    catch (e) { if (e.code === "NOT_FOUND") return null; throw e; }
  }
  /* Все документы подколлекции */
  async function list(path) {
    let out = [], page = "";
    do {
      const r = await authed(fsBase() + "/" + path + "?pageSize=100" + (page ? "&pageToken=" + encodeURIComponent(page) : ""));
      out = out.concat((r.documents || []).map(decDoc));
      page = r.nextPageToken || "";
    } while (page);
    return out;
  }
  /* Документы коллекции, где field == value */
  async function query(coll, field, value) {
    const r = await authed(fsBase() + ":runQuery", { method: "POST", body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: coll }],
      where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: enc(value) } }
    } }) });
    return (r || []).filter(x => x.document).map(x => decDoc(x.document));
  }
  /* Запись нескольких документов одной операцией: всё или ничего. pre — условие, например { updateTime } или { exists: false } */
  const W = {
    set: (path, data, pre) => { const w = { update: { name: docName(path), fields: encFields(data) } }; if (pre) w.currentDocument = pre; return w; },
    del: path => ({ delete: docName(path) })
  };
  async function commit(writes) {
    return authed(fsBase() + ":commit", { method: "POST", body: JSON.stringify({ writes }) });
  }

  const ERR = {
    NETWORK: "Нет связи с сервером. Проверьте интернет.",
    EMAIL_NOT_FOUND: "Неверный логин или пароль",
    INVALID_PASSWORD: "Неверный логин или пароль",
    INVALID_LOGIN_CREDENTIALS: "Неверный логин или пароль",
    USER_DISABLED: "Доступ отключён",
    EMAIL_EXISTS: "Такой e-mail уже зарегистрирован. Войдите или восстановите пароль.",
    WEAK_PASSWORD: "Слишком короткий пароль: нужно не меньше 6 символов",
    INVALID_EMAIL: "Проверьте логин или e-mail",
    MISSING_PASSWORD: "Введите пароль",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Слишком много попыток. Попробуйте позже.",
    PERMISSION_DENIED: "Нет прав на это действие",
    SESSION_EXPIRED: "Войдите заново",
    NO_ACCESS: "Для этого логина нет доступа. Обратитесь к директору.",
    BAD_DATA: "Не удалось прочитать данные с сервера. Попробуйте ещё раз.",
    RESOURCE_EXHAUSTED: "На сегодня исчерпан бесплатный лимит сервера. Попробуйте завтра."
  };
  const errText = e => ERR[e && e.code] || ("Ошибка сервера: " + ((e && e.code) || "неизвестная"));

  root.Cloud = { configured, session, signIn, signUp, signOut, createUser, changePassword, resetEmail, isLogin, shownLogin, get, list, query, commit, W, CloudError, errText,
    appUrl: () => (cfg && cfg.appUrl) || "" };
})(window);
