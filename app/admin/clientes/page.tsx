import type { Metadata } from "next";
import PageHeader from "@/app/components/admin/page-header";
import ClientesPanel from "@/app/components/admin/clientes/clientes-panel";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientesPage() {
   return (
      <>
         <PageHeader title="Clientes" description="Las personas que compran en tu tienda y sus datos de contacto." />
         <ClientesPanel />
      </>
   );
}
