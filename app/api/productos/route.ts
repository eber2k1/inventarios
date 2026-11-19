import { prisma } from "@/lib/prisma";
import { leerProductoValido, respuestaSiCodigoDuplicado, SELECT_PRODUCTO } from "@/lib/api/productos";

// Lista los productos ordenados por nombre.
// Filtros opcionales: ?q=texto (código o nombre, sin distinguir mayúsculas) y ?activos=1 (solo activos)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim();
  const soloActivos = params.get("activos") === "1";

  try {
    const productos = await prisma.producto.findMany({
      where: {
        ...(soloActivos && { activo: true }),
        ...(q && {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { nombre: { contains: q, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: [{ nombre: "asc" }, { codigo: "asc" }],
      select: SELECT_PRODUCTO,
    });

    return Response.json({ ok: true, total: productos.length, productos });
  } catch (error) {
    console.error("Error al listar productos:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}

// Registra un producto nuevo
export async function POST(request: Request) {
  const entrada = await leerProductoValido(request);
  if ("respuesta" in entrada) return entrada.respuesta;

  try {
    const producto = await prisma.producto.create({ data: entrada.data, select: SELECT_PRODUCTO });
    return Response.json(
      { ok: true, producto },
      { status: 201, headers: { Location: `/api/productos/${producto.id}` } },
    );
  } catch (error) {
    const duplicado = respuestaSiCodigoDuplicado(error);
    if (duplicado) return duplicado;

    console.error("Error al registrar producto:", error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }
}
