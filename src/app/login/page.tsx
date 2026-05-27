import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const profile = await getCurrentProfile();

  if (profile) {
    if (profile.role === "master_admin") redirect("/admin");
    if (profile.role === "staff") redirect("/staff");
    redirect("/dashboard");
  }

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#111827] text-[#18212b]"
      style={{ fontFamily: "Raleway, RalewayLocal, Arial, sans-serif" }}
    >
      <Image
        src="/pros-login-bg.jpg"
        alt="PRO's Café & Sports Lounge"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/25" />

      <section className="relative z-10 flex min-h-screen items-center justify-center px-7 py-8 sm:px-8">
        <div className="w-full max-w-[315px] rounded-[24px] bg-white/95 px-5 py-7 shadow-2xl shadow-black/30 backdrop-blur-sm sm:max-w-[340px] sm:px-7 sm:py-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/pros-logo-basic.png"
              alt="PRO's Café & Sports Lounge logo"
              width={132}
              height={88}
              priority
              className="mb-7 h-auto w-[112px] object-contain sm:w-[122px]"
            />

            <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.46em] text-[#c85b58]">
              Loyalty Program
            </p>

            <h1 className="text-center uppercase leading-[0.96] tracking-[0.03em]">
              <span className="block text-[30px] font-normal text-[#18212b] sm:text-[34px]">
                Join the
              </span>
              <span className="block text-[30px] font-black tracking-[0.02em] text-[#c85b58] sm:text-[34px]">
                PRO&apos;S CLUB
              </span>
            </h1>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
