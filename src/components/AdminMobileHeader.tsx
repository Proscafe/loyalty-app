"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";
import Link from "next/link";
import type { Profile } from "@/types";

type AdminMobileHeaderProps = {
  profile?: Pick<Profile, "full_name" | "email"> | null;
  title?: string;
  homeHref?: string;
  profileHref?: string;
  logoSrc?: string;
  className?: string;
};

function shortName(name?: string | null) {
  return (name || "Admin").trim().split(/\s+/)[0] || "Admin";
}

export function AdminMobileHeader({
  profile,
  title = "Pro's Cafe",
  homeHref = "/admin",
  profileHref = "/profile",
  logoSrc = "/pros-logo-basic.png",
  className = "",
}: AdminMobileHeaderProps) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  const profileLabel = shortName(profile?.full_name || profile?.email || "Admin");

  return (
    <header
      className={`mb-5 flex h-[70px] items-center justify-between rounded-[18px] bg-white/10 px-5 shadow-[0_18px_46px_rgba(35,48,39,0.12)] backdrop-blur-2xl lg:hidden ${className}`}
    >
      <Link
        href={homeHref}
        className="flex items-center"
        aria-label="Go to admin overview"
      >
        <img
          src={logoSrc}
          alt="Pro's Cafe"
          className="h-[46px] w-auto object-contain"
          draggable={false}
        />
      </Link>

      <Link
        href={profileHref}
        className="flex h-11 w-11 items-center justify-center text-[#ffd66b] transition hover:scale-105"
        title={profileLabel}
        aria-label="Open profile"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-[32px] w-[29px] fill-current drop-shadow-[0_8px_18px_rgba(255,214,107,0.22)]"
        >
          <path d="M12 12.2a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Zm0 2.1c-4.6 0-8.3 2.4-8.3 5.3 0 .9.7 1.6 1.6 1.6h13.4c.9 0 1.6-.7 1.6-1.6 0-2.9-3.7-5.3-8.3-5.3Z" />
        </svg>
      </Link>
    </header>
  );
}

export default AdminMobileHeader;
