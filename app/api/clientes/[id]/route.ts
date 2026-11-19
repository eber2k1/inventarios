import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  esNoEncontrado,
  leerClienteValido,
  respuestaSiDuplicado,
  SELECT_CLIENTE,
} from "@/lib/api/clientes";

// Actualiza todos los datos de un cliente (reemplazo completo, como manda PUT).
// Mismas reglas que el registro: tipoDocumento (DNI por defecto), numeroDocumento y direccion;
// nombre y apellido si es DNI, razonSocial si es RUC; lo opcional que no se envíe queda vacío.
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/clientes/[id]">) {
  const { id } = await ctx.params;

  const entrada = await leerClienteValido(request);
  if ("respuesta" in entrada) return entrada.respuesta;

  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: entrada.data,
      select: SELECT_CLIENTE,
    });

    return Response.json({ ok: true, cliente });
  } catch (error) {
    if (esNoEncontrado(error)) {
      return Response.json({ ok: false, error: "El cliente no existe" }, { status: 404 });
    }
    const duplicado = respuestaSiDuplicado(error);
    if (duplicado) return duplicado;

    console.error("Error al actualizar cliente:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Elimina un cliente por su id.
// Sus comprobantes NO se borran: quedan registrados sin cliente (onDelete: SetNull en el esquema).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/clientes/[id]">) {
  const { id } = await ctx.params;

  try {
    const cliente = await prisma.cliente.delete({
      where: { id },
      select: { id: true, tipoDocumento: true, numeroDocumento: true, razonSocial: true, nombre: true, apellido: true },
    });

    return Response.json({ ok: true, cliente });
  } catch (error) {
    if (esNoEncontrado(error)) {
      return Response.json({ ok: false, error: "El cliente no existe" }, { status: 404 });
    }

    console.error("Error al eliminar cliente:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
