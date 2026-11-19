import { z } from "zod";

// Convierte "", "   ", null o ausente en null antes de validar un campo opcional
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    schema.nullable(),
  );

const obligatorio = (max: number) =>
  z
    .string({ error: "Obligatorio" })
    .trim()
    .min(1, "Obligatorio")
    .max(max, `Máximo ${max} caracteres`);

export const TIPOS_DOCUMENTO = ["DNI", "RUC"] as const;

// DNI: 8 dígitos. RUC: 11 dígitos, empieza por 10, 15, 17 o 20 (igual que el CHECK de la BD)
export const REGEX_DNI = /^\d{8}$/;
export const REGEX_RUC = /^(10|15|17|20)\d{9}$/;

// Reglas de registro/edición de clientes (alineadas con el modelo Cliente y los CHECK de la BD).
// Persona (DNI): nombre y apellido obligatorios. Empresa (RUC): razón social obligatoria.
export const crearClienteSchema = z
  .object({
    tipoDocumento: z.enum(TIPOS_DOCUMENTO, { error: "Debe ser DNI o RUC" }).default("DNI"),
    numeroDocumento: z
      .string({ error: "Obligatorio" })
      .trim()
      .regex(/^\d{8}$|^\d{11}$/, "Debe tener 8 dígitos (DNI) u 11 (RUC)"),
    razonSocial: opcional(z.string().trim().max(200, "Máximo 200 caracteres")),
    nombre: opcional(z.string().trim().max(100, "Máximo 100 caracteres")),
    apellido: opcional(z.string().trim().max(100, "Máximo 100 caracteres")),
    direccion: obligatorio(255),
    telefono: opcional(
      z
        .string()
        .trim()
        .max(20, "Máximo 20 caracteres")
        .regex(/^\+?[0-9\s-]{6,20}$/, "Teléfono no válido"),
    ),
    // El correo se guarda tal cual se escribe (sin pasarlo a minúsculas)
    email: opcional(
      z
        .string()
        .trim()
        .max(150, "Máximo 150 caracteres")
        .pipe(z.email("Correo no válido")),
    ),
  })
  .superRefine((c, ctx) => {
    const falta = (campo: "nombre" | "apellido" | "razonSocial") =>
      ctx.addIssue({ code: "custom", path: [campo], message: "Obligatorio" });

    if (c.tipoDocumento === "DNI") {
      if (!REGEX_DNI.test(c.numeroDocumento))
        ctx.addIssue({ code: "custom", path: ["numeroDocumento"], message: "El DNI debe tener 8 dígitos" });
      if (!c.nombre) falta("nombre");
      if (!c.apellido) falta("apellido");
    } else {
      if (!REGEX_RUC.test(c.numeroDocumento))
        ctx.addIssue({
          code: "custom",
          path: ["numeroDocumento"],
          message: "El RUC debe tener 11 dígitos y empezar por 10, 15, 17 o 20",
        });
      if (!c.razonSocial) falta("razonSocial");
    }
  });

export type CrearClienteInput = z.infer<typeof crearClienteSchema>;
