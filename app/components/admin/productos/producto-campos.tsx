"use client";

import { FieldError, Input, Label, NumberField, Switch, TextArea, TextField, Description } from "@heroui/react";
import ImagenProducto from "./imagen-producto";

// Campos y lógica compartidos por el registro y la edición de productos.
// Los nombres de los campos coinciden con los de la API (/api/productos y /api/productos/[id]).

export const CAMPOS = ["codigo", "nombre", "precioConIgv", "stock", "stockMinimo", "descripcion", "activo"] as const;
export type CampoProducto = (typeof CAMPOS)[number];
export type ErroresProducto = Partial<Record<CampoProducto, string[]>>;

// Forma de un producto tal como lo devuelve la API (precioConIgv llega como texto: "4.5")
export type Producto = {
   id: string;
   codigo: string;
   nombre: string;
   descripcion: string | null;
   precioConIgv: string;
   stock: number;
   stockMinimo: number;
   activo: boolean;
   imagenUrl: string | null; // URL de la imagen en Cloudinary
   imagenId: string | null; // public_id en Cloudinary
   creadoEn: string;
};

type RespuestaApi =
   | { ok: true; producto: Producto }
   | { ok: false; error: string; campo?: string | null; campos?: Record<string, string[]> };

export type ResultadoGuardar =
   | { ok: true; producto: Producto }
   | { ok: false; status: number; mensaje: string; errores: ErroresProducto }; // status 0 = sin conexión

function erroresParaFormulario(respuesta: Extract<RespuestaApi, { ok: false }>): ErroresProducto {
   const errores: ErroresProducto = {};
   for (const campo of CAMPOS) {
      const mensajes = respuesta.campos?.[campo];
      if (mensajes?.length) errores[campo] = mensajes;
      else if (respuesta.campo === campo) errores[campo] = [respuesta.error];
   }
   return errores;
}

// Envía el formulario a la API (POST para registrar, PUT para editar) e interpreta la respuesta
export async function guardarProducto(
   form: HTMLFormElement,
   destino: { url: string; method: "POST" | "PUT" },
): Promise<ResultadoGuardar> {
   const datos = new FormData(form);
   const cuerpo = {
      codigo: datos.get("codigo"),
      nombre: datos.get("nombre"),
      precioConIgv: datos.get("precioConIgv"),
      stock: datos.get("stock"),
      stockMinimo: datos.get("stockMinimo"),
      descripcion: datos.get("descripcion"),
      // Un switch apagado no se envía en el FormData: se traduce a false explícito
      activo: datos.get("activo") !== null,
      // Imagen subida a Cloudinary (campos ocultos; vacíos = sin imagen)
      imagenUrl: datos.get("imagenUrl"),
      imagenId: datos.get("imagenId"),
   };

   try {
      const res = await fetch(destino.url, {
         method: destino.method,
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(cuerpo),
      });
      const json = (await res.json().catch(() => null)) as RespuestaApi | null;

      if (!json) {
         return { ok: false, status: res.status, mensaje: `El servidor respondió con un error inesperado (HTTP ${res.status}).`, errores: {} };
      }
      if (json.ok) return { ok: true, producto: json.producto };
      return { ok: false, status: res.status, mensaje: json.error, errores: erroresParaFormulario(json) };
   } catch {
      return { ok: false, status: 0, mensaje: "No hay conexión con el servidor. Inténtalo de nuevo.", errores: {} };
   }
}

// Número con 2 decimales; el símbolo "S/" va en la etiqueta (el formato de moneda depende del idioma del navegador)
const FORMATO_PRECIO = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

// Campos del producto. `valores` precarga los datos (edición); sin él quedan vacíos (registro).
// `widgetEnLinea`: el widget de Cloudinary se muestra dentro del formulario (necesario dentro de un modal)
export default function ProductoCampos({
   valores,
   variante = "primary",
   widgetEnLinea = false,
}: {
   valores?: Producto;
   variante?: "primary" | "secondary";
   widgetEnLinea?: boolean;
}) {
   return (
      <>
         <TextField
            isRequired
            name="codigo"
            defaultValue={valores?.codigo}
            validate={(v) => (/^[A-Za-z0-9._-]*$/.test(v.trim()) ? null : "Solo letras, números, punto, guion y guion bajo")}
         >
            <Label>Código</Label>
            <Input variant={variante} placeholder="ARZ-001" maxLength={30} autoComplete="off" className="font-mono" />
            <FieldError />
         </TextField>

         <TextField isRequired name="nombre" defaultValue={valores?.nombre}>
            <Label>Nombre</Label>
            <Input variant={variante} placeholder="Arroz Costeño 1 kg" maxLength={150} autoComplete="off" />
            <FieldError />
         </TextField>

         <NumberField
            isRequired
            name="precioConIgv"
            defaultValue={valores ? Number(valores.precioConIgv) : undefined}
            minValue={0}
            step={0.01}
            formatOptions={FORMATO_PRECIO}
            variant={variante}
         >
            <Label>Precio de venta (S/, con IGV)</Label>
            <NumberField.Group>
               <NumberField.Input placeholder="0.00" />
            </NumberField.Group>
            <Description>El precio que paga el cliente; el IGV ya está incluido.</Description>
            <FieldError />
         </NumberField>

         <div className="grid grid-cols-2 gap-4">
            <NumberField isRequired name="stock" defaultValue={valores?.stock ?? 0} minValue={0} step={1} variant={variante}>
               <Label>Stock</Label>
               <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
               </NumberField.Group>
               <FieldError />
            </NumberField>

            <NumberField
               name="stockMinimo"
               defaultValue={valores?.stockMinimo ?? 0}
               minValue={0}
               step={1}
               variant={variante}
            >
               <Label>Stock mínimo</Label>
               <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
               </NumberField.Group>
               <FieldError />
            </NumberField>
         </div>

         <TextField name="descripcion" defaultValue={valores?.descripcion ?? ""} className="md:col-span-2">
            <Label>Descripción</Label>
            <TextArea variant={variante} placeholder="Opcional: presentación, marca, notas…" rows={2} maxLength={500} />
            <FieldError />
         </TextField>

         <ImagenProducto
            nombre={valores?.nombre}
            enLinea={widgetEnLinea}
            inicial={valores?.imagenUrl && valores.imagenId ? { url: valores.imagenUrl, id: valores.imagenId } : null}
         />

         <Switch name="activo" defaultSelected={valores?.activo ?? true} className="md:col-span-2">
            <Switch.Content>
               <Switch.Control>
                  <Switch.Thumb />
               </Switch.Control>
               Disponible para la venta
            </Switch.Content>
         </Switch>
      </>
   );
}
