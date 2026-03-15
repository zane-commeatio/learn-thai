import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "./session";

function getAdminCredentials(): { email: string; password: string } {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  return { email, password };
}

export function validateAdminCredentials(email: string, password: string): boolean {
  const configured = getAdminCredentials();
  return email === configured.email && password === configured.password;
}

export async function requireAdminSession(): Promise<void> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) {
    redirect("/login");
  }

  const payload = await verifyAdminSession(token);
  if (!payload) {
    redirect("/login");
  }
}
