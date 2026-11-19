"use client";

import { useCallback, useEffect, useState } from "react";
import ProductoForm from "./producto-form";
import ProductosTabla, { type EstadoCarga } from "./productos-tabla";
import EditarProducto from "./editar-producto";
import ConfirmarEliminarProducto from "./confirmar-eliminar";
import type { Producto } from "./producto-campos";

type RespuestaLista = { ok: true; total: number; productos: Producto[] } | { ok: false; error: string };

async function obtenerProductos(): Promise<Producto[]> {
   const res = await fetch("/api/productos", { cache: "no-store" });
   const datos = (await res.json()) as RespuestaLista;
   if (!res.ok || !datos.ok) throw new Error("No se pudieron cargar los productos");
   return datos.productos;
}

// Coordina el formulario, la tabla y los diálogos de editar/eliminar productos
export default function ProductosPanel() {
   const [productos, setProductos] = useState<Producto[]>([]);
   const [estado, setEstado] = useState<EstadoCarga>("cargando");
   const [version, setVersion] = useState(0); // cambiarlo vuelve a pedir la lista
   const [aEditar, setAEditar] = useState<Producto | null>(null);
   const [aEliminar, setAEliminar] = useState<Producto | null>(null);

   useEffect(() => {
      let vigente = true;
      obtenerProductos().then(
         (lista) => {
            if (!vigente) return;
            setProductos(lista);
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
         <ProductoForm onRegistrado={recargar} />
         <ProductosTabla
            productos={productos}
            estado={estado}
            onReintentar={reintentar}
            onEditar={setAEditar}
            onEliminar={setAEliminar}
         />
         <EditarProducto producto={aEditar} onCerrar={() => setAEditar(null)} onGuardado={recargar} />
         <ConfirmarEliminarProducto producto={aEliminar} onCerrar={() => setAEliminar(null)} onEliminado={recargar} />
      </div>
   );
}
