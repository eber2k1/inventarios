import type { EstadoSunat, Prisma, TipoComprobante, TipoDocumento } from "@/app/generated/prisma/client";
import { calcularLinea, IGV_PORCENTAJE, sumarLineas } from "@/lib/montos";

// Cliente de la API JSON v1 de Nubefact (solo servidor: usa NUBEFACT_RUTA y NUBEFACT_TOKEN del .env).
// Todas las operaciones son POST a la RUTA con el TOKEN en la cabecera Authorization.

const TIEMPO_LIMITE_MS = 25_000;

const TIPO_COMPROBANTE: Record<TipoComprobante, 1 | 2> = { FACTURA: 1, BOLETA: 2 };
const TIPO_DOCUMENTO_CLIENTE: Record<TipoDocumento, string> = { RUC: "6", DNI: "1" };

export function nubefactConfigurado() {
  return Boolean(process.env.NUBEFACT_RUTA && process.env.NUBEFACT_TOKEN);
}

// ---------- Construcción del JSON ----------

export type VentaParaNubefact = {
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  fecha: Date;
  cliente: {
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    razonSocial: string | null;
    nombre: string | null;
    apellido: string | null;
    direccion: string;
    email: string | null;
  } | null;
  detalles: {
    cantidad: number;
    precioUnitario: Prisma.Decimal;
    producto: { codigo: string; nombre: string };
  }[];
};

const recortar = (texto: string, max: number) => texto.replace(/\s+/g, " ").trim().slice(0, max);
const numero = (d: Prisma.Decimal) => Number(d.toFixed(2));

// Fecha de emisión DD-MM-YYYY en hora de Perú (el servidor puede estar en otra zona horaria)
export function fechaNubefact(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(fecha);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value;
  return `${parte("day")}-${parte("month")}-${parte("year")}`;
}

function datosCliente(cliente: VentaParaNubefact["cliente"]) {
  // Boleta sin cliente (< S/ 700): "VARIOS"
  if (!cliente) {
    return {
      cliente_tipo_de_documento: "-",
      cliente_numero_de_documento: "-",
      cliente_denominacion: "CLIENTES VARIOS",
      cliente_direccion: "",
    };
  }
  const denominacion =
    cliente.tipoDocumento === "RUC"
      ? cliente.razonSocial ?? ""
      : [cliente.nombre, cliente.apellido].filter(Boolean).join(" ");
  return {
    cliente_tipo_de_documento: TIPO_DOCUMENTO_CLIENTE[cliente.tipoDocumento],
    cliente_numero_de_documento: cliente.numeroDocumento,
    cliente_denominacion: recortar(denominacion, 100),
    cliente_direccion: recortar(cliente.direccion, 100),
    ...(cliente.email && { cliente_email: cliente.email }),
  };
}

// Arma el JSON de "generar_comprobante" a partir de la venta guardada.
// Los montos se recalculan por línea con la misma función usada al registrar la venta,
// así lo enviado coincide con lo guardado.
export function construirComprobante(venta: VentaParaNubefact) {
  const items = venta.detalles.map((d) => {
    const linea = calcularLinea(d.precioUnitario, d.cantidad);
    return {
      linea,
      json: {
        unidad_de_medida: "NIU",
        codigo: d.producto.codigo,
        descripcion: recortar(d.producto.nombre, 250),
        cantidad: d.cantidad,
        valor_unitario: linea.valorUnitario.toNumber(),
        precio_unitario: numero(d.precioUnitario),
        subtotal: numero(linea.subtotal),
        tipo_de_igv: 1, // Gravado - operación onerosa
        igv: numero(linea.igv),
        total: numero(linea.total),
        anticipo_regularizacion: false,
      },
    };
  });
  const totales = sumarLineas(items.map((i) => i.linea));

  return {
    operacion: "generar_comprobante",
    tipo_de_comprobante: TIPO_COMPROBANTE[venta.tipo],
    serie: venta.serie,
    numero: venta.correlativo,
    sunat_transaction: 1, // venta interna
    ...datosCliente(venta.cliente),
    fecha_de_emision: fechaNubefact(venta.fecha),
    moneda: 1, // soles
    porcentaje_de_igv: IGV_PORCENTAJE,
    total_gravada: numero(totales.subtotal),
    total_igv: numero(totales.igv),
    total: numero(totales.total),
    enviar_automaticamente_a_la_sunat: true,
    enviar_automaticamente_al_cliente: false,
    items: items.map((i) => i.json),
  };
}

// ---------- Llamada a la API ----------

// Respuesta de Nubefact para generar / consultar un comprobante (solo los campos que usamos)
export type RespuestaComprobante = {
  enlace?: string | null;
  enlace_del_pdf?: string | null;
  enlace_del_xml?: string | null;
  enlace_del_cdr?: string | null;
  aceptada_por_sunat?: boolean | null;
  sunat_description?: string | null;
  sunat_note?: string | null;
  sunat_responsecode?: string | null;
  sunat_soap_error?: string | null;
  codigo_hash?: string | null;
  cadena_para_codigo_qr?: string | null;
};

export type ResultadoNubefact =
  | { tipo: "ok"; datos: RespuestaComprobante }
  // Nubefact respondió con un error definitivo: el comprobante NO quedó registrado allí
  | { tipo: "rechazo"; codigo: number | null; mensaje: string }
  // Código 23: ese número ya existe en Nubefact / Código 24: no existe
  | { tipo: "ya_existe" }
  | { tipo: "no_existe" }
  // No sabemos si llegó (red, tiempo límite, error 5xx o código 40): se debe reintentar
  | { tipo: "incierto"; mensaje: string };

// Errores de cuenta o configuración (token, ruta, cabecera, cuenta suspendida)
export const CODIGOS_DE_CUENTA = new Set([10, 11, 12, 50, 51]);

async function llamarNubefact(cuerpo: object): Promise<ResultadoNubefact> {
  const ruta = process.env.NUBEFACT_RUTA;
  const token = process.env.NUBEFACT_TOKEN;
  if (!ruta || !token) return { tipo: "rechazo", codigo: null, mensaje: "Nubefact no está configurado" };

  let res: Response;
  try {
    res = await fetch(ruta, {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      cache: "no-store",
    });
  } catch (error) {
    const tiempo = error instanceof Error && error.name === "TimeoutError";
    return { tipo: "incierto", mensaje: tiempo ? "Nubefact no respondió a tiempo" : "No se pudo conectar con Nubefact" };
  }

  const json = (await res.json().catch(() => null)) as (RespuestaComprobante & { errors?: unknown; codigo?: unknown }) | null;

  if (json && json.errors) {
    const codigo = typeof json.codigo === "number" ? json.codigo : Number(json.codigo) || null;
    const mensaje = typeof json.errors === "string" ? json.errors : JSON.stringify(json.errors);
    if (codigo === 23) return { tipo: "ya_existe" };
    if (codigo === 24) return { tipo: "no_existe" };
    if (codigo === 40 || res.status >= 500) return { tipo: "incierto", mensaje };
    return { tipo: "rechazo", codigo, mensaje };
  }
  if (!res.ok || !json) {
    return res.status >= 500 || !json
      ? { tipo: "incierto", mensaje: `Nubefact respondió con un error inesperado (HTTP ${res.status})` }
      : { tipo: "rechazo", codigo: null, mensaje: `Nubefact rechazó la solicitud (HTTP ${res.status})` };
  }
  return { tipo: "ok", datos: json };
}

export function generarComprobante(venta: VentaParaNubefact) {
  return llamarNubefact(construirComprobante(venta));
}

export function consultarComprobante(v: { tipo: TipoComprobante; serie: string; correlativo: number }) {
  return llamarNubefact({
    operacion: "consultar_comprobante",
    tipo_de_comprobante: TIPO_COMPROBANTE[v.tipo],
    serie: v.serie,
    numero: v.correlativo,
  });
}

// ---------- Interpretación de la respuesta ----------

const texto = (v: string | null | undefined, max: number) => (v && v.trim() ? v.trim().slice(0, max) : null);

// Códigos de SUNAT: 0 = aceptado; 100–999 = error temporal de SUNAT (se puede volver a consultar);
// 1000–1999 = excepción (no aceptado, p. ej. 1083 "RUC del receptor no existe"); 2000–3999 = rechazo;
// 4000+ = aceptado con observaciones
export function estadoDesdeRespuesta(datos: RespuestaComprobante): EstadoSunat {
  if (datos.aceptada_por_sunat) return "ACEPTADO";
  const codigo = Number(datos.sunat_responsecode);
  if (Number.isFinite(codigo) && codigo >= 1000 && codigo < 4000) return "RECHAZADO";
  return "ENVIADO";
}

// Campos del comprobante a actualizar con la respuesta de Nubefact
export function datosDeRespuesta(datos: RespuestaComprobante) {
  const enlace = texto(datos.enlace, 500);
  const errores = [
    datos.sunat_responsecode && datos.sunat_responsecode !== "0" ? `Código ${datos.sunat_responsecode}` : null,
    datos.sunat_note,
    datos.sunat_soap_error,
  ].filter((v) => v && String(v).trim());

  return {
    estadoSunat: estadoDesdeRespuesta(datos),
    enlace,
    enlacePdf: texto(datos.enlace_del_pdf, 500) ?? (enlace ? `${enlace}.pdf` : null),
    enlaceXml: texto(datos.enlace_del_xml, 500),
    enlaceCdr: texto(datos.enlace_del_cdr, 500),
    sunatDescripcion: texto(datos.sunat_description, 1000),
    sunatError: errores.length ? errores.join(" · ").slice(0, 1000) : null,
    codigoHash: texto(datos.codigo_hash, 100),
    cadenaQr: texto(datos.cadena_para_codigo_qr, 1000),
    enviadoEn: new Date(),
  } satisfies Prisma.ComprobanteUpdateInput;
}
