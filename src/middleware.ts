import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const url = request.nextUrl.clone();

  if (host === "admin.proscafe.net") {
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
