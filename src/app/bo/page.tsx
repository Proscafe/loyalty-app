import Image from "next/image";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { BOLoginForm } from "./BOLoginForm";

export const dynamic = "force-dynamic";

export default async function BOLoginPage() {
  const profile = await getCurrentProfile();

  if (profile?.role === "master_admin") {
    redirect("/bo/home");
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#1f2f25] text-white"
      style={{ fontFamily: "Raleway, RalewayLocal, Arial, sans-serif" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 10%, rgba(255,214,107,0.18), transparent 34%), linear-gradient(155deg, #405845 0%, #2f4435 48%, #1f3026 100%)",
        }}
      />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[360px] rounded-[28px] border border-white/15 bg-white/10 px-6 py-8 shadow-[0_28px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl">
          <div className="mb-7 flex flex-col items-center text-center">
            <Image
              src="/pros-logo-white.png"
              alt="PRO's Café & Sports Lounge"
              width={150}
              height={90}
              priority
              className="mb-6 h-auto w-[120px] object-contain"
            />

            <div className="text-[12px] font-black uppercase tracking-[0.28em] text-[#ffd66b]">
              Back Office
            </div>

            <h1 className="mt-2 text-[42px] font-black uppercase leading-none tracking-[-0.04em] text-white">
              BO
            </h1>

            <p className="mt-3 text-[13px] font-semibold leading-5 text-white/65">
              Admin access only
            </p>
          </div>

          <BOLoginForm />
        </div>
      </section>
    </main>
  );
}
