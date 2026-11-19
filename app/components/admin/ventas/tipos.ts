// Formas de los datos de /api/ventas tal como llegan al navegador (Decimal → texto, fechas → ISO)

export type TipoComprobante = "BOLETA" | "FACTURA";
export type EstadoSunat = "PENDIENTE" | "ENVIADO" | "ACEPTADO" | "RECHAZADO";

export type ClienteVenta = {
   id: string;
   tipoDocumento: "DNI" | "RUC";
   numeroDocumento: string;
   razonSocial: string | null;
   nombre: string | null;
   apellido: string | null;
};

export type Venta = {
   id: string;
   tipo: TipoComprobante;
   serie: string;
   correlativo: number;
   fecha: string;
   subtotal: string;
   igv: string;
   total: string;
   estadoSunat: EstadoSunat;
   enlacePdf: string | null;
   cliente: ClienteVenta | null;
   _count: { detalles: number };
};

export type VentaDetalle = Venta & {
   enlace: string | null;
   enlaceXml: string | null;
   enlaceCdr: string | null;
   sunatDescripcion: string | null;
   sunatError: string | null;
   codigoHash: string | null;
   enviadoEn: string | null;
   detalles: {
      id: string;
      cantidad: number;
      precioUnitario: string;
      total: string;
      producto: { id: string; codigo: string; nombre: string };
   }[];
};

export const NOMBRE_TIPO: Record<TipoComprobante, string> = { BOLETA: "Boleta", FACTURA: "Factura" };

// Estado en SUNAT: texto y color del Chip (no solo color: siempre lleva texto)
export const ESTADO_SUNAT: Record<EstadoSunat, { texto: string; color: "success" | "warning" | "default" | "danger" }> = {
   ACEPTADO: { texto: "Aceptado", color: "success" },
   ENVIADO: { texto: "Enviado", color: "warning" },
   PENDIENTE: { texto: "Pendiente", color: "default" },
   RECHAZADO: { texto: "Rechazado", color: "danger" },
};

export function nombreClienteVenta(c: ClienteVenta | null) {
   if (!c) return null;
   return c.razonSocial ?? [c.nombre, c.apellido].filter(Boolean).join(" ");
}
