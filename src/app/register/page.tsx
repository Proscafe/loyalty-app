import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentProfile, homeForRole } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homeForRole(profile.role));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#c98b84] px-7 pt-4 pb-8 text-white sm:px-8">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/pros-register-bg.jpg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[#c98b84]/5" aria-hidden="true" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-[390px] flex-col justify-start pt-2 font-raleway">
        <div className="w-full">
          <div className="mb-6 text-left">
            <Image
              src="/pros-register-star.png"
              alt=""
              width={34}
              height={34}
              priority
              className="mb-5 h-[34px] w-[34px] object-contain"
            />

            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.34em] text-[#ffd66b]">
              
            </p>

            <h1 className="font-raleway text-[35px] font-black uppercase leading-[0.95] tracking-[-0.035em] text-white">
              Join
              <br />
              <span className="text-[#ffd66b]">PRO&apos;s Club</span>
            </h1>

            <p className="mt-5 max-w-[330px] text-[16px] font-bold leading-7 text-white">
              Start collecting stamps &amp; earning rewards.
            </p>
          </div>

          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
