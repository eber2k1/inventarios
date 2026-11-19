-- Roles de usuario: SUPER_USUARIO (admin@admin.com) y USUARIO (toda cuenta nueva)
-- PostgreSQL no permite quitar valores de un enum: se crea el nuevo y se convierte la columna
ALTER TYPE "Rol" RENAME TO "Rol_old";
CREATE TYPE "Rol" AS ENUM ('SUPER_USUARIO', 'USUARIO');

ALTER TABLE "users" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "rol" TYPE "Rol"
  USING (CASE WHEN lower("email") = 'admin@admin.com' THEN 'SUPER_USUARIO' ELSE 'USUARIO' END)::"Rol";
ALTER TABLE "users" ALTER COLUMN "rol" SET DEFAULT 'USUARIO';

DROP TYPE "Rol_old";

-- Las cuentas creadas con GitHub u otros métodos no tienen contraseña
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
