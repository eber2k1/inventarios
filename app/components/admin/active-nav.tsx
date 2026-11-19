"use client";

import { usePathname } from "next/navigation";
import NavList from "./nav-list";
import { menuItems } from "./menu";

export default function ActiveNav({ permitidas }: { permitidas: string[] }) {
   const pathname = usePathname();
   // También marca la sección en subrutas, p. ej. /admin/clientes/123
   const active = menuItems.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
   );

   return <NavList activeHref={active?.href} items={menuItems.filter((item) => permitidas.includes(item.href))} />;
}
