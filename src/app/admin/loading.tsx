export default function AdminLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#586256] px-6 font-raleway text-white">
      <div className="text-center">
        <img
          src="/pros-logo-basic.png"
          alt="PRO's Cafe"
          className="mx-auto h-16 w-auto object-contain opacity-90"
        />

        <div className="mt-6 text-[12px] font-black uppercase tracking-[0.34em] text-white/72">
          Loading
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffd66b]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffd66b] [animation-delay:160ms]" />
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#ffd66b] [animation-delay:320ms]" />
        </div>
      </div>
    </main>
  );
}
