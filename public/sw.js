// Service worker mínimo para que la app cumpla los criterios de
// instalación como PWA (Chrome/Android, y ayuda en iOS/Safari).
//
// A propósito NO cachea nada de forma agresiva: este es un panel de
// reservas donde los datos cambian todo el rato (disponibilidad, citas
// del día...), así que cachear peticiones podría hacer que el negocio
// viera datos viejos. Solo se registra para que exista un service worker
// activo; todas las peticiones pasan directamente a la red.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Sin `event.respondWith(...)`: se deja pasar la petición normal a la
  // red, sin caché. Basta con tener el listener para cumplir el
  // requisito de "service worker con manejador de fetch" de algunos
  // navegadores.
});
