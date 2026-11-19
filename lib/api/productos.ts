import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { productoSchema, type ProductoInput } from "@/lib/validations/producto";
import { esUrlDeLaCuenta } from "@/lib/cloudinary";

// Utilidades compartidas por /api/productos y /api/productos/[id]

// Campos públicos de un producto (precioConIgv se serializa como texto: "12.5")
export const SELECT_PRODUCTO = {
  id: true,
  codigo: true,
  nombre: true,
  descripcion: true,
  precioConIgv: true,
  stock: true,
  stockMinimo: true,
  activo: true,
  imagenUrl: true,
  imagenId: true,
  creadoEn: true,
} satisfies Prisma.ProductoSelect;

// Lee el cuerpo JSON y lo valida. Devuelve los datos o la Response de error (400 / 422).
export async function leerProductoValido(
  request: Request,
): Promise<{ data: ProductoInput } | { respuesta: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { respuesta: Response.json({ ok: false, error: "JSON inválido" }, { status: 400 }) };
  }

  const resultado = productoSchema.safeParse(body);
  if (!resultado.success) {
    return {
      respuesta: Response.json(
        { ok: false, error: "Datos inválidos", campos: z.flattenError(resultado.error).fieldErrors },
        { status: 422 },
      ),
    };
  }
  // La imagen debe ser de nuestra cuenta de Cloudinary y corresponder a su public_id
  const { imagenUrl, imagenId } = resultado.data;
  if (imagenUrl && imagenId && (!esUrlDeLaCuenta(imagenUrl) || !imagenUrl.includes(`/${imagenId}`))) {
    return {
      respuesta: Response.json(
        { ok: false, error: "La imagen no pertenece a la cuenta de Cloudinary de la tienda", campo: "imagenUrl" },
        { status: 422 },
      ),
    };
  }
  return { data: resultado.data };
}

// El único campo único (además del id) es el código: P2002 → 409
export function respuestaSiCodigoDuplicado(error: unknown): Response | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  return Response.json(
    { ok: false, error: "Ya existe un producto con ese código", campo: "codigo" },
    { status: 409 },
  );
}
