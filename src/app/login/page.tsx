import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#101820] px-4 py-6 sm:px-6 lg:px-8">
      <Image
        src="/pros-login-bg.jpg"
        alt="PRO's Café & Sports Lounge"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-black/45" />

      <section className="relative z-10 flex min-h-[calc(100vh-48px)] items-center justify-center">
        <div className="w-full max-w-[390px] rounded-[28px] bg-white/95 px-5 py-7 shadow-2xl backdrop-blur sm:max-w-[430px] sm:px-8 sm:py-8">
          <div className="mb-5 flex justify-center">
            <Image
              src="/pros-logo-basic.png"
              alt="PRO's Café & Sports Lounge logo"
              width={150}
              height={100}
              priority
              className="h-auto w-36 object-contain sm:w-40"
            />
          </div>

          <div className="mb-6 text-center font-raleway">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.42em] text-brand-red sm:text-[11px]">
              Loyalty Program
            </p>

            <h1 className="text-[30px] uppercase leading-[0.98] tracking-[0.02em] text-[#1f2933] sm:text-[36px]">
              <span className="block font-normal">Join the</span>
              <span className="block font-black text-brand-red">PRO&apos;s Club</span>
            </h1>
          </div>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
