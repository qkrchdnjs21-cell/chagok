/* 차곡 — 오프라인 앱 셸 캐시 */
const VERSION = 'chagok-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './fonts/gowun-batang.woff2',
  './img/example-morning.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(SHELL.map(path =>
      cache.add(new Request(path, { cache: 'reload' })).catch(() => null)
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 유튜브 썸네일·noembed 같은 외부 요청은 브라우저에 맡깁니다
  if (url.origin !== self.location.origin) return;

  // 화면 이동: 네트워크 우선, 실패하면 저장된 앱 셸
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const cache = await caches.open(VERSION);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch (err) {
        const cache = await caches.open(VERSION);
        return (await cache.match('./index.html')) ||
               (await cache.match('./')) ||
               new Response('오프라인 상태예요. 차곡을 다시 열어주세요.', {
                 status: 503,
                 headers: { 'Content-Type': 'text/plain; charset=utf-8' }
               });
      }
    })());
    return;
  }

  // 그 밖의 파일: 캐시 우선, 없으면 네트워크
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
