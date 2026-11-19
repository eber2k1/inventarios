import { z } from "zod";

// Convierte "", "   ", null o ausente en null antes de validar un campo opcional
const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
    schema.nullable(),
  );

// Acepta número o texto ("12.5", "12,50") y lo normaliza a texto con punto decimal.
// Se guarda como Decimal en la BD: el texto evita errores de redondeo de coma flotante.
export const dinero = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim().replace(",", ".") : v),
  z
    .string({ error: "Obligatorio" })
    .min(1, "Obligatorio")
    .regex(/^\d{1,10}(\.\d{1,2})?$/, "Precio no válido (sin negativos, máximo 2 decimales)"),
);

// Entero ≥ 0 (acepta "12" desde formularios)
export const enteroNoNegativo = (porDefecto: number) =>
  z.preprocess(
    (v) => (v == null || v === "" ? porDefecto : typeof v === "string" ? Number(v.trim()) : v),
    z
      .number({ error: "Debe ser un número" })
      .int("Debe ser un número entero")
      .min(0, "No puede ser negativo")
      .max(1_000_000, "Máximo 1 000 000"),
  );

// Carpeta de Cloudinary donde se suben las imágenes de productos (la firma solo autoriza esta carpeta)
export const CARPETA_PRODUCTOS = "inventarios/productos";
// URL https de entrega de una imagen subida a Cloudinary
const URL_CLOUDINARY = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/image\/upload\/\S+$/;

// Reglas de registro/edición de productos (alineadas con el modelo Producto y sus CHECK en la BD)
export const productoSchema = z.object({
  codigo: z
    .string({ error: "Obligatorio" })
    .trim()
    .min(1, "Obligatorio")
    .max(30, "Máximo 30 caracteres")
    .regex(/^[A-Za-z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo"),
  nombre: z.string({ error: "Obligatorio" }).trim().min(1, "Obligatorio").max(150, "Máximo 150 caracteres"),
  descripcion: opcional(z.string().trim().max(500, "Máximo 500 caracteres")),
  precioConIgv: dinero,
  stock: enteroNoNegativo(0),
  stockMinimo: enteroNoNegativo(0),
  activo: z.preprocess(
    (v) => (v === "true" || v === "on" ? true : v === "false" ? false : (v ?? true)),
    z.boolean({ error: "Debe ser verdadero o falso" }),
  ),
  // Imagen opcional en Cloudinary: URL de entrega + public_id (van juntos)
  imagenUrl: opcional(
    z.string().trim().max(500, "Máximo 500 caracteres").regex(URL_CLOUDINARY, "La imagen debe estar alojada en Cloudinary"),
  ),
  imagenId: opcional(
    z
      .string()
      .trim()
      .max(255, "Máximo 255 caracteres")
      .refine((id) => id.startsWith(`${CARPETA_PRODUCTOS}/`), "La imagen no pertenece a la carpeta de productos"),
  ),
}).refine((p) => (p.imagenUrl === null) === (p.imagenId === null), {
  error: "La imagen está incompleta: vuelve a subirla",
  path: ["imagenUrl"],
});

export type ProductoInput = z.infer<typeof productoSchema>;
