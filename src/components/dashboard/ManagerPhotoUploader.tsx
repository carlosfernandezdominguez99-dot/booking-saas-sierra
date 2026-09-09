"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { uploadManagerPhotoAction } from "@/app/dashboard/configuracion/actions";

/**
 * Foto propia del gerente (Fase 11) — mismo patrón que
 * `EmployeePhotoUploader`, pero para el propio propietario: es la que se
 * usa como su círculo en el selector de arriba y como su avatar en el paso
 * público "¿con quién?", en vez del logo del negocio.
 */
export function ManagerPhotoUploader({
  managerName,
  initialPhotoUrl,
}: {
  managerName: string;
  initialPhotoUrl: string | null;
}) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("photo", file);

    startTransition(async () => {
      const result = await uploadManagerPhotoAction(formData);
      if (result.error) {
        setError(result.error);
        setPreview(null);
        return;
      }
      if (result.url) setPhotoUrl(result.url);
      router.refresh();
    });
  }

  const displayUrl = preview ?? photoUrl;

  return (
    <div className="flex items-center gap-4">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={managerName} className="h-14 w-14 rounded-full object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-100 text-lg font-semibold text-ink-500">
          {managerName.slice(0, 1).toUpperCase()}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {photoUrl ? "Cambiar foto" : "Subir foto"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="mt-1.5 text-xs text-ink-400">PNG, JPG o WEBP. Máx. 3 MB.</p>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
