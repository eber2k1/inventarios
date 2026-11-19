import { prisma } from "@/lib/prisma";
import { TIPOS_COMPROBANTE } from "@/lib/validations/venta";
import type { EstadoSunat } from "@/app/generated/prisma/client";
import { emitirVenta, ErrorVenta, leerVentaValida, SELECT_VENTA } from "@/lib/api/ventas";

const ESTADOS: EstadoSunat[] = ["PENDIENTE", "ENVIADO", "ACEPTADO", "RECHAZADO"];

// Lista las ventas (comprobantes), de la más reciente a la más antigua.
// Filtros opcionales: ?tipo=BOLETA|FACTURA, ?estado=PENDIENTE|ENVIADO|ACEPTADO|RECHAZADO y ?limite=N (1-500, por defecto 100)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tipo = TIPOS_COMPROBANTE.find((t) => t === params.get("tipo")?.toUpperCase());
  const estado = ESTADOS.find((e) => e === params.get("estado")?.toUpperCase());
  const limite = Math.min(Math.max(Number(params.get("limite")) || 100, 1), 500);

  try {
    const ventas = await prisma.comprobante.findMany({
      where: { ...(tipo && { tipo }), ...(estado && { estadoSunat: estado }) },
      orderBy: [{ fecha: "desc" }, { correlativo: "desc" }],
      take: limite,
      select: SELECT_VENTA,
    });
    return Response.json({ ok: true, total: ventas.length, ventas });
  } catch (error) {
    console.error("Error al listar ventas:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Registra una venta (calcula montos y descuenta stock) y emite el comprobante en SUNAT vía Nubefact.
// 201 { ok, venta, aviso? }: "aviso" indica que quedó PENDIENTE (Nubefact no respondió) y se puede reintentar.
// Si Nubefact lo rechaza, la venta se anula (stock devuelto) y se responde 422 / 502 / 409.
export async function POST(request: Request) {
  const entrada = await leerVentaValida(request);
  if ("respuesta" in entrada) return entrada.respuesta;

  try {
    const { venta, aviso } = await emitirVenta(entrada.data);
    return Response.json(
      { ok: true, venta, ...(aviso && { aviso }) },
      { status: 201, headers: { Location: `/api/ventas/${venta.id}` } },
    );
  } catch (error) {
    if (error instanceof ErrorVenta) return error.aRespuesta();

    console.error("Error al registrar venta:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
