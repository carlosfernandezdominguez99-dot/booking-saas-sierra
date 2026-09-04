import type { MetadataRoute } from "next";

/**
 * Convención de Next.js (`app/manifest.ts`): genera automáticamente
 * `/manifest.webmanifest` y añade el `<link rel="manifest">` en el
 * `<head>` — no hace falta tocar `layout.tsx` para esto.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZoriaBooking",
    short_name: "ZoriaBooking",
    description:
      "Sistema de reservas online para peluquerías, barberías, centros de estética, fisioterapia y más.",
    start_url: "/dashboard/inicio",
    display: "standalone",
    // Color de fondo de la pantalla de carga (splash) al abrir la app
    // instalada: en blanco, a juego con el fondo de los iconos — antes en
    // negro, se veía como un cuadro oscuro detrás del logo al abrir.
    background_color: "#ffffff",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
