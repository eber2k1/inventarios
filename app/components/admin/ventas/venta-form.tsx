"use client";

import { useEffect, useMemo, useState } from "react";
import {
   Button,
   ComboBox,
   Description,
   FieldError,
   Input,
   Label,
   ListBox,
   NumberField,
   Radio,
   RadioGroup,
   toast,
} from "@heroui/react";
import { IoAddOutline, IoCloseOutline } from "react-icons/io5";
import { formatoSoles, numeroComprobante } from "@/lib/formato";
import type { Producto } from "../productos/producto-campos";
import { NOMBRE_TIPO, nombreClienteVenta, type ClienteVenta, type TipoComprobante, type VentaDetalle } from "./tipos";

type Linea = { clave: number; productoId: string | null; cantidad: number };
type Errores = Record<string, string[]>;
type RespuestaApi = { ok: true; venta: VentaDetalle; aviso?: string } | { ok: false; error: string; campos?: Errores };

const IGV = 0.18;
// SUNAT: desde S/ 700 la boleta debe identificar al cliente (el servidor aplica la misma regla)
const BOLETA_MAXIMO_SIN_CLIENTE_CENTIMOS = 700_00;
let siguienteClave = 1;
const lineaVacia = (): Linea => ({ clave: siguienteClave++, productoId: null, cantidad: 1 });

// Catálogos para el formulario: clientes y productos activos (con su stock actual)
function useCatalogos(version: number) {
   const [clientes, setClientes] = useState<ClienteVenta[]>([]);
   const [productos, setProductos] = useState<Producto[]>([]);
   const [error, setError] = useState(false);

   useEffect(() => {
      let vigente = true;
      Promise.all([
         fetch("/api/clientes", { cache: "no-store" }).then((r) => r.json()),
         fetch("/api/productos?activos=1", { cache: "no-store" }).then((r) => r.json()),
      ]).then(
         ([c, p]) => {
            if (!vigente) return;
            if (!c.ok || !p.ok) return setError(true);
            setClientes(c.clientes);
            setProductos(p.productos);
            setError(false);
         },
         () => vigente && setError(true),
      );
      return () => {
         vigente = false;
      };
   }, [version]);

   return { clientes, productos, error };
}

// Formulario "Nueva venta": emite una boleta o factura con POST /api/ventas.
// El total que se muestra es orientativo: el servidor recalcula todo con los precios de la BD.
export default function VentaForm({ onRegistrada }: { onRegistrada: () => void }) {
   const [catalogo, setCatalogo] = useState(0);
   const { clientes, productos, error: errorCatalogo } = useCatalogos(catalogo);

   const [tipo, setTipo] = useState<TipoComprobante>("BOLETA");
   const [clienteId, setClienteId] = useState<string | null>(null);
   const [lineas, setLineas] = useState<Linea[]>(() => [lineaVacia()]);
   const [errores, setErrores] = useState<Errores>({});
   const [enviando, setEnviando] = useState(false);

   const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
   const esFactura = tipo === "FACTURA";
   const clientesElegibles = esFactura ? clientes.filter((c) => c.tipoDocumento === "RUC") : clientes;

   // Resumen en céntimos (sin errores de coma flotante). Igual que el servidor y Nubefact:
   // la op. gravada se calcula por línea (total / 1.18) y luego se suma.
   const { totalCentimos, subtotalCentimos } = lineas.reduce(
      (suma, l) => {
         const p = l.productoId ? productoPorId.get(l.productoId) : undefined;
         const total = p ? Math.round(Number(p.precioConIgv) * 100) * l.cantidad : 0;
         return {
            totalCentimos: suma.totalCentimos + total,
            subtotalCentimos: suma.subtotalCentimos + Math.round(total / (1 + IGV)),
         };
      },
      { totalCentimos: 0, subtotalCentimos: 0 },
   );
   const requiereCliente = esFactura || totalCentimos >= BOLETA_MAXIMO_SIN_CLIENTE_CENTIMOS;

   function cambiarTipo(nuevo: TipoComprobante) {
      setTipo(nuevo);
      // La factura solo admite clientes con RUC
      if (nuevo === "FACTURA" && clienteId && clientes.find((c) => c.id === clienteId)?.tipoDocumento !== "RUC") {
         setClienteId(null);
      }
      setErrores((e) => ({ ...e, clienteId: [] }));
   }

   function actualizarLinea(clave: number, cambios: Partial<Linea>) {
      setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
   }

   async function emitir(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const items = lineas
         .filter((l) => l.productoId)
         .map((l) => ({ productoId: l.productoId!, cantidad: l.cantidad }));

      if (items.length === 0) {
         setErrores({ "items.0.productoId": ["Elige al menos un producto"] });
         return;
      }

      setEnviando(true);
      setErrores({});
      try {
         const res = await fetch("/api/ventas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tipo, clienteId, items }),
         });
         const datos = (await res.json().catch(() => null)) as RespuestaApi | null;

         if (datos?.ok) {
            const { venta } = datos;
            const comprobante = `${NOMBRE_TIPO[venta.tipo]} ${numeroComprobante(venta)} · ${formatoSoles(venta.total)}`;
            const verPdf = venta.enlacePdf
               ? { children: "Ver PDF", onPress: () => window.open(venta.enlacePdf!, "_blank", "noopener,noreferrer") }
               : undefined;
            if (datos.aviso) {
               toast.warning("Venta registrada, pendiente de envío a SUNAT", {
                  description: `${comprobante}. ${datos.aviso}`,
                  timeout: 0,
               });
            } else if (venta.estadoSunat === "RECHAZADO") {
               toast.danger("SUNAT rechazó el comprobante", {
                  description: `${comprobante}. ${venta.sunatError ?? venta.sunatDescripcion ?? "Revisa el detalle de la venta."}`,
                  actionProps: verPdf,
                  timeout: 0,
               });
            } else {
               toast.success(
                  venta.estadoSunat === "ACEPTADO" ? "Comprobante emitido y aceptado por SUNAT" : "Comprobante emitido",
                  {
                     description:
                        venta.estadoSunat === "ACEPTADO" ? comprobante : `${comprobante}. SUNAT aún no confirma la recepción.`,
                     actionProps: verPdf,
                     timeout: 8000,
                  },
               );
            }
            setClienteId(null);
            setLineas([lineaVacia()]);
            setCatalogo((v) => v + 1); // el stock cambió
            onRegistrada();
            return;
         }

         // Las claves de error usan el índice de los ítems enviados (sin líneas vacías)
         const enviadas = lineas.filter((l) => l.productoId);
         const remapeados: Errores = {};
         for (const [clave, mensajes] of Object.entries(datos?.campos ?? {})) {
            const m = clave.match(/^items\.(\d+)\.(\w+)$/);
            const linea = m ? enviadas[Number(m[1])] : undefined;
            remapeados[linea ? `items.${lineas.indexOf(linea)}.${m![2]}` : clave] = mensajes;
         }
         setErrores(remapeados);
         toast.danger("No se pudo emitir la venta", {
            description: datos?.error ?? `El servidor respondió con un error inesperado (HTTP ${res.status}).`,
            // Los rechazos de Nubefact traen mensajes largos: no se cierran solos
            timeout: datos?.error?.includes("Nubefact") ? 0 : undefined,
         });
         if (res.status === 409 || res.status === 422 || res.status === 502) setCatalogo((v) => v + 1); // refresca el stock mostrado
      } catch {
         toast.danger("No se pudo emitir la venta", {
            description: "No hay conexión con el servidor. Revisa la lista de ventas antes de reintentar.",
         });
         onRegistrada(); // la venta pudo registrarse aunque no llegó la respuesta
      } finally {
         setEnviando(false);
      }
   }

   const errorDe = (clave: string) => errores[clave]?.[0];

   return (
      <section aria-labelledby="nueva-venta" className="rounded-xl border-2 border-line bg-paper px-6 py-8 md:px-8">
         <h2 id="nueva-venta" className="text-lg font-semibold">Nueva venta</h2>
         <p className="mt-1 text-sm text-subtle">
            Elige el comprobante, el cliente y los productos. Los precios ya incluyen IGV. Al emitir, el comprobante
            se envía a SUNAT a través de Nubefact.
         </p>
         {errorCatalogo && (
            <p role="alert" className="mt-4 text-sm text-danger">
               No se pudieron cargar los clientes o productos.{" "}
               <button type="button" className="underline" onClick={() => setCatalogo((v) => v + 1)}>
                  Reintentar
               </button>
            </p>
         )}

         <form className="mt-6 flex flex-col gap-6" onSubmit={emitir} noValidate>
            <div className="grid gap-5 md:grid-cols-2">
               <RadioGroup
                  name="tipo"
                  orientation="horizontal"
                  value={tipo}
                  onChange={(v) => cambiarTipo(v === "FACTURA" ? "FACTURA" : "BOLETA")}
               >
                  <Label>Comprobante</Label>
                  <div className="flex flex-wrap gap-6">
                     {(["BOLETA", "FACTURA"] as const).map((t) => (
                        <Radio key={t} value={t}>
                           <Radio.Content>
                              <Radio.Control>
                                 <Radio.Indicator />
                              </Radio.Control>
                              {NOMBRE_TIPO[t]}
                           </Radio.Content>
                        </Radio>
                     ))}
                  </div>
               </RadioGroup>

               <ComboBox
                  // Al cambiar de tipo cambia la lista de clientes elegibles
                  key={tipo}
                  value={clienteId}
                  onChange={(k) => {
                     setClienteId(k == null ? null : String(k));
                     setErrores((e) => ({ ...e, clienteId: [] }));
                  }}
                  isRequired={requiereCliente}
                  isInvalid={!!errorDe("clienteId")}
                  menuTrigger="focus"
               >
                  <Label>{esFactura ? "Cliente (con RUC)" : requiereCliente ? "Cliente" : "Cliente (opcional)"}</Label>
                  <ComboBox.InputGroup>
                     <Input placeholder={esFactura ? "Busca por razón social o RUC" : "Busca por nombre o documento"} />
                     <ComboBox.Trigger />
                  </ComboBox.InputGroup>
                  <ComboBox.Popover>
                     <ListBox
                        renderEmptyState={() => (
                           <p className="px-3 py-2 text-sm text-subtle">
                              {esFactura ? "No hay clientes con RUC. Regístralos en Clientes." : "Sin resultados."}
                           </p>
                        )}
                     >
                        {clientesElegibles.map((c) => {
                           const nombre = nombreClienteVenta(c);
                           return (
                              <ListBox.Item key={c.id} id={c.id} textValue={`${nombre} ${c.numeroDocumento}`}>
                                 <div className="flex flex-col">
                                    <span>{nombre}</span>
                                    <span className="text-xs text-subtle">
                                       {c.tipoDocumento} {c.numeroDocumento}
                                    </span>
                                 </div>
                                 <ListBox.ItemIndicator />
                              </ListBox.Item>
                           );
                        })}
                     </ListBox>
                  </ComboBox.Popover>
                  {!esFactura && (
                     <Description>
                        {requiereCliente
                           ? "Desde S/ 700 la boleta debe identificar al cliente (DNI o RUC)."
                           : "Sin cliente se emite a nombre de «Clientes varios» (hasta S/ 699.99)."}
                     </Description>
                  )}
                  <FieldError>{errorDe("clienteId")}</FieldError>
               </ComboBox>
            </div>

            <fieldset className="flex flex-col gap-3">
               <legend className="mb-3 text-sm font-medium">Productos</legend>
               {lineas.map((linea, i) => {
                  const producto = linea.productoId ? productoPorId.get(linea.productoId) : undefined;
                  const elegidosEnOtras = new Set(lineas.filter((l) => l !== linea).map((l) => l.productoId));
                  const totalLinea = producto ? Math.round(Number(producto.precioConIgv) * 100) * linea.cantidad : 0;
                  return (
                     <div
                        key={linea.clave}
                        className="grid items-start gap-3 rounded-lg border border-line p-3 md:grid-cols-[1fr_9rem_7rem_auto]"
                     >
                        <ComboBox
                           aria-label={`Producto de la línea ${i + 1}`}
                           value={linea.productoId}
                           onChange={(k) => {
                              actualizarLinea(linea.clave, { productoId: k == null ? null : String(k), cantidad: 1 });
                              setErrores((e) => ({ ...e, [`items.${i}.productoId`]: [], [`items.${i}.cantidad`]: [] }));
                           }}
                           disabledKeys={[...elegidosEnOtras].filter((k): k is string => !!k)}
                           isInvalid={!!errorDe(`items.${i}.productoId`)}
                           menuTrigger="focus"
                        >
                           <ComboBox.InputGroup>
                              <Input placeholder="Busca un producto por nombre o código" />
                              <ComboBox.Trigger />
                           </ComboBox.InputGroup>
                           <ComboBox.Popover>
                              <ListBox renderEmptyState={() => <p className="px-3 py-2 text-sm text-subtle">Sin resultados.</p>}>
                                 {productos.map((p) => (
                                    <ListBox.Item
                                       key={p.id}
                                       id={p.id}
                                       textValue={`${p.nombre} ${p.codigo}`}
                                       isDisabled={p.stock === 0}
                                    >
                                       <div className="flex w-full items-baseline justify-between gap-3">
                                          <span>
                                             {p.nombre} <span className="font-mono text-xs text-subtle">{p.codigo}</span>
                                          </span>
                                          <span className="text-xs tabular-nums text-subtle">
                                             {formatoSoles(p.precioConIgv)} · {p.stock === 0 ? "sin stock" : `${p.stock} en stock`}
                                          </span>
                                       </div>
                                       <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                 ))}
                              </ListBox>
                           </ComboBox.Popover>
                           <FieldError>{errorDe(`items.${i}.productoId`)}</FieldError>
                        </ComboBox>

                        <NumberField
                           aria-label={`Cantidad de la línea ${i + 1}`}
                           value={linea.cantidad}
                           onChange={(v) => actualizarLinea(linea.clave, { cantidad: Number.isFinite(v) && v >= 1 ? Math.trunc(v) : 1 })}
                           minValue={1}
                           maxValue={producto?.stock || undefined}
                           step={1}
                           isDisabled={!producto}
                           isInvalid={!!errorDe(`items.${i}.cantidad`)}
                        >
                           <NumberField.Group>
                              <NumberField.DecrementButton />
                              <NumberField.Input />
                              <NumberField.IncrementButton />
                           </NumberField.Group>
                           <FieldError>{errorDe(`items.${i}.cantidad`)}</FieldError>
                        </NumberField>

                        <p className="self-center text-end tabular-nums" aria-label={`Importe de la línea ${i + 1}`}>
                           {producto ? formatoSoles(totalLinea / 100) : "—"}
                        </p>

                        <Button
                           isIconOnly
                           variant="ghost"
                           aria-label={`Quitar la línea ${i + 1}`}
                           isDisabled={lineas.length === 1}
                           onPress={() => {
                              setLineas((ls) => ls.filter((l) => l.clave !== linea.clave));
                              setErrores({});
                           }}
                        >
                           <IoCloseOutline aria-hidden="true" className="text-lg" />
                        </Button>
                     </div>
                  );
               })}
               <div>
                  <Button
                     variant="secondary"
                     size="sm"
                     isDisabled={lineas.length >= 50 || lineas.length >= productos.length}
                     onPress={() => setLineas((ls) => [...ls, lineaVacia()])}
                  >
                     <IoAddOutline aria-hidden="true" />
                     Agregar producto
                  </Button>
               </div>
            </fieldset>

            <div className="flex flex-col items-stretch gap-4 border-t border-line pt-5 md:flex-row md:items-end md:justify-between">
               <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums md:order-2">
                  <dt className="text-subtle">Op. gravada</dt>
                  <dd className="text-end">{formatoSoles(subtotalCentimos / 100)}</dd>
                  <dt className="text-subtle">IGV (18 %)</dt>
                  <dd className="text-end">{formatoSoles((totalCentimos - subtotalCentimos) / 100)}</dd>
                  <dt className="text-base font-semibold">Total</dt>
                  <dd className="text-end text-base font-semibold">{formatoSoles(totalCentimos / 100)}</dd>
               </dl>
               <Button type="submit" variant="primary" isPending={enviando} className="md:order-1">
                  {enviando ? "Enviando a SUNAT…" : `Emitir ${NOMBRE_TIPO[tipo].toLowerCase()}`}
               </Button>
            </div>
         </form>
      </section>
   );
}
