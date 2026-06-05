import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://www.proscafe.net";

function publicUrlFor(pathname: string, search: string) {
  return `${PUBLIC_SITE_URL.replace(/\/$/, "")}${pathname}${search}`;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const url = request.nextUrl.clone();

  const isAdminHost =
    host === "admin.proscafe.net" ||
    host === "admin.rposcafe.net";

  if (isAdminHost) {
    // Old QR codes or copied links may still point to the admin subdomain.
    // Prediction links must always open on the public client website.
    if (url.pathname.startsWith("/predict")) {
      return NextResponse.redirect(publicUrlFor(url.pathname, url.search));
    }

    if (url.pathname === "/") {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }

    if (
      !url.pathname.startsWith("/admin") &&
      !url.pathname.startsWith("/login") &&
      !url.pathname.startsWith("/_next") &&
      !url.pathname.startsWith("/api") &&
      !url.pathname.includes(".")
    ) {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
