/**
 * Enlace universal de Google Maps a partir de una dirección en texto (no
 * hace falta geocodificarla ni tener API key): funciona igual en web que
 * en móvil, donde abre la app de Maps si está instalada. Se usa para el
 * botón "Cómo llegar" de la confirmación de cita (pantalla y email).
 */
export function buildDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
