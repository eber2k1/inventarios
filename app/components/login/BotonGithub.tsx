"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@heroui/react";
import { IoLogoGithub } from "react-icons/io5";

// Mensajes para los errores con los que NextAuth vuelve al login (?error=...)
const ERRORES: Record<string, string> = {
  AccessDenied: "Tu cuenta de GitHub no tiene acceso a este panel.",
  OAuthCallback: "GitHub canceló o rechazó el inicio de sesión. Inténtalo de nuevo.",
  OAuthSignin: "No se pudo conectar con GitHub. Inténtalo de nuevo.",
};

// Inicia sesión con GitHub (NextAuth v4). Al volver, entra al panel o a la página que se pidió (?callbackUrl=)
export default function BotonGithub() {
  const params = useSearchParams();
  const [enviando, setEnviando] = useState(false);

  const destino = params.get("callbackUrl");
  const callbackUrl = destino?.startsWith("/admin") ? destino : "/admin/dashboard";
  const error = params.get("error");

  return (
    <div className="mt-4 flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {ERRORES[error] ?? "No se pudo iniciar sesión. Inténtalo de nuevo."}
        </p>
      )}
      <Button
        className="w-full"
        variant="primary"
        isPending={enviando}
        onPress={() => {
          setEnviando(true);
          void signIn("github", { callbackUrl });
        }}
      >
        {!enviando && <IoLogoGithub aria-hidden="true" className="size-5" />}
        {enviando ? "Conectando con GitHub…" : "Iniciar sesión con GitHub"}
      </Button>
    </div>
  );
}
