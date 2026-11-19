"use client";

import { Toast } from "@heroui/react";

// Región de notificaciones del panel. Va en un Client Component porque Toast.Provider
// es una propiedad del componente compuesto y no se puede referenciar desde un Server Component
export default function Toaster() {
   return <Toast.Provider placement="bottom end" />;
}
