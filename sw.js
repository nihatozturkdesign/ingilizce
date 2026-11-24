// Çevrimdışı çalışma için önbellek. Sürüm değişince telefondaki eski dosyalar silinir.
const CACHE = "ingilizce-v4";
const FILES = ["./", "index.html", "data.js", "data2.js", "games.js", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // Önce internetten güncelini al (tarayıcı önbelleğini atla), olmazsa önbellekten aç
  e.respondWith(fetch(e.request.url, {cache: "no-cache", credentials: "same-origin"})
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match("index.html"))));
});
