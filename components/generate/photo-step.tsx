"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validations/image";
import { cn } from "@/lib/utils";

export type PhotoState =
  | { status: "empty" }
  | { status: "uploading"; preview: string }
  | { status: "ready"; preview: string; path: string }
  | { status: "error"; message: string };

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export function PhotoStep({
  photo,
  setPhoto,
  consent,
  setConsent,
  consentError,
}: {
  photo: PhotoState;
  setPhoto: (p: PhotoState) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  consentError?: string;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!ALLOWED.includes(file.type)) {
      setPhoto({ status: "error", message: "Please choose a JPG, PNG or WEBP image." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setPhoto({ status: "error", message: "That photo is larger than 5 MB. Please choose a smaller one." });
      return;
    }
    // Remove the previous upload, if any.
    if (photo.status === "ready") void fetch(`/api/upload-image?path=${encodeURIComponent(photo.path)}`, { method: "DELETE" });

    const preview = URL.createObjectURL(file);
    setPhoto({ status: "uploading", preview });
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-image", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        URL.revokeObjectURL(preview);
        setPhoto({ status: "error", message: json?.error?.message ?? "Upload failed. Please try again." });
        return;
      }
      setPhoto({ status: "ready", preview, path: json.path });
    } catch {
      URL.revokeObjectURL(preview);
      setPhoto({ status: "error", message: "Upload failed — check your connection and try again." });
    }
  }

  async function remove() {
    if (photo.status === "ready") {
      await fetch(`/api/upload-image?path=${encodeURIComponent(photo.path)}`, { method: "DELETE" });
      URL.revokeObjectURL(photo.preview);
    }
    setPhoto({ status: "empty" });
    setConsent(false);
  }

  const inputs = (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        data-testid="photo-input"
        aria-label="Choose a photo"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        aria-label="Take a photo"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  return (
    <div className="space-y-6">
      {inputs}
      {photo.status === "uploading" || photo.status === "ready" ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="relative w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted sm:w-48">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={photo.preview} alt="Your uploaded photo" className="aspect-[3/4] w-full object-cover" />
            {photo.status === "uploading" && (
              <div className="absolute inset-0 grid place-items-center bg-background/70" role="status">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Loader2 aria-hidden className="size-4 animate-spin" /> Uploading…
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 space-y-4">
            {photo.status === "ready" && (
              <p className="inline-flex items-center gap-2 text-sm text-success">
                <ShieldCheck aria-hidden className="size-4" /> Uploaded privately. Location data removed.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()} disabled={photo.status === "uploading"}>
                <RefreshCw aria-hidden /> Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={photo.status === "uploading"}>
                <Trash2 aria-hidden /> Remove
              </Button>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={consentError ? true : undefined}
                aria-describedby={consentError ? "consent-error" : undefined}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
              />
              <span>
                I agree to send this photo to StyleMood&apos;s AI provider (Google Gemini) for this request. It&apos;s used
                only for clothing and style context — never to judge my appearance or infer personal traits.
              </span>
            </label>
            {consentError && <p id="consent-error" className="text-[0.8rem] text-danger">{consentError}</p>}
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center rounded-[1.5rem] border-2 border-dashed px-6 py-10 text-center transition-colors",
            dragging ? "border-foreground bg-muted" : "border-border bg-surface",
          )}
        >
          <span className="grid size-14 place-items-center rounded-full bg-muted">
            <ImageUp aria-hidden className="size-6" />
          </span>
          <p className="mt-4 font-medium">Drag a photo here</p>
          <p className="mt-1 text-sm text-muted-foreground">JPG, PNG or WEBP · up to 5 MB</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
              <ImageUp aria-hidden /> Choose photo
            </Button>
            <Button type="button" variant="outline" className="sm:hidden" onClick={() => cameraRef.current?.click()}>
              <Camera aria-hidden /> Take photo
            </Button>
          </div>
        </div>
      )}

      {photo.status === "error" && <Alert variant="error">{photo.message}</Alert>}

      <div className="rounded-2xl bg-muted p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Your privacy</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Photos are optional — you&apos;ll get great looks without one.</li>
          <li>Stored privately in your account; only you can view them. Hidden location data is stripped.</li>
          <li>Sent to our AI provider only if you tick the consent box, and only for this request.</li>
          <li>Delete them any time. See our <a href="/privacy" target="_blank" className="underline underline-offset-4">privacy notice</a>.</li>
        </ul>
      </div>
    </div>
  );
}
