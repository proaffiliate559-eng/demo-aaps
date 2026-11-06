import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  className,
  align = "left",
  id,
}: {
  eyebrow: string;
  title: string;
  className?: string;
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-4 font-display text-4xl leading-[1.05] text-balance sm:text-5xl">
        {title}
      </h2>
    </div>
  );
}
