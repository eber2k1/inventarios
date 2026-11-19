import './globals.css'

// HeroUI solo cambia a su tema oscuro con la clase "dark" en <html>; el panel usa
// prefers-color-scheme. Este script sincroniza ambos antes del primer pintado (sin parpadeo)
// y sigue los cambios del sistema. Ver guía de Next: preventing-flash-before-hydration.
const sincronizarTema = `(function(){var m=window.matchMedia("(prefers-color-scheme: dark)");function a(){document.documentElement.classList.toggle("dark",m.matches)}a();m.addEventListener("change",a)})()`;

export default function RootLayout({children}: {children: React.ReactNode}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: sincronizarTema }} />
            </head>
            <body>
                <main>
                    {children}
                </main>
            </body>
        </html>
    );
}
