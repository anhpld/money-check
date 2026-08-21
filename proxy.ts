import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionValid } from "@/lib/admin-auth";

function isPublicPath(pathname: string) {
  return pathname === "/login"
    || pathname === "/client"
    || pathname.startsWith("/client/")
    || pathname === "/api/auth/login"
    || pathname === "/api/auth/logout"
    || pathname === "/api/webhooks/payments"
    || pathname.startsWith("/api/payments/");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = isAdminSessionValid(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/client", request.url));
  }

  if (pathname === "/collections" || pathname.startsWith("/collections/")) {
    return NextResponse.redirect(new URL(`/admin${pathname}${search}`, request.url));
  }

  if (pathname === "/transactions" || pathname.startsWith("/transactions/")) {
    return NextResponse.redirect(new URL(`/admin${pathname}${search}`, request.url));
  }

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Chưa đăng nhập." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    if (request.method === "GET" || request.method === "HEAD") loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
