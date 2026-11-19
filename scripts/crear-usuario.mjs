// Crea o actualiza un usuario para iniciar sesión con correo y contraseña (contraseña guardada con bcrypt).
// Uso: npm run db:usuario -- <correo> <contraseña> "<nombre>" [USUARIO|SUPER_USUARIO]  (por defecto USUARIO)
// Si el usuario es nuevo, se le envía el correo de bienvenida (emails/template.html) con Resend.
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import pg from "pg";
import { Resend } from "resend";

const [correoBruto, contrasena, nombre = "Usuario", rol = "USUARIO"] = process.argv.slice(2);
const correo = (correoBruto ?? "").trim().toLowerCase();
// Al actualizar un usuario existente, su rol solo cambia si se indica explícitamente
const rolIndicado = process.argv[5] !== undefined;

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || !contrasena || contrasena.length < 8 || !["SUPER_USUARIO", "USUARIO"].includes(rol)) {
  console.error('Uso: npm run db:usuario -- <correo> <contraseña (mín. 8)> "<nombre>" [USUARIO|SUPER_USUARIO]');
  process.exit(1);
}

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL no está definida en .env");
  process.exit(1);
}

const hash = await bcrypt.hash(contrasena, 12);
const cliente = new pg.Client({ connectionString: url });
await cliente.connect();
try {
  const { rows } = await cliente.query(
    `INSERT INTO "users" ("id", "nombre", "email", "passwordHash", "rol", "activo", "actualizadoEn")
     VALUES ($1, $2, $3, $4, $5::"Rol", true, CURRENT_TIMESTAMP)
     ON CONFLICT ("email") DO UPDATE
       SET "nombre" = EXCLUDED."nombre", "passwordHash" = EXCLUDED."passwordHash",
           "rol" = CASE WHEN $6 THEN EXCLUDED."rol" ELSE "users"."rol" END,
           "activo" = true, "actualizadoEn" = CURRENT_TIMESTAMP
     RETURNING (xmax = 0) AS creado, "rol", "id"`,
    [`u${randomBytes(12).toString("hex")}`, nombre, correo, hash, rol, rolIndicado],
  );
  console.log(`${rows[0].creado ? "Usuario creado" : "Usuario actualizado"}: ${correo} (${rows[0].rol})`);
  if (rows[0].creado) console.log(await enviarBienvenida(rows[0].id, nombre, correo));
} finally {
  await cliente.end();
}

// Mismo correo que lib/correo.ts (enviarBienvenida), para las cuentas creadas con este script
async function enviarBienvenida(id, nombreUsuario, email) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return "Correo de bienvenida no enviado: Resend no está configurado";
  const escapar = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const urlLogin = new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000").toString();
  const variables = { nombre: nombreUsuario, email, metodo: "correo y contraseña", urlLogin, anio: String(new Date().getFullYear()) };
  const plantilla = await readFile(new URL("../emails/template.html", import.meta.url), "utf8");
  const html = plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, v) => escapar(variables[v] ?? ""));
  const text = `¡Bienvenido, ${nombreUsuario}!

Tu cuenta en el panel de Tiendita Enter ya está lista.
Correo de la cuenta: ${email}
Inicias sesión con: correo y contraseña

Ir al panel: ${urlLogin}`;
  const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
    { from: process.env.RESEND_FROM, to: email, subject: "Bienvenido a Tiendita Enter", html, text },
    { idempotencyKey: `bienvenida-${id}` },
  );
  return error ? `Correo de bienvenida no enviado: ${error.name}: ${error.message}` : `Correo de bienvenida enviado (id ${data.id})`;
}
