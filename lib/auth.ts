import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { verificarCredenciales } from "@/lib/credenciales";
import { esUsuarioPermitido } from "@/lib/sesion";
import { normalizarRol } from "@/lib/permisos";
import { buscarUsuarioGithub, registrarUsuarioGithub } from "@/lib/usuarios";

// Configuración de NextAuth v4: inicio de sesión con GitHub (OAuth App) o con correo y contraseña (tabla users).
// En ambos casos la cuenta está en la tabla users y su rol (SUPER_USUARIO | USUARIO) va en el token y en la sesión.
// Usa GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXTAUTH_SECRET y GITHUB_USUARIOS_PERMITIDOS del .env.

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      // Devuelve el usuario si el correo y la contraseña coinciden (bcrypt); null → error CredentialsSignin
      authorize: (credentials) => verificarCredenciales(credentials?.email, credentials?.password),
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Sesión en un JWT cifrado en una cookie (sin tablas de sesión en la BD); dura una jornada
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  // El login está en "/": los errores (p. ej. ?error=AccessDenied) también vuelven ahí
  pages: { signIn: "/", error: "/" },
  callbacks: {
    // Correo y contraseña: ya se validó en authorize.
    // GitHub: la cuenta debe estar en la lista; se registra en users (como USUARIO si es nueva) y debe estar activa
    async signIn({ account, profile, user }) {
      if (account?.provider === "credentials") return true;
      const p = profile as { id?: number | string; login?: string; name?: string | null } | undefined;
      if (!p?.login || p.id === undefined || !esUsuarioPermitido(p.login)) return false;
      const cuenta = await registrarUsuarioGithub({ githubId: String(p.id), login: p.login, nombre: p.name, email: user.email });
      return cuenta.activo;
    },
    // Guarda en el token con qué se entró y quién es (para volver a comprobarlo en cada petición)
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "credentials" && user) {
        const u = user as typeof user & { rol?: "SUPER_USUARIO" | "USUARIO" };
        token.proveedor = "credentials";
        token.usuarioId = u.id;
        token.email = u.email;
        token.rol = u.rol;
        delete token.login;
      } else if (account?.provider === "github") {
        const p = profile as { id?: number | string; login?: string } | undefined;
        token.proveedor = "github";
        if (p?.login) token.login = p.login;
        const cuenta = p?.id !== undefined ? await buscarUsuarioGithub(String(p.id)) : null;
        if (cuenta) {
          token.usuarioId = cuenta.id;
          token.email = cuenta.email;
          token.rol = cuenta.rol;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.login = typeof token.login === "string" ? token.login : undefined;
        session.user.rol = normalizarRol(token.rol);
        session.user.proveedor = token.proveedor;
      }
      return session;
    },
    // Solo redirige dentro de la app
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return url.startsWith(baseUrl) ? url : baseUrl;
    },
  },
};
