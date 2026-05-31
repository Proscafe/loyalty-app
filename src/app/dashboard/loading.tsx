export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#c98b84] px-6 font-raleway text-white">
      <div className="relative flex h-[calc(100vh-52px)] w-full max-w-[414px] items-center justify-center border-[8px] border-[#ffd66b]">
        <div className="text-center">
          <h1 className="text-[24px] font-black uppercase tracking-[-0.03em] text-white">
            LOADING
          </h1>

          <div className="mt-2 flex items-center justify-center gap-4">
            <span className="inline-block text-[42px] leading-none text-[#365665] opacity-25 [animation:prosStarFade_0.75s_linear_infinite]">
              ★
            </span>
            <span className="inline-block text-[42px] leading-none text-[#ffd66b] opacity-25 [animation:prosStarFade_0.75s_linear_infinite] [animation-delay:0.25s]">
              ★
            </span>
            <span className="inline-block text-[42px] leading-none text-[#1f3b48] opacity-25 [animation:prosStarFade_0.75s_linear_infinite] [animation-delay:0.5s]">
              ★
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
