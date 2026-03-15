import { NextResponse } from "next/server";
import { createAdminSession, ADMIN_SESSION_COOKIE } from "../../../../lib/session";
import { validateAdminCredentials } from "../../../../lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!validateAdminCredentials(email, password)) {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), 302);
  }

  const token = await createAdminSession(email);
  const response = NextResponse.redirect(new URL("/admin", request.url), 302);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return response;
}
