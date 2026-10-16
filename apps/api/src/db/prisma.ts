import { PrismaClient } from "../generated/client/index.js";

const prismaGlobal = globalThis as typeof globalThis & { hrConsolePrisma?: PrismaClient };

export const prisma = prismaGlobal.hrConsolePrisma ?? createPrisma();

function createPrisma() {
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  client.$on("query", (event) => {
    if (event.duration > 500) {
      console.warn(JSON.stringify({ event: "slow_database_query", durationMs: event.duration }));
    }
  });
  return client;
}

if (process.env.NODE_ENV !== "production") prismaGlobal.hrConsolePrisma = prisma;
