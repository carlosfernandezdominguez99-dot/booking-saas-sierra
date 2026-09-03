/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  experimental: {
    // Por defecto, Next.js guarda en el navegador (Router Cache) la
    // respuesta de una página dinámica hasta 30s antes de considerarla
    // "vieja" y volver a pedirla al servidor. Eso es justo lo que
    // causaba que, en /dashboard/reservas, cambiar de pestaña
    // (Próximas/Pasadas/Canceladas — mismo path, solo cambia el
    // `?view=`) siguiera mostrando el contenido de la pestaña anterior
    // hasta forzar un refresco (Ctrl+F5). Con `dynamic: 0`, cualquier
    // página dinámica del panel (todas: usan cookies de sesión) se pide
    // siempre fresca al navegar, en vez de servir una versión en caché.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
