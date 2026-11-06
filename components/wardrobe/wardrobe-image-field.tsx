"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validations/image";

/** Uploads a wardrobe photo immediately and stores its path in a hidden input. */
export function WardrobeImageField({
  initialPath,
  initialUrl,
  onBusyChange,
}: {
  initialPath: string | null;
  initialUrl: string | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState(initialPath ?? "");
  const [preview, setPreview] = useState<string | null>(initialUrl);
  const [busy, setBusyState] = useState(false);
  const setBusy = (b: boolean) => {
    setBusyState(b);
    onBusyChange?.(b);
  };
  const [error, setError] = useState<string>();

  async function upload(file?: File) {
    if (!file) return;
    setError(undefined);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Please choose a JPG, PNG or WEBP image.");
    if (file.size > MAX_UPLOAD_BYTES) return setError("That photo is larger than 5 MB.");
    // Remove a photo uploaded earlier in this same form session (not the saved one).
    if (path && path !== initialPath) void fetch(`/api/upload-image?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.append("file", file);
    form.append("kind", "wardrobe");
    try {
      const res = await fetch("/api/upload-image", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Upload failed.");
        setPreview(initialUrl);
        setPath(initialPath ?? "");
      } else {
        setPath(json.path);
      }
    } catch {
      setError("Upload failed — check your connection.");
      setPreview(initialUrl);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (path && path !== initialPath) void fetch(`/api/upload-image?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    setPath("");
    setPreview(null);
  }

  return (
    <div>
      <p className="text-sm font-medium">Photo (optional)</p>
      <input type="hidden" name="imagePath" value={path} />
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="sr-only" aria-label="Choose item photo" data-testid="wardrobe-photo-input"
        onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take item photo"
        onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="mt-3 flex items-start gap-4">
        <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL / local preview
            <img src={preview} alt="Item photo" className="size-full object-cover" />
          ) : (
            <ImageUp aria-hidden className="size-6 text-muted-foreground" />
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-background/70" role="status" aria-label="Uploading">
              <Loader2 aria-hidden className="size-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImageUp aria-hidden /> {preview ? "Replace photo" : "Upload photo"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="sm:hidden" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera aria-hidden /> Take photo
          </Button>
          {preview && (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy}>
              <Trash2 aria-hidden /> Remove photo
            </Button>
          )}
          <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · up to 5 MB · stored privately</p>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.8rem] text-danger">{error}</p>}
    </div>
  );
}
