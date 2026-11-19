import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Inicio de sesión con correo y contraseña contra la tabla users (contraseñas con bcrypt).
// Los usuarios se crean con: npm run db:usuario -- <correo> <contraseña> "<nombre>" [SUPER_USUARIO|USUARIO]

const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
// Hash de relleno: si el correo no existe se compara igual, para no revelar por tiempo qué correos existen
let hashRelleno: Promise<string> | undefined;
const relleno = () => (hashRelleno ??= bcrypt.hash("relleno-sin-usuario", 12));

// Intentos fallidos por correo (en memoria del servidor; se reinicia al reiniciar)
const fallos = new Map<string, { cantidad: number; desde: number }>();

export type UsuarioAutenticado = { id: string; email: string; name: string; rol: "SUPER_USUARIO" | "USUARIO" };

export function normalizarCorreo(correo: unknown) {
  return typeof correo === "string" ? correo.trim().toLowerCase() : "";
}

export function bloqueado(correo: string) {
  const f = fallos.get(correo);
  if (!f) return false;
  if (Date.now() - f.desde > BLOQUEO_MS) {
    fallos.delete(correo);
    return false;
  }
  return f.cantidad >= MAX_FALLOS;
}

function registrarFallo(correo: string) {
  const f = fallos.get(correo);
  if (!f || Date.now() - f.desde > BLOQUEO_MS) fallos.set(correo, { cantidad: 1, desde: Date.now() });
  else f.cantidad++;
}

export async function verificarCredenciales(correoBruto: unknown, contrasena: unknown): Promise<UsuarioAutenticado | null> {
  const correo = normalizarCorreo(correoBruto);
  if (!correo || typeof contrasena !== "string" || !contrasena || contrasena.length > 200) return null;
  if (bloqueado(correo)) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { email: correo },
    select: { id: true, email: true, nombre: true, rol: true, activo: true, passwordHash: true },
  });
  const coincide = await bcrypt.compare(contrasena, usuario?.passwordHash ?? (await relleno()));

  // Las cuentas sin contraseña (creadas con GitHub u otro método) no pueden entrar por esta vía
  if (!usuario || !usuario.activo || !usuario.passwordHash || !coincide) {
    registrarFallo(correo);
    return null;
  }
  fallos.delete(correo);
  return { id: usuario.id, email: usuario.email, name: usuario.nombre, rol: usuario.rol };
}
