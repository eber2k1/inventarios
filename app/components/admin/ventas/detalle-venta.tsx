"use client";

import { useEffect, useState } from "react";
import { Button, Chip, Link, Modal, Spinner, Table, toast } from "@heroui/react";
import { IoReceiptOutline } from "react-icons/io5";
import { formatoFecha, formatoSoles, numeroComprobante } from "@/lib/formato";
import { ESTADO_SUNAT, NOMBRE_TIPO, nombreClienteVenta, type Venta, type VentaDetalle } from "./tipos";

type Estado = { id: string; venta: VentaDetalle | null; error: boolean };
type RespuestaApi = { ok: true; venta: VentaDetalle } | { ok: false; error: string };

// Enlaces a los archivos que genera Nubefact (se abren en otra pestaña)
function Archivos({ venta }: { venta: VentaDetalle }) {
   const archivos = [
      { texto: "PDF", url: venta.enlacePdf },
      { texto: "XML", url: venta.enlaceXml },
      { texto: "CDR", url: venta.enlaceCdr },
   ].filter((a): a is { texto: string; url: string } => !!a.url);
   if (!archivos.length) return null;
   return (
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Archivos del comprobante">
         {archivos.map((a) => (
            <li key={a.texto}>
               <Link href={a.url} target="_blank" rel="noopener noreferrer">
                  {a.texto}
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                  <Link.Icon />
               </Link>
            </li>
         ))}
      </ul>
   );
}

// Muestra el detalle de una venta (GET /api/ventas/[id]) en un modal, con su estado en SUNAT.
// Si quedó pendiente o enviada, permite reintentar / actualizar (POST /api/ventas/[id]/enviar).
export default function DetalleVenta({
   venta,
   onCerrar,
   onActualizada,
}: {
   venta: Venta | null;
   onCerrar: () => void;
   onActualizada: () => void;
}) {
   // Último resumen mostrado: mantiene la cabecera durante la animación de cierre
   const [mostrada, setMostrada] = useState<Venta | null>(venta);
   if (venta && venta !== mostrada) setMostrada(venta);

   const [detalle, setDetalle] = useState<Estado | null>(null);
   const [recarga, setRecarga] = useState(0);
   const [sincronizando, setSincronizando] = useState(false);

   useEffect(() => {
      if (!venta) return;
      let vigente = true;
      fetch(`/api/ventas/${encodeURIComponent(venta.id)}`, { cache: "no-store" })
         .then((r) => r.json())
         .then(
            (d) => vigente && setDetalle({ id: venta.id, venta: d.ok ? d.venta : null, error: !d.ok }),
            () => vigente && setDetalle({ id: venta.id, venta: null, error: true }),
         );
      return () => {
         vigente = false;
      };
   }, [venta, recarga]);

   const actual = detalle && detalle.id === mostrada?.id ? detalle : null;
   const cliente = mostrada?.cliente ?? null;
   const v = actual?.venta ?? null;
   const puedeSincronizar = v?.estadoSunat === "PENDIENTE" || v?.estadoSunat === "ENVIADO";

   async function sincronizar() {
      if (!v) return;
      setSincronizando(true);
      try {
         const res = await fetch(`/api/ventas/${encodeURIComponent(v.id)}/enviar`, { method: "POST" });
         const datos = (await res.json().catch(() => null)) as RespuestaApi | null;
         if (datos?.ok) {
            setDetalle({ id: v.id, venta: datos.venta, error: false });
            const estado = ESTADO_SUNAT[datos.venta.estadoSunat].texto.toLowerCase();
            toast.success(`${numeroComprobante(v)}: ${estado}`, {
               description: datos.venta.sunatDescripcion ?? undefined,
            });
            onActualizada();
            return;
         }
         const mensaje = datos?.error ?? `El servidor respondió con un error inesperado (HTTP ${res.status}).`;
         toast.danger("No se pudo enviar a SUNAT", { description: mensaje, timeout: 0 });
         if (mensaje.includes("se anuló")) {
            // Nubefact lo rechazó: la venta ya no existe
            onActualizada();
            onCerrar();
         } else {
            setRecarga((n) => n + 1);
         }
      } catch {
         toast.danger("No se pudo enviar a SUNAT", { description: "No hay conexión con el servidor. Inténtalo de nuevo." });
      } finally {
         setSincronizando(false);
      }
   }

   return (
      <Modal.Backdrop isOpen={venta !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
         <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="sm:max-w-2xl">
               {mostrada && (
                  <>
                     <Modal.CloseTrigger />
                     <Modal.Header>
                        <Modal.Icon>
                           <IoReceiptOutline aria-hidden="true" className="size-5" />
                        </Modal.Icon>
                        <Modal.Heading>
                           {NOMBRE_TIPO[mostrada.tipo]} {numeroComprobante(mostrada)}
                        </Modal.Heading>
                        <p className="text-sm text-muted">
                           {formatoFecha(mostrada.fecha)} ·{" "}
                           {cliente
                              ? `${nombreClienteVenta(cliente)} (${cliente.tipoDocumento} ${cliente.numeroDocumento})`
                              : "Clientes varios"}
                        </p>
                     </Modal.Header>
                     <Modal.Body className="flex flex-col gap-5">
                        {!actual ? (
                           <div className="flex items-center gap-3 py-6 text-muted">
                              <Spinner size="sm" />
                              <span>Cargando detalle…</span>
                           </div>
                        ) : actual.error || !v ? (
                           <p role="alert" className="text-danger">No se pudo cargar el detalle de la venta.</p>
                        ) : (
                           <>
                              <section
                                 aria-labelledby="estado-sunat"
                                 className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3"
                              >
                                 <div className="flex flex-wrap items-center gap-3">
                                    <h3 id="estado-sunat" className="text-sm font-medium">Estado en SUNAT</h3>
                                    <Chip size="sm" variant="soft" color={ESTADO_SUNAT[v.estadoSunat].color}>
                                       {ESTADO_SUNAT[v.estadoSunat].texto}
                                    </Chip>
                                    {v.enviadoEn && (
                                       <span className="text-xs text-muted">Consultado {formatoFecha(v.enviadoEn)}</span>
                                    )}
                                 </div>
                                 {v.sunatDescripcion && <p className="text-sm">{v.sunatDescripcion}</p>}
                                 {v.sunatError && (
                                    <p className={v.estadoSunat === "RECHAZADO" ? "text-sm text-danger" : "text-sm text-muted"}>
                                       {v.sunatError}
                                    </p>
                                 )}
                                 {v.estadoSunat === "PENDIENTE" && !v.sunatError && (
                                    <p className="text-sm text-muted">Nubefact aún no confirmó este comprobante.</p>
                                 )}
                                 <Archivos venta={v} />
                              </section>

                              <Table>
                                 <Table.ScrollContainer>
                                    <Table.Content aria-label="Productos vendidos" className="min-w-[400px]">
                                       <Table.Header>
                                          <Table.Column isRowHeader>Producto</Table.Column>
                                          <Table.Column className="text-end">Cant.</Table.Column>
                                          <Table.Column className="text-end">P. unit.</Table.Column>
                                          <Table.Column className="text-end">Importe</Table.Column>
                                       </Table.Header>
                                       <Table.Body items={v.detalles}>
                                          {(d) => (
                                             <Table.Row id={d.id}>
                                                <Table.Cell>
                                                   {d.producto.nombre}{" "}
                                                   <span className="font-mono text-xs text-muted">{d.producto.codigo}</span>
                                                </Table.Cell>
                                                <Table.Cell className="text-end tabular-nums">{d.cantidad}</Table.Cell>
                                                <Table.Cell className="text-end tabular-nums">{formatoSoles(d.precioUnitario)}</Table.Cell>
                                                <Table.Cell className="text-end tabular-nums">{formatoSoles(d.total)}</Table.Cell>
                                             </Table.Row>
                                          )}
                                       </Table.Body>
                                    </Table.Content>
                                 </Table.ScrollContainer>
                              </Table>
                              <dl className="ms-auto grid grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
                                 <dt className="text-muted">Op. gravada</dt>
                                 <dd className="text-end">{formatoSoles(v.subtotal)}</dd>
                                 <dt className="text-muted">IGV (18 %)</dt>
                                 <dd className="text-end">{formatoSoles(v.igv)}</dd>
                                 <dt className="text-base font-semibold">Total</dt>
                                 <dd className="text-end text-base font-semibold">{formatoSoles(v.total)}</dd>
                              </dl>
                           </>
                        )}
                     </Modal.Body>
                     <Modal.Footer>
                        <Button slot="close" variant="tertiary">
                           Cerrar
                        </Button>
                        {puedeSincronizar && (
                           <Button variant="primary" isPending={sincronizando} onPress={sincronizar}>
                              {sincronizando
                                 ? "Consultando a SUNAT…"
                                 : v.estadoSunat === "PENDIENTE"
                                   ? "Reintentar envío"
                                   : "Actualizar estado"}
                           </Button>
                        )}
                     </Modal.Footer>
                  </>
               )}
            </Modal.Dialog>
         </Modal.Container>
      </Modal.Backdrop>
   );
}
