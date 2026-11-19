"use client";

import { useState } from "react";
import { Button, Form, toast } from "@heroui/react";
import ClienteCampos, { guardarCliente, resumenCliente, type ErroresCampos } from "./cliente-campos";

// Formulario de registro de clientes (POST /api/clientes)
export default function ClienteForm({ onRegistrado }: { onRegistrado?: () => void }) {
   const [enviando, setEnviando] = useState(false);
   const [erroresServidor, setErroresServidor] = useState<ErroresCampos>({});
   // Los campos son controlados: al registrar o limpiar se montan de nuevo, vacíos
   const [versionCampos, setVersionCampos] = useState(0);

   async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const form = e.currentTarget;

      setEnviando(true);
      setErroresServidor({});
      const resultado = await guardarCliente(form, { url: "/api/clientes", method: "POST" });
      setEnviando(false);

      if (resultado.ok) {
         toast.success("Cliente registrado", { description: resumenCliente(resultado.cliente) });
         form.reset();
         onRegistrado?.();
         return;
      }

      setErroresServidor(resultado.errores);
      toast.danger("No se pudo registrar el cliente", { description: resultado.mensaje });
   }

   return (
      <section
         aria-labelledby="registrar-cliente"
         className="rounded-xl border-2 border-line bg-paper px-6 py-8 md:px-8"
      >
         <h2 id="registrar-cliente" className="text-lg font-semibold">Registrar cliente</h2>
         <p className="mt-1 text-sm text-subtle">Los campos marcados con * son obligatorios.</p>

         <Form
            className="mt-6 grid gap-5 md:grid-cols-2"
            onSubmit={onSubmit}
            onReset={() => {
               setErroresServidor({});
               setVersionCampos((n) => n + 1);
            }}
            validationErrors={erroresServidor}
         >
            <ClienteCampos key={versionCampos} />

            <div className="flex flex-wrap gap-3 md:col-span-2">
               <Button type="submit" variant="primary" isPending={enviando}>
                  {enviando ? "Registrando…" : "Registrar cliente"}
               </Button>
               <Button type="reset" variant="secondary" isDisabled={enviando}>Limpiar</Button>
            </div>
         </Form>
      </section>
   );
}
