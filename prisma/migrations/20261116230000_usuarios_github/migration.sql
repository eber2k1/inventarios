-- Cuentas que inician sesión con GitHub: se registran en users (rol USUARIO por defecto) identificadas por su id de GitHub
ALTER TABLE "users" ADD COLUMN "githubId" VARCHAR(30);
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");
