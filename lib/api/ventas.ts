import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularLinea, sumarLineas } from "@/lib/montos";
import {
  CODIGOS_DE_CUENTA,
  consultarComprobante,
  datosDeRespuesta,
  generarComprobante,
  nubefactConfigurado,
  type ResultadoNubefact,
} from "@/lib/nubefact";
import { ventaSchema, type VentaInput } from "@/lib/validations/venta";

// Lógica de /api/ventas: una "venta" es un comprobante (boleta o factura) con su detalle,
// que se registra en la BD y se emite en SUNAT a través de Nubefact.

// Series de la cuenta Nubefact y primer correlativo de cada una
export const SERIES = { BOLETA: "BBB1", FACTURA: "FFF1" } as const;
export const CORRELATIVO_INICIAL: Record<string, number> = { BBB1: 6, FFF1: 8 };

// SUNAT: desde S/ 700 la boleta debe identificar al cliente
export const BOLETA_MONTO_MAXIMO_SIN_CLIENTE = new Prisma.Decimal(700);

const SELECT_CLIENTE_VENTA = {
  id: true,
  tipoDocumento: true,
  numeroDocumento: true,
  razonSocial: true,
  nombre: true,
  apellido: true,
} satisfies Prisma.ClienteSelect;

// Resumen para la lista
export const SELECT_VENTA = {
  id: true,
  tipo: true,
  serie: true,
  correlativo: true,
  fecha: true,
  subtotal: true,
  igv: true,
  total: true,
  estadoSunat: true,
  enlacePdf: true,
  cliente: { select: SELECT_CLIENTE_VENTA },
  _count: { select: { detalles: true } },
} satisfies Prisma.ComprobanteSelect;

// Detalle completo (con sus líneas y la respuesta de SUNAT)
export const SELECT_VENTA_DETALLE = {
  ...SELECT_VENTA,
  enlace: true,
  enlaceXml: true,
  enlaceCdr: true,
  sunatDescripcion: true,
  sunatError: true,
  codigoHash: true,
  enviadoEn: true,
  detalles: {
    select: {
      id: true,
      cantidad: true,
      precioUnitario: true,
      total: true,
      producto: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.ComprobanteSelect;

// Lo necesario para armar el JSON de Nubefact
const SELECT_PARA_NUBEFACT = {
  id: true,
  tipo: true,
  serie: true,
  correlativo: true,
  fecha: true,
  estadoSunat: true,
  cliente: {
    select: {
      tipoDocumento: true,
      numeroDocumento: true,
      razonSocial: true,
      nombre: true,
      apellido: true,
      direccion: true,
      email: true,
    },
  },
  detalles: {
    select: { cantidad: true, precioUnitario: true, producto: { select: { codigo: true, nombre: true } } },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.ComprobanteSelect;

type VentaParaEnvio = Prisma.ComprobanteGetPayload<{ select: typeof SELECT_PARA_NUBEFACT }>;

// Errores de negocio: se lanzan (para hacer rollback si hay transacción) y se convierten en Response
export class ErrorVenta extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly campos?: Record<string, string[]>,
  ) {
    super(message);
  }
  aRespuesta() {
    return Response.json({ ok: false, error: this.message, ...(this.campos && { campos: this.campos }) }, { status: this.status });
  }
}

// Errores de Zod como { "clienteId": [...], "items.0.cantidad": [...] }
function erroresPorCampo(issues: { path: PropertyKey[]; message: string }[]) {
  const campos: Record<string, string[]> = {};
  for (const issue of issues) {
    const clave = issue.path.map(String).join(".") || "general";
    (campos[clave] ??= []).push(issue.message);
  }
  return campos;
}

// Lee el cuerpo JSON y lo valida (400 / 422)
export async function leerVentaValida(request: Request): Promise<{ data: VentaInput } | { respuesta: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { respuesta: Response.json({ ok: false, error: "JSON inválido" }, { status: 400 }) };
  }
  const resultado = ventaSchema.safeParse(body);
  if (!resultado.success) {
    return {
      respuesta: Response.json(
        { ok: false, error: "Datos inválidos", campos: erroresPorCampo(resultado.error.issues) },
        { status: 422 },
      ),
    };
  }
  return { data: resultado.data };
}

// ---------- Registro en la BD ----------

// Registra la venta en una transacción: valida cliente y productos, calcula montos con el precio
// de la BD, descuenta stock (sin dejarlo negativo) y asigna el siguiente correlativo de la serie.
async function registrar(data: VentaInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Cliente
    if (data.clienteId) {
      const cliente = await tx.cliente.findUnique({
        where: { id: data.clienteId },
        select: { tipoDocumento: true },
      });
      if (!cliente) throw new ErrorVenta(422, "Datos inválidos", { clienteId: ["El cliente no existe"] });
      if (data.tipo === "FACTURA" && cliente.tipoDocumento !== "RUC") {
        throw new ErrorVenta(422, "Datos inválidos", { clienteId: ["La factura necesita un cliente con RUC"] });
      }
    }

    // 2. Productos (precio desde la BD)
    const productos = await tx.producto.findMany({
      where: { id: { in: data.items.map((i) => i.productoId) } },
      select: { id: true, nombre: true, precioConIgv: true, activo: true },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    const errores: Record<string, string[]> = {};
    data.items.forEach((item, i) => {
      const p = porId.get(item.productoId);
      if (!p) errores[`items.${i}.productoId`] = ["El producto no existe"];
      else if (!p.activo) errores[`items.${i}.productoId`] = [`${p.nombre} está inactivo`];
    });
    if (Object.keys(errores).length) throw new ErrorVenta(422, "Datos inválidos", errores);

    // 3. Montos por línea (precios con IGV); los totales son la suma de las líneas
    const lineas = data.items.map((item) => {
      const precioUnitario = porId.get(item.productoId)!.precioConIgv;
      return { ...item, precioUnitario, ...calcularLinea(precioUnitario, item.cantidad) };
    });
    const { total, subtotal, igv } = sumarLineas(lineas);

    if (data.tipo === "BOLETA" && !data.clienteId && total.gte(BOLETA_MONTO_MAXIMO_SIN_CLIENTE)) {
      throw new ErrorVenta(422, "Datos inválidos", {
        clienteId: ["Desde S/ 700 la boleta debe identificar al cliente"],
      });
    }

    // 4. Stock: solo descuenta si alcanza (condición atómica en el UPDATE)
    for (const [i, item] of data.items.entries()) {
      const { count } = await tx.producto.updateMany({
        where: { id: item.productoId, stock: { gte: item.cantidad } },
        data: { stock: { decrement: item.cantidad } },
      });
      if (count === 0) {
        const actual = await tx.producto.findUnique({ where: { id: item.productoId }, select: { nombre: true, stock: true } });
        const mensaje = `Stock insuficiente de ${actual?.nombre} (quedan ${actual?.stock ?? 0})`;
        throw new ErrorVenta(409, mensaje, { [`items.${i}.cantidad`]: [mensaje] });
      }
    }

    // 5. Serie y correlativo siguiente (nunca menor que el inicial de la serie)
    const serie = SERIES[data.tipo];
    const { _max } = await tx.comprobante.aggregate({ where: { serie }, _max: { correlativo: true } });
    const correlativo = Math.max((_max.correlativo ?? 0) + 1, CORRELATIVO_INICIAL[serie] ?? 1);

    // 6. Comprobante + detalle (queda PENDIENTE hasta que responda Nubefact)
    return tx.comprobante.create({
      data: {
        tipo: data.tipo,
        serie,
        correlativo,
        clienteId: data.clienteId,
        subtotal,
        igv,
        total,
        detalles: {
          create: lineas.map((l) => ({
            productoId: l.productoId,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            total: l.total,
          })),
        },
      },
      select: SELECT_PARA_NUBEFACT,
    });
  });
}

// Si dos ventas toman el mismo correlativo a la vez, la restricción única (serie, correlativo)
// rechaza la segunda (P2002): se reintenta la transacción completa.
async function registrarVenta(data: VentaInput) {
  for (let intento = 1; ; intento++) {
    try {
      return await registrar(data);
    } catch (error) {
      const choque = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!choque || intento >= 3) throw error;
    }
  }
}

// Deshace una venta que Nubefact rechazó: devuelve el stock y borra el comprobante (y su detalle),
// así el número vuelve a quedar libre.
async function anularVentaLocal(id: string) {
  await prisma.$transaction(async (tx) => {
    const detalles = await tx.detalleComprobante.findMany({
      where: { comprobanteId: id },
      select: { productoId: true, cantidad: true },
    });
    for (const d of detalles) {
      await tx.producto.update({ where: { id: d.productoId }, data: { stock: { increment: d.cantidad } } });
    }
    await tx.comprobante.delete({ where: { id } });
  });
}

// ---------- Envío a Nubefact ----------

const numeroDe = (v: { serie: string; correlativo: number }) => `${v.serie}-${v.correlativo}`;

// Aplica el resultado de Nubefact a la venta. Devuelve un aviso si quedó pendiente; lanza ErrorVenta
// (tras anular la venta) si fue rechazada.
async function aplicarResultado(venta: VentaParaEnvio, resultado: ResultadoNubefact): Promise<string | undefined> {
  switch (resultado.tipo) {
    case "ok":
      await prisma.comprobante.update({ where: { id: venta.id }, data: datosDeRespuesta(resultado.datos) });
      return undefined;

    case "rechazo": {
      await anularVentaLocal(venta.id);
      const status = resultado.codigo === null || CODIGOS_DE_CUENTA.has(resultado.codigo) ? 502 : 422;
      throw new ErrorVenta(
        status,
        `Nubefact rechazó el comprobante: ${resultado.mensaje}. La venta se anuló y el stock se devolvió.`,
      );
    }

    case "ya_existe":
      // Solo llega aquí al EMITIR un número nuevo: ese número lo usa otro documento de la cuenta
      await anularVentaLocal(venta.id);
      throw new ErrorVenta(
        409,
        `El número ${numeroDe(venta)} ya existe en Nubefact. Revisa el correlativo inicial de la serie ${venta.serie}. La venta se anuló y el stock se devolvió.`,
      );

    case "no_existe":
    case "incierto": {
      const mensaje = resultado.tipo === "incierto" ? resultado.mensaje : "Nubefact no confirmó el comprobante";
      await prisma.comprobante.update({ where: { id: venta.id }, data: { estadoSunat: "PENDIENTE", sunatError: mensaje } });
      return `${mensaje}. La venta quedó pendiente de envío; reinténtalo desde su detalle.`;
    }
  }
}

const leerDetalle = (id: string) =>
  prisma.comprobante.findUniqueOrThrow({ where: { id }, select: SELECT_VENTA_DETALLE });

// Registra la venta y la emite en Nubefact
export async function emitirVenta(data: VentaInput) {
  if (!nubefactConfigurado()) {
    throw new ErrorVenta(503, "Nubefact no está configurado (faltan NUBEFACT_RUTA o NUBEFACT_TOKEN)");
  }
  const venta = await registrarVenta(data);
  const aviso = await aplicarResultado(venta, await generarComprobante(venta));
  return { venta: await leerDetalle(venta.id), aviso };
}

// Reintenta el envío (PENDIENTE) o actualiza el estado en SUNAT (ENVIADO).
// Primero consulta: si Nubefact ya lo tiene (p. ej. el envío anterior llegó pero no respondió a tiempo),
// solo guarda la respuesta; si no lo tiene, lo genera.
export async function sincronizarVenta(id: string) {
  if (!nubefactConfigurado()) {
    throw new ErrorVenta(503, "Nubefact no está configurado (faltan NUBEFACT_RUTA o NUBEFACT_TOKEN)");
  }
  const venta = await prisma.comprobante.findUnique({ where: { id }, select: SELECT_PARA_NUBEFACT });
  if (!venta) throw new ErrorVenta(404, "La venta no existe");
  if (venta.estadoSunat === "ACEPTADO") throw new ErrorVenta(409, "Este comprobante ya fue aceptado por SUNAT");
  if (venta.estadoSunat === "RECHAZADO") {
    throw new ErrorVenta(409, "SUNAT rechazó este comprobante; registra una nueva venta con los datos corregidos");
  }

  let resultado = await consultarComprobante(venta);
  if (resultado.tipo === "rechazo") {
    // Error al CONSULTAR (p. ej. token): no dice nada del comprobante, no se anula
    throw new ErrorVenta(502, `Nubefact no pudo consultar el comprobante: ${resultado.mensaje}`);
  }
  if (resultado.tipo === "no_existe") {
    resultado = await generarComprobante(venta);
    // Otro reintento simultáneo lo acaba de generar
    if (resultado.tipo === "ya_existe") resultado = await consultarComprobante(venta);
  }

  const aviso = await aplicarResultado(venta, resultado);
  if (aviso) throw new ErrorVenta(502, aviso);
  return leerDetalle(venta.id);
}
