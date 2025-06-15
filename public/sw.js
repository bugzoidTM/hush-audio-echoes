
const CACHE_NAME = 'shhhh-cache-v1';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas em milissegundos

// Arquivos que devem ser cacheados
const STATIC_ASSETS = [
  '/',
  '/src/main.tsx',
  '/src/index.css',
  // Adicione outros recursos estáticos conforme necessário
];

// Instalar service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  // Apenas cache recursos da mesma origem
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Verificar se o cache expirou
        const cacheDate = new Date(cachedResponse.headers.get('date'));
        const now = new Date();
        
        if (now - cacheDate > CACHE_EXPIRY) {
          // Cache expirado, buscar nova versão
          return fetchAndCache(event.request);
        }
        
        return cachedResponse;
      }
      
      return fetchAndCache(event.request);
    })
  );
});

// Buscar e cachear recursos
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Se falhar, retornar do cache se disponível
    return caches.match(request);
  }
}

// Limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
