import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'ghost' | 'accent' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:opacity-90',
  ghost: 'bg-white text-ink border border-line hover:bg-ground',
  accent: 'bg-accent text-ink hover:opacity-90',
  danger: 'bg-white text-bad border border-bad/40 hover:bg-red-50',
};

export function Button({
  variant = 'primary', size = 'md', className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-9 px-3 text-sm' : 'h-12 px-5 text-[15px]',
        VARIANT[variant],
        className,
      )}
    />
  );
}

export function LinkButton({ href, children, variant = 'primary', className }: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  return (
    <a href={href} className={cx('inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-semibold', VARIANT[variant], className)}>
      {children}
    </a>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl2 border border-line bg-white', className)}>{children}</div>;
}

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">{children}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx('h-12 w-full rounded-xl border border-line bg-white px-4 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20', props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cx('h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-brand', props.className)}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx('min-h-24 w-full rounded-xl border border-line bg-white p-3 text-base outline-none focus:border-brand', props.className)}
    />
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  const t = {
    neutral: 'bg-ground text-muted',
    good: 'bg-mint text-good',
    warn: 'bg-sand text-warn',
    bad: 'bg-red-50 text-bad',
    brand: 'bg-brand text-white',
  }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', t)}>{children}</span>;
}

export function Alert({ tone = 'bad', children }: { tone?: 'bad' | 'good' | 'warn'; children: ReactNode }) {
  const t = { bad: 'bg-red-50 text-bad', good: 'bg-mint text-good', warn: 'bg-sand text-warn' }[tone];
  return <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('rounded-xl p-3 text-sm font-semibold', t)}>{children}</div>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-line bg-white p-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-3xl font-extrabold">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Card>
  );
}

export { cx };
