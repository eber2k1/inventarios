import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarBienvenida } from "@/lib/correo";
import type { Rol } from "@/lib/permisos";

// Registro en la tabla users de las cuentas que inician sesión con GitHub.
// Se identifican por su id de GitHub (no por el correo, para no unirse a una cuenta de correo y contraseña ajena).
// Una cuenta nueva entra con el rol por defecto (USUARIO) y recibe el correo de bienvenida; el rol de una existente no se cambia aquí.

type DatosGithub = { githubId: string; login: string; nombre?: string | null; email?: string | null };

export async function registrarUsuarioGithub({ githubId, login, nombre, email }: DatosGithub): Promise<{ id: string; email: string; rol: Rol; activo: boolean }> {
  const nombreFinal = (nombre?.trim() || login).slice(0, 200);
  const select = { id: true, email: true, rol: true, activo: true } as const;

  const existente = await prisma.usuario.findUnique({ where: { githubId }, select });
  if (existente) {
    return prisma.usuario.update({ where: { githubId }, data: { nombre: nombreFinal }, select });
  }

  // Correo de GitHub si está libre; si no lo hay o ya lo usa otra cuenta, el correo "noreply" de GitHub
  const correo = email?.trim().toLowerCase();
  const libre = correo && !(await prisma.usuario.findUnique({ where: { email: correo }, select: { id: true } }));
  const emailFinal = libre ? correo : `${githubId}+${login.toLowerCase()}@users.noreply.github.com`;

  const nuevo = await prisma.usuario.create({ data: { githubId, nombre: nombreFinal, email: emailFinal }, select });
  // El correo se envía después de responder, para no retrasar el inicio de sesión; si falla, solo se registra
  after(async () => {
    const r = await enviarBienvenida({ nombre: nombreFinal, email: nuevo.email, metodo: "github", idUsuario: nuevo.id });
    if (!r.ok) console.warn(`[correo] bienvenida a la cuenta ${nuevo.id} no enviada: ${r.error}`);
  });
  return nuevo;
}

// Datos actuales de la cuenta (para guardarlos en el token al iniciar sesión)
export function buscarUsuarioGithub(githubId: string) {
  return prisma.usuario.findUnique({ where: { githubId }, select: { id: true, email: true, rol: true, activo: true } });
}
