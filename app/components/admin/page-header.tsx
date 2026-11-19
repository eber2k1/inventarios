export default function PageHeader({ title, description }: { title: string, description: string }) {
   return (
      <header className="mb-8 border-b border-line pb-6">
         <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
         <p className="mt-2 max-w-prose text-subtle">{description}</p>
      </header>
   );
}
