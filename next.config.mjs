// Cabeceras de seguridad para TODA respuesta. La CSP no usa nonce (que
// exigiría tocar el middleware y no hay forma de probarlo en este entorno
// sin arriesgarse a dejar el hidratado de Next.js roto en producción sin
// poder verlo) — así que `script-src`/`style-src` llevan `'unsafe-inline'`
// (Next.js inyecta algún script/estilo inline propio al hidratar). Sigue
// bloqueando lo que de verdad importa: cargar un script de un dominio
// ajeno (p. ej. `<script src="https://evil.com/x.js">` colado por un
// campo de texto sin escapar), que la página se incruste en un iframe
// ajeno (clickjacking), y que un formulario mande datos a otro sitio.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  // `blob:` hace falta para la vista previa instantánea al subir una foto
  // (logo, foto de empleado/gerente) — `URL.createObjectURL(file)` genera
  // una URL `blob:` antes de que la subida a Supabase Storage termine.
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

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
    // Equivalente a "CORS para el backend" en esta arquitectura: los
    // Server Actions (todas las acciones "use server" del proyecto) ya
    // rechazan por defecto cualquier petición cuyo Origin no coincida con
    // el host de la propia app — esto solo hace falta si el mismo
    // despliegue responde a MÁS de un dominio (p. ej. el `.vercel.app` de
    // siempre y un dominio propio en cuanto lo tengas: añádelo aquí
    // también, o esas peticiones se rechazarán igual que las de un sitio
    // ajeno).
    serverActions: {
      allowedOrigins: ["booking-saas-sierra.vercel.app"],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
