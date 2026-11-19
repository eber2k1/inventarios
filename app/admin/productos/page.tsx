import type { Metadata } from "next";
import PageHeader from "@/app/components/admin/page-header";
import ProductosPanel from "@/app/components/admin/productos/productos-panel";

export const metadata: Metadata = { title: "Productos" };

export default function ProductosPage() {
   return (
      <>
         <PageHeader title="Productos" description="Lo que vendes, con su precio y las unidades que te quedan." />
         <ProductosPanel />
      </>
   );
}
