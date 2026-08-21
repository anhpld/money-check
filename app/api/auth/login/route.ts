import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createAdminSession, credentialsAreValid } from "@/lib/admin-auth";

function relativeRedirect(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

function safeDestination(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login")
    ? value
    : "/admin";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const destination = safeDestination(formData.get("next"));

  if (typeof username !== "string" || typeof password !== "string" || !credentialsAreValid(username, password)) {
    const searchParams = new URLSearchParams({ error: "1" });
    if (destination !== "/admin") searchParams.set("next", destination);
    return relativeRedirect(`/login?${searchParams.toString()}`);
  }

  const response = relativeRedirect(destination);
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
