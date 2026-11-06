import { cn } from "@/lib/utils";
import { scorePassword } from "@/lib/auth/password-strength";

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = password.length < 8 ? 0 : scorePassword(password);
  return (
    <div className="-mt-2 flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 rounded-full bg-border transition-colors",
              score >= i && (score <= 1 ? "bg-danger" : score === 2 ? "bg-sand" : "bg-success"),
            )}
          />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-muted-foreground">{LABELS[score]}</span>
    </div>
  );
}
