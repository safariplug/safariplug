export default function Loading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="h-8 w-8 rounded-full border-2 border-white/15 border-t-white/80 animate-spin"
        />
        <span className="text-[10px] uppercase tracking-[0.35em] text-white/45">
          SafariPlug
        </span>
      </div>
    </div>
  );
}
