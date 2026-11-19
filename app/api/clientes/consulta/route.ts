import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { consultarDocumento, decolectaConfigurado } from "@/lib/decolecta";
import { REGEX_DNI, REGEX_RUC } from "@/lib/validations/cliente";

// Consulta un DNI (RENIEC) o RUC (SUNAT) en Decolecta para autocompletar el registro de clientes.
// GET ?tipo=DNI|RUC&numero=...
// 200 { ok, datos, registrado } · 404 no encontrado · 422 formato inválido · 502 Decolecta falló · 503 sin configurar
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo")?.toUpperCase();
  const numero = params.get("numero")?.trim() ?? "";

  if (tipo !== "DNI" && tipo !== "RUC") {
    return Response.json({ ok: false, error: "El tipo debe ser DNI o RUC", campo: "tipoDocumento" }, { status: 422 });
  }
  // Se valida antes de llamar a Decolecta: una consulta inválida también gasta la cuota
  const valido = tipo === "DNI" ? REGEX_DNI.test(numero) : REGEX_RUC.test(numero);
  if (!valido) {
    const error =
      tipo === "DNI" ? "El DNI debe tener 8 dígitos" : "El RUC debe tener 11 dígitos y empezar por 10, 15, 17 o 20";
    return Response.json({ ok: false, error, campo: "numeroDocumento" }, { status: 422 });
  }
  if (!decolectaConfigurado()) {
    return Response.json({ ok: false, error: "La consulta de DNI/RUC no está configurada" }, { status: 503 });
  }

  const resultado = await consultarDocumento(tipo, numero);
  const origen = tipo === "DNI" ? "RENIEC" : "SUNAT";
  switch (resultado.tipo) {
    case "no_encontrado":
      return Response.json({ ok: false, error: `No se encontró el ${tipo} ${numero} en ${origen}` }, { status: 404 });
    case "invalido":
      return Response.json(
        { ok: false, error: `${origen} indica que el ${tipo} no es válido`, campo: "numeroDocumento" },
        { status: 422 },
      );
    case "cuenta":
      return Response.json(
        { ok: false, error: "Decolecta rechazó el token o se agotó la cuota de consultas" },
        { status: 502 },
      );
    case "error":
      return Response.json({ ok: false, error: `${resultado.mensaje}. Inténtalo de nuevo.` }, { status: 502 });
  }

  try {
    // Avisa si el documento ya pertenece a un cliente registrado
    const cliente = await prisma.cliente.findUnique({
      where: { numeroDocumento: numero },
      select: { id: true, razonSocial: true, nombre: true, apellido: true },
    });
    const registrado = cliente
      ? { id: cliente.id, nombre: cliente.razonSocial ?? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") }
      : null;

    return Response.json({ ok: true, datos: resultado.datos, registrado });
  } catch (error) {
    console.error("Error al buscar el documento consultado:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
