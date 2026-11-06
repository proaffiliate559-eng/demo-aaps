"use client";

import { useState, useTransition } from "react";
import { Check, Heart, ImagePlus, Loader2, Share2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rateOutfit, toggleSaveOutfit } from "@/lib/outfits/actions";
import { cn } from "@/lib/utils";

export function SaveButton({ outfitId, initialSaved, name }: { outfitId: string; initialSaved: boolean; name: string }) {
  const [saved, setSaved] = useState(initialSaved);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div>
      <Button
        type="button"
        variant={saved ? "default" : "outline"}
        size="sm"
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from saved looks` : `Save ${name}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const next = !saved;
            setSaved(next); // optimistic
            const res = await toggleSaveOutfit(outfitId, next);
            if (!res.ok) {
              setSaved(!next);
              setError(res.message);
            }
          })
        }
      >
        <Heart aria-hidden className={cn(saved && "fill-current")} /> {saved ? "Saved" : "Save"}
      </Button>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ShareButton({ text, title }: { text: string; title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={share}>
      {copied ? <Check aria-hidden /> : <Share2 aria-hidden />} {copied ? "Copied" : "Share"}
    </Button>
  );
}

export function RatingControl({ outfitId, initial }: { outfitId: string; initial: number | null }) {
  const [rating, setRating] = useState(initial ?? 0);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Rate this look" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onClick={() =>
              start(async () => {
                const prev = rating;
                setRating(n);
                const res = await rateOutfit({ outfitId, rating: n });
                setStatus(res.ok ? "saved" : "error");
                if (!res.ok) setRating(prev);
              })
            }
            className="cursor-pointer p-1 text-sand transition-transform hover:scale-110"
          >
            <Star aria-hidden className={cn("size-5", (hover || rating) >= n ? "fill-current" : "fill-none text-border")} />
          </button>
        ))}
      </div>
      <span role="status" className="text-xs text-muted-foreground">
        {status === "saved" ? "Thanks for rating!" : status === "error" ? "Couldn't save rating" : rating ? "" : "Rate this look"}
      </span>
    </div>
  );
}

export function InspirationImage({ outfitId, initialUrl, name }: { outfitId: string; initialUrl: string | null; name: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (url) {
    return (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img src={url} alt={`AI inspiration image for ${name}`} className="aspect-[4/5] w-full rounded-2xl object-cover" />
        <figcaption className="mt-2 text-xs text-muted-foreground">
          AI-generated inspiration image of the outfit — not a preview of how it will look on you.
        </figcaption>
      </figure>
    );
  }
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(undefined);
          const res = await fetch("/api/outfit-image", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ outfitId }),
          });
          const json = await res.json().catch(() => null);
          setPending(false);
          if (res.ok && json?.url) setUrl(json.url);
          else setError(json?.error?.message ?? "Couldn't create the image.");
        }}
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />}
        {pending ? "Creating image…" : "Create inspiration image"}
      </Button>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
