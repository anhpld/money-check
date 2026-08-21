import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminSessionValid } from "@/lib/admin-auth";

function publicUrl(request: NextRequest, path: string) {
  const configuredOrigin = process.env.APP_URL?.trim();
  if (configuredOrigin) return new URL(path, configuredOrigin);

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`);
}

function externalRedirect(request: NextRequest, location: string) {
  return NextResponse.redirect(publicUrl(request, location), 307);
}

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
    return externalRedirect(request, "/client");
  }

  if (pathname === "/collections" || pathname.startsWith("/collections/")) {
    return externalRedirect(request, `/admin${pathname}${search}`);
  }

  if (pathname === "/transactions" || pathname.startsWith("/transactions/")) {
    return externalRedirect(request, `/admin${pathname}${search}`);
  }

  if (pathname === "/login" && authenticated) {
    return externalRedirect(request, "/admin");
  }

  if (isPublicPath(pathname)) return NextResponse.next();

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Chưa đăng nhập." }, { status: 401 });
    }
    const searchParams = new URLSearchParams();
    if (request.method === "GET" || request.method === "HEAD") searchParams.set("next", `${pathname}${search}`);
    const query = searchParams.toString();
    return externalRedirect(request, query ? `/login?${query}` : "/login");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
