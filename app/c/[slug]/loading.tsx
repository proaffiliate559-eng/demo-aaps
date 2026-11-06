export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-line" />
      <div className="h-48 animate-pulse rounded-[24px] bg-brand/60" />
      <div className="h-64 animate-pulse rounded-xl2 bg-white" />
    </div>
  );
}
