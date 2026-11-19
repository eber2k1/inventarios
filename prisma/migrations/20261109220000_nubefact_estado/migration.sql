-- CreateEnum
CREATE TYPE "EstadoSunat" AS ENUM ('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cadenaQr" VARCHAR(1000),
ADD COLUMN     "codigoHash" VARCHAR(100),
ADD COLUMN     "enlace" VARCHAR(500),
ADD COLUMN     "enlaceCdr" VARCHAR(500),
ADD COLUMN     "enlacePdf" VARCHAR(500),
ADD COLUMN     "enlaceXml" VARCHAR(500),
ADD COLUMN     "enviadoEn" TIMESTAMP(3),
ADD COLUMN     "estadoSunat" "EstadoSunat" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "sunatDescripcion" VARCHAR(1000),
ADD COLUMN     "sunatError" VARCHAR(1000);

-- CreateIndex
CREATE INDEX "invoices_estadoSunat_idx" ON "invoices"("estadoSunat");

