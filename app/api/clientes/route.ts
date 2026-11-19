import { prisma } from "@/lib/prisma";
import { leerClienteValido, respuestaSiDuplicado, SELECT_CLIENTE } from "@/lib/api/clientes";

// Lista los clientes ordenados por apellido y nombre.
// Búsqueda opcional: ?q=texto (coincide con DNI/RUC, razón social, nombre o apellido; sin distinguir mayúsculas)
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();

  try {
    const clientes = await prisma.cliente.findMany({
      where: q
        ? {
            OR: [
              { numeroDocumento: { contains: q } },
              { razonSocial: { contains: q, mode: "insensitive" } },
              { nombre: { contains: q, mode: "insensitive" } },
              { apellido: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ apellido: "asc" }, { nombre: "asc" }, { razonSocial: "asc" }],
      select: SELECT_CLIENTE,
    });

    return Response.json({ ok: true, total: clientes.length, clientes });
  } catch (error) {
    console.error("Error al listar clientes:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Registra un cliente nuevo
export async function POST(request: Request) {
  const entrada = await leerClienteValido(request);
  if ("respuesta" in entrada) return entrada.respuesta;

  try {
    const cliente = await prisma.cliente.create({
      data: entrada.data,
      select: SELECT_CLIENTE,
    });

    return Response.json(
      { ok: true, cliente },
      { status: 201, headers: { Location: `/api/clientes/${cliente.id}` } },
    );
  } catch (error) {
    const duplicado = respuestaSiDuplicado(error);
    if (duplicado) return duplicado;

    console.error("Error al registrar cliente:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
