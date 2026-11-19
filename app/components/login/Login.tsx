"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, FieldError, Form, Input, Label, TextField } from "@heroui/react";

// Inicio de sesión con correo y contraseña (NextAuth, proveedor "credentials").
// Al entrar va al panel o a la página que se pidió (?callbackUrl=)
export default function Login() {
  const params = useSearchParams();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destino = params.get("callbackUrl");
  const callbackUrl = destino?.startsWith("/admin") ? destino : "/admin/dashboard";

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      const r = await signIn("credentials", {
        redirect: false,
        email: String(datos.get("email") ?? "").trim(),
        password: String(datos.get("password") ?? ""),
        callbackUrl,
      });
      if (r?.ok && !r.error) {
        // Navegación completa: pasa por el proxy, que también guarda el access_token
        window.location.assign(callbackUrl);
        return;
      }
      setError(
        r?.error === "CredentialsSignin"
          ? "Correo o contraseña incorrectos."
          : "No se pudo iniciar sesión. Inténtalo de nuevo.",
      );
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
    setEnviando(false);
  }

  return (
    <Form className="mt-6 flex flex-col gap-4" onSubmit={enviar} aria-label="Iniciar sesión con correo">
      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <TextField isRequired name="email" type="email" isDisabled={enviando}>
        <Label>Correo</Label>
        <Input placeholder="abc@gmail.com" autoComplete="email" maxLength={150} />
        <FieldError />
      </TextField>
      <TextField isRequired name="password" type="password" isDisabled={enviando}>
        <Label>Contraseña</Label>
        <Input placeholder="Contraseña" autoComplete="current-password" maxLength={200} />
        <FieldError />
      </TextField>
      <Button type="submit" className="w-full bg-black" isPending={enviando}>
        {enviando ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </Form>
  );
}
