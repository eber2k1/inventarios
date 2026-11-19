import type { TipoDocumento } from "@/app/generated/prisma/client";

// Cliente de la API de Decolecta (solo servidor: usa DECOLECTA_TOKEN del .env).
// Consulta datos oficiales de RENIEC (DNI) y SUNAT (RUC) para autocompletar el registro de clientes.

const BASE = "https://api.decolecta.com/v1";
const TIEMPO_LIMITE_MS = 10_000;
const RUTA: Record<TipoDocumento, string> = { DNI: "reniec/dni", RUC: "sunat/ruc" };

export function decolectaConfigurado() {
  return Boolean(process.env.DECOLECTA_TOKEN);
}

// Datos normalizados, listos para los campos del cliente
export type DatosDocumento = {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
  direccion: string | null;
  estado: string | null; // solo RUC: ACTIVO, BAJA DE OFICIO...
  condicion: string | null; // solo RUC: HABIDO, NO HABIDO...
};

export type ResultadoDecolecta =
  | { tipo: "ok"; datos: DatosDocumento }
  | { tipo: "no_encontrado" }
  | { tipo: "invalido" }
  | { tipo: "cuenta" } // token incorrecto o cuota agotada
  | { tipo: "error"; mensaje: string }; // red, tiempo límite o error del servicio

// Decolecta devuelve "-" en los campos vacíos y a veces espacios sobrantes
function limpio(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t && t !== "-" ? t : null;
}

const recortar = (v: string | null, max: number) => (v ? v.slice(0, max) : null);

type RespuestaDni = { first_name?: string; first_last_name?: string; second_last_name?: string; document_number?: string };
type RespuestaRuc = {
  razon_social?: string;
  numero_documento?: string;
  estado?: string;
  condicion?: string;
  direccion?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
};

function normalizarDni(numero: string, r: RespuestaDni): DatosDocumento {
  const apellido = [limpio(r.first_last_name), limpio(r.second_last_name)].filter(Boolean).join(" ");
  return {
    tipoDocumento: "DNI",
    numeroDocumento: limpio(r.document_number) ?? numero,
    nombre: recortar(limpio(r.first_name), 100),
    apellido: recortar(apellido || null, 100),
    razonSocial: null,
    direccion: null, // RENIEC no entrega la dirección
    estado: null,
    condicion: null,
  };
}

function normalizarRuc(numero: string, r: RespuestaRuc): DatosDocumento {
  const calle = limpio(r.direccion);
  const ubicacion = [limpio(r.distrito), limpio(r.provincia), limpio(r.departamento)].filter(Boolean).join(" - ");
  const direccion = calle ? (ubicacion ? `${calle}, ${ubicacion}` : calle) : null;
  return {
    tipoDocumento: "RUC",
    numeroDocumento: limpio(r.numero_documento) ?? numero,
    nombre: null,
    apellido: null,
    razonSocial: recortar(limpio(r.razon_social), 200),
    direccion: recortar(direccion, 255),
    estado: limpio(r.estado),
    condicion: limpio(r.condicion),
  };
}

// Consulta un DNI en RENIEC o un RUC en SUNAT. El formato del número debe validarse antes.
export async function consultarDocumento(tipo: TipoDocumento, numero: string): Promise<ResultadoDecolecta> {
  const token = process.env.DECOLECTA_TOKEN;
  if (!token) return { tipo: "cuenta" };

  let res: Response;
  try {
    res = await fetch(`${BASE}/${RUTA[tipo]}?numero=${encodeURIComponent(numero)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      cache: "no-store",
    });
  } catch (error) {
    const tiempo = error instanceof Error && error.name === "TimeoutError";
    return { tipo: "error", mensaje: tiempo ? "Decolecta no respondió a tiempo" : "No se pudo conectar con Decolecta" };
  }

  if (res.status === 404) return { tipo: "no_encontrado" };
  if (res.status === 422 || res.status === 400) return { tipo: "invalido" };
  if (res.status === 401 || res.status === 403 || res.status === 429) return { tipo: "cuenta" };

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    return { tipo: "error", mensaje: `Decolecta respondió con un error inesperado (HTTP ${res.status})` };
  }

  const datos = tipo === "DNI" ? normalizarDni(numero, json) : normalizarRuc(numero, json);
  // Una respuesta 200 sin nombre ni razón social no sirve para autocompletar
  if (!datos.nombre && !datos.apellido && !datos.razonSocial) return { tipo: "no_encontrado" };
  return { tipo: "ok", datos };
}
