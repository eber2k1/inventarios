-- DropIndex
DROP INDEX "clientes_documento_key";

-- DropIndex
DROP INDEX "clientes_nombre_idx";

-- AlterTable
ALTER TABLE "clientes" DROP COLUMN "documento",
ADD COLUMN     "apellido" VARCHAR(100) NOT NULL,
ADD COLUMN     "dni" VARCHAR(8) NOT NULL,
ALTER COLUMN "nombre" SET DATA TYPE VARCHAR(100),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(150),
ALTER COLUMN "telefono" SET DATA TYPE VARCHAR(20),
ALTER COLUMN "direccion" SET NOT NULL,
ALTER COLUMN "direccion" SET DATA TYPE VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_dni_key" ON "clientes"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "clientes_apellido_nombre_idx" ON "clientes"("apellido", "nombre");


-- Regla manual (Prisma no la declara en el esquema): DNI peruano de 8 dígitos
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_dni_formato" CHECK ("dni" ~ '^[0-9]{8}$');
