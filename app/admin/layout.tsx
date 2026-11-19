import type { Metadata } from "next";
import { Onest } from "next/font/google";
import Sidebar from "../components/admin/sidebar";
import Toaster from "../components/admin/toaster";

const onest = Onest({ subsets: ["latin"] });

export const metadata: Metadata = {
   title: {
      template: "%s | Tiendita Enter",
      default: "Panel | Tiendita Enter",
   },
};

export default function Layout({children}: {children: React.ReactNode}) {
   return (
      <div className={`${onest.className} min-h-dvh bg-canvas text-ink md:flex`}>
         <a
            href="#contenido"
            className="sr-only rounded-lg border-2 border-ink bg-paper px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-30"
         >
            Saltar al contenido
         </a>
         <Sidebar />
         <div id="contenido" tabIndex={-1} className="min-w-0 flex-1 px-4 pt-6 pb-28 outline-none md:px-10 md:py-10">
            <div className="max-w-5xl">
               {children}
            </div>
         </div>
         <Toaster />
      </div>
   );
}
