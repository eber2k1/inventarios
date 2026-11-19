import { NextResponse, type NextRequest } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { identificadorSesion, sesionPermitida } from "@/lib/sesion";
import { normalizarRol, puedeVerRuta, rutaInicio, type Rol } from "@/lib/permisos";
import { COOKIE_ACCESS_TOKEN, firmarAccessToken, jwtConfigurado, opcionesCookie, verificarAccessToken } from "@/lib/jwt";

// Protege el panel y la API con la sesión de NextAuth (cookie JWE de NextAuth):
// - /admin/*      sin sesión → al login ("/"), recordando a dónde quería ir
// - /api/*        sin sesión → 401 JSON (excepto /api/auth/* y /api/health)
// - "/" (login)   con sesión → a la página de inicio de su rol
// Permisos por rol (lib/permisos.ts): SUPER_USUARIO ve todo; USUARIO solo el módulo de productos.
// - /admin/* sin permiso → a la página de inicio de su rol
// - /api/*   sin permiso → 403 JSON
// Sesión con GitHub: el usuario se vuelve a comprobar contra GITHUB_USUARIOS_PERMITIDOS en cada petición
// (si se le quita de la lista, pierde el acceso aunque su sesión siga vigente).
// Sesión con correo y contraseña: el usuario se validó contra la tabla users al iniciar sesión.
//
// Además mantiene el JWT propio de la app (HS256) en la cookie httpOnly "access_token":
// - con sesión válida: lo emite si falta, es inválido, venció o es de otro usuario (p. ej. justo después del login con GitHub)
// - sin sesión (logout, vencida, usuario quitado): lo borra. Un access_token solo no da acceso.
let avisoSinSecreto = false;

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sesion = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const autenticado = sesionPermitida(sesion);

  const rol = normalizarRol(sesion?.rol);

  const respuesta = decidir(request, pathname, search, autenticado, rol);
  await sincronizarAccessToken(request, respuesta, autenticado ? sesion : null);
  return respuesta;
}

function decidir(request: NextRequest, pathname: string, search: string, autenticado: boolean, rol: Rol) {
  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/") || pathname === "/api/health") return NextResponse.next();
    if (!autenticado) return NextResponse.json({ ok: false, error: "Inicia sesión para continuar" }, { status: 401 });
    if (!puedeVerRuta(rol, pathname)) {
      return NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return autenticado ? NextResponse.redirect(new URL(rutaInicio(rol), request.url)) : NextResponse.next();
  }

  // /admin/*
  if (autenticado) {
    return puedeVerRuta(rol, pathname) ? NextResponse.next() : NextResponse.redirect(new URL(rutaInicio(rol), request.url));
  }
  const login = new URL("/", request.url);
  login.searchParams.set("callbackUrl", pathname + search);
  return NextResponse.redirect(login);
}

async function sincronizarAccessToken(
  request: NextRequest,
  respuesta: NextResponse,
  sesion: JWT | null,
) {
  const actual = request.cookies.get(COOKIE_ACCESS_TOKEN)?.value;

  if (!sesion) {
    if (actual) respuesta.cookies.delete(COOKIE_ACCESS_TOKEN);
    return;
  }

  if (!jwtConfigurado()) {
    if (!avisoSinSecreto) console.warn("[proxy] JWT_SECRET falta o es corto (mín. 32 caracteres): no se emite access_token");
    avisoSinSecreto = true;
    return;
  }

  const login = identificadorSesion(sesion);
  const vigente = await verificarAccessToken(actual);
  const rol = normalizarRol(sesion.rol);
  // Se reemite si falta, es inválido o no coincide con la sesión actual (usuario o rol)
  if (vigente && vigente.login.toLowerCase() === login.toLowerCase() && vigente.rol === rol) return;

  const token = await firmarAccessToken({
    sub: sesion.usuarioId ?? sesion.sub ?? login,
    login,
    name: sesion.name,
    picture: sesion.picture,
    proveedor: sesion.proveedor ?? "github",
    rol,
  });
  respuesta.cookies.set(COOKIE_ACCESS_TOKEN, token, opcionesCookie());
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/:path*"],
};
