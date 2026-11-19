// Qué puede ver cada rol. Lo usan el proxy (rutas y API) y el menú del panel. Sin Prisma ni APIs de servidor.
//
// SUPER_USUARIO: toda la aplicación.
// USUARIO:       solo el módulo de productos (página, su API y la firma de subida de imágenes).

export type Rol = "SUPER_USUARIO" | "USUARIO";

// Ante un valor desconocido o ausente (p. ej. una sesión antigua) se aplica el rol con menos permisos
export function normalizarRol(rol: unknown): Rol {
  return rol === "SUPER_USUARIO" ? "SUPER_USUARIO" : "USUARIO";
}

const RUTAS_USUARIO = ["/admin/productos", "/api/productos", "/api/cloudinary/firma"];

const dentroDe = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

export function puedeVerRuta(rol: Rol, pathname: string) {
  if (rol === "SUPER_USUARIO") return true;
  return RUTAS_USUARIO.some((base) => dentroDe(pathname, base));
}

// Página a la que entra cada rol después de iniciar sesión (o si pide una que no puede ver)
export function rutaInicio(rol: Rol) {
  return rol === "SUPER_USUARIO" ? "/admin/dashboard" : "/admin/productos";
}
