import { Prisma } from "@/app/generated/prisma/client";

// Cálculo de montos con IGV, compartido por el registro de ventas y el envío a Nubefact.
// Los precios de los productos YA incluyen IGV.

export const IGV_TASA = new Prisma.Decimal("0.18");
export const IGV_PORCENTAJE = 18;
const FACTOR_IGV = IGV_TASA.add(1); // 1.18

export const redondear = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

// Una línea: total = precio × cantidad; subtotal (valor de venta sin IGV) = total / 1.18; igv = total − subtotal
// Ej.: 1 × 50.00 → subtotal 42.37, igv 7.63
export function calcularLinea(precioConIgv: Prisma.Decimal | string | number, cantidad: number) {
  const precio = new Prisma.Decimal(precioConIgv);
  const total = redondear(precio.mul(cantidad));
  const subtotal = redondear(total.div(FACTOR_IGV));
  return {
    total,
    subtotal,
    igv: total.sub(subtotal),
    // Valor unitario sin IGV (Nubefact admite hasta 10 decimales)
    valorUnitario: precio.div(FACTOR_IGV).toDecimalPlaces(10, Prisma.Decimal.ROUND_HALF_UP),
  };
}

// Totales del comprobante = suma de sus líneas (Nubefact exige que coincidan)
export function sumarLineas(lineas: { total: Prisma.Decimal; subtotal: Prisma.Decimal; igv: Prisma.Decimal }[]) {
  const cero = new Prisma.Decimal(0);
  return {
    total: lineas.reduce((s, l) => s.add(l.total), cero),
    subtotal: lineas.reduce((s, l) => s.add(l.subtotal), cero),
    igv: lineas.reduce((s, l) => s.add(l.igv), cero),
  };
}
