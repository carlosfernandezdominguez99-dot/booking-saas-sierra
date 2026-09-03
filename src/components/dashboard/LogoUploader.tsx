"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { uploadLogoAction } from "@/app/dashboard/configuracion/actions";

export function LogoUploader({
  businessName,
  initialLogoUrl,
}: {
  businessName: string;
  initialLogoUrl: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.set("logo", file);

    startTransition(async () => {
      const result = await uploadLogoAction(formData);
      if (result.error) {
        setError(result.error);
        setPreview(null);
        return;
      }
      if (result.url) setLogoUrl(result.url);
    });
  }

  const displayUrl = preview ?? logoUrl;

  return (
    <div className="flex items-center gap-4">
      {displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={businessName} className="h-16 w-16 rounded-2xl object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-lg font-semibold text-ink-500">
          {businessName.slice(0, 1).toUpperCase()}
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
          {logoUrl ? "Cambiar logo" : "Subir logo"}
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
