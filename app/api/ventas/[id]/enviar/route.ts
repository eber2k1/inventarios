import type { NextRequest } from "next/server";
import { ErrorVenta, sincronizarVenta } from "@/lib/api/ventas";

// Reintenta el envío a Nubefact de una venta PENDIENTE, o actualiza el estado SUNAT de una ENVIADA.
// 200 { ok, venta } · 404 no existe · 409 ya aceptada/rechazada · 502 Nubefact sigue sin responder
// (Si Nubefact rechaza el comprobante, la venta se anula y se responde 422/502.)
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/ventas/[id]/enviar">) {
  const { id } = await ctx.params;

  try {
    const venta = await sincronizarVenta(id);
    return Response.json({ ok: true, venta });
  } catch (error) {
    if (error instanceof ErrorVenta) return error.aRespuesta();

    console.error("Error al enviar venta a Nubefact:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
