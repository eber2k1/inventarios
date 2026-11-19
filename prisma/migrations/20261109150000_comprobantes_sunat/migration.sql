-- Comprobantes electrónicos (boleta/factura) para SUNAT vía Nubefact.
-- Migración escrita a mano: `migrate diff` convierte los renombres en DROP + CREATE
-- y perdería los clientes existentes. Aquí se RENOMBRA para conservar los datos.

-- 1. Venta y DetalleVenta se reemplazan por Comprobante y DetalleComprobante (estaban vacías)
DROP TABLE "detalles_venta";
DROP TABLE "ventas";
DROP TYPE "EstadoVenta";

-- 2. Tablas en inglés (con sus restricciones e índices, para que coincidan con lo que espera Prisma)
ALTER TABLE "usuarios" RENAME TO "users";
ALTER TABLE "users" RENAME CONSTRAINT "usuarios_pkey" TO "users_pkey";
ALTER INDEX "usuarios_email_key" RENAME TO "users_email_key";

ALTER TABLE "clientes" RENAME TO "customers";
ALTER TABLE "customers" RENAME CONSTRAINT "clientes_pkey" TO "customers_pkey";
ALTER INDEX "clientes_email_key" RENAME TO "customers_email_key";
ALTER INDEX "clientes_apellido_nombre_idx" RENAME TO "customers_apellido_nombre_idx";

ALTER TABLE "productos" RENAME TO "products";
ALTER TABLE "products" RENAME CONSTRAINT "productos_pkey" TO "products_pkey";
ALTER INDEX "productos_nombre_idx" RENAME TO "products_nombre_idx";

-- 3. Clientes: DNI (persona) o RUC (empresa)
CREATE TYPE "TipoDocumento" AS ENUM ('DNI', 'RUC');

ALTER TABLE "customers" DROP CONSTRAINT "clientes_dni_formato";
ALTER TABLE "customers" RENAME COLUMN "dni" TO "numeroDocumento";
ALTER INDEX "clientes_dni_key" RENAME TO "customers_numeroDocumento_key";
ALTER TABLE "customers"
  ADD COLUMN "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'DNI',
  ADD COLUMN "razonSocial" VARCHAR(200),
  ALTER COLUMN "numeroDocumento" SET DATA TYPE VARCHAR(11),
  ALTER COLUMN "nombre" DROP NOT NULL,
  ALTER COLUMN "apellido" DROP NOT NULL;

-- Reglas manuales (Prisma no las declara en el esquema)
ALTER TABLE "customers" ADD CONSTRAINT "customers_documento_formato" CHECK (
  ("tipoDocumento" = 'DNI' AND "numeroDocumento" ~ '^[0-9]{8}$')
  OR ("tipoDocumento" = 'RUC' AND "numeroDocumento" ~ '^(10|15|17|20)[0-9]{9}$')
);
ALTER TABLE "customers" ADD CONSTRAINT "customers_datos_por_tipo" CHECK (
  ("tipoDocumento" = 'DNI' AND "nombre" IS NOT NULL AND "apellido" IS NOT NULL)
  OR ("tipoDocumento" = 'RUC' AND "razonSocial" IS NOT NULL)
);

-- 4. Productos: código y precio con IGV
ALTER TABLE "products" RENAME COLUMN "sku" TO "codigo";
ALTER INDEX "productos_sku_key" RENAME TO "products_codigo_key";
ALTER TABLE "products" RENAME COLUMN "precio" TO "precioConIgv";
ALTER TABLE "products" ALTER COLUMN "codigo" SET DATA TYPE VARCHAR(30);
ALTER TABLE "products" ADD CONSTRAINT "products_valores_validos" CHECK ("stock" >= 0 AND "precioConIgv" >= 0);

-- 5. Comprobantes y su detalle
CREATE TYPE "TipoComprobante" AS ENUM ('BOLETA', 'FACTURA');

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "serie" VARCHAR(4) NOT NULL,
    "correlativo" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "igv" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoices_valores_validos" CHECK ("correlativo" > 0 AND "subtotal" >= 0 AND "igv" >= 0 AND "total" >= 0)
);

CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_items_valores_validos" CHECK ("cantidad" > 0 AND "precioUnitario" >= 0 AND "total" >= 0)
);

CREATE UNIQUE INDEX "invoices_serie_correlativo_key" ON "invoices"("serie", "correlativo");
CREATE INDEX "invoices_fecha_idx" ON "invoices"("fecha");
CREATE INDEX "invoices_clienteId_idx" ON "invoices"("clienteId");
CREATE INDEX "invoice_items_comprobanteId_idx" ON "invoice_items"("comprobanteId");
CREATE INDEX "invoice_items_productoId_idx" ON "invoice_items"("productoId");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
