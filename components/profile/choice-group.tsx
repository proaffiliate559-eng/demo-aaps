"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Choice = { value: string; label: string; hint?: string };

/**
 * Chip/card picker built on native radio/checkbox inputs
 * (keyboard + screen-reader accessible by default).
 */
export function ChoiceGroup({
  name,
  legend,
  description,
  options,
  value,
  onChange,
  multiple = false,
  error,
  variant = "chip",
  swatches = false,
  columns,
}: {
  name: string;
  legend: string;
  description?: string;
  options: readonly Choice[];
  value: string | string[] | null;
  onChange: (v: string | string[] | null) => void;
  multiple?: boolean;
  error?: string;
  variant?: "chip" | "card";
  swatches?: boolean;
  columns?: string;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  const errorId = error ? `${name}-error` : undefined;

  function toggle(v: string) {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      onChange(options.map((o) => o.value).filter((o) => next.has(o)));
    } else {
      onChange(v);
    }
  }

  return (
    <fieldset aria-describedby={errorId} aria-invalid={error ? true : undefined}>
      <legend className="text-sm font-medium">{legend}</legend>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div
        className={cn(
          "mt-3",
          variant === "chip" ? "flex flex-wrap gap-2" : cn("grid gap-3", columns ?? "grid-cols-2 sm:grid-cols-3"),
        )}
      >
        {options.map((o) => {
          const checked = selected.has(o.value);
          const id = `${name}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "relative cursor-pointer select-none border transition-all duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                variant === "chip"
                  ? "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm"
                  : "flex min-h-16 flex-col justify-center rounded-2xl px-4 py-3.5 text-[0.95rem]",
                checked
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface hover:border-foreground/40",
              )}
            >
              <input
                id={id}
                type={multiple ? "checkbox" : "radio"}
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => toggle(o.value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                {swatches && o.hint && (
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full border border-black/10"
                    style={{ background: o.hint }}
                  />
                )}
                {o.label}
                {checked && variant === "chip" && <Check aria-hidden className="size-3.5" />}
              </span>
              {variant === "card" && o.hint && !swatches && (
                <span className={cn("mt-0.5 text-xs", checked ? "text-background/70" : "text-muted-foreground")}>
                  {o.hint}
                </span>
              )}
              {variant === "card" && checked && (
                <Check aria-hidden className="absolute right-3 top-3 size-4" />
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-[0.8rem] text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
