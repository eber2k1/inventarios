import type { NextRequest } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { esNoEncontrado } from "@/lib/api/clientes";
import { leerProductoValido, respuestaSiCodigoDuplicado, SELECT_PRODUCTO } from "@/lib/api/productos";
import { eliminarImagen } from "@/lib/cloudinary";

// Actualiza todos los datos de un producto (reemplazo completo, como manda PUT).
// Si la imagen cambió o se quitó, la anterior se borra de Cloudinary.
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/productos/[id]">) {
  const { id } = await ctx.params;

  const entrada = await leerProductoValido(request);
  if ("respuesta" in entrada) return entrada.respuesta;

  try {
    const anterior = await prisma.producto.findUnique({ where: { id }, select: { imagenId: true } });
    const producto = await prisma.producto.update({ where: { id }, data: entrada.data, select: SELECT_PRODUCTO });
    if (anterior?.imagenId && anterior.imagenId !== producto.imagenId) await eliminarImagen(anterior.imagenId);
    return Response.json({ ok: true, producto });
  } catch (error) {
    if (esNoEncontrado(error)) {
      return Response.json({ ok: false, error: "El producto no existe" }, { status: 404 });
    }
    const duplicado = respuestaSiCodigoDuplicado(error);
    if (duplicado) return duplicado;

    console.error("Error al actualizar producto:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Elimina un producto. Si ya aparece en algún comprobante, la BD lo impide (onDelete: Restrict):
// se responde 409 y se sugiere desactivarlo. Su imagen también se borra de Cloudinary.
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/productos/[id]">) {
  const { id } = await ctx.params;

  try {
    const producto = await prisma.producto.delete({
      where: { id },
      select: { id: true, codigo: true, nombre: true, imagenId: true },
    });
    if (producto.imagenId) await eliminarImagen(producto.imagenId);
    return Response.json({ ok: true, producto });
  } catch (error) {
    if (esNoEncontrado(error)) {
      return Response.json({ ok: false, error: "El producto no existe" }, { status: 404 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return Response.json(
        { ok: false, error: "El producto tiene ventas registradas; desactívalo en lugar de eliminarlo" },
        { status: 409 },
      );
    }

    console.error("Error al eliminar producto:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
