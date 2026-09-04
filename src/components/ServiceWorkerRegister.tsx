"use client";

import { useEffect } from "react";

/**
 * Registra `public/sw.js` en cuanto carga cualquier página. Necesario
 * para que la app cumpla los criterios de instalación como PWA (Fase 6).
 * No renderiza nada — vive montado una vez en `RootLayout`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No-op: si falla el registro (navegador sin soporte, contexto no
      // seguro, etc.), la app sigue funcionando igual, solo sin PWA.
    });
  }, []);

  return null;
}
