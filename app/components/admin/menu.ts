import type { IconType } from "react-icons";
import {
   IoHome, IoHomeOutline,
   IoPeople, IoPeopleOutline,
   IoCube, IoCubeOutline,
   IoReceipt, IoReceiptOutline,
} from "react-icons/io5";

export interface MenuItem {
   name: string,
   href: string,
   icon: IconType,
   // Ícono relleno para la página activa: el estado no depende solo del color
   activeIcon: IconType
}

export const menuItems: MenuItem[] = [
   { name: "Inicio", href: "/admin/dashboard", icon: IoHomeOutline, activeIcon: IoHome },
   { name: "Clientes", href: "/admin/clientes", icon: IoPeopleOutline, activeIcon: IoPeople },
   { name: "Productos", href: "/admin/productos", icon: IoCubeOutline, activeIcon: IoCube },
   { name: "Ventas", href: "/admin/ventas", icon: IoReceiptOutline, activeIcon: IoReceipt },
];
