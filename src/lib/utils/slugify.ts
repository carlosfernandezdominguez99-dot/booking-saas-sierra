/** Convierte "Barberia Demo" en "barberia-demo" (tambien soporta acentos). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos (diacriticos) tras normalizar NFD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Anade un sufijo corto y aleatorio, util para deshacer colisiones de slug. */
export function withRandomSuffix(base: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
