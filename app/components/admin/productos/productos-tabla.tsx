"use client";

import { Button, Chip, Spinner, Table } from "@heroui/react";
import { IoCreateOutline, IoCubeOutline, IoTrashOutline, IoWarningOutline } from "react-icons/io5";
import { formatoSoles } from "@/lib/formato";
import type { Producto } from "./producto-campos";
import { AvatarProducto } from "./imagen-producto";

export type EstadoCarga = "cargando" | "error" | "listo";

type Props = {
   productos: Producto[];
   estado: EstadoCarga;
   onReintentar: () => void;
   onEditar: (producto: Producto) => void;
   onEliminar: (producto: Producto) => void;
};

export default function ProductosTabla({ productos, estado, onReintentar, onEditar, onEliminar }: Props) {
   const porAgotarse = productos.filter((p) => p.activo && p.stock <= p.stockMinimo).length;

   return (
      <section aria-labelledby="lista-productos" className="flex flex-col gap-4">
         <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="lista-productos" className="text-lg font-semibold">Productos registrados</h2>
            {estado === "listo" && (
               <p className="text-sm text-subtle">
                  {productos.length} {productos.length === 1 ? "producto" : "productos"}
                  {porAgotarse > 0 && ` · ${porAgotarse} con stock bajo`}
               </p>
            )}
         </div>

         {estado === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border-2 border-line bg-paper px-6 py-8">
               <p className="font-semibold">No se pudieron cargar los productos</p>
               <p className="text-sm text-subtle">Revisa tu conexión e inténtalo de nuevo.</p>
               <Button variant="secondary" onPress={onReintentar}>Reintentar</Button>
            </div>
         ) : (
            <Table>
               <Table.ScrollContainer>
                  <Table.Content aria-label="Productos registrados" aria-busy={estado === "cargando"} className="min-w-[720px]">
                     <Table.Header>
                        <Table.Column isRowHeader>Código</Table.Column>
                        <Table.Column>Nombre</Table.Column>
                        <Table.Column className="text-end">Precio</Table.Column>
                        <Table.Column className="text-end">Stock</Table.Column>
                        <Table.Column>Estado</Table.Column>
                        <Table.Column className="text-end">Acciones</Table.Column>
                     </Table.Header>
                     <Table.Body
                        items={estado === "listo" ? productos : []}
                        renderEmptyState={() =>
                           estado === "cargando" ? (
                              <div className="flex items-center justify-center gap-3 py-10 text-subtle">
                                 <Spinner size="sm" />
                                 <span>Cargando productos…</span>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-subtle">
                                 <IoCubeOutline aria-hidden="true" className="text-3xl" />
                                 <span>Todavía no tienes productos registrados.</span>
                              </div>
                           )
                        }
                     >
                        {(producto) => {
                           const stockBajo = producto.stock <= producto.stockMinimo;
                           return (
                              <Table.Row id={producto.id}>
                                 <Table.Cell className="font-mono">{producto.codigo}</Table.Cell>
                                 <Table.Cell>
                                    <div className="flex items-center gap-3">
                                       <AvatarProducto nombre={producto.nombre} imagenId={producto.imagenId} />
                                       <span>{producto.nombre}</span>
                                    </div>
                                 </Table.Cell>
                                 <Table.Cell className="text-end tabular-nums">{formatoSoles(producto.precioConIgv)}</Table.Cell>
                                 <Table.Cell className="text-end tabular-nums">
                                    {stockBajo ? (
                                       <span className="inline-flex items-center gap-1 font-semibold text-warning">
                                          <IoWarningOutline aria-hidden="true" />
                                          {producto.stock}
                                          <span className="sr-only"> (stock bajo, mínimo {producto.stockMinimo})</span>
                                       </span>
                                    ) : (
                                       producto.stock
                                    )}
                                 </Table.Cell>
                                 <Table.Cell>
                                    <Chip size="sm" variant="soft" color={producto.activo ? "success" : "default"}>
                                       {producto.activo ? "Activo" : "Inactivo"}
                                    </Chip>
                                 </Table.Cell>
                                 <Table.Cell>
                                    <div className="flex justify-end gap-1">
                                       <Button
                                          isIconOnly
                                          size="sm"
                                          variant="ghost"
                                          aria-label={`Editar ${producto.nombre}`}
                                          onPress={() => onEditar(producto)}
                                       >
                                          <IoCreateOutline aria-hidden="true" className="text-lg" />
                                       </Button>
                                       <Button
                                          isIconOnly
                                          size="sm"
                                          variant="ghost"
                                          className="text-danger"
                                          aria-label={`Eliminar ${producto.nombre}`}
                                          onPress={() => onEliminar(producto)}
                                       >
                                          <IoTrashOutline aria-hidden="true" className="text-lg" />
                                       </Button>
                                    </div>
                                 </Table.Cell>
                              </Table.Row>
                           );
                        }}
                     </Table.Body>
                  </Table.Content>
               </Table.ScrollContainer>
            </Table>
         )}
      </section>
   );
}
