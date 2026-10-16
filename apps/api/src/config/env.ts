import { z } from "zod";

const environmentSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z.string().default("").refine((value) => value.split(",").filter(Boolean).every((origin) => {
    try { const parsed = new URL(origin.trim()); return ["http:", "https:"].includes(parsed.protocol) && parsed.origin === origin.trim(); }
    catch { return false; }
  }), "CORS_ORIGINS must contain comma-separated HTTP origins")
});

export const env = environmentSchema.parse(process.env);
