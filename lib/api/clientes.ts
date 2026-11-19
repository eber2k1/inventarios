import { z } from "zod";
import { Prisma } from "@/app/generated/prisma/client";
import { crearClienteSchema, type CrearClienteInput } from "@/lib/validations/cliente";

// Utilidades compartidas por los endpoints /api/clientes y /api/clientes/[id]

// Campos públicos de un cliente en las respuestas de la API
export const SELECT_CLIENTE = {
  id: true,
  tipoDocumento: true,
  numeroDocumento: true,
  razonSocial: true,
  nombre: true,
  apellido: true,
  direccion: true,
  telefono: true,
  email: true,
  creadoEn: true,
} satisfies Prisma.ClienteSelect;

const CAMPOS_UNICOS = { numeroDocumento: "número de documento", email: "correo" } as const;

// Lee el cuerpo JSON y lo valida con las reglas del cliente.
// Devuelve los datos válidos o la Response de error (400 JSON inválido / 422 datos inválidos).
export async function leerClienteValido(
  request: Request,
): Promise<{ data: CrearClienteInput } | { respuesta: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { respuesta: Response.json({ ok: false, error: "JSON inválido" }, { status: 400 }) };
  }

  const resultado = crearClienteSchema.safeParse(body);
  if (!resultado.success) {
    return {
      respuesta: Response.json(
        { ok: false, error: "Datos inválidos", campos: z.flattenError(resultado.error).fieldErrors },
        { status: 422 },
      ),
    };
  }
  return { data: resultado.data };
}

// Campo que violó la restricción única. Con driver adapter (Prisma 7) llega en
// meta.driverAdapterError.cause.constraint como { index: "customers_numeroDocumento_key" } o { fields: [...] }
function campoDuplicado(error: Prisma.PrismaClientKnownRequestError) {
  const meta = error.meta as
    | {
        target?: string[] | string;
        driverAdapterError?: {
          cause?: { constraint?: { fields?: string[]; index?: string } };
        };
      }
    | undefined;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  const candidatos = [
    ...(Array.isArray(meta?.target) ? meta.target : [meta?.target ?? ""]),
    ...(constraint?.fields ?? []),
    constraint?.index ?? "",
  ].map((c) => c.replaceAll('"', ""));

  return (Object.keys(CAMPOS_UNICOS) as (keyof typeof CAMPOS_UNICOS)[]).find((campo) =>
    candidatos.some((c) => c === campo || c.includes(`_${campo}_`)),
  );
}

// Si el error es un documento/correo duplicado (P2002), devuelve la Response 409; si no, null
export function respuestaSiDuplicado(error: unknown): Response | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const campo = campoDuplicado(error);
  return Response.json(
    {
      ok: false,
      error: `Ya existe un cliente con ese ${campo ? CAMPOS_UNICOS[campo] : "dato"}`,
      campo: campo ?? null,
    },
    { status: 409 },
  );
}

// true si el error es "registro no encontrado" (P2025)
export function esNoEncontrado(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
