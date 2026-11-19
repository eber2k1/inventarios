import { cloudinaryConfigurado, firmarParametros } from "@/lib/cloudinary";
import { CARPETA_PRODUCTOS } from "@/lib/validations/producto";

// Firma las subidas del widget de Cloudinary (signatureEndpoint de CldUploadWidget).
// Cuerpo: { paramsToSign: { timestamp, folder, source, ... } } → { signature }
// Solo autoriza subidas recientes a la carpeta de productos.
const VIGENCIA_S = 60 * 60;

export async function POST(request: Request) {
  if (!cloudinaryConfigurado()) {
    return Response.json({ ok: false, error: "Cloudinary no está configurado" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { paramsToSign?: unknown } | null;
  const params = body?.paramsToSign;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return Response.json({ ok: false, error: "Falta paramsToSign" }, { status: 400 });
  }
  const paramsToSign = params as Record<string, unknown>;

  if (paramsToSign.folder !== CARPETA_PRODUCTOS) {
    return Response.json({ ok: false, error: "Solo se permiten subidas a la carpeta de productos" }, { status: 403 });
  }
  const timestamp = Number(paramsToSign.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > VIGENCIA_S) {
    return Response.json({ ok: false, error: "La solicitud de subida expiró" }, { status: 403 });
  }

  return Response.json({ signature: firmarParametros(paramsToSign) });
}
