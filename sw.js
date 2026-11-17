/* 离线缓存：让 App 在没有网络时也能打开、浏览已存档内容 */
const VERSION = "v1.4.6";
const SHELL = [
  "./",
  "./index.html",
  "./assets/app.css",
  "./assets/app.js",
  "./assets/db.js",
  "./assets/drive.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Google 接口 / GIS 不缓存
  if (url.hostname.includes("google")) return;
  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 网页本体和代码走「先问网络」，保证更新立刻生效；拿不到才用缓存
  const isCode = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
  if (isCode) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || fetch(e.request)))
    );
    return;
  }

  // 图标等静态资源：缓存优先
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      });
    })
  );
});
