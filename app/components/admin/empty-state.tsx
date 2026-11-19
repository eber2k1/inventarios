import type { IconType } from "react-icons";

// Un espacio de anaquel vacío: borde punteado esperando contenido
export default function EmptyState({ icon: Icon, title, children }: { icon: IconType, title: string, children: React.ReactNode }) {
   return (
      <section className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-line bg-paper px-6 py-10 md:px-10 md:py-14">
         <Icon aria-hidden="true" className="text-4xl text-subtle" />
         <h2 className="text-lg font-semibold">{title}</h2>
         <p className="max-w-prose text-subtle">{children}</p>
      </section>
   );
}
