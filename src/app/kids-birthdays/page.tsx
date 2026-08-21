import type React from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Kids Birthdays at PRO's Cafe",
  description:
    "Celebrate your child's birthday at PRO's Cafe with buffet packages, a kids area, Sunday animation, and a fun party atmosphere.",
};

const packages = [
  {
    name: "Happy Bites",
    price: "12",
    items: [
      "Chicken Caesar Salad",
      "Greek Salad",
      "Chicken Nuggets",
      "Chicken Tenders",
      "Mini Pizza",
      "Mini Chicken Sandwich",
      "French Fries",
      "Juice, Soft Drinks & Water",
    ],
  },
  {
    name: "Super Party",
    price: "15",
    featured: true,
    items: [
      "Chicken Caesar Salad",
      "Greek Salad",
      "Mini Burgers",
      "Chicken Nuggets",
      "Chicken Tenders",
      "Mini Pizza",
      "Mini Chicken Sandwiches",
      "French Fries",
      "Juice, Soft Drinks & Water",
    ],
  },
  {
    name: "Mega Birthday",
    price: "19",
    items: [
      "Chicken Caesar Salad",
      "Greek Salad",
      "Penne Pasta",
      "Chicken Nuggets",
      "Chicken Tenders",
      "Mini Pizza",
      "Mini Burgers",
      "Mini Chicken Sandwiches",
      "French Fries",
      "Juice, Soft Drinks & Water",
    ],
  },
];

export default function KidsBirthdaysPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#eef9ff] text-[#2330c9]">
      <style>{`
        @keyframes kidsBirthdayConfettiSplash {
          0% {
            transform:
              translate3d(-50%, -50%, 0)
              rotate(var(--start-rotate))
              scale(0.25);
            opacity: 0;
          }

          8% {
            opacity: 1;
          }

          58% {
            transform:
              translate3d(
                calc(-50% + (var(--burst-x) * 0.78)),
                calc(-50% + (var(--burst-y) * 0.78)),
                0
              )
              rotate(calc(var(--start-rotate) + 360deg))
              scale(1);
            opacity: 1;
          }

          100% {
            transform:
              translate3d(
                calc(-50% + var(--burst-x)),
                calc(-50% + var(--burst-y) + var(--drop)),
                0
              )
              rotate(calc(var(--start-rotate) + 720deg))
              scale(0.92);
            opacity: 0;
          }
        }

        .kids-birthday-confetti-splash {
          position: fixed;
          left: 50%;
          top: 22%;
          z-index: 9999;
          width: var(--width);
          height: var(--height);
          border-radius: var(--radius);
          background: var(--confetti-color);
          pointer-events: none;
          opacity: 0;
          transform-origin: center;
          box-shadow: 0 1px 1px rgba(0,0,0,0.06);
          animation:
            kidsBirthdayConfettiSplash var(--duration)
            cubic-bezier(0.15, 0.78, 0.26, 1)
            var(--delay)
            1 both;
        }

        @media (min-width: 640px) {
          .kids-birthday-confetti-splash {
            top: 20%;
          }
        }
      `}</style>

      {/* CONFETTI */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      >
        {Array.from({ length: 190 }, (_, index) => {
          const colors = [
            "#ffd45a",
            "#ffffff",
            "#04a9ee",
            "#7168e8",
            "#ff9717",
            "#ff4d67",
            "#2f39d8",
          ];

          const angle = index * 137.508 * (Math.PI / 180);
          const ring = 0.44 + (index % 13) / 18;
          const horizontal = 42 + ((index * 17) % 54);
          const vertical = 26 + ((index * 23) % 50);

          const burstX = Math.cos(angle) * horizontal * ring;
          const burstY = Math.sin(angle) * vertical * ring;

          const width = 4 + ((index * 11) % 8);

          const height =
            index % 4 === 0
              ? width
              : Math.max(
                  2,
                  Math.round(
                    width * (0.28 + (index % 3) * 0.12),
                  ),
                );

          const delay = ((index * 19) % 420) / 1000;
          const duration = 3.4 + ((index * 29) % 12) / 10;
          const startRotate = (index * 47) % 360;
          const drop = 8 + ((index * 31) % 18);

          const radius =
            index % 9 === 0
              ? "999px"
              : index % 4 === 0
                ? "2px"
                : "1px";

          return (
            <span
              key={index}
              className="kids-birthday-confetti-splash"
              style={
                {
                  "--width": `${width}px`,
                  "--height": `${height}px`,
                  "--radius": radius,
                  "--delay": `${delay}s`,
                  "--duration": `${duration}s`,
                  "--burst-x": `${burstX}vw`,
                  "--burst-y": `${burstY}vh`,
                  "--drop": `${drop}vh`,
                  "--start-rotate": `${startRotate}deg`,
                  "--confetti-color":
                    colors[index % colors.length],
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* HERO */}
      <section className="relative isolate min-h-[760px] overflow-hidden px-5 pb-14 pt-6 sm:min-h-[820px] sm:px-8 lg:min-h-[900px] lg:px-12 lg:pb-24 lg:pt-8">
        <video
          className="absolute inset-0 -z-30 h-full w-full object-cover"
          src="/kids-birthdays/bdayhero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[#172554]/52"
        />

        {/* LOGO */}
        <div className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-start">
          <Link
            href="/"
            aria-label="Back to PRO's Cafe"
            className="inline-flex"
          >
            <Image
              src="/kids-birthdays/pros-logo.png"
              alt="PRO's Cafe & Sports Lounge"
              width={150}
              height={100}
              priority
              className="h-auto w-[62px] object-contain sm:w-[70px] lg:w-[76px]"
            />
          </Link>
        </div>

        {/* HERO CONTENT */}
        <div className="relative z-20 mx-auto mt-24 max-w-4xl text-center sm:mt-20">
          <div className="mx-auto mb-5 text-[13px] font-black uppercase tracking-[0.2em] text-[#ffbb24] sm:text-[14px]">
            Kids Birthdays
          </div>

          <h1 className="font-raleway text-[52px] font-black uppercase leading-[0.84] tracking-[-0.055em] text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.26)] sm:text-[76px] lg:text-[102px]">
            Come
            <span className="block text-[#ffbb24]">Party</span>
            <span className="block">With Us</span>
          </h1>

          <p className="mx-auto mt-7 max-w-[560px] text-[16px] font-bold leading-7 text-white sm:text-[18px]">
            Big smiles, easy planning, great food.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="https://wa.me/9613720277"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-13 items-center justify-center rounded-full bg-[#ffbb24] px-7 py-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#2330c9] shadow-[0_16px_40px_rgba(0,0,0,0.20)] transition hover:-translate-y-0.5 hover:bg-[#ffc83f]"
            >
              Book Your Birthday
            </a>

            <a
              href="#packages"
              className="inline-flex h-13 items-center justify-center rounded-full border-2 border-[#2330c9]/15 bg-white/80 px-7 py-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#2330c9] backdrop-blur transition hover:bg-white"
            >
              View Packages
            </a>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-5 py-12 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-9 max-w-2xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff9d13]">
              Book your birthday with us
            </p>

            <h2 className="mt-3 text-[34px] font-black leading-[0.98] tracking-[-0.04em] text-[#2330c9] sm:text-[46px]">
              More fun.
              <span className="block">Less planning.</span>
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <article className="rounded-[30px] bg-white p-4 shadow-[0_18px_60px_rgba(38,78,120,0.09)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
                <Image
                  src="/kids-birthdays/kids-area.png"
                  alt="Kids playing in the PRO's Cafe kids area"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="px-2 pb-3 pt-5">
                <div className="inline-flex rounded-full bg-[#ffd45a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#2330c9]">
                  Always Free
                </div>

                <h3 className="mt-3 text-[25px] font-black uppercase text-[#2330c9]">
                  Kids Playground
                </h3>

                <p className="mt-2 text-sm font-semibold leading-6 text-[#28436a]/65">
                  A fun space for kids to play while everyone enjoys the
                  celebration.
                </p>
              </div>
            </article>

            <article className="rounded-[30px] bg-[#2330c9] p-4 text-white shadow-[0_22px_70px_rgba(35,48,201,0.22)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
                <Image
                  src="/kids-birthdays/birthday-table.png"
                  alt="Birthday table setup at PRO's Cafe"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="px-2 pb-3 pt-5">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#ffd45a]">
                  Your Celebration
                </div>

                <h3 className="mt-1 text-[25px] font-black uppercase">
                  Ready to Party
                </h3>

                <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
                  We set the scene for cake, food, photos, and birthday
                  memories.
                </p>
              </div>
            </article>

            <article className="rounded-[30px] bg-white p-4 shadow-[0_18px_60px_rgba(38,78,120,0.09)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
                <Image
                  src="/kids-birthdays/animation.png"
                  alt="Kids animation character at PRO's Cafe"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="px-2 pb-3 pt-5">
                <div className="inline-flex rounded-full bg-[#ffd45a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#2330c9]">
                  Free on Sundays
                </div>

                <h3 className="mt-3 text-[25px] font-black uppercase text-[#2330c9]">
                  Kids Animation
                </h3>

                <p className="mt-2 text-sm font-semibold leading-6 text-[#28436a]/65">
                  Book a Sunday birthday and enjoy free kids entertainment.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section
        id="packages"
        className="relative overflow-hidden bg-[#2330c9] px-5 py-14 text-white sm:px-8 lg:px-12 lg:py-20"
      >
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-[#05a9ee]/25 blur-2xl"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[#ffbb24]/20 blur-2xl"
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd45a]">
                Pick your package
              </p>

              <h2 className="mt-2 text-[38px] font-black tracking-[-0.045em] sm:text-[52px]">
                Birthday Buffet
              </h2>
            </div>

            <p className="max-w-[420px] text-sm font-semibold leading-6 text-white/65">
              Choose the package that fits your celebration. Food and drinks
              included.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {packages.map((item) => (
              <article
                key={item.name}
                className={`relative rounded-[30px] p-6 ${
                  item.featured
                    ? "bg-[#ffd45a] text-[#2330c9] shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
                    : "border border-white/12 bg-white/8 text-white backdrop-blur"
                }`}
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-[24px] font-black">
                    {item.name}
                  </h3>

                  {item.featured ? (
                    <div className="shrink-0 rounded-full bg-[#2330c9] px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                      Popular
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-[48px] font-black leading-none tracking-[-0.05em]">
                    {item.price}
                  </span>

                  <span className="pb-1 text-[12px] font-black uppercase tracking-[0.12em] opacity-65">
                    USD / PRS
                  </span>
                </div>

                <div className="my-5 h-px bg-current opacity-15" />

                <ul className="space-y-2.5">
                  {item.items.map((food) => (
                    <li
                      key={food}
                      className="flex gap-3 text-[13px] font-bold leading-5 opacity-82"
                    >
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                      <span>{food}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[34px] bg-white p-5 shadow-[0_22px_80px_rgba(38,78,120,0.10)] sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[26px]">
            <Image
              src="/kids-birthdays/family-party.png"
              alt="Family birthday celebration at PRO's Cafe"
              fill
              className="object-cover"
            />
          </div>

          <div className="lg:px-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff9d13]">
              WHOA! IT&apos;S YOUR BIRTHDAY
            </p>

            <h2 className="mt-3 text-[39px] font-black leading-[0.98] tracking-[-0.05em] text-[#2330c9] sm:text-[52px]">
              Celebrate your way.
            </h2>

            <p className="mt-5 max-w-[520px] text-[15px] font-semibold leading-7 text-[#28436a]/68">
              Bring the cake, invite your crew, and we&apos;ll handle the food,
              fun, and party setup.
            </p>

            <div className="mt-7">
              <a
                href="tel:+9613720277"
                className="block rounded-[20px] bg-[#eef9ff] px-5 py-4"
              >
                <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-[#2330c9]/45">
                  Call Us
                </span>

                <span className="mt-1 block text-[20px] font-black text-[#2330c9]">
                  03 72 02 77
                </span>
              </a>
            </div>

            <a
              href="https://wa.me/9613720277"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#ffbb24] px-7 py-4 text-[12px] font-black uppercase tracking-[0.08em] text-[#2330c9] transition hover:bg-[#ffc83f] sm:w-auto"
            >
              Plan Your Party
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 pb-8 text-center sm:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#2330c9]/40">
          Powered by{" "}
          <a
            href="https://wissamdesigns.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            wissamdesigns.com
          </a>
        </p>
      </footer>
    </main>
  );
}