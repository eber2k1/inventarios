import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Rol } from "@/lib/permisos";

// JWT propio de la app (HS256, firmado con JWT_SECRET). Se guarda en la cookie httpOnly "access_token"
// al iniciar sesión con GitHub; lo emite y lo renueva proxy.ts a partir de la sesión de NextAuth.

export const COOKIE_ACCESS_TOKEN = "access_token";
export const DURACION_SEGUNDOS = 12 * 60 * 60; // igual que la sesión de NextAuth
const EMISOR = "inventarios";
const AUDIENCIA = "inventarios-panel";

export type DatosAccessToken = {
  sub: string;
  login: string;
  name?: string | null;
  picture?: string | null;
  proveedor?: "github" | "credentials";
  rol: Rol;
};

export type AccessToken = JWTPayload & DatosAccessToken;

export function jwtConfigurado() {
  return (process.env.JWT_SECRET ?? "").length >= 32;
}

function clave() {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "");
}

export function firmarAccessToken({ sub, login, name, picture, proveedor, rol }: DatosAccessToken) {
  return new SignJWT({ login, name: name ?? null, picture: picture ?? null, proveedor: proveedor ?? "github", rol })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SEGUNDOS}s`)
    .sign(clave());
}

// Devuelve el contenido si la firma, el emisor, la audiencia y la vigencia son correctos; si no, null
export async function verificarAccessToken(token: string | undefined): Promise<AccessToken | null> {
  if (!token || !jwtConfigurado()) return null;
  try {
    const { payload } = await jwtVerify(token, clave(), { algorithms: ["HS256"], issuer: EMISOR, audience: AUDIENCIA });
    return typeof payload.login === "string" && typeof payload.sub === "string" && (payload.rol === "SUPER_USUARIO" || payload.rol === "USUARIO")
      ? (payload as AccessToken)
      : null;
  } catch {
    return null;
  }
}

export function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Igual que NextAuth: cookie Secure cuando la app se sirve por https
    secure: (process.env.NEXTAUTH_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  };
}
