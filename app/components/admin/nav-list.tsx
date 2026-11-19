import Link from "next/link";
import type { MenuItem } from "./menu";

// Abajo en celular (al alcance del pulgar), vertical en el sidebar desde md
export default function NavList({ activeHref, items }: { activeHref?: string; items: MenuItem[] }) {
   return (
      <nav
         aria-label="Menú principal"
         className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:static md:border-0 md:bg-transparent md:pb-0"
      >
         {/* Una columna por sección visible en celular (según el rol puede haber una sola) */}
         <ul
            className="grid md:flex md:flex-col md:gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}
         >
            {items.map((item) => {
               const active = item.href === activeHref;
               const Icon = active ? item.activeIcon : item.icon;

               return (
                  <li key={item.href}>
                     <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        data-active={active}
                        className="group flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-subtle outline-none transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ink motion-reduce:transition-none data-[active=true]:font-semibold data-[active=true]:text-ink md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:border-2 md:border-transparent md:px-3 md:text-base md:hover:bg-canvas md:focus-visible:outline-offset-2 md:data-[active=true]:border-[#1f1d18] md:data-[active=true]:bg-bag md:data-[active=true]:text-[#1f1d18] md:data-[active=true]:shadow-[3px_3px_0_0_#1f1d18]"
                     >
                        <span
                           aria-hidden="true"
                           className="flex h-8 w-12 items-center justify-center rounded-full border-2 border-transparent text-xl group-data-[active=true]:border-[#1f1d18] group-data-[active=true]:bg-bag group-data-[active=true]:text-[#1f1d18] md:h-auto md:w-auto md:border-0 md:group-data-[active=true]:bg-transparent"
                        >
                           <Icon />
                        </span>
                        {item.name}
                     </Link>
                  </li>
               );
            })}
         </ul>
      </nav>
   );
}
