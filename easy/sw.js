// 하루영어 오프라인 실행용. 앱 파일은 네트워크를 먼저 확인하고(업데이트 반영), 안 되면 저장본을 쓴다.
// 하루말과 같은 주소에 있지만 이 서비스 워커는 /easy/ 아래만 담당한다.

const CACHE = "haruen-v1";
const SHELL = [
  "./",
  "./index.html",
  "./css/easy.css",
  "./js/app.js",
  "./js/content.js",
  "../css/app.css",
  "../js/ai.js",
  "../js/speech.js",
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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("haruen-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
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
