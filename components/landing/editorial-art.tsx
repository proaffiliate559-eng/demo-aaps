import { cn } from "@/lib/utils";

/**
 * Decorative editorial panel used where real fashion photography is not yet
 * available. Swap for <Image> with licensed photos without changing layouts.
 */
const GARMENTS = {
  tee: "M30 20 L42 14 Q50 21 58 14 L70 20 L84 34 L74 44 L68 38 L68 100 L32 100 L32 38 L26 44 L16 34 Z",
  dress: "M41 12 L45 12 Q50 19 55 12 L59 12 L62 36 Q57 42 60 48 L82 106 L18 106 L40 48 Q43 42 38 36 Z",
  trousers: "M31 12 L69 12 L73 106 L54 106 L50 44 L46 106 L27 106 Z M31 20 L69 20",
  kurta: "M36 14 L44 12 Q50 22 56 12 L64 14 L80 30 L76 62 L68 56 L70 108 L30 108 L32 56 L24 62 L20 30 Z M50 20 L50 44",
  jacket:
    "M34 14 L44 11 L50 34 L56 11 L66 14 L82 28 L86 96 L74 96 L72 46 L70 104 L30 104 L28 46 L26 96 L14 96 L18 28 Z M50 34 L50 104",
  bag: "M34 44 Q34 24 50 24 Q66 24 66 44 M20 44 L80 44 L85 100 L15 100 Z",
  sneaker: "M12 74 L19 50 L33 52 Q43 62 58 60 L82 66 Q92 70 90 80 L12 80 Z M12 74 L90 74 M36 56 L40 64 M44 60 L46 66",
} as const;

const TONES = {
  sand: "from-[#e9dfd1] via-[#ddcdb7] to-[#c8b293] text-[#5a4a37]",
  ink: "from-[#2a2622] via-[#1d1a17] to-[#121110] text-[#e9dfd1]",
  blush: "from-[#f3e6e0] via-[#ead3c9] to-[#d9b8aa] text-[#6b4638]",
  sage: "from-[#e6e9df] via-[#d3d9c6] to-[#b6c0a3] text-[#47513a]",
  ivory: "from-[#fbf9f5] via-[#f2ede4] to-[#e6dfd3] text-[#6b645c]",
} as const;

export type GarmentKind = keyof typeof GARMENTS;
export type Tone = keyof typeof TONES;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E\")";

export function EditorialArt({
  garment,
  tone = "sand",
  className,
  children,
}: {
  garment: GarmentKind;
  tone?: Tone;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={cn("relative isolate overflow-hidden rounded-[1.5rem] bg-gradient-to-br", TONES[tone], className)}
    >
      <div className="absolute inset-0 -z-10 opacity-[0.18] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      <div className="absolute -right-10 -top-10 -z-10 size-48 rounded-full bg-white/25 blur-2xl" />
      <svg
        viewBox="0 0 100 120"
        aria-hidden
        className="absolute inset-0 m-auto h-[68%] w-[68%] drop-shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
      >
        <path
          d={GARMENTS[garment]}
          fill="currentColor"
          fillOpacity="0.08"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {children}
    </div>
  );
}
