import { z } from "zod";

export const TIPOS_COMPROBANTE = ["BOLETA", "FACTURA"] as const;

// Una línea de la venta: el precio NO viene del cliente, lo pone el servidor desde la BD
const itemSchema = z.object({
  productoId: z.string({ error: "Elige un producto" }).trim().min(1, "Elige un producto"),
  cantidad: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z
      .number({ error: "Indica la cantidad" })
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad mínima es 1")
      .max(100_000, "Cantidad demasiado grande"),
  ),
});

// Reglas para registrar una venta (boleta o factura).
// La factura exige cliente (que además debe tener RUC: se comprueba contra la BD en el endpoint).
export const ventaSchema = z
  .object({
    tipo: z.enum(TIPOS_COMPROBANTE, { error: "Debe ser BOLETA o FACTURA" }),
    clienteId: z.preprocess(
      (v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v),
      z.string().trim().nullable(),
    ),
    items: z
      .array(itemSchema, { error: "Agrega al menos un producto" })
      .min(1, "Agrega al menos un producto")
      .max(50, "Máximo 50 productos por comprobante"),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "FACTURA" && !v.clienteId) {
      ctx.addIssue({ code: "custom", path: ["clienteId"], message: "La factura necesita un cliente con RUC" });
    }
    const vistos = new Set<string>();
    v.items.forEach((item, i) => {
      if (vistos.has(item.productoId)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "productoId"],
          message: "Producto repetido: suma la cantidad en una sola línea",
        });
      }
      vistos.add(item.productoId);
    });
  });

export type VentaInput = z.infer<typeof ventaSchema>;
