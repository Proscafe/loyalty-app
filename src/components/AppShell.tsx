"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  role?: string;
  roleLabel?: string;
  logoSrc?: string;
  logoAlt?: string;
  headerBackground?: string;
  pageBackground?: string;
};

export function AppShell({
  children,
  logoSrc = "/pros-logo-basic.png",
  logoAlt = "PRO's Logo",
  pageBackground = "#ffffff",
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleProfileClick() {
    router.push("/profile");
  }

  function handleLogoClick() {
    if (pathname?.startsWith("/staff")) {
      router.push("/staff");
      return;
    }

    if (pathname?.startsWith("/dashboard")) {
      router.push("/dashboard");
      return;
    }

    router.push("/");
  }

  return (
    <main
      className="min-h-screen"
      style={{
        background: pageBackground,
      }}
    >
      <div className="mx-auto w-full max-w-md px-4 pt-3">
        <header
          className="relative z-20 flex items-center justify-between border border-white/15 px-5 py-2.5 backdrop-blur-xl"
          style={{
            borderRadius: 18,
            background:
              "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.06))",
          }}
        >
          <button
            type="button"
            onClick={handleLogoClick}
            aria-label="Go back"
            className="shrink-0"
          >
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={52}
              height={34}
              priority
              className="h-auto w-[52px] object-contain"
            />
          </button>

          <button
            type="button"
            onClick={handleProfileClick}
            aria-label="Open profile"
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-transparent"
          >
            <Image
              src="/profile-icon.png"
              alt="Profile"
              fill
              className="object-cover"
            />
          </button>
        </header>
      </div>

      {children}
    </main>
  );
}

export default AppShell;
