import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SELECT_VENTA_DETALLE } from "@/lib/api/ventas";

// Detalle de una venta con sus líneas.
// No hay PUT ni DELETE: un comprobante emitido no se edita ni se borra (se anulará vía SUNAT).
// Reintento / actualización del estado SUNAT: POST /api/ventas/[id]/enviar
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/ventas/[id]">) {
  const { id } = await ctx.params;

  try {
    const venta = await prisma.comprobante.findUnique({ where: { id }, select: SELECT_VENTA_DETALLE });
    if (!venta) return Response.json({ ok: false, error: "La venta no existe" }, { status: 404 });
    return Response.json({ ok: true, venta });
  } catch (error) {
    console.error("Error al obtener venta:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
