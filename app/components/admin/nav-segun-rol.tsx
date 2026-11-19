import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizarRol, puedeVerRuta } from "@/lib/permisos";
import ActiveNav from "./active-nav";
import { menuItems } from "./menu";

// Menú con solo las secciones que el rol del usuario puede ver (SUPER_USUARIO: todas; USUARIO: Productos)
export default async function NavSegunRol() {
   const sesion = await getServerSession(authOptions);
   const rol = normalizarRol(sesion?.user?.rol);
   const permitidas = menuItems.filter((item) => puedeVerRuta(rol, item.href)).map((item) => item.href);

   return <ActiveNav permitidas={permitidas} />;
}
