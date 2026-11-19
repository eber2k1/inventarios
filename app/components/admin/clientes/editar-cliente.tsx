"use client";

import { useState } from "react";
import { Button, Form, Modal, toast } from "@heroui/react";
import { IoCreateOutline } from "react-icons/io5";
import ClienteCampos, { guardarCliente, resumenCliente, type ErroresCampos } from "./cliente-campos";
import { nombreCliente, type Cliente } from "./clientes-tabla";

type Props = {
   cliente: Cliente | null; // cliente a editar; null = modal cerrado
   onCerrar: () => void;
   onGuardado: () => void; // se llama tras guardar (o si ya no existía) para recargar la lista
};

// Edita los datos de un cliente con PUT /api/clientes/[id]
export default function EditarCliente({ cliente, onCerrar, onGuardado }: Props) {
   const [guardando, setGuardando] = useState(false);
   const [erroresServidor, setErroresServidor] = useState<ErroresCampos>({});
   // Último cliente mostrado: mantiene el contenido durante la animación de cierre (cuando cliente ya es null)
   const [mostrado, setMostrado] = useState<Cliente | null>(cliente);
   if (cliente && cliente !== mostrado) {
      setMostrado(cliente);
      setErroresServidor({});
   }

   async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (!cliente) return;

      setGuardando(true);
      setErroresServidor({});
      const resultado = await guardarCliente(e.currentTarget, {
         url: `/api/clientes/${encodeURIComponent(cliente.id)}`,
         method: "PUT",
      });
      setGuardando(false);

      if (resultado.ok) {
         toast.success("Cliente actualizado", { description: resumenCliente(resultado.cliente) });
         onGuardado();
         onCerrar();
         return;
      }

      toast.danger("No se pudo actualizar el cliente", { description: resultado.mensaje });
      if (resultado.status === 404) {
         // Lo eliminaron mientras se editaba: se cierra y se refresca la lista
         onGuardado();
         onCerrar();
         return;
      }
      setErroresServidor(resultado.errores);
   }

   return (
      <Modal.Backdrop
         isOpen={cliente !== null}
         onOpenChange={(abierto) => {
            if (!abierto && !guardando) onCerrar();
         }}
         isDismissable={!guardando}
         isKeyboardDismissDisabled={guardando}
      >
         <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog>
               {mostrado && (
                  // key: al abrir otro cliente, el formulario se monta de nuevo con sus datos
                  <Form key={mostrado.id} onSubmit={onSubmit} validationErrors={erroresServidor}>
                     <Modal.CloseTrigger isDisabled={guardando} />
                     <Modal.Header>
                        <Modal.Icon>
                           <IoCreateOutline aria-hidden="true" className="size-5" />
                        </Modal.Icon>
                        <Modal.Heading>Editar cliente</Modal.Heading>
                        <p className="text-sm text-muted">
                           {nombreCliente(mostrado)} · Los campos marcados con * son obligatorios.
                        </p>
                     </Modal.Header>
                     <Modal.Body className="grid gap-5 md:grid-cols-2">
                        <ClienteCampos
                           variante="secondary"
                           valores={{
                              tipoDocumento: mostrado.tipoDocumento,
                              dni: mostrado.numeroDocumento,
                              businessName: mostrado.razonSocial ?? "",
                              firstName: mostrado.nombre ?? "",
                              lastName: mostrado.apellido ?? "",
                              address: mostrado.direccion,
                              phone: mostrado.telefono ?? "",
                              email: mostrado.email ?? "",
                           }}
                        />
                     </Modal.Body>
                     <Modal.Footer>
                        <Button slot="close" variant="tertiary" isDisabled={guardando}>
                           Cancelar
                        </Button>
                        <Button type="submit" variant="primary" isPending={guardando}>
                           {guardando ? "Guardando…" : "Guardar cambios"}
                        </Button>
                     </Modal.Footer>
                  </Form>
               )}
            </Modal.Dialog>
         </Modal.Container>
      </Modal.Backdrop>
   );
}
