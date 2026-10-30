/* Офлайн-кэш для установки на iPhone/iPad. Данные пользователя здесь не хранятся — они в localStorage страницы.
   При выпуске новой версии поменяйте VERSION, чтобы устройства обновили кэш. */
var VERSION = "zarplata-6";
var FILES = ["./", "index.html", "app.css", "calc.js", "hr.js", "tpl11101.js", "xlsxfill.js", "xlsxreport.js", "i18n.js", "firebase-config.js", "cloud.js", "team.js", "slipfile.js", "app.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
