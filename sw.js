const CACHE_NAME = 'mas-king-v3.07-cache';
const SHARED_CACHE_NAME = 'shared-image-cache';

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

// 2. アクティベート時に古いキャッシュを掃除（共有用キャッシュは保護）
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== SHARED_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. ★フェッチ処理（Web Share Target 横取り ＆ ネットワーク優先キャッシュ）
self.addEventListener('fetch', (event) => {
  // ブラウザの拡張機能などのリクエスト（chrome-extension://など）は無視する
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // 【Web Share Target API】共有された画像のPOSTリクエストを完全ローカルで横取り
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('image'); // manifest.json の name: "image" と一致

        if (file) {
          const cache = await caches.open(SHARED_CACHE_NAME);
          await cache.put('shared-image', new Response(file));
        }
      } catch (err) {
        console.error('マス王 PWA: 共有画像の受信に失敗しました:', err);
      }
      // 画像を受け取ったらメイン画面へリダイレクト（パラメータ付き）
      return Response.redirect('/?shared=true', 303);
    })());
    return;
  }

  // 通常のリクエスト：まずは常にネットワークへ最新を取りに行く（ネットワーク優先）
  event.respondWith(
    fetch(event.request).then((response) => {
      // オンラインで正常に取得できたら、次回オフライン時のためにキャッシュを最新に更新しておく
      if (response && response.status === 200 && event.request.method === 'GET') {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseCopy);
        });
      }
      return response; // 常に最新の生のネットワークレスポンスを返す
    }).catch(() => {
      // 【オフライン時のみ発動】電波がない・オフライン時はキャッシュから返す
      return caches.match(event.request);
    })
  );
});