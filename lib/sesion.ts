import type { JWT } from "next-auth/jwt";

// Reglas de acceso compartidas por NextAuth (lib/auth.ts) y el proxy. Sin Prisma: el proxy corre en cada petición.

// Solo estos usuarios de GitHub pueden entrar (el panel emite comprobantes reales en SUNAT)
export function usuariosPermitidos() {
  return (process.env.GITHUB_USUARIOS_PERMITIDOS ?? "")
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);
}

export function esUsuarioPermitido(login: unknown) {
  return typeof login === "string" && usuariosPermitidos().includes(login.toLowerCase());
}

// ¿La sesión de NextAuth da acceso al panel?
// - GitHub: el usuario debe seguir en GITHUB_USUARIOS_PERMITIDOS
// - Correo y contraseña: el usuario ya se validó contra la tabla users al iniciar sesión
export function sesionPermitida(token: JWT | null): token is JWT {
  if (!token) return false;
  if (token.proveedor === "credentials") return typeof token.usuarioId === "string" && typeof token.email === "string";
  return esUsuarioPermitido(token.login);
}

// Identificador del usuario que va en el JWT propio (access_token): login de GitHub o correo
export function identificadorSesion(token: JWT) {
  return token.proveedor === "credentials" ? String(token.email) : String(token.login);
}
