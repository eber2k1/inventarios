"use client";

import { useState } from "react";
import { Button, Form, Modal, toast } from "@heroui/react";
import { IoCreateOutline } from "react-icons/io5";
import { formatoSoles } from "@/lib/formato";
import ProductoCampos, { guardarProducto, type ErroresProducto, type Producto } from "./producto-campos";

type Props = {
   producto: Producto | null; // producto a editar; null = modal cerrado
   onCerrar: () => void;
   onGuardado: () => void; // se llama tras guardar (o si ya no existía) para recargar la lista
};

// Edita un producto con PUT /api/productos/[id]
export default function EditarProducto({ producto, onCerrar, onGuardado }: Props) {
   const [guardando, setGuardando] = useState(false);
   const [erroresServidor, setErroresServidor] = useState<ErroresProducto>({});
   // Último producto mostrado: mantiene el contenido durante la animación de cierre
   const [mostrado, setMostrado] = useState<Producto | null>(producto);
   if (producto && producto !== mostrado) {
      setMostrado(producto);
      setErroresServidor({});
   }

   async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      if (!producto) return;

      setGuardando(true);
      setErroresServidor({});
      const resultado = await guardarProducto(e.currentTarget, {
         url: `/api/productos/${encodeURIComponent(producto.id)}`,
         method: "PUT",
      });
      setGuardando(false);

      if (resultado.ok) {
         const { nombre, codigo, precioConIgv } = resultado.producto;
         toast.success("Producto actualizado", { description: `${nombre} · ${codigo} · ${formatoSoles(precioConIgv)}` });
         onGuardado();
         onCerrar();
         return;
      }

      toast.danger("No se pudo actualizar el producto", { description: resultado.mensaje });
      if (resultado.status === 404) {
         onGuardado();
         onCerrar();
         return;
      }
      setErroresServidor(resultado.errores);
   }

   return (
      <Modal.Backdrop
         isOpen={producto !== null}
         onOpenChange={(abierto) => {
            if (!abierto && !guardando) onCerrar();
         }}
         isDismissable={!guardando}
         isKeyboardDismissDisabled={guardando}
      >
         <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog>
               {mostrado && (
                  <Form key={mostrado.id} onSubmit={onSubmit} validationErrors={erroresServidor}>
                     <Modal.CloseTrigger isDisabled={guardando} />
                     <Modal.Header>
                        <Modal.Icon>
                           <IoCreateOutline aria-hidden="true" className="size-5" />
                        </Modal.Icon>
                        <Modal.Heading>Editar producto</Modal.Heading>
                        <p className="text-sm text-muted">
                           {mostrado.nombre} · Los campos marcados con * son obligatorios.
                        </p>
                     </Modal.Header>
                     <Modal.Body className="grid gap-5 md:grid-cols-2">
                        {/* El widget de Cloudinary va dentro del modal: fuera de él quedaría inactivo (inert) */}
                        <ProductoCampos variante="secondary" valores={mostrado} widgetEnLinea />
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
