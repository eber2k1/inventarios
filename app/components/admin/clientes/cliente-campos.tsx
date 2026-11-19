"use client";

import { useRef, useState } from "react";
import type { z } from "zod";
import { Button, FieldError, Input, Label, Radio, RadioGroup, TextField, toast } from "@heroui/react";
import { IoSearchOutline } from "react-icons/io5";
import { crearClienteSchema, REGEX_DNI, REGEX_RUC, type CrearClienteInput } from "@/lib/validations/cliente";

// Campos y lógica compartidos por el formulario de registro y el de edición de clientes

// Campo del formulario → campo que espera la API (/api/clientes y /api/clientes/[id])
const CAMPOS_API = {
   tipoDocumento: "tipoDocumento",
   dni: "numeroDocumento",
   businessName: "razonSocial",
   firstName: "nombre",
   lastName: "apellido",
   address: "direccion",
   phone: "telefono",
   email: "email",
} as const satisfies Record<string, keyof CrearClienteInput>;

export type CampoForm = keyof typeof CAMPOS_API;
export type ClienteFormValues = Record<CampoForm, string>;
export type ErroresCampos = Partial<Record<CampoForm, string[]>>;
type TipoDocumento = CrearClienteInput["tipoDocumento"];

type ClienteRespuesta = {
   id: string;
   tipoDocumento: TipoDocumento;
   numeroDocumento: string;
   razonSocial: string | null;
   nombre: string | null;
   apellido: string | null;
};
type RespuestaApi =
   | { ok: true; cliente: ClienteRespuesta }
   | { ok: false; error: string; campo?: string | null; campos?: Record<string, string[]> };

export type ResultadoGuardar =
   | { ok: true; cliente: ClienteRespuesta }
   | { ok: false; status: number; mensaje: string; errores: ErroresCampos }; // status 0 = sin conexión

// Traduce errores de la API (nombre, direccion...) a los campos del formulario (firstName, address...)
function erroresParaFormulario(respuesta: Extract<RespuestaApi, { ok: false }>): ErroresCampos {
   const errores: ErroresCampos = {};
   for (const [campoForm, campoApi] of Object.entries(CAMPOS_API) as [CampoForm, string][]) {
      const mensajes = respuesta.campos?.[campoApi];
      if (mensajes?.length) errores[campoForm] = mensajes;
      else if (respuesta.campo === campoApi) errores[campoForm] = [respuesta.error];
   }
   return errores;
}

// Envía el formulario a la API (POST para registrar, PUT para editar) e interpreta la respuesta.
// Los campos que no se muestran (p. ej. razón social para un DNI) no van en el cuerpo: la API los deja vacíos.
export async function guardarCliente(
   form: HTMLFormElement,
   destino: { url: string; method: "POST" | "PUT" },
): Promise<ResultadoGuardar> {
   const valores = Object.fromEntries(new FormData(form)) as Partial<ClienteFormValues>;
   const cuerpo = Object.fromEntries(
      (Object.keys(CAMPOS_API) as CampoForm[])
         .filter((campo) => valores[campo] !== undefined)
         .map((campo) => [CAMPOS_API[campo], valores[campo]]),
   );

   try {
      const res = await fetch(destino.url, {
         method: destino.method,
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(cuerpo),
      });
      const datos = (await res.json().catch(() => null)) as RespuestaApi | null;

      if (!datos) {
         return { ok: false, status: res.status, mensaje: `El servidor respondió con un error inesperado (HTTP ${res.status}).`, errores: {} };
      }
      if (datos.ok) return { ok: true, cliente: datos.cliente };
      return { ok: false, status: res.status, mensaje: datos.error, errores: erroresParaFormulario(datos) };
   } catch {
      return { ok: false, status: 0, mensaje: "No hay conexión con el servidor. Inténtalo de nuevo.", errores: {} };
   }
}

// Nombre para los avisos: "Ana Pérez · DNI 01234567" o "Bodega SAC · RUC 20123456789"
export function resumenCliente(c: ClienteRespuesta) {
   const nombre = c.razonSocial ?? [c.nombre, c.apellido].filter(Boolean).join(" ");
   return `${nombre} · ${c.tipoDocumento} ${c.numeroDocumento}`;
}

// Reutiliza las reglas de la API: el formulario valida igual que el servidor
function validar(schema: z.ZodType) {
   return (value: string) => {
      const resultado = schema.safeParse(value);
      return resultado.success ? null : resultado.error.issues[0]?.message;
   };
}

// Respuesta de GET /api/clientes/consulta (Decolecta: RENIEC para DNI, SUNAT para RUC)
type RespuestaConsulta =
   | {
        ok: true;
        datos: {
           nombre: string | null;
           apellido: string | null;
           razonSocial: string | null;
           direccion: string | null;
           estado: string | null;
           condicion: string | null;
        };
        registrado: { id: string; nombre: string } | null;
     }
   | { ok: false; error: string };

// Línea bajo el documento con el origen de los datos consultados
type EstadoConsulta = { texto: string; aviso: boolean } | null;

const reglas = crearClienteSchema.shape;
const obligatorio = (value: string) => (value.trim() ? null : "Obligatorio");

// Campos del cliente. `valores` precarga los datos (edición); sin él quedan vacíos (registro).
// Persona (DNI): nombre y apellido. Empresa (RUC): razón social.
// `variante="secondary"`: para campos sobre una superficie (p. ej. dentro de un modal), con fondo que contrasta
export default function ClienteCampos({
   valores,
   variante = "primary",
}: {
   valores?: Partial<ClienteFormValues>;
   variante?: "primary" | "secondary";
}) {
   const [tipo, setTipo] = useState<TipoDocumento>(valores?.tipoDocumento === "RUC" ? "RUC" : "DNI");
   const esRuc = tipo === "RUC";

   // Campos que se pueden autocompletar con la consulta de DNI/RUC (controlados)
   const [campos, setCampos] = useState({
      dni: valores?.dni ?? "",
      firstName: valores?.firstName ?? "",
      lastName: valores?.lastName ?? "",
      businessName: valores?.businessName ?? "",
      address: valores?.address ?? "",
   });
   const cambiar = (campo: keyof typeof campos) => (value: string) => setCampos((c) => ({ ...c, [campo]: value }));
   const [consultando, setConsultando] = useState(false);
   const [estadoConsulta, setEstadoConsulta] = useState<EstadoConsulta>(null);
   const direccionRef = useRef<HTMLInputElement>(null);

   function validarDocumento(value: string) {
      const v = value.trim();
      if (!v) return "Obligatorio";
      if (esRuc) return REGEX_RUC.test(v) ? null : "El RUC debe tener 11 dígitos y empezar por 10, 15, 17 o 20";
      return REGEX_DNI.test(v) ? null : "El DNI debe tener 8 dígitos";
   }

   // Consulta el documento en RENIEC/SUNAT (vía /api/clientes/consulta) y rellena los campos
   async function consultar() {
      const numero = campos.dni.trim();
      const error = validarDocumento(numero);
      if (error) {
         setEstadoConsulta({ texto: error, aviso: true });
         return;
      }

      setConsultando(true);
      setEstadoConsulta(null);
      try {
         const res = await fetch(`/api/clientes/consulta?tipo=${tipo}&numero=${encodeURIComponent(numero)}`, {
            cache: "no-store",
         });
         const r = (await res.json().catch(() => null)) as RespuestaConsulta | null;
         if (!r?.ok) {
            toast.danger(`No se pudo consultar el ${tipo}`, {
               description: r?.error ?? `El servidor respondió con un error inesperado (HTTP ${res.status}).`,
            });
            return;
         }

         const { datos } = r;
         setCampos((c) => ({
            ...c,
            dni: numero,
            ...(esRuc
               ? { businessName: datos.razonSocial ?? c.businessName }
               : { firstName: datos.nombre ?? c.firstName, lastName: datos.apellido ?? c.lastName }),
            address: datos.direccion ?? c.address,
         }));

         if (esRuc) {
            const enRegla = datos.estado === "ACTIVO" && datos.condicion === "HABIDO";
            const situacion = [datos.estado, datos.condicion].filter(Boolean).join(" · ");
            setEstadoConsulta({
               texto: `SUNAT: ${situacion || "sin estado"}${enRegla ? "" : " — revisa antes de emitir facturas"}`,
               aviso: !enRegla,
            });
         } else {
            setEstadoConsulta({ texto: "Datos de RENIEC. Completa la dirección.", aviso: false });
         }
         // RENIEC no entrega la dirección: el foco pasa a ese campo
         if (!datos.direccion) setTimeout(() => direccionRef.current?.focus(), 0);

         if (r.registrado) {
            toast.warning("Este documento ya está registrado", {
               description: `Cliente existente: ${r.registrado.nombre}`,
            });
         }
      } catch {
         toast.danger(`No se pudo consultar el ${tipo}`, {
            description: "No hay conexión con el servidor. Inténtalo de nuevo.",
         });
      } finally {
         setConsultando(false);
      }
   }

   return (
      <>
         <RadioGroup
            name="tipoDocumento"
            orientation="horizontal"
            value={tipo}
            onChange={(v) => {
               setTipo(v === "RUC" ? "RUC" : "DNI");
               setEstadoConsulta(null);
            }}
            variant={variante}
            className="md:col-span-2"
         >
            <Label>Tipo de documento</Label>
            <div className="flex flex-wrap gap-6">
               <Radio value="DNI">
                  <Radio.Content>
                     <Radio.Control>
                        <Radio.Indicator />
                     </Radio.Control>
                     DNI · persona
                  </Radio.Content>
               </Radio>
               <Radio value="RUC">
                  <Radio.Content>
                     <Radio.Control>
                        <Radio.Indicator />
                     </Radio.Control>
                     RUC · empresa
                  </Radio.Content>
               </Radio>
            </div>
         </RadioGroup>

         <div className="flex flex-col gap-1 md:col-span-2">
            <TextField
               // key: al cambiar el tipo se vuelve a validar con la regla correspondiente
               key={`doc-${tipo}`}
               isRequired
               name="dni"
               value={campos.dni}
               onChange={(v) => {
                  cambiar("dni")(v);
                  setEstadoConsulta(null);
               }}
               validate={validarDocumento}
            >
               <Label>{esRuc ? "RUC" : "DNI"}</Label>
               <div className="flex items-center gap-2">
                  <Input
                     variant={variante}
                     className="min-w-0 max-w-xs flex-1"
                     placeholder={esRuc ? "20123456789" : "01234567"}
                     inputMode="numeric"
                     maxLength={esRuc ? 11 : 8}
                     autoComplete="off"
                     onKeyDown={(e) => {
                        // Enter en el documento consulta en vez de enviar el formulario
                        if (e.key === "Enter") {
                           e.preventDefault();
                           if (!consultando) consultar();
                        }
                     }}
                  />
                  <Button variant="secondary" className="shrink-0" isPending={consultando} onPress={consultar}>
                     {!consultando && <IoSearchOutline aria-hidden="true" />}
                     {consultando ? "Consultando…" : `Consultar ${esRuc ? "RUC" : "DNI"}`}
                  </Button>
               </div>
               <FieldError />
            </TextField>
            <p
               aria-live="polite"
               className={`min-h-5 text-sm ${estadoConsulta?.aviso ? "text-warning" : "text-muted"}`}
            >
               {estadoConsulta?.texto}
            </p>
         </div>

         {esRuc ? (
            <TextField
               isRequired
               name="businessName"
               value={campos.businessName}
               onChange={cambiar("businessName")}
               validate={(v) => obligatorio(v) ?? validar(reglas.razonSocial)(v)}
               className="md:col-span-2"
            >
               <Label>Razón social</Label>
               <Input variant={variante} placeholder="Bodega El Sol S.A.C." maxLength={200} autoComplete="organization" />
               <FieldError />
            </TextField>
         ) : (
            <>
               <TextField
                  isRequired
                  name="firstName"
                  value={campos.firstName}
                  onChange={cambiar("firstName")}
                  validate={(v) => obligatorio(v) ?? validar(reglas.nombre)(v)}
               >
                  <Label>Nombre</Label>
                  <Input variant={variante} placeholder="Ana" maxLength={100} autoComplete="given-name" />
                  <FieldError />
               </TextField>

               <TextField
                  isRequired
                  name="lastName"
                  value={campos.lastName}
                  onChange={cambiar("lastName")}
                  validate={(v) => obligatorio(v) ?? validar(reglas.apellido)(v)}
               >
                  <Label>Apellido</Label>
                  <Input variant={variante} placeholder="Pérez" maxLength={100} autoComplete="family-name" />
                  <FieldError />
               </TextField>
            </>
         )}

         <TextField
            isRequired
            name="address"
            value={campos.address}
            onChange={cambiar("address")}
            validate={validar(reglas.direccion)}
            className="md:col-span-2"
         >
            <Label>{esRuc ? "Dirección fiscal" : "Dirección"}</Label>
            <Input ref={direccionRef} variant={variante} placeholder="Av. Lima 123" maxLength={255} autoComplete="street-address" />
            <FieldError />
         </TextField>

         <TextField name="phone" type="tel" defaultValue={valores?.phone} validate={validar(reglas.telefono)}>
            <Label>Teléfono</Label>
            <Input variant={variante} placeholder="+51 999 888 777" maxLength={20} autoComplete="tel" />
            <FieldError />
         </TextField>

         <TextField name="email" type="email" defaultValue={valores?.email} validate={validar(reglas.email)}>
            <Label>Correo electrónico</Label>
            <Input variant={variante} placeholder="ana@correo.pe" maxLength={150} autoComplete="email" />
            <FieldError />
         </TextField>
      </>
   );
}
