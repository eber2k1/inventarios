import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

// Verifica que la app llega a Postgres (Neon) a través de Prisma
export async function GET() {
  await connection();

  try {
    const [row] = await prisma.$queryRaw<
      { now: Date; version: string; database: string }[]
    >`SELECT now() AS now, version() AS version, current_database() AS database`;

    return Response.json({ ok: true, ...row });
  } catch (error) {
    console.error("Health check failed:", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
