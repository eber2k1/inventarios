import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Envío de correos con Resend (RESEND_API_KEY y RESEND_FROM en .env). Solo servidor.
// Correo de bienvenida: emails/template.html con variables {{nombre}}, {{email}}, {{metodo}}, {{urlLogin}}, {{anio}}.

export function correoConfigurado() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

let cliente: Resend | undefined;
const resend = () => (cliente ??= new Resend(process.env.RESEND_API_KEY));

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Reemplaza {{variable}} por su valor escapado; una variable sin valor queda vacía
export function rellenarPlantilla(html: string, variables: Record<string, string>) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, nombre: string) => escapar(variables[nombre] ?? ""));
}

let plantillaBienvenida: Promise<string> | undefined;
const leerPlantillaBienvenida = () =>
  (plantillaBienvenida ??= readFile(path.join(process.cwd(), "emails", "template.html"), "utf8"));

export type ResultadoCorreo = { ok: true; id: string } | { ok: false; error: string };

type DatosBienvenida = { nombre: string; email: string; metodo: "credentials" | "github"; idUsuario: string };

// Envía el correo de bienvenida a un usuario recién creado. Nunca lanza: devuelve el resultado.
export async function enviarBienvenida({ nombre, email, metodo, idUsuario }: DatosBienvenida): Promise<ResultadoCorreo> {
  if (!correoConfigurado()) return { ok: false, error: "Resend no está configurado (RESEND_API_KEY / RESEND_FROM)" };
  // Las cuentas de GitHub sin correo público usan el correo "noreply" de GitHub: ahí no se envía
  if (email.endsWith("@users.noreply.github.com")) return { ok: false, error: "La cuenta no tiene un correo real" };

  try {
    const urlLogin = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000").toString();
    const variables = {
      nombre,
      email,
      metodo: metodo === "github" ? "GitHub" : "correo y contraseña",
      urlLogin,
      anio: String(new Date().getFullYear()),
    };
    const html = rellenarPlantilla(await leerPlantillaBienvenida(), variables);
    const text = [
      `¡Bienvenido, ${nombre}!`,
      "",
      "Tu cuenta en el panel de Tiendita Enter ya está lista.",
      `Correo de la cuenta: ${email}`,
      `Inicias sesión con: ${variables.metodo}`,
      "",
      `Ir al panel: ${urlLogin}`,
    ].join("\n");

    const { data, error } = await resend().emails.send(
      { from: process.env.RESEND_FROM!, to: email, subject: "Bienvenido a Tiendita Enter", html, text },
      // Si se reintenta para el mismo usuario, Resend no lo envía dos veces
      { idempotencyKey: `bienvenida-${idUsuario}` },
    );
    if (error || !data) return { ok: false, error: `${error?.name ?? "error"}: ${error?.message ?? "sin respuesta"}` };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
