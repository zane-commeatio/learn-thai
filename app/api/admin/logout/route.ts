import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "../../../../lib/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 302);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
  return response;
}
