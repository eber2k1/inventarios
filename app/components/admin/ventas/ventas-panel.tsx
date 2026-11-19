"use client";

import { useCallback, useEffect, useState } from "react";
import VentaForm from "./venta-form";
import VentasTabla, { type EstadoCarga } from "./ventas-tabla";
import DetalleVenta from "./detalle-venta";
import type { Venta } from "./tipos";

type RespuestaLista = { ok: true; total: number; ventas: Venta[] } | { ok: false; error: string };

async function obtenerVentas(): Promise<Venta[]> {
   const res = await fetch("/api/ventas", { cache: "no-store" });
   const datos = (await res.json()) as RespuestaLista;
   if (!res.ok || !datos.ok) throw new Error("No se pudieron cargar las ventas");
   return datos.ventas;
}

// Coordina el formulario de nueva venta, la tabla de comprobantes y el modal de detalle
export default function VentasPanel() {
   const [ventas, setVentas] = useState<Venta[]>([]);
   const [estado, setEstado] = useState<EstadoCarga>("cargando");
   const [version, setVersion] = useState(0);
   const [aVer, setAVer] = useState<Venta | null>(null);

   useEffect(() => {
      let vigente = true;
      obtenerVentas().then(
         (lista) => {
            if (!vigente) return;
            setVentas(lista);
            setEstado("listo");
         },
         () => {
            if (vigente) setEstado("error");
         },
      );
      return () => {
         vigente = false;
      };
   }, [version]);

   const recargar = useCallback(() => setVersion((v) => v + 1), []);
   const reintentar = useCallback(() => {
      setEstado("cargando");
      recargar();
   }, [recargar]);

   return (
      <div className="flex flex-col gap-8">
         <VentaForm onRegistrada={recargar} />
         <VentasTabla ventas={ventas} estado={estado} onReintentar={reintentar} onVer={setAVer} />
         <DetalleVenta venta={aVer} onCerrar={() => setAVer(null)} onActualizada={recargar} />
      </div>
   );
}
