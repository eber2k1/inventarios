"use client";

import { Button, Spinner, Table } from "@heroui/react";
import { IoCreateOutline, IoPeopleOutline, IoTrashOutline } from "react-icons/io5";

// Forma de un cliente tal como lo devuelve GET /api/clientes
export type Cliente = {
   id: string;
   tipoDocumento: "DNI" | "RUC";
   numeroDocumento: string;
   razonSocial: string | null; // empresas (RUC)
   nombre: string | null; // personas (DNI)
   apellido: string | null;
   direccion: string;
   telefono: string | null;
   email: string | null;
   creadoEn: string;
};

// Nombre para mostrar: "Nombre Apellido" (persona) o la razón social (empresa)
export function nombreCliente(c: Pick<Cliente, "nombre" | "apellido" | "razonSocial">) {
   return c.razonSocial ?? [c.nombre, c.apellido].filter(Boolean).join(" ");
}

export type EstadoCarga = "cargando" | "error" | "listo";

type Props = {
   clientes: Cliente[];
   estado: EstadoCarga;
   onReintentar: () => void;
   onEditar: (cliente: Cliente) => void;
   onEliminar: (cliente: Cliente) => void;
};

const SIN_DATO = <span className="text-subtle">—</span>;

export default function ClientesTabla({ clientes, estado, onReintentar, onEditar, onEliminar }: Props) {
   return (
      <section aria-labelledby="lista-clientes" className="flex flex-col gap-4">
         <div className="flex items-baseline justify-between gap-4">
            <h2 id="lista-clientes" className="text-lg font-semibold">Clientes registrados</h2>
            {estado === "listo" && (
               <p className="text-sm text-subtle">
                  {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
               </p>
            )}
         </div>

         {estado === "error" ? (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border-2 border-line bg-paper px-6 py-8">
               <p className="font-semibold">No se pudieron cargar los clientes</p>
               <p className="text-sm text-subtle">Revisa tu conexión e inténtalo de nuevo.</p>
               <Button variant="secondary" onPress={onReintentar}>Reintentar</Button>
            </div>
         ) : (
            <Table>
               <Table.ScrollContainer>
                  <Table.Content aria-label="Clientes registrados" aria-busy={estado === "cargando"} className="min-w-[720px]">
                     <Table.Header>
                        <Table.Column isRowHeader>Documento</Table.Column>
                        <Table.Column>Nombre / Razón social</Table.Column>
                        <Table.Column>Apellido</Table.Column>
                        <Table.Column>Teléfono</Table.Column>
                        <Table.Column>Correo electrónico</Table.Column>
                        <Table.Column className="text-end">Acciones</Table.Column>
                     </Table.Header>
                     <Table.Body
                        items={estado === "listo" ? clientes : []}
                        renderEmptyState={() =>
                           estado === "cargando" ? (
                              <div className="flex items-center justify-center gap-3 py-10 text-subtle">
                                 <Spinner size="sm" />
                                 <span>Cargando clientes…</span>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-subtle">
                                 <IoPeopleOutline aria-hidden="true" className="text-3xl" />
                                 <span>Todavía no tienes clientes registrados.</span>
                              </div>
                           )
                        }
                     >
                        {(cliente) => (
                           <Table.Row id={cliente.id}>
                              <Table.Cell>
                                 <span className="font-mono tabular-nums">{cliente.numeroDocumento}</span>
                                 {cliente.tipoDocumento === "RUC" && <span className="ms-2 text-xs text-subtle">RUC</span>}
                              </Table.Cell>
                              <Table.Cell>{cliente.razonSocial ?? cliente.nombre ?? SIN_DATO}</Table.Cell>
                              <Table.Cell>{cliente.apellido ?? SIN_DATO}</Table.Cell>
                              <Table.Cell className="tabular-nums">{cliente.telefono ?? SIN_DATO}</Table.Cell>
                              <Table.Cell>{cliente.email ?? SIN_DATO}</Table.Cell>
                              <Table.Cell>
                                 <div className="flex justify-end gap-1">
                                    <Button
                                       isIconOnly
                                       size="sm"
                                       variant="ghost"
                                       aria-label={`Editar a ${nombreCliente(cliente)}`}
                                       onPress={() => onEditar(cliente)}
                                    >
                                       <IoCreateOutline aria-hidden="true" className="text-lg" />
                                    </Button>
                                    <Button
                                       isIconOnly
                                       size="sm"
                                       variant="ghost"
                                       className="text-danger"
                                       aria-label={`Eliminar a ${nombreCliente(cliente)}`}
                                       onPress={() => onEliminar(cliente)}
                                    >
                                       <IoTrashOutline aria-hidden="true" className="text-lg" />
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
