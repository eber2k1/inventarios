"use client";

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import { Avatar, Button, toast } from "@heroui/react";
import { getCldImageUrl } from "next-cloudinary";
import { IoCloudUploadOutline, IoCubeOutline, IoTrashOutline } from "react-icons/io5";
import { CARPETA_PRODUCTOS } from "@/lib/validations/producto";
import { TEXTOS_WIDGET_ES } from "./textos-widget";

// El widget solo funciona en el navegador (y usa Math.random() al renderizar, que el prerender no admite):
// se carga sin SSR, con un botón deshabilitado mientras tanto
const CldUploadWidget = dynamic(() => import("next-cloudinary").then((m) => m.CldUploadWidget), {
   ssr: false,
   loading: () => (
      <Button variant="secondary" isDisabled>
         <IoCloudUploadOutline aria-hidden="true" />
         Subir imagen
      </Button>
   ),
});

export type ImagenGuardada = { url: string; id: string } | null;

// Miniatura cuadrada servida por Cloudinary (recorte inteligente, formato y calidad automáticos)
export function miniaturaProducto(imagenId: string, px: number) {
   return getCldImageUrl({ src: imagenId, width: px, height: px, crop: "fill", gravity: "auto" });
}

// Avatar del producto: su imagen de Cloudinary o, si no tiene, un ícono
export function AvatarProducto({
   nombre,
   imagenId,
   size = "md",
   className,
}: {
   nombre: string;
   imagenId: string | null;
   size?: "sm" | "md" | "lg";
   className?: string;
}) {
   return (
      <Avatar size={size} className={className}>
         {imagenId && <Avatar.Image alt={nombre} src={miniaturaProducto(imagenId, 160)} />}
         <Avatar.Fallback>
            <IoCubeOutline aria-hidden="true" className="size-1/2" />
         </Avatar.Fallback>
      </Avatar>
   );
}

// Subida de la imagen del producto a Cloudinary (subida firmada por /api/cloudinary/firma).
// La URL y el public_id viajan en campos ocultos del formulario (imagenUrl, imagenId) y se guardan en la BD.
// `enLinea`: el widget se dibuja dentro del formulario en vez de sobre toda la página. Hace falta dentro de un
// modal, porque el modal desactiva (inert) todo lo que está fuera de él, incluido el widget flotante.
export default function ImagenProducto({
   inicial,
   nombre,
   enLinea = false,
}: {
   inicial: ImagenGuardada;
   nombre?: string;
   enLinea?: boolean;
}) {
   const [imagen, setImagen] = useState<ImagenGuardada>(inicial);
   const [abierto, setAbierto] = useState(false); // solo en línea: muestra el contenedor del widget
   const idContenedor = `widget-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
   const configurada = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY);

   return (
      <div className="flex flex-col gap-2 md:col-span-2">
         <span id="imagen-producto" className="text-sm font-medium">Imagen del producto</span>
         <div className="flex flex-wrap items-center gap-4" role="group" aria-labelledby="imagen-producto">
            <AvatarProducto nombre={nombre || "Imagen del producto"} imagenId={imagen?.id ?? null} className="size-20" />
            <input type="hidden" name="imagenUrl" value={imagen?.url ?? ""} />
            <input type="hidden" name="imagenId" value={imagen?.id ?? ""} />

            {configurada ? (
               <CldUploadWidget
                  signatureEndpoint="/api/cloudinary/firma"
                  options={{
                     folder: CARPETA_PRODUCTOS,
                     sources: ["local", "url", "camera"],
                     multiple: false,
                     maxFiles: 1,
                     resourceType: "image",
                     clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
                     maxFileSize: 5_000_000,
                     cropping: true,
                     croppingAspectRatio: 1,
                     showSkipCropButton: true,
                     language: "es",
                     text: TEXTOS_WIDGET_ES,
                     ...(enLinea && { inlineContainer: `#${idContenedor}` }),
                  }}
                  onSuccess={(resultado) => {
                     const info = resultado.info;
                     if (info && typeof info !== "string" && info.secure_url && info.public_id) {
                        setImagen({ url: info.secure_url, id: info.public_id });
                     }
                  }}
                  onClose={() => setAbierto(false)}
                  onQueuesEnd={(_resultado, { widget }) => {
                     widget.close();
                     setAbierto(false);
                  }}
                  onError={() =>
                     toast.danger("No se pudo subir la imagen", {
                        description: "Revisa el archivo (JPG, PNG o WEBP de hasta 5 MB) e inténtalo de nuevo.",
                     })
                  }
               >
                  {({ open, close, isLoading }) => (
                     <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                           {enLinea && abierto ? (
                              <Button
                                 variant="secondary"
                                 onPress={() => {
                                    close();
                                    setAbierto(false);
                                 }}
                              >
                                 Cancelar subida
                              </Button>
                           ) : (
                              <Button
                                 variant="secondary"
                                 isPending={isLoading}
                                 onPress={() => {
                                    setAbierto(true);
                                    open();
                                 }}
                              >
                                 {!isLoading && <IoCloudUploadOutline aria-hidden="true" />}
                                 {imagen ? "Cambiar imagen" : "Subir imagen"}
                              </Button>
                           )}
                           {imagen && !(enLinea && abierto) && (
                              <Button variant="ghost" className="text-danger" onPress={() => setImagen(null)}>
                                 <IoTrashOutline aria-hidden="true" />
                                 Quitar
                              </Button>
                           )}
                        </div>
                        <p className="text-xs text-muted">JPG, PNG o WEBP de hasta 5 MB. Se recorta en formato cuadrado.</p>
                     </div>
                  )}
               </CldUploadWidget>
            ) : (
               <p className="text-sm text-muted">La subida de imágenes no está configurada (faltan las variables de Cloudinary).</p>
            )}
         </div>
         {/* Contenedor del widget en línea (siempre montado: el widget se crea apuntando a él) */}
         {enLinea && (
            <div
               id={idContenedor}
               className={abierto ? "h-[26rem] overflow-hidden rounded-lg border border-line" : "hidden"}
            />
         )}
      </div>
   );
}
