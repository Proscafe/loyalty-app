export default function Loading() {
  return (
    <main
      className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#24372b] text-white"
      style={{ fontFamily: "Raleway, RalewayLocal, Arial, sans-serif" }}
    >
      <div className="text-center">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#ffd66b]">
          Back Office
        </div>
        <div className="mt-2 text-[28px] font-black uppercase">Loading BO</div>
      </div>
    </main>
  );
}
