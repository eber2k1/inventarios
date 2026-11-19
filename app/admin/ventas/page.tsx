import type { Metadata } from "next";
import PageHeader from "@/app/components/admin/page-header";
import VentasPanel from "@/app/components/admin/ventas/ventas-panel";

export const metadata: Metadata = { title: "Ventas" };

export default function VentasPage() {
   return (
      <>
         <PageHeader title="Ventas" description="Emite boletas y facturas electrónicas en SUNAT y revisa cada venta con su detalle." />
         <VentasPanel />
      </>
   );
}
