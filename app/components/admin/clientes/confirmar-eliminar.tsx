"use client";

import { useState } from "react";
import { AlertDialog, Button, toast } from "@heroui/react";
import { IoTrashOutline } from "react-icons/io5";
import { nombreCliente, type Cliente } from "./clientes-tabla";

type RespuestaEliminar =
   | { ok: true; cliente: Pick<Cliente, "id" | "tipoDocumento" | "numeroDocumento" | "razonSocial" | "nombre" | "apellido"> }
   | { ok: false; error: string };

type Props = {
   cliente: Cliente | null; // cliente a eliminar; null = diálogo cerrado
   onCerrar: () => void;
   onEliminado: () => void; // se llama tras eliminar (o si ya no existía) para recargar la lista
};

// Confirma y elimina un cliente con DELETE /api/clientes/[id]
export default function ConfirmarEliminar({ cliente, onCerrar, onEliminado }: Props) {
   const [eliminando, setEliminando] = useState(false);
   // Último cliente mostrado: mantiene el texto durante la animación de cierre (cuando cliente ya es null)
   const [mostrado, setMostrado] = useState<Cliente | null>(cliente);
   if (cliente && cliente !== mostrado) setMostrado(cliente);

   async function eliminar() {
      if (!cliente) return;
      const nombreCompleto = nombreCliente(cliente);
      setEliminando(true);
      try {
         const res = await fetch(`/api/clientes/${encodeURIComponent(cliente.id)}`, { method: "DELETE" });
         const datos = (await res.json().catch(() => null)) as RespuestaEliminar | null;

         if (datos?.ok) {
            toast.success("Cliente eliminado", { description: `${nombreCompleto} · ${cliente.tipoDocumento} ${cliente.numeroDocumento}` });
            onEliminado();
         } else if (res.status === 404) {
            // Ya lo había borrado alguien más: se avisa y se refresca la lista
            toast.danger("No se pudo eliminar el cliente", { description: `${nombreCompleto} ya no existe.` });
            onEliminado();
         } else {
            toast.danger("No se pudo eliminar el cliente", {
               description: datos && !datos.ok ? datos.error : `Error inesperado del servidor (HTTP ${res.status}).`,
            });
         }
      } catch {
         toast.danger("No se pudo eliminar el cliente", {
            description: "No hay conexión con el servidor. Inténtalo de nuevo.",
         });
      } finally {
         setEliminando(false);
         onCerrar();
      }
   }

   return (
      <AlertDialog.Backdrop
         isOpen={cliente !== null}
         onOpenChange={(abierto) => {
            if (!abierto && !eliminando) onCerrar();
         }}
         isDismissable={!eliminando}
         isKeyboardDismissDisabled={eliminando}
      >
         <AlertDialog.Container size="sm">
            <AlertDialog.Dialog>
               <AlertDialog.Header>
                  <AlertDialog.Icon status="danger">
                     <IoTrashOutline aria-hidden="true" className="size-5" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>
                     ¿Eliminar a {mostrado && nombreCliente(mostrado)}?
                  </AlertDialog.Heading>
               </AlertDialog.Header>
               <AlertDialog.Body>
                  <p>
                     Se borrará el cliente con {mostrado?.tipoDocumento}{" "}
                     <span className="font-mono tabular-nums">{mostrado?.numeroDocumento}</span>.
                     Sus comprobantes se conservan, pero quedarán sin cliente asignado. Esta acción no se puede deshacer.
                  </p>
               </AlertDialog.Body>
               <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary" isDisabled={eliminando}>
                     Cancelar
                  </Button>
                  <Button variant="danger" isPending={eliminando} onPress={eliminar}>
                     {eliminando ? "Eliminando…" : "Eliminar"}
                  </Button>
               </AlertDialog.Footer>
            </AlertDialog.Dialog>
         </AlertDialog.Container>
      </AlertDialog.Backdrop>
   );
}
