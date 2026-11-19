import type { Metadata } from "next";
import { IoHomeOutline } from "react-icons/io5";
import PageHeader from "@/app/components/admin/page-header";
import EmptyState from "@/app/components/admin/empty-state";

export const metadata: Metadata = { title: "Inicio" };

export default function DashboardPage() {
   return (
      <>
         <PageHeader title="Inicio" description="Cómo va tu tienda hoy." />
         <EmptyState icon={IoHomeOutline} title="Aquí verás el resumen de tu tienda">
            Cuando registres productos y ventas, este espacio mostrará lo que se vendió hoy y qué productos se están acabando.
         </EmptyState>
      </>
   );
}
