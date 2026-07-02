import { NextResponse, type NextRequest } from "next/server";
const ADMIN_SESSION_COOKIE = "ai_radar_admin_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has(ADMIN_SESSION_COOKIE)) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
