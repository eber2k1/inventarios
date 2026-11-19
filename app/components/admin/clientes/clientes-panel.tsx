"use client";

import { useCallback, useEffect, useState } from "react";
import ClienteForm from "./cliente-form";
import ClientesTabla, { type Cliente, type EstadoCarga } from "./clientes-tabla";
import ConfirmarEliminar from "./confirmar-eliminar";
import EditarCliente from "./editar-cliente";

type RespuestaLista = { ok: true; total: number; clientes: Cliente[] } | { ok: false; error: string };

async function obtenerClientes(): Promise<Cliente[]> {
   const res = await fetch("/api/clientes", { cache: "no-store" });
   const datos = (await res.json()) as RespuestaLista;
   if (!res.ok || !datos.ok) throw new Error("No se pudieron cargar los clientes");
   return datos.clientes;
}

// Coordina el formulario, la tabla y los diálogos de editar/eliminar:
// tras registrar, editar o eliminar un cliente, la lista se vuelve a cargar
export default function ClientesPanel() {
   const [clientes, setClientes] = useState<Cliente[]>([]);
   const [estado, setEstado] = useState<EstadoCarga>("cargando");
   // Cambiar este número vuelve a pedir la lista a la API
   const [version, setVersion] = useState(0);
   // Cliente pendiente de confirmar su eliminación (null = sin diálogo abierto)
   const [aEliminar, setAEliminar] = useState<Cliente | null>(null);
   // Cliente que se está editando (null = sin modal abierto)
   const [aEditar, setAEditar] = useState<Cliente | null>(null);

   useEffect(() => {
      let vigente = true; // ignora respuestas que lleguen después de desmontar o de otra recarga
      obtenerClientes().then(
         (lista) => {
            if (!vigente) return;
            setClientes(lista);
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
         <ClienteForm onRegistrado={recargar} />
         <ClientesTabla
            clientes={clientes}
            estado={estado}
            onReintentar={reintentar}
            onEditar={setAEditar}
            onEliminar={setAEliminar}
         />
         <EditarCliente cliente={aEditar} onCerrar={() => setAEditar(null)} onGuardado={recargar} />
         <ConfirmarEliminar cliente={aEliminar} onCerrar={() => setAEliminar(null)} onEliminado={recargar} />
      </div>
   );
}
