const CACHE_NAME = 'mas-king-v2.90-cache';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// 1. インストール時に必要最低限のファイルをキャッシュ（オフライン用）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. アクティベート時に古いキャッシュを掃除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. ★ここが核心！ネットワーク優先（キャッシュ無効化・オフライン担保）ロジック
self.addEventListener('fetch', (event) => {
  // ブラウザの拡張機能などのリクエスト（chrome-extension://など）は無視する
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    // まずは常にインターネット（ネットワーク）へ実データを取りに行く
    fetch(event.request).then((response) => {
      // オンラインで正常に取得できたら、次回オフライン時のためにキャッシュを最新に更新しておく
      if (response && response.status === 200) {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseCopy);
        });
      }
      return response; // 常に最新の生のネットワークレスポンスを返す（キャッシュは無効化状態）
    }).catch(() => {
      // 【オフライン時のみ発動】電波がなくてネットワークエラーになったら、キャッシュから返す
      return caches.match(event.request);
    })
  );
});
