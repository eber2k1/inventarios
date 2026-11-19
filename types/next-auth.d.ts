import "next-auth";
import "next-auth/jwt";

type Proveedor = "github" | "credentials";
type Rol = "SUPER_USUARIO" | "USUARIO";

// Usuario de GitHub (login) o de correo y contraseña (rol) en la sesión y en el token
declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      login?: string;
      rol?: Rol;
      proveedor?: Proveedor;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    login?: string;
    proveedor?: Proveedor;
    usuarioId?: string;
    rol?: Rol;
  }
}
