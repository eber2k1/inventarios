import { createHash } from "node:crypto";

// Utilidades de Cloudinary solo para el servidor: firma de subidas y borrado de imágenes.
// Usa NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, NEXT_PUBLIC_CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET del .env
// (el secreto nunca llega al navegador).

const nube = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const clave = () => process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ?? process.env.CLOUDINARY_API_KEY;
const secreto = () => process.env.CLOUDINARY_API_SECRET;

export function cloudinaryConfigurado() {
  return Boolean(nube() && clave() && secreto());
}

// Firma de Cloudinary: SHA-1 de los parámetros ordenados alfabéticamente ("a=1&b=2") + el secreto.
// No se firman file, cloud_name, resource_type ni api_key (el widget ya no los incluye en paramsToSign).
export function firmarParametros(parametros: Record<string, unknown>) {
  const secretoApi = secreto();
  if (!secretoApi) throw new Error("Cloudinary no está configurado");

  const cadena = Object.keys(parametros)
    .filter((k) => !["file", "cloud_name", "resource_type", "api_key"].includes(k))
    .filter((k) => parametros[k] !== undefined && parametros[k] !== null && parametros[k] !== "")
    .sort()
    .map((k) => {
      const v = parametros[k];
      return `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`;
    })
    .join("&");
  return createHash("sha1").update(cadena + secretoApi).digest("hex");
}

// La URL pertenece a la cuenta de Cloudinary configurada
export function esUrlDeLaCuenta(url: string) {
  const cuenta = nube();
  return !cuenta || url.startsWith(`https://res.cloudinary.com/${cuenta}/image/upload/`);
}

// Borra una imagen de Cloudinary (al reemplazarla o al eliminar el producto).
// Es un "mejor esfuerzo": si falla solo se registra en el log; la imagen huérfana no afecta a la app.
export async function eliminarImagen(publicId: string) {
  const cuenta = nube();
  const claveApi = clave();
  if (!cuenta || !claveApi || !secreto()) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const cuerpo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    invalidate: "true",
    api_key: claveApi,
    signature: firmarParametros({ public_id: publicId, timestamp, invalidate: "true" }),
  });

  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cuenta}/image/destroy`, {
      method: "POST",
      body: cuerpo,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as { result?: string } | null;
    if (!res.ok || (json?.result !== "ok" && json?.result !== "not found")) {
      console.error(`No se pudo borrar la imagen ${publicId} de Cloudinary:`, res.status, json);
    }
  } catch (error) {
    console.error(`No se pudo borrar la imagen ${publicId} de Cloudinary:`, error);
  }
}
