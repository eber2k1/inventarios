"use client";

import { Button, Chip, Spinner, Table } from "@heroui/react";
import { IoEyeOutline, IoReceiptOutline } from "react-icons/io5";
import { formatoFecha, formatoSoles, numeroComprobante } from "@/lib/formato";
import { ESTADO_SUNAT, NOMBRE_TIPO, nombreClienteVenta, type Venta } from "./tipos";

export type EstadoCarga = "cargando" | "error" | "listo";

type Props = {
   ventas: Venta[];
   estado: EstadoCarga;
   onReintentar: () => void;
   onVer: (venta: Venta) => void;
};

export default function VentasTabla({ ventas, estado, onReintentar, onVer }: Props) {
   const totalVendido = ventas.reduce((suma, v) => suma + Math.round(Number(v.total) * 100), 0);

   return (
      <section aria-labelledby="lista-ventas" className="flex flex-col gap-4">
         <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="lista-ventas" className="text-lg font-semibold">Ventas registradas</h2>
            {estado === "listo" && ventas.length > 0 && (
               <p className="text-sm text-subtle">
                  {ventas.length} {ventas.length === 1 ? "comprobante" : "comprobantes"} · {formatoSoles(totalVendido / 100)}
               </p>
            )}
         </div>

         {estado === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border-2 border-line bg-paper px-6 py-8">
               <p className="font-semibold">No se pudieron cargar las ventas</p>
               <p className="text-sm text-subtle">Revisa tu conexión e inténtalo de nuevo.</p>
               <Button variant="secondary" onPress={onReintentar}>Reintentar</Button>
            </div>
         ) : (
            <Table>
               <Table.ScrollContainer>
                  <Table.Content aria-label="Ventas registradas" aria-busy={estado === "cargando"} className="min-w-[820px]">
                     <Table.Header>
                        <Table.Column isRowHeader>Comprobante</Table.Column>
                        <Table.Column>Fecha</Table.Column>
                        <Table.Column>Cliente</Table.Column>
                        <Table.Column className="text-end">Total</Table.Column>
                        <Table.Column>SUNAT</Table.Column>
                        <Table.Column className="text-end">Acciones</Table.Column>
                     </Table.Header>
                     <Table.Body
                        items={estado === "listo" ? ventas : []}
                        renderEmptyState={() =>
                           estado === "cargando" ? (
                              <div className="flex items-center justify-center gap-3 py-10 text-subtle">
                                 <Spinner size="sm" />
                                 <span>Cargando ventas…</span>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-subtle">
                                 <IoReceiptOutline aria-hidden="true" className="text-3xl" />
                                 <span>Todavía no hay ventas registradas.</span>
                              </div>
                           )
                        }
                     >
                        {(venta) => (
                           <Table.Row id={venta.id}>
                              <Table.Cell>
                                 <span className="flex items-center gap-2">
                                    <Chip size="sm" variant="soft" color={venta.tipo === "FACTURA" ? "accent" : "default"}>
                                       {NOMBRE_TIPO[venta.tipo]}
                                    </Chip>
                                    <span className="font-mono tabular-nums">{numeroComprobante(venta)}</span>
                                 </span>
                              </Table.Cell>
                              <Table.Cell className="tabular-nums">{formatoFecha(venta.fecha)}</Table.Cell>
                              <Table.Cell>
                                 {venta.cliente ? nombreClienteVenta(venta.cliente) : <span className="text-subtle">Clientes varios</span>}
                              </Table.Cell>
                              <Table.Cell className="text-end font-semibold tabular-nums">{formatoSoles(venta.total)}</Table.Cell>
                              <Table.Cell>
                                 <Chip size="sm" variant="soft" color={ESTADO_SUNAT[venta.estadoSunat].color}>
                                    {ESTADO_SUNAT[venta.estadoSunat].texto}
                                 </Chip>
                              </Table.Cell>
                              <Table.Cell>
                                 <div className="flex justify-end">
                                    <Button
                                       isIconOnly
                                       size="sm"
                                       variant="ghost"
                                       aria-label={`Ver detalle de ${numeroComprobante(venta)}`}
                                       onPress={() => onVer(venta)}
                                    >
                                       <IoEyeOutline aria-hidden="true" className="text-lg" />
                                    </Button>
                                 </div>
                              </Table.Cell>
                           </Table.Row>
                        )}
                     </Table.Body>
                  </Table.Content>
               </Table.ScrollContainer>
            </Table>
         )}
      </section>
   );
}
