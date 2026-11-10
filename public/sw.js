// Trình chạy nền: lưu KHUNG app để mạng yếu vẫn mở được. Dữ liệu (/api/) KHÔNG BAO GIỜ lưu vào máy.
const BAN = "cham-cong-v4";
const VO = ["/", "/app.js", "/style.css", "/i18n.js", "/vendor/qrcode.min.js", "/vendor/jsQR.js", "/manifest.webmanifest", "/icon-192.png", "/chinh-sach.html"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(BAN).then((c) => c.addAll(VO)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== BAN).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname === "/kiosk.html") return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const c = res.clone(); caches.open(BAN).then((x) => x.put(r.mode === "navigate" ? "/" : r, c)); }
    return res;
  }).catch(() => caches.match(r.mode === "navigate" ? "/" : r)));
});
