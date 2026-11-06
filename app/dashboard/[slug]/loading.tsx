export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-line" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl2 bg-white" />)}
      </div>
      <div className="h-64 animate-pulse rounded-xl2 bg-white" />
    </div>
  );
}
