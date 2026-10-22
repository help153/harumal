// 오프라인에서도 앱 화면이 열리도록 앱 파일을 저장해 둔다.
// 앱 파일은 네트워크를 먼저 시도하고(업데이트 반영), 안 되면 저장본을 쓴다.
// API 호출(Claude, Azure)과 다른 사이트 요청은 건드리지 않는다.

const CACHE = "harumal-v14";
const SHELL = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/content.js",
  "./js/phrases.js",
  "./js/examples.js",
  "./js/kanji-meaning.js",
  "./js/family-en.js",
  "./js/business-en.js",
  "./js/store.js",
  "./js/ai.js",
  "./js/speech.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("harumal-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // no-cache: 서버에 바뀐 게 있는지 매번 확인해서, 새 버전을 올리면 바로 반영되게 한다
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
