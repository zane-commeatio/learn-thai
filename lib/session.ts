import { jwtVerify, SignJWT } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";

type AdminSessionPayload = {
  role: "admin";
  email: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSessionSecret(): Uint8Array {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value) {
    throw new Error("SESSION_SECRET is required");
  }

  return new TextEncoder().encode(value);
}

export async function createAdminSession(email: string): Promise<string> {
  return new SignJWT({ role: "admin", email } satisfies AdminSessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifyAdminSession(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    if (payload.role !== "admin" || typeof payload.email !== "string") {
      return null;
    }

    return {
      role: "admin",
      email: payload.email,
    };
  } catch {
    return null;
  }
}
