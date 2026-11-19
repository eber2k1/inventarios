-- Imagen del producto en Cloudinary (URL de entrega y public_id)
ALTER TABLE "products" ADD COLUMN     "imagenId" VARCHAR(255),
ADD COLUMN     "imagenUrl" VARCHAR(500);
