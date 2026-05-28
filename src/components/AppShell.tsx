"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { useRouter } from "next/navigation";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  roleLabel?: string;
  role?: string;
  onSignOut?: () => void;
  pageBackground?: string;
  headerBackground?: string;
  logoSrc?: string;
  logoAlt?: string;
};

const PAGE_GREEN = "#dce1d8";

export function AppShell({
  children,
  title,
  roleLabel,
  role,
  onSignOut,
  pageBackground = PAGE_GREEN,
  headerBackground = PAGE_GREEN,
  logoSrc = "/pros-logo-basic.png",
  logoAlt = "Logo",
}: AppShellProps) {
  const router = useRouter();

  function handleProfileClick() {
    router.push("/profile");
  }

  return (
    <div className="min-h-screen" style={{ background: pageBackground }}>
      <header
        className="sticky top-0 z-20 shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        style={{ background: headerBackground }}
      >
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-12 shrink-0">
              <Image
                src={logoSrc}
                alt={logoAlt}
                fill
                className="object-contain"
                priority
              />
            </div>

            {(title || roleLabel) ? (
              <div>
                {title ? (
                  <h1 className="text-[13px] font-black uppercase tracking-[0.02em] text-[#1d2a33]">
                    {title}
                  </h1>
                ) : null}

                {roleLabel || role ? (
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#5d5d5d]">
                    {roleLabel || role}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleProfileClick}
            aria-label="Open profile settings"
            className="relative h-9 w-9 overflow-hidden rounded-full bg-white/70 transition hover:scale-[1.03]"
          >
            <Image
              src="/profile-icon.png"
              alt="Profile"
              fill
              className="object-cover"
            />
          </button>

          <button type="button" onClick={onSignOut} className="hidden">
            Sign out
          </button>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
