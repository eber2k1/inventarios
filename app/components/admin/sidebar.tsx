import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import NavSegunRol from "./nav-segun-rol";
import NavList from "./nav-list";
import UsuarioSesion from "./usuario-sesion";

export default function Sidebar() {
   return (
      <aside className="flex h-14 items-center border-b border-line bg-paper px-4 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:flex-col md:items-stretch md:border-r md:border-b-0 md:px-4 md:py-6">
         <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:mb-10 md:px-2"
         >
            <Image src="/images/logo.png" alt="" width={36} height={36} />
            <span className="text-lg font-semibold tracking-tight">Tiendita Enter</span>
         </Link>
         {/* El menú depende de la sesión (rol): mientras se lee se muestra vacío, para no enseñar secciones sin permiso */}
         <Suspense fallback={<NavList items={[]} />}>
            <NavSegunRol />
         </Suspense>
         <UsuarioSesion />
      </aside>
   );
}
