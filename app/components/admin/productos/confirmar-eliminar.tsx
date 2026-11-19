"use client";

import { useState } from "react";
import { AlertDialog, Button, toast } from "@heroui/react";
import { IoTrashOutline } from "react-icons/io5";
import type { Producto } from "./producto-campos";

type RespuestaEliminar = { ok: true } | { ok: false; error: string };

type Props = {
   producto: Producto | null; // producto a eliminar; null = diálogo cerrado
   onCerrar: () => void;
   onEliminado: () => void; // se llama tras eliminar (o si ya no existía) para recargar la lista
};

// Confirma y elimina un producto con DELETE /api/productos/[id]
export default function ConfirmarEliminarProducto({ producto, onCerrar, onEliminado }: Props) {
   const [eliminando, setEliminando] = useState(false);
   const [mostrado, setMostrado] = useState<Producto | null>(producto);
   if (producto && producto !== mostrado) setMostrado(producto);

   async function eliminar() {
      if (!producto) return;
      setEliminando(true);
      try {
         const res = await fetch(`/api/productos/${encodeURIComponent(producto.id)}`, { method: "DELETE" });
         const datos = (await res.json().catch(() => null)) as RespuestaEliminar | null;

         if (datos?.ok) {
            toast.success("Producto eliminado", { description: `${producto.nombre} · ${producto.codigo}` });
            onEliminado();
         } else if (res.status === 404) {
            toast.danger("No se pudo eliminar el producto", { description: `${producto.nombre} ya no existe.` });
            onEliminado();
         } else {
            // 409: ya tiene ventas; la API explica que conviene desactivarlo
            toast.danger("No se pudo eliminar el producto", {
               description: datos && !datos.ok ? datos.error : `Error inesperado del servidor (HTTP ${res.status}).`,
            });
         }
      } catch {
         toast.danger("No se pudo eliminar el producto", {
            description: "No hay conexión con el servidor. Inténtalo de nuevo.",
         });
      } finally {
         setEliminando(false);
         onCerrar();
      }
   }

   return (
      <AlertDialog.Backdrop
         isOpen={producto !== null}
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
                  <AlertDialog.Heading>¿Eliminar {mostrado?.nombre}?</AlertDialog.Heading>
               </AlertDialog.Header>
               <AlertDialog.Body>
                  <p>
                     Se borrará el producto <span className="font-mono">{mostrado?.codigo}</span>. Si ya aparece en
                     alguna venta no se podrá eliminar: en ese caso desactívalo para que deje de venderse.
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
