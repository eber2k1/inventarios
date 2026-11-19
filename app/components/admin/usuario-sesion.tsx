"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar, Button } from "@heroui/react";
import { IoLogOutOutline } from "react-icons/io5";

type Usuario = { name?: string | null; email?: string | null; image?: string | null; login?: string };

// Usuario con sesión iniciada (GitHub o correo) y botón para cerrarla (en la barra lateral del panel)
export default function UsuarioSesion() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    let vigente = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: { user?: Usuario }) => vigente && setUsuario(s?.user ?? null))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const nombre = usuario?.name || usuario?.login || usuario?.email || "";
  const detalle = usuario?.login ? `@${usuario.login}` : usuario?.email;

  return (
    <div className="ms-auto flex items-center gap-2 md:ms-0 md:mt-auto md:flex-col md:items-stretch md:gap-3 md:border-t md:border-line md:pt-4">
      {usuario && (
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <Avatar size="sm">
            {usuario.image && <Avatar.Image alt="" src={usuario.image} />}
            <Avatar.Fallback>{nombre.slice(0, 1).toUpperCase()}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0 text-sm leading-tight">
            <p className="truncate font-medium">{nombre}</p>
            {detalle && <p className="truncate text-xs text-muted">{detalle}</p>}
          </div>
        </div>
      )}
      <Button
        size="sm"
        variant="ghost"
        isPending={saliendo}
        onPress={() => {
          setSaliendo(true);
          void signOut({ callbackUrl: "/" });
        }}
      >
        {!saliendo && <IoLogOutOutline aria-hidden="true" className="size-4" />}
        Cerrar sesión
      </Button>
    </div>
  );
}
