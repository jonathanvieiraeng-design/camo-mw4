// Service worker: guarda todos os arquivos do app para funcionar sem internet.
//
// AO PUBLICAR UMA MUDANÇA NO CÓDIGO: aumente VERSAO (ex.: v3 → v4). Isso faz o celular baixar
// a versão nova e mostrar "Nova versão disponível".
// O data/mw4.json é buscado na rede quando houver internet (e guardado), então trocar só os dados
// não exige mudar VERSAO.

const VERSAO = 'v1';
const CACHE = `camo-mw4-${VERSAO}`;
const DADOS = 'data/mw4.json';

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/store.js',
  'js/data.js',
  'js/progresso.js',
  'js/rules.js',
  'js/stats.js',
  'js/ui.js',
  'js/views/lista.js',
  'js/views/arma.js',
  'js/views/painel.js',
  'js/views/config.js',
  'js/views/editor.js',
  DADOS,
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('camo-mw4-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  if (ev.data === 'atualizar') self.skipWaiting();
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);

  // Dados do jogo: rede primeiro (pega atualizações), cache se estiver offline.
  if (url.pathname.endsWith('/' + DADOS)) {
    ev.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const r = await fetch(req, { cache: 'no-cache' });
        if (r.ok) await cache.put(DADOS, r.clone());
        return r;
      } catch {
        return (await cache.match(DADOS)) || Response.error();
      }
    })());
    return;
  }

  // Abrir o app: sempre a página principal guardada (outras páginas, como /tests/, vão à rede).
  const raiz = new URL(self.registration.scope).pathname;
  if (req.mode === 'navigate' && (url.pathname === raiz || url.pathname === raiz + 'index.html')) {
    ev.respondWith(caches.match('index.html').then((r) => r || fetch(req)));
    return;
  }

  // Resto: cache primeiro, rede como reserva.
  ev.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
