import Image from "next/image";
import { CommentCardForm } from "./CommentCardForm";

export const dynamic = "force-dynamic";

export default function CommentCardPage() {
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

            <h1 className="font-raleway text-[35px] font-black uppercase leading-[0.95] tracking-[-0.035em] text-white">
              Comment
              <br />
              <span className="text-[#ffd66b]">Card</span>
            </h1>

            <p className="mt-5 max-w-[330px] text-[16px] font-bold leading-7 text-white">
              Tell us how we did.
            </p>
          </div>

          <CommentCardForm />
        </div>
      </section>
    </main>
  );
}
