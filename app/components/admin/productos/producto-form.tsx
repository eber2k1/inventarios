"use client";

import { useState } from "react";
import { Button, Form, toast } from "@heroui/react";
import { formatoSoles } from "@/lib/formato";
import ProductoCampos, { guardarProducto, type ErroresProducto } from "./producto-campos";

// Formulario de registro de productos (POST /api/productos)
export default function ProductoForm({ onRegistrado }: { onRegistrado?: () => void }) {
   const [enviando, setEnviando] = useState(false);
   const [erroresServidor, setErroresServidor] = useState<ErroresProducto>({});
   // Cambiar la clave vuelve a montar los campos: limpia también los NumberField y el Switch
   const [formKey, setFormKey] = useState(0);

   async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setEnviando(true);
      setErroresServidor({});
      const resultado = await guardarProducto(e.currentTarget, { url: "/api/productos", method: "POST" });
      setEnviando(false);

      if (resultado.ok) {
         const { nombre, codigo, precioConIgv } = resultado.producto;
         toast.success("Producto registrado", { description: `${nombre} · ${codigo} · ${formatoSoles(precioConIgv)}` });
         setFormKey((k) => k + 1);
         onRegistrado?.();
         return;
      }

      setErroresServidor(resultado.errores);
      toast.danger("No se pudo registrar el producto", { description: resultado.mensaje });
   }

   function limpiar() {
      setErroresServidor({});
      setFormKey((k) => k + 1);
   }

   return (
      <section aria-labelledby="registrar-producto" className="rounded-xl border-2 border-line bg-paper px-6 py-8 md:px-8">
         <h2 id="registrar-producto" className="text-lg font-semibold">Registrar producto</h2>
         <p className="mt-1 text-sm text-subtle">Los campos marcados con * son obligatorios.</p>

         <Form
            key={formKey}
            className="mt-6 grid gap-5 md:grid-cols-2"
            onSubmit={onSubmit}
            validationErrors={erroresServidor}
         >
            <ProductoCampos />

            <div className="flex flex-wrap gap-3 md:col-span-2">
               <Button type="submit" variant="primary" isPending={enviando}>
                  {enviando ? "Registrando…" : "Registrar producto"}
               </Button>
               <Button variant="secondary" isDisabled={enviando} onPress={limpiar}>Limpiar</Button>
            </div>
         </Form>
      </section>
   );
}
