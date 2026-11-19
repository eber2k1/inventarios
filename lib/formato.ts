// Formatos de presentación compartidos por el admin (es-PE)

const SOLES = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const FECHA_HORA = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" });

// Montos: la API devuelve los Decimal como texto ("12.5"); aquí se muestran como "S/ 12.50"
export function formatoSoles(valor: string | number) {
  return SOLES.format(Number(valor));
}

export function formatoFecha(iso: string) {
  return FECHA_HORA.format(new Date(iso));
}

// Número de comprobante como lo imprime SUNAT: BBB1-00000006 → aquí BBB1-6
export function numeroComprobante(v: { serie: string; correlativo: number }) {
  return `${v.serie}-${v.correlativo}`;
}
